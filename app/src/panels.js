window.VP = window.VP || {};

(function (VP) {
  'use strict';

  VP.panelPolygons = function (count, W, H) {
    if (count === 1) {
      return [[[0, 0], [W, 0], [W, H], [0, H]]];
    }

    if (count === 2 || count === 3) {
      const lean = count === 2 ? 0.05 : 0.035;
      const top = [0];
      const bottom = [0];
      for (let i = 1; i < count; i++) {
        top.push((i / count + lean) * W);
        bottom.push((i / count - lean) * W);
      }
      top.push(W);
      bottom.push(W);
      return top.slice(0, count).map((x, i) => [
        [x, 0], [top[i + 1], 0], [bottom[i + 1], H], [bottom[i], H]
      ]);
    }

    if (count === 4) {
      // In normalized coordinates the dividers are x = .54 - .08y
      // and y = .45 + .08x. Solve them before scaling to poster size.
      const x = (0.54 - 0.08 * 0.45) / (1 + 0.08 * 0.08);
      const center = [x * W, (0.45 + 0.08 * x) * H];
      const top = [0.54 * W, 0];
      const bottom = [0.46 * W, H];
      const left = [0, 0.45 * H];
      const right = [W, 0.53 * H];
      return [
        [[0, 0], top, center, left],
        [top, [W, 0], right, center],
        [left, center, bottom, [0, H]],
        [center, right, [W, H], bottom]
      ];
    }

    return [];
  };

  VP.panelBounds = function (poly) {
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };

  VP.coverRect = function (imgW, imgH, boxW, boxH, zoom, ox, oy) {
    const scale = Math.max(boxW / imgW, boxH / imgH) * zoom;
    const dw = imgW * scale;
    const dh = imgH * scale;
    // Positive offsets move the image right or down within its available slack.
    const dx = (boxW - dw) * (1 - ox) / 2;
    const dy = (boxH - dh) * (1 - oy) / 2;
    return { dx, dy, dw, dh };
  };
})(window.VP);
