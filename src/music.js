// Background music: the songs from public/music (see MUSIC.tracks in config.js) play
// one after another behind the show, and start over from the first when the last one
// ends, for as long as the page is open.
//
// The very first song opens with a build: slow, muffled and quiet, then it speeds up,
// brightens and swells to the song as it was recorded (MUSIC.intro). Every later song
// fades in at full strength.
//
// Songs are streamed through one <audio> element, so only what is being played gets
// downloaded. Browsers allow sound only after a click: the age gate's "Yes" calls
// unlock(), and start() (when the gate lifts) begins the show.

import { MUSIC } from './config.js';

const STORAGE_KEY = 'stripcode.music'; // holds 'off' once the visitor has muted it
const OPEN_CUTOFF = 20000;             // Hz: the low-pass when fully open
const TICK_MS = 100;                   // how often the opening build is updated
const SONG_FADE = 1.2;                 // seconds each song after the first fades in

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const quiet = () => {};

let ctx = null;
let audio = null;
let trackGain = null;   // evens out the songs' loudness, and fades each one in
let lowpass = null;     // closed at first during the opening build
let level = null;       // overall volume, and the swell of the opening build
let fader = null;       // the mute switch

let index = 0;          // song being played
let failures = 0;       // songs in a row that could not be played
let wantStart = false;  // start() has been called
let began = false;      // the opening build has begun (the music is audible)
let buildTime = 0;      // seconds of the opening build played so far
let buildTimer = 0;
let sleepTimer = 0;
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

// =====================================================
// THE PLAYLIST
// =====================================================
function loadSong(position, { fadeIn }) {
  const track = MUSIC.tracks[position];
  index = position;
  currentTrack = track.name;

  const now = ctx.currentTime;
  trackGain.gain.cancelScheduledValues(now);
  if (fadeIn) {
    trackGain.gain.setValueAtTime(0, now);
    trackGain.gain.linearRampToValueAtTime(track.gain ?? 1, now + SONG_FADE);
  } else {
    trackGain.gain.setValueAtTime(track.gain ?? 1, now);
  }

  audio.src = track.url;
  emit();
}

// The song ended (or could not be played): on to the next, and round again after the last
function nextSong() {
  loadSong((index + 1) % MUSIC.tracks.length, { fadeIn: true });
  if (!muted && !document.hidden) audio.play().catch(quiet);
}

function onSongError() {
  console.warn(`Could not play ${MUSIC.tracks[index]?.url}`);
  if (++failures >= MUSIC.tracks.length) return; // none of them work: stay quiet rather than spin
  nextSong();
}

// =====================================================
// THE OPENING BUILD
// Speed, brightness and loudness climb together over MUSIC.intro.seconds.
// =====================================================
function applyBuild() {
  const { seconds, startTempo, startCutoff, startVolume, fadeSeconds } = MUSIC.intro;
  const progress = seconds > 0 ? clamp01(buildTime / seconds) : 1;
  const eased = smooth(progress);
  const fadeIn = fadeSeconds > 0 ? smooth(clamp01(buildTime / fadeSeconds)) : 1;
  const now = ctx.currentTime;

  audio.playbackRate = lerp(startTempo, 1, eased);
  lowpass.frequency.setTargetAtTime(startCutoff * (OPEN_CUTOFF / startCutoff) ** eased, now, 0.1);
  level.gain.setTargetAtTime(MUSIC.volume * lerp(startVolume, 1, eased) * fadeIn, now, 0.1);
  return progress >= 1 && fadeIn >= 1;
}

function tickBuild() {
  if (audio.paused) return; // asleep, or between songs: the build waits
  buildTime += TICK_MS / 1000;
  if (applyBuild()) clearInterval(buildTimer);
}

function begin() {
  began = true;
  buildTime = 0;
  try {
    audio.currentTime = 0; // it has been playing silently since the click
  } catch {
    /* not ready to seek yet: it is still at the start */
  }
  applyBuild();
  clearInterval(buildTimer);
  buildTimer = setInterval(tickBuild, TICK_MS);
  if (audio.paused) audio.play().catch(quiet);
}

// =====================================================
// SOUND ON, OFF AND ASLEEP
// Faded out and asleep when muted or when the tab is in the background (no point
// spending battery and bandwidth on music nobody can hear), awake otherwise.
// =====================================================
function apply() {
  if (!ctx) return;
  fader.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.1);
  clearTimeout(sleepTimer);

  if (!muted && !document.hidden) {
    Promise.resolve(ctx.resume()).catch(quiet);
    if (audio.paused && failures < MUSIC.tracks.length) audio.play().catch(quiet);
    return;
  }
  const delayMs = document.hidden ? 0 : 500; // let a mute fade out first
  sleepTimer = setTimeout(() => {
    if (!muted && !document.hidden) return;
    audio.pause();
    Promise.resolve(ctx.suspend()).catch(quiet);
  }, delayMs);
}

export const music = {
  get muted() {
    return muted;
  },
  get track() {
    return currentTrack;
  },

  // Browsers only allow sound after a click or key press. Call this from the handler
  // of one (the age gate's "Yes"), so the music can start later on its own. The first
  // song starts downloading and playing now, silently, so it is ready when the show begins.
  unlock() {
    if (ctx || !MUSIC.enabled || !MUSIC.tracks.length) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      ctx = new AudioContextClass({ latencyHint: 'playback' });
    } catch {
      ctx = null;
      return;
    }

    audio = new Audio();
    audio.preload = 'auto';
    audio.preservesPitch = true; // the slow opening keeps the song in tune
    audio.addEventListener('ended', nextSong);
    audio.addEventListener('error', onSongError);
    audio.addEventListener('playing', () => (failures = 0));

    // audio -> loudness -> low-pass -> volume -> mute switch -> speakers
    trackGain = ctx.createGain();
    lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = 0.7;
    lowpass.frequency.value = MUSIC.intro.startCutoff;
    level = ctx.createGain();
    level.gain.value = 0; // silent until the show begins
    fader = ctx.createGain();
    fader.gain.value = muted ? 0 : 1;
    ctx.createMediaElementSource(audio).connect(trackGain);
    trackGain.connect(lowpass);
    lowpass.connect(level);
    level.connect(fader);
    fader.connect(ctx.destination);

    loadSong(0, { fadeIn: false });

    document.addEventListener('visibilitychange', apply);
    // if the browser still refused to start the audio, the next click or key press will
    for (const type of ['pointerdown', 'keydown']) {
      window.addEventListener(type, apply, { once: true, capture: true });
    }
    apply();
  },

  // The show starts: the opening build begins (unless the visitor muted the music on an
  // earlier visit; it then starts the moment they turn it back on)
  start() {
    if (!ctx || wantStart) return;
    wantStart = true;
    if (!muted) begin();
  },

  setMuted(value) {
    muted = Boolean(value);
    savePreference();
    if (!muted && wantStart && !began && ctx) begin();
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
