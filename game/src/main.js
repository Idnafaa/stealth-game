// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// play, paused, caught, wing clear, and the final escape.
//
// ?seed=N fixes the watchmen's scan phases. ?shot=title|cover|alert|vault
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALERT,
  EVENT_CAUGHT,
  EVENT_COMPLETE,
  EVENT_GUARD_STEP,
  EVENT_LOCKED,
  EVENT_PEBBLE,
  EVENT_PICKUP,
  EVENT_STEP,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import {
  createRenderer,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const IDLE = { moveX: 0, moveY: 0, sneak: false, throwAt: null };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const extras = { best: scene.best, mouse: scene.mouse, hint: '', muted: false, screen: scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, extras);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toStage);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let hint = '';
  let hintTimer = 0;
  let lockedCooldown = 0;
  let wasSuspicious = false;

  function announce(message) {
    status.textContent = message;
  }

  function extras() {
    return { best, mouse: input.mouse, hint, muted: audio.isMuted(), screen };
  }

  function startRun() {
    world.reset();
    accumulator = 0;
    hint = '';
    wasSuspicious = false;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.ui();
    announce('Fern Hall. Take the Moon Orchid and reach the exit unseen.');
  }

  function handleEvents(events) {
    const state = world.state;
    if (events & EVENT_STEP) audio.step(state.player.sneaking);
    if (events & EVENT_GUARD_STEP && state.nearestGuardStep >= 0) audio.guardStep(state.nearestGuardStep);
    if (events & EVENT_PEBBLE) audio.pebbleLand();
    if (events & EVENT_PICKUP) {
      audio.pickup();
      hint = 'Orchid taken — now reach the EXIT.';
      hintTimer = 2.4;
      announce('Orchid taken. Reach the exit.');
    }
    if (events & EVENT_ALERT) {
      audio.alert();
      announce('Spotted! Break their line of sight.');
    }
    const suspiciousNow = state.detection >= 0.45 && state.detection < 1;
    if (suspiciousNow && !wasSuspicious) audio.suspicious();
    wasSuspicious = suspiciousNow;
    if (events & EVENT_LOCKED) {
      hint = 'The orchid first — the door stays locked.';
      hintTimer = 1.6;
      if (lockedCooldown <= 0) {
        audio.locked();
        lockedCooldown = 0.9;
      }
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      screen = SCREEN_CAUGHT;
      announce('Caught. Press R to try this wing again.');
      return;
    }
    if (events & EVENT_COMPLETE) {
      if (world.isLastLevel()) {
        screen = SCREEN_WIN;
        const seconds = Math.floor(state.time);
        if (best === 0 || seconds < best) {
          best = seconds;
          saveBest(best);
        }
        audio.clear();
        announce('Escaped with the orchid. Press Space to play again.');
      } else {
        screen = SCREEN_CLEAR;
        audio.door();
        announce(state.level.name + ' clear. Press Space for the next wing.');
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    const confirmed = (actions & ACTION_CONFIRM) !== 0 || (click !== null && screen !== SCREEN_PLAY);
    if (screen === SCREEN_TITLE && confirmed) startRun();
    else if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && ((actions & ACTION_PAUSE) || confirmed)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (screen === SCREEN_PLAY && (actions & ACTION_RESTART)) {
      world.retryLevel();
      hint = '';
      announce('Wing restarted.');
    } else if (screen === SCREEN_CAUGHT && (confirmed || (actions & ACTION_RESTART))) {
      world.retryLevel();
      screen = SCREEN_PLAY;
      hint = '';
      announce('Try again. Stay out of the lantern light.');
    } else if (screen === SCREEN_CLEAR && confirmed) {
      world.nextLevel();
      screen = SCREEN_PLAY;
      hint = '';
      announce(world.state.level.name + '. ' + world.state.level.brief);
    } else if (screen === SCREEN_WIN && confirmed) startRun();
    // A click during play is a pebble throw, already queued by the input.
    if (screen !== SCREEN_PLAY) input.takeThrow();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, IDLE, true);
      return;
    }
    const move = input.move();
    const throwAt = input.takeThrow();
    if (throwAt) audio.throwPebble();
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      sneak: input.sneaking(),
      throwAt,
    }, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameSeconds = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (hintTimer > 0) {
      hintTimer -= frameSeconds;
      if (hintTimer <= 0) hint = '';
    }
    if (lockedCooldown > 0) lockedCooldown -= frameSeconds;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += frameSeconds;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, extras());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Glasshouse Ghost. Press Space or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
