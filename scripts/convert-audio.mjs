// Prepares the audio for the web.
//
//   npm run convert:audio        (needs ffmpeg and ffprobe installed)
//
//   source-assets/songs/*.mp3   ->  public/music/*.mp3     the background songs
//   source-assets/sounds/*.mp3  ->  public/sounds/*.mp3    the sound effects (test results)
//
// The originals are kept in git but never deployed.
//
// Songs are streamed while they play, so smaller files start sooner and cost less to
// host. Anything above SONG_MAX_KBPS is re-encoded down to it (plenty for music playing
// behind a dancer); a song already at or below it is copied untouched, since re-encoding
// a low-bitrate file only makes it worse. Their loudness is evened out when they play
// (the `gain` of each song in MUSIC.tracks in src/config.js).
//
// Sound effects are tiny, but they were recorded at very different volumes (one of them
// 20 dB quieter than another), so each is brought to the same loudness here. Tags and
// cover art are dropped from everything.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SONG_MAX_KBPS = 96;
const SOUND_KBPS = 160;
const SOUND_TARGET_LUFS = -16;    // loudness every effect is brought to
const SOUND_PEAK_LIMIT_DB = -1.5; // ...unless that would push its peak past this

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function missingTool(command) {
  console.error(`${command} is not installed. Install ffmpeg (e.g. "brew install ffmpeg") and try again.`);
  process.exit(1);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT') missingTool(command);
    throw error;
  }
}

const probe = (file) =>
  JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', file])).format;

// Integrated loudness (LUFS) and true peak (dBFS) of a file. ffmpeg prints its
// measurements on stderr.
function measure(file) {
  const result = spawnSync('ffmpeg', ['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') missingTool('ffmpeg');
  const summary = result.stderr.slice(result.stderr.lastIndexOf('Summary:'));
  const loudness = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]);
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]);
  if (!Number.isFinite(loudness) || !Number.isFinite(peak)) throw new Error(`Could not measure ${file}`);
  return { loudness, peak };
}

function mp3s(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort();
}

function convertAll({ label, from, to, convert }) {
  const source = path.join(root, from);
  const target = path.join(root, to);
  if (!fs.existsSync(source)) return;
  const files = mp3s(source);
  if (!files.length) return;

  fs.mkdirSync(target, { recursive: true });
  console.log(`${label} (${from} -> ${to})`);
  let totalIn = 0;
  let totalOut = 0;
  for (const file of files) {
    const input = path.join(source, file);
    const output = path.join(target, file);
    const note = convert(input, output);
    const inBytes = fs.statSync(input).size;
    const outBytes = fs.statSync(output).size;
    totalIn += inBytes;
    totalOut += outBytes;
    console.log(
      `  ${file.padEnd(13)} ${(inBytes / 1e6).toFixed(2)} MB -> ${(outBytes / 1e6).toFixed(2)} MB  ` +
        `${Number(probe(output).duration).toFixed(1)} s  ${note}`
    );
  }
  console.log(`  total ${(totalIn / 1e6).toFixed(1)} MB -> ${(totalOut / 1e6).toFixed(1)} MB`);
}

const BASE = ['-y', '-v', 'error'];
const STRIP = ['-vn', '-map_metadata', '-1'];

convertAll({
  label: 'Songs',
  from: 'source-assets/songs',
  to: 'public/music',
  convert(input, output) {
    const kbps = Math.round(Number(probe(input).bit_rate) / 1000);
    const reencode = kbps > SONG_MAX_KBPS * 1.1;
    const codec = reencode ? ['-c:a', 'libmp3lame', '-b:a', `${SONG_MAX_KBPS}k`] : ['-c:a', 'copy'];
    run('ffmpeg', [...BASE, '-i', input, ...STRIP, ...codec, output]);
    return reencode ? `${kbps} -> ${SONG_MAX_KBPS} kbps` : `${kbps} kbps, copied`;
  },
});

convertAll({
  label: 'Sound effects',
  from: 'source-assets/sounds',
  to: 'public/sounds',
  convert(input, output) {
    const { loudness, peak } = measure(input);
    const gain = Math.min(SOUND_TARGET_LUFS - loudness, SOUND_PEAK_LIMIT_DB - peak);
    run('ffmpeg', [
      ...BASE, '-i', input, ...STRIP,
      '-af', `volume=${gain.toFixed(2)}dB`,
      '-c:a', 'libmp3lame', '-b:a', `${SOUND_KBPS}k`,
      output,
    ]);
    return `${loudness.toFixed(1)} LUFS, ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`;
  },
});
