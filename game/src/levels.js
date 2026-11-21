// The three wings of the glasshouse. Each level is plain data: solid cover
// (walls, crates, planters), fern-shade rectangles where detection crawls,
// watchman patrol loops, where the intruder slips in, where the Moon Orchid
// blooms, and the service door out. Coordinates are on the 1280x720 stage;
// the outer wall ring is added by the world, not listed here.

function wall(x, y, w, h) { return { x, y, w, h, kind: 'wall' }; }
function crate(x, y, w, h) { return { x, y, w, h, kind: 'crate' }; }
function planter(x, y, w, h) { return { x, y, w, h, kind: 'planter' }; }
function shade(x, y, w, h) { return { x, y, w, h }; }
function watchman(path, pause) { return { path, pause }; }

export const LEVELS = [
  {
    name: 'Fern Hall',
    brief: 'Two watchmen. Learn their rounds, take the orchid, slip out east.',
    pebbles: 5,
    start: { x: 96, y: 624 },
    orchid: { x: 112, y: 112 },
    exit: { x: 1172, y: 556, w: 84, h: 112 },
    solids: [
      wall(628, 24, 24, 446),
      wall(652, 330, 348, 24),
      wall(170, 520, 24, 176),
      planter(330, 300, 150, 44),
      planter(760, 180, 150, 44),
      planter(980, 470, 150, 44),
      crate(380, 180, 70, 70),
      crate(380, 460, 70, 70),
      crate(820, 520, 70, 70),
      crate(1058, 180, 64, 64),
    ],
    shadows: [
      shade(56, 56, 210, 110),
      shade(90, 540, 200, 110),
      shade(700, 560, 200, 100),
      shade(1010, 56, 210, 110),
    ],
    guards: [
      watchman([[230, 150], [520, 150], [520, 560], [230, 560]], 1.4),
      watchman([[1150, 150], [1150, 580]], 1.6),
    ],
  },
  {
    name: 'Palm Court',
    brief: 'An S of corridors and three lanterns. The orchid sleeps north-east.',
    pebbles: 5,
    start: { x: 96, y: 624 },
    orchid: { x: 1152, y: 110 },
    exit: { x: 40, y: 150, w: 112, h: 84 },
    solids: [
      wall(24, 250, 796, 24),
      wall(460, 470, 796, 24),
      wall(170, 560, 24, 136),
      planter(420, 404, 140, 40),
      planter(180, 180, 150, 40),
      planter(820, 514, 140, 40),
      crate(700, 296, 64, 56),
      crate(560, 56, 70, 56),
      crate(560, 610, 70, 56),
      crate(180, 300, 64, 56),
      crate(1040, 404, 64, 56),
    ],
    shadows: [
      shade(56, 520, 200, 110),
      shade(1020, 40, 210, 100),
      shade(56, 140, 210, 90),
      shade(560, 300, 190, 90),
    ],
    guards: [
      watchman([[200, 380], [1080, 380]], 1.2),
      watchman([[300, 140], [980, 140]], 1.4),
      watchman([[300, 580], [980, 580]], 1.2),
    ],
  },
  {
    name: 'Orchid Vault',
    brief: 'Four lanterns around one flower. Patience, shade, and pebbles.',
    pebbles: 6,
    start: { x: 640, y: 640 },
    orchid: { x: 640, y: 330 },
    exit: { x: 1150, y: 150, w: 90, h: 90 },
    solids: [
      wall(300, 24, 24, 446),
      wall(956, 250, 24, 446),
      crate(540, 250, 64, 64),
      crate(676, 250, 64, 64),
      crate(540, 346, 64, 64),
      crate(676, 346, 64, 64),
      planter(170, 330, 110, 40),
      planter(1000, 330, 110, 40),
      planter(420, 120, 120, 40),
      planter(520, 540, 240, 36),
      planter(790, 560, 120, 40),
      crate(380, 600, 64, 64),
      crate(830, 140, 64, 64),
    ],
    shadows: [
      shade(56, 56, 190, 100),
      shade(1030, 556, 190, 100),
      shade(370, 556, 190, 100),
      shade(720, 150, 180, 84),
      shade(560, 286, 160, 88),
    ],
    guards: [
      watchman([[470, 180], [810, 180], [810, 480], [470, 480]], 1.1),
      watchman([[150, 150], [150, 560]], 1.3),
      watchman([[1130, 150], [1130, 560]], 1.3),
      watchman([[400, 80], [880, 80]], 1.2),
    ],
  },
];
