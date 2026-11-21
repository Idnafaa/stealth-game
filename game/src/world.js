// The rules of the glasshouse, with no drawing and no browser in them: the
// intruder, the watchmen and their lanterns, suspicion that fills and drains,
// pebbles that pull eyes away, the orchid, and the door. step() advances one
// fixed tick and reports what happened as bit flags for sound and screens.
import { FIELD, GUARD, PEBBLE, PLAYER, SHADOW_FACTOR, SNEAK_FACTOR } from './config.js';
import { LEVELS } from './levels.js';
import { angleDifference, lineOfSightClear, sightStrength, turnToward } from './vision.js';

export const EVENT_PICKUP = 1;
export const EVENT_COMPLETE = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_ALERT = 8;
export const EVENT_PEBBLE = 16;
export const EVENT_LOCKED = 32;
export const EVENT_STEP = 64;
export const EVENT_GUARD_STEP = 128;

const GUARD_PATROL = 'patrol';
const GUARD_STARE = 'stare';
const GUARD_INVESTIGATE = 'investigate';
const GUARD_CHASE = 'chase';
const GUARD_SEARCH = 'search';
const GUARD_RETURN = 'return';

function outerWalls() {
  const t = FIELD.wall;
  return [
    { x: 0, y: 0, w: FIELD.width, h: t, kind: 'wall' },
    { x: 0, y: FIELD.height - t, w: FIELD.width, h: t, kind: 'wall' },
    { x: 0, y: 0, w: t, h: FIELD.height, kind: 'wall' },
    { x: FIELD.width - t, y: 0, w: t, h: FIELD.height, kind: 'wall' },
  ];
}

function circleHitsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    solids: [],
    shadows: [],
    player: { x: 0, y: 0, angle: 0, sneaking: false, moving: false, inShadow: false, stepAcc: 0 },
    guards: [],
    pebblesLeft: 0,
    pebbleCooldown: 0,
    pebble: { active: false, x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0, landX: 0, landY: 0, landTimer: 0 },
    hasOrchid: false,
    detection: 0,
    time: 0,
    levelTime: 0,
    detections: 0,
    caughtBy: -1,
    nearestGuardStep: -1,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.solids = outerWalls().concat(level.solids);
    state.shadows = level.shadows;
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.angle = -Math.PI / 2;
    state.player.sneaking = false;
    state.player.moving = false;
    state.player.inShadow = false;
    state.player.stepAcc = 0;
    state.guards = level.guards.map((spec, i) => ({
      x: spec.path[0][0],
      y: spec.path[0][1],
      angle: Math.atan2(spec.path[1][1] - spec.path[0][1], spec.path[1][0] - spec.path[0][0]),
      path: spec.path,
      pause: spec.pause,
      waypoint: 1 % spec.path.length,
      pauseTimer: 0,
      scanBase: 0,
      scanPhase: random() * Math.PI * 2,
      mode: GUARD_PATROL,
      suspicion: 0,
      alerted: false,
      lastSeenX: 0,
      lastSeenY: 0,
      targetX: 0,
      targetY: 0,
      loseTimer: 0,
      searchTimer: 0,
      stepAcc: random() * 40,
      index: i,
    }));
    state.pebblesLeft = level.pebbles;
    state.pebbleCooldown = 0;
    state.pebble.active = false;
    state.pebble.landTimer = 0;
    state.hasOrchid = false;
    state.detection = 0;
    state.levelTime = 0;
    state.caughtBy = -1;
    state.nearestGuardStep = -1;
  }

  function reset() {
    state.time = 0;
    state.detections = 0;
    loadLevel(0);
  }

  function retryLevel() {
    loadLevel(state.levelIndex);
  }

  function nextLevel() {
    loadLevel(Math.min(LEVELS.length - 1, state.levelIndex + 1));
  }

  function isLastLevel() {
    return state.levelIndex >= LEVELS.length - 1;
  }

  /** Move a circle by (dx, dy), sliding along solids one axis at a time. */
  function moveCircle(body, radius, dx, dy) {
    if (dx !== 0) {
      body.x += dx;
      for (const rect of state.solids) {
        if (circleHitsRect(body.x, body.y, radius, rect)) {
          body.x = dx > 0 ? rect.x - radius : rect.x + rect.w + radius;
        }
      }
    }
    if (dy !== 0) {
      body.y += dy;
      for (const rect of state.solids) {
        if (circleHitsRect(body.x, body.y, radius, rect)) {
          body.y = dy > 0 ? rect.y - radius : rect.y + rect.h + radius;
        }
      }
    }
  }

  function inShadow(x, y) {
    for (const rect of state.shadows) if (pointInRect(x, y, rect)) return true;
    return false;
  }

  /** Walk a guard toward a point; true when it arrives. */
  function guardWalk(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return true;
    const stepLen = Math.min(dist, speed * dt);
    const ux = dx / dist;
    const uy = dy / dist;
    guard.angle = turnToward(guard.angle, Math.atan2(uy, ux), GUARD.turnSpeed * dt);
    moveCircle(guard, GUARD.radius, ux * stepLen, uy * stepLen);
    guard.stepAcc += stepLen;
    return Math.hypot(tx - guard.x, ty - guard.y) < 8;
  }

  function nearestWaypoint(guard) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < guard.path.length; i += 1) {
      const d = Math.hypot(guard.path[i][0] - guard.x, guard.path[i][1] - guard.y);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function updateGuard(guard, dt, harmless) {
    const player = state.player;
    let events = 0;
    let sees = 0;
    if (!harmless) {
      sees = sightStrength(guard.x, guard.y, guard.angle, player.x, player.y, GUARD.viewRange, GUARD.viewHalfAngle, state.solids);
      if (sees > 0) {
        let rate = GUARD.fillFar + (GUARD.fillNear - GUARD.fillFar) * sees;
        if (player.sneaking) rate *= SNEAK_FACTOR;
        if (player.inShadow) rate *= SHADOW_FACTOR;
        guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
        guard.loseTimer = 0;
      } else {
        guard.suspicion = Math.max(0, guard.suspicion - GUARD.decay * dt);
        guard.loseTimer += dt;
      }
      // Footfalls carry: a walking intruder close by is heard, a sneaking one is not.
      if (player.moving && !player.sneaking) {
        const d = Math.hypot(player.x - guard.x, player.y - guard.y);
        if (d < PLAYER.noiseRadius && lineOfSightClear(guard.x, guard.y, player.x, player.y, state.solids)) {
          guard.suspicion = Math.min(1, guard.suspicion + 0.55 * dt);
          if (guard.suspicion > 0.3) { guard.lastSeenX = player.x; guard.lastSeenY = player.y; }
        }
      }
      if (guard.suspicion >= 1 && !guard.alerted) {
        guard.alerted = true;
        guard.mode = GUARD_CHASE;
        state.detections += 1;
        events |= EVENT_ALERT;
      }
      if (guard.alerted && guard.suspicion < 0.35) guard.alerted = false;
    }

    if (guard.mode === GUARD_CHASE) {
      const tx = sees > 0 ? player.x : guard.lastSeenX;
      const ty = sees > 0 ? player.y : guard.lastSeenY;
      guardWalk(guard, tx, ty, GUARD.chaseSpeed, dt);
      if (guard.loseTimer > GUARD.loseSightAfter) {
        guard.mode = GUARD_SEARCH;
        guard.searchTimer = GUARD.searchSeconds;
        guard.scanBase = guard.angle;
      }
    } else if (guard.mode === GUARD_SEARCH) {
      guard.scanPhase += dt * 1.7;
      guard.angle = guard.scanBase + Math.sin(guard.scanPhase) * 1.1;
      guard.searchTimer -= dt;
      if (sees > 0 && guard.suspicion >= 1) guard.mode = GUARD_CHASE;
      else if (guard.searchTimer <= 0) {
        guard.mode = GUARD_RETURN;
        guard.waypoint = nearestWaypoint(guard);
      }
    } else if (guard.mode === GUARD_INVESTIGATE) {
      if (guardWalk(guard, guard.targetX, guard.targetY, GUARD.investigateSpeed, dt)) {
        guard.mode = GUARD_SEARCH;
        guard.searchTimer = 1.7;
        guard.scanBase = guard.angle;
      }
      if (guard.suspicion >= GUARD.suspiciousAt && sees > 0) guard.mode = GUARD_STARE;
    } else if (guard.mode === GUARD_RETURN) {
      const wp = guard.path[guard.waypoint];
      if (guardWalk(guard, wp[0], wp[1], GUARD.patrolSpeed, dt)) {
        guard.waypoint = (guard.waypoint + 1) % guard.path.length;
        guard.mode = GUARD_PATROL;
        guard.pauseTimer = guard.pause * 0.6;
        guard.scanBase = guard.angle;
      }
    } else if (!harmless && guard.suspicion >= GUARD.suspiciousAt) {
      // Suspicious: stop, stare toward the glimpse, and let it fade or bloom.
      guard.mode = GUARD_STARE;
      const bearing = Math.atan2(guard.lastSeenY - guard.y, guard.lastSeenX - guard.x);
      guard.angle = turnToward(guard.angle, bearing, GUARD.turnSpeed * 1.4 * dt);
      if (guard.suspicion < GUARD.suspiciousAt - 0.12) guard.mode = GUARD_PATROL;
    } else {
      guard.mode = GUARD_PATROL;
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.scanPhase += dt * 1.15;
        guard.angle = guard.scanBase + Math.sin(guard.scanPhase) * GUARD.scanSweep;
      } else {
        const wp = guard.path[guard.waypoint];
        if (guardWalk(guard, wp[0], wp[1], GUARD.patrolSpeed, dt)) {
          guard.waypoint = (guard.waypoint + 1) % guard.path.length;
          guard.pauseTimer = guard.pause;
          guard.scanBase = guard.angle;
        }
      }
    }

    if (guard.stepAcc > 52) {
      guard.stepAcc = 0;
      events |= EVENT_GUARD_STEP;
      const d = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (state.nearestGuardStep < 0 || d < state.nearestGuardStep) state.nearestGuardStep = d;
    }
    return events;
  }

  function throwPebble(tx, ty) {
    const player = state.player;
    if (state.pebblesLeft <= 0 || state.pebbleCooldown > 0 || state.pebble.active) return;
    let dx = tx - player.x;
    let dy = ty - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PEBBLE.maxThrow) {
      dx = (dx / dist) * PEBBLE.maxThrow;
      dy = (dy / dist) * PEBBLE.maxThrow;
    }
    state.pebble.active = true;
    state.pebble.fromX = player.x;
    state.pebble.fromY = player.y;
    state.pebble.toX = player.x + dx;
    state.pebble.toY = player.y + dy;
    state.pebble.t = 0;
    state.pebblesLeft -= 1;
    state.pebbleCooldown = PEBBLE.cooldown;
  }

  /**
   * One fixed tick. `input` is { moveX, moveY, sneak, throwAt } where throwAt
   * is null or { x, y } in stage coordinates. With `harmless` set (the title
   * backdrop) watchmen patrol but nobody can be seen or caught.
   */
  function step(dt, input, harmless) {
    let events = 0;
    const player = state.player;
    state.time += dt;
    state.levelTime += dt;
    state.nearestGuardStep = -1;
    if (state.pebbleCooldown > 0) state.pebbleCooldown -= dt;
    if (state.pebble.landTimer > 0) state.pebble.landTimer -= dt;

    // The intruder.
    player.sneaking = Boolean(input.sneak);
    const len = Math.hypot(input.moveX, input.moveY);
    player.moving = len > 0.01;
    if (player.moving) {
      const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const ux = input.moveX / Math.max(1, len);
      const uy = input.moveY / Math.max(1, len);
      const beforeX = player.x;
      const beforeY = player.y;
      moveCircle(player, PLAYER.radius, ux * speed * dt, uy * speed * dt);
      player.angle = Math.atan2(uy, ux);
      player.stepAcc += Math.hypot(player.x - beforeX, player.y - beforeY);
      const stride = player.sneaking ? 64 : 46;
      if (player.stepAcc > stride) {
        player.stepAcc = 0;
        events |= EVENT_STEP;
      }
    }
    player.inShadow = inShadow(player.x, player.y);

    if (!harmless && input.throwAt) throwPebble(input.throwAt.x, input.throwAt.y);

    // The pebble in flight, then the clatter that turns heads.
    const pebble = state.pebble;
    if (pebble.active) {
      pebble.t += dt / PEBBLE.flightSeconds;
      if (pebble.t >= 1) {
        pebble.active = false;
        pebble.landX = pebble.toX;
        pebble.landY = pebble.toY;
        pebble.landTimer = 0.9;
        events |= EVENT_PEBBLE;
        if (!harmless) {
          for (const guard of state.guards) {
            if (guard.mode === GUARD_CHASE) continue;
            const d = Math.hypot(pebble.landX - guard.x, pebble.landY - guard.y);
            if (d < PEBBLE.noiseRadius) {
              guard.mode = GUARD_INVESTIGATE;
              guard.targetX = pebble.landX;
              guard.targetY = pebble.landY;
              guard.suspicion = Math.max(guard.suspicion, 0.3);
            }
          }
        }
      } else {
        pebble.x = pebble.fromX + (pebble.toX - pebble.fromX) * pebble.t;
        pebble.y = pebble.fromY + (pebble.toY - pebble.fromY) * pebble.t;
      }
    }

    // The watchmen.
    let detection = 0;
    for (const guard of state.guards) {
      events |= updateGuard(guard, dt, harmless);
      if (guard.suspicion > detection) detection = guard.suspicion;
      if (!harmless && Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchDistance) {
        state.caughtBy = guard.index;
        events |= EVENT_CAUGHT;
      }
    }
    state.detection = detection;

    if (!harmless) {
      const orchid = state.level.orchid;
      if (!state.hasOrchid && Math.hypot(player.x - orchid.x, player.y - orchid.y) < 28) {
        state.hasOrchid = true;
        events |= EVENT_PICKUP;
      }
      if (pointInRect(player.x, player.y, state.level.exit)) {
        events |= state.hasOrchid ? EVENT_COMPLETE : EVENT_LOCKED;
      }
    }
    return events;
  }

  loadLevel(0);
  return { state, reset, retryLevel, nextLevel, isLastLevel, step };
}
