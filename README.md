# VICE PANELS

[![Competition](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/didinska21/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/didinska21/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

VICE PANELS is a small offline web app that turns your own photos into
multi-panel poster covers in a neon-soaked, vice-city mood: slanted panels,
sunset and neon colour grades, grain and halftone finishes, and big
hand-drawn canvas lettering over the top. Everything runs locally in the
browser — no uploads, no network, no accounts. Your photos never leave
the machine.

## What it does

- Add 1–6 photos by file picker or drag-and-drop, or press
  **Contoh — Load Samples** to start with the four built-in sample photos.
- Photos are laid out in 1, 2, 3 or 4 slanted panels (Auto picks from the
  photo count, or force a layout yourself).
- Click a panel to select it, drag to reframe, scroll to zoom, and use
  Auto-Focus to centre it. Reorder photos from the photo list.
- Three style presets — Sunset, Neon Night and Miami Heat — plus sliders
  for colour grade, grain, halftone, vignette and text shadow.
- Edit the title and caption live; the lettering is drawn on canvas with
  a heavy system type stack, gradient fill, stroke and hard shadow.
- Export a finished PNG in one click at 1080×1080, 1080×1350 or
  1920×1080.

## The built-in samples

The four photos under `app/samples/` were made for this app (generated
in-session, no stock photography): a neon boulevard convertible at dusk,
a lifeguard tower on a sunset beach, a neon-night portrait, and a
speedboat crossing a marina at dawn. Each subject sits near the centre
of its frame, so the default centre crop of every panel layout keeps
the subject in view — press **Contoh** and the first poster already
looks finished. Your own photos can be reframed per panel with drag,
zoom and Auto-Focus.

## Running it

The app is plain static files under `app/`. Serve that folder with any
static file server and open it in a desktop browser, for example:

```sh
python3 -m http.server --directory app 8000
```

then visit http://localhost:8000.

## Entry layout

- `app/` — the web app itself (index.html, style.css, src/, samples/).
- `screenshots/` — four renders of the app; the first is the cover.
- `main.ts` — the handoff program: it copies `app/` and `screenshots/`
  into the output directory and writes `dossier.json` using the vendored
  library in `vendor/`.
- `vendor/makefun-app.ts` — make.fun's dossier library, vendored
  unchanged.

To rehearse the handoff outside the grader:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/vice-out node main.ts
```

## License

MIT — see `LICENSE`.
