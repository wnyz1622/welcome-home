// The archipelago: two main islands (New York, Taiwan), small satellite
// islands of memory (suitcase, lighthouse, a standing window, a tiny house,
// stairs to nowhere, a lone gable wall), an airliner passing over, and the
// displacement system that lets everything come apart and return.

import * as THREE from 'three';
import { C, MAX_HOUSES, LOOP_SECONDS, WORLD, rand } from './config.js';
import {
  gableHouse, nyTower, twWalkup, doorToElsewhere,
  stairsToNowhere, gableWall, standingWindow, suitcase,
  lighthouse, airplane, satellitePlatform, islandPlinth,
  mountainRange, utilityPole, flyingHouse, subwayEntrance, busStop, grove,
  manhattanGrid, skyscraper, taxi, suspensionBridge, ladderToWindow, bag as makeBag, luggageHill,
  streetLamp, spiralStairs, portal,
  miniBus, animateBusStop, animateLuggage, lookoutRoom, bathroomRoom, ringRoad,
  bigApple, windmill, departuresBoard,
  schoolFish, bigClock, fireflies, diningRoom, animateSteam, laundryLine, animateLaundry, steadyGlow,
} from './architecture.js';
import { makeBird } from './birds.js';
import { LIGHTS, toon, mesh, faceted } from './materials.js';

const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + ((((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI) * t;
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// ------------------------------------------------------------- outlines

// Manhattan: long and narrow, squared-off sides, the south end tapering.
// Its length runs along local x (north = +x), the avenues run with it.
const manhattanR = (th) => {
  const c = Math.cos(th), s = Math.sin(th);
  const south = Math.max(0, -c);
  const LX = 12 * (1 - 0.07 * south);
  const RZ = 4.3 * (1 - 0.4 * Math.pow(south, 8)) * (1 - 0.12 * Math.pow(Math.max(0, c), 4));
  const p = 4.5;
  return Math.pow(Math.pow(Math.abs(c) / LX, p) + Math.pow(Math.abs(s) / RZ, p), -1 / p);
};

// Taiwan: a long, tapering leaf of land, set on a diagonal.
const leafR = (th) => {
  const a = th + 0.45;
  const rx = 10.4, rz = 5.9;
  const e = 1 / Math.sqrt(Math.pow(Math.cos(a) / rx, 2) + Math.pow(Math.sin(a) / rz, 2));
  return e * (1 + 0.11 * Math.cos(a)) * (1 - 0.05 * Math.cos(3 * a + 0.6));
};

const inside = (radial, x, z, margin) => Math.hypot(x, z) < radial(Math.atan2(z, x)) - margin;

// Taiwan's mountain ridge runs along the leaf's long axis (unit vector RX, RZ).
const RX = Math.cos(-0.45), RZ = Math.sin(-0.45);
const RIDGE = { length: 7.5, width: 2.0 };
const onRidge = (x, z, margin) => {
  const al = x * RX + z * RZ, pe = -x * RZ + z * RX;
  const half = RIDGE.width * Math.max(0, 1 - Math.pow(al / RIDGE.length, 2));
  return half > 0 && Math.abs(pe) < half + margin;
};

// ------------------------------------------------------------- displacement
//
// Every object that can come loose stores its original transform plus a
// fixed (seeded) direction, distance, spin and threshold. Each frame its
// displacement is computed from scratch from the global amount S (0..1),
// so it is fully reversible: no accumulated error, nothing gets lost.

const CATS = {
  window: { th: [0.0, 0.35], mag: [0.8, 3.2], up: [-0.2, 0.8], spin: 1.2 },
  part: { th: [0.05, 0.45], mag: [1.0, 4.0], up: [0.0, 1.0], spin: 1.0 },
  roof: { th: [0.05, 0.4], mag: [1.5, 5.5], up: [0.6, 1.0], spin: 0.8 },
  road: { th: [0.3, 0.62], mag: [1.0, 5.0], up: [0.2, 1.0], spin: 0.6 },
  fragment: { th: [0.15, 0.5], mag: [3.0, 9.0], up: [0.0, 0.8], spin: 1.0 },
  house: { th: [0.25, 0.6], mag: [3.0, 11.0], up: [0.1, 0.9], spin: 0.7 },
  satellite: { th: [0.4, 0.68], mag: [4.0, 12.0], up: [-0.4, 0.8], spin: 0.8 },
  layer: { th: [0.5, 0.68], mag: [2.0, 8.0], up: [-1.0, -0.3], spin: 0.35 },
  ground: { th: [0.62, 0.7], mag: [1.0, 3.0], up: [-0.6, 0.2], spin: 0.15 },
};

function createScatter(seed) {
  const r = rand(seed);
  const items = [];
  const tmp = new V3();

  function add(obj, cat, { dynamic = false, outward = null } = {}) {
    const c = CATS[cat];
    let dir;
    if (outward && outward.lengthSq() > 1e-4) {
      const v = outward.clone().setY(0).normalize();
      dir = new V3(v.x + r.f(-0.5, 0.5), r.f(c.up[0], c.up[1]), v.z + r.f(-0.5, 0.5)).normalize();
    } else {
      dir = new V3(r.f(-1, 1), r.f(c.up[0], c.up[1]), r.f(-1, 1)).normalize();
    }
    const it = {
      obj, dynamic,
      basePos: obj.position.clone(),
      baseRot: obj.rotation.clone(),
      dir, mag: r.f(c.mag[0], c.mag[1]),
      spin: new V3(r.f(-1, 1), r.f(-1, 1), r.f(-1, 1)).multiplyScalar(c.spin * Math.PI * 0.5),
      th: r.f(c.th[0], c.th[1]),
      k: r.i(1, 3), ph: r.next(),
      e: 0, off: new V3(),
    };
    obj.userData.scatter = it;
    items.push(it);
    return it;
  }

  function update(S, ph) {
    for (const it of items) {
      let e = 0;
      if (S > it.th) { const s = Math.min(1, (S - it.th) / 0.3); e = s * s * (3 - 2 * s); }
      it.e = e;
      if (e > 0) {
        const drift = 0.08 * it.mag * e;
        it.off.copy(it.dir).multiplyScalar(it.mag * e).add(tmp.set(
          Math.sin(TAU * (ph * it.k + it.ph)) * drift,
          Math.sin(TAU * (ph * (it.k + 1) + it.ph * 2)) * drift * 0.6,
          Math.cos(TAU * (ph * it.k + it.ph * 3)) * drift));
      } else {
        it.off.set(0, 0, 0);
      }
      if (!it.dynamic) {
        it.obj.position.copy(it.basePos).add(it.off);
        it.obj.rotation.set(it.baseRot.x + it.spin.x * e, it.baseRot.y + it.spin.y * e, it.baseRot.z + it.spin.z * e);
      }
    }
  }

  // for objects whose base pose is animated elsewhere: call after setting it
  function apply(obj) {
    const it = obj.userData.scatter;
    if (!it || it.e === 0) return;
    obj.position.add(it.off);
    obj.rotation.x += it.spin.x * it.e;
    obj.rotation.y += it.spin.y * it.e;
    obj.rotation.z += it.spin.z * it.e;
  }

  // register loose parts inside a building (windows, roofs, cages, tanks...)
  function addParts(root) {
    root.traverse((o) => {
      if (o === root) return;
      const k = o.userData.kind;
      if (k === 'window' || k === 'bars') add(o, 'window');
      else if (k === 'part') add(o, 'part');
      else if (k === 'roof') add(o, 'roof', { dynamic: true });
    });
  }

  // diagnostics: how far is the furthest object from home right now?
  function maxOffset() {
    let m = 0;
    for (const it of items) m = Math.max(m, it.off.length());
    return { count: items.length, maxOffset: m };
  }

  return { add, addParts, update, apply, maxOffset };
}

// ------------------------------------------------------------- the world

export function createWorld() {
  const world = new THREE.Group();
  const scatter = createScatter(777);
  const anchors = {};
  const breathers = [];   // [object, island index]: things on the islands that breathe along

  const origin = new THREE.Object3D();
  world.add(origin);
  anchors.world = origin;
  const drift = new THREE.Object3D();      // slowly moving point the airplane view looks at
  world.add(drift);
  anchors.drift = drift;

  // ---------------------------------------------------- main islands
  function mainIsland(key, radial, colors, n = 20) {
    const root = new THREE.Group();
    root.position.fromArray(WORLD[key].center);
    world.add(root);
    const spinner = new THREE.Group();
    root.add(spinner);
    const plinth = islandPlinth(radial, n, colors);
    spinner.add(plinth.group);
    anchors[key] = root;
    return { key, root, spinner, plinth, radial, houses: [], vis: 1, center: root.position.clone() };
  }

  const ny = mainIsland('ny', manhattanR, {
    top: C.paper, layers: [C.salmon, C.roofRed, C.roofBlue], tip: [C.blush, C.roofBlue],
  }, 56);
  const tw = mainIsland('tw', leafR, {
    top: '#9ccf6e', layers: ['#7dbb57', C.green, C.roofBlue], tip: [C.softYellow, C.roofBlue],
  });
  const islands = [ny, tw];

  // ---- New York: Manhattan's grid. Two avenues along the island, four
  // cross streets; the main intersection has the signal and crossings.
  const AVES = [1.5, -1.5], AW = 1.0, STREETS = [-6, -1.5, 3, 7.5], SW = 0.75, MAIN = [-1.5, 1.5];
  const cross = manhattanGrid((x, z, m) => inside(manhattanR, x, z, m), { avenues: AVES, AW, streets: STREETS, SW, main: MAIN });
  ny.spinner.add(cross.group);
  const crossAnchor = new THREE.Object3D();
  crossAnchor.position.set(MAIN[0], 0, MAIN[1]);
  ny.spinner.add(crossAnchor);
  anchors.crossroads = crossAnchor;
  // Manhattanhenge: looking south down the first avenue
  const hengeAnchor = new THREE.Object3D();
  hengeAnchor.position.set(7.0, 0, AVES[0]);
  ny.spinner.add(hengeAnchor);
  anchors.henge = hengeAnchor;

  // building slots: one row on each outer strip facing the avenue, one row
  // down the middle; two buildings per block between cross streets
  const nyAll = [];
  {
    const edges = [-13, ...STREETS.flatMap(x => [x - SW / 2, x + SW / 2]), 13];
    const xs = [];
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i], b = edges[i + 1];
      if (i === 0) for (let x = b - 0.92; x > a; x -= 1.85) xs.push(x);
      else if (i === edges.length - 2) for (let x = a + 0.92; x < b; x += 1.85) xs.push(x);
      else xs.push((a + b) / 2 - 0.92, (a + b) / 2 + 0.92);
    }
    const fits = (x, z) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) => inside(manhattanR, x + a * 0.87, z + b * 0.83, 0.15));
    for (const [strip, z, ry] of [['N', 2.8, Math.PI], ['M', 0, null], ['S', -2.8, 0]]) {
      for (const x of xs) if (fits(x, z)) nyAll.push({ strip, x, z, ry });
    }
  }
  const takeSlot = (strip, x) => {
    const i = nyAll.findIndex(q => q.strip === strip && Math.abs(q.x - x) < 0.1);
    return i >= 0 ? nyAll.splice(i, 1)[0] : null;
  };

  // ---- New York: skyscrapers, midtown
  const towers = [];
  [['M', -2.83, 'deco', 0], ['M', -0.17, 'needle', 0], ['N', 1.67, 'glass', Math.PI],
    ['N', -2.83, 'slab', Math.PI], ['S', -0.17, 'glass', 0]].forEach(([strip, x, kind, ry], i) => {
    const sl = takeSlot(strip, x);
    if (!sl) return;
    const t = skyscraper(rand(700 + i * 13), kind);
    t.position.set(sl.x, 0, sl.z);
    t.rotation.y = ry;
    ny.spinner.add(t);
    towers.push(t);
    breathers.push([t, 0]);
  });

  // ---- New York: a hero walk-up whose window the camera can fly into
  const nyHero = nyTower(rand(41), { floors: 7, w: 1.7, d: 1.6, wall: C.brick, hero: 3, fireEscape: true });
  const heroSlot = takeSlot('N', 4.33);
  nyHero.group.position.set(heroSlot.x, 0, heroSlot.z);
  nyHero.group.rotation.y = Math.PI;
  ny.spinner.add(nyHero.group);
  anchors.nyWindow = nyHero.hero;

  // the door to elsewhere, at the southern tip
  const nyDoor = doorToElsewhere(rand(5));
  takeSlot('M', -9.14);
  nyDoor.position.set(-9.7, 0, 0);
  nyDoor.rotation.y = -Math.PI / 2;
  ny.spinner.add(nyDoor);
  breathers.push([nyDoor, 0]);

  // ---- a suspension bridge floating on its own off New York's west side,
  // leading nowhere but into a window
  const bridge = suspensionBridge(rand(9), 7.5);
  const bridgeBase = new V3(-30, -3.5, 13.5);
  // the camera's anchor: sits exactly on the window and bobs/sways with the
  // bridge, but never takes the spin, so a song that turns the bridge
  // (浪流連) shows it turning instead of turning the whole picture
  bridge.group.updateMatrixWorld(true);
  const bridgeAnchor = new THREE.Object3D();
  bridge.window.matrixWorld.decompose(bridgeAnchor.position, bridgeAnchor.quaternion, new V3());
  // bridgeRoot bobs and sways; bridgeSpin turns the whole bridge around its
  // middle (a small circle, so it clears New York)
  const bridgeRoot = new THREE.Group();
  const bridgeSpin = new THREE.Group();
  bridgeSpin.position.set(bridge.frame.position.x / 2, 0, 0);
  // while it turns it also drifts this far out, away from New York's centre
  const bridgeAwayDir = new V3(bridgeBase.x + bridgeSpin.position.x - WORLD.ny.center[0], 0, bridgeBase.z - WORLD.ny.center[2]).normalize();
  const BRIDGE_AWAY = 4;
  bridge.group.position.copy(bridgeSpin.position).negate();
  bridgeSpin.add(bridge.group);
  bridgeRoot.add(bridgeSpin, bridgeAnchor);
  bridgeRoot.position.copy(bridgeBase);
  world.add(bridgeRoot);
  anchors.bridgeWindow = bridgeAnchor;
  let bridgeLit = 0, bridgeTurn = 0, bridgeYaw = 0;

  // ---- New York: yellow cabs. Two loops (an inner and an outer lane) around
  // the avenues and the outermost cross streets; they drive, stop, drive.
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const XA = STREETS[0], XB = STREETS[STREETS.length - 1];
  const routes = [
    { pts: rect(XA + 0.17, XB - 0.17, AVES[1] + 0.22, AVES[0] - 0.22), dir: 1 },
    { pts: rect(XA - 0.17, XB + 0.17, AVES[1] - 0.22, AVES[0] + 0.22), dir: -1 },
  ].map(rt => {
    const segs = [];
    let L = 0;
    rt.pts.forEach((p, i) => {
      const q = rt.pts[(i + 1) % rt.pts.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      segs.push({ p, q, len, at: L });
      L += len;
    });
    return { ...rt, segs, L };
  });
  const routePoint = (rt, d, out) => {
    d = ((d % rt.L) + rt.L) % rt.L;
    const sg = rt.segs.find(q => d >= q.at && d <= q.at + q.len) || rt.segs[0];
    const t = (d - sg.at) / sg.len;
    return out.set(sg.p[0] + (sg.q[0] - sg.p[0]) * t, 0.06, sg.p[1] + (sg.q[1] - sg.p[1]) * t);
  };
  const taxis = [];
  for (let i = 0; i < 12; i++) {
    const cab = taxi();
    ny.spinner.add(cab);
    taxis.push({ g: cab, rt: routes[i % 2], off: Math.floor(i / 2) / 6 + (i % 2) * 0.05, stops: 9 });
  }

  // ---- Taiwan: hero walk-up with an iron window cage, facing out to sea
  const twHeroA = Math.PI / 2 + 0.25;
  const twHeroR = leafR(twHeroA) - 2.5;   // clear of the ring road the bus drives on
  const twHero = twWalkup(rand(23), { floors: 4, w: 1.35, d: 1.6, wall: C.tileMint, tile: 0.1, hero: 2 });
  twHero.group.position.set(Math.cos(twHeroA) * twHeroR, 0, Math.sin(twHeroA) * twHeroR);
  twHero.group.rotation.y = Math.PI / 2 - twHeroA;
  tw.spinner.add(twHero.group);
  anchors.twWindow = twHero.hero;

  // ---- Taiwan: the mountains down the middle
  const mtn = mountainRange(rand(88), RX, RZ, { length: RIDGE.length, width: RIDGE.width, height: 2.9 });
  tw.spinner.add(mtn.group);
  mtn.group.userData.noLean = true;   // the mountains swell up and down instead
  breathers.push([mtn.group, 1]);

  // How high the mountains stand at a point (each peak is a cone sunk 0.3
  // into the ground). A house may sit on the very foot of a slope, but no
  // higher, so the mountain never shows through its walls.
  const mtnV = new THREE.Vector3(), Y_AXIS = new THREE.Vector3(0, 1, 0);
  const mtnHeight = (x, z) => {
    let top = 0;
    for (const m of mtn.peaks) {
      if (!m.userData.cone) {
        m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox;
        m.userData.cone = { rad: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2, hgt: bb.max.y - bb.min.y };
      }
      const { rad, hgt } = m.userData.cone;
      mtnV.set(x - m.position.x, 0, z - m.position.z).applyAxisAngle(Y_AXIS, -m.rotation.y);
      const d = Math.hypot(mtnV.x, mtnV.z / m.scale.z);
      top = Math.max(top, hgt * (1 - d / rad) - 0.3);
    }
    return top;
  };
  // Taiwan's walk-ups are drawn a little smaller than the hero house, so all
  // 12 fit between the mountains and the bus's ring road.
  const TW_HOUSE_SCALE = 0.8;

  // ---- house pools (the controller decides how many are present)
  function makePool(island, types, seed, scale = 1) {
    island.houses = types.map((t, i) => {
      const hr = rand(seed + i * 77);
      const b = t === 'tower' ? nyTower(hr)
        : t === 'mid' ? nyTower(hr, { floors: hr.i(3, 4), w: hr.f(1.5, 1.75) })
          : t === 'walk' ? twWalkup(hr)
            : gableHouse(hr, { roof: hr.pick([C.roofRedDeep, C.roofRed]), light: LIGHTS.fluorescent });
      b.group.scale.setScalar(scale);
      const holder = new THREE.Group();
      holder.add(b.group);
      holder.visible = false;
      island.spinner.add(holder);
      return {
        holder, roof: b.roof, roofBase: b.roof.position.clone(), inner: b.group, k: scale,
        vis: 0, cur: { x: 0, z: 0, ry: 0 }, tween: null,
        ph: hr.next(), kBob: hr.i(1, 3), kRoof: hr.i(1, 2), phRoof: hr.next(),
      };
    });
  }
  makePool(ny, nyAll.map((_, i) => (i % 3 === 1 ? 'mid' : 'tower')), 1000);
  makePool(tw, ['walk', 'walk', 'gable', 'walk', 'walk', 'walk', 'gable', 'walk', 'walk', 'walk', 'walk', 'walk'], 3000, TW_HOUSE_SCALE);

  // ---- Taiwan: 電線桿 in the lanes beside the houses (they travel with
  // their house), and wires strung between them in every direction.
  const localBox = (obj) => {
    const bb = innerBox(obj);
    return bb.set(bb.min.multiplyScalar(obj.scale.x), bb.max.multiplyScalar(obj.scale.x));
  };
  const innerBox = (obj) => {
    obj.updateWorldMatrix(true, true);
    const inv = obj.matrixWorld.clone().invert();
    const bb = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
    obj.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
    });
    return bb;
  };
  const pr = rand(515);
  const twPoles = [];
  tw.houses.forEach((h) => {
    const bb = localBox(h.inner);
    h.top = new V3(0, bb.max.y * 0.78, bb.max.z);          // where a drop wire can land
    if (!pr.chance(0.8)) return;
    const p = utilityPole(pr);
    p.group.position.set((pr.chance(0.5) ? 1 : -1) * (bb.max.x + 0.2), 0, pr.chance(0.6) ? bb.max.z + 0.2 : bb.min.z - 0.2);
    p.group.rotation.y = pr.chance(0.5) ? 0 : Math.PI / 2;
    h.holder.add(p.group);
    twPoles.push({ ...p, owner: h });
  });
  // street lamps in the lanes: on the front corner without a pole
  tw.houses.forEach((h) => {
    if (!pr.chance(0.65)) return;
    const bb = localBox(h.inner);
    const pole = twPoles.find(tp => tp.owner === h);
    const side = pole ? -Math.sign(pole.group.position.x || 1) : (pr.chance(0.5) ? 1 : -1);
    const lamp = streetLamp(1.35);
    lamp.position.set(side * (bb.max.x + 0.18), 0, bb.max.z + 0.18);
    lamp.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    h.holder.add(lamp);
  });
  const wireMat = new THREE.LineBasicMaterial({ color: '#1c2550' });
  const wires = Array.from({ length: 90 }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(13 * 3), 3));
    const line = new THREE.Line(geo, wireMat);
    line.frustumCulled = false;
    line.visible = false;
    tw.spinner.add(line);
    return { line, a: null, b: null, sag: 0.3 };
  });
  // decide who connects to whom for a layout (from the houses' final slots)
  function wireUp(slots) {
    const at = (tp) => {
      const s0 = slots[tw.houses.indexOf(tp.owner) % slots.length];
      const l = tp.group.position, c = Math.cos(s0.ry), sn = Math.sin(s0.ry);
      return new V3(s0.x + l.x * c + l.z * sn, 0, s0.z - l.x * sn + l.z * c);
    };
    const P = twPoles.map(at);
    const jobs = [];
    const seen = new Set();
    P.forEach((p, i) => {
      const near = P.map((q, j) => [j, p.distanceTo(q)]).filter(([j, d]) => j !== i && d < 4.8).sort((a, b) => a[1] - b[1]).slice(0, 2);
      for (const [j] of near) {
        const key = Math.min(i, j) + ':' + Math.max(i, j);
        if (seen.has(key)) continue;
        seen.add(key);
        const n = pr.i(1, 3);
        for (let k = 0; k < n; k++) jobs.push({ a: { pole: twPoles[i], k: pr.i(0, 4) }, b: { pole: twPoles[j], k: pr.i(0, 4) }, sag: pr.f(0.15, 0.55) });
      }
      // a drop wire to a neighbor's facade
      if (pr.chance(0.6)) {
        let best = null, bd = 3.6;
        tw.houses.forEach((h, hi) => {
          if (h === twPoles[i].owner) return;
          const s0 = slots[hi % slots.length];
          const d = Math.hypot(s0.x - p.x, s0.z - p.z);
          if (d < bd) { bd = d; best = h; }
        });
        if (best) jobs.push({ a: { pole: twPoles[i], k: pr.i(0, 4) }, b: { house: best }, sag: pr.f(0.1, 0.3) });
      }
    });
    wires.forEach((w, i) => Object.assign(w, jobs[i] || { a: null, b: null }));
  }
  const wv = [new V3(), new V3(), new V3()];
  function endPoint(e, out) {
    if (e.pole) {
      e.pole.group.updateMatrix();
      e.pole.owner.holder.updateMatrix();
      return out.copy(e.pole.pts[e.k % e.pole.pts.length]).applyMatrix4(e.pole.group.matrix).applyMatrix4(e.pole.owner.holder.matrix);
    }
    e.house.holder.updateMatrix();
    return out.copy(e.house.top).applyMatrix4(e.house.holder.matrix);
  }
  const ownerOf = (e) => (e.pole ? e.pole.owner : e.house);
  function updateWires(S) {
    for (const w of wires) {
      if (!w.a) { w.line.visible = false; continue; }
      const ok = S < 0.02 && ownerOf(w.a).vis > 0.98 && ownerOf(w.b).vis > 0.98;
      w.line.visible = ok;
      if (!ok) continue;
      endPoint(w.a, wv[0]);
      endPoint(w.b, wv[1]);
      const arr = w.line.geometry.attributes.position.array;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        wv[2].lerpVectors(wv[0], wv[1], t);
        arr[i * 3] = wv[2].x;
        arr[i * 3 + 1] = wv[2].y - w.sag * 4 * t * (1 - t);
        arr[i * 3 + 2] = wv[2].z;
      }
      w.line.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ---- layouts
  // New York: the remaining grid slots, shuffled per layout seed; buildings
  // face their avenue. Taiwan is a looser, denser cluster.
  function nySlots(seed) {
    const r = rand(seed * 131 + 5);
    return nyAll.map(q => ({ ...q, key: r.next() })).sort((p, q) => p.key - q.key)
      .map(q => ({ x: q.x + r.f(-0.08, 0.08), z: q.z, ry: q.ry ?? (r.chance(0.5) ? 0 : Math.PI) }));
  }
  // ---- where Taiwan's houses may stand. Each house is tried as its own
  // footprint (walls, poles and lamps, turned the way it will face): every
  // corner must stay clear of the bus on the ring road, stand no more than a
  // touch up a mountain slope, and not overlap another house.
  const roadPts = Array.from({ length: 360 }, (_, i) => {
    const th = (i / 360) * TAU, rr = leafR(th) - 0.42;
    return [Math.cos(th) * rr, Math.sin(th) * rr];
  });
  const nearRoad = (x, z, d) => {
    const d2 = d * d;
    for (let i = 0; i < roadPts.length; i++) {
      const dx = x - roadPts[i][0], dz = z - roadPts[i][1];
      if (dx * dx + dz * dz < d2) return true;
    }
    return false;
  };
  const BUS_CLEAR = 0.55;    // road center line to a house's nearest point (the bus is ~0.32 half-wide)
  const SLOPE_OK = 0.4;      // how far up a slope a wall may stand
  // a box in root's own frame (scale included), from the local matrices down
  const footBox = (root) => {
    const bb = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
    root.traverse((o) => {
      if (!o.isMesh) return;
      m.identity();
      for (let q = o; q && q !== root; q = q.parent) { q.updateMatrix(); m.premultiply(q.matrix); }
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(m));
    });
    return bb;
  };
  // a footprint as a turned rectangle: center, half sizes, angle
  const houseRect = (bb, x, z, ry, pad = 0) => {
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    const c = Math.cos(ry), s = Math.sin(ry);
    return { x: x + cx * c + cz * s, z: z - cx * s + cz * c, hx: (bb.max.x - bb.min.x) / 2 + pad, hz: (bb.max.z - bb.min.z) / 2 + pad, ry };
  };
  const rectPts = (R) => {
    const c = Math.cos(R.ry), s = Math.sin(R.ry), out = [];
    for (const [u, v] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [0, 0]]) {
      const lx = u * R.hx, lz = v * R.hz;
      out.push([R.x + lx * c + lz * s, R.z - lx * s + lz * c]);
    }
    return out;
  };
  const axes = (R) => [[Math.cos(R.ry), -Math.sin(R.ry)], [Math.sin(R.ry), Math.cos(R.ry)]];
  const overlap = (A, B) => {          // separating axis test for two turned rectangles
    const dx = B.x - A.x, dz = B.z - A.z;
    for (const [ax, az] of [...axes(A), ...axes(B)]) {
      const proj = (R) => { const [[ux, uz], [vx, vz]] = axes(R); return R.hx * Math.abs(ux * ax + uz * az) + R.hz * Math.abs(vx * ax + vz * az); };
      if (Math.abs(dx * ax + dz * az) > proj(A) + proj(B)) return false;
    }
    return true;
  };
  let twFeet = null, heroRect = null;
  function twFootprints() {
    if (twFeet) return;
    twFeet = tw.houses.map(h => ({ all: footBox(h.holder), body: footBox(h.inner).applyMatrix4(h.inner.matrix) }));
    heroRect = houseRect(footBox(twHero.group), twHero.group.position.x, twHero.group.position.z, twHero.group.rotation.y, 0.4);
  }
  function fits(i, x, z, ry, placed) {
    if (!inside(leafR, x, z, 1.2)) return null;
    const keep = houseRect(twFeet[i].all, x, z, ry, 0.08);
    if (overlap(keep, heroRect) || placed.some(P => overlap(keep, P))) return null;
    for (const [px, pz] of rectPts(houseRect(twFeet[i].all, x, z, ry))) {
      if (!inside(leafR, px, pz, 0.42) || nearRoad(px, pz, BUS_CLEAR)) return null;
    }
    for (const [px, pz] of rectPts(houseRect(twFeet[i].body, x, z, ry))) if (mtnHeight(px, pz) > SLOPE_OK) return null;
    return keep;
  }
  // Each layout seed gives its own arrangement: the houses are dropped in one
  // at a time, biggest first, each at the first random spot where it fits.
  function twSlots(seed) {
    twFootprints();
    const order = tw.houses.map((_, i) => i).sort((a, b) => {
      const A = twFeet[a].all, B = twFeet[b].all;
      return (B.max.x - B.min.x) * (B.max.z - B.min.z) - (A.max.x - A.min.x) * (A.max.z - A.min.z);
    });
    let best = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const r = rand(seed * 9973 + attempt * 131 + 9);
      const out = [], placed = [];
      for (const i of order) {
        for (let k = 0; k < 600 && !out[i]; k++) {
          const x = r.f(-10, 10), z = r.f(-7, 7), ry = r.i(0, 3) * Math.PI / 2 + r.f(-0.1, 0.1);
          const R = fits(i, x, z, ry, placed);
          if (R) { out[i] = { x, z, ry }; placed.push(R); }
        }
        if (!out[i]) break;
      }
      const n = out.filter(Boolean).length;
      if (n === tw.houses.length) return out;
      if (!best || n > best.n) best = { n, out };
    }
    // not expected: a house that found no room shares a spot with another
    const spare = best.out.find(Boolean);
    return tw.houses.map((_, i) => best.out[i] || { ...spare });
  }

  let currentSeed = null;
  function setLayout(seed, nowSec, immediate = false) {
    if (seed === currentSeed) return;
    const first = currentSeed === null;
    currentSeed = seed;
    const twS = twSlots(seed);
    wireUp(twS);
    [[ny, nySlots(seed)], [tw, twS]].forEach(([island, slots]) => {
      island.houses.forEach((h, i) => {
        const to = slots[i % slots.length];
        if (immediate) { h.cur = { ...to }; h.tween = null; }
        else h.tween = { from: { ...h.cur }, to, start: nowSec + i * 0.09, dur: 2.6 };
      });
    });
    if (first) registerHouses();
  }

  // ---------------------------------------------------- satellites
  const sats = [];
  const r = rand(20261109);
  function satellite(name, pos, platform, content, yaw = null, still = false) {
    const g = new THREE.Group();
    g.position.fromArray(pos);
    g.add(platform);
    if (content) g.add(content);
    world.add(g);
    if (name) anchors[name] = g;
    const s = {
      g, base: g.position.clone(), ph: r.next(), k: r.i(1, 3), vis: 1, yaw: yaw ?? sats.length, still,
      spin: name === 'lighthouse' ? 0 : (sats.length % 2 ? 1 : -1),
    };
    sats.push(s);
    return s;
  }
  const bag = suitcase();
  bag.rotation.set(0, -0.35, 0.05);
  satellite('suitcase', [-3, -5, 17], satellitePlatform(1.7, 6, C.paper, [C.salmon, C.roofBlue]), bag);

  const lh = lighthouse();
  satellite('lighthouse', [2, 1.8, -19], satellitePlatform(1.9, 7, C.cream, [C.skyBlue, C.roofBlue]), lh.group);

  const sw = standingWindow(r);
  satellite('windowIsland', [1, 8.5, 1], satellitePlatform(1.5, 5, C.paper, [C.blush, C.skyBlue]), sw);

  const tiny = gableHouse(r, { w: 1.0, d: 1.1, h: 0.75, wall: C.softYellow, roof: C.green, door: C.roofBlue });
  satellite('tinyHouse', [34, 3.5, 11], satellitePlatform(1.2, 6, C.paper, [C.softGreen, C.roofBlue]), tiny.group);

  const stairsSat = satellite('stairs', [-37, 4.5, 9], satellitePlatform(1.6, 5, C.paper, [C.salmon, C.roofBlue]), spiralStairs());
  // 牽掛: an anchor that circles the spiral stairs once per loop (like the
  // ladder's); a camera following it orbits the stairs
  const stairsOrbit = new THREE.Object3D();
  world.add(stairsOrbit);
  anchors.stairsOrbit = stairsOrbit;
  satellite('wall', [33, -3.5, -13], satellitePlatform(1.5, 6, C.cream, [C.blush, C.skyBlue]), gableWall(r));
  satellite('lamp', [-27, 5, -15], satellitePlatform(1.0, 6, C.paper, [C.softYellow, C.roofBlue]), streetLamp(1.9));
  // ---- round 8: a windmill island
  const mill = windmill();
  satellite('windmill', [38, 0.5, -1], satellitePlatform(1.6, 7, '#bfe0a8', [C.softGreen, C.roofBlue]), mill.group);


  // ---------------------------------------------------- mid islands
  // Between the two main islands and the small ones in size.
  function midIsland(name, pos, R, colors, content, yaw, still = false) {
    const radial = (th) => R * (1 + 0.07 * Math.cos(3 * th + R) + 0.04 * Math.cos(5 * th + 1.3));
    const plinth = islandPlinth(radial, 16, colors, { stand: { h: R * 0.5, ratio: 0.45 }, depthScale: 0.42 });
    return satellite(name, pos, plinth.group, content, yaw, still);
  }
  // 在凌晨: two subway entrances floating free in the sky — no island — joined
  // by an open switchback stair behind their dark ends: down from the top
  // entry, round the landing, and out through the upside-down twin below.
  // Sits higher and further from the baggage belt than the old island did,
  // so nothing touches the conveyor.
  const subStack = new THREE.Group();
  {
    const H = 3.6;                          // the drop between the two entries
    const top = subwayEntrance();
    top.position.y = H;
    const under = subwayEntrance();
    under.rotation.z = Math.PI;             // upside down: the way out, below
    subStack.add(top, under);
    const stepM = toon('#d9d4c7');
    const railM = toon('#3f7a4f');
    const zAxis = new V3(0, 0, 1);
    const bulbM = new THREE.MeshBasicMaterial({ color: '#ffe7b0' });
    const bulbG = new THREE.SphereGeometry(0.045, 8, 6);
    const flight = (y0, z0, y1, z1) => {
      for (let i = 0; i < 7; i++) {
        const t = (i + 0.5) / 7;
        // solid blocks: each step has real height, so the stair reads as stairs
        const st = mesh(new THREE.BoxGeometry(1.0, 0.24, 0.3), stepM);
        st.position.set(0, y0 + (y1 - y0) * t - 0.085, z0 + (z1 - z0) * t);
        subStack.add(st);
        // a small warm light on every other step, alternating sides
        if (i % 2 === 0) {
          const sx = (i % 4 === 0 ? 1 : -1) * 0.44;
          const b = new THREE.Mesh(bulbG, bulbM);
          b.position.set(sx, st.position.y + 0.17, st.position.z);
          const gl = steadyGlow(0.9, '#ffd590', 0.55);
          gl.position.copy(b.position);
          subStack.add(b, gl);
        }
      }
      for (const sx of [-0.52, 0.52]) {
        const len = Math.hypot(y1 - y0, z1 - z0);
        const rail = mesh(new THREE.BoxGeometry(0.05, 0.05, len), railM, { edges: false });
        rail.position.set(sx, (y0 + y1) / 2 + 0.55, (z0 + z1) / 2);
        rail.quaternion.setFromUnitVectors(zAxis, new V3(0, y1 - y0, z1 - z0).normalize());
        subStack.add(rail);
        for (const [py, pz] of [[y0, z0], [y1, z1]]) {   // a post at each end
          const post = mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), railM, { edges: false });
          post.position.set(sx, py + 0.28, pz);
          subStack.add(post);
        }
      }
    };
    flight(H, -0.9, H / 2, -2.5);           // down from the top entry
    flight(H / 2, -2.5, 0, -0.9);           // and back, into the twin below
    const landing = mesh(new THREE.BoxGeometry(1.1, 0.24, 0.6), stepM);
    landing.position.set(0, H / 2 - 0.085, -2.7);
    const landGlow = steadyGlow(1.6, '#ffd590', 0.45);   // a lamp over the landing
    landGlow.position.set(0, H / 2 + 0.5, -2.8);
    subStack.add(landing, landGlow);
  }
  satellite('subway', [-6.5, -3.5, 15], subStack, null, 0.35);
  const busStopG = busStop(rand(61));
  midIsland('busStop', [3.5, 2.5, 13.5], 3.3,
    { top: '#bfe0a8', layers: [C.tileMint, C.softGreen, C.roofBlue], tip: [C.softYellow, C.roofBlue] },
    busStopG, -0.1);
  midIsland('grove', [-1.5, -4.2, -12.5], 2.9,
    { top: '#9ccf6e', layers: [C.wallYellow, C.green, C.roofBlue], tip: [C.softYellow, C.roofBlue] },
    grove(rand(73)), 0.2);

  // ---------------------------------------------------- the baggage belt
  // Two belt rings linked like two links of a chain: one lying nearly flat
  // around and under New York, one tilted around and under Taiwan. They pass
  // through each other over the luggage island in the middle. Bags ride both.
  const RINGS = [
    { c: [-9, -8.5, 1], R: 11, tilt: 0 },                       // New York link
    { c: [12, -8.5, 0], R: 13, tilt: THREE.MathUtils.degToRad(25) }, // Taiwan link
  ];
  const ringPts = (ring, n = 220) => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    const [cx, cy, cz] = ring.c;
    // a gentle rise and dip; zero where the links meet over the island
    const bob = 0.8 * Math.sin(2 * t);
    return new V3(cx + Math.cos(t) * ring.R, cy + Math.sin(t) * ring.R * Math.sin(ring.tilt) + bob, cz + Math.sin(t) * ring.R * Math.cos(ring.tilt));
  });
  // arc-length lookup along a closed loop of points
  function loopPath(pts) {
    const len = [0];
    for (let i = 1; i <= pts.length; i++) len.push(len[i - 1] + pts[i - 1].distanceTo(pts[i % pts.length]));
    const L = len[pts.length];
    return {
      pts, L,
      at(d, out, tan) {
        d = ((d % L) + L) % L;
        let lo = 0, hi = pts.length;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= d) lo = m; else hi = m; }
        const a0 = pts[lo], a1 = pts[(lo + 1) % pts.length];
        out.lerpVectors(a0, a1, (d - len[lo]) / (len[lo + 1] - len[lo]));
        if (tan) tan.subVectors(a1, a0).normalize();
        return out;
      },
    };
  }
  // a closed band (belt or rail) along a loop, built as one mesh
  function band(pts, offset, halfW, dy0, dy1, color) {
    const pos = [];
    const side = new V3(), up = new V3(0, 1, 0), tn = new V3();
    const edge = (i) => {
      const n = pts.length, p = pts[i % n];
      tn.subVectors(pts[(i + 1) % n], pts[(i - 1 + n) % n]).normalize();
      side.crossVectors(up, tn).normalize();
      const c = p.clone().addScaledVector(side, offset);
      return [c.clone().addScaledVector(side, -halfW), c.clone().addScaledVector(side, halfW)];
    };
    for (let i = 0; i < pts.length; i++) {
      const [l0, r0] = edge(i), [l1, r1] = edge(i + 1);
      const q = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      const v = (p, dy) => [p.x, p.y + dy, p.z];
      q(v(l0, dy1), v(l1, dy1), v(r1, dy1), v(r0, dy1));      // top
      q(v(l0, dy0), v(r0, dy0), v(r1, dy0), v(l1, dy0));      // bottom
      q(v(l0, dy0), v(l1, dy0), v(l1, dy1), v(l0, dy1));      // sides
      q(v(r0, dy0), v(r0, dy1), v(r1, dy1), v(r1, dy0));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return mesh(faceted(geo), toon(color, { doubleSided: true }), { threshold: 40 });
  }
  const belt = new THREE.Group();
  const loops = RINGS.map(ring => loopPath(ringPts(ring)));
  for (const lp of loops) {
    belt.add(band(lp.pts, 0, 0.4, -0.14, 0, '#3a4060'));
    for (const sd of [-1, 1]) belt.add(band(lp.pts, sd * 0.43, 0.03, -0.14, 0.12, C.softYellow));
  }
  world.add(belt);
  const riders = [];
  const br = rand(3131);
  loops.forEach((lp, li) => {
    for (let i = 0; i < 18; i++) {
      const b = makeBag(br, br.f(1.1, 1.5));
      world.add(b);
      riders.push({ g: b, lp, dir: li ? -1 : 1, off: i / 18 + br.f(-0.01, 0.01), twist: br.f(-0.4, 0.4), lie: br.chance(0.4) });
    }
  });
  // the luggage island, where the two links meet: a big pile on one side, a
  // smaller one on the other, the belts running between them
  const luggageAnim = [];
  midIsland('luggage', [0.5, -11.8, 0.5], 4.6,
    { top: C.sidewalk, layers: [C.blush, C.roofRed, C.roofBlue], tip: [C.softYellow, C.roofBlue] },
    (() => {
      const g = new THREE.Group();
      const big = luggageHill(rand(808), { radius: 1.3, height: 2.0 });
      big.position.set(-3.1, 0, -0.4);
      const small = luggageHill(rand(809), { radius: 0.9, height: 1.2 });
      small.position.set(3.4, 0, 0.6);
      g.add(big, small);
      luggageAnim.push(...big.userData.anim, ...small.userData.anim);
      return g;
    })(), 0);

  // ---------------------------------------------------- the portals
  // Two striped portals high above everything, facing each other. Birds fly
  // out of one, across, and vanish into the other, both ways, all loop.
  // set on a diagonal so both striped faces read from the usual front views
  const PORTAL = { a: new V3(-8, 18.5, -10), b: new V3(8, 18.5, 2), R: 2.8 };
  const pAxis = PORTAL.b.clone().sub(PORTAL.a).normalize();
  const pSide = new V3(-pAxis.z, 0, pAxis.x);
  const pYaw = -Math.atan2(pAxis.z, pAxis.x);
  const portals = [PORTAL.a, PORTAL.b].map(at => {
    const p = portal(PORTAL.R);
    p.position.copy(at);
    p.rotation.y = pYaw;
    world.add(p);
    return p;
  });
  anchors.portals = portals[0];

  // ---- the Big Apple, floating beside New York (never landing)
  const apple = bigApple();
  apple.scale.setScalar(2.6);
  world.add(apple);
  anchors.apple = apple;

  // ---- an airport departures board, drifting high across the back
  const board = departuresBoard();
  world.add(board);
  anchors.departures = board;

  // ---------------------------------------------------- song scenes
  // 不想去遠方: a room looking out over Taiwan. It hangs off the island (not
  // the spinner), far enough out that the island's tips clear it as it turns,
  // and it only exists while its camera is on.
  const lookout = lookoutRoom(rand(4401));
  lookout.group.position.set(0, -0.6, 12.6);
  tw.root.add(lookout.group);
  anchors.lookout = lookout.eye;

  // 浴室: a pink bathroom inside a floating house, its window on New York's
  // towers.
  const bath = bathroomRoom(rand(4402));
  const bathBase = new V3(-17, 3.4, 16.5);
  bath.group.position.copy(bathBase);
  world.add(bath.group);
  anchors.bathroom = bath.eye;

  // 我想和你一起: two birds flying side by side, drifting apart and back
  // together, on a figure-eight through the whole world: round Taiwan, across
  // the gap, round New York, and back. One lap per loop. The Two Birds camera
  // follows the point between them, from behind.
  const pairAnchor = new THREE.Object3D();
  world.add(pairAnchor);
  anchors.birdPair = pairAnchor;
  const pair = [makeBird('pigeon'), makeBird('pigeon')];
  pair.forEach(b => { b.g.scale.setScalar(3.2); world.add(b.g); });
  const pairPos = (ph, out) => {
    const th = TAU * ph;
    const A = 31, B = 25;                               // lobes reach past each island's ends
    return out.set(A * Math.sin(th), 9 + Math.sin(2 * th) * 1.6 + Math.sin(3 * th) * 0.6, -1 + B * 0.5 * Math.sin(2 * th));
  };
  const ppA = new V3(), ppB = new V3(), ppSide = new V3(), ppM = new THREE.Matrix4(), ppQ = new THREE.Quaternion(), ppUp = new V3(0, 1, 0);
  const ppE = new THREE.Euler();

  // 晚安台灣: a road round Taiwan just inside the coast, lamps along it, and a
  // little bus doing one lap per loop (evenly, by distance).
  const ring = ringRoad(leafR);
  tw.spinner.add(ring.group);
  const tripBus = miniBus('#ef8a3c');
  tripBus.scale.setScalar(0.85);
  tw.spinner.add(tripBus);
  anchors.roadBus = tripBus;
  const ringLen = [0];
  {
    const a = new V3(), b = new V3();
    for (let i = 1; i <= 720; i++) { ring.path((i - 1) / 720, a); ring.path(i / 720, b); ringLen.push(ringLen[i - 1] + a.distanceTo(b)); }
  }
  const ringAt = (u) => {             // distance fraction -> path parameter
    const d = (((u % 1) + 1) % 1) * ringLen[720];
    let lo = 0, hi = 720;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ringLen[m] < d) lo = m; else hi = m; }
    return (lo + (d - ringLen[lo]) / Math.max(1e-6, ringLen[hi] - ringLen[lo])) / 720;
  };
  const busA = new V3(), busB = new V3();

  const portalBirds = [];
  const pbr = rand(6061);
  for (let i = 0; i < 24; i++) {
    const b = makeBird(i % 2 ? 'sparrow' : 'pigeon');
    world.add(b.g);
    const rr = () => pbr.f(-1, 1) * PORTAL.R * 0.55;
    portalBirds.push({
      ...b, dir: i % 2 ? 1 : -1, k: pbr.i(4, 7), off: pbr.next(), flapPh: pbr.next(),
      a: [rr() * 0.72, rr()], b: [rr() * 0.72, rr()], arc: pbr.f(-1.6, 1.6), side: pbr.f(-1.4, 1.4),
    });
  }
  const pbPos = new V3(), pbNext = new V3(), pbM = new THREE.Matrix4(), pbQ = new THREE.Quaternion(), pbUp = new V3(0, 1, 0);
  function portalPath(b, u, out) {
    const from = b.dir > 0 ? PORTAL.a : PORTAL.b, to = b.dir > 0 ? PORTAL.b : PORTAL.a;
    const e = u * u * (3 - 2 * u) * 0.25 + u * 0.75;
    const up = b.a[0] + (b.b[0] - b.a[0]) * e + Math.sin(Math.PI * e) * b.arc;
    const sd = b.a[1] + (b.b[1] - b.a[1]) * e + Math.sin(Math.PI * e) * b.side;
    return out.lerpVectors(from, to, e).addScaledVector(pSide, sd).setY(out.y + up);
  }

  // ---------------------------------------------------- the ladder
  // A tall ladder standing upright in the air, a window floating at its top.
  const ladder = ladderToWindow(8);
  const ladderBase = new V3(12, -3.2, 17);
  ladder.group.position.copy(ladderBase);
  ladder.group.rotation.y = -0.35;
  world.add(ladder.group);
  anchors.ladder = ladder.group;
  anchors.ladderWindow = ladder.window;
  // a point that rides with the ladder and turns once per loop, for a camera
  // that circles the ladder and its window (我給的愛)
  const ladderOrbit = new THREE.Object3D();
  world.add(ladderOrbit);
  anchors.ladderOrbit = ladderOrbit;

  // ---- round 10
  // 魚: a soft school of fish swimming round the wind turbine. They follow
  // one leader along a looping path, each a little behind and to the side,
  // drifting in and out of place, so the school stretches and bunches up.
  const fishCols = ['#EE80C0', '#C090D8', '#90CCEE', '#A8EEC0', '#6AAAE8', '#F4A8CC', '#E85860', '#EDED68', '#E85C38', '#8894E8', '#C4EC58', '#C07CD8'];
  const fishes = [];
  for (let i = 0; i < 22; i++) {
    const f = schoolFish(fishCols[i % fishCols.length]);
    const h = (n) => { const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    f.group.scale.setScalar(0.45 + h(1) * 0.35);
    mill.group.add(f.group);
    // spread out: a longer trail behind the leader and a wider scatter around it
    fishes.push({ ...f, i, lag: i * 0.008 + h(2) * 0.008, off: new V3(h(3) - 0.5, h(4) - 0.5, h(5) - 0.5).multiplyScalar(3.2), k: 2 + Math.floor(h(6) * 3), p: h(7) });
  }
  const leader = (ph, out) => {
    const th = TAU * ph * 3;
    const rr = 3.2 + 0.8 * Math.sin(TAU * ph * 2);   // wide enough that the scattered fish clear the tower
    return out.set(Math.cos(th) * rr, 4.2 + 1.7 * Math.sin(TAU * ph * 4), Math.sin(th) * rr);   // a little higher, so the lowest stragglers stay off the platform
  };
  const fishPos = (fi, ph, out) => {
    leader(ph - fi.lag, out);
    const w = Math.sin(TAU * (ph * fi.k + fi.p));
    return out.addScaledVector(fi.off, 0.75 + 0.35 * w);
  };
  const fA = new V3(), fB = new V3(), fM = new THREE.Matrix4(), fUp = new V3(0, 1, 0);

  // 忽然之間: a big clock floating high over Taiwan's far side
  const clock = bigClock();
  const clockBase = new V3(25, 17, -14);
  clock.group.position.copy(clockBase);
  world.add(clock.group);
  anchors.clock = clock.group;

  // 我給的愛: pastel fireflies round the window at the top of the ladder
  ladder.window.add(fireflies(110, 2.6));

  // 一桌菜: a dining room on Taiwan's far side, looking back over the island
  const dining = diningRoom(rand(4403));
  dining.group.position.set(0, -0.6, -12.6);
  dining.group.rotation.y = Math.PI;
  tw.root.add(dining.group);
  anchors.dining = dining.eye;

  // 台北某個地方: laundry drying on the grove island
  const laundry = laundryLine(rand(4404));
  laundry.group.position.set(0.2, 0, 1.75);
  anchors.grove.add(laundry.group);

  // Love Lee: a point that follows the apple and turns against its spin,
  // so a camera bound to it orbits the apple
  const appleOrbit = new THREE.Object3D();
  world.add(appleOrbit);
  anchors.appleOrbit = appleOrbit;

  // 未接來電: a retro phone booth adrift high between the islands, after a
  // lone desert booth at night: tan aluminium frame on a concrete step, glass
  // on all four sides over a low kick panel, a two-leaf door with a handle,
  // a lit PHONE band round the top, a ceiling light, and a payphone inside
  // (keypad, coin slot, coiled cord, handset on its hook, phone book shelf).
  // It glows like a lamp left on. Paper planes circle it like the fish
  // circle the windmill. (The two phones and their coiled cord are gone.)
  const boothBase = new V3(8, 8.5, 9.8);
  const booth = new THREE.Group();
  {
    const tan = toon('#d6c6a6');
    const tanDark = toon('#b9a988');
    const BW = 1.1, BH = 2.3, Y0 = 0.14;            // width, wall height, floor level
    const glowM = (c) => new THREE.MeshBasicMaterial({ color: c });
    const box3 = (w, h, d, m, x, y, z, edges = true) => {
      const o = mesh(new THREE.BoxGeometry(w, h, d), m, { edges });
      o.position.set(x, y, z); booth.add(o); return o;
    };
    // concrete step and the booth's own floor
    box3(BW + 0.34, 0.1, BW + 0.34, toon('#bdb8ad'), 0, 0.05, 0);
    box3(BW, 0.04, BW, tanDark, 0, 0.12, 0);
    // corner posts
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      box3(0.075, BH, 0.075, tan, sx * (BW / 2 - 0.037), Y0 + BH / 2, sz * (BW / 2 - 0.037), false);
    // four walls: kick panel, mid rail, top rail, glass; the front (+z) is a
    // two-leaf door with a centre mullion and a handle
    const glassM = new THREE.MeshBasicMaterial({ color: '#bfe8f2', transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false });
    const walls = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]];
    for (const [nx, nz, ry] of walls) {
      const wall = new THREE.Group();
      wall.position.set(nx * (BW / 2 - 0.02), 0, nz * (BW / 2 - 0.02));
      wall.rotation.y = ry;
      const W = BW - 0.1;
      const kick = mesh(new THREE.BoxGeometry(W, 0.32, 0.03), tanDark, { edges: false });
      kick.position.y = Y0 + 0.16;
      const mid = mesh(new THREE.BoxGeometry(W, 0.05, 0.04), tan, { edges: false });
      mid.position.y = Y0 + 1.05;
      const topR = mesh(new THREE.BoxGeometry(W, 0.06, 0.04), tan, { edges: false });
      topR.position.y = Y0 + BH - 0.03;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, BH - 0.4), glassM);
      pane.position.y = Y0 + 0.32 + (BH - 0.4) / 2;
      wall.add(kick, mid, topR, pane);
      if (nz === 1) {                                   // the door
        const mull = mesh(new THREE.BoxGeometry(0.05, BH - 0.06, 0.04), tan, { edges: false });
        mull.position.y = Y0 + BH / 2;
        const handle = mesh(new THREE.BoxGeometry(0.03, 0.34, 0.03), toon('#e9e4d8'), { edges: false });
        handle.position.set(0.09, Y0 + 1.05, 0.04);
        wall.add(mull, handle);
      }
      booth.add(wall);
    }
    // the lit band round the top, with PHONE on front and back
    const signTex = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 48;
      const x = c.getContext('2d');
      x.fillStyle = '#fff6dc'; x.fillRect(0, 0, 256, 48);
      x.fillStyle = '#3b4a6b'; x.font = 'bold 30px sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('PHONE', 128, 26);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const bandY = Y0 + BH + 0.11;
    const bandPlain = glowM('#fff3cd');
    const bandSign = new THREE.MeshBasicMaterial({ map: signTex });
    // box faces: +x, -x, +y, -y, +z, -z (signs front and back)
    const band = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.04, 0.22, BW + 0.04),
      [bandPlain, bandPlain, bandPlain, bandPlain, bandSign, bandSign]);
    band.position.y = bandY;
    booth.add(band);
    box3(BW + 0.2, 0.06, BW + 0.2, tan, 0, bandY + 0.14, 0);          // cap roof, overhanging
    box3(BW - 0.1, 0.05, BW - 0.1, tanDark, 0, bandY + 0.19, 0);      // its raised top
    // ceiling light inside
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), glowM('#eaf7ff'));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = Y0 + BH - 0.07;
    booth.add(ceil);
    // the payphone, on the back wall
    const backZ = -(BW / 2 - 0.09);
    box3(0.3, 0.5, 0.1, toon('#3a4766'), 0.06, Y0 + 1.42, backZ);              // body
    box3(0.22, 0.12, 0.02, glowM('#b9cde0'), 0.06, Y0 + 1.58, backZ + 0.06, false);   // instruction card
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++)                    // keypad
      box3(0.035, 0.03, 0.015, toon('#d9dee8'), 0.02 + c * 0.045, Y0 + 1.44 - r * 0.042, backZ + 0.06, false);
    box3(0.02, 0.06, 0.015, toon(C.ink), 0.17, Y0 + 1.5, backZ + 0.06, false); // coin slot
    box3(0.06, 0.05, 0.03, toon('#c9cdd6'), 0.06, Y0 + 1.22, backZ + 0.05, false); // coin return
    box3(0.05, 0.1, 0.05, toon('#c9cdd6'), -0.13, Y0 + 1.5, backZ + 0.03, false);  // hook
    box3(0.07, 0.32, 0.07, toon(C.ink), -0.13, Y0 + 1.38, backZ + 0.07);          // handset
    // the coiled cord from the phone to the handset
    {
      const pts = [];
      const a0 = new V3(-0.05, Y0 + 1.25, backZ + 0.06), a1 = new V3(-0.13, Y0 + 1.22, backZ + 0.08);
      for (let i = 0; i <= 120; i++) {
        const t = i / 120, an = t * TAU * 9;
        const pt = a0.clone().lerp(a1, t);
        pt.y -= 0.18 * Math.sin(Math.PI * t);
        pt.x += Math.cos(an) * 0.015; pt.z += Math.sin(an) * 0.015;
        pts.push(pt);
      }
      booth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1c2233' })));
    }
    // a shelf with a phone book under the phone
    box3(0.46, 0.03, 0.2, tan, 0.02, Y0 + 1.0, backZ + 0.07);
    box3(0.26, 0.06, 0.16, toon('#e8d36a'), 0.06, Y0 + 1.05, backZ + 0.07);
    // light: cool from the glass, warm from the band, a faint pool below
    const gIn = steadyGlow(3.6, '#bfe9ff', 0.42); gIn.position.y = Y0 + 1.2;
    const gTop = steadyGlow(2.2, '#ffe9b0', 0.5); gTop.position.y = bandY;
    const gLow = steadyGlow(2.0, '#cfe9ff', 0.22); gLow.position.y = 0.1;
    booth.add(gIn, gTop, gLow);
  }
  booth.position.copy(boothBase);
  world.add(booth);
  anchors.booth = booth;
  // the paper planes: a simple paper fold (two wings meeting on a centre
  // crease, a little keel underneath), in soft paper colors. They fly as
  // one ring orbiting the booth — all the same way, evenly spaced, a lap
  // every 15 s, at staggered heights, banking into the turn.
  const paperPlanes = [];
  {
    const planeGeo = (() => {
      const N = [0, 0, 0.26], T = [0, 0, -0.2], K = [0, -0.06, -0.18];
      const v = [];
      const tri = (a, b, c) => v.push(...a, ...b, ...c);
      tri(N, T, K);                                               // keel
      for (const sd of [-1, 1]) tri(N, T, [sd * 0.2, 0.04, -0.2]); // the two wings
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      return g;
    })();
    const papers = ['#fbf9f2', '#f9dce3', '#dceaf7', '#f8efc9', '#e6f2e2', '#f7f1e2', '#efe2f6', '#fbf9f2'];
    const N_PLANES = 8;
    for (let i = 0; i < N_PLANES; i++) {
      const g = new THREE.Group();
      g.add(mesh(planeGeo, toon(papers[i % papers.length], { doubleSided: true })));
      g.scale.setScalar(1.15);
      world.add(g);
      paperPlanes.push({
        g, r: 2.1 + 0.25 * Math.sin(i * 2.4),           // one ring, gently uneven
        h0: 0.6 + (i % 4) * 0.55,                       // staggered heights up the booth
        ph0: i / N_PLANES,                              // evenly spaced round the ring
        bob: 0.18,
      });
    }
  }

  // ---------------------------------------------------- flying houses
  // Paper-cut houses drifting in zero gravity: slow loops, gentle tilts, never
  // flipping over. All motion is whole cycles per loop.
  const ships = [];
  const fr = rand(4242);
  const avoid = [
    [WORLD.ny.center, 21], [WORLD.tw.center, 13],   // (the floating bridge sits inside New York's circle)
    ...sats.map(s => [s.base.toArray(), 4.5]),
    [ladderBase.toArray(), 3],
    [[12, -3, 11.8], 3],
    [[-8, 18.5, -10], 4], [[8, 18.5, 2], 4],
    [[-38, 10, -4], 7],                               // the big apple
    [[38, 3, -1], 7],                                 // the wind turbine (tall)
  ];
  for (let tries = 0; ships.length < 26 && tries < 6000; tries++) {
    const p = [fr.f(-44, 44), fr.f(-5, 12), fr.f(-24, 22)];   // above the baggage belt
    const sc = fr.f(0.6, 1.9);
    const amp = new V3(fr.f(1.5, 4), fr.f(0.6, 1.6), fr.f(1.5, 4));
    // keep clear of islands for the whole drift, not just the start point
    const reach = Math.max(amp.x, amp.z) + sc * 1.2;
    const blocked = avoid.some(([c, rad]) => Math.hypot(p[0] - c[0], p[2] - c[2]) < rad + reach && Math.abs(p[1] - c[1]) < 9 + amp.y)
      || ships.some(sh => Math.hypot(p[0] - sh.base.x, p[1] - sh.base.y, p[2] - sh.base.z) < 7);
    if (blocked) continue;
    const g = flyingHouse(fr);
    g.scale.setScalar(sc);
    world.add(g);
    ships.push({
      g, sc, base: new V3(...p), vis: 1, amp,
      k: [fr.i(1, 2), fr.i(1, 3), fr.i(1, 2)], ph: [fr.next(), fr.next(), fr.next()],
      yaw: fr.f(0, TAU), spin: fr.pick([-1, 0, 0, 1]), tilt: [fr.f(0.12, 0.32), fr.f(0.12, 0.32)], kt: fr.i(1, 3),
    });
  }

  // Keep every drifting house out of the two rooms on Taiwan's edge (不想去遠方's
  // lookout and 一桌菜's dining room): one that would drift through a room is
  // moved straight away from it, just far enough. (Done after the houses are
  // placed, so all the other houses stay exactly where they were.)
  {
    const rooms = [lookout.group, dining.group].map((g) => {
      tw.root.updateWorldMatrix(true, true);
      return g.getWorldPosition(new V3());
    });
    const ROOM_R = 3.2;
    for (const sh of ships) {
      const reach = Math.max(sh.amp.x, sh.amp.z) + sh.sc * 1.2;
      for (const r of rooms) {
        if (Math.abs(sh.base.y - r.y) > 4 + sh.amp.y + sh.sc) continue;
        const dx = sh.base.x - r.x, dz = sh.base.z - r.z, d = Math.hypot(dx, dz);
        const need = ROOM_R + reach;
        if (d < need) {
          const ux = d > 1e-3 ? dx / d : 1, uz = d > 1e-3 ? dz / d : 0;
          sh.base.x = r.x + ux * need; sh.base.z = r.z + uz * need;
        }
      }
    }
  }
  // ...and clear of the phone booth and the paper planes round it (未接來電)
  for (const sh of ships) {
    const reach = Math.max(sh.amp.x, sh.amp.z) + sh.sc * 1.2;
    if (Math.abs(sh.base.y - boothBase.y) > 4.5 + sh.amp.y + sh.sc) continue;
    const dx = sh.base.x - boothBase.x, dz = sh.base.z - boothBase.z, d = Math.hypot(dx, dz);
    const need = 3.6 + reach;
    if (d < need) {
      const ux = d > 1e-3 ? dx / d : 1, uz = d > 1e-3 ? dz / d : 0;
      sh.base.x = boothBase.x + ux * need; sh.base.z = boothBase.z + uz * need;
    }
  }
  // ...and out of the circle the floating bridge sweeps when it turns (浪流連)
  {
    const mid = bridgeSpin.position.clone().applyAxisAngle(new V3(0, 1, 0), 0.12)
      .add(bridgeBase).addScaledVector(bridgeAwayDir, BRIDGE_AWAY);
    const SWEEP_R = bridgeSpin.position.x + 0.8;
    for (const sh of ships) {
      const reach = Math.max(sh.amp.x, sh.amp.z) + sh.sc * 1.2;
      if (Math.abs(sh.base.y - mid.y) > 4 + sh.amp.y + sh.sc) continue;
      const dx = sh.base.x - mid.x, dz = sh.base.z - mid.z, d = Math.hypot(dx, dz);
      const need = SWEEP_R + reach;
      if (d < need) {
        const ux = d > 1e-3 ? dx / d : 1, uz = d > 1e-3 ? dz / d : 0;
        sh.base.x = mid.x + ux * need; sh.base.z = mid.z + uz * need;
      }
    }
  }

  // ---------------------------------------------------- airplane
  const plane = airplane();
  plane.scale.setScalar(1.15);
  world.add(plane);
  anchors.airplane = plane;
  let planeVis = 1;

  // ---------------------------------------------------- register displacement
  function registerHouses() {
    for (const isl of islands) {
      for (const h of isl.houses) {
        h.holder.position.set(h.cur.x, 0, h.cur.z);
        scatter.add(h.holder, 'house', { dynamic: true, outward: h.holder.position });
        scatter.addParts(h.inner);
      }
    }
  }
  for (const isl of islands) {
    isl.plinth.layers.forEach(l => scatter.add(l, 'layer', { dynamic: true }));
    scatter.add(isl.plinth.top, 'ground');
  }
  cross.group.children.forEach(c => {
    if (c.userData.kind === 'part') { scatter.add(c, 'fragment', { outward: c.position }); scatter.addParts(c); }
    else scatter.add(c, 'road', { outward: c.position });
  });
  for (const [b, isl] of [[nyHero, ny], [twHero, tw]]) {
    scatter.add(b.group, 'house', { outward: b.group.position });
    scatter.addParts(b.group);
    void isl;
  }
  mtn.peaks.forEach(m => scatter.add(m, 'fragment', { outward: m.position }));
  twPoles.forEach(p => scatter.add(p.group, 'part'));
  for (const t of towers) { scatter.add(t, 'house', { outward: t.position }); scatter.addParts(t); }
  scatter.add(bridgeRoot, 'satellite', { dynamic: true });
  scatter.addParts(bridge.group);
  for (const t of taxis) scatter.add(t.g, 'fragment', { dynamic: true });
  for (const sh of ships) {
    scatter.add(sh.g, 'satellite', { dynamic: true });
    scatter.addParts(sh.g);
  }
  for (const f of [nyDoor]) {
    scatter.add(f, 'fragment', { outward: f.position });
    scatter.addParts(f);
  }
  scatter.add(belt, 'satellite');
  for (const rd of riders) scatter.add(rd.g, 'fragment', { dynamic: true });
  scatter.add(ladder.group, 'satellite', { dynamic: true });
  for (const s of sats) {
    scatter.add(s.g, 'satellite', { dynamic: true });
    s.g.children.slice(1).forEach(c => scatter.addParts(c));
  }

  // ---------------------------------------------------- update
  const tmpV = new V3();
  function update({
    loopT, nowSec, dt, angle, floatI, houseCount,
    showMain, showSatellites, airplaneVisible, presetId = '', breathe = 1,
    bridgeLights = false, bridgeSpin: spinOn = false,
  }) {
    const ph = loopT / LOOP_SECONDS;
    const a = Math.min(floatI, 1.5);                       // gentle floating amount
    const S = Math.min(1, Math.max(0, (floatI - 1) / 4));   // displacement amount
    scatter.update(S, ph);

    const kVis = 1 - Math.exp(-dt * 2.2);
    // the breath, as a wave across an island: w in -1..1, and the lean that
    // follows its slope (so things tip with the swell, never off the ground)
    const bwOut = { w: 0, tx: 0, tz: 0 };
    function breathWave(idx, x, z) {
      const u = TAU * (ph * 8 + idx * 0.25) - x * 0.3 - z * 0.12;
      bwOut.w = Math.sin(u);
      const c = Math.cos(u);
      bwOut.tz = 0.035 * c;          // lean along the wave (x)
      bwOut.tx = -0.015 * c;
      return bwOut;
    }
    islands.forEach((isl, idx) => {
      isl.vis += ((showMain ? 1 : 0) - isl.vis) * kVis;
      const sv = Math.max(0.0001, isl.vis * isl.vis * (3 - 2 * isl.vis));
      isl.root.scale.setScalar(sv);
      isl.root.scale.y = sv * (1 + 0.03 * breathe * Math.sin(TAU * (ph * 8 + idx * 0.25)));   // breathing
      isl.root.visible = sv > 0.002;

      isl.root.position.copy(isl.center);
      isl.root.position.y += Math.sin(TAU * (ph * 2 + idx * 0.5)) * 0.35 * a;
      isl.root.rotation.x = Math.sin(TAU * (ph + idx * 0.3)) * 0.025 * a;
      isl.root.rotation.z = Math.sin(TAU * (ph * 3 + 0.2 + idx * 0.4)) * 0.018 * a;
      isl.spinner.rotation.y = idx === 0 ? angle : -angle + 0.6;

      isl.plinth.layers.forEach((m, i) => {
        m.rotation.set(0, m.userData.baseRot + Math.sin(TAU * (ph * (i + 1) + i * 0.17 + idx * 0.1)) * 0.06 * a, 0);
        // the soft layers breathe in and out, one after another, every 15 s
        const br = Math.sin(TAU * (ph * 8 - i * 0.12 + idx * 0.25));
        m.scale.set(1 + 0.07 * breathe * br, 1 + 0.22 * breathe * br, 1 + 0.07 * breathe * br);
        m.position.set(0, m.userData.scatter.basePos.y, 0);
        scatter.apply(m);
      });

      const shown = Math.round(houseCount * isl.houses.length / MAX_HOUSES);
      isl.houses.forEach((h, i) => {
        const tgt = i < shown ? 1 : 0;
        h.vis += (tgt - h.vis) * kVis;
        if (Math.abs(tgt - h.vis) < 0.002) h.vis = tgt;
        const s = h.vis * h.vis * (3 - 2 * h.vis);
        h.holder.visible = s > 0.002;
        h.holder.scale.setScalar(Math.max(s, 0.0001));

        let { x, z, ry } = h.cur;
        let lift = 0;
        if (h.tween) {
          const p = Math.min(1, Math.max(0, (nowSec - h.tween.start) / h.tween.dur));
          const e = easeInOut(p);
          x = lerp(h.tween.from.x, h.tween.to.x, e);
          z = lerp(h.tween.from.z, h.tween.to.z, e);
          ry = lerpAngle(h.tween.from.ry, h.tween.to.ry, e);
          lift = Math.sin(Math.PI * e) * 1.4;
          if (p >= 1) h.tween = null;
          h.cur = { x, z, ry };
        }
        // breathing: with each breath a wave rolls across the island and the
        // houses on it lift, stretch and lean a little with it
        const bw = breathWave(idx, x, z);
        // stays on the ground: breathing stretches and leans it from its base,
        // and the gentle bob only ever sinks it a touch, never lifts it off
        h.holder.position.set(x, lift + (Math.sin(TAU * (ph * h.kBob + h.ph)) - 1) * 0.03 * a, z);
        h.holder.rotation.set(breathe * bw.tx, ry, breathe * bw.tz);
        h.holder.scale.y *= 1 + 0.09 * breathe * bw.w;
        scatter.apply(h.holder);
        // roofs barely lift as the house breathes out (more would open a gap)
        h.roof.position.copy(h.roofBase);
        h.roof.position.y += Math.pow(Math.max(0, Math.sin(TAU * (ph * h.kRoof + h.phRoof))), 8) * 0.04 * a;
        h.roof.rotation.set(0, 0, 0);
        scatter.apply(h.roof);
      });
    });

    // the other things standing on the islands breathe with the houses
    for (const [o, idx] of breathers) {
      const ud = o.userData;
      if (ud.bY === undefined) { ud.bY = o.position.y; ud.bRX = o.rotation.x; ud.bRZ = o.rotation.z; ud.bSY = o.scale.y; }
      const bw = breathWave(idx, o.position.x, o.position.z);
      const reset = !(ud.scatter && !ud.scatter.dynamic);   // scatter already reset it this frame
      const lift = 0;   // things stay on the ground; they stretch and lean instead
      if (reset) { o.position.y = ud.bY + lift; o.rotation.x = ud.bRX; o.rotation.z = ud.bRZ; }
      else o.position.y += lift;
      if (!ud.noLean) { o.rotation.x += breathe * bw.tx; o.rotation.z += breathe * bw.tz; }
      o.scale.y = ud.bSY * (1 + (ud.noLean ? 0.12 : 0.07) * breathe * bw.w);
    }

    updateWires(S);

    // cabs: whole laps per loop, nine stop-and-go steps per lap
    for (const t of taxis) {
      const q = (ph + t.off) * t.stops;
      const step = Math.floor(q), f = q - step;
      const e = f < 0.6 ? (f / 0.6) * (f / 0.6) * (3 - 2 * f / 0.6) : 1;
      const d = ((step + e) / t.stops) * t.rt.L * t.rt.dir;
      routePoint(t.rt, d, t.g.position);
      routePoint(t.rt, d + 0.3 * t.rt.dir, tmpV);
      t.g.rotation.set(0, Math.atan2(tmpV.x - t.g.position.x, tmpV.z - t.g.position.z), 0);
      scatter.apply(t.g);
    }

    // traffic signal: four cycles per loop
    const q = (ph * 4) % 1;
    const phase = q < 0.45 ? 2 : q < 0.55 ? 1 : 0;
    cross.lamps.forEach((l, i) => l.material.color.copy(i === phase ? l.userData.on : l.userData.off));

    sats.forEach((s, i) => {
      s.vis += ((showSatellites ? 1 : 0) - s.vis) * kVis;
      const sv = Math.max(0.0001, s.vis * s.vis * (3 - 2 * s.vis));
      s.g.scale.setScalar(sv);
      s.g.visible = sv > 0.002;
      s.g.position.copy(s.base);
      const sa = s.still ? 0 : a;
      s.g.position.y += Math.sin(TAU * (ph * s.k + s.ph)) * 0.45 * sa;
      // one slow turn per loop (alternating directions), plus a gentle sway
      s.g.rotation.set(0, s.yaw + s.spin * TAU * ph + Math.sin(TAU * (ph + s.ph)) * 0.3 * sa * (s.spin ? 0.3 : 1), 0);
      const b2 = Math.sin(TAU * (ph * 8 + s.ph));                 // small islands breathe too
      s.g.children[0].scale.set(1 + 0.05 * breathe * b2, 1 + 0.18 * breathe * b2, 1 + 0.05 * breathe * b2);
      scatter.apply(s.g);
    });

    ships.forEach((sh, i) => {
      sh.vis += ((showSatellites ? 1 : 0) - sh.vis) * kVis;
      const sv = Math.max(0.0001, sh.vis * sh.vis * (3 - 2 * sh.vis));
      sh.g.visible = sv > 0.002;
      sh.g.scale.setScalar(sh.sc * sv);
      const m = 0.6 + 0.4 * Math.min(a, 1);   // still drift a little at float 0
      sh.g.position.set(
        sh.base.x + Math.sin(TAU * (ph * sh.k[0] + sh.ph[0])) * sh.amp.x * m,
        sh.base.y + Math.sin(TAU * (ph * sh.k[1] + sh.ph[1])) * sh.amp.y * m,
        sh.base.z + Math.cos(TAU * (ph * sh.k[2] + sh.ph[2])) * sh.amp.z * m);
      sh.g.rotation.set(
        Math.sin(TAU * (ph * sh.kt + sh.ph[0])) * sh.tilt[0],
        sh.yaw + TAU * ph * sh.spin + 0.4 * Math.sin(TAU * (ph + sh.ph[2])),
        Math.sin(TAU * (ph * sh.kt + sh.ph[1] + 0.25)) * sh.tilt[1], 'YXZ');
      scatter.apply(sh.g);
      void i;
    });

    // bags on the belts: one lap per loop, the two links running opposite ways
    for (const rd of riders) {
      rd.lp.at((ph + rd.off) * rd.lp.L * rd.dir, rd.g.position, tmpV);
      if (rd.dir < 0) tmpV.negate();
      rd.g.rotation.set((rd.lie ? -Math.PI / 2 : 0) - Math.asin(Math.max(-1, Math.min(1, tmpV.y))), Math.atan2(tmpV.x, tmpV.z) + rd.twist, 0, 'YXZ');
      if (rd.lie) rd.g.position.y += 0.15;   // lying flat: lift it onto the belt
      rd.g.visible = showSatellites;
      scatter.apply(rd.g);
    }
    belt.visible = showSatellites;

    // birds between the portals: they appear out of one and vanish into the other
    for (const b of portalBirds) {
      const u = ((ph * b.k + b.off) % 1 + 1) % 1;
      portalPath(b, u, pbPos);
      portalPath(b, Math.min(1, u + 0.004), pbNext);
      b.g.position.copy(pbPos);
      if (pbNext.distanceToSquared(pbPos) > 1e-8) { pbM.lookAt(pbNext, pbPos, pbUp); pbQ.setFromRotationMatrix(pbM); b.g.quaternion.copy(pbQ); }
      const show = Math.min(1, u / 0.03, (1 - u) / 0.03) * (showSatellites ? 1 : 0);
      b.g.visible = show > 0.01;
      b.g.scale.setScalar(b.type.scale * Math.max(0.0001, show));
      const flap = 0.15 + Math.sin(TAU * (ph * b.type.flap + b.flapPh)) * 0.6;
      b.L.rotation.z = flap;
      b.R.rotation.z = -flap;
    }
    portals.forEach((p, i) => { p.visible = showSatellites; p.rotation.y = pYaw + Math.sin(TAU * (ph + i * 0.5)) * 0.06; });

    // the ladder sways a little, the window at its top with it
    ladder.group.position.copy(ladderBase);
    ladder.group.position.y += Math.sin(TAU * (ph * 2 + 0.3)) * 0.3 * a;
    ladder.group.rotation.set(Math.sin(TAU * (ph + 0.1)) * 0.02 * a, -0.35 + Math.sin(TAU * ph) * 0.08 * a, Math.sin(TAU * (ph * 2 + 0.6)) * 0.025 * a);
    ladder.group.visible = showSatellites;
    scatter.apply(ladder.group);
    ladderOrbit.position.copy(ladder.group.position);
    ladderOrbit.rotation.set(0, -TAU * ph, 0);   // one slow circle per 2-minute loop
    stairsOrbit.position.copy(stairsSat.g.position);
    stairsOrbit.rotation.set(0, -TAU * ph, 0);   // same slow circle, round the stairs

    // lighthouse: one sweep every 15 s, with small hesitations and a slow
    // up/down tilt — it is looking for something
    lh.pivot.rotation.set(0, TAU * ph * 8 + 0.25 * Math.sin(TAU * ph * 24), 0.07 * Math.sin(TAU * ph * 5));


    // the floating bridge: its lights fade in over ~2 s; the spin speeds up /
    // slows down over ~3 s (one turn every 40 s), and when it stops it
    // settles back home the short way
    bridgeLit += ((bridgeLights ? 1 : 0) - bridgeLit) * (1 - Math.exp(-dt * 1.5));
    bridge.setLights(bridgeLit, nowSec);
    bridgeTurn += ((spinOn ? 1 : 0) - bridgeTurn) * (1 - Math.exp(-dt * 0.8));
    if (spinOn || bridgeTurn > 0.02) bridgeYaw += dt * bridgeTurn * TAU / 40;
    else {
      bridgeYaw = (((bridgeYaw + Math.PI) % TAU) + TAU) % TAU - Math.PI;
      bridgeYaw *= Math.exp(-dt * 1.2);
    }
    bridgeSpin.rotation.y = bridgeYaw;
    // out of New York's way while turned (and until it is home again)
    const away = Math.max(bridgeTurn, Math.min(1, Math.abs(bridgeYaw) / 0.3));
    // a slow bob and sway
    bridgeRoot.visible = showSatellites;
    bridgeRoot.position.copy(bridgeBase).addScaledVector(bridgeAwayDir, BRIDGE_AWAY * away);
    bridgeRoot.position.y += Math.sin(TAU * (ph * 2 + 0.15)) * 0.35 * Math.max(0.4, a);
    bridgeRoot.rotation.set(Math.sin(TAU * (ph + 0.4)) * 0.02, 0.12 + Math.sin(TAU * ph) * 0.06, Math.sin(TAU * (ph * 2 + 0.7)) * 0.015);
    scatter.apply(bridgeRoot);

    // ---- round 8
    apple.visible = board.visible = showSatellites;
    apple.position.set(-38 + Math.sin(TAU * ph) * 2.2, 10 + Math.sin(TAU * ph * 2) * 1.2, -4 + Math.cos(TAU * ph) * 2);
    apple.rotation.set(Math.sin(TAU * ph * 2) * 0.15, TAU * ph, Math.sin(TAU * (ph + 0.3)) * 0.2);
    mill.sails.rotation.z = -TAU * ph * 10;
    // behind the world, so it never drifts in front of a close-up
    board.position.set(Math.sin(TAU * ph) * 12, 14.5 + Math.sin(TAU * ph * 2) * 0.6, -20 + Math.cos(TAU * ph) * 1.5);
    board.rotation.set(Math.sin(TAU * ph * 3) * 0.04, -0.35 * Math.sin(TAU * ph), Math.sin(TAU * ph * 2) * 0.05);


    // ---- round 10
    fishes.forEach(fi => {
      fishPos(fi, ph, fA); fishPos(fi, ph + 0.003, fB);
      fi.group.position.copy(fA);
      fM.lookAt(fB, fA, fUp); fi.group.quaternion.setFromRotationMatrix(fM);
      fi.tail.rotation.y = Math.sin(TAU * (ph * 150 + fi.p * 5)) * 0.45;
    });
    clock.group.visible = showSatellites;
    clock.group.position.copy(clockBase);
    clock.group.position.y += Math.sin(TAU * ph) * 0.4;
    clock.group.rotation.set(Math.sin(TAU * (ph + 0.2)) * 0.05, -0.35 + Math.sin(TAU * ph) * 0.12, Math.sin(TAU * ph * 2) * 0.04);
    // time runs fast (but half what it was): the minute hand goes round
    // every 20 s, the second hand whirls, the face breathes a little
    clock.minute.rotation.z = -TAU * ph * 6;
    clock.hour.rotation.z = -TAU * ph - 1.2;
    clock.second.rotation.z = -TAU * ph * 30;
    const cb = Math.sin(TAU * ph * 2);
    clock.body.scale.set(1 + 0.05 * cb, 1 - 0.04 * cb, 1);
    clock.body.rotation.z = Math.sin(TAU * ph) * 0.08;
    dining.group.visible = presetId === 'dining';
    if (dining.group.visible) animateSteam(dining.steam, ph);
    animateLaundry(laundry.items, ph);
    appleOrbit.position.copy(apple.position);
    appleOrbit.rotation.set(0, -TAU * ph, 0);
    // the phone booth bobs gently; its paper planes circle it
    booth.visible = showSatellites;
    booth.position.copy(boothBase);
    booth.position.y += Math.sin(TAU * (ph * 2 + 0.3)) * 0.3 * Math.max(0.4, a);
    booth.rotation.set(Math.sin(TAU * (ph + 0.5)) * 0.03, -0.5 + Math.sin(TAU * ph) * 0.06, Math.sin(TAU * (ph * 2 + 0.1)) * 0.02);
    for (const pp of paperPlanes) {
      pp.g.visible = showSatellites;
      const an = TAU * (ph * 8 + pp.ph0);              // 8 laps per loop: one every 15 s
      pp.g.position.set(
        booth.position.x + Math.cos(an) * pp.r,
        booth.position.y + pp.h0 + Math.sin(TAU * (ph * 16 + pp.ph0 * 2)) * pp.bob,
        booth.position.z + Math.sin(an) * pp.r);
      // nose along the circle, banked in toward the booth, nose bobbing with the climb
      pp.g.rotation.set(
        -Math.cos(TAU * (ph * 16 + pp.ph0 * 2)) * 0.15,
        Math.atan2(-Math.sin(an), Math.cos(an)),
        0.35, 'YXZ');
    }

    // ---- song scenes
    lookout.group.visible = presetId === 'lookout';
    if (lookout.group.visible) {
      lookout.curtains.forEach(c => { c.pivot.rotation.x = -(0.05 + 0.05 * Math.sin(TAU * (ph * 6 + c.s * 0.2))); c.pivot.rotation.z = 0.03 * Math.sin(TAU * (ph * 4 + c.s * 0.3)); });
      lookout.fanHead.rotation.y = 0.8 * Math.sin(TAU * ph * 4);
      lookout.blades.rotation.z = -TAU * ph * 240;
    }
    bath.group.visible = presetId === 'bathroom';
    bath.group.position.copy(bathBase);
    bath.group.position.y += Math.sin(TAU * ph * 2) * 0.2;
    bath.group.rotation.z = Math.sin(TAU * (ph + 0.2)) * 0.02;
    bath.duck.position.y = 0.76 + Math.sin(TAU * ph * 12) * 0.015;
    bath.duck.rotation.y = Math.sin(TAU * ph * 3) * 0.4;
    if (bath.group.visible) {
      // subtle flicker: a faint shimmer, and now and then a quick dip
      // (a few times a minute) like an old bulb
      const tf = nowSec;
      let fl = 1 - 0.05 * (0.5 + 0.5 * Math.sin(tf * 17.3) * Math.sin(tf * 5.1 + 1.3));
      const slot = Math.floor(tf * 8);
      const hsh = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
      if (hsh > 0.975) fl *= 0.55 + 0.25 * Math.abs(Math.sin(slot * 7.1));
      bath.lamp.bulb.material.color.copy(bath.lamp.baseColor).multiplyScalar(0.55 + 0.45 * fl);
      bath.lamp.glow.userData.flicker = fl;
    }

    pairPos(ph, ppA); pairPos(ph + 0.002, ppB);
    pairAnchor.position.copy(ppA);
    ppM.lookAt(ppB, ppA, ppUp); ppQ.setFromRotationMatrix(ppM);
    pairAnchor.quaternion.copy(ppQ);
    ppE.set(Math.sin(TAU * ph * 7) * 0.03, Math.sin(TAU * ph * 5) * 0.04, Math.sin(TAU * ph * 3) * 0.03);
    pairAnchor.quaternion.multiply(ppQ.setFromEuler(ppE));          // a little handheld sway
    ppSide.set(1, 0, 0).applyQuaternion(pairAnchor.quaternion);
    const sep = 0.9 + 0.6 * Math.sin(TAU * ph * 6);
    pair.forEach((b, i) => {
      const s = i ? 1 : -1;
      b.g.position.copy(ppA).addScaledVector(ppSide, s * sep);
      b.g.position.y += s * 0.22 * Math.sin(TAU * ph * 8);
      b.g.quaternion.copy(pairAnchor.quaternion);
      const flap = 0.15 + Math.sin(TAU * (ph * 95 + i * 0.37)) * 0.6;
      b.L.rotation.z = flap; b.R.rotation.z = -flap;
    });

    ring.path(ringAt(ph), busA); ring.path(ringAt(ph + 0.004), busB);
    tripBus.position.copy(busA);
    tripBus.rotation.set(0, Math.atan2(busB.x - busA.x, busB.z - busA.z), 0);

    animateBusStop(busStopG.userData.traffic, ph);
    animateLuggage(luggageAnim, ph);

    // airliner: one lap per loop, high above everything
    planeVis += ((airplaneVisible ? 1 : 0) - planeVis) * kVis;
    plane.visible = planeVis > 0.01;
    plane.scale.setScalar(1.15 * Math.max(0.0001, planeVis));
    const pa = TAU * ph;
    plane.position.set(Math.cos(pa) * 46, 15 + Math.sin(TAU * ph * 2) * 1.2, -6 + Math.sin(pa) * 24);
    tmpV.set(-Math.sin(pa) * 46, 0, Math.cos(pa) * 24).normalize();
    plane.rotation.set(0, Math.atan2(tmpV.x, tmpV.z), -0.22);

    // the drifting point the airplane window looks down at
    drift.position.set(Math.sin(TAU * ph) * 14, 0, -2 + Math.sin(TAU * ph * 2) * 5);
  }

  return { group: world, anchors, islands, setLayout, update, scatterInfo: scatter.maxOffset };
}
