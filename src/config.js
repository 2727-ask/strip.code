// =====================================================
// ASSET PATHS
// Files live in the /public folder; paths start from there. They are resolved
// against the page, so the site works from any URL path, e.g. a GitHub Pages
// project site served from /<repo>/ (see `base` in vite.config.js).
// =====================================================
const asset = (path) => new URL(import.meta.env.BASE_URL + path, document.baseURI).href;

export const ASSETS = {
  dancer: asset('models/girl.glb'),

  // Dance clips are small .json files made from the Mixamo .fbx originals in
  // source-assets/animations by `npm run convert:animations`.
  animations: {
    Dance_1: asset('animations/dance1.json'),
    Dance_2: asset('animations/dance2.json'),
    Dance_4: asset('animations/dance4.json'),
    Dance_5: asset('animations/dance5.json'),
    Walk: asset('animations/walk.json'),   // her entrance (see ENTRANCE)
    // Strip clips: all placeholders (dance3) until dedicated ones exist. Point any of
    // these at its own file; a file shared by several keys is only downloaded once.
    Strip_Bra: asset('animations/dance3.json'),
    Strip_Panties: asset('animations/dance3.json'),
    Strip_Belt: asset('animations/dance3.json'),
    Strip_Stockings: asset('animations/dance3.json'),
  },
};

// =====================================================
// SHOW ORDER
// =====================================================
// Dance loops she cycles through: the "Change Dance" button and each finished
// strip both move on to the next one. Keys come from ASSETS.animations.
export const DANCE_SEQUENCE = ['Dance_1', 'Dance_2', 'Dance_4', 'Dance_5'];

// When the age gate lifts she walks on from the back of the stage to the middle, then
// starts dancing. The walk clip goes forward by itself; its travel is taken out and
// replaced by moving her across the stage in step with the clip, so her feet never slide.
export const ENTRANCE = {
  enabled: true,
  animation: 'Walk',      // key from ASSETS.animations
  endZ: 0,                // where she stops and starts to dance (metres; 0 = centre of the stage, positive = towards the camera)
};

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
  scale: 1,               // models/girl.glb already has its own 0.01 armature scale
  castShadow: true,
  rootBone: 'mixamorigHips',   // bone whose parent frame the clips are corrected for
  logMeshNames: false,    // print mesh names to the browser console (handy when adding garments)
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
// MUSIC
// Background music (music.js). It starts when the age gate lifts and the dancer
// walks on, then plays these songs in order, over and over, for as long as the page is
// open. The first song opens slow, muffled and quiet and builds to the song as recorded.
//
// The songs are the .mp3 files in source-assets/songs, shrunk for the web into
// public/music by `npm run convert:audio`. They are streamed while playing, so a visitor
// only downloads the ones they actually hear.
// =====================================================
export const MUSIC = {
  enabled: true,
  volume: 0.8,            // 0–1: overall loudness once the opening build is over

  // gain evens out the songs (measured with ffmpeg's loudness meter: they were recorded
  // up to 7 dB apart); 1 = as recorded. Add a song: put its file in source-assets/songs,
  // run the converter, add a line here.
  tracks: [
    { name: 'Song 1', url: asset('music/song1.mp3'), gain: 0.50 },
    { name: 'Song 2', url: asset('music/song2.mp3'), gain: 0.90 },
    { name: 'Song 3', url: asset('music/song3.mp3'), gain: 0.63 },
    { name: 'Song 4', url: asset('music/song4.mp3'), gain: 0.42 },
    { name: 'Song 5', url: asset('music/song5.mp3'), gain: 0.98 },
    { name: 'Song 6', url: asset('music/song6.mp3'), gain: 0.50 },
  ],

  // The opening build of the first song. Set startTempo and startVolume to 1 and
  // startCutoff to 20000 for no build at all.
  intro: {
    seconds: 40,          // how long it takes to reach the song as recorded
    startTempo: 0.6,      // opening speed (1 = as recorded; keeps its pitch)
    startCutoff: 400,     // Hz: the opening is dull, as if heard through a wall, then opens up
    startVolume: 0.3,     // opening loudness as a fraction of full
    fadeSeconds: 5,       // fade in from silence
  },
};

// =====================================================
// SOUND EFFECTS
// Played when test results come back (sounds.js). They are the .mp3 files in
// source-assets/sounds, brought to one loudness by `npm run convert:audio` into
// public/sounds. They use the music's audio, so the speaker button mutes them too,
// and turning MUSIC.enabled off silences them as well.
// =====================================================
export const SOUNDS = {
  volume: 1,              // 0–1 (the files are already loudness-matched to the music)
  files: {
    testsPassed: asset('sounds/success2.mp3'), // "Run visible tests": the sample tests all passed
    solved: asset('sounds/success1.mp3'),      // "Submit": every test passed, the problem is solved
    error: asset('sounds/error.mp3'),          // anything else: wrong answer, error in the code, time limit
  },
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
  musicButtonId: 'musicBtn',   // mute / unmute the music
};

// =====================================================
// PYTHON (Pyodide)
// Loaded from the CDN the first time the page opens, then cached by the browser.
// =====================================================
export const PYTHON = {
  pyodideUrl: 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/',
  testTimeoutMs: 5000,         // a test running longer than this is "Time limit exceeded"
};