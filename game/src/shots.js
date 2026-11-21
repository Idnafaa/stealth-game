// The staged scenes behind ?shot=title|cover|alert|vault. Each one puts the
// real world into a moment a short game genuinely reaches — a patrol mid-
// round, a stare half-filled, a chase — then lets the rules settle it for a
// few ticks, so the frame is the game's own render and the same seed always
// gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, sneak: false, throwAt: null };

function settle(world, ticks) {
  for (let i = 0; i < ticks; i += 1) world.step(STEP, IDLE, false);
}

function placeGuard(guard, x, y, angle, mode, suspicion) {
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.scanBase = angle;
  guard.scanPhase = 0;
  guard.mode = mode;
  guard.suspicion = suspicion;
  guard.alerted = mode === 'chase';
  guard.pauseTimer = 99;
  guard.loseTimer = 0;
  guard.lastSeenX = x + Math.cos(angle) * 100;
  guard.lastSeenY = y + Math.sin(angle) * 100;
}

function placePlayer(world, x, y, angle, sneaking) {
  const player = world.state.player;
  player.x = x;
  player.y = y;
  player.angle = angle;
  player.sneaking = sneaking;
}

/**
 * Set `world` to the named scene and return the screen to draw, the best
 * time to show, and where the mouse rests (so the pebble aim shows).
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'cover') {
    // Fern Hall, mid-sneak: caught in the edge of a lantern, eye half full.
    placePlayer(world, 640, 600, 0, true);
    placeGuard(state.guards[0], 520, 560, 0.15, 'stare', 0.55);
    state.guards[0].lastSeenX = 640;
    state.guards[0].lastSeenY = 600;
    placeGuard(state.guards[1], 1150, 380, Math.PI / 2, 'patrol', 0);
    settle(world, 6);
    return { screen: SCREEN_PLAY, best: 0, mouse: { x: 800, y: 600, seen: true } };
  }
  if (name === 'alert') {
    // Palm Court, spotted: orchid in the satchel, one lantern in full chase.
    world.nextLevel();
    state.hasOrchid = true;
    state.time = 74;
    placePlayer(world, 530, 380, Math.PI, false);
    placeGuard(state.guards[0], 730, 380, Math.PI, 'chase', 1);
    state.guards[0].lastSeenX = 530;
    state.guards[0].lastSeenY = 380;
    placeGuard(state.guards[1], 640, 140, 0, 'patrol', 0.2);
    placeGuard(state.guards[2], 500, 580, 0, 'patrol', 0);
    settle(world, 4);
    return { screen: SCREEN_PLAY, best: 0, mouse: { x: 420, y: 380, seen: true } };
  }
  if (name === 'vault') {
    // Orchid Vault: hidden in the fern shade at the island's heart.
    world.nextLevel();
    world.nextLevel();
    state.time = 152;
    placePlayer(world, 588, 330, 0, true);
    placeGuard(state.guards[0], 810, 330, Math.PI, 'patrol', 0.25);
    placeGuard(state.guards[1], 150, 330, Math.PI / 2, 'patrol', 0);
    placeGuard(state.guards[2], 1130, 330, -Math.PI / 2, 'patrol', 0);
    placeGuard(state.guards[3], 640, 80, 0, 'patrol', 0);
    settle(world, 4);
    return { screen: SCREEN_PLAY, best: 0, mouse: { x: 760, y: 330, seen: true } };
  }
  // Title: the first wing at rest, watchmen walking their rounds behind it.
  for (let i = 0; i < 240; i += 1) world.step(STEP, IDLE, true);
  return { screen: SCREEN_TITLE, best: 0, mouse: { x: 0, y: 0, seen: false } };
}
