'use strict';
(() => {
  const MAX_POINTS = 256;
  const MAX_SAMPLES = 1024;
  function simplify(points, tolerance) {
    if (points.length < 3) return points.map(p => [...p]);
    const keep = new Set([0, points.length - 1]), stack = [[0, points.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(), start = points[a], end = points[b];
      const dx = end[0] - start[0], dy = end[1] - start[1], length = dx * dx + dy * dy;
      let farthest = -1, distance = tolerance * tolerance;
      for (let i = a + 1; i < b; i++) {
        const t = length ? Math.max(0, Math.min(1, ((points[i][0] - start[0]) * dx + (points[i][1] - start[1]) * dy) / length)) : 0;
        const d = (points[i][0] - start[0] - t * dx) ** 2 + (points[i][1] - start[1] - t * dy) ** 2;
        if (d > distance) { farthest = i; distance = d; }
      }
      if (farthest >= 0) { keep.add(farthest); stack.push([a, farthest], [farthest, b]); }
    }
    return [...keep].sort((a, b) => a - b).map(i => [...points[i]]);
  }
  function finish(points, tolerance) {
    let next = simplify(points, tolerance);
    while (next.length > MAX_POINTS) { tolerance *= 1.5; next = simplify(points, tolerance); }
    return next;
  }
  function append(points, point, spacing) {
    if (!point.every(Number.isFinite) || points.length >= MAX_SAMPLES) return false;
    const last = points.at(-1);
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < spacing) return false;
    points.push([...point]);
    return true;
  }
  const api = { MAX_POINTS, MAX_SAMPLES, append, finish, validWidth: n => [1, 2, 3].includes(n) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.BrushCore = api;
})();
