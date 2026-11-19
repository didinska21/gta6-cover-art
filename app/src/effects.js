let noiseTile;
let halftoneTile;

export function makeNoiseTile(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  let seed = 123456789;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const gray = seed >>> 24;
    image.data[i] = gray;
    image.data[i + 1] = gray;
    image.data[i + 2] = gray;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function makeHalftoneTile(spacing) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(spacing * 2));
  canvas.height = canvas.width;
  const ctx = canvas.getContext('2d');
  const step = canvas.width / 2;
  ctx.fillStyle = '#fff';
  // Include dots across the edges so the repeated tile has no seams.
  for (let row = 0; row <= 2; row++) {
    const offset = (row % 2) * step / 2;
    for (let column = -1; column <= 2; column++) {
      ctx.beginPath();
      ctx.arc(column * step + offset, row * step, spacing * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

export function applyGradeWash(ctx, w, h, colors, amount) {
  if (amount <= 0) return;
  ctx.save();
  try {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    colors.forEach((color, i) => {
      gradient.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), color);
    });
    ctx.fillStyle = gradient;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = amount;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount * 0.35;
    ctx.fillRect(0, 0, w, h);
  } finally {
    ctx.restore();
  }
}

export function applyFinish(ctx, w, h, fx) {
  ctx.save();
  try {
    if (fx.grain > 0) {
      noiseTile ??= makeNoiseTile(64);
      ctx.fillStyle = ctx.createPattern(noiseTile, 'repeat');
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = fx.grain * 0.30;
      ctx.fillRect(0, 0, w, h);
    }
    if (fx.halftone > 0) {
      halftoneTile ??= makeHalftoneTile(9);
      ctx.fillStyle = ctx.createPattern(halftoneTile, 'repeat');
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = fx.halftone * 0.5;
      ctx.fillRect(0, 0, w, h);
    }
    if (fx.vignette > 0) {
      const radius = Math.hypot(w, h) / 2;
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
      gradient.addColorStop(0.55, 'rgba(5,0,12,0)');
      gradient.addColorStop(1, 'rgba(5,0,12,0.85)');
      ctx.fillStyle = gradient;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = fx.vignette;
      ctx.fillRect(0, 0, w, h);
    }
  } finally {
    // Restoring also resets alpha and compositing to the caller's values.
    ctx.restore();
  }
}
