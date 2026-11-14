// Viewer: renders the archipelago full-screen with no interface.
// Listens to control.html over BroadcastChannel and eases toward whatever
// state it receives, so every change arrives as a transition.

import * as THREE from 'three';
import { CHANNEL_NAME, LOOP_SECONDS, WORLD, TIMES, STROKE_MODES, sunHeight, loadState, sanitize } from './config.js';
import { shared, setStrokeMode } from './materials.js';
import { makeMemoryAtlas, loadMemoryImages } from './memories.js';
import { createWorld } from './world.js';
import { createWeather } from './weather.js';
import { createClouds } from './clouds.js';
import { createBirds } from './birds.js';
import { createCameraRig } from './camera.js';
import { createFreecam } from './freecam.js'; // TEMP free camera
import { presetById, isView } from './presets.js';
import { LAMP_HALOS } from './architecture.js';

THREE.ColorManagement.enabled = false; // treat every hex color as-is, like ink on paper
const TAU = Math.PI * 2;

// ?w=1920&h=1080 renders at an exact pixel size (letterboxed to fit the window)
const params = new URLSearchParams(location.search);
const fixedW = parseInt(params.get('w'), 10) || 0;
const fixedH = parseInt(params.get('h'), 10) || 0;
const fixed = fixedW > 0 && fixedH > 0;

// ------------------------------------------------------------- renderer

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1200);
const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });

shared.uAtlas.value = makeMemoryAtlas();
loadMemoryImages(shared.uAtlas.value);
const world = createWorld();
const weather = createWeather(world);

let rainOn = 1, snowOn = 1;
scene.add(world.group);
const clouds = createClouds();
scene.add(clouds.group);
const birds = createBirds();
scene.add(birds.group);
const rig = createCameraRig(camera, world.anchors, world.group);   // world.group: what close-ups check for things in the way
const freecam = createFreecam(renderer.domElement, camera, () => rig.pose.target); // TEMP free camera

// ------------------------------------------------------------- post pass
// Background gradient, local-time glows, halftone, compositing, the airplane
// window and paper grain all happen here — so a
// recording of the canvas gets exactly what is on screen.

const post = new THREE.ShaderMaterial({
  uniforms: {
    tScene: { value: rt.texture },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPx: { value: 1 },
    uTop: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uBot: { value: new THREE.Color() },
    uTime: shared.uTime,
    uLoop: shared.uLoop,
    uGrain: { value: 0.6 },
    uHalftone: { value: 0.35 },
    uFrame: { value: 0 },
    uTz: shared.uTz,
    uGlowA: { value: new THREE.Vector2(0.3, 0.5) },
    uGlowB: { value: new THREE.Vector2(0.7, 0.5) },
    uGlowR: { value: 0.4 },
    uGlowColA: { value: new THREE.Color() },
    uGlowColB: { value: new THREE.Color() },
    uWashA: { value: new THREE.Color() },
    uWashB: { value: new THREE.Color() },
    uAir: { value: 0 },
    uBlack: { value: 0 },                       // fade from black (song 1 arrival)
    uRipple: { value: 0 },                      // water-ripple distortion
    uPunch: { value: 1 },                       // contrast + saturation together (1 = as drawn)
    uSkyDim: { value: 0 },                      // darkens the sky only, never the world's light
    uNightA: shared.uNightA,
    uNightB: shared.uNightB,
    uWashK: { value: new THREE.Vector2() },     // how much each side's hour colors the sky
    uSplit: { value: 0 },                       // 0 blended, 1 hard split down the middle
    uLeftA: { value: 1 },                       // 1 when New York is on the left of the screen
    uSunUvA: { value: new THREE.Vector2() }, uSunUvB: { value: new THREE.Vector2() },
    uMoonUvA: { value: new THREE.Vector2() }, uMoonUvB: { value: new THREE.Vector2() },
    uSunAmt: { value: new THREE.Vector2() },    // x = New York, y = Taiwan
    uMoonAmt: { value: new THREE.Vector2() },
    uSunRA: { value: 0.05 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene;
    uniform vec2 uRes;
    uniform float uPx;
    uniform vec3 uTop, uMid, uBot;
    uniform float uTime, uLoop, uGrain, uFrame, uHalftone;
    uniform float uRipple, uPunch, uSkyDim;
    uniform float uTz, uGlowR, uAir, uBlack, uNightA, uNightB, uSplit, uLeftA, uSunRA;
    uniform vec2 uWashK, uSunUvA, uSunUvB, uMoonUvA, uMoonUvB, uSunAmt, uMoonAmt;
    uniform vec2 uGlowA, uGlowB;
    uniform vec3 uGlowColA, uGlowColB, uWashA, uWashB;
    varying vec2 vUv;
    const float TAU = 6.28318530718;

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec3 hueShift(vec3 c, float a) {
      const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
      const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
      vec3 yiq = toYIQ * c;
      float ca = cos(a), sa = sin(a);
      yiq.yz = mat2(ca, sa, -sa, ca) * yiq.yz;
      return toRGB * yiq;
    }

    vec3 sun(vec3 col, vec2 uv, vec2 asp, vec2 at, float amt, float R) {
      if (amt < 0.001) return col;
      float ds = length((uv - at) * asp);
      float glow = exp(-ds * ds / (R * R * 7.0));
      col = mix(col, col + vec3(1.0, 0.55, 0.3) * 0.45, glow * amt * 0.7);
      float disc = 1.0 - smoothstep(R - 0.003, R + 0.002, ds);
      vec3 sunCol = mix(vec3(1.0, 0.86, 0.5), vec3(1.0, 0.36, 0.2), smoothstep(-R, R, at.y - uv.y));
      return mix(col, sunCol, disc * amt);
    }
    vec3 moon(vec3 col, vec2 uv, vec2 asp, vec2 at, float amt) {
      if (amt < 0.001) return col;
      float mr = 0.04;
      vec2 dm = (uv - at) * asp;
      float dl = length(dm);
      col = mix(col, col + vec3(0.6, 0.7, 1.0) * 0.18, exp(-dl * dl / (mr * mr * 9.0)) * amt);
      float disc = 1.0 - smoothstep(mr - 0.003, mr + 0.002, dl);
      float lit = smoothstep(mr * 0.92 - 0.003, mr * 0.92 + 0.002, length(dm - vec2(0.42, 0.14) * mr));
      col = mix(col, col * 0.85 + vec3(0.04, 0.05, 0.1), disc * 0.4 * amt);
      return mix(col, vec3(0.98, 0.96, 0.86), disc * lit * amt);
    }

    vec3 sky(vec2 uv) {
      float ph = TAU * uTime / uLoop;
      vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      vec2 c = (uv - 0.5) * asp;
      float ang = 0.32 + 0.10 * sin(ph);
      float t = 0.5 - dot(c, vec2(sin(ang), cos(ang))) * 0.95;
      t += 0.035 * sin(ph * 2.0 + c.x * 2.5);
      float m = 0.5 + 0.07 * sin(ph + 1.3);
      vec3 col = t < m
        ? mix(uTop, uMid, smoothstep(0.0, m, t))
        : mix(uMid, uBot, smoothstep(m, 1.0, t));
      vec2 gp = vec2(0.45 * sin(ph), -0.1 + 0.12 * cos(ph * 2.0));
      float gl = exp(-dot(c - gp, c - gp) * 4.0);
      col = mix(col, mix(uMid, vec3(1.0, 0.84, 0.86), 0.4), gl * 0.16);
      col = hueShift(col, 0.09 * sin(ph + 0.7));

      // which island's sky we are in: a soft blend between the two islands,
      // or (split) a hard edge down the middle of the screen
      float span = uGlowB.x - uGlowA.x;
      float wx = abs(span) < 0.01 ? 0.5 : clamp((uv.x - uGlowA.x) / span, 0.0, 1.0);
      wx = wx * wx * (3.0 - 2.0 * wx);
      float halfSide = uLeftA > 0.5 ? step(0.5, uv.x) : 1.0 - step(0.5, uv.x);
      wx = mix(wx, halfSide, uSplit);

      // each side's hour colors its sky, plus a low glow under each island
      float wk = mix(uWashK.x, uWashK.y, wx);
      vec3 wash = mix(uWashA, uWashB, wx);
      col = mix(col, col * 0.6 + wash * 0.45, wk * 0.45);
      vec2 da = (uv - uGlowA) * asp, db = (uv - uGlowB) * asp;
      float r2 = uGlowR * uGlowR;
      col = mix(col, uGlowColA, exp(-dot(da, da) / r2) * uWashK.x * 0.6 * (1.0 - uSplit * 0.5));
      col = mix(col, uGlowColB, exp(-dot(db, db) / r2) * uWashK.y * 0.6 * (1.0 - uSplit * 0.5));

      // night: deep blue, with a few stars
      float nS = mix(uNightA, uNightB, wx);
      if (nS > 0.001) {
        vec3 nightCol = mix(vec3(0.10, 0.14, 0.36), vec3(0.03, 0.05, 0.17), smoothstep(0.1, 1.0, uv.y));
        col = mix(col, nightCol + col * 0.06, nS * 0.92);
        vec2 sc = floor(gl_FragCoord.xy / (3.0 * uPx));
        float hs = hash(sc);
        float tw = 0.55 + 0.45 * sin(TAU * (uTime / uLoop * (1.0 + floor(hash(sc + 3.0) * 3.0)) + hash(sc + 9.0)));
        col += vec3(0.95, 0.93, 0.85) * step(0.9975, hs) * tw * nS * smoothstep(0.25, 0.7, uv.y);
      }

      // a sun or a moon over each island, by its hour
      col = sun(col, uv, asp, uSunUvA, uSunAmt.x, uSunRA);
      col = sun(col, uv, asp, uSunUvB, uSunAmt.y, 0.05);
      col = moon(col, uv, asp, uMoonUvA, uMoonAmt.x);
      col = moon(col, uv, asp, uMoonUvB, uMoonAmt.y);

      // the split line
      col = mix(col, vec3(0.97, 0.95, 0.9), uSplit * (1.0 - smoothstep(0.0012, 0.0028, abs(uv.x - 0.5) * asp.x)));

      if (uHalftone > 0.001) {
        float cellPx = max(4.0, 9.0 * uRes.y / 1080.0);
        vec2 cellId = floor(gl_FragCoord.xy / cellPx);
        vec2 local = fract(gl_FragCoord.xy / cellPx) - 0.5;
        vec2 cc = ((cellId + 0.5) * cellPx / uRes - 0.5) * asp;
        // dense at the bottom, fading upward, plus a large soft patch that
        // wanders the whole upper half (corners included), once per loop
        vec2 wander = vec2(0.82 * cos(ph), 0.26 + 0.14 * sin(ph * 2.0));
        float field = smoothstep(0.15, 0.55, -cc.y + 0.12 * sin(ph + cc.x * 3.0))
                    + 0.55 * smoothstep(0.7, 0.0, length(cc - wander));
        field = clamp(field, 0.0, 1.0) * uHalftone;
        float dotR = 0.5 * sqrt(field) * 1.15;
        float dotMask = 1.0 - smoothstep(dotR - 0.08, dotR + 0.02, length(local));
        vec3 ink = mix(uTop, vec3(0.97, 0.95, 0.91), 0.15);
        col = mix(col, ink, dotMask * smoothstep(0.0, 0.15, field) * 0.85);
      }
      return col;
    }

    // a soft cloud puff (three overlapping blobs) for the airplane windows
    float puff(vec2 p, float r) {
      float a = exp(-dot(p, p) / (r * r));
      a = max(a, exp(-dot(p - vec2(0.9 * r, 0.25 * r), p - vec2(0.9 * r, 0.25 * r)) / (r * r * 0.6)));
      a = max(a, exp(-dot(p + vec2(0.85 * r, -0.15 * r), p + vec2(0.85 * r, -0.15 * r)) / (r * r * 0.5)));
      return smoothstep(0.35, 0.75, a);
    }

    // looking out of an airliner: three rounded windows in the cabin wall,
    // well apart, shades up, with clouds drifting past outside
    vec3 airplaneWindow(vec3 col, vec2 uv) {
      vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      vec2 c = (uv - 0.5) * asp;
      float s = 1.0;
      vec2 hs = vec2(0.18, 0.27) * s;   // half-size of each window (screen height = 1)
      float rad = 0.14 * s;             // corner rounding
      float gap = 0.6 * s;              // centre-to-centre spacing
      // nearest of the three windows
      float k = clamp(floor(c.x / gap + 0.5), -1.0, 1.0);
      vec2 lc = c - vec2(k * gap, 0.02 * s);
      vec2 q = abs(lc) - hs + rad;
      float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
      if (sd > 0.0) {
        // dark cabin: the wall is nearly black, so only the view outside reads;
        // a faint lit bevel catches the daylight right at each window's edge
        float rim = 1.0 - smoothstep(0.0, 0.03 * s, sd);
        vec3 wall = mix(vec3(0.015, 0.015, 0.02), col * 0.18 + 0.02, rim);
        return wall;
      }
      // outside: the world, then clouds sliding past (whole laps per loop)
      vec3 g = col * vec3(0.93, 0.97, 1.03) + 0.025;
      float ph = uTime / uLoop;
      float cl = 0.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float speed = 2.0 + floor(hash(vec2(fi, 1.0)) * 3.0);
        float x = fract(hash(vec2(fi, 2.0)) - ph * speed) * 2.6 - 1.3;
        float y = (hash(vec2(fi, 3.0)) - 0.5) * 0.5 * s;
        float r = (0.05 + 0.06 * hash(vec2(fi, 4.0))) * s;
        cl = max(cl, puff(c - vec2(x * s, y), r) * (0.55 + 0.4 * hash(vec2(fi, 5.0))));
      }
      g = mix(g, vec3(0.97, 0.97, 1.0), cl * 0.9);
      g += vec3(0.1) * exp(-pow((lc.x * 0.9 + lc.y * 0.5 - 0.04 * s) / (0.025 * s), 2.0));
      g *= 1.0 - 0.3 * smoothstep(-0.04 * s, 0.0, sd);
      return g;
    }

    void main() {
      vec2 uv = vUv;
      vec2 fc = floor(gl_FragCoord.xy / uPx);

      // ripple: the picture wavers like it's seen through water (a blurred memory)
      if (uRipple > 0.001) {
        float rp = uTime / uLoop;
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        vec2 c = (uv - 0.5) * asp;
        float r = length(c);
        vec2 w = vec2(sin(uv.y * 26.0 + TAU * rp * 12.0) + 0.5 * sin(uv.y * 61.0 - TAU * rp * 20.0),
                      sin(uv.x * 19.0 + TAU * rp * 9.0) + 0.4 * sin(uv.x * 47.0 + TAU * rp * 15.0));
        vec2 rad = c / (r + 1e-4) * sin(r * 48.0 - TAU * rp * 16.0) * smoothstep(0.9, 0.1, r);
        uv += (w * 0.0035 + rad * 0.0045) * uRipple / asp;
      }

      vec4 s = texture2D(tScene, uv);

      vec3 ground = sky(uv) * (1.0 - uSkyDim);   // sky dimmer: background only
      vec3 col = ground * (1.0 - s.a) + s.rgb;   // scene is premultiplied
      if (uAir > 0.001) col = mix(col, airplaneWindow(col, vUv), uAir);

      float n1 = hash(fc) - 0.5;
      float n2 = hash(floor(fc / 2.0) + 17.0) - 0.5;
      float n3 = hash(fc + floor(uFrame / 4.0) * 13.1) - 0.5;
      vec3 chroma = vec3(hash(fc + 3.1), hash(fc + 7.7), hash(fc + 11.3)) - 0.5;
      col += (n1 * 0.05 + n2 * 0.05 + n3 * 0.025) * uGrain + chroma * 0.025 * uGrain;
      float speck = step(0.988, hash(fc * 1.37 + 3.0));
      col = mix(col, col * 0.85, speck * uGrain * 0.6);

      // Contrast: one value drives contrast and saturation together, so a
      // washed-out projection (e.g. on a scrim) can be pushed back; < 1 softens
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, uPunch);
      col = (col - 0.5) * uPunch + 0.5;

      vec2 vc = vUv - 0.5;
      col *= 1.0 - dot(vc, vc) * 0.16;
      col *= 1.0 - uBlack;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
});
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ------------------------------------------------------------- sizing

let aspect = 16 / 9;
let halfH0 = 13;
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  let w, h, pr;
  if (fixed) {
    w = fixedW; h = fixedH; pr = 1;
    const scale = Math.min(vw / w, vh / h);
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    Object.assign(renderer.domElement.style, { width: `${w * scale}px`, height: `${h * scale}px` });
  } else {
    w = vw; h = vh; pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h);
  }
  aspect = w / h;
  // framing is designed for 16:9; narrower screens widen the view instead of cropping
  halfH0 = Math.max(13, 23.1 / aspect);
  camera.left = -halfH0 * aspect; camera.right = halfH0 * aspect;
  camera.top = halfH0; camera.bottom = -halfH0;
  camera.updateProjectionMatrix();
  rt.setSize(Math.round(w * pr), Math.round(h * pr));
  post.uniforms.uRes.value.set(w * pr, h * pr);
  post.uniforms.uPx.value = pr;
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- state

let target = loadState();
// ?preset=taiwan starts on a camera preset (handy for recording / checking views)
if (params.get('preset')) {
  const p = presetById(params.get('preset'));
  target = { ...target, cameraPreset: p.id, customView: null, zoom: p.zoom, cameraAngle: p.elevation, cameraOrbit: 0 };
}
// ?stroke=lines&ripple=0.6&twHour=22 ... sets any setting at start (for checking looks)
for (const [k, v] of params) {
  if (k === 'preset' || !(k in target)) continue;
  if (typeof target[k] === 'number' && Number.isFinite(+v)) target[k] = +v;
  else if (typeof target[k] === 'string' && (k !== 'stroke' || STROKE_MODES.includes(v))) target[k] = v;
  else if (typeof target[k] === 'boolean') target[k] = v === '1' || v === 'true';
}
const EASED = [
  'contrast', 'skyDim',
  'rotationSpeed', 'floatIntensity', 'birdSpeed', 'zoom', 'cameraAngle', 'cameraOrbit',
  'cameraPanX', 'cameraPanY', 'cameraPanZ',
  'windowLight', 'clouds', 'cloudDensity', 'cloudOpacity', 'cloudDrift', 'cloudSoftness',
  'halftone', 'grain', 'timezone', 'darkness', 'split', 'rain', 'snow',
];
// what the camera is following: a song's saved view, or else a preset
const specOf = (st) => (isView(st.customView) ? st.customView : presetById(st.cameraPreset));
const cur = {};
for (const k of EASED) cur[k] = target[k];
const COLORS = ['bgTop', 'bgMid', 'bgBottom'];
for (const k of COLORS) cur[k] = new THREE.Color(target[k]);

// local time: Taiwan's clock is the slider, New York runs 12 hours apart.
// Each island's light is mixed from the day / golden-hour / night palettes.
const tzKeys = ['tint', 'shadow', 'glow', 'wash', 'cloud'];
const PAL = {};
for (const [name, p] of Object.entries(TIMES)) {
  PAL[name] = { window: p.window, washK: p.washK };
  for (const k of tzKeys) PAL[name][k] = new THREE.Color(p[k]);
}
const tzCur = { A: {}, B: {} };
for (const side of ['A', 'B']) for (const k of tzKeys) tzCur[side][k] = new THREE.Color();
const fall = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const lightAt = (h) => {
  const e = sunHeight(h);
  return { e, night: fall(0.02, -0.5, e), golden: Math.exp(-Math.pow(e / 0.25, 2)) };
};
function paint(L, out) {
  for (const k of tzKeys) out[k].copy(PAL.day[k]).lerp(PAL.golden[k], L.golden).lerp(PAL.night[k], L.night);
  const mix3 = (key) => THREE.MathUtils.lerp(THREE.MathUtils.lerp(PAL.day[key], PAL.golden[key], L.golden), PAL.night[key], L.night);
  out.window = mix3('window');
  out.washK = mix3('washK');
}
let hour = target.twHour;   // eased around the clock
let LA = lightAt(hour + 12), LB = lightAt(hour);
let henge = 0;        // eased: how much the sun is pinned for Manhattanhenge
const posA = new THREE.Vector2(), posB = new THREE.Vector2(), pinSun = new THREE.Vector2(0.5, 0.6);
let pinR = 0.075;

const tmpColor = new THREE.Color();
let t = 0;            // seconds of auto-animation elapsed
let angle = 0;        // island rotation (accumulated so speed changes never jump)
let birdPhase = 0;
let cloudPhase = 0;
let air = 0;
let blackStart = -1;   // when the fade from black began (song 1)
let lastCue = target.cameraCue;
let easeBoostUntil = 0;
let strokeMode = null;
let breath = target.breatheOn ? 1 : 0;   // eased slowly, so breathing starts and stops gently
let ripple = target.rippleOn ? 1 : 0;     // the ripple switch fades over ~3 s
// Floating / Displacement moves at a steady pace with a soft start and stop,
// so going from float to scatter visibly breaks apart (about 2 s per step of 1)
const floatAnim = { from: target.floatIntensity, to: target.floatIntensity, start: 0, dur: 0 };
let sunSide = null;                        // eased 0..1: which island has the sun

world.setLayout(target.layoutSeed, performance.now() / 1000, true);
rig.jump(specOf(target));
cur.zoom = target.zoom; cur.cameraAngle = target.cameraAngle;

function applyState(s, ease) {
  const prev = target;
  target = sanitize(s);
  const nowSec = performance.now() / 1000;
  world.setLayout(target.layoutSeed, nowSec);
  if (target.cameraCue !== lastCue || target.cameraPreset !== prev.cameraPreset) {
    lastCue = target.cameraCue;
    const p = specOf(target);
    if (p.overlay === 'airplane') {
      // song 1: start from black and fade in on the windows
      rig.jump(p);
      blackStart = nowSec;
      air = 1;
    } else rig.go(p, target.transition * (p.durationScale || 1), nowSec);
    // the rig interpolates zoom/angle itself during a transition
    cur.zoom = target.zoom; cur.cameraAngle = target.cameraAngle; cur.cameraOrbit = target.cameraOrbit;
    cur.cameraPanX = target.cameraPanX; cur.cameraPanY = target.cameraPanY; cur.cameraPanZ = target.cameraPanZ;
    freecam.reset();   // a new cue starts clean, so saved song views land exactly
  }
  if (ease) {
    // atmosphere changes from a scene take exactly as long as the camera move
    const p = specOf(target);
    easeBoostUntil = nowSec + Math.max(0.5, target.transition * (p.durationScale || 1));
  }
}

// ------------------------------------------------------------- sync

// The show clock comes from the controller, so every viewer (here or on
// another tab) is at the same moment of the loop. Drift is never snapped
// away mid-show: it is bled in over a couple of seconds, invisibly. Only the
// first sync, or a big gap (a reload, a sleeping laptop), jumps straight there.
const wrapD = (d, p) => ((((d % p) + p * 1.5) % p) - p / 2);
let clockSynced = false;
const clockFix = { t: 0, angle: 0, bird: 0, cloud: 0 };   // corrections still to apply
// Follow one controller's clock at a time. A clock from anyone else (a second
// controller tab, an old version left open) is ignored while ours is alive.
let clockSrc = null, clockSrcSeen = -1e9;
function syncClock(c) {
  const nowS = performance.now() / 1000;
  const src = c.src || 'old';
  if (clockSrc && src !== clockSrc && nowS - clockSrcSeen < 10) return;
  clockSrc = src; clockSrcSeen = nowS;
  const eT = wrapD(c.t - t, LOOP_SECONDS);
  const eA = wrapD(c.angle - angle, TAU);
  const eB = wrapD(c.bird - birdPhase, 1);
  const eC = wrapD(c.cloud - cloudPhase, 1);
  if (!clockSynced || Math.abs(eT) > 5) {
    t = c.t; angle = c.angle; birdPhase = c.bird; cloudPhase = c.cloud;
    clockFix.t = clockFix.angle = clockFix.bird = clockFix.cloud = 0;
  } else {
    clockFix.t = eT; clockFix.angle = eA; clockFix.bird = eB; clockFix.cloud = eC;
  }
  clockSynced = true;
}
function bleedClock(dt) {
  const f = Math.min(1, dt / 2);   // about 2 s to absorb a correction
  const dT = clockFix.t * f, dA = clockFix.angle * f, dB = clockFix.bird * f, dC = clockFix.cloud * f;
  t += dT; angle += dA; birdPhase += dB; cloudPhase += dC;
  clockFix.t -= dT; clockFix.angle -= dA; clockFix.bird -= dB; clockFix.cloud -= dC;
}

const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
let fps = 60;
if (channel) {
  channel.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'state') applyState(m.state, !!m.ease);
    else if (m.type === 'clock') syncClock(m);
    else if (m.type === 'captureView') channel.postMessage({ type: 'view', song: m.song, view: captureView() });
    else if (m.type === 'hello' && m.from === 'control') sendStatus();
  };
  channel.postMessage({ type: 'hello', from: 'viewer' });
}
// The camera exactly as it is now (preset or view + sliders + mouse), made
// into a saved view of its own: a fixed spot in the world, or, if the camera
// was following something, still following it. The live camera switches to
// that view so nothing moves when the mouse offsets are cleared.
// A name for what the camera is looking at: the landmark nearest the middle
// of the picture (big islands count from their edge), plus wide / close-up.
const LANDMARKS = [
  ['ny', 'New York', 11], ['tw', 'Taiwan', 10],
  ['busStop', 'Bus Stop', 3], ['grove', 'Grove', 3], ['subway', 'Subway', 3], ['luggage', 'Baggage Belt', 4.5],
  ['lamp', 'Street Light', 1.5], ['suitcase', 'Suitcase', 1.7], ['lighthouse', 'Lighthouse', 2],
  ['windmill', 'Windmill', 2], ['windowIsland', 'Standing Window', 1.5], ['tinyHouse', 'Tiny House', 1.2],
  ['stairs', 'Spiral Stairs', 1.6], ['wall', 'Gable Wall', 1.5],
  ['ladder', 'Ladder', 2], ['portals', 'Portals', 2], ['apple', 'Big Apple', 2.5],
  ['departures', 'Departures Board', 2], ['clock', 'Big Clock', 2], ['bridgeWindow', 'Bridge', 2],
  ['crossroads', 'Crossroads', 1.2], ['twWindow', 'Taiwan window', 0.3], ['nyWindow', 'New York window', 0.3],
  ['airplane', 'Airliner', 2], ['birdPair', 'Two Birds', 1.5], ['roadBus', 'the bus', 0.6],
];
const SCENE_NAMES = { bathroom: 'Bathroom', lookout: 'Lookout', dining: 'Dining Room', airplane: 'Airplane Window' };
const lmV = new THREE.Vector3();
function nameForCamera(view) {
  if (view?.scene && SCENE_NAMES[view.scene]) return SCENE_NAMES[view.scene];
  camera.updateMatrixWorld();
  const halfH = (camera.top - camera.bottom) / 2 / camera.zoom;
  let best = null, bestScore = Infinity, mains = 0;
  for (const [key, label, radius] of LANDMARKS) {
    const a = world.anchors[key];
    if (!a) continue;
    a.getWorldPosition(lmV);
    lmV.project(camera);
    if (lmV.z < -1 || lmV.z > 1) continue;
    const r = radius / halfH;                       // its size on screen
    const d = Math.hypot(lmV.x * aspect, lmV.y);
    if (Math.abs(lmV.x) - r / aspect > 1.05 || Math.abs(lmV.y) - r > 1.05) continue;
    if (key === 'ny' || key === 'tw') mains++;
    const score = Math.max(0, d - r * 0.7) + (radius < 1 ? 0.15 : 0);
    if (score < bestScore) { bestScore = score; best = label; }
  }
  if (!best) return 'Open sky';
  if (camera.zoom < 0.9 && mains === 2) return 'Wide · both islands';
  const z = camera.zoom;
  return best + (z >= 5 ? ' · close-up' : z < 1 ? ' · wide' : '');
}

function captureView() {
  const f = freecam.get();
  const T = rig.pose.target.clone().add(f.pan);
  const D = camera.position.clone().sub(T).normalize();
  const view = rig.makeView(rig.preset, T, D, camera.zoom);
  view.name = nameForCamera(view);
  Object.assign(target, { customView: view, zoom: view.zoom, cameraAngle: view.elevation, cameraOrbit: 0,
    cameraPanX: 0, cameraPanY: 0, cameraPanZ: 0 });
  for (const k of ['zoom', 'cameraAngle', 'cameraOrbit', 'cameraPanX', 'cameraPanY', 'cameraPanZ']) cur[k] = target[k];
  freecam.reset();
  rig.jump(view);
  return view;
}

function sendStatus() {
  channel?.postMessage({
    type: 'status', fps: Math.round(fps),
  });
}
setInterval(sendStatus, 500);

window.addEventListener('keydown', (e) => {
  if (e.key === 'f') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
});

// ------------------------------------------------------------- loop

const proj = new THREE.Vector3();
function toUv(v, out) {
  proj.copy(v).project(camera);
  return out.set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5);
}
const nyCenter = new THREE.Vector3(), twCenter = new THREE.Vector3();
const camPan = new THREE.Vector3();
const haloPos = new THREE.Vector3();
const viewDir = new THREE.Vector3();

let last = performance.now();
let frame = 0;
function tick(now) {
  const nowSec = now / 1000;
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));   // the first frame can arrive "before" start
  const clockDt = Math.max(0, Math.min(3600, (now - last) / 1000));   // real time, for the loop clock
  last = now;
  fps += ((dt > 0 ? 1 / dt : 60) - fps) * 0.05;
  frame++;

  // ease every continuous parameter toward its target
  // During a song change, everything (sky, hour, light, effects) moves at a
  // steady pace and lands together with the camera, instead of jumping most
  // of the way in the first second.
  // a big camera turn takes longer; the sky and light stretch to match it
  if (nowSec < easeBoostUntil && rig.transitioning) easeBoostUntil = Math.max(easeBoostUntil, rig.endTime);
  const k = nowSec < easeBoostUntil
    ? Math.min(1, dt / Math.max(dt, easeBoostUntil - nowSec))
    : 1 - Math.exp(-dt * 2.4);
  const kCam = 1 - Math.exp(-dt * 2.4);
  if (target.floatIntensity !== floatAnim.to) {
    floatAnim.from = cur.floatIntensity;
    floatAnim.to = target.floatIntensity;
    floatAnim.start = nowSec;
    floatAnim.dur = Math.max(1.5, Math.abs(floatAnim.to - floatAnim.from) * 2);
  }
  {
    const u = floatAnim.dur > 0 ? Math.min(1, (nowSec - floatAnim.start) / floatAnim.dur) : 1;
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    cur.floatIntensity = floatAnim.from + (floatAnim.to - floatAnim.from) * e;
  }
  for (const key of EASED) {
    // floating / displacement drifts apart and back together over ~3 s
    if (key === 'floatIntensity') continue;   // its own steady animation, below
    const kk = (key === 'zoom' || key.startsWith('camera')) ? kCam : k;
    if (key === 'zoom') cur.zoom = Math.exp(Math.log(cur.zoom) + (Math.log(target.zoom) - Math.log(cur.zoom)) * kk);
    else cur[key] += (target[key] - cur[key]) * kk;
    // land exactly on the target, so e.g. scattered objects return precisely home
    if (Math.abs(target[key] - cur[key]) < 1e-4) cur[key] = target[key];
  }
  for (const key of COLORS) cur[key].lerp(tmpColor.set(target[key]), k);
  // the clock: ease the shorter way round (23:00 -> 00:00 moves forward)
  hour += ((((target.twHour - hour) % 24) + 36) % 24 - 12) * k;
  hour = ((hour % 24) + 24) % 24;
  LB = lightAt(hour);                                   // Taiwan
  LA = lightAt(hour + 12);                              // New York, always 12 h apart
  paint(LA, tzCur.A);
  paint(LB, tzCur.B);
  shared.uNightA.value = LA.night * cur.darkness;
  shared.uNightB.value = LB.night * cur.darkness;

  if (strokeMode !== target.stroke) { strokeMode = target.stroke; setStrokeMode(strokeMode); }

  if (target.autoAnimate) {
    // the loop clock counts real time, even across slow frames or a moment
    // when the browser paused this window, so it never falls behind the
    // controller and never has to jump to catch up
    const cdt = clockDt;
    t += cdt;
    angle += cur.rotationSpeed * TAU / LOOP_SECONDS * cdt;
    birdPhase += cur.birdSpeed * cdt / LOOP_SECONDS;
    cloudPhase += cur.cloudDrift * cdt / LOOP_SECONDS;
  }
  bleedClock(dt);
  const loopT = t % LOOP_SECONDS;
  const ph = loopT / LOOP_SECONDS;
  ripple += ((target.rippleOn ? 1 : 0) - ripple) * (1 - Math.exp(-dt * 1.0));
  if (Math.abs((target.rippleOn ? 1 : 0) - ripple) < 1e-3) ripple = target.rippleOn ? 1 : 0;
  // breathing switch: eases over about 4 s
  breath += ((target.breatheOn ? 1 : 0) - breath) * (1 - Math.exp(-dt * 0.9));
  if (Math.abs((target.breatheOn ? 1 : 0) - breath) < 1e-3) breath = target.breatheOn ? 1 : 0;

  const elevation = cur.cameraAngle, zoom = cur.zoom, orbit = cur.cameraOrbit;
  const pan = camPan.set(cur.cameraPanX, cur.cameraPanY, cur.cameraPanZ);

  // ---- shared uniforms
  shared.uTime.value = loopT;
  shared.uPxH.value = renderer.domElement.height;
  shared.uWindowLight.value = cur.windowLight;
  shared.uTz.value = 1;     // the hour's tint always applies (day tint is white)
  shared.uTintA.value.copy(tzCur.A.tint); shared.uTintB.value.copy(tzCur.B.tint);
  shared.uShadowA.value.copy(tzCur.A.shadow); shared.uShadowB.value.copy(tzCur.B.shadow);
  shared.uWinA.value = tzCur.A.window; shared.uWinB.value = tzCur.B.window;

  // ---- world
  world.update({
    loopT, nowSec, dt, angle,
    floatI: cur.floatIntensity, houseCount: target.houseCount,
    showMain: target.showMain, showSatellites: target.showSatellites,
    airplaneVisible: target.airplane && air < 0.5,
    presetId: rig.preset.scene || rig.preset.id,
    breathe: breath,
  });
  // weather switches fade in and out over about a second
  // weather switches: rain and snow build up and die away over about 4 s
  rainOn += ((target.rainOn ? 1 : 0) - rainOn) * (1 - Math.exp(-dt * 0.75));
  snowOn += ((target.snowOn ? 1 : 0) - snowOn) * (1 - Math.exp(-dt * 0.75));
  weather.update({ rain: cur.rain * rainOn, snow: cur.snow * snowOn, pxH: renderer.domElement.height });
  world.islands[0].root.getWorldPosition(nyCenter);
  world.islands[1].root.getWorldPosition(twCenter);
  birds.update({
    phase: birdPhase, ph, dt, count: target.birdCount, visible: target.birdsVisible,
    A: nyCenter, B: twCenter,
  });

  // ---- camera
  rig.update(nowSec, elevation, zoom, orbit, pan);
  freecam.apply(); // TEMP free camera
  camera.updateMatrixWorld();
  camera.getWorldDirection(viewDir);
  shared.uViewDir.value.copy(viewDir);

  // the cabin windows: in quickly; out slowly over the whole camera move
  const airTarget = rig.preset.overlay === 'airplane' ? 1 : 0;
  const airOut = Math.max(0.8, target.transition * (rig.preset.durationScale || 1));
  air = airTarget ? Math.min(1, air + dt / 0.8) : Math.max(0, air - dt / airOut);
  let black = 0;
  if (blackStart >= 0) {
    const u = Math.min(1, Math.max(0, (nowSec - blackStart - 0.4) / 3));
    black = 1 - u * u * (3 - 2 * u);
    if (u >= 1) blackStart = -1;
  }

  clouds.update({
    phase: cloudPhase, ph, camera, camTarget: rig.pose.target,
    amount: cur.clouds, density: cur.cloudDensity, opacity: cur.cloudOpacity, softness: cur.cloudSoftness,
    tz: 1, cloudA: tzCur.A.cloud, cloudB: tzCur.B.cloud,
    nightA: shared.uNightA.value, nightB: shared.uNightB.value,
  });

  // sun + moon: over each island by its hour (clamped to its side of the
  // frame), unless a preset pins the sun, as Manhattanhenge does
  const pin = rig.preset.sun;
  henge += ((pin ? 1 : 0) - henge) * (1 - Math.exp(-dt * 1.3));
  if (pin) { pinSun.fromArray(pin.at); pinR = pin.r; }
  toUv(proj.copy(nyCenter).add(new THREE.Vector3(0, 6, 0)), posA);
  toUv(proj.copy(twCenter).add(new THREE.Vector3(0, 6, 0)), posB);
  const leftA = posA.x <= posB.x;
  const sp = cur.split;
  const clampX = (x, isLeft) => Math.min(THREE.MathUtils.lerp(0.9, isLeft ? 0.42 : 0.9, sp), Math.max(THREE.MathUtils.lerp(0.1, isLeft ? 0.1 : 0.58, sp), x));
  // one sun and one moon: the sun goes to whichever island is more in
  // daylight, the moon to the other; they slide past each other at 06:00 and
  // 18:00 and always keep apart
  const U = post.uniforms;
  const xA = clampX(posA.x, leftA), xB = clampX(posB.x, !leftA);
  // which island has the sun. However fast the Time slider moves, they trade
  // places at a steady pace (about 4 s), and pass one above the other.
  const sTarget = LA.e > LB.e ? 1 : 0;                  // 1 = New York has the sun
  if (sunSide === null) sunSide = sTarget;
  sunSide += Math.max(-dt / 4, Math.min(dt / 4, sTarget - sunSide));
  const sA = sunSide * sunSide * (3 - 2 * sunSide);
  const sunX = THREE.MathUtils.lerp(xB, xA, sA), moonX = THREE.MathUtils.lerp(xA, xB, sA);
  let sunY = 0.6 + 0.22 * Math.min(1, Math.max(0, Math.max(LA.e, LB.e)));
  let moonY = 0.86;
  // keep apart vertically, never by jumping sideways: the sun dips, the moon lifts
  const near = Math.max(Math.sin(Math.PI * sA) * 0.12, Math.max(0, 0.2 - Math.abs(sunX - moonX)) * 0.6);
  sunY -= near; moonY = Math.min(0.94, moonY + near * 0.4);
  U.uSunUvA.value.set(sunX, sunY).lerp(pinSun, henge);
  U.uMoonUvA.value.set(moonX, moonY);
  U.uSunRA.value = THREE.MathUtils.lerp(0.05, pinR, henge);
  U.uSunAmt.value.set(1 - air, 0);
  U.uMoonAmt.value.set((1 - henge) * (1 - air), 0);
  U.uWashK.value.set(tzCur.A.washK, tzCur.B.washK);
  U.uSplit.value = sp;
  U.uLeftA.value = leftA ? 1 : 0;

  // ---- post uniforms
  post.uniforms.uTop.value.copy(cur.bgTop);
  post.uniforms.uMid.value.copy(cur.bgMid);
  post.uniforms.uBot.value.copy(cur.bgBottom);
  post.uniforms.uGrain.value = cur.grain;
  // the halftone breathes on its own: 30%–70%, three breaths per loop
  post.uniforms.uHalftone.value = 0.5 + 0.2 * Math.sin(TAU * ph * 3);
  post.uniforms.uFrame.value = frame;
  post.uniforms.uAir.value = air;
  post.uniforms.uBlack.value = black;
  post.uniforms.uRipple.value = ripple;
  post.uniforms.uPunch.value = cur.contrast;
  post.uniforms.uSkyDim.value = cur.skyDim;

  // street lamps glow with the night on their side of the world
  for (const h of LAMP_HALOS) {
    h.getWorldPosition(haloPos);
    const w = fall(WORLD.tzBlend[0], WORLD.tzBlend[1], haloPos.x);
    const n = shared.uNightA.value + (shared.uNightB.value - shared.uNightA.value) * w;
    h.material.opacity = Math.min(0.5, n * 0.5);   // kept soft: many glows overlap
    h.visible = n > 0.02;
  }
  toUv(proj.copy(nyCenter).add(new THREE.Vector3(0, -3, 0)), post.uniforms.uGlowA.value);
  toUv(proj.copy(twCenter).add(new THREE.Vector3(0, -3, 0)), post.uniforms.uGlowB.value);
  post.uniforms.uGlowR.value = Math.min(1.4, Math.max(0.08, 15 * camera.zoom / (2 * halfH0)));
  post.uniforms.uGlowColA.value.copy(tzCur.A.glow);
  post.uniforms.uGlowColB.value.copy(tzCur.B.glow);
  post.uniforms.uWashA.value.copy(tzCur.A.wash);
  post.uniforms.uWashB.value.copy(tzCur.B.wash);

  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// debug / automation hook: window.__island.jump('window')
window.__island = {
  jump: (id) => rig.jump(id),
  get preset() { return rig.preset.id || 'view'; },
  get breath() { return breath; },
  get punch() { return post.uniforms.uPunch.value; },
  get pose() { return { target: rig.pose.target.toArray(), zoom: rig.pose.zoom, dist: rig.pose.dist, progress: rig.progress }; },
  get sky() { const U = post.uniforms; return { sun: U.uSunUvA.value.toArray(), moon: U.uMoonUvA.value.toArray() }; },
  // turn an old-style song view (preset + sliders) into a saved view
  convert(v) {
    const p = presetById(v.camera);
    const pan = new THREE.Vector3(...(v.pan || [0, 0, 0]));
    const r = rig.resolve(p, v.angle ?? p.elevation, v.zoom ?? p.zoom, v.orbit ?? 0, pan);
    return rig.makeView(p, r.target, r.dir, r.zoom);
  },
  // name a saved view by putting the camera there for a moment
  nameView(v) {
    rig.jump(v);
    rig.update(performance.now() / 1000, v.elevation, v.zoom, 0, new THREE.Vector3());
    const n = nameForCamera(v);
    rig.jump(specOf(target));
    return n;
  },
  // how far apart an old-style view and its converted view are, right now
  compare(v) {
    const p = presetById(v.camera);
    const a = rig.resolve(p, v.angle ?? p.elevation, v.zoom ?? p.zoom, v.orbit ?? 0, new THREE.Vector3(...(v.pan || [0, 0, 0])));
    const n = this.convert(v);
    const b = rig.resolve(n, n.elevation, n.zoom, 0, new THREE.Vector3());
    return { dTarget: a.target.distanceTo(b.target), dDir: a.dir.distanceTo(b.dir), dZoom: Math.abs(a.zoom - b.zoom) };
  },
  scatter: () => ({ ...world.scatterInfo(), floatIntensity: cur.floatIntensity }),
};
