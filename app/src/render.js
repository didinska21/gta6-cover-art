window.VP = window.VP || {};

(function (VP) {
  'use strict';

  VP.PRESETS = {
    sunset: {
      sky: [[0, '#2a0a3a'], [0.35, '#b81d6d'], [0.72, '#ff7a2f'], [1, '#ffc93c']],
      tint: '#ff5e3a',
      tintAlpha: 0.16,
      titleStops: [[0, '#ffffff'], [0.52, '#ffd76a'], [1, '#ff8a3c']],
      band: ['#1c0b2e', '#7a1042'],
      accent: '#ffd76a'
    },
    neon: {
      sky: [[0, '#050514'], [0.35, '#241056'], [0.72, '#0d2a6e'], [1, '#0e5a6e']],
      tint: '#2438ff',
      tintAlpha: 0.14,
      titleStops: [[0, '#ffffff'], [0.52, '#6ef3ff'], [1, '#ff4fd8']],
      band: ['#070718', '#123a6e'],
      accent: '#6ef3ff'
    },
    miami: {
      sky: [[0, '#33082b'], [0.35, '#e8257f'], [0.72, '#ff6a4d'], [1, '#ffb37a']],
      tint: '#ff2e7e',
      tintAlpha: 0.15,
      titleStops: [[0, '#ffffff'], [0.52, '#ffc4a3'], [1, '#ff5e8a']],
      band: ['#20051c', '#8f1050'],
      accent: '#7af2ff'
    }
  };

  const fontFamily = '"Arial Black", "Segoe UI", system-ui, sans-serif';

  function linearGradient(ctx, x0, y0, x1, y1, stops) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [position, color] of stops) gradient.addColorStop(position, color);
    return gradient;
  }

  function rgba(hex, alpha) {
    const rgb = Number.parseInt(hex.slice(1), 16);
    return `rgba(${rgb >> 16}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${alpha})`;
  }

  function polygonPath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
  }

  function setTracking(ctx, pixels) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${pixels}px`;
  }

  function setTextShadow(ctx, size, strength) {
    ctx.shadowColor = `rgba(8, 0, 16, ${0.55 + 0.4 * strength})`;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = size * 0.03 * (0.4 + strength);
    ctx.shadowOffsetY = size * 0.07 * (0.4 + strength);
  }

  function drawPlaceholder(ctx, bounds, preset) {
    const { x, y, w, h } = bounds;
    ctx.fillStyle = rgba(preset.sky[0][1], 0.85);
    ctx.fillRect(x, y, w, h);

    const cx = x + w / 2;
    const cy = y + h / 2;
    const size = Math.min(w, h);
    const r = size * 0.22;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = Math.max(1, size * 0.006);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
    polygonPath(ctx, [[cx - r * 0.7, cy + r * 0.42],
      [cx, cy - r * 0.5], [cx + r * 0.7, cy + r * 0.42]]);
    ctx.stroke();
  }

  function drawPanel(ctx, poly, panel, img, preset, grade) {
    ctx.save();
    polygonPath(ctx, poly);
    ctx.clip();
    const bounds = VP.panelBounds(poly);
    const imgW = img && (img.naturalWidth ?? img.width);
    const imgH = img && (img.naturalHeight ?? img.height);

    if (img && img.complete !== false && imgW > 0 && imgH > 0) {
      const { x, y, w, h } = bounds;
      // Bleed the image past the bounds; the clip still defines the panel edge.
      const { dx, dy, dw, dh } = VP.coverRect(imgW, imgH, w + 4, h + 4,
        panel.zoom, panel.ox, panel.oy);
      if ('filter' in ctx) {
        ctx.filter = `saturate(${1 + 0.45 * grade}) contrast(${1 + 0.22 * grade}) brightness(${1 + 0.03 * grade})`;
      }
      ctx.drawImage(img, x - 2 + dx, y - 2 + dy, dw, dh);
      if ('filter' in ctx) ctx.filter = 'none';

      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = rgba(preset.tint, preset.tintAlpha * (0.4 + 0.6 * grade));
      ctx.fillRect(x, y, w, h);
    } else {
      drawPlaceholder(ctx, bounds, preset);
    }
    ctx.restore();
  }

  function noiseTile() {
    if (!VP.noiseTile) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 256;
      const noise = tile.getContext('2d');
      const pixels = noise.createImageData(tile.width, tile.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const gray = Math.floor(Math.random() * 256);
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
        pixels.data[i + 3] = 80;
      }
      noise.putImageData(pixels, 0, 0);
      VP.noiseTile = tile;
    }
    return VP.noiseTile;
  }

  function drawEffects(ctx, W, H, preset, fx) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = linearGradient(ctx, 0, 0, 0, H, [
      [0, rgba(preset.accent, 0.10)], [0.4, 'transparent'],
      [1, rgba(preset.band[1], 0.16)]
    ]);
    ctx.fillRect(0, 0, W, H);

    if (fx.halftone > 0) {
      const spacing = Math.max(6, W * 0.011);
      const radius = spacing * 0.32;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.13 * fx.halftone})`;
      ctx.beginPath();
      for (let row = 0, y = 0; y < H + radius; row++, y += spacing) {
        for (let x = (row % 2) * spacing / 2; x < W + radius; x += spacing) {
          ctx.moveTo(x + radius, y);
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
        }
      }
      ctx.fill();
    }

    if (fx.grain > 0) {
      const pattern = ctx.createPattern(noiseTile(), 'repeat');
      if (pattern) {
        ctx.globalAlpha = 0.16 * fx.grain;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.restore();

    if (fx.vignette > 0) {
      const extent = Math.max(W, H);
      const x = W / 2;
      const y = H * 0.46;
      const vignette = ctx.createRadialGradient(x, y, extent * 0.42, x, y, extent * 0.95);
      vignette.addColorStop(0, 'rgba(5, 0, 12, 0)');
      vignette.addColorStop(1, `rgba(5, 0, 12, ${0.55 * fx.vignette})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawCaption(ctx, W, H, caption, preset, shadow) {
    ctx.save();
    const bh = H * 0.085;
    const top = H - bh;
    const slant = H * 0.012;
    polygonPath(ctx, [[0, top - slant], [W, top + slant], [W, H], [0, H]]);
    ctx.fillStyle = linearGradient(ctx, 0, 0, W, 0, [[0, preset.band[0]], [1, preset.band[1]]]);
    ctx.fill();

    const size = H * 0.032;
    ctx.font = `900 ${size}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setTracking(ctx, size * 0.06);
    setTextShadow(ctx, size, shadow);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption.toUpperCase(), W / 2, H - bh / 2, W * 0.94);
    ctx.restore();
  }

  function titleLines(ctx, title) {
    const explicit = title.split(/\r\n?|\n/);
    if (explicit.length > 1) {
      return [explicit[0].trim(), explicit.slice(1).join(' ').trim()];
    }
    const words = title.split(/\s+/);
    if (title.length <= 10 || words.length < 2) return [title];

    let best;
    let smallestGap = Infinity;
    for (let i = 1; i < words.length; i++) {
      const first = words.slice(0, i).join(' ');
      const second = words.slice(i).join(' ');
      const gap = Math.abs(ctx.measureText(first).width - ctx.measureText(second).width);
      if (gap < smallestGap) {
        best = [first, second];
        smallestGap = gap;
      }
    }
    return best;
  }

  function drawTitle(ctx, W, H, title, preset, shadow) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#150420';
    ctx.font = `900 ${H * 0.092}px ${fontFamily}`;
    const lines = titleLines(ctx, title);
    const single = lines.length === 1;
    let size = H * (single ? 0.105 : 0.092);
    ctx.font = `900 ${size}px ${fontFamily}`;
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
    if (widest > W * 0.92) {
      size *= W * 0.92 / widest;
      ctx.font = `900 ${size}px ${fontFamily}`;
    }
    ctx.lineWidth = size * 0.14;

    const shear = 0.07;
    ctx.setTransform(1, 0, -shear, 1, 0, 0);
    lines.forEach((line, i) => {
      const y = H * (single ? 0.115 : 0.105 + i * 0.105);
      const x = W / 2 + shear * y; // Cancel the shear at each line's baseline.
      ctx.fillStyle = linearGradient(ctx, 0, y - size, 0, y, preset.titleStops);
      setTextShadow(ctx, size, shadow);
      ctx.strokeText(line, x, y);
      ctx.shadowColor = 'transparent';
      ctx.fillText(line, x, y);
    });
    ctx.restore();
  }

  function drawBrand(ctx, W, H) {
    ctx.save();
    const size = H * 0.018;
    ctx.translate(W * 0.03, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `700 ${size}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    setTracking(ctx, size * 0.12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('VICE PANELS', 0, 0);
    ctx.restore();
  }

  VP.drawPoster = function (ctx, W, H, state) {
    const { photos, panels, fx } = state;
    const preset = VP.PRESETS[state.preset] || VP.PRESETS.sunset;

    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = 'transparent';
      if ('filter' in ctx) ctx.filter = 'none';
      setTracking(ctx, 0);

      ctx.fillStyle = linearGradient(ctx, 0, 0, W, H, preset.sky);
      ctx.fillRect(0, 0, W, H);

      const polygons = VP.panelPolygons(panels.length, W, H);
      polygons.forEach((poly, i) => {
        const panel = panels[i];
        drawPanel(ctx, poly, panel, photos[panel.photo], preset, fx.grade);
      });

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(3, W * 0.007);
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      for (const poly of polygons) {
        polygonPath(ctx, poly);
        ctx.stroke();
      }

      drawEffects(ctx, W, H, preset, fx);
      const caption = state.caption.trim();
      const title = state.title.trim();
      if (caption) drawCaption(ctx, W, H, caption, preset, fx.shadow);
      if (title) drawTitle(ctx, W, H, title, preset, fx.shadow);
      drawBrand(ctx, W, H);
    } finally {
      ctx.restore();
    }
  };
})(window.VP);
