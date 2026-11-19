import { panelPolygons } from './panels.js';
import { applyGradeWash, applyFinish } from './effects.js';

export const PRESETS = {
  sunset: {
    sky: ['#2b0a4a', '#7b1e5e', '#e83e6b', '#ff7a3d', '#ffb347'],
    wash: ['#ff2e88', '#ff9a3d', '#22d3ee'],
    titleTop: '#fff3b0',
    titleBottom: '#ff7847',
    caption: '#ffe9d6',
    accent: '#ffd23d',
  },
  neon: {
    sky: ['#05010f', '#160a33', '#3b0f54', '#8a1e6e'],
    wash: ['#22d3ee', '#ff2e88', '#7c3aed'],
    titleTop: '#a5f3fc',
    titleBottom: '#f0abfc',
    caption: '#e0f2fe',
    accent: '#22d3ee',
  },
  miami: {
    sky: ['#0b3b5e', '#0e6e6e', '#19b5a6', '#ffd76e'],
    wash: ['#19b5a6', '#ffd76e', '#ff8fab'],
    titleTop: '#ffffff',
    titleBottom: '#7ef0d4',
    caption: '#ecfdf5',
    accent: '#ffd76e',
  },
};

function drawSky(ctx, w, h, preset) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  preset.sky.forEach((color, i) => sky.addColorStop(i / (preset.sky.length - 1), color));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const x = w * 0.82;
  const y = h * 0.16;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.48);
  glow.addColorStop(0, preset.accent);
  glow.addColorStop(1, `${preset.accent}00`);
  ctx.save();
  ctx.globalAlpha *= 0.25;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function panelGeometry(polygon) {
  const path = new Path2D();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  polygon.forEach((point, i) => {
    const [x, y] = Array.isArray(point) ? point : [point.x, point.y];
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  });
  path.closePath();
  return { path, left, top, right, bottom };
}

function setFilter(ctx, filter) {
  try {
    ctx.filter = filter;
  } catch {
    // Canvas filters are optional on some contexts.
  }
}

function drawPanel(ctx, geometry, panel, preset, grade) {
  const { path, left, top, right, bottom } = geometry;
  const { img, dx, dy, zoom } = panel;
  const bw = right - left;
  const bh = bottom - top;

  ctx.save();
  try {
    ctx.clip(path);
    if (img) {
      // Fit the source over the bounds, then apply zoom and fractional pan.
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      const scale = Math.max(bw / imgW, bh / imgH) * zoom;
      const dw = imgW * scale;
      const dh = imgH * scale;
      const cx = left + bw / 2 + dx * bw;
      const cy = top + bh / 2 + dy * bh;

      if (grade > 0) {
        setFilter(ctx, `saturate(${1 + 0.6 * grade}) contrast(${1 + 0.25 * grade})`);
      }
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      if (grade > 0) setFilter(ctx, 'none');
    } else {
      const fill = ctx.createLinearGradient(left, top, right, bottom);
      fill.addColorStop(0, preset.sky[0]);
      fill.addColorStop(1, preset.sky[Math.floor(preset.sky.length / 2)]);
      ctx.fillStyle = fill;
      ctx.fillRect(left, top, bw, bh);
    }
  } finally {
    ctx.restore();
  }
}

function setLetterSpacing(ctx, spacing) {
  try {
    ctx.letterSpacing = `${spacing}px`;
  } catch {
    // Text still renders on contexts without letter spacing support.
  }
}

function drawLettering(ctx, w, h, preset, title, caption, shadow) {
  const scrim = ctx.createLinearGradient(0, h * 0.52, 0, h);
  scrim.addColorStop(0, 'rgba(8,0,16,0)');
  scrim.addColorStop(1, 'rgba(8,0,16,0.80)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.52, w, h * 0.48);

  const pad = w * 0.045;
  const text = title.toUpperCase();
  let size = Math.max(24, h * 0.125);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (;;) {
    ctx.font = `900 ${size}px "Arial Black", "Arial Bold", Arial, sans-serif`;
    setLetterSpacing(ctx, size * 0.01);
    if (ctx.measureText(text).width <= w - 2 * pad || size === 24) break;
    size = Math.max(24, size - 1);
  }

  const cap = size * 0.34;
  const captionBaseline = h - pad * 0.8;
  const titleBaseline = captionBaseline - cap * 1.5;

  // Pivot the shear at the title baseline to keep its left edge anchored.
  ctx.translate(pad, titleBaseline);
  ctx.transform(1, 0, -0.10, 1, 0, 0);
  ctx.translate(-pad, -titleBaseline);

  const shadowOffset = 0.3 + shadow;
  ctx.fillStyle = `rgba(6,0,12,${0.85 * shadow})`;
  ctx.fillText(text, pad + size * 0.05 * shadowOffset, titleBaseline + size * 0.055 * shadowOffset);

  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.15;
  ctx.strokeStyle = '#16031f';
  ctx.strokeText(text, pad, titleBaseline);

  const titleFill = ctx.createLinearGradient(0, titleBaseline - size, 0, titleBaseline);
  titleFill.addColorStop(0, preset.titleTop);
  titleFill.addColorStop(1, preset.titleBottom);
  ctx.fillStyle = titleFill;
  ctx.fillText(text, pad, titleBaseline);
  ctx.restore();

  if (caption) {
    const barWidth = Math.max(60, w * 0.16);
    const barHeight = Math.max(3, size * 0.055);
    const bar = ctx.createLinearGradient(pad, 0, pad + barWidth, 0);
    bar.addColorStop(0, preset.accent);
    bar.addColorStop(1, `${preset.accent}00`);
    ctx.fillStyle = bar;
    ctx.fillRect(pad, titleBaseline + cap * 0.3, barWidth, barHeight);

    ctx.font = `700 ${cap}px Arial, sans-serif`;
    setLetterSpacing(ctx, cap * 0.08);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = preset.caption;
    ctx.fillText(caption, pad, captionBaseline);
  }
}

export function drawPoster(ctx, w, h, view) {
  const { panels, preset, title, caption, fx } = view;
  const colors = PRESETS[preset];

  ctx.save();
  try {
    drawSky(ctx, w, h, colors);

    const geometries = panelPolygons(panels.length, w, h).map(panelGeometry);
    geometries.forEach((geometry, i) => drawPanel(ctx, geometry, panels[i], colors, fx.grade));

    // Stroke all the dark outlines before laying the white borders over them.
    ctx.lineWidth = Math.max(6, w * 0.010);
    ctx.strokeStyle = 'rgba(12,2,22,0.9)';
    geometries.forEach(({ path }) => ctx.stroke(path));
    ctx.lineWidth = Math.max(3, w * 0.0045);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    geometries.forEach(({ path }) => ctx.stroke(path));

    applyGradeWash(ctx, w, h, colors.wash, fx.grade * 0.8);
    drawLettering(ctx, w, h, colors, title, caption, fx.shadow);
    applyFinish(ctx, w, h, fx);
  } finally {
    ctx.restore();
  }
}
