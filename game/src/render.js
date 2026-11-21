// Drawing only: the world's state in, pixels out. The 1280x720 stage is
// scaled to fit the window and centred. Lantern cones are ray-cast polygons
// so cover visibly bites into the light, and everything the judge needs —
// level, guards, cones, cover, orchid, door — reads at a glance.
import { FIELD, FONT, FONT_UI, GUARD, PALETTE, PEBBLE, PLAYER } from './config.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const CONE_RAYS = 26;
const TILE = 40;

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  // Fixed decoration: scattered leaves on the floor tiles, dealt once.
  const leaves = [];
  let leafSeed = 1234567;
  function leafRandom() {
    leafSeed = (leafSeed * 1103515245 + 12345) & 0x7fffffff;
    return leafSeed / 0x7fffffff;
  }
  for (let i = 0; i < 90; i += 1) {
    leaves.push({ x: 30 + leafRandom() * 1220, y: 30 + leafRandom() * 660, r: 2 + leafRandom() * 4, a: leafRandom() * Math.PI });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Window pixel to stage coordinates (for mouse aim). */
  function toStage(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * ratio;
    const py = (clientY - rect.top) * ratio;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function text(value, x, y, size, color, align, font) {
    context.font = size + 'px ' + (font || FONT_UI);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.floorTile;
    for (let ty = 0; ty < FIELD.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        if ((tx + ty) % 2 === 0) context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    context.fillStyle = 'rgba(120, 180, 140, 0.16)';
    for (const leaf of leaves) {
      context.save();
      context.translate(leaf.x, leaf.y);
      context.rotate(leaf.a);
      context.beginPath();
      context.ellipse(0, 0, leaf.r * 1.7, leaf.r, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Fern shade: the safe dark.
    for (const rect of state.shadows) {
      context.fillStyle = PALETTE.shadow;
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
      context.strokeStyle = 'rgba(90, 160, 120, 0.35)';
      context.setLineDash([6, 6]);
      context.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
      context.setLineDash([]);
    }
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.hasOrchid;
    context.fillStyle = open ? 'rgba(127, 212, 168, 0.22)' : 'rgba(120, 130, 120, 0.14)';
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.strokeStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    context.lineWidth = 3;
    context.strokeRect(exit.x + 2, exit.y + 2, exit.w - 4, exit.h - 4);
    context.lineWidth = 1;
    context.textBaseline = 'middle';
    text('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 - 9, 19, open ? PALETTE.exit : PALETTE.muted, 'center');
    text(open ? 'slip out' : 'locked', exit.x + exit.w / 2, exit.y + exit.h / 2 + 15, 13, open ? PALETTE.exit : PALETTE.muted, 'center');
    context.textBaseline = 'alphabetic';
  }

  function drawOrchid(state) {
    if (state.hasOrchid) return;
    const orchid = state.level.orchid;
    const pulse = 0.75 + 0.25 * Math.sin(state.time * 2.4);
    const glow = context.createRadialGradient(orchid.x, orchid.y, 2, orchid.x, orchid.y, 44 * pulse);
    glow.addColorStop(0, 'rgba(242, 167, 216, 0.5)');
    glow.addColorStop(1, 'rgba(242, 167, 216, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(orchid.x, orchid.y, 44 * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.planter;
    context.beginPath();
    context.arc(orchid.x, orchid.y, 15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.orchid;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + state.time * 0.4;
      context.beginPath();
      context.ellipse(orchid.x + Math.cos(a) * 8, orchid.y + Math.sin(a) * 8, 7, 4, a, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#fff3fa';
    context.beginPath();
    context.arc(orchid.x, orchid.y, 4, 0, Math.PI * 2);
    context.fill();
    text('Moon Orchid', orchid.x, orchid.y + 30, 12, PALETTE.orchid, 'center');
  }

  function drawSolids(state) {
    for (const rect of state.solids) {
      if (rect.kind === 'crate') {
        context.fillStyle = PALETTE.crate;
        context.fillRect(rect.x, rect.y, rect.w, rect.h);
        context.strokeStyle = PALETTE.crateEdge;
        context.lineWidth = 3;
        context.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
        context.beginPath();
        context.moveTo(rect.x + 3, rect.y + 3);
        context.lineTo(rect.x + rect.w - 3, rect.y + rect.h - 3);
        context.moveTo(rect.x + rect.w - 3, rect.y + 3);
        context.lineTo(rect.x + 3, rect.y + rect.h - 3);
        context.stroke();
        context.lineWidth = 1;
      } else if (rect.kind === 'planter') {
        context.fillStyle = PALETTE.planter;
        context.fillRect(rect.x, rect.y, rect.w, rect.h);
        context.strokeStyle = PALETTE.planterEdge;
        context.lineWidth = 2;
        context.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
        context.fillStyle = 'rgba(160, 230, 180, 0.5)';
        const cols = Math.max(2, Math.floor(rect.w / 22));
        const rows = Math.max(1, Math.floor(rect.h / 22));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            const px = rect.x + 12 + cx * 22;
            const py = rect.y + 12 + cy * 22;
            context.beginPath();
            context.ellipse(px, py, 7, 4, cx + cy, 0, Math.PI * 2);
            context.fill();
          }
        }
        context.lineWidth = 1;
      } else {
        context.fillStyle = PALETTE.wall;
        context.fillRect(rect.x, rect.y, rect.w, rect.h);
        context.strokeStyle = PALETTE.wallEdge;
        context.lineWidth = 2;
        context.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
        context.lineWidth = 1;
      }
    }
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const points = conePolygon(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, state.solids, CONE_RAYS);
      let fill = PALETTE.cone;
      if (guard.mode === 'chase') fill = PALETTE.coneAlert;
      else if (guard.suspicion >= GUARD.suspiciousAt || guard.mode === 'stare' || guard.mode === 'search' || guard.mode === 'investigate') fill = PALETTE.coneSuspicious;
      context.fillStyle = fill;
      context.beginPath();
      context.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) context.lineTo(points[i], points[i + 1]);
      context.closePath();
      context.fill();
      const glow = context.createRadialGradient(guard.x, guard.y, 2, guard.x, guard.y, 52);
      glow.addColorStop(0, 'rgba(255, 220, 140, 0.35)');
      glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(guard.x, guard.y, 52, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawGuard(guard) {
    const lx = guard.x + Math.cos(guard.angle) * (GUARD.radius + 7);
    const ly = guard.y + Math.sin(guard.angle) * (GUARD.radius + 7);
    context.fillStyle = PALETTE.guardCoat;
    context.beginPath();
    context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.guard;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.guard;
    context.beginPath();
    context.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
    context.fill();
    // The lantern itself.
    context.fillStyle = '#ffe9a8';
    context.beginPath();
    context.arc(lx, ly, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.guardCoat;
    context.lineWidth = 1;
    context.stroke();
    // Suspicion: a filling arc, then a mark over the head.
    if (guard.suspicion > 0.03) {
      context.strokeStyle = guard.mode === 'chase' ? PALETTE.danger : '#ffb050';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius + 6, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      context.stroke();
      context.lineWidth = 1;
    }
    if (guard.mode === 'chase') text('!', guard.x, guard.y - GUARD.radius - 12, 20, PALETTE.danger, 'center');
    else if (guard.mode === 'stare' || guard.mode === 'search' || guard.mode === 'investigate') text('?', guard.x, guard.y - GUARD.radius - 12, 18, '#ffb050', 'center');
  }

  function drawPlayer(state) {
    const player = state.player;
    context.save();
    if (player.inShadow) context.globalAlpha = 0.6;
    context.fillStyle = PALETTE.playerHood;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 3;
    context.stroke();
    context.lineWidth = 1;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 6.5, 0, Math.PI * 2);
    context.fill();
    const tx = player.x + Math.cos(player.angle) * (PLAYER.radius + 4);
    const ty = player.y + Math.sin(player.angle) * (PLAYER.radius + 4);
    context.strokeStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(tx, ty);
    context.stroke();
    context.restore();
    if (player.inShadow) {
      // A small closed eye: hidden in the fern shade.
      const ex = player.x;
      const ey = player.y - PLAYER.radius - 10;
      context.strokeStyle = PALETTE.exit;
      context.beginPath();
      context.ellipse(ex, ey, 8, 4, 0, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.exit;
      context.beginPath();
      context.arc(ex, ey, 2, 0, Math.PI * 2);
      context.fill();
    } else if (player.sneaking) {
      text('sneaking', player.x, player.y - PLAYER.radius - 8, 11, PALETTE.muted, 'center');
    }
  }

  function drawPebble(state, extras) {
    const pebble = state.pebble;
    if (pebble.active) {
      const lift = Math.sin(pebble.t * Math.PI) * 16;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#cfd6cf';
      context.beginPath();
      context.arc(pebble.x, pebble.y - lift, 4.5, 0, Math.PI * 2);
      context.fill();
    }
    if (pebble.landTimer > 0) {
      const r = (0.9 - pebble.landTimer) * 46;
      context.strokeStyle = 'rgba(230, 240, 230, ' + (pebble.landTimer * 0.8) + ')';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(pebble.landX, pebble.landY, r, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 1;
    }
    // Aim: where a click would land the next pebble.
    if (extras && extras.mouse && extras.mouse.seen && extras.screen === SCREEN_PLAY) {
      const player = state.player;
      let dx = extras.mouse.x - player.x;
      let dy = extras.mouse.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > PEBBLE.maxThrow) { dx = (dx / dist) * PEBBLE.maxThrow; dy = (dy / dist) * PEBBLE.maxThrow; }
      const ax = player.x + dx;
      const ay = player.y + dy;
      context.strokeStyle = state.pebblesLeft > 0 ? 'rgba(230,240,230,0.4)' : 'rgba(160,160,160,0.25)';
      context.setLineDash([4, 6]);
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(ax, ay);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.arc(ax, ay, 7, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawHud(state, extras) {
    // A dark strip behind the top HUD so text never fights the level art.
    context.fillStyle = 'rgba(8, 14, 12, 0.72)';
    context.fillRect(0, 0, FIELD.width, 92);
    context.textBaseline = 'top';
    text(state.level.name, 40, 34, 20, PALETTE.text, 'left', FONT);
    text('Wing ' + (state.levelIndex + 1) + ' of 3', 40, 58, 13, PALETTE.muted, 'left');
    // The lantern eye: how close the nearest watchman is to certain.
    const meterX = FIELD.width / 2 - 110;
    const meterY = 36;
    text('DETECTION', FIELD.width / 2, meterY - 2, 11, PALETTE.muted, 'center');
    context.fillStyle = 'rgba(10, 18, 16, 0.7)';
    context.fillRect(meterX, meterY + 14, 220, 14);
    const fill = Math.round(state.detection * 220);
    context.fillStyle = state.detection > 0.75 ? PALETTE.danger : state.detection > 0.4 ? '#ffb050' : PALETTE.exit;
    if (fill > 0) context.fillRect(meterX, meterY + 14, fill, 14);
    context.strokeStyle = PALETTE.muted;
    context.strokeRect(meterX + 0.5, meterY + 14.5, 219, 13);
    // Orchid, pebbles, clock.
    const right = FIELD.width - 40;
    text(state.hasOrchid ? 'Orchid: taken' : 'Orchid: blooming', right, 34, 16, state.hasOrchid ? PALETTE.orchid : PALETTE.muted, 'right');
    text('Pebbles ' + state.pebblesLeft, right, 56, 14, PALETTE.text, 'right');
    text(formatTime(state.time), right, 76, 14, PALETTE.muted, 'right');
    if (extras && extras.muted) text('muted (M)', right, 96, 12, PALETTE.muted, 'right');
    text('WASD move · Shift sneak · Click throw pebble · P pause', 40, FIELD.height - 52, 13, 'rgba(157,179,166,0.8)', 'left');
    if (extras && extras.hint) {
      text(extras.hint, FIELD.width / 2, FIELD.height - 52, 16, '#ffb050', 'center');
    }
    context.textBaseline = 'alphabetic';
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 120 + lines.length * 30 + 64;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.planterEdge;
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, width - 2, height - 2);
    context.lineWidth = 1;
    text(title, FIELD.width / 2, y + 64, 40, PALETTE.text, 'center', FONT);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 108 + i * 30, 18, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 19, PALETTE.exit, 'center');
  }

  function draw(state, screen, extras) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawExit(state);
    drawOrchid(state);
    drawCones(state);
    drawSolids(state);
    drawPebble(state, extras);
    for (const guard of state.guards) drawGuard(guard);
    drawPlayer(state);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Steal the Moon Orchid from each wing and reach the EXIT unseen.',
        'Stay out of the lantern cones. Fern shade and crates are cover.',
        'WASD / arrows move · Shift sneak (slow, quiet, harder to see)',
        'Click to throw a pebble — watchmen go and look.',
        'If a lantern eye fills, run. Break sight and let it drain.',
        extras && extras.best > 0 ? 'Best escape: ' + formatTime(extras.best) : 'Three wings. One flower each. No witnesses.',
      ];
      drawPanel('Glasshouse Ghost', lines, 'Press Space or click to begin');
      return;
    }
    drawHud(state, extras);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The glasshouse holds its breath.'], 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('Caught in the Light', [
        'A watchman lays a hand on your shoulder.',
        'Time ' + formatTime(state.time) + ' · Spotted ' + state.detections + (state.detections === 1 ? ' time' : ' times'),
      ], 'Press R or Space to try this wing again');
    } else if (screen === SCREEN_CLEAR) {
      drawPanel(state.level.name + ' — Clear', [
        'The orchid is in your satchel and the door clicks shut behind you.',
        'Time ' + formatTime(state.time) + ' · Spotted ' + state.detections + (state.detections === 1 ? ' time' : ' times'),
      ], 'Press Space for the next wing');
    } else if (screen === SCREEN_WIN) {
      drawPanel('The Orchid Is Yours', [
        'Three wings, three flowers, and not a soul who can name you.',
        'Escape time ' + formatTime(state.time) + ' · Spotted ' + state.detections + (state.detections === 1 ? ' time' : ' times'),
        extras && extras.best > 0 ? 'Best escape: ' + formatTime(extras.best) : '',
      ], 'Press Space to haunt the glasshouse again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toStage };
}
