// Camera rig: turns a preset (anchor + angles + distance + zoom) into an
// orthographic camera pose every frame, and moves between presets at a
// steady speed. The target is re-evaluated every frame during a transition,
// so the camera lands precisely on things that are moving (a window on a
// spinning island, a drifting point under the airplane).

import * as THREE from 'three';
import { presetById, isView } from './presets.js';

const V3 = THREE.Vector3;
const d2r = THREE.MathUtils.degToRad;
const llerp = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
const r2 = (v, n = 1000) => Math.round(v * n) / n;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));   // angle into -π..π
// a view direction as azimuth (round the vertical axis) and elevation
const azEl = (d) => ({ az: Math.atan2(d.x, d.z), el: Math.asin(Math.min(1, Math.max(-1, d.y))) });
// Orthographic: distance doesn't change the picture, only what gets cut off
// in front of the camera. Normal views sit far back so nothing is clipped.
// Short distances (< 20) are deliberate cutaways that put the camera just
// outside a wall (window close-ups, interiors, street level); they only hold
// while the camera is still zoomed in close. Zoomed out, a short distance
// would slice through everything between camera and target, so it falls
// back to FAR_BACK.
export const FAR_BACK = 320;
export function safeDistance(spec, zoom) {
  const d = spec.distance ?? 100;
  if (d >= 20) return FAR_BACK;
  return zoom >= 0.6 * (spec.zoom ?? zoom) ? d : FAR_BACK;
}

// a preset id, a preset, or a saved view: all go through the same rig
const asSpec = (x) => (isView(x) ? x : presetById(typeof x === 'string' ? x : x?.id));

// Close-ups cut at the distance saved with their view (just outside the wall
// or window they look through). That cut is fixed, so it never flickers.
// During a move nothing is cut, so nothing gets sliced open on the way.
// Instead, what stands in front of a close-up dissolves in a fine dot pattern
// (see clip, used by the viewer): leaving a close-up, it fades back in over
// the first 30% of the move; arriving at one, it fades away over the last
// 30%. Nothing pops in or out of the picture.
const LEAVE = 0.3, ARRIVE = 0.7;

export function createCameraRig(camera, anchors) {
  const pose = { target: new V3(0, 0.5, -1), dir: new V3(0, 0.5, 0.866).normalize(), dist: 140, zoom: 0.56 };
  let lastDist = FAR_BACK;
  const clip = { z: 0, fade: 0 };   // dissolve things nearer the camera than z (fade 0..1)
  const des = { target: new V3(), dir: new V3(), dist: 1, zoom: 1 };
  const q = new THREE.Quaternion();
  const p = new V3();
  let preset = presetById('overview');
  let trans = null;
  let progress = 1;

  function desired(pr, elevation, zoom, orbit, pan) {
    const a = anchors[pr.anchor] || anchors.world;
    a.updateWorldMatrix(true, false);
    p.setFromMatrixPosition(a.matrixWorld);
    if (pr.frame === 'local') a.getWorldQuaternion(q); else q.identity();
    des.target.fromArray(pr.target || [0, 0, 0]);
    if (pan) des.target.add(pan);
    des.target.applyQuaternion(q).add(p);
    const az = d2r((pr.azimuth || 0) + orbit), el = d2r(Math.min(85, Math.max(-20, elevation)));
    des.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).applyQuaternion(q).normalize();
    des.zoom = Math.max(0.05, zoom);
    des.dist = safeDistance(pr, des.zoom);
  }

  function go(id, duration, nowSec) {
    preset = asSpec(id);
    trans = {
      from: { target: pose.target.clone(), dir: pose.dir.clone(), dist: pose.dist, zoom: pose.zoom, cut: lastDist },
      start: nowSec,
      dur: Math.max(0.05, duration),
    };
    progress = 0;
  }

  function jump(id) { preset = asSpec(id); trans = null; progress = 1; }

  // Turn a finished camera (where it looks, which way, how zoomed) into a
  // saved view. src is the camera it was framed from: if that one follows
  // something, the view is stored relative to it and keeps following;
  // otherwise it is a fixed spot in the world. A scene camera (cabin windows,
  // an interior) passes its scene on.
  const iq = new THREE.Quaternion();
  const tL = new V3(), dL = new V3();
  function makeView(src, target, dir, zoom) {
    const follow = !!src.follow;
    const anchor = follow ? src.anchor : 'world';
    const frame = follow ? (src.frame || 'world') : 'world';
    tL.copy(target); dL.copy(dir).normalize();
    if (follow) {
      const a = anchors[anchor] || anchors.world;
      a.updateWorldMatrix(true, false);
      p.setFromMatrixPosition(a.matrixWorld);
      tL.sub(p);
      if (frame === 'local') { a.getWorldQuaternion(iq).invert(); tL.applyQuaternion(iq); dL.applyQuaternion(iq); }
    }
    const view = {
      anchor, frame,
      target: [r2(tL.x), r2(tL.y), r2(tL.z)],
      azimuth: r2(THREE.MathUtils.radToDeg(Math.atan2(dL.x, dL.z)), 100),
      elevation: r2(THREE.MathUtils.radToDeg(Math.asin(Math.min(1, Math.max(-1, dL.y)))), 100),
      // a cutaway distance only survives if the view is still a close-up
      distance: (src.distance ?? 100) < 20 && zoom >= 0.6 * (src.zoom ?? zoom) ? src.distance : 100,
      zoom: r2(zoom),
      follow,
      label: src.label || src.name || '',
    };
    if (src.scene) view.scene = typeof src.scene === 'string' ? src.scene : src.id;
    if (src.overlay) view.overlay = src.overlay;
    if (src.sun) view.sun = src.sun;
    if (src.durationScale) view.durationScale = src.durationScale;
    if (src.effects) {               // e.g. window light for a window close-up; the hour + sky are saved separately
      const { timezone, twHour, ...fx } = src.effects;
      if (Object.keys(fx).length) view.effects = fx;
    }
    return view;
  }

  // Where a camera would be with these slider values, without moving it.
  function resolve(spec, elevation, zoom, orbit, pan) {
    desired(asSpec(spec), elevation, zoom, orbit, pan);
    return { target: des.target.clone(), dir: des.dir.clone(), zoom: des.zoom };
  }

  function update(nowSec, elevation, zoom, orbit, pan) {
    desired(preset, elevation, zoom, orbit, pan);
    let cut = FAR_BACK;
    clip.fade = 0;
    if (trans) {
      // Big turns (more than 90°) get more time and a rise in the middle,
      // so the camera curves up over the scene instead of whipping round.
      if (trans.turn === undefined) {
        const a = azEl(trans.from.dir), b = azEl(des.dir);
        const dAz = Math.abs(wrapPi(b.az - a.az));
        const turn = Math.acos(Math.min(1, Math.max(-1, trans.from.dir.dot(des.dir))));
        trans.turn = Math.max(turn, dAz * Math.cos((a.el + b.el) / 2));
        const big = Math.min(1, Math.max(0, (trans.turn - Math.PI / 2) / (Math.PI / 2)));   // 0 at 90°, 1 at 180°
        trans.dur *= 1 + 1.5 * big;                                   // up to 2.5× longer
        trans.lift = big * 0.45;                                      // up to ~25° higher at the middle
      }
      const t = Math.min(1, Math.max(0, (nowSec - trans.start) / trans.dur));
      const e = t;   // constant speed from start to end
      progress = e;
      // Zoom changes by a constant factor per second; the slide across the
      // world is paced against it so the picture pans at one steady speed on
      // screen (a plain blend would whip in at the end when zooming in).
      const r = des.zoom / trans.from.zoom;
      const s = Math.abs(r - 1) < 1e-3 ? e : (1 - Math.pow(r, -e)) / (1 - 1 / r);
      pose.target.lerpVectors(trans.from.target, des.target, s);
      // orbit at a steady pace: around the vertical axis the short way, and
      // up/down in step, plus the rise in the middle of a big turn. (A plain
      // rotation between near-opposite views could tip over a random axis.)
      {
        const a = azEl(trans.from.dir), b = azEl(des.dir);
        const az = a.az + wrapPi(b.az - a.az) * e;
        // the rise never goes past 80° (or past the steeper end, so a view saved at 85° lands smoothly)
        const el = Math.min(Math.max(d2r(80), a.el, b.el), a.el + (b.el - a.el) * e + trans.lift * Math.sin(Math.PI * e));
        pose.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      }
      pose.dist = llerp(trans.from.dist, des.dist, e);
      pose.zoom = llerp(trans.from.zoom, des.zoom, e);
      cut = FAR_BACK;
      if (e < LEAVE && trans.from.cut < FAR_BACK) {
        clip.fade = 1 - e / LEAVE;
        clip.z = FAR_BACK - trans.from.cut;
      }
      if (e > ARRIVE && des.dist < FAR_BACK) {
        clip.fade = Math.min(1, (e - ARRIVE) / (1 - ARRIVE));
        clip.z = FAR_BACK - des.dist;   // depth from the camera of the coming cut
      }
      if (t >= 1) trans = null;
    } else {
      pose.target.copy(des.target);
      pose.dir.copy(des.dir);
      pose.dist = des.dist;
      pose.zoom = des.zoom;
      cut = des.dist;
    }
    const dist = lastDist = cut;
    camera.position.copy(pose.target).addScaledVector(pose.dir, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(pose.target);
    camera.zoom = pose.zoom;
    camera.updateProjectionMatrix();
  }

  return {
    go, jump, update, pose, makeView, resolve, clip,
    get preset() { return preset; },
    get frameQuat() { return q; },   // the preset's frame (identity unless frame: 'local')
    get transitioning() { return !!trans; },
    get endTime() { return trans ? trans.start + trans.dur : 0; },   // when the current move lands
    get progress() { return progress; },
  };
}
