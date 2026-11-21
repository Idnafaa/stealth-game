// Glasshouse Ghost — every tuning number and colour lives here so the rest of
// the game can stay about rules and drawing. The playfield is a fixed
// 1280x720 logical stage; the renderer letterboxes it into the window.

export const FIELD = { width: 1280, height: 720, wall: 24 };

/** Fixed simulation step: 60 updates a second, whatever the display does. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 178,
  sneakSpeed: 92,
  noiseRadius: 96, // walking this close to a watchman is heard; sneaking is silent
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 78,
  investigateSpeed: 106,
  chaseSpeed: 170,
  viewRange: 252,
  viewHalfAngle: 0.56, // radians, about 32 degrees each way
  fillNear: 1.25, // suspicion gained per second at arm's length
  fillFar: 0.34, // suspicion gained per second at the edge of the lantern light
  decay: 0.5, // suspicion lost per second while the intruder stays unseen
  suspiciousAt: 0.45, // from here the watchman stops and stares
  loseSightAfter: 2.2, // seconds of chase without a sighting before searching
  searchSeconds: 2.6,
  catchDistance: 31,
  turnSpeed: 2.6, // radians per second while scanning
  scanSweep: 0.7, // how far the lantern swings while standing at a waypoint
};

export const PEBBLE = {
  count: 5,
  maxThrow: 340,
  flightSeconds: 0.45,
  noiseRadius: 272,
  cooldown: 0.5,
};

export const SHADOW_FACTOR = 0.34; // detection fills this fast inside fern shade
export const SNEAK_FACTOR = 0.42; // detection fills this fast while sneaking

export const PALETTE = {
  backdrop: '#0a0f14',
  floor: '#22362e',
  floorTile: '#2a4438',
  wall: '#3d4a42',
  wallEdge: '#5a6d60',
  crate: '#7a5c33',
  crateEdge: '#9c7a47',
  planter: '#2e5d3a',
  planterEdge: '#57a06b',
  shadow: 'rgba(4, 10, 8, 0.55)',
  player: '#f4efe0',
  playerHood: '#a8d8c4',
  guard: '#d8b25c',
  guardCoat: '#5c4a2e',
  cone: 'rgba(255, 214, 120, 0.20)',
  coneSuspicious: 'rgba(255, 170, 60, 0.30)',
  coneAlert: 'rgba(255, 90, 70, 0.34)',
  orchid: '#f2a7d8',
  exit: '#7fd4a8',
  exitLocked: '#5c6b62',
  panel: 'rgba(10, 18, 16, 0.92)',
  text: '#eef3ec',
  muted: '#9db3a6',
  danger: '#ff7a5c',
};

export const FONT = 'Georgia, "Times New Roman", serif';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const BEST_KEY = 'glasshouse-ghost.best';
