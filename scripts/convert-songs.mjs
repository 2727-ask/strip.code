// Prepares the songs for the web.
//
//   npm run convert:songs        (needs ffmpeg and ffprobe installed)
//
// Reads  source-assets/songs/*.mp3   (kept in git, not deployed)
// Writes public/music/*.mp3          (what the site streams)
//
// Visitors stream the songs while they listen, so smaller files start sooner and cost
// less to host. Anything above MAX_KBPS is re-encoded down to it (plenty for music
// playing behind a dancer); a song already at or below it is copied untouched, since
// re-encoding a low-bitrate file only makes it worse. Tags and cover art are dropped.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_KBPS = 96;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'source-assets/songs');
const OUTPUT = path.join(root, 'public/music');

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`${command} is not installed. Install ffmpeg (e.g. "brew install ffmpeg") and try again.`);
      process.exit(1);
    }
    throw error;
  }
}

const probe = (file) =>
  JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', file])).format;

fs.mkdirSync(OUTPUT, { recursive: true });

const songs = fs.readdirSync(SOURCE).filter((f) => f.endsWith('.mp3')).sort();
if (!songs.length) {
  console.error(`No .mp3 files in ${path.relative(root, SOURCE)}`);
  process.exit(1);
}

let totalIn = 0;
let totalOut = 0;
for (const file of songs) {
  const source = path.join(SOURCE, file);
  const target = path.join(OUTPUT, file);
  const kbps = Math.round(Number(probe(source).bit_rate) / 1000);
  const reencode = kbps > MAX_KBPS * 1.1;

  const args = ['-y', '-v', 'error', '-i', source, '-vn', '-map_metadata', '-1'];
  args.push(...(reencode ? ['-c:a', 'libmp3lame', '-b:a', `${MAX_KBPS}k`] : ['-c:a', 'copy']));
  args.push(target);
  run('ffmpeg', args);

  const after = probe(target);
  const inBytes = fs.statSync(source).size;
  const outBytes = fs.statSync(target).size;
  totalIn += inBytes;
  totalOut += outBytes;
  console.log(
    `${file.padEnd(10)} ${(inBytes / 1e6).toFixed(2)} MB @ ${String(kbps).padStart(3)} kbps -> ` +
      `${(outBytes / 1e6).toFixed(2)} MB @ ${Math.round(Number(after.bit_rate) / 1000)} kbps ` +
      `(${reencode ? 're-encoded' : 'copied'}, ${Number(after.duration).toFixed(0)} s)`
  );
}
console.log(`total ${(totalIn / 1e6).toFixed(1)} MB -> ${(totalOut / 1e6).toFixed(1)} MB`);
