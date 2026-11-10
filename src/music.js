// Background music for the club, played by the browser itself: a small synthesiser and
// step sequencer on the Web Audio API. There are no audio files, so nothing extra to
// download, host or license.
//
// A playlist of tracks plays one after another, forever. The first thing a visitor
// hears is an intro build: the first track opens muffled, slow and quiet with only the
// pad, then the bass, hats, kick, clap and melody come in one by one while the tempo
// and the brightness climb until the track sounds the way it was written. Later tracks
// start at full strength.
//
// Settings (volume, length of the build, ...) are in config.js, under MUSIC.

import { MUSIC } from './config.js';

const STEPS_PER_BAR = 16;       // the sequencer counts in sixteenth notes
const TRACK_BARS = 40;          // bars 0-23 groove, 24-27 breakdown, 28-39 groove again
const BREAK_FROM = 24;
const BREAK_TO = 28;
const SECOND_HALF = 12;         // from this bar the melody switches to its busier second pattern
const FILL_BARS = [11, 23, 27, 39]; // bars that end with a clap roll leading into what comes next
const CRASH_BARS = [0, SECOND_HALF, BREAK_TO]; // bars that open with a cymbal
const LOOKAHEAD = 0.4;          // seconds of music scheduled ahead of the audio clock
const TICK_MS = 60;             // how often the scheduler wakes up
const OPEN_CUTOFF = 16000;      // Hz: the master low-pass when fully open
const STORAGE_KEY = 'stripcode.music'; // holds 'off' once the visitor has muted it

// =====================================================
// THE PLAYLIST
// A track is a chord loop (one chord per bar, four bars, repeated) plus a drum pattern,
// a bass line and a melody. Patterns are 16 characters, one per sixteenth note:
//   drums   X loud, x soft, o open hat, . rest
//   melody  a digit picks that chord tone (0-3, 4-7 an octave higher); c plays the
//           whole chord; . is a rest
//   bass    [step, semitones above the chord root, length in steps]
// Chords are [bass root as a MIDI note, type]; the pad and the melody are voiced
// from the same chord.
// =====================================================
const CHORD = {
  m9:   [3, 7, 10, 14],
  m7:   [3, 7, 10, 12],
  maj9: [4, 7, 11, 14],
  maj7: [4, 7, 11, 12],
  dom9: [4, 7, 10, 14],
};

export const TRACKS = [
  {
    name: 'Velvet Room',          // slow, sultry, trip-hop
    bpm: 92,
    swing: 0.2,
    chords: [[33, 'm9'], [29, 'maj9'], [38, 'm9'], [40, 'dom9']],  // Am9 Fmaj9 Dm9 E9
    kick: 'X.....x...x.....',
    kickSound: { from: 120, to: 44, decay: 0.5 },
    clap: '....X.......X...',
    hat: 'x.x.x.x.x.x.x.xo',
    bass: { cutoff: 700, level: 0.5, notes: [[0, 0, 5], [6, 12, 2], [10, 7, 3], [14, 0, 2]] },
    pad: { cutoff: 1500, level: 0.2 },
    lead: {
      a: '0...2...3.....1.',
      b: '0..2..4...3...2.',
      base: 36, wave: 'triangle', detune: 0, harm: 0.4, cutoff: 3200, decay: 0.9,
      level: 0.24, reverb: 0.6, delay: 0.5,
    },
  },
  {
    name: 'Neon After Dark',      // synthwave arpeggios
    bpm: 100,
    swing: 0,
    chords: [[36, 'm7'], [32, 'maj7'], [39, 'maj7'], [34, 'dom9']], // Cm7 Abmaj7 Ebmaj7 Bb9
    kick: 'X.......X.x.....',
    kickSound: { from: 140, to: 46, decay: 0.42 },
    clap: '....X.......X...',
    hat: 'X.x.X.x.X.x.X.xo',
    bass: {
      cutoff: 900, level: 0.45,
      notes: [[0, 0, 1.5], [2, 0, 1.5], [4, 12, 1.5], [6, 0, 1.5], [8, 0, 1.5], [10, 0, 1.5], [12, 12, 1.5], [14, 7, 1.5]],
    },
    pad: { cutoff: 1300, level: 0.18 },
    lead: {
      a: '0123210101232101',
      b: '0123432101234321',
      base: 36, wave: 'sawtooth', detune: 7, harm: 0, cutoff: 2600, decay: 0.28,
      level: 0.12, reverb: 0.35, delay: 0.55,
    },
  },
  {
    name: 'Midnight Shift',       // mid-tempo, bell-like keys
    bpm: 108,
    swing: 0.12,
    chords: [[40, 'm7'], [36, 'maj7'], [33, 'm7'], [35, 'dom9']],  // Em7 Cmaj7 Am7 B9
    kick: 'X..x..x.X.....x.',
    kickSound: { from: 130, to: 45, decay: 0.4 },
    clap: '....X.......X..x',
    hat: 'x.x.xxx.x.x.xxx.',
    bass: { cutoff: 800, level: 0.48, notes: [[0, 0, 3], [4, 0, 1.5], [7, 12, 1.5], [10, 7, 2], [12, 0, 3]] },
    pad: { cutoff: 1400, level: 0.18 },
    lead: {
      a: '0.1.2...3.2.1...',
      b: '0.2.4...5.4.2...',
      base: 48, wave: 'sine', detune: 0, harm: 0.6, cutoff: 5000, decay: 1.1,
      level: 0.2, reverb: 0.55, delay: 0.5,
    },
  },
  {
    name: 'Last Call',            // four-on-the-floor house to close the night
    bpm: 118,
    swing: 0.08,
    chords: [[29, 'm9'], [37, 'maj9'], [34, 'm9'], [36, 'dom9']],  // Fm9 Dbmaj9 Bbm9 C9
    kick: 'X...X...X...X...',
    kickSound: { from: 150, to: 48, decay: 0.38 },
    clap: '....x.......x...',
    hat: 'x.o.x.o.x.o.x.o.',
    bass: { cutoff: 750, level: 0.5, notes: [[2, 0, 2], [6, 0, 2], [10, 7, 2], [14, 0, 2]] },
    pad: { cutoff: 1200, level: 0.14 },
    lead: {
      a: '..c...c...c..c..',
      b: '..c..c..c..c..c.',
      base: 24, wave: 'sawtooth', detune: 6, harm: 0, cutoff: 1800, decay: 0.16,
      level: 0.07, reverb: 0.3, delay: 0.4,
    },
  },
];

// =====================================================
// SMALL HELPERS
// =====================================================
const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;

// Repeatable "randomness": the same track always plays the same, but notes still vary
function jitter(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const HIT = { X: 1, x: 0.55, o: 0.75 };

// White noise, for hats and claps
function makeNoise(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = seed / 1073741823.5 - 1;
  }
  return buffer;
}

// A made-up room: decaying noise, used by the reverb
function makeRoom(ctx, seconds = 2.2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  let seed = 7;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 1073741823.5 - 1) * (1 - i / length) ** 3;
    }
  }
  return buffer;
}

// =====================================================
// THE ENGINE
// Plays into `destination`. Works on any audio context, so the same code is used live
// and (in tests) rendered offline. Call start(), then keep calling scheduleUntil() with
// a time a little ahead of the clock.
// =====================================================
export function createEngine(ctx, destination, options = {}) {
  const volume = options.volume ?? MUSIC.volume;
  const intro = { ...MUSIC.intro, ...options.intro };
  const onTrack = options.onTrack || (() => {});

  const noise = makeNoise(ctx);

  // ---- the mixing desk: everything -> low-pass -> compressor -> volume -> out ----
  const input = ctx.createGain();
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.Q.value = 0.7;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 24;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;
  const master = ctx.createGain();
  input.connect(lowpass);
  lowpass.connect(compressor);
  const swell = ctx.createGain();       // rises during the intro build (after the compressor, which would flatten it)
  compressor.connect(swell);
  swell.connect(master);
  master.connect(destination);

  // reverb
  const reverbIn = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = makeRoom(ctx);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.35;
  reverbIn.connect(reverb);
  reverb.connect(reverbOut);
  reverbOut.connect(lowpass);

  // echo: dark repeats that fade away
  const delayIn = ctx.createGain();
  const delay = ctx.createDelay(2);
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 2200;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.38;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.5;
  delayIn.connect(delay);
  delay.connect(delayTone);
  delayTone.connect(delayFeedback);
  delayFeedback.connect(delay);
  delayTone.connect(delayOut);
  delayOut.connect(lowpass);

  // Sends a voice to the mix: straight, and optionally into the reverb and the echo
  function route(node, { dry = 1, reverb: toReverb = 0, delay: toDelay = 0 } = {}) {
    const tap = (target, level) => {
      if (level <= 0) return;
      if (level === 1) {
        node.connect(target);
        return;
      }
      const send = ctx.createGain();
      send.gain.value = level;
      node.connect(send);
      send.connect(target);
    };
    tap(input, dry);
    tap(reverbIn, toReverb);
    tap(delayIn, toDelay);
  }

  function osc(type, hz, detune = 0) {
    const node = ctx.createOscillator();
    node.type = type;
    node.frequency.value = hz;
    node.detune.value = detune;
    return node;
  }

  function filter(type, frequency, q = 0.7) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  }

  // ---- the instruments ----
  function kick(t, vel, sound) {
    const body = osc('sine', sound.from);
    body.frequency.setValueAtTime(sound.from, t);
    body.frequency.exponentialRampToValueAtTime(sound.to, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + sound.decay);
    body.connect(g);
    route(g);
    body.start(t);
    body.stop(t + sound.decay + 0.05);
  }

  function noiseSource(t, length) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.start(t, jitter(t * 31) * 0.5);
    src.stop(t + length);
    return src;
  }

  function clap(t, vel) {
    const src = noiseSource(t, 0.3);
    const band = filter('bandpass', 1800, 0.9);
    const g = ctx.createGain();
    // a few quick slaps, then the tail
    g.gain.setValueAtTime(0.0001, t);
    for (const d of [0, 0.011, 0.022]) {
      g.gain.setValueAtTime(vel * 0.55, t + d);
      g.gain.exponentialRampToValueAtTime(vel * 0.15, t + d + 0.01);
    }
    g.gain.setValueAtTime(vel * 0.55, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.connect(band);
    band.connect(g);
    route(g, { reverb: 0.35 });
  }

  function hat(t, vel, decay) {
    const src = noiseSource(t, decay + 0.05);
    const high = filter('highpass', 7200);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(high);
    high.connect(g);
    route(g, { reverb: decay > 0.1 ? 0.2 : 0 });
  }

  function bass(t, midi, length, vel, sound) {
    const hz = midiToHz(midi);
    const saw = osc('sawtooth', hz);
    const sub = osc('sine', hz);
    const sawLevel = ctx.createGain();
    sawLevel.gain.value = 0.55;
    const low = filter('lowpass', sound.cutoff * 1.3, 2);
    low.frequency.setValueAtTime(sound.cutoff * 1.3, t);
    low.frequency.exponentialRampToValueAtTime(sound.cutoff * 0.35, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * sound.level, t + 0.012);
    g.gain.setValueAtTime(vel * sound.level, t + length);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.1);
    saw.connect(sawLevel);
    sawLevel.connect(low);
    sub.connect(g);
    low.connect(g);
    route(g);
    for (const o of [saw, sub]) {
      o.start(t);
      o.stop(t + length + 0.15);
    }
  }

  // Soft held chord, brightening slowly across the bar
  function pad(t, notes, length, sound) {
    const low = filter('lowpass', sound.cutoff, 0.5);
    low.frequency.setValueAtTime(sound.cutoff * 0.45, t);
    low.frequency.linearRampToValueAtTime(sound.cutoff, t + length * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(sound.level, t + 0.7);
    g.gain.setValueAtTime(sound.level, t + length);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length + 1);
    const each = 1 / (notes.length * 2);
    for (const midi of notes) {
      for (const detune of [-8, 8]) {
        const voice = osc('sawtooth', midiToHz(midi), detune);
        const level = ctx.createGain();
        level.gain.value = each;
        voice.connect(level);
        level.connect(low);
        voice.start(t);
        voice.stop(t + length + 1.05);
      }
    }
    low.connect(g);
    route(g, { reverb: 0.5 });
  }

  // The melody voice: a short plucked note
  function pluck(t, midi, vel, sound) {
    const hz = midiToHz(midi);
    const spread = sound.detune || 0;
    // [oscillator, level]: one clean voice, or two slightly detuned for width,
    // plus an optional octave-up sine for a bell-like shimmer
    const layers = spread
      ? [[osc(sound.wave, hz, -spread), 1], [osc(sound.wave, hz, spread), 1]]
      : [[osc(sound.wave, hz), 1]];
    if (sound.harm) layers.push([osc('sine', hz * 2), sound.harm]);

    const low = filter('lowpass', sound.cutoff, 0.8);
    low.frequency.setValueAtTime(sound.cutoff * 1.6, t);
    low.frequency.exponentialRampToValueAtTime(sound.cutoff * 0.5, t + sound.decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * sound.level, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.006 + sound.decay);

    for (const [node, level] of layers) {
      if (level === 1) {
        node.connect(low);
      } else {
        const fader = ctx.createGain();
        fader.gain.value = level;
        node.connect(fader);
        fader.connect(low);
      }
      node.start(t);
      node.stop(t + sound.decay + 0.1);
    }
    low.connect(g);
    route(g, { reverb: sound.reverb, delay: sound.delay });
  }

  // ---- the sequencer ----
  const introSteps = Math.max(0, intro.bars) * STEPS_PER_BAR;
  let nextTime = 0;     // when the next sixteenth note falls
  let totalSteps = 0;   // sixteenths played since the music started
  let stepInTrack = 0;
  let trackIndex = 0;
  let loops = 0;        // times through the whole playlist
  let filterOpen = false;

  // How closed the master low-pass is: a dull rumble first, wide open at the end
  const cutoffAt = (progress) =>
    intro.startCutoff * (OPEN_CUTOFF / intro.startCutoff) ** smooth(clamp01(progress));
  // ...and how loud: quiet first, full at the end
  const levelAt = (progress) => lerp(intro.startVolume, 1, smooth(clamp01(progress)));

  function trackStarts(t) {
    const track = TRACKS[trackIndex];
    delay.delayTime.setTargetAtTime((60 / track.bpm) * 0.75, t, 0.2); // dotted eighth
    onTrack(track, { index: trackIndex, loops });
  }

  function start(t0) {
    nextTime = t0;
    totalSteps = 0;
    stepInTrack = 0;
    trackIndex = 0;
    loops = 0;

    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(volume, t0 + intro.fadeSeconds);

    const opening = introSteps > 0 ? 0 : 1; // how far into the build we are: none, or already done
    lowpass.frequency.setValueAtTime(cutoffAt(opening), t0);
    swell.gain.setValueAtTime(levelAt(opening), t0);
    filterOpen = introSteps === 0;
    trackStarts(t0);
  }

  // Which parts of the band are playing in this bar
  function layersFor(bar, inIntro) {
    const entersAt = (share) => !inIntro || bar >= Math.floor(intro.bars * share);
    const inBreak = bar >= BREAK_FROM && bar < BREAK_TO;
    return {
      pad: entersAt(0),
      bass: entersAt(1 / 6) && !inBreak,
      hat: entersAt(1 / 3),
      kick: entersAt(1 / 2) && !inBreak,
      clap: entersAt(2 / 3) && !inBreak,
      lead: entersAt(5 / 6),
    };
  }

  function scheduleStep() {
    const track = TRACKS[trackIndex];
    const bar = Math.floor(stepInTrack / STEPS_PER_BAR);
    const s = stepInTrack % STEPS_PER_BAR;

    // The build: tempo and brightness rise together over the first bars
    const inIntro = totalSteps < introSteps;
    const progress = introSteps > 0 ? clamp01(totalSteps / introSteps) : 1;
    const tempo = lerp(intro.startTempo, 1, smooth(progress));
    const stepLength = 60 / (track.bpm * tempo) / 4;
    const t = nextTime + (s % 2 ? track.swing * stepLength : 0);

    if (!filterOpen) {
      const after = introSteps > 0 ? clamp01((totalSteps + 1) / introSteps) : 1;
      lowpass.frequency.exponentialRampToValueAtTime(cutoffAt(after), nextTime + stepLength);
      swell.gain.linearRampToValueAtTime(levelAt(after), nextTime + stepLength);
      if (after >= 1) filterOpen = true;
    }

    const on = layersFor(bar, inIntro);
    const [root, type] = track.chords[bar % 4];
    const tones = CHORD[type];
    const mood = 0.85 + 0.3 * jitter(totalSteps * 3 + trackIndex); // small velocity wobble

    // pad: one chord per bar
    if (s === 0 && on.pad) {
      // the pad carries the breakdown on its own, so it is louder there
      const sound = on.bass ? track.pad : { ...track.pad, level: track.pad.level * 2, cutoff: track.pad.cutoff * 1.4 };
      pad(t, tones.map((i) => root + 12 + i), STEPS_PER_BAR * stepLength, sound);
    }

    // bass
    if (on.bass) {
      for (const [step, interval, length] of track.bass.notes) {
        if (step === s) bass(t, root + interval, length * stepLength, mood, track.bass);
      }
    }

    // drums
    if (on.kick && HIT[track.kick[s]]) kick(t, HIT[track.kick[s]], track.kickSound);
    if (on.clap && HIT[track.clap[s]]) clap(t, HIT[track.clap[s]] * mood);
    if (on.hat && HIT[track.hat[s]]) {
      const hit = track.hat[s];
      hat(t, HIT[hit] * mood, hit === 'o' ? 0.25 : 0.045);
    }
    // a cymbal marks the start of a track and each new section
    if (s === 0 && !inIntro && CRASH_BARS.includes(bar)) hat(t, 1, 1.6);
    // clap roll at the end of a section
    if (!inIntro && s >= 12 && FILL_BARS.includes(bar)) clap(t, 0.5 + 0.2 * (s - 12));

    // melody
    if (on.lead) {
      const lead = track.lead;
      const inBreak = bar >= BREAK_FROM && bar < BREAK_TO;
      const pattern = bar >= SECOND_HALF && !inBreak ? lead.b : lead.a;
      const note = pattern[s];
      if (note === 'c') {
        for (const i of tones) pluck(t, root + lead.base + i, mood, lead);
      } else if (note !== '.') {
        const index = Number(note);
        const octave = Math.floor(index / tones.length) * 12;
        pluck(t, root + lead.base + tones[index % tones.length] + octave, mood, lead);
      }
    }

    nextTime += stepLength;
    totalSteps++;
    stepInTrack++;

    if (stepInTrack >= TRACK_BARS * STEPS_PER_BAR) {
      stepInTrack = 0;
      trackIndex = (trackIndex + 1) % TRACKS.length;
      if (trackIndex === 0) loops++;
      trackStarts(nextTime);
    }
  }

  return {
    start,
    scheduleUntil(time) {
      while (nextTime < time) scheduleStep();
    },
    // where the sequencer has got to, for tests and displays
    position: () => ({ time: nextTime, steps: totalSteps, track: TRACKS[trackIndex].name }),
  };
}

// =====================================================
// THE PLAYER
// Owns the audio context and the timer, and the visitor's mute choice.
// =====================================================
let ctx = null;
let engine = null;
let master = null;        // mute fader between the engine and the speakers
let timer = 0;
let sleepTimer = 0;
let wantStart = false;
let muted = readPreference();
let currentTrack = null;
const listeners = new Set();

function readPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

function savePreference() {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

function emit() {
  for (const listener of listeners) listener({ muted, track: currentTrack });
}

// Makes the speakers match the state: faded out and asleep when muted or when the tab is
// in the background (no point spending battery on music nobody can hear), awake otherwise
function apply() {
  if (!ctx) return;
  master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.1);
  clearTimeout(sleepTimer);
  if (!muted && !document.hidden) {
    Promise.resolve(ctx.resume()).catch(() => {});
    return;
  }
  const delayMs = document.hidden ? 0 : 500; // let a mute fade out first
  sleepTimer = setTimeout(() => {
    if (muted || document.hidden) Promise.resolve(ctx.suspend()).catch(() => {});
  }, delayMs);
}

function pump() {
  engine.scheduleUntil(ctx.currentTime + LOOKAHEAD);
}

function begin() {
  engine = createEngine(ctx, master, {
    onTrack: (track) => {
      currentTrack = track.name;
      emit();
    },
  });
  engine.start(ctx.currentTime + 0.2);
  timer = setInterval(pump, TICK_MS);
  pump();
}

export const music = {
  get muted() {
    return muted;
  },
  get track() {
    return currentTrack;
  },

  // Browsers only allow sound after a click or key press. Call this from the handler
  // of one (the age gate's "Yes"), so later calls to start() can play.
  unlock() {
    if (ctx || !MUSIC.enabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      ctx = new AudioContextClass({ latencyHint: 'playback' });
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);

    document.addEventListener('visibilitychange', apply);
    // if the browser still refused to start the audio, the next click or key press will
    for (const type of ['pointerdown', 'keydown']) {
      window.addEventListener(type, apply, { once: true, capture: true });
    }
    apply();
  },

  // The show starts: the intro build begins (unless the visitor muted the music earlier;
  // it then starts the moment they turn it back on)
  start() {
    if (!ctx || wantStart) return;
    wantStart = true;
    if (!muted) begin();
  },

  setMuted(value) {
    muted = Boolean(value);
    savePreference();
    if (!muted && wantStart && !engine && ctx) begin();
    apply();
    emit();
  },

  toggle() {
    music.setMuted(!muted);
  },

  // Calls back with { muted, track } now and whenever either changes
  onChange(listener) {
    listeners.add(listener);
    listener({ muted, track: currentTrack });
    return () => listeners.delete(listener);
  },
};
