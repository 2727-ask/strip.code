// Loads the dance clips. They are small .json files made from the Mixamo .fbx
// originals by `npm run convert:animations` (see scripts/convert-animations.mjs
// for the format): the keyframes only, instead of a full textured character.

import * as THREE from 'three';

/** Fetch and parse one clip. `onProgress(fraction)` reports the download. */
export async function loadClip(url, onProgress = () => {}) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);

  // read the body ourselves so the download can be reported
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body?.getReader();
  if (!reader) return parseClip(await response.json());

  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress(Math.min(received / total, 1));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  onProgress(1);
  return parseClip(JSON.parse(new TextDecoder().decode(bytes)));
}

/** Turn the compact json (see the converter script) into a THREE.AnimationClip. */
export function parseClip(data) {
  const tracks = data.tracks.map(([name, kind, timesIndex, values]) => {
    const times = new Float32Array(data.times[timesIndex]);
    const array = new Float32Array(values);
    return kind === 'q'
      ? new THREE.QuaternionKeyframeTrack(name, times, array)
      : new THREE.VectorKeyframeTrack(name, times, array);
  });
  return new THREE.AnimationClip(data.name, data.duration, tracks);
}
