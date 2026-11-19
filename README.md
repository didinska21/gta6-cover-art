[![Competition](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/didinska21/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/didinska21/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# VICE PANELS

Turn your own photos into multi-panel cover-art posters in a sun-soaked
neon style: slanted panels, bold skewed lettering, sunset and neon color
grades, and a caption band — rendered entirely in the browser.

Open `app/index.html` in a desktop browser and it just works. There is no
server, no build step, and no network call: every photo stays on your
machine and every pixel is drawn locally on a canvas.

## Quick start

1. Open `app/index.html` and press **Contoh** — four built-in sample
   photos load and the poster composes itself.
2. Pick a style (**Sunset**, **Neon Night**, **Miami Heat**), type your
   own title and caption, and nudge the effect sliders.
3. Click any panel, drag its photo into place, scroll to zoom.
4. Choose a size and press **Ekspor PNG**. Done — a finished cover.

The four images in `screenshots/` are real exports produced by the app
itself (three covers, one per style and size) plus one shot of the
editor with the samples loaded.

## What it does

- Drop in 1–6 photos (drag and drop, file picker, or the built-in
  **Contoh** samples) and the poster layout follows: 1, 2, 3 or 4 slanted
  panels, or pick a layout yourself.
- Click a panel to select it, drag to reposition its photo, scroll to
  zoom, swap photos between panels, or hit auto-focus to re-center.
- Three house styles — **Sunset**, **Neon Night**, **Miami Heat** — each
  with its own sky gradient, photo grade, title colors and caption band.
- Editable title and caption, drawn live on the poster with heavy
  poster lettering: gradient fill, dark outline, hard shadow.
- Effect sliders for color grade, film grain, halftone dots, vignette
  and text shadow.
- One-click PNG export at 1080×1080, 1080×1350 or 1920×1080.

## Layout of this repo

- `app/` — the whole application: `index.html`, `style.css`, the
  scripts in `app/src/` (panel geometry, the poster renderer, the
  editor wiring, the bootstrap) and the built-in sample photos in
  `app/samples/`.
- `screenshots/` — the cover exports and editor shot shown to judges.
- `main.ts` — the hand-in program: copies `app/` and `screenshots/`
  to the output directory and writes `dossier.json` with the vendored
  library in `vendor/`.

Everything here is original work — no third-party artwork, logos or
fonts. Lettering is drawn on canvas with a heavy system font stack.
