// Controller: edits the shared state and broadcasts it to any open viewer.

import {
  CHANNEL_NAME, LOOP_SECONDS, DEFAULT_STATE, ATMOSPHERES,
  loadState, saveState, sanitize,
} from './config.js';
import { GROUPS, presetById, isView } from './presets.js';
import { SONG_SCENES } from './songs.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, '0');

let state = loadState();
let selectedSong = state.activeSong >= 0 ? state.activeSong : 0;
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

// ------------------------------------------------------------- formatting

const fmt = {
  birdSpeed: v => `${v.toFixed(2)}×`,
  contrast: v => v === 1 ? 'as drawn' : `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`,
  skyDim: v => v === 0 ? 'off' : `−${Math.round(v * 100)}%`,  zoom: v => `${v.toFixed(2)}×`,
  cameraAngle: v => `${v.toFixed(1)}°`,
  cameraOrbit: v => `${v > 0 ? '+' : ''}${Math.round(v)}°`,
  transition: v => `${v.toFixed(1)} s`,
  twHour: v => `${pad(Math.round(v) % 24)}:00 Taiwan · ${pad((Math.round(v) + 12) % 24)}:00 New York`,
};

// ------------------------------------------------------------- broadcast

let pending = false, pendingEase = false;
function push(ease = false) {
  saveState(state);
  pendingEase = pendingEase || ease;
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    channel?.postMessage({ type: 'state', state, ease: pendingEase });
    pendingEase = false;
  });
}

// ------------------------------------------------------------- applying presets + scenes

function applyAtmosphere(id) {
  const a = ATMOSPHERES.find(x => x.id === id);
  if (a) [state.bgTop, state.bgMid, state.bgBottom] = a.colors;
}

function applyEffects(effects = {}) {
  for (const [k, v] of Object.entries(effects)) {
    if (k in DEFAULT_STATE && typeof v === typeof DEFAULT_STATE[k]) state[k] = v;
  }
}

// ------------------------------------------------------------- saved song views
// Kept in views.json in the project folder (written by serve.py), keyed by
// title + artist so they survive reordering songs.js. A saved view overrides
// the song's default camera in js/songs.js. They used to live in each
// browser's storage; those old browser copies are ignored now, so every
// computer sees exactly what is in views.json.

const songKey = (s) => `${s.title}|${s.artist}`;
let views = {};
let canWrite = false;
const viewFile = () => $('#viewFile');
function setFileStatus(text, ok) {
  const el = viewFile();
  if (!el) return;
  el.textContent = text;
  el.dataset.ok = String(ok);
}
async function loadViews() {
  try {
    const r = await fetch('views.json', { cache: 'no-store' });
    views = r.ok ? (await r.json()) || {} : {};
  } catch { views = {}; }
  try { canWrite = (await fetch('api/ping', { cache: 'no-store' })).ok; } catch { canWrite = false; }
  const n = Object.keys(views).length;
  setFileStatus(canWrite
    ? `views.json · ${n} saved view${n === 1 ? '' : 's'}`
    : `views.json · ${n} saved · read-only: start with python3 serve.py to save`, canWrite);
  render();
}
// Re-read views.json right before changing it, so a tab opened before the
// file changed (a new zip, another tab) never writes back an old copy.
async function freshViews() {
  try {
    const r = await fetch('views.json', { cache: 'no-store' });
    if (r.ok) views = (await r.json()) || {};
  } catch { /* keep what we have */ }
}
async function saveViews() {
  if (!canWrite) return false;
  try {
    const r = await fetch('api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(views),
    });
    if (!r.ok) return false;
    const n = Object.keys(views).length;
    setFileStatus(`views.json · ${n} saved view${n === 1 ? '' : 's'}`, true);
    return true;
  } catch { return false; }
}
// a song can bump viewVersion in songs.js to retire views saved before the change
const viewFor = (s) => {
  const v = views[songKey(s)];
  return v && (v.ver || 1) >= (s.viewVersion || 1) ? v : null;
};

// The camera a song opens on. Newest first: a view saved into views.json,
// then a view written in songs.js, then the old style (a preset plus slider
// values), which still works for anything saved before views became their
// own cameras.
// Saved with each view along with the camera, hour and sky. Anything a song
// hasn't saved keeps its value from songs.js, or from the song before.
// (House layout and stroke style are never saved per song.)
const SAVED_SETTINGS = ['floatIntensity', 'birdSpeed', 'breatheOn', 'rippleOn', 'rainOn', 'snowOn', 'contrast', 'skyDim'];

function songCamera(s) {
  const saved = viewFor(s);
  if (saved && isView(saved.view)) return { view: saved.view, saved };
  if (saved && saved.camera) return { legacy: saved, saved };
  if (isView(s.view)) return { view: s.view, saved: null };
  return { legacy: s, saved: null };
}

function applySavedView(v) {
  state.customView = v;
  state.cameraPreset = v.scene || 'view';
  state.zoom = v.zoom;
  state.cameraAngle = v.elevation;
  state.cameraOrbit = 0;
  state.cameraPanX = 0; state.cameraPanY = 0; state.cameraPanZ = 0;
  applyEffects(v.effects);
  state.cameraCue += 1;
}

function applyPreset(id) {
  const p = presetById(id);
  state.customView = null;
  state.cameraPreset = p.id;
  state.zoom = p.zoom;
  state.cameraAngle = p.elevation;
  state.cameraOrbit = 0;
  state.cameraPanX = 0; state.cameraPanY = 0; state.cameraPanZ = 0;
  if (p.atmosphere) applyAtmosphere(p.atmosphere);
  applyEffects(p.effects);
  state.cameraCue += 1;
}

function applyLegacy(v) {
  if (typeof v.zoom === 'number') state.zoom = v.zoom;
  if (typeof v.angle === 'number') state.cameraAngle = v.angle;
  if (typeof v.orbit === 'number') state.cameraOrbit = v.orbit;
  if (Array.isArray(v.pan)) [state.cameraPanX, state.cameraPanY, state.cameraPanZ] = v.pan;
}

function activateScene(i) {
  i = ((i % SONG_SCENES.length) + SONG_SCENES.length) % SONG_SCENES.length;
  const s = SONG_SCENES[i];
  const cam = songCamera(s);
  if (cam.view) applySavedView(cam.view);
  else { applyPreset(cam.legacy.camera || s.camera); applyLegacy(cam.legacy); }
  if (s.atmosphere) applyAtmosphere(s.atmosphere);
  if (typeof s.float === 'number') state.floatIntensity = s.float;
  if (s.birds) {
    if (typeof s.birds.count === 'number') state.birdCount = s.birds.count;
    if (typeof s.birds.speed === 'number') state.birdSpeed = s.birds.speed;
  }
  applyEffects(s.effects);
  if (typeof s.time === 'number') state.twHour = s.time;
  if (Array.isArray(s.sky)) [state.bgTop, state.bgMid, state.bgBottom] = s.sky;
  if (cam.saved) {                  // a view saved into views.json: its hour, sky + settings win
    if (typeof cam.saved.time === 'number') state.twHour = cam.saved.time;
    if (Array.isArray(cam.saved.sky)) [state.bgTop, state.bgMid, state.bgBottom] = cam.saved.sky;
    for (const k of SAVED_SETTINGS) {
      const v = cam.saved.settings?.[k];
      if (v !== undefined && typeof v === typeof DEFAULT_STATE[k]) state[k] = v;
    }
  }
  state.activeSong = i;
  selectedSong = i;
  render();
  push(true);
  revealInList(i);
}

// Scroll only the song list (never the page) so the active song shows,
// keeping Prev / Next where they are under your finger.
function revealInList(i, smooth = true) {
  const list = $('#songList');
  const li = list?.querySelector(`li[data-i="${i}"]`);
  if (!li) return;
  const top = li.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
  const bottom = top + li.offsetHeight;
  let y = list.scrollTop;
  if (top < y) y = top;
  else if (bottom > y + list.clientHeight) y = bottom - list.clientHeight;
  if (y !== list.scrollTop) list.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
}

// what to call a song's camera in the list
const shortName = (n) => (n || '').replace(/ \(.*\)$/, '');
function cameraLabel(cam) {
  if (cam.view) {
    const v = cam.view;
    const n = v.name || (v.scene ? shortName(v.label) : v.follow ? shortName(v.label) : 'Fixed view');
    return `${v.follow ? '↻ ' : ''}${n}`;
  }
  const p = presetById(cam.legacy.camera);
  return `${p.follow ? '↻ ' : ''}${shortName(p.name)}`;
}

// ------------------------------------------------------------- build dynamic UI

// camera buttons, grouped by place
const camEl = $('#cameraPresets');
for (const g of GROUPS) {
  const h = document.createElement('h4');
  h.className = 'cam-group';
  h.textContent = g.name;
  camEl.appendChild(h);
  const box = document.createElement('div');
  box.className = 'cam-grid';
  for (const id of g.ids) {
    const p = presetById(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cam';
    b.dataset.id = p.id;
    b.innerHTML = `<span>${p.name.replace(/ \(.*\)$/, '')}</span>${p.follow ? '<span class="follow-mark" title="follows something that moves">↻</span>' : ''}`;
    b.addEventListener('click', () => { applyPreset(p.id); render(); push(true); });
    box.appendChild(b);
  }
  camEl.appendChild(box);
}

// song list
const listEl = $('#songList');
SONG_SCENES.forEach((s, i) => {
  const li = document.createElement('li');
  li.dataset.i = i;
  li.tabIndex = 0;
  li.innerHTML = `<span class="num">${pad(i + 1)}</span>
    <span class="song"><strong>${s.title}</strong> <span class="artist">${s.artist}</span></span>
    <span class="cam-tag"></span>`;
  li.addEventListener('click', () => { selectedSong = i; render(); });
  li.addEventListener('dblclick', () => activateScene(i));
  listEl.appendChild(li);
});

// save-view controls: they act on the song selected in the list
const viewMsg = $('#viewMsg');
let viewMsgTimer = 0;
const say = (t) => { viewMsg.textContent = t; clearTimeout(viewMsgTimer); viewMsgTimer = setTimeout(() => { viewMsg.textContent = ''; }, 4000); };
let pendingSave = null;
$('#saveView').addEventListener('click', () => {
  if (!canWrite) { say("Can't save: start the project with python3 serve.py (not http.server)."); return; }
  if (!channel || $('#status').dataset.live !== 'true') { say('Open the viewer first.'); return; }
  pendingSave = selectedSong;
  channel.postMessage({ type: 'captureView', song: pendingSave });
});
$('#clearView').addEventListener('click', async () => {
  const s = SONG_SCENES[selectedSong];
  await freshViews();
  render();
  if (!viewFor(s)) { say('No saved view for this song.'); return; }
  if (!canWrite) { say("Can't change views.json: start the project with python3 serve.py."); return; }
  const before = views[songKey(s)];
  delete views[songKey(s)];
  if (await saveViews()) { render(); say(`Cleared the view for ${s.title}; it's back to its default.`); }
  else { views[songKey(s)] = before; say("Couldn't write views.json. Is serve.py still running?"); }
});
// atmosphere presets
const presetsEl = $('#presets');
ATMOSPHERES.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'preset';
  b.dataset.id = p.id;
  b.title = p.id;
  b.style.background = `linear-gradient(180deg, ${p.colors.join(', ')})`;
  b.innerHTML = `<span>${p.id}</span>`;
  b.addEventListener('click', () => { applyAtmosphere(p.id); render(); push(); });
  presetsEl.appendChild(b);
});

// ------------------------------------------------------------- UI <-> state

function render() {
  for (const el of $$('[data-key]')) {
    const k = el.dataset.key;
    if (el.type === 'checkbox') el.checked = !!state[k];
    else if (el.dataset.scale === 'log') {
      const lo = Math.log(+el.min), hi = Math.log(+el.max);
      el.dataset.lo = lo; el.dataset.hi = hi;
      el.value = String(+el.min + (Math.log(state[k]) - lo) / (hi - lo) * (+el.max - +el.min));
    } else el.value = state[k];
  }
  for (const out of $$('output[data-for]')) {
    const k = out.dataset.for;
    out.textContent = fmt[k] ? fmt[k](state[k]) : state[k];
  }
  $('#skyPreview').style.background = `linear-gradient(100deg, ${state.bgTop}, ${state.bgMid}, ${state.bgBottom})`;
  for (const b of $$('.preset')) {
    const p = ATMOSPHERES.find(x => x.id === b.dataset.id);
    b.setAttribute('aria-pressed', String(p.colors[0] === state.bgTop && p.colors[1] === state.bgMid && p.colors[2] === state.bgBottom));
  }
  for (const b of $$('.cam')) b.setAttribute('aria-pressed', String(!state.customView && b.dataset.id === state.cameraPreset));
  for (const b of $$('#strokeButtons button')) b.setAttribute('aria-pressed', String(b.dataset.stroke === state.stroke));
  for (const b of $$('#scatterButtons button')) b.setAttribute('aria-pressed', String(Math.abs(state.floatIntensity - parseFloat(b.dataset.float)) < 0.05));
  for (const li of $$('#songList li')) {
    const i = +li.dataset.i;
    li.classList.toggle('selected', i === selectedSong);
    li.classList.toggle('active', i === state.activeSong);
    const cam = songCamera(SONG_SCENES[i]);
    const hr = typeof cam.saved?.time === 'number' ? cam.saved.time : SONG_SCENES[i].time;
    li.querySelector('.cam-tag').innerHTML = (cam.saved ? '<span class="saved-mark" title="saved in views.json">●</span>' : '')
      + cameraLabel(cam) + (typeof hr === 'number' ? ` · ${pad(hr)}:00` : '');
  }
  const sel = SONG_SCENES[selectedSong];
  $('#saveView').textContent = `Save view → ${pad(selectedSong + 1)} ${sel.title}`;
  const s = SONG_SCENES[state.activeSong];
  $('#activeSong').textContent = s ? `${pad(state.activeSong + 1)} ${s.title} — ${s.artist}` : '—';
  $('#activeCamera').textContent = isView(state.customView)
    ? cameraLabel({ view: state.customView }) : presetById(state.cameraPreset).name;
}

// log-scale slider position -> value
function readSlider(el) {
  if (el.dataset.scale === 'log') {
    const lo = Math.log(+el.min), hi = Math.log(+el.max);
    const f = (+el.value - +el.min) / (+el.max - +el.min);
    return Math.exp(lo + f * (hi - lo));
  }
  return parseFloat(el.value);
}

const INTS = new Set(['houseCount', 'birdCount', 'twHour']);
for (const el of $$('[data-key]')) {
  const k = el.dataset.key;
  el.addEventListener('input', () => {
    if (el.type === 'checkbox') state[k] = el.checked;
    else if (el.type === 'range') state[k] = INTS.has(k) ? parseInt(el.value, 10) : readSlider(el);
    else state[k] = el.value;
    render();
    push();
  });
  // gently snap to whole numbers (seamless loops)
  if (el.dataset.snap) {
    el.addEventListener('change', () => {
      const v = state[k], n = Math.round(v);
      if (Math.abs(v - n) < 0.08 && v !== n) { state[k] = n; render(); push(); }
    });
  }
}

$('#rearrange').addEventListener('click', () => {
  let s;
  do { s = 1 + Math.floor(Math.random() * 99999); } while (s === state.layoutSeed);
  state.layoutSeed = s;
  push();
});

for (const b of $$('#scatterButtons button')) {
  b.addEventListener('click', () => { state.floatIntensity = parseFloat(b.dataset.float); render(); push(); });
}
for (const b of $$('#strokeButtons button')) {
  b.addEventListener('click', () => { state.stroke = b.dataset.stroke; render(); push(); });
}

$('#prevScene').addEventListener('click', () => activateScene((state.activeSong >= 0 ? state.activeSong : selectedSong + 1) - 1));
$('#nextScene').addEventListener('click', () => activateScene((state.activeSong >= 0 ? state.activeSong : selectedSong - 1) + 1));
$('#activateScene').addEventListener('click', () => activateScene(selectedSong));

$('#openViewer').addEventListener('click', () => window.open('viewer.html', 'whnvr-viewer'));

// performance keys (ignored while typing / dragging a slider)
window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); $('#nextScene').click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); $('#prevScene').click(); }
  else if (e.key === 'Enter' && (e.target === document.body || e.target.closest?.('#songList'))) { e.preventDefault(); activateScene(selectedSong); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!e.target.closest?.('#songList') && e.target !== document.body) return;
    e.preventDefault();
    selectedSong = Math.min(SONG_SCENES.length - 1, Math.max(0, selectedSong + (e.key === 'ArrowDown' ? 1 : -1)));
    render();
    revealInList(selectedSong, false);
  }
});

// ------------------------------------------------------------- show clock
// The controller keeps the one clock every viewer follows (loop time plus
// island turn, bird and cloud phases), so viewers on different computers show
// the same moment. Survives a reload of this page.

const CLOCK_KEY = 'whnvr-liminal-landing/clock';
let clock = { t: 0, angle: 0, bird: 0, cloud: 0 };
try {
  const c = JSON.parse(localStorage.getItem(CLOCK_KEY));
  if (c && typeof c.t === 'number') {
    const dt = state.autoAnimate ? Math.max(0, (Date.now() - c.wall) / 1000) : 0;
    clock = { t: c.t + dt, angle: c.angle + state.rotationSpeed * Math.PI * 2 / LOOP_SECONDS * dt, bird: c.bird + state.birdSpeed * dt / LOOP_SECONDS, cloud: c.cloud + state.cloudDrift * dt / LOOP_SECONDS };
  }
} catch { /* fresh clock */ }
let clockLast = performance.now();
// Each controller tab has an id. If another controller is open (a forgotten
// tab, an old window), they adopt each other's clock, so the viewer is never
// pulled between two different times (that made the islands jump).
const CLOCK_ID = Math.random().toString(36).slice(2);
function adoptClock(m) {
  tickClock();
  clock = { t: m.t, angle: m.angle, bird: m.bird, cloud: m.cloud };
}
function tickClock() {
  const now = performance.now();
  // the real time since the last tick, however long: when this tab is in the
  // background the browser runs timers rarely, and capping the step here made
  // the clock lose time (and the viewer jump to catch up)
  const dt = Math.min(3600, Math.max(0, (now - clockLast) / 1000));
  clockLast = now;
  if (!state.autoAnimate) return;
  clock.t += dt;
  clock.angle = (clock.angle + state.rotationSpeed * Math.PI * 2 / LOOP_SECONDS * dt) % (Math.PI * 2);
  clock.bird = (clock.bird + state.birdSpeed * dt / LOOP_SECONDS) % 1;
  clock.cloud = (clock.cloud + state.cloudDrift * dt / LOOP_SECONDS) % 1;
}
function sendClock() {
  tickClock();
  const msg = { t: clock.t, angle: clock.angle, bird: clock.bird, cloud: clock.cloud };
  channel?.postMessage({ type: 'clock', src: CLOCK_ID, ...msg });
  try { localStorage.setItem(CLOCK_KEY, JSON.stringify({ ...msg, wall: Date.now() })); } catch { /* private mode */ }
}
setInterval(tickClock, 100);
setInterval(sendClock, 2000);

// ------------------------------------------------------------- status

let lastStatus = 0;
const statusEl = $('#status');
const statusText = $('#statusText');

if (channel) {
  channel.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'hello' && m.from === 'viewer') push();
    else if (m.type === 'clock' && m.src && m.src !== CLOCK_ID) adoptClock(m);   // another controller's clock
    else if (m.type === 'state') { state = sanitize(m.state); saveState(state); render(); } // another controller
    else if (m.type === 'view' && m.song === pendingSave) {
      const s = SONG_SCENES[m.song];
      const entry = {
        view: m.view, time: state.twHour, sky: [state.bgTop, state.bgMid, state.bgBottom], ver: s.viewVersion || 1,
        settings: Object.fromEntries(SAVED_SETTINGS.map(k => [k, state[k]])),
      };
      pendingSave = null;
      freshViews().then(async () => {
        const before = views[songKey(s)];
        views[songKey(s)] = entry;
        if (await saveViews()) say(`Saved view, motion + atmosphere to ${pad(m.song + 1)} ${s.title}.`);
        else {
          if (before) views[songKey(s)] = before; else delete views[songKey(s)];
          say("Couldn't write views.json. Is serve.py still running?");
        }
        render();
      });
      // hold the captured view in the live state too (the viewer is already on it)
      state.customView = m.view;
      state.cameraPreset = m.view.scene || 'view';
      state.zoom = m.view.zoom; state.cameraAngle = m.view.elevation; state.cameraOrbit = 0;
      state.cameraPanX = 0; state.cameraPanY = 0; state.cameraPanZ = 0;
      render();
      push();
    }
    else if (m.type === 'status') {
      lastStatus = performance.now();
      statusEl.dataset.live = 'true';
      statusText.textContent = `connected · ${m.fps} fps`;
    }
  };
  channel.postMessage({ type: 'hello', from: 'control' });
} else {
  statusText.textContent = 'BroadcastChannel unsupported in this browser';
}

setInterval(() => {
  if (performance.now() - lastStatus > 1600) {
    statusEl.dataset.live = 'false';
    statusText.textContent = 'viewer not open';
  }
}, 800);

render();
push();
loadViews();
