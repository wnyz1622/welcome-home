// Shared configuration for viewer + controller.
// Everything that both pages need to agree on lives here.

export const CHANNEL_NAME = 'whnvr-liminal-landing';
export const STORAGE_KEY = 'whnvr-liminal-landing/state-v2';

// All automatic motion is built from periodic functions whose frequencies are
// whole multiples of this loop, so a recording of exactly LOOP_SECONDS loops
// seamlessly (as long as rotation / drift / bird speeds are whole numbers).
export const LOOP_SECONDS = 120;

export const MAX_HOUSES = 12;   // per main island
export const MAX_BIRDS = 20;
export const MAX_CLOUDS = 16;

// World layout (same coordinate system the camera presets use).
// x runs from New York (left) to Taiwan (right); y is up; +z faces the
// default camera.
export const WORLD = {
  ny: { center: [-17, 0, 0] },
  tw: { center: [17, 0, -2] },
  tzBlend: [-9, 9],   // x-range over which the two local times blend
};

// Exhibition palette + softened working colors derived from it.
export const C = {
  // exhibition colors
  blue: '#008ed8',
  red: '#ff0000',
  yellow: '#f3d600',
  green: '#58ab29',

  // ink + shadow (outlines, window frames, blue shadows)
  ink: '#1c3a9a',
  inkSoft: '#4a64b8',
  shadow: '#2f62dc',
  glassOff: '#1f47ae',

  // walls
  cream: '#f2e8d2',
  paper: '#f7f1e6',
  pink: '#f3b5a6',
  salmon: '#ec9585',
  tilePink: '#f4d8cf',
  tileMint: '#cfe7d2',
  tileBlue: '#d3def0',
  wallYellow: '#efe1a0',
  wallGreen: '#cfe5bf',
  brick: '#de4a3a',
  brickDeep: '#c4483d',
  limestone: '#e3d6c3',

  // roofs, streets + accents
  roofRed: '#ea2b1f',
  roofRedDeep: '#c8261c',
  roofBlue: '#1f50bf',
  skyBlue: '#3f8fd6',
  softYellow: '#f2dc6e',
  softGreen: '#8fc66c',
  leaf: '#6fb34d',
  tank: '#dfe4ea',
  wood: '#b9543b',
  blush: '#f6a9b4',
  asphalt: '#4a5788',
  sidewalk: '#e9e1d2',
  terracotta: '#cf6f4f',
};

// Background gradients (top, middle, bottom).
export const ATMOSPHERES = [
  { id: 'harbor', colors: ['#1858cf', '#2f8ec2', '#86cf9e'] },
  { id: 'dusk', colors: ['#1d56d6', '#b69ae4', '#ff4b3a'] },
  { id: 'between', colors: ['#0b74cf', '#f2a7b8', '#f3d66a'] },
  { id: 'lawn', colors: ['#5aa6e6', '#efe6d4', '#79c25a'] },
  { id: 'late', colors: ['#0d2c80', '#2a5fbf', '#e2675c'] },
  { id: 'twilight', colors: ['#24357f', '#c48bb8', '#f6b26b'] },
  { id: 'dawn', colors: ['#7fb3ea', '#f7d7c4', '#f3d98a'] },
  { id: 'henge', colors: ['#3a3f9e', '#ff8a5a', '#ffcf6b'] },
  { id: 'midnight', colors: ['#010102', '#05060b', '#0d1020'] },   // deep black sky
];

// Light at different hours. Each island's look is mixed from these by its
// local time (Taiwan's clock is the slider; New York runs 12 hours apart).
//   wash: how strongly the hour colors the sky on that side
export const TIMES = {
  day: {
    tint: '#ffffff', shadow: '#2f62dc', glow: '#fff1c4', wash: '#bfe0ff',
    cloud: '#ffffff', window: -0.3, washK: 0.1,
  },
  golden: {
    tint: '#ffb48e', shadow: '#5b3da3', glow: '#ff7b52', wash: '#f29ab4',
    cloud: '#ffc0aa', window: 0.2, washK: 1,
  },
  night: {
    tint: '#b8c4ff', shadow: '#24306e', glow: '#8ea6ff', wash: '#2a3a8a',
    cloud: '#9aa8d8', window: 0.6, washK: 0.9,
  },
};

// Sun height for an hour: 0 at 06:00 and 18:00, 1 at noon, -1 at midnight.
export const sunHeight = (h) => Math.sin(Math.PI * 2 * (h - 6) / 24);

export const STROKE_MODES = ['stroke', 'reduced', 'none'];

export const DEFAULT_STATE = Object.freeze({
  // motion
  autoAnimate: true,
  rotationSpeed: 1,      // turns per loop for each main island
  floatIntensity: 1,     // 0-1 floating, 1-5 displacement / scattering
  birdSpeed: 1,          // laps per loop (whole numbers loop seamlessly)

  // camera
  cameraPreset: 'overview',
  customView: null,      // a song's saved view (see presets.js); null = use cameraPreset
  cameraCue: 0,          // bumps every time a preset/scene is (re)activated
  zoom: 0.56,
  cameraAngle: 30,       // elevation (deg) for the current preset
  cameraOrbit: 0,        // extra azimuth (deg) on top of the preset
  autoOrbit: false,      // the camera keeps circling on its own (one turn a minute)
  panScreen: 0,          // camera pan left (−) / right (+), in screen widths
  cameraPanX: 0,         // shift of the look-at point, in the preset's frame
  cameraPanY: 0,
  cameraPanZ: 0,
  transition: 4,         // seconds
  tour: false,           // autonomous camera tour

  // world
  showMain: true,
  showSatellites: true,
  houseCount: 9,
  layoutSeed: 1,
  birdCount: 10,
  birdsVisible: true,
  airplane: true,

  // atmosphere
  bgTop: '#1858cf',
  bgMid: '#2f8ec2',
  bgBottom: '#86cf9e',
  timezone: 0.35,        // (unused now: New York is always 12 h from Taiwan)
  twHour: 7,             // Taiwan local time, 0-24 with minutes (New York = +12 h)
  autoTime: false,       // the clock keeps running from the set time (one hour every 10 min)
  darkness: 0.9,         // how dark night gets (1 = lights almost off)
  split: 0,
  rain: 0.6,             // rain over Taiwan, 0 = none
  snow: 0.6,             // snow over New York, 0 = none
  breatheOn: false,      // islands breathe (things on them rise and fall with it); off by default
  rippleOn: false,       // the picture wavers like it's seen through water
  contrast: 1,           // contrast + saturation of the final picture (0.6 softer – 1.6 punchier)
  skyDim: 0,             // darkens only the sky behind the world (0 = as is, 0.9 = nearly black); lighting untouched  ripple: 0,             // water-ripple distortion over the whole picture
  dream: 0.35,           // dream glass: soft blur + glow, like looking through a fogged window
  // Scrim panel: for projecting through layered fabric (show-wide, not per song)
  halftoneOn: false,     // the halftone dots in the sky (off: they moiré against the fabric)
  bloom: 0.3,            // bright parts glow outward, soft-capped (never burns out)
  saturation: 1.1,       // color strength, separate from contrast
  shadowLift: 0.15,      // lifts the darkest tones a little so dark shapes don't vanish
  edgeDark: 0.3,         // darkens toward the frame's edges
  distFade: 0.25,        // fades distant things into the sky; the subject stays vivid
  rainOn: true,          // weather switches
  cloudsOn: true,        // the clouds (fade out over ~2 s when switched off)
  snowOn: true,              // 0 = blended sky, 1 = sky split down the middle, day | night
  windowLight: 0.7,
  clouds: 0.75,          // how many clouds
  cloudDensity: 0.5,
  cloudOpacity: 0.55,
  cloudDrift: 1,
  cloudSoftness: 0.6,
  halftone: 0.35,
  grain: 0.6,

  // style
  stroke: 'stroke',

  // song scenes
  activeSong: -1,
});

// Settings that no longer have a control. They are locked to these values,
// whatever a song, an old saved state or another browser asks for.
export const FIXED = Object.freeze({
  autoAnimate: true,      // always animating
  rotationSpeed: 1,       // islands: one turn per 2-minute loop
  tour: false,            // autonomous camera tour removed
  showMain: true,         // island / bird / airplane switches removed
  showSatellites: true,
  birdsVisible: true,
  airplane: true,
  split: 0,               // split sky removed
  clouds: 0.75,           // 12 of 16 clouds
  cloudDensity: 0,
  cloudOpacity: 0.5,
  cloudSoftness: 1,
  cloudDrift: 1.5,
  houseCount: 12,         // houses per island
  birdCount: 20,          // birds (the speed stays adjustable)
  rain: 0.6,              // weather strength (the switches stay)
  snow: 1,
  grain: 0,               // grain removed
  darkness: 0.85,         // how dark night gets
  windowLight: 0.7,       // windows follow the hour now; this only sets screen brightness
  halftone: 0.5,          // the halftone breathes on its own (viewer.js)
});

export function sanitize(s) {
  const out = { ...DEFAULT_STATE };
  if (s && typeof s === 'object') {
    for (const k of Object.keys(DEFAULT_STATE)) {
      if (k in s && typeof s[k] === typeof DEFAULT_STATE[k]) out[k] = s[k];
    }
  }
  if (!STROKE_MODES.includes(out.stroke)) out.stroke = 'stroke';
  Object.assign(out, FIXED);
  return out;
}

export function loadState() {
  try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return { ...DEFAULT_STATE }; }
}

export function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

// Small deterministic RNG so the world is the same world every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    f: (a, b) => a + (b - a) * r(),
    i: (a, b) => a + Math.floor(r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
  };
}
