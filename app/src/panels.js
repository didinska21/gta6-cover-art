// Geometry helpers use poster coordinates and never touch the DOM.
export function polygonCentroid(poly) {
  const sum = poly.reduce(([x, y], point) => [x + point[0], y + point[1]], [0, 0]);
  return [sum[0] / poly.length, sum[1] / poly.length];
}

export function panelPolygons(count, w, h) {
  if (count === 1) return [[[0, 0], [w, 0], [w, h], [0, h]]];

  const seams = {
    2: [[0.60], [0.40]],
    3: [[0.38, 0.70], [0.28, 0.60]],
    4: [[0.28, 0.52, 0.76], [0.20, 0.44, 0.68]],
  };
  if (!Number.isInteger(count) || !seams[count]) {
    throw new RangeError('Panel count must be an integer from 1 to 4.');
  }

  const top = [0, ...seams[count][0], 1];
  const bottom = [0, ...seams[count][1], 1];
  const gap = Math.max(3, w * 0.004);

  return Array.from({ length: count }, (_, i) => {
    const poly = [
      [top[i] * w, 0],
      [top[i + 1] * w, 0],
      [bottom[i + 1] * w, h],
      [bottom[i] * w, h],
    ];
    const [cx, cy] = polygonCentroid(poly);
    // Pull each corner toward this panel's centroid to open the gutters.
    return poly.map(([x, y]) => {
      const dx = cx - x;
      const dy = cy - y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) return [x, y];
      return [x + dx * gap / distance, y + dy * gap / distance];
    });
  });
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonBounds(poly) {
  const xs = poly.map(([x]) => x);
  const ys = poly.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
