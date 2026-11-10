// Turns the Mixamo .fbx animation files into small .json clips the site can load.
//
// The .fbx files are 3-4 MB each because they also carry a full textured
// character; the site only needs the keyframes. This keeps just those, as JSON
// (which GitHub Pages gzips), cutting ~17 MB of downloads to about 1 MB.
//
//   npm run convert:animations
//
// Reads  source-assets/animations/*.fbx   (kept in git, not deployed)
// Writes public/animations/*.json         (what the site loads)
//
// Format (see src/animations.js, which reads it):
//   { version, name, duration,
//     times:  [ [t, t, ...], ... ]                 pool of distinct keyframe-time lists
//     tracks: [ [trackName, "q" | "v", timesIndex, [flat values]], ... ] }
//   "q" = quaternion track (4 values per key), "v" = vector track (3 per key)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// The files embed textures we do not need: give the loader a do-nothing <img>,
// and a window size (it reads one when a file contains a camera).
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_) {}, style: {} }) };
globalThis.window = { innerWidth: 1, innerHeight: 1 };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'source-assets/animations');
const OUTPUT = path.join(root, 'public/animations');

const TIME_DECIMALS = 4;  // 0.1 ms
const ROT_DECIMALS = 4;   // ~0.01 degrees
const POS_DECIMALS = 3;   // 0.001 cm (Mixamo positions are in centimetres)

const round = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const quiet = (fn) => {
  const warn = console.warn;
  console.warn = () => {}; // "Vertex has more than 4 skinning weights": about the mesh we throw away
  try { return fn(); } finally { console.warn = warn; }
};

function convert(file) {
  const buffer = fs.readFileSync(path.join(SOURCE, file));
  const group = quiet(() => new FBXLoader().parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), ''));
  const clip = group.animations[0];

  const timePool = [];
  const poolIndex = new Map();
  const tracks = clip.tracks.map((track) => {
    const isRotation = track instanceof THREE.QuaternionKeyframeTrack;
    const stride = isRotation ? 4 : 3;

    const times = Array.from(track.times, (t) => round(t, TIME_DECIMALS));
    const key = times.join(',');
    if (!poolIndex.has(key)) {
      poolIndex.set(key, timePool.length);
      timePool.push(times);
    }

    const values = [];
    for (let i = 0; i < track.values.length; i += stride) {
      if (isRotation) {
        // keep each rotation exactly unit length before rounding it
        const q = new THREE.Quaternion().fromArray(track.values, i).normalize();
        values.push(round(q.x, ROT_DECIMALS), round(q.y, ROT_DECIMALS), round(q.z, ROT_DECIMALS), round(q.w, ROT_DECIMALS));
      } else {
        for (let k = 0; k < 3; k++) values.push(round(track.values[i + k], POS_DECIMALS));
      }
    }
    return [track.name, isRotation ? 'q' : 'v', poolIndex.get(key), values];
  });

  return { version: 1, name: path.basename(file, '.fbx'), duration: round(clip.duration, TIME_DECIMALS), times: timePool, tracks, original: clip };
}

fs.mkdirSync(OUTPUT, { recursive: true });
let totalIn = 0;
let totalOut = 0;
for (const file of fs.readdirSync(SOURCE).filter((f) => f.endsWith('.fbx')).sort()) {
  const { original, ...data } = convert(file);
  const json = JSON.stringify(data);
  const target = path.join(OUTPUT, `${data.name}.json`);
  fs.writeFileSync(target, json);

  // check the result against the original clip
  let worstRotation = 0;
  let worstPosition = 0;
  let worstTime = 0;
  data.tracks.forEach(([name, kind, timesIndex, values], index) => {
    const source = original.tracks[index];
    if (source.name !== name) throw new Error(`track ${index} name mismatch: ${source.name} vs ${name}`);
    const times = data.times[timesIndex];
    if (times.length !== source.times.length) throw new Error(`${name}: keyframe count changed`);
    times.forEach((t, i) => (worstTime = Math.max(worstTime, Math.abs(t - source.times[i]))));
    const stride = kind === 'q' ? 4 : 3;
    for (let i = 0, k = 0; i < values.length; i += stride, k++) {
      if (kind === 'q') {
        // compare directions: normalise both (the source quaternions are not exactly unit length)
        const a = new THREE.Quaternion().fromArray(values, i).normalize();
        const b = new THREE.Quaternion().fromArray(source.values, i).normalize();
        worstRotation = Math.max(worstRotation, THREE.MathUtils.radToDeg(a.angleTo(b)));
      } else {
        for (let c = 0; c < 3; c++) worstPosition = Math.max(worstPosition, Math.abs(values[i + c] - source.values[i + c]));
      }
    }
  });

  const inBytes = fs.statSync(path.join(SOURCE, file)).size;
  totalIn += inBytes;
  totalOut += json.length;
  console.log(
    `${file.padEnd(12)} ${(inBytes / 1e6).toFixed(2)} MB -> ${(json.length / 1e6).toFixed(2)} MB json | ` +
      `${data.tracks.length} tracks, ${data.times.length} time lists | worst error: rotation ${worstRotation.toFixed(4)} deg, ` +
      `position ${worstPosition.toFixed(4)} cm, time ${worstTime.toExponential(1)} s`
  );
}
console.log(`total ${(totalIn / 1e6).toFixed(1)} MB -> ${(totalOut / 1e6).toFixed(2)} MB (before gzip)`);
