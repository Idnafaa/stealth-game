// Hands on the glass: WASD or arrows to move, Shift to sneak, mouse to aim a
// pebble and click to throw it. One-shot presses (confirm, pause, restart,
// mute) are queued as bit flags and taken once by the loop, so a tap between
// two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas, toStage) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  let actions = 0;
  let throwTarget = null;
  let clickPoint = null;
  const mouse = { x: 0, y: 0, seen: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SNEAK.has(event.code)) held.sneak = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SNEAK.has(event.code)) held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of all.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.sneak = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = toStage(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.seen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toStage(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.seen = true;
    clickPoint = { x: point.x, y: point.y };
    throwTarget = { x: point.x, y: point.y };
  });

  return {
    /** Movement wish: each axis -1, 0 or 1. */
    move() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    sneaking() {
      return held.sneak;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Where the player clicked to throw, once, or null. */
    takeThrow() {
      const taken = throwTarget;
      throwTarget = null;
      return taken;
    },
    /** The last click anywhere (menus treat it as confirm), once, or null. */
    takeClick() {
      const taken = clickPoint;
      clickPoint = null;
      return taken;
    },
    mouse,
  };
}
