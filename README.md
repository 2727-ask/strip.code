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
30 MB, which would mean something large ended up in `public/`.

## How loading works

1. The page opens on the age gate (`src/gate.js`): a flat neon sign and the question. Nothing else loads.
2. On **Yes**, the gate downloads the site in the background (three.js, the editor, the dancer, the dance
   moves, the fonts, Python) while a neon bar fills. The site is laid out but hidden behind the gate.
3. When everything has loaded and the first frames are drawn, the gate fades out. **No** just shows a message.

Progress is reported through `src/loading.js`.

## Assets

Only what the site needs lives in `public/` (it is shipped as is):

| File | |
|---|---|
| `public/models/girl.glb` | the dancer |
| `public/animations/*.json` | the dance and strip moves (small, gzipped by Pages) |

The dance moves start as Mixamo `.fbx` files in `source-assets/animations/` (3–4 MB each, mostly a textured
character the site does not use). After changing or adding one, regenerate the small JSON versions:

```bash
npm run convert:animations
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
