// Geometry for sight: does a lantern cone reach a point, is the line between
// two points blocked by cover, and what polygon does a cone paint once walls
// and crates bite into it. Pure maths — no game state lives here.

/** Smallest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Turn `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current, target, maxStep) {
  const diff = angleDifference(current, target);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/** Does the open segment (x1,y1)-(x2,y2) cross the rectangle? Slab test. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  // Touching a corner exactly at an endpoint still counts as blocked only
  // when the crossing happens strictly between the two points.
  return tMax > 0.001 && tMin < 0.999;
}

/** Is the straight line between two points free of every solid rectangle? */
export function lineOfSightClear(x1, y1, x2, y2, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, solids[i])) return false;
  }
  return true;
}

/**
 * How strongly a watchman at (gx, gy) facing `facing` sees the point
 * (px, py): 0 when unseen, otherwise 1 at arm's length fading to 0 at the
 * edge of the lantern's reach. Cover blocks sight entirely.
 */
export function sightStrength(gx, gy, facing, px, py, range, halfAngle, solids) {
  const dx = px - gx;
  const dy = py - gy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (dist > 26) {
    const bearing = Math.atan2(dy, dx);
    if (Math.abs(angleDifference(facing, bearing)) > halfAngle) return 0;
  }
  if (!lineOfSightClear(gx, gy, px, py, solids)) return 0;
  return 1 - dist / range;
}

/**
 * The polygon a vision cone paints: rays fanned across the cone, each one
 * stopped by the first solid it meets. Returns [x0, y0, x1, y1, ...] points
 * starting at the watchman's lantern.
 */
export function conePolygon(gx, gy, facing, range, halfAngle, solids, rayCount) {
  const points = [gx, gy];
  for (let i = 0; i <= rayCount; i += 1) {
    const angle = facing - halfAngle + (2 * halfAngle * i) / rayCount;
    const ex = gx + Math.cos(angle) * range;
    const ey = gy + Math.sin(angle) * range;
    let nearest = 1;
    for (let s = 0; s < solids.length; s += 1) {
      const t = rayRectFraction(gx, gy, ex, ey, solids[s]);
      if (t !== null && t < nearest) nearest = t;
    }
    points.push(gx + (ex - gx) * nearest, gy + (ey - gy) * nearest);
  }
  return points;
}

/** Fraction along the ray where it first enters the rect, or null. */
function rayRectFraction(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return null;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return null;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}
