# StripCode

Solve coding problems in the browser; each one you crack makes the dancer take something off.
Adults only (18+): the site opens on an age gate and only downloads the rest after a "Yes".

Three.js scene, a Python editor (Pyodide runs your code in a Web Worker), and a pink neon theme.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve dist/ locally
```

Needs Node 20.19+ (or 22.12+).

## Deploy (GitHub Pages)

Pushing to `main` builds and publishes the site through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Pull requests into `main` only build.

One-time setup in the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
After the first run the site is at `https://<user>.github.io/<repo>/`.

The build uses relative URLs (`base: './'` in `vite.config.js`), so it works from that sub-path, from a
custom domain, or from a local preview without any change. The workflow fails if the built site grows past
40 MB (it is about 23 MB), which would mean something large ended up in `public/`.

## How loading works

1. The page opens on the age gate (`src/gate.js`): a flat neon sign and the question. Nothing else loads.
2. On **Yes**, the gate downloads the site in the background (three.js, the editor, the dancer, the dance
   moves, the fonts, Python) while a neon bar fills. The site is laid out but hidden behind the gate.
3. When everything has loaded and the first frames are drawn, the gate fades out. **No** just shows a message.

Progress is reported through `src/loading.js`.

## The show

When the gate lifts, the stage is already set and everything starts at once:

- **Entrance.** The dancer walks on from the back of the stage to the middle (`walk.fbx`), then moves
  straight into her first dance. The clip's forward travel is taken out and replaced by moving her across
  the stage in step with the clip, so her feet don't slide. Tune or switch it off with `ENTRANCE` in
  `src/config.js`.
- **Music.** The songs play one after another behind the show, and start over from the first when the
  last one ends, for as long as the page is open. The first song opens slow, muffled and quiet, then speeds
  up, brightens and swells to the song as recorded (about 40 seconds); every later song fades in at full
  strength. Songs are streamed, so a visitor only downloads the ones they hear. The round speaker button,
  bottom-left, mutes all sound (remembered between visits), and it pauses while the tab is in the background.
  Browsers only allow sound after a click, which is why the sound is unlocked by the age gate's "Yes".
  Tune it, or add a song, with `MUSIC` in `src/config.js`.
- **Sound effects.** When test results come back: one sound when **Run visible tests** passes all the sample
  tests, another when **Submit** passes everything (the problem is solved), and an error sound for anything
  else (wrong answer, an error in the code, the time limit). They are tiny and play through the same audio
  as the music, so the speaker button mutes them too. See `SOUNDS` in `src/config.js`.

## Assets

Only what the site needs lives in `public/` (it is shipped as is):

| File | |
|---|---|
| `public/models/girl.glb` | the dancer |
| `public/animations/*.json` | the walk, dance and strip moves (small, gzipped by Pages) |
| `public/music/*.mp3` | the songs, shrunk for the web (about 14 MB, streamed while playing) |
| `public/sounds/*.mp3` | the sound effects for test results (about 70 KB in all) |

The dance moves start as Mixamo `.fbx` files in `source-assets/animations/` (3–4 MB each, mostly a textured
character the site does not use). After changing or adding one, regenerate the small JSON versions:

```bash
npm run convert:animations
```

The songs start as the `.mp3` files in `source-assets/songs/`, and the sound effects in
`source-assets/sounds/`. Anything above 96 kbps is re-encoded down to it (a song already at or below that
is copied as is), and each sound effect is brought to the same loudness, since they were recorded at very
different volumes. After changing or adding any of them, run the converter (it needs `ffmpeg` installed),
and list a new song in `MUSIC.tracks` or a new effect in `SOUNDS.files`:

```bash
npm run convert:audio
```

`source-assets/` is kept in git but never deployed.

## Where things are

| | |
|---|---|
| `src/config.js` | all the settings: assets, strip order, camera, lights, neon sign |
| `src/problems.js` | the four coding problems and their visible and hidden tests |
| `src/main.js` | the 3D scene and the strip system |
| `src/panel.js` | the problem panel and the code editor |
| `src/runner.js`, `src/pyodide.worker.js` | running Python safely, with a time limit |
| `src/gate.js`, `src/loading.js` | the age gate and the loading progress |
| `src/music.js` | the background music: the song playlist, the opening build, mute |
| `src/sounds.js` | the sound effects played when test results come back |
