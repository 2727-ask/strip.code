// =====================================================
// ASSET PATHS
// Files live in the /public folder; paths start from there.
// =====================================================
export const ASSETS = {
  dancer: '/models/girl.glb',
  // dancer: '/models/girl1.fbx',    // older FBX version: use with CHARACTER.scale = 0.01

  animations: {
    Dance_1: '/animations/dance1.fbx',
    Dance_2: '/animations/dance2.fbx',
    Dance_4: '/animations/dance4.fbx',
    Dance_5: '/animations/dance5.fbx',
    // Strip clips: all placeholders (dance3) until dedicated ones exist. Point any of
    // these at its own file; a file shared by several keys is only parsed once.
    Strip_Bra: '/animations/dance3.fbx',
    Strip_Panties: '/animations/dance3.fbx',
    Strip_Belt: '/animations/dance3.fbx',
    Strip_Stockings: '/animations/dance3.fbx',
  },
};

// =====================================================
// SHOW ORDER
// =====================================================
// Dance loops she cycles through: the "Change Dance" button and each finished
// strip both move on to the next one. Keys come from ASSETS.animations.
export const DANCE_SEQUENCE = ['Dance_1', 'Dance_2', 'Dance_4', 'Dance_5'];

// Garments in the order they come off. Each one simply disappears while its
// strip clip plays: no grab, toss or fall.
//
// label + icon are shown in the progress bar at the top of the scene
// (icon: 'stockings' | 'belt' | 'bra' | 'panties', drawn in progress.js).
export const STRIP_SEQUENCE = [
  {
    garmentKeyword: 'stockings',    // part of the mesh name (see console log)
    animation: 'Strip_Stockings',   // key from ASSETS.animations
    removeAt: 0.30,                 // 0–1 point in the clip where the garment disappears
    label: 'Stockings',
    icon: 'stockings',
  },
  {
    garmentKeyword: 'belt',         // matches Cloth_Belt (the suspender belt)
    animation: 'Strip_Belt',
    removeAt: 0.30,
    label: 'Belt',
    icon: 'belt',
  },
  {
    garmentKeyword: 'bra',
    animation: 'Strip_Bra',
    removeAt: 0.35,
    label: 'Bra',
    icon: 'bra',
  },
  {
    garmentKeyword: 'panties',
    animation: 'Strip_Panties',
    removeAt: 0.30,
    label: 'Panties',
    icon: 'panties',
  },
];

// =====================================================
// CHARACTER
// =====================================================
export const CHARACTER = {
  scale: 1,               // models/girl.glb already has its own 0.01 armature scale; girl1.fbx needs 0.01
  castShadow: true,
  rootBone: 'mixamorigHips',   // bone whose parent frame the clips are corrected for
  logMeshNames: true,     // print mesh names to the browser console
};

// =====================================================
// MATERIALS
// =====================================================
export const MATERIALS = {
  forceVisible: true,     // undo FBX "invisible" transparency
  alphaTest: 0.5,         // cut-out for lace and hair edges (0–1)
  doubleSided: true,      // show the inside of clothes and hair
  logInfo: false,         // print each material to the console
};

// =====================================================
// CAMERA
// =====================================================
export const CAMERA = {
  fov: 40,
  near: 0.05,
  far: 100,
  position: [0, 1.4, 3.5],
  target: [0, 1.0, 0],
};

// =====================================================
// RENDERER
// =====================================================
export const RENDERER = {
  background: 0x120612,
  maxPixelRatio: 2,
  shadows: true,
};

// =====================================================
// LIGHTS
// =====================================================
export const LIGHTS = {
  ambient: { sky: 0xffffff, ground: 0x332233, intensity: 1.5 },
  key:     { color: 0xffeedd, intensity: 2.5, position: [2, 4, 3] },
  accent:  { color: 0xff3399, intensity: 8, distance: 6, position: [-1.5, 2, 1] },
};

// =====================================================
// NEON SIGN
// A pink neon tube sign behind the dancer. Letters available: S t r i p C o d e
// (and spaces); drawn in neon.js.
// =====================================================
export const NEON = {
  enabled: true,
  text: 'StripCode',
  color: 0xff2d95,          // the glow
  coreColor: 0xffe0f0,      // the hot centre of each tube
  position: [0, 2.35, -1.8], // x, y, z in metres (the middle of the sign)
  width: 2.6,               // metres
  tubeRadius: 0.013,        // metres
  light: { intensity: 4, distance: 7, offsetZ: 0.9 }, // offsetZ: how far in front of the sign the lamp sits
  flicker: true,            // gentle breathing, plus one letter that stutters now and then
};

// =====================================================
// STAGE
// =====================================================
export const STAGE = {
  radius: 4,
  segments: 64,
  color: 0x1a1a1a,
  roughness: 0.4,
  floorY: 0,
};

// =====================================================
// ANIMATION
// =====================================================
export const ANIMATION = {
  crossFade: 0.4,         // seconds to blend between clips
  maxDelta: 0.05,         // cap frame time to avoid jumps
  autoChangeDance: true,  // she moves on to the next dance by herself
  loopsPerDance: 1,       // ...after playing the current one through this many times
};

// =====================================================
// UI
// =====================================================
export const UI = {
  stageId: 'viewport',         // the area the 3D canvas fills (left side, below the progress bar)
  panelId: 'panel',            // right side: problems and code editor
  progressId: 'progress',      // progress bar at the top of the scene
  danceButtonId: 'danceBtn',
  danceText: 'Change Dance',   // button tooltip; the dance number, e.g. "(2/4)", is appended
  loadingId: 'loading',
};

// =====================================================
// PYTHON (Pyodide)
// Loaded from the CDN the first time the page opens, then cached by the browser.
// =====================================================
export const PYTHON = {
  pyodideUrl: 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/',
  testTimeoutMs: 5000,         // a test running longer than this is "Time limit exceeded"
};