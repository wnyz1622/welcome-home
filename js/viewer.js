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
import { SONG_SCENES } from './songs.js';
import { LAMP_HALOS } from './architecture.js';
import { relayListener } from './relay.js';

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

// ---- arrival dissolve: everything in the world can dissolve, in a fine dot
// pattern, where it stands nearer the camera than CLIP.z.value. The camera
// rig fades this in as it arrives at a close-up, so what stands in front of
// the window melts away instead of vanishing at the last moment. With an
// orthographic camera the depth buffer is linear, so no extra data is needed.
const CLIP = { z: { value: 0 }, fade: { value: 0 } };
const CLIP_HEAD = `
uniform float uClipZ;
uniform float uClipFade;
float clipB2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float clipB4(vec2 a) { return clipB2(0.5 * a) * 0.25 + clipB2(a); }
`;
const CLIP_TEST = `
  if (uClipFade > 0.0) {
    float clipDepth = mix(${camera.near.toFixed(3)}, ${camera.far.toFixed(1)}, gl_FragCoord.z);
    if (clipDepth < uClipZ && clipB4(floor(gl_FragCoord.xy / 2.0)) < uClipFade) discard;
  }
`;
const clipInject = (src) => src.replace(/void\s+main\s*\(\s*\)\s*\{/, (m) => CLIP_HEAD + m + CLIP_TEST);
const clipDone = new WeakSet();
function addClip(mat) {
  if (!mat || clipDone.has(mat)) return;
  clipDone.add(mat);
  if (mat.isShaderMaterial) {
    if (!/void\s+main/.test(mat.fragmentShader)) return;
    mat.fragmentShader = clipInject(mat.fragmentShader);
    mat.uniforms.uClipZ = CLIP.z;
    mat.uniforms.uClipFade = CLIP.fade;
  } else {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
      if (prev) prev.call(mat, shader, r);
      shader.uniforms.uClipZ = CLIP.z;
      shader.uniforms.uClipFade = CLIP.fade;
      shader.fragmentShader = clipInject(shader.fragmentShader);
    };
    const key = mat.customProgramCacheKey?.bind(mat);
    mat.customProgramCacheKey = () => (key ? key() : '') + '|clip';
  }
  mat.needsUpdate = true;
}
function clipAll() {
  scene.traverse((o) => {
    if (!o.material) return;
    if (Array.isArray(o.material)) o.material.forEach(addClip); else addClip(o.material);
  });
}
// the scene pass keeps its depth too (the orthographic depth is linear), so
// the post pass can fade far-off things into the sky (Scrim: Fade distance)
const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, depthTexture: new THREE.DepthTexture(4, 4) });

shared.uAtlas.value = makeMemoryAtlas();
loadMemoryImages(shared.uAtlas.value);
const world = createWorld();
const weather = createWeather(world);

let rainOn = 1, snowOn = 1;
let cloudsVis = 1;     // eased 0..1: the clouds switch fades them in and out
scene.add(world.group);
const clouds = createClouds();
scene.add(clouds.group);
const birds = createBirds();
scene.add(birds.group);
const rig = createCameraRig(camera, world.anchors);
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
    uDream: { value: 0 },                       // dream glass: blur + glow, a fogged window
    uCloudVis: { value: 1 },                    // the Clouds switch (also the clouds outside the cabin windows)
    // Scrim panel: tuned for projecting through layered fabric
    tDepth: { value: rt.depthTexture },
    uBloom: { value: 0 },                       // glow bleeding off the bright parts, soft-capped
    uSat: { value: 1 },                         // saturation, on its own
    uLift: { value: 0 },                        // lifts the darkest tones a little
    uEdge: { value: 0 },                        // darkens toward the frame's edges
    uFade: { value: 0 },                        // fades distant things into the sky
    uSubject: { value: 320 },                   // how far the camera's subject is (depth units)
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
    uniform float uRipple, uPunch, uSkyDim, uDream, uCloudVis;
    uniform sampler2D tDepth;
    uniform float uBloom, uSat, uLift, uEdge, uFade, uSubject;
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

    // smooth value noise, for wispy cloud edges
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    // A cloud seen from the plane, in the same clean graphic style as the
    // sky clouds: a row of round scallops (a big crown, smaller ones toward
    // the ends) over a filled core, crisp edges, a flat base.
    // p is relative to the cloud's centre, r its size, sd its own seed.
    float puff(vec2 p, float r, float sd) {
      vec2 q = p / r;                                          // about -1.6..1.6 wide
      float crown = (hash(vec2(sd, 9.0)) - 0.5) * 0.9;
      float d = 1e5;                                           // signed distance (cloud units)
      float topY = -1e5, x0 = 0.0, x1 = 0.0;
      for (int k = 0; k < 5; k++) {
        float fk = float(k);
        float x = -1.25 + 2.5 * fk / 4.0 + (hash(vec2(sd, fk)) - 0.5) * 0.1;
        float near = 1.0 - min(1.0, abs(x - crown) / 1.4);
        float rr = max(0.4, 0.3 + 0.55 * pow(near, 1.3) + 0.12 * hash(vec2(fk, sd + 3.0)));
        float cy = rr * (0.5 + 0.25 * hash(vec2(fk, sd + 5.0)));
        d = min(d, length(q - vec2(x, cy)) - rr);
        topY = max(topY, cy);
        if (k == 0) x0 = x;
        if (k == 4) x1 = x;
      }
      d = min(d, max(max(x0 - q.x, q.x - x1), max(-q.y, q.y - 0.4)));   // the core
      d = max(d, -q.y);                                        // the flat base at q.y = 0
      return 1.0 - smoothstep(-0.03, 0.03, d);
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
        cl = max(cl, puff(c - vec2(x * s, y), r, fi + 1.0) * (0.55 + 0.4 * hash(vec2(fi, 5.0))));
      }
      g = mix(g, vec3(0.97, 0.97, 1.0), cl * 0.9 * uCloudVis);
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

      // sky dimmer: keep the world readable against the darkened backdrop.
      // The darkest colors get a gentle lift, as if everything held a faint
      // inner light — black stays dark, just never swallowed.
      if (uSkyDim > 0.001 && s.a > 0.001) {
        vec3 c = s.rgb / s.a;
        float sl = dot(c, vec3(0.299, 0.587, 0.114));
        c += (1.0 - smoothstep(0.0, 0.75, sl)) * uSkyDim * (0.3 * c + 0.12);
        s.rgb = c * s.a;
      }

      vec3 ground = sky(uv) * (1.0 - uSkyDim);   // sky dimmer: background only
      // fade distance: things well behind the subject melt into the sky, so
      // the subject stays vivid and the rest goes quiet
      if (uFade > 0.001 && s.a > 0.001) {
        float dz = mix(${camera.near.toFixed(3)}, ${camera.far.toFixed(1)}, texture2D(tDepth, uv).r);
        float far = smoothstep(uSubject + 6.0, uSubject + 60.0, dz);
        s.rgb = mix(s.rgb, ground * s.a, far * uFade * 0.85);
      }
      vec3 col = ground * (1.0 - s.a) + s.rgb;   // scene is premultiplied
      // ...and the world's light bleeds softly onto the dark sky around it
      if (uSkyDim > 0.01) {
        vec2 gpv = (6.0 * uRes.y / 1080.0) / uRes;
        vec4 nb = vec4(0.0);
        for (int i = 0; i < 8; i++) {
          float an = TAU * (float(i) + 0.5) / 8.0;
          nb += texture2D(tScene, uv + vec2(cos(an), sin(an)) * gpv);
        }
        nb /= 8.0;
        col += nb.rgb * max(0.0, nb.a - s.a) * 0.4 * uSkyDim;
      }

      // dream glass: the world as if through fogged or wet glass — a soft
      // blur, and the bright parts bleeding a gentle glow. The sky gradient
      // stays smooth underneath; grain stays crisp on top, like the glass.
      if (uDream > 0.001) {
        // Soft blur: 32 taps on a golden-angle spiral, gaussian-weighted and
        // turned a little per pixel, so there are no rings or steps — just
        // an even, creamy softness.
        float rpx = (2.5 + 6.0 * uDream) * uRes.y / 1080.0;
        vec2 px = rpx / uRes;
        float rot = hash(gl_FragCoord.xy) * TAU;
        vec4 b = vec4(0.0);
        float wsum = 0.0;
        for (int i = 0; i < 32; i++) {
          float fi = float(i) + 0.5;
          float r = sqrt(fi / 32.0);
          float an = fi * 2.39996323 + rot;
          float w = exp(-r * r * 2.2);
          b += texture2D(tScene, uv + vec2(cos(an), sin(an)) * r * px * 1.6) * w;
          wsum += w;
        }
        b /= wsum;
        vec3 colB = ground * (1.0 - b.a) + b.rgb;
        // Wide halo: a second, much larger and fainter pass — the glow light
        // gets in fogged glass. Only the brighter parts feed it.
        vec4 h = vec4(0.0);
        float hsum = 0.0;
        for (int i = 0; i < 16; i++) {
          float fi = float(i) + 0.5;
          float r = sqrt(fi / 16.0);
          float an = fi * 2.39996323 - rot;
          float w = exp(-r * r * 1.5);
          h += texture2D(tScene, uv + vec2(cos(an), sin(an)) * r * px * 6.0) * w;
          hsum += w;
        }
        h /= hsum;
        vec3 colH = ground * (1.0 - h.a) + h.rgb;
        float lh = dot(colH, vec3(0.299, 0.587, 0.114));
        // blend: sharp → soft, then the halo screened on (never clips harsh)
        col = mix(col, colB, smoothstep(0.0, 1.0, uDream) * 0.75);
        vec3 glow = colH * smoothstep(0.25, 0.95, lh) * 0.45 * uDream;
        col = 1.0 - (1.0 - col) * (1.0 - glow);
        // a whisper of milkiness, like condensation catching the light
        col = mix(col, col * 0.92 + 0.08 * colH, 0.5 * uDream);
      }
      // bloom: only the bright parts of the world (lit windows, lamps, signs,
      // screens) glow outward, wide and soft. Added with a screen blend and a
      // soft cap, so it never burns anything out to flat white.
      if (uBloom > 0.001) {
        vec2 bpx = (14.0 * uRes.y / 1080.0) / uRes;
        float brot = hash(gl_FragCoord.xy + 7.0) * TAU;
        vec3 bl = vec3(0.0);
        float bsum = 0.0;
        for (int i = 0; i < 20; i++) {
          float fi = float(i) + 0.5;
          float r = sqrt(fi / 20.0);
          float an = fi * 2.39996323 + brot;
          vec4 t = texture2D(tScene, uv + vec2(cos(an), sin(an)) * r * bpx);
          vec3 tc = t.a > 0.001 ? t.rgb / t.a : vec3(0.0);
          float tl = dot(tc, vec3(0.299, 0.587, 0.114));
          float w = exp(-r * r * 1.8);
          bl += tc * t.a * smoothstep(0.55, 0.95, tl) * w;
          bsum += w;
        }
        bl = bl / bsum * uBloom * 0.9;
        bl = bl / (1.0 + bl);                              // soft cap
        col = 1.0 - (1.0 - col) * (1.0 - bl);
      }
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
      // saturation, on its own
      float lum2 = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum2), col, uSat);
      // shadow lift: the darkest tones come up a little (keeping their hue),
      // so dark shapes don't vanish on fabric; mid and bright tones untouched
      float sh = pow(1.0 - clamp(lum2, 0.0, 1.0), 3.0);
      col += (col * 0.6 + 0.07) * sh * uLift;

      // edges darken softly (a small amount always, more with Darken edges)
      vec2 vc = vUv - 0.5;
      col *= 1.0 - dot(vc, vc) * 0.16;
      float er = length(vc * vec2(1.0, 1.15)) * 1.6;
      col *= 1.0 - smoothstep(0.35, 1.05, er) * uEdge * 0.85;
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
let autoOrb = 0, autoOrbSpeed = 0;   // auto orbit: extra turn (deg) and its eased speed
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
  'halftone', 'grain', 'timezone', 'darkness', 'split', 'rain', 'snow', 'dream',
  'bloom', 'saturation', 'shadowLift', 'edgeDark', 'distFade',
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
// the show opens on black and stays black until the controller activates a
// song (any eased change); then it fades in on that song. ?noblack skips it.
let holdBlack = !params.has('noblack');
let lastCue = target.cameraCue;
let easeBoostUntil = 0;
let strokeMode = null;
if (!params.has('cloudsOn')) target.cloudsOn = false;   // clouds start off (the controller can switch them on)
cloudsVis = target.cloudsOn ? 1 : 0;           // start as the switch says (no fade on load)
let halftoneAmt = target.halftoneOn ? 1 : 0;   // eased: the halftone dots fade in / out
let breath = target.breatheOn ? 1 : 0;   // eased slowly, so breathing starts and stops gently
let ripple = target.rippleOn ? 1 : 0;     // the ripple switch fades over ~3 s
// Floating / Displacement moves at a steady pace with a soft start and stop,
// so going from float to scatter visibly breaks apart (about 2 s per step of 1)
const floatAnim = { from: target.floatIntensity, to: target.floatIntensity, start: 0, dur: 0 };
let sunSide = null;                        // eased 0..1: which island has the sun
// the sun and moon on screen: where each wants to be, and where it is (springs)
const sunGoal = new THREE.Vector2(), moonGoal = new THREE.Vector2();
const sunPos = new THREE.Vector2(), moonPos = new THREE.Vector2();
const sunVel = new THREE.Vector2(), moonVel = new THREE.Vector2();
let skyBodiesReady = false;

world.setLayout(target.layoutSeed, performance.now() / 1000, true);
rig.jump(specOf(target));
cur.zoom = target.zoom; cur.cameraAngle = target.cameraAngle;

function applyState(s, ease) {
  const prev = target;
  target = sanitize(s);
  const nowSec = performance.now() / 1000;
  world.setLayout(target.layoutSeed, nowSec);
  // first song of the show: lift the black. Under the black everything lands
  // at once (camera jumps, sky + light settle fast), then it fades in.
  const reveal = holdBlack && ease;
  if (reveal) { holdBlack = false; blackStart = nowSec; }
  if (target.cameraCue !== lastCue || target.cameraPreset !== prev.cameraPreset || reveal) {
    lastCue = target.cameraCue;
    const p = specOf(target);
    if (reveal && p.overlay !== 'airplane') rig.jump(p);
    else if (p.overlay === 'airplane') {
      // song 1: start from black and fade in on the windows
      rig.jump(p);
      blackStart = nowSec;
      air = 1;
    } else rig.go(p, target.transition * (p.durationScale || 1), nowSec);
    // the rig interpolates zoom/angle itself during a transition
    cur.zoom = target.zoom; cur.cameraAngle = target.cameraAngle; cur.cameraOrbit = target.cameraOrbit;
    cur.cameraPanX = target.cameraPanX; cur.cameraPanY = target.cameraPanY; cur.cameraPanZ = target.cameraPanZ;
    autoOrb = 0;       // the move to the new view absorbs any auto-orbit turn
    freecam.reset();   // a new cue starts clean, so saved song views land exactly
  }
  if (ease) {
    // A song change: sky, hour, light and effects all travel together on one
    // slow, eased timeline (soft start, soft landing), at least as long as
    // the camera move and never shorter than ~6 s — so nothing pops.
    const p = specOf(target);
    const camDur = rig.transitioning ? rig.endTime - nowSec : target.transition * (p.durationScale || 1);
    startAtmo(nowSec, reveal ? 0.35 : Math.max(ATMO_MIN, camDur * 1.25));
  }
}

// ---- the atmosphere timeline (song changes)
const ATMO_MIN = 6;
const ATMO_KEYS = EASED.filter(k => k !== 'floatIntensity' && k !== 'zoom' && !k.startsWith('camera'));
let atmo = null;
// camera pan left/right, in screen widths: a soft spring, so a press starts
// slowly, glides, and settles without a bump
let panS = target.panScreen || 0, panV = 0;
const panRight = new THREE.Vector3(), panInvQ = new THREE.Quaternion();
const mixL = (a, b, u) => ({ e: a.e + (b.e - a.e) * u, night: a.night + (b.night - a.night) * u, golden: a.golden + (b.golden - a.golden) * u });
function startAtmo(nowSec, dur) {
  atmo = {
    start: nowSec, dur,
    from: Object.fromEntries(ATMO_KEYS.map(k => [k, cur[k]])),
    col: Object.fromEntries(COLORS.map(k => [k, cur[k].clone()])),
    hour, LA: { ...LA }, LB: { ...LB },
  };
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
// ?room=CODE (Share live): also follow a controller in another browser or on
// another computer, through the online relay. Same-browser control still works.
{
  const room = params.get('room');
  if (room) {
    relayListener(room, (kind, data) => {
      if (kind === 'state' && data.state) applyState(data.state, !!data.ease);
      else if (kind === 'clock') syncClock(data);
    });
  }
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
  autoOrb = 0;       // the saved view already holds where the auto orbit had turned to
  target.panScreen = 0; panS = 0; panV = 0;   // ...and the left/right pan
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
function drawFrame(now) {
  const nowSec = now / 1000;
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));   // the first frame can arrive "before" start
  const clockDt = Math.max(0, Math.min(3600, (now - last) / 1000));   // real time, for the loop clock
  last = now;
  fps += ((dt > 0 ? 1 / dt : 60) - fps) * 0.05;
  frame++;

  // ease every continuous parameter toward its target. Outside a song
  // change, things glide there exponentially (slider moves feel live).
  // During a song change, the atmosphere timeline below drives them instead.
  const k = 1 - Math.exp(-dt * 2.4);
  const kCam = 1 - Math.exp(-dt * 2.4);
  // where the song-change timeline is: 0..1, smootherstep (no sudden start or stop)
  let atmoE = -1;
  if (atmo) {
    const u = Math.min(1, (nowSec - atmo.start) / atmo.dur);
    atmoE = u * u * u * (u * (u * 6 - 15) + 10);
    if (u >= 1) atmo = null;
  }
  if (target.floatIntensity !== floatAnim.to) {
    floatAnim.from = cur.floatIntensity;
    floatAnim.to = target.floatIntensity;
    floatAnim.start = nowSec;
    // slow and steady: ~5.5 s float → separate, ~12 s all the way to scatter
    floatAnim.dur = Math.max(3, 2.5 + Math.abs(floatAnim.to - floatAnim.from) * 2.5);
  }
  {
    const u = floatAnim.dur > 0 ? Math.min(1, (nowSec - floatAnim.start) / floatAnim.dur) : 1;
    // constant speed through the middle, with short soft ramps at each end
    // (no rush in the middle, so pieces drift apart evenly instead of leaping)
    const R = 0.18;                                   // fraction of the time spent ramping, each end
    const vmax = 1 / (1 - R);
    const e = u < R ? 0.5 * vmax * u * u / R
      : u > 1 - R ? 1 - 0.5 * vmax * (1 - u) * (1 - u) / R
      : 0.5 * vmax * R + vmax * (u - R);
    cur.floatIntensity = floatAnim.from + (floatAnim.to - floatAnim.from) * e;
  }
  for (const key of EASED) {
    // floating / displacement drifts apart and back together over ~3 s
    if (key === 'floatIntensity') continue;   // its own steady animation, below
    const isCam = key === 'zoom' || key.startsWith('camera');
    if (atmoE >= 0 && !isCam) { cur[key] = atmo ? atmoFrom(key) : target[key]; continue; }
    const kk = isCam ? kCam : k;
    if (key === 'zoom') cur.zoom = Math.exp(Math.log(cur.zoom) + (Math.log(target.zoom) - Math.log(cur.zoom)) * kk);
    else cur[key] += (target[key] - cur[key]) * kk;
    // land exactly on the target, so e.g. scattered objects return precisely home
    if (Math.abs(target[key] - cur[key]) < 1e-4) cur[key] = target[key];
  }
  function atmoFrom(key) { return atmo.from[key] + (target[key] - atmo.from[key]) * atmoE; }
  const hourDelta = (a, b) => ((((b - a) % 24) + 36) % 24 - 12);   // the shorter way round
  if (atmoE >= 0) {
    // song change: sky colors crossfade, and the light crossfades straight
    // from the old hour's look to the new one — it doesn't race through
    // every hour in between (no flash of sunset on the way to night)
    for (const key of COLORS) {
      if (atmo) cur[key].copy(atmo.col[key]).lerp(tmpColor.set(target[key]), atmoE);
      else cur[key].set(target[key]);
    }
    if (atmo) {
      hour = atmo.hour + hourDelta(atmo.hour, target.twHour) * atmoE;
      LB = mixL(atmo.LB, lightAt(target.twHour), atmoE);          // Taiwan
      LA = mixL(atmo.LA, lightAt(target.twHour + 12), atmoE);     // New York
    } else {
      hour = target.twHour; LB = lightAt(hour); LA = lightAt(hour + 12);
    }
    hour = ((hour % 24) + 24) % 24;
  } else {
    for (const key of COLORS) cur[key].lerp(tmpColor.set(target[key]), k);
    // the clock: ease the shorter way round (23:00 -> 00:00 moves forward)
    hour += hourDelta(hour, target.twHour) * k;
    hour = ((hour % 24) + 24) % 24;
    LB = lightAt(hour);                                   // Taiwan
    LA = lightAt(hour + 12);                              // New York, always 12 h apart
  }
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

  // auto orbit: the camera keeps circling, one turn a minute; it eases in and
  // out over ~2 s, and stays wherever it was when switched off
  autoOrbSpeed += ((target.autoOrbit ? 1 : 0) - autoOrbSpeed) * (1 - Math.exp(-dt * 1.5));
  if (!target.autoOrbit && autoOrbSpeed < 1e-3) autoOrbSpeed = 0;
  autoOrb = (autoOrb + dt * autoOrbSpeed * 6) % 360;
  const elevation = cur.cameraAngle, zoom = cur.zoom, orbit = cur.cameraOrbit + autoOrb;
  const pan = camPan.set(cur.cameraPanX, cur.cameraPanY, cur.cameraPanZ);
  // pan left/right: a critically damped spring toward the target (≈2.5 s,
  // soft start and soft stop), then shifted along the screen's own
  // left-right, so it follows the camera even while it orbits
  {
    const w = 2.2, goal = target.panScreen || 0;
    panV += ((goal - panS) * w * w - 2 * w * panV) * dt;
    panS += panV * dt;
    if (Math.abs(goal - panS) < 1e-4 && Math.abs(panV) < 1e-4) { panS = goal; panV = 0; }
    if (panS !== 0) {
      camera.getWorldDirection(panRight);
      panRight.set(-panRight.z, 0, panRight.x);           // horizontal, to the screen's right
      if (panRight.lengthSq() > 1e-6) {
        panRight.normalize();
        panRight.applyQuaternion(panInvQ.copy(rig.frameQuat).invert());   // into the view's frame
        const width = (camera.right - camera.left) / camera.zoom;
        pan.addScaledVector(panRight, panS * width);
      }
    }
  }

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
    // a saved view names its room in scene; a built-in room camera says scene: true
    presetId: (typeof rig.preset.scene === 'string' && rig.preset.scene) || rig.preset.id,
    breathe: breath,
    bridgeLights: !!SONG_SCENES[target.activeSong]?.bridge?.lights,
    bridgeSpin: !!SONG_SCENES[target.activeSong]?.bridge?.spin,
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
  CLIP.z.value = rig.clip.z;
  CLIP.fade.value = rig.clip.fade;
  if (frame % 60 === 1) clipAll();   // new objects get the dissolve too
  freecam.apply(); // TEMP free camera
  camera.updateMatrixWorld();
  camera.getWorldDirection(viewDir);
  shared.uViewDir.value.copy(viewDir);

  // the cabin windows: in quickly; out slowly over the whole camera move
  const airTarget = rig.preset.overlay === 'airplane' ? 1 : 0;
  const airOut = Math.max(0.8, target.transition * (rig.preset.durationScale || 1));
  air = airTarget ? Math.min(1, air + dt / 0.8) : Math.max(0, air - dt / airOut);
  let black = holdBlack ? 1 : 0;
  if (blackStart >= 0) {
    const u = Math.min(1, Math.max(0, (nowSec - blackStart - 0.4) / 3));
    black = 1 - u * u * (3 - 2 * u);
    if (u >= 1) blackStart = -1;
  }

  cloudsVis += ((target.cloudsOn ? 1 : 0) - cloudsVis) * (1 - Math.exp(-dt * 1.2));
  if (Math.abs((target.cloudsOn ? 1 : 0) - cloudsVis) < 1e-3) cloudsVis = target.cloudsOn ? 1 : 0;
  clouds.group.visible = cloudsVis > 0.001;
  clouds.update({
    phase: cloudPhase, ph, camera, camTarget: rig.pose.target,
    amount: cur.clouds, density: cur.cloudDensity, opacity: cur.cloudOpacity * cloudsVis, softness: cur.cloudSoftness,
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
  // places at a steady pace (about 7 s), and pass one above the other.
  const sTarget = LA.e > LB.e ? 1 : 0;                  // 1 = New York has the sun
  if (sunSide === null) sunSide = sTarget;
  sunSide += Math.max(-dt / 7, Math.min(dt / 7, sTarget - sunSide));
  const sA = sunSide * sunSide * sunSide * (sunSide * (sunSide * 6 - 15) + 10);
  const sunX = THREE.MathUtils.lerp(xB, xA, sA), moonX = THREE.MathUtils.lerp(xA, xB, sA);
  let sunY = 0.6 + 0.22 * Math.min(1, Math.max(0, Math.max(LA.e, LB.e)));
  let moonY = 0.86;
  // keep apart vertically, never by jumping sideways: the sun dips, the moon lifts
  const near = Math.max(Math.sin(Math.PI * sA) * 0.12, Math.max(0, 0.2 - Math.abs(sunX - moonX)) * 0.6);
  sunY -= near; moonY = Math.min(0.94, moonY + near * 0.4);
  // Where they want to be follows the camera and the islands, which can move
  // quickly (a song change swings the whole view). The sun and moon never
  // jump there: each glides on a soft spring (~2 s), easing out of rest and
  // settling without overshoot, so they drift across the sky like real ones.
  sunGoal.set(sunX, sunY).lerp(pinSun, henge);
  moonGoal.set(moonX, moonY);
  if (!skyBodiesReady) { sunPos.copy(sunGoal); moonPos.copy(moonGoal); skyBodiesReady = true; }
  {
    const w = 1.7, h = Math.min(dt, 0.05);
    for (const [P, V, G] of [[sunPos, sunVel, sunGoal], [moonPos, moonVel, moonGoal]]) {
      V.x += ((G.x - P.x) * w * w - 2 * w * V.x) * h;
      V.y += ((G.y - P.y) * w * w - 2 * w * V.y) * h;
      P.x += V.x * h; P.y += V.y * h;
    }
  }
  U.uSunUvA.value.copy(sunPos);
  U.uMoonUvA.value.copy(moonPos);
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
  // (only when Halftone dots is on in the Scrim panel; it fades in and out)
  halftoneAmt += ((target.halftoneOn ? 1 : 0) - halftoneAmt) * (1 - Math.exp(-dt * 1.5));
  post.uniforms.uHalftone.value = (0.5 + 0.2 * Math.sin(TAU * ph * 3)) * halftoneAmt;
  post.uniforms.uFrame.value = frame;
  post.uniforms.uAir.value = air;
  post.uniforms.uBlack.value = black;
  post.uniforms.uRipple.value = ripple;
  post.uniforms.uPunch.value = cur.contrast;
  post.uniforms.uSkyDim.value = cur.skyDim;
  post.uniforms.uDream.value = cur.dream;
  post.uniforms.uCloudVis.value = cloudsVis;
  post.uniforms.uBloom.value = cur.bloom;
  post.uniforms.uSat.value = cur.saturation;
  post.uniforms.uLift.value = cur.shadowLift;
  post.uniforms.uEdge.value = cur.edgeDark;
  post.uniforms.uFade.value = cur.distFade;
  post.uniforms.uSubject.value = camera.position.distanceTo(rig.pose.target);

  // street lamps glow with the night on their side of the world
  for (const h of LAMP_HALOS) {
    h.getWorldPosition(haloPos);
    const w = fall(WORLD.tzBlend[0], WORLD.tzBlend[1], haloPos.x);
    const n = shared.uNightA.value + (shared.uNightB.value - shared.uNightA.value) * w;
    h.material.opacity = Math.min(0.5, n * 0.5) * (h.userData.flicker ?? 1);   // kept soft: many glows overlap
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
}
// The next frame is always asked for first, so an error in one frame skips
// that frame instead of freezing the projection.
let frameErrors = 0;
function tick(now) {
  requestAnimationFrame(tick);
  try {
    drawFrame(now);
  } catch (err) {
    if (frameErrors++ < 3) console.error('frame skipped:', err);
  }
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
