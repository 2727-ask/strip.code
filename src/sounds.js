// Short sound effects, played when test results come back (see SOUNDS in config.js).
//
// They share the music's audio context, so they are unlocked by the same click on the
// age gate, and they obey the same mute button. They are tiny, so they are fetched and
// decoded up front and play instantly.

import { SOUNDS } from './config.js';
import { music } from './music.js';

const buffers = new Map(); // name -> decoded audio
let loading = null;

function load() {
  const out = music.audio();
  if (!out) return null;

  loading ??= Promise.all(
    Object.entries(SOUNDS.files).map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${response.status}`);
        buffers.set(name, await out.ctx.decodeAudioData(await response.arrayBuffer()));
      } catch (error) {
        console.warn(`Sound missing: ${name} (${url})`, error); // one missing effect is not fatal
      }
    })
  );
  return loading;
}

/** Fetch and decode the effects in the background. Safe to call more than once. */
export function preloadSounds() {
  load();
}

/** Play an effect by its name in SOUNDS.files. Silent when muted or in a background tab. */
export function playSound(name) {
  const out = music.audio();
  if (!out || music.muted || document.hidden) return;

  const buffer = buffers.get(name);
  if (!buffer) {
    load(); // still loading: skip it rather than play it late
    return;
  }

  const source = out.ctx.createBufferSource();
  source.buffer = buffer;
  const volume = out.ctx.createGain();
  volume.gain.value = SOUNDS.volume;
  source.connect(volume);
  volume.connect(out.bus);
  source.start();
}
