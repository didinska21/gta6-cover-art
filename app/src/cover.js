/** Pure cover rendering. Helper canvases are allocated lazily, never on import. */
export const PRESETS = {
  sunset: {
    sky: ['#2a0a2e', '#8f1d5a', '#ff7a3c'],
    tint: '#ff8a4a', saturation: 1.28, contrast: 1.08,
    titleA: '#ffe259', titleB: '#ff7518', caption: '#ffffff',
    shadow: '#2a0a2e', frame: '#fff7ea',
  },
  neon: {
    sky: ['#050914', '#0d2b52', '#7a1e6e'],
    tint: '#37c8ff', saturation: 1.22, contrast: 1.14,
    titleA: '#8ff7ff', titleB: '#ff4fd8', caption: '#eafcff',
    shadow: '#02040a', frame: '#eafcff',
  },
  miami: {
    sky: ['#3d0c4e', '#c62b7d', '#ffb347'],
    tint: '#ffb347', saturation: 1.35, contrast: 1.05,
    titleA: '#ffffff', titleB: '#ffd76e', caption: '#fff3d6',
    shadow: '#3d0c4e', frame: '#ffffff',
  },
};

/** Clip a convex polygon to one side of a line, inset by a normal distance. */
function clipByDivider(polygon, a, b, side, inset) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const length = Math.hypot(vx, vy);
  const distance = ([x, y]) => side * (vx * (y - a[1]) - vy * (x - a[0])) / length - inset;
  const result = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const dp = distance(p);
    const dq = distance(q);
    if (dp >= 0) result.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return result;
}

/** Clockwise polygons, ordered left-to-right and then top-to-bottom. */
export function computePanels(count, w, h) {
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new RangeError('Panel count must be an integer from 1 to 4.');
  }
  const g = Math.round(w * 0.012);
  const outer = [[g, g], [w - g, g], [w - g, h - g], [g, h - g]];
  if (count === 1) return [outer];

  const topX = w * (count === 2 ? 0.54 : count === 3 ? 0.56 : 0.53);
  const bottomX = w * (count === 2 ? 0.46 : count === 3 ? 0.50 : 0.47);
  const verticalA = [topX, 0];
  const verticalB = [bottomX, h];
  const left = clipByDivider(outer, verticalA, verticalB, 1, g / 2);
  const right = clipByDivider(outer, verticalA, verticalB, -1, g / 2);
  if (count === 2) return [left, right];

  // The three-panel horizontal divider begins on the un-offset right-block
  // boundary at y = .44h. Both neighbours then move away by half a gutter.
  const horizontalA = count === 3
    ? [topX + (bottomX - topX) * 0.44, h * 0.44]
    : [0, h * 0.47];
  const horizontalB = [w, h * (count === 3 ? 0.52 : 0.53)];
  const top = (polygon) => clipByDivider(polygon, horizontalA, horizontalB, -1, g / 2);
  const bottom = (polygon) => clipByDivider(polygon, horizontalA, horizontalB, 1, g / 2);
  if (count === 3) return [left, top(right), bottom(right)];
  return [top(left), top(right), bottom(left), bottom(right)];
}

/** Ray casting with inclusive edges; gutter points belong to no panel. */
export function panelIndexAt(panels, x, y) {
  return panels.findIndex((polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const [ax, ay] = polygon[j];
      const [bx, by] = polygon[i];
      const length = Math.hypot(bx - ax, by - ay);
      if (length > 0 && Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) <= 1e-8 * length
        && x >= Math.min(ax, bx) - 1e-8 && x <= Math.max(ax, bx) + 1e-8
        && y >= Math.min(ay, by) - 1e-8 && y <= Math.max(ay, by) + 1e-8) return true;
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) {
        inside = !inside;
      }
    }
    return inside;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Cover a { x, y, w, h } box, centring the requested image focus if possible. */
export function coverFit(img, box, focusX = 0.5, focusY = 0.5, zoom = 1) {
  const iw = img.naturalWidth || img.videoWidth || img.width;
  const ih = img.naturalHeight || img.videoHeight || img.height;
  const bw = box.w ?? box.width;
  const bh = box.h ?? box.height;
  const scale = Math.max(bw / iw, bh / ih) * Math.max(1, zoom);
  const dw = iw * scale;
  const dh = ih * scale;
  return {
    dx: clamp(box.x + bw / 2 - clamp(focusX, 0, 1) * dw, box.x + bw - dw, box.x),
    dy: clamp(box.y + bh / 2 - clamp(focusY, 0, 1) * dh, box.y + bh - dh, box.y),
    dw,
    dh,
  };
}

function panelBounds(polygon) {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function tracePolygon(ctx, polygon) {
  ctx.beginPath();
  polygon.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function skyGradient(ctx, sky, x0, y0, x1, y1) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  sky.forEach((color, i) => gradient.addColorStop(i / (sky.length - 1), color));
  return gradient;
}

function applyPanelWash(ctx, box, color, mode, alpha) {
  const gradient = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, color);
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

// Only these helper canvases are retained. Resizing replaces the dot cache.
let dotCache = null;
let noiseCanvas = null;

function createHelperCanvas(width, height) {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getDotTiles(cell) {
  const pixels = Math.ceil(cell);
  if (dotCache && dotCache.pixels === pixels) return dotCache;
  const tiles = ['#000000', '#ffffff'].map((color) => {
    const canvas = createHelperCanvas(pixels, pixels);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pixels / 2, pixels / 2, pixels * 0.32, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  });
  dotCache = { pixels, black: tiles[0], white: tiles[1] };
  return dotCache;
}

/** A local, repeatable generator: rendering never depends on ambient entropy. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getNoiseCanvas() {
  if (noiseCanvas) return noiseCanvas;
  const canvas = createHelperCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(256, 256);
  const random = mulberry32(20261119);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = Math.floor(random() * 256);
    image.data[i] = gray;
    image.data[i + 1] = gray;
    image.data[i + 2] = gray;
    image.data[i + 3] = 40;
  }
  ctx.putImageData(image, 0, 0);
  noiseCanvas = canvas;
  return noiseCanvas;
}

/** Scaling the pattern space preserves fractional cell sizes without DOMMatrix. */
function fillPattern(ctx, tile, w, h, scale = 1, offset = 0) {
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.translate(offset, offset);
  ctx.scale(scale, scale);
  ctx.fillStyle = pattern;
  ctx.fillRect(-offset / scale, -offset / scale, w / scale, h / scale);
  ctx.restore();
}

function setLetterSpacing(ctx, spacing) {
  if ('letterSpacing' in ctx) {
    try { ctx.letterSpacing = spacing; } catch { /* Older contexts may expose a read-only property. */ }
  }
}

function fitText(ctx, text, family, initialSize, minSize, maxWidth) {
  let size = initialSize;
  ctx.font = `${size}px "${family}", sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size = Math.max(minSize, size - 0.5);
    ctx.font = `${size}px "${family}", sans-serif`;
  }
  return size;
}

function drawLettering(ctx, w, h, preset, title, caption) {
  const titleText = String(title ?? '').trim().toUpperCase();
  if (!titleText) return;
  const captionText = String(caption ?? '').trim().toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = preset.shadow;
  if (captionText) {
    setLetterSpacing(ctx, '0.18em');
    const size = fitText(ctx, captionText, 'Archivo Black', h * 0.034, Math.min(1, h * 0.034), w * 0.86);
    ctx.fillStyle = preset.caption;
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = size * 0.12;
    ctx.fillText(captionText, w / 2, h * 0.845);
  }
  setLetterSpacing(ctx, '0px');
  const size = fitText(ctx, titleText, 'Anton', h * 0.135, h * 0.04, w * 0.92);
  const baseline = h * 0.955;
  const gradient = ctx.createLinearGradient(0, baseline - size, 0, baseline);
  gradient.addColorStop(0, preset.titleA);
  gradient.addColorStop(1, preset.titleB);
  ctx.fillStyle = gradient;
  ctx.strokeStyle = 'rgba(12,2,18,0.9)';
  ctx.lineWidth = size * 0.10;
  ctx.lineJoin = 'round';
  ctx.shadowBlur = size * 0.3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = size * 0.10;
  ctx.strokeText(titleText, w / 2, baseline);
  ctx.fillText(titleText, w / 2, baseline);
}

/** Render the complete poster into an existing 2D context, preserving its state. */
export function drawCover(ctx, S) {
  const { w, h, photos, panels, preset, title, caption, fx } = S;
  const g = Math.round(w * 0.012);
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = skyGradient(ctx, preset.sky, 0, 0, 0, h);
    ctx.fillRect(0, 0, w, h);

    panels.forEach((polygon, i) => {
      const box = panelBounds(polygon);
      ctx.save();
      try {
        tracePolygon(ctx, polygon);
        ctx.clip();
        const photo = photos[i];
        if (photo) {
          const { dx, dy, dw, dh } = coverFit(photo.img, box, photo.focusX, photo.focusY, photo.zoom);
          ctx.filter = `saturate(${preset.saturation}) contrast(${preset.contrast})`;
          ctx.drawImage(photo.img, dx, dy, dw, dh);
          ctx.filter = 'none';
        } else {
          ctx.fillStyle = skyGradient(ctx, preset.sky, box.x, box.y, box.x + box.w, box.y + box.h);
          ctx.fillRect(box.x, box.y, box.w, box.h);
        }
        applyPanelWash(ctx, box, preset.tint, 'soft-light', 0.34 * fx.grade);
        applyPanelWash(ctx, box, preset.sky[1], 'overlay', 0.18 * fx.grade);
      } finally {
        ctx.restore();
      }
    });

    ctx.strokeStyle = preset.frame;
    ctx.lineWidth = Math.max(3, w * 0.005);
    ctx.lineJoin = 'round';
    panels.forEach((polygon) => {
      tracePolygon(ctx, polygon);
      ctx.stroke();
    });
    ctx.lineWidth = Math.max(4, w * 0.007);
    ctx.strokeRect(g / 2, g / 2, w - g, h - g);

    if (fx.halftone > 0) {
      const cell = Math.max(8, w / 90);
      const dots = getDotTiles(cell);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.30 * fx.halftone;
      fillPattern(ctx, dots.black, w, h, cell / dots.pixels);
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.18 * fx.halftone;
      fillPattern(ctx, dots.white, w, h, cell / dots.pixels, cell / 2);
    }
    if (fx.grain > 0) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.5 * fx.grain;
      fillPattern(ctx, getNoiseCanvas(), w, h);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (fx.vignette > 0) {
      const vignette = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w / 2, h / 2));
      vignette.addColorStop(0.55, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, `rgba(0,0,0,${0.55 * fx.vignette})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }

    const scrim = ctx.createLinearGradient(0, h * 0.60, 0, h);
    scrim.addColorStop(0, 'rgba(10,2,16,0)');
    scrim.addColorStop(1, 'rgba(10,2,16,0.72)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h * 0.60, w, h * 0.40);
    drawLettering(ctx, w, h, preset, title, caption);
  } finally {
    ctx.restore();
  }
}
