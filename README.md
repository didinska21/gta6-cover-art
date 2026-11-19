# VICE PANELS

[![Competition](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/didinska21/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/didinska21/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

VICE PANELS turns your own photos into multi-panel poster cover art in a neon-sunset "Vice City" style: slanted poster panels, a magenta-orange-cyan colour grade, and bold display lettering, exported as a PNG in the sizes people actually post. It is a fully offline static web app — no build step, no network requests, your photos never leave your machine. Everything is original: the lettering uses the bundled Anton and Archivo Black typefaces (SIL Open Font License), and no game artwork, logo or font is used anywhere.

## What it does

- Drop in 1–6 photos (or press **Contoh** to load the four built-in sample photos, made with an image model for this app); the panel layout — 1, 2, 3 or 4 slanted panels — fits the photo count automatically, or pick a layout yourself.
- Every panel is its own crop: drag a photo inside its panel, scroll or slide to zoom, hit **Auto focus** to centre on a face, and swap panels to reorder the story.
- Edit the title and caption live on the canvas, and restyle the whole poster with three presets — **Sunset**, **Neon Night** and **Miami Heat** — plus colour grade, grain, halftone and vignette sliders.
- Export in one click at **1080 × 1080**, **1080 × 1350** or **1920 × 1080**.

## How to run

Serve the app locally:

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

To build the submission dossier instead (outside the grader's container, `MAKEFUN_OUTPUT_DIR` stands in for `/output`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How the poster is drawn

The renderer (`app/src/cover.js`) treats every cover as a small poster press. `computePanels` cuts the frame into slanted panels with a paper gutter between them; each photo is cover-fitted into its panel around its own focus point, so a face stays framed even in a wide, short panel. The preset then grades the whole sheet — a sunset, neon-night or pastel-heat wash laid over the panels — and deterministic grain and halftone textures (seeded, so every export of the same cover is byte-stable) plus a vignette finish the print look. The lettering is set last, on a deepened scrim at the foot: the caption in Archivo Black above a gradient-filled Anton title, auto-sized to the words you give it. What you see in the live preview is exactly what the PNG export draws, at all three sizes.

## Layout of the repository

- `app/` — the web app itself: `index.html`, `style.css`, `src/main.js` (editor wiring), `src/cover.js` (the poster renderer), `src/shots.js` (fixed scenes for screenshots), `fonts/` (bundled OFL typefaces with their licences) and `samples/` (the built-in sample photos).
- `main.ts` — the hand-in program: copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored library.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.
- `screenshots/` — the cover and editor screenshots the entry is judged by.
- `serve.ts` — a tiny local static server for trying the app.

## Licence

MIT — see `LICENSE`. The bundled fonts keep their own licences: `app/fonts/Anton-OFL.txt` and `app/fonts/ArchivoBlack-OFL.txt`.
