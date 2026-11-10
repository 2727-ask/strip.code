import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import {
  ASSETS, DANCE_SEQUENCE, STRIP_SEQUENCE, CHARACTER, CAMERA,
  RENDERER, LIGHTS, STAGE, ANIMATION, UI, MATERIALS, NEON, MUSIC, ENTRANCE,
} from './config.js';
import './theme.css'; // before the component styles so they can use its tokens
import './app.css';
import { initPanel } from './panel.js';
import { initProgress } from './progress.js';
import { createNeonSign } from './neon.js';
import { loadClip } from './animations.js';
import { setTask, fail, revealed } from './loading.js';
import { music } from './music.js';

// =====================================================
// STATE
// =====================================================
const state = {
  dancer: null,
  mixer: null,
  actions: {},
  currentAction: null,
  danceIndex: 0,          // position in the list of loaded dances
  danceLoops: 0,          // times the current dance has played through
  strips: [],
  stripIndex: 0,
  pendingStrips: 0,       // solved problems waiting for their strip to play
  activeStrip: null,
  entrance: null,         // her walk onto the stage, while it lasts (see the ENTRANCE section)
  walkTravel: 0,          // metres the walk clip carries her forward
};

// =====================================================
// SCENE SETUP
// =====================================================
// The 3D scene fills the left side of the page, not the whole window
const stage = document.getElementById(UI.stageId);

function stageSize() {
  return {
    width: stage.clientWidth || innerWidth,
    height: stage.clientHeight || innerHeight,
  };
}

function createRenderer() {
  const { width, height } = stageSize();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(devicePixelRatio, RENDERER.maxPixelRatio));
  renderer.shadowMap.enabled = RENDERER.shadows;
  stage.appendChild(renderer.domElement);
  return renderer;
}

function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(RENDERER.background);
  return scene;
}

function createCamera(renderer) {
  const { width, height } = stageSize();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, width / height, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...CAMERA.target);
  controls.update();

  return camera;
}

function addLights(scene) {
  const { ambient, key, accent } = LIGHTS;

  scene.add(new THREE.HemisphereLight(ambient.sky, ambient.ground, ambient.intensity));

  const keyLight = new THREE.DirectionalLight(key.color, key.intensity);
  keyLight.position.set(...key.position);
  keyLight.castShadow = RENDERER.shadows;
  scene.add(keyLight);

  const accentLight = new THREE.PointLight(accent.color, accent.intensity, accent.distance);
  accentLight.position.set(...accent.position);
  scene.add(accentLight);
}

function addStage(scene) {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(STAGE.radius, STAGE.segments),
    new THREE.MeshStandardMaterial({ color: STAGE.color, roughness: STAGE.roughness })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = STAGE.floorY;
  floor.receiveShadow = true;
  scene.add(floor);
}

function handleResize(renderer, camera) {
  new ResizeObserver(() => {
    const { width, height } = stageSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }).observe(stage);
}

const renderer = createRenderer();
const scene = createScene();
const camera = createCamera(renderer);
addLights(scene);
addStage(scene);
handleResize(renderer, camera);

const neon = NEON.enabled ? createNeonSign(NEON) : null;
if (neon) scene.add(neon.group);

// =====================================================
// LOADERS
// =====================================================
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

function describeTexture(tex) {
  if (!tex) return null;
  const img = tex.image;
  const src = img?.currentSrc || img?.src || img?.name || (img ? `${img.width}x${img.height}` : 'no image');
  return String(src).slice(0, 60);
}

// Imported models often come in see-through or one-sided; make every material
// render the way the artist intended, per the MATERIALS settings.
function fixMaterials(root) {
  if (MATERIALS.logInfo) console.log('--- Materials in dancer ---');

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.frustumCulled = false; // skinned bounds are often wrong in FBX
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

    materials.forEach((m) => {
      if (MATERIALS.logInfo) {
        console.log(
          `${obj.name} | ${m.name} | ${m.type} | opacity=${m.opacity} transparent=${m.transparent}`
          + ` side=${m.side} map=${describeTexture(m.map)} alphaMap=${describeTexture(m.alphaMap)}`
        );
      }

      if (MATERIALS.forceVisible) {
        m.opacity = 1;
        m.transparent = false;
        m.visible = true;
        m.depthWrite = true;
        m.alphaMap = null;
      }
      if (MATERIALS.alphaTest > 0 && m.map) m.alphaTest = MATERIALS.alphaTest;
      if (MATERIALS.doubleSided) m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    });
  });
}

async function loadDancer() {
  const gltf = await gltfLoader.loadAsync(ASSETS.dancer, (event) => {
    // leave the last few percent for parsing and building the meshes
    if (event.lengthComputable) setTask('model', 0.95 * (event.loaded / event.total));
  });
  const dancer = gltf.scene;
  dancer.scale.setScalar(CHARACTER.scale);

  if (CHARACTER.logMeshNames) console.log('--- Meshes in dancer ---');
  dancer.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = CHARACTER.castShadow;
    if (CHARACTER.logMeshNames) console.log(obj.name);
  });

  fixMaterials(dancer);
  scene.add(dancer);
  setTask('model', 1);
  return dancer;
}

// Mixamo clips assume the hips bone has an un-rotated parent. A GLB exported
// from Blender wraps the skeleton in a rotated Armature node (+90° on X), so the
// hips tracks must be re-expressed in that parent's frame or she lies on her
// back. A no-op for models whose hips parent is already un-rotated.
function retargetClip(clip, dancer) {
  const hips = dancer.getObjectByName(CHARACTER.rootBone);
  if (!hips?.parent) return clip;

  dancer.updateMatrixWorld(true);
  const toParent = hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  if (toParent.angleTo(new THREE.Quaternion()) < 1e-3) return clip;

  const vec = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  for (const track of clip.tracks) {
    const v = track.values;
    if (track.name === `${CHARACTER.rootBone}.position`) {
      for (let i = 0; i < v.length; i += 3) {
        vec.fromArray(v, i).applyQuaternion(toParent).toArray(v, i);
      }
    } else if (track.name === `${CHARACTER.rootBone}.quaternion`) {
      for (let i = 0; i < v.length; i += 4) {
        quat.fromArray(v, i).premultiply(toParent).toArray(v, i);
      }
    }
  }
  return clip;
}

// Download every distinct clip file once, all in parallel (keys that share a file
// share the download). A clip that fails is skipped, not fatal.
async function downloadClips() {
  const urls = [...new Set(Object.values(ASSETS.animations))];
  const done = new Map(urls.map((url) => [url, 0]));
  const report = () => setTask('animations', [...done.values()].reduce((sum, f) => sum + f, 0) / urls.length);

  const clips = new Map();
  await Promise.all(
    urls.map(async (url) => {
      try {
        clips.set(url, await loadClip(url, (fraction) => (done.set(url, fraction), report())));
      } catch (error) {
        console.warn(`Animation missing: ${url}`, error);
      }
      done.set(url, 1);
      report();
    })
  );
  return clips;
}

// The walk clip carries the hips forward along the stage (about 4 m in one pass).
// Take that travel out so she walks on the spot, and return how far it was, in
// metres; the entrance then moves her across the stage in step with the clip.
// Runs on the raw clip, before retargetClip, while the hips z axis is still "forward".
function takeOutTravel(clip, dancer) {
  const track = clip.tracks.find((t) => t.name === `${CHARACTER.rootBone}.position`);
  const hips = dancer.getObjectByName(CHARACTER.rootBone);
  if (!track || !hips?.parent || track.times.length < 2) return 0;

  const { times, values } = track;
  const last = times.length - 1;
  const start = values[2];
  const travel = values[last * 3 + 2] - start;
  const span = times[last] - times[0];
  for (let i = 0; i <= last; i++) {
    // leave the natural sway of the hips, drop the steady forward drift
    values[i * 3 + 2] -= start + travel * ((times[i] - times[0]) / span);
  }

  dancer.updateMatrixWorld(true);
  const unit = hips.parent.getWorldScale(new THREE.Vector3()).x; // clip units (cm) -> metres
  return travel * unit;
}

// Needs the dancer (the clips are corrected for her skeleton), so it runs after both loads
function buildActions(mixer, clips) {
  const actions = {};
  const retargeted = new Set(); // correct each clip once, even if several keys share it
  for (const [name, url] of Object.entries(ASSETS.animations)) {
    const clip = clips.get(url);
    if (!clip) {
      console.warn(`Animation missing: ${name} (${url})`);
      continue;
    }
    if (!retargeted.has(url)) {
      if (name === ENTRANCE.animation) state.walkTravel = takeOutTravel(clip, state.dancer);
      retargetClip(clip, state.dancer);
      retargeted.add(url);
    }
    // Clone so each key gets its own action (a shared clip would share one action)
    actions[name] = mixer.clipAction(clip.clone());
  }
  return actions;
}

// The fonts are already in the page's CSS; fetch them now so text never pops in later
function loadFonts() {
  const faces = ['18px "Bebas Neue"', '26px "Pacifico"', '400 14px "Poppins"', '500 14px "Poppins"', '600 14px "Poppins"'];
  return Promise.all(faces.map((face) => document.fonts.load(face)))
    .catch(() => {}) // a missing font falls back to a system one: not worth blocking on
    .then(() => setTask('fonts', 1));
}

// Compile every shader and draw a couple of frames now, while the age gate is still
// covering the page, so the first thing she does on screen is not a stutter.
async function warmUp() {
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    /* the first frames will compile what is missing */
  }
  const twoFrames = new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await Promise.race([twoFrames, new Promise((resolve) => setTimeout(resolve, 1500))]); // a hidden tab pauses frames
}

// =====================================================
// ANIMATION PLAYBACK
// =====================================================
function playAnimation(name, { loop = true } = {}) {
  const next = state.actions[name];
  if (!next) return null;
  if (loop && next === state.currentAction) return next;

  next.reset();
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
  next.clampWhenFinished = !loop;
  next.play();

  if (state.currentAction && state.currentAction !== next) {
    state.currentAction.crossFadeTo(next, ANIMATION.crossFade, false);
  }
  state.currentAction = next;
  return next;
}

// Dances that actually loaded (a missing file is skipped, not fatal)
function availableDances() {
  return DANCE_SEQUENCE.filter((name) => state.actions[name]);
}

function canChangeDance() {
  return availableDances().length > 1;
}

// Move on to the next dance in DANCE_SEQUENCE and play it. Used by the button,
// after each strip, and automatically (see onDanceLoop).
function changeDance() {
  const dances = availableDances();
  if (state.activeStrip || state.entrance || !dances.length) return;

  state.danceIndex = (state.danceIndex + 1) % dances.length;
  state.danceLoops = 0; // a fresh dance, so the automatic change starts counting again
  playAnimation(dances[state.danceIndex]);
  updateDanceButton();
}

// A dance has just played through once. After ANIMATION.loopsPerDance of those
// she moves on by herself. Switching right at the end of a loop keeps the blend
// into the next dance clean. Never during a strip, and the button resets the count.
function onDanceLoop(action) {
  if (!ANIMATION.autoChangeDance || state.activeStrip || action !== state.currentAction) return;

  state.danceLoops += 1;
  if (state.danceLoops >= ANIMATION.loopsPerDance) changeDance();
}

// =====================================================
// ENTRANCE
// When the age gate lifts she walks from the back of the stage to the middle, then
// starts to dance. Until then she waits at the start of the walk, behind the gate.
// The walk clip plays on the spot; her position along the stage follows the clip's
// own time, so her feet stay planted and she arrives exactly at ENTRANCE.endZ.
// =====================================================
function prepareEntrance() {
  const action = ENTRANCE.enabled ? playAnimation(ENTRANCE.animation, { loop: false }) : null;
  if (!action) return false;

  action.paused = true; // held on the first frame until the stage is revealed
  const endZ = ENTRANCE.endZ;
  state.entrance = { action, startZ: endZ - state.walkTravel, endZ, handedOver: false };
  state.dancer.position.z = state.entrance.startZ;

  revealed.then(() => {
    action.paused = false;
  });
  return true;
}

function updateEntrance() {
  const entrance = state.entrance;
  if (!entrance) return;

  const { action } = entrance;
  const duration = action.getClip().duration;
  const progress = Math.min(action.time / duration, 1);
  state.dancer.position.z = entrance.startZ + (entrance.endZ - entrance.startZ) * progress;

  // start the first dance a moment early, so the walk melts into it
  if (!entrance.handedOver && action.time >= duration - ANIMATION.crossFade) {
    entrance.handedOver = true;
    playAnimation(availableDances()[0]);
  }

  if (progress >= 1 || !action.enabled) finishEntrance();
}

function finishEntrance() {
  state.dancer.position.z = state.entrance.endZ;
  state.entrance = null;

  setDanceButton(canChangeDance());
  processStripQueue(); // a problem may have been solved while she was walking
}

// =====================================================
// GARMENT HELPERS
// =====================================================
function findMeshByKeyword(root, keyword) {
  const target = keyword.toLowerCase();
  let found = null;
  root.traverse((obj) => {
    if (!found && obj.isMesh && obj.name.toLowerCase().includes(target)) found = obj;
  });
  return found;
}

// =====================================================
// STRIP SYSTEM
// Solving problem N asks for strip N (see requestStrip). A garment just
// disappears at its removeAt point while the strip clip plays.
// =====================================================
function prepareStrips(dancer) {
  return STRIP_SEQUENCE.map((cfg) => {
    const mesh = findMeshByKeyword(dancer, cfg.garmentKeyword);
    if (!mesh) console.warn(`No garment found with keyword: "${cfg.garmentKeyword}"`);
    return { cfg, mesh };
  });
}

function removeGarment(strip) {
  strip.removed = true;
  if (strip.mesh) strip.mesh.visible = false;
}

// One entry per stage for the progress bar at the top of the scene.
// Solving a problem asks for a strip, so strips started + strips waiting
// = problems solved so far.
function progressModel() {
  const started = state.stripIndex;
  const solved = started + state.pendingStrips;

  return STRIP_SEQUENCE.map((cfg, index) => {
    if (index < started) {
      const strip = state.strips[index];
      if (strip?.removed) return { status: 'done', fraction: 1 };

      // her strip is playing: fill the ring up to the moment the garment comes off
      const active = state.activeStrip;
      const clipProgress = active ? active.action.time / active.action.getClip().duration : 0;
      return { status: 'removing', fraction: Math.min(clipProgress / cfg.removeAt, 1) };
    }
    if (index < solved) return { status: 'queued', fraction: 0 };
    if (index === solved) return { status: 'current', fraction: 0 };
    return { status: 'upcoming', fraction: 0 };
  });
}

// Called when a problem is solved. Strips play one at a time, in order, so a
// second problem solved mid-strip just waits its turn.
function requestStrip() {
  state.pendingStrips++;
  processStripQueue();
}

function processStripQueue() {
  const waiting = state.pendingStrips > 0;
  const ready = !state.activeStrip && !state.entrance && state.stripIndex < state.strips.length;
  if (!waiting || !ready) return;

  state.pendingStrips--;
  startNextStrip();
}

function startNextStrip() {
  const strip = state.strips[state.stripIndex++];
  setDanceButton(false);

  const action = playAnimation(strip.cfg.animation, { loop: false });
  if (!action) {
    // Strip clip failed to load: the garment still disappears, she just keeps dancing
    removeGarment(strip);
    onStripFinished();
    return;
  }

  state.activeStrip = { strip, action, removed: false };
}

function onStripFinished() {
  const active = state.activeStrip;
  if (active && !active.removed) removeGarment(active.strip); // clip ended before removeAt

  state.activeStrip = null;

  // Another solved problem is waiting: go straight into its strip
  if (state.pendingStrips > 0 && state.stripIndex < state.strips.length) {
    processStripQueue();
    return;
  }

  changeDance(); // otherwise she moves on to the next dance
  setDanceButton(canChangeDance());
}

function updateActiveStrip() {
  const active = state.activeStrip;
  if (!active || active.removed) return;

  const progress = active.action.time / active.action.getClip().duration;
  if (progress >= active.strip.cfg.removeAt) {
    removeGarment(active.strip);
    active.removed = true;
  }
}

// =====================================================
// UI
// =====================================================
const danceButton = document.getElementById(UI.danceButtonId);
danceButton.addEventListener('click', changeDance);

function setDanceButton(enabled) {
  danceButton.disabled = !enabled;
}

// The button is an icon only; its tooltip shows which dance is playing,
// e.g. "Change Dance (2/4)"
function updateDanceButton() {
  const label = `${UI.danceText} (${state.danceIndex + 1}/${availableDances().length})`;
  danceButton.title = label;
  danceButton.setAttribute('aria-label', label);
}

// The music itself starts from the age gate (a click is needed before a browser allows
// sound); this button just mutes and unmutes it. Its tooltip names the track playing.
const musicButton = document.getElementById(UI.musicButtonId);
musicButton.hidden = !MUSIC.enabled;
musicButton.addEventListener('click', () => music.toggle());
music.onChange(({ muted, track }) => {
  const label = muted ? 'Play music' : 'Mute music';
  musicButton.dataset.muted = String(muted);
  musicButton.title = track && !muted ? `${label} · ${track}` : label;
  musicButton.setAttribute('aria-label', label);
});

// Anything that stops the site from starting is reported to the age gate, which shows it
function showError(error) {
  console.error(error);
  fail(error);
}

// =====================================================
// INIT
// =====================================================
function hasSkeleton(root) {
  let found = false;
  root.traverse((obj) => { if (obj.isBone || obj.isSkinnedMesh) found = true; });
  return found;
}

async function init() {
  loadFonts(); // in parallel with everything below

  // The model and the dance clips download side by side
  const [dancer, clips] = await Promise.all([loadDancer(), downloadClips()]);
  state.dancer = dancer;

  // Static meshes can't play the Mixamo clips or have garments taken off
  if (!hasSkeleton(state.dancer)) {
    console.warn('Model has no skeleton: dance and strip animations are disabled.');
    setTask('animations', 1);
    await warmUp();
    setTask('scene', 1);
    return;
  }

  state.mixer = new THREE.AnimationMixer(state.dancer);

  state.mixer.addEventListener('finished', (e) => {
    if (state.activeStrip && e.action === state.activeStrip.action) onStripFinished();
  });
  state.mixer.addEventListener('loop', (e) => onDanceLoop(e.action));

  state.actions = buildActions(state.mixer, clips);
  state.strips = prepareStrips(state.dancer);

  state.danceIndex = 0;
  // she walks on first (and dances from there); without the walk clip she just starts dancing
  if (!prepareEntrance()) playAnimation(availableDances()[0]);
  updateDanceButton();
  setDanceButton(canChangeDance() && !state.entrance);
  processStripQueue(); // a problem may have been solved before the model finished loading

  await warmUp();
  setTask('scene', 1); // the last task: the age gate lifts once this and everything else is done
}

// =====================================================
// RENDER LOOP
// =====================================================
const clock = new THREE.Clock();
const progress = initProgress(STRIP_SEQUENCE);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), ANIMATION.maxDelta);

  state.mixer?.update(dt);
  updateEntrance();
  updateActiveStrip();
  progress.update(progressModel());
  neon?.update(clock.elapsedTime);

  renderer.render(scene, camera);
});

initPanel({ onSolved: requestStrip });
init().catch(showError);
