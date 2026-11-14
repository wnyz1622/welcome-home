// Camera presets.
//
// A preset describes where the camera looks and from which direction, rather
// than a fixed position, so it keeps working while islands float, spin and
// come apart:
//
//   anchor     what the camera is attached to (see world.anchors):
//              world, drift, ny, tw, crossroads, twWindow, nyWindow,
//              suitcase, lighthouse, windowIsland, tinyHouse, stairs, wall, airplane,
//              subway, busStop, grove, henge, bridgeWindow, ladder, ladderWindow, luggage
//   frame      'world' (default): angles are measured in world space
//              'local': angles are measured in the anchor's own frame, so the
//              camera follows it as it turns (used for windows + crossroads)
//   target     [x, y, z] offset from the anchor (in the chosen frame)
//   azimuth    degrees around the vertical axis (0 = looking from +z)
//   elevation  degrees above the horizon (also the controller's Camera angle)
//   distance   how far the camera sits from the target. With an orthographic
//              camera this doesn't change size, but it decides what is in
//              front of the near plane — keep it small for close-ups so the
//              camera sits just outside a wall, never inside one.
//   zoom       orthographic zoom (1 ≈ one island fills the frame height)
//   durationScale  multiplies the controller's transition duration
//   atmosphere optional ATMOSPHERES id applied on activation
//   effects    optional state overrides applied on activation
//              (timezone, windowLight, halftone, clouds, ...)
//   overlay    'airplane' shows the airplane-window frame
//   group      which section of the controller the button sits in (GROUPS)
//   follow     true: a view saved from this camera keeps following its anchor
//              (things that move or turn). Otherwise a saved view is a fixed
//              spot in the world, independent of any button.
//   scene      true: this camera brings something with it (the cabin
//              windows, an interior); a saved view remembers that
//   hidden     true: no button in the controller (old songs may still use it)
//   sun        { at: [u, v], r } pins the sun to a screen spot (Manhattanhenge)

export const CAMERA_PRESETS = [
  {
    id: 'overview', name: 'World Overview',
    group: 'all',
    anchor: 'world', target: [0, 0.5, -1], azimuth: 0, elevation: 30, distance: 140, zoom: 0.56,
    effects: { timezone: 0.35 },
  },
  {
    id: 'newyork', name: 'New York Island',
    group: 'ny',
    anchor: 'ny', target: [0, 1.8, 0], azimuth: -12, elevation: 24, distance: 90, zoom: 1.25,
    atmosphere: 'dusk',
  },
  {
    id: 'taiwan', name: 'Taiwan Island',
    group: 'tw',
    anchor: 'tw', target: [0, 1.2, 0], azimuth: 14, elevation: 27, distance: 90, zoom: 1.35,
    atmosphere: 'between',
  },
  {
    id: 'window', name: 'Window Close-Up',
    group: 'tw', follow: true,
    anchor: 'twWindow', frame: 'local', target: [0, -0.02, 0.1], azimuth: 10, elevation: 6, distance: 6, zoom: 15,
    durationScale: 1.6, atmosphere: 'late', effects: { windowLight: 1 },
  },
  {
    id: 'crossroads', name: 'Crossroads',
    hidden: true, follow: true,
    anchor: 'crossroads', frame: 'local', target: [0, 0.4, 0], azimuth: 45, elevation: 40, distance: 40, zoom: 2.3,
  },
  {
    id: 'suitcase', name: 'Suitcase Island',
    group: 'small',
    anchor: 'suitcase', target: [0, 0.6, 0], azimuth: -24, elevation: 14, distance: 30, zoom: 4.2,
    atmosphere: 'between',
  },
  {
    id: 'lighthouse', name: 'Lighthouse',
    group: 'small',
    anchor: 'lighthouse', target: [0, 2.6, 0], azimuth: 18, elevation: 10, distance: 50, zoom: 2.1,
    atmosphere: 'late',
  },
  {
    id: 'between', name: 'Between Islands',
    hidden: true,
    anchor: 'world', target: [0, 0, -1], azimuth: 0, elevation: 6, distance: 140, zoom: 0.68,
    effects: { timezone: 0.5 },
  },
  {
    id: 'timezones', name: 'Different Timezones',
    hidden: true,
    anchor: 'world', target: [0, 0.5, -1], azimuth: 0, elevation: 20, distance: 140, zoom: 0.66,
    atmosphere: 'twilight', effects: { timezone: 1 },
  },
  {
    id: 'airplane', name: 'Airplane Window',
    group: 'cabin', follow: true, scene: true,
    anchor: 'drift', target: [0, 0, 0], azimuth: 8, elevation: 72, distance: 120, zoom: 1.0,
    durationScale: 1.4, overlay: 'airplane', effects: { timezone: 0.45 },
  },
  {
    id: 'nywindow', name: 'New York Window',
    group: 'ny', follow: true,
    anchor: 'nyWindow', frame: 'local', target: [0, -0.02, 0.1], azimuth: -12, elevation: 5, distance: 6, zoom: 14,
    durationScale: 1.6, atmosphere: 'dusk', effects: { windowLight: 1 },
  },
  {
    id: 'henge', name: 'Manhattanhenge',
    group: 'ny', follow: true,
    anchor: 'henge', frame: 'local', target: [0, 1.6, 0], azimuth: 90, elevation: 2, distance: 2.4, zoom: 4.4,
    durationScale: 1.4, atmosphere: 'henge', effects: { timezone: 1, twHour: 7 },
    sun: { at: [0.5, 0.36], r: 0.06 },
  },
  {
    id: 'bridge', name: 'Bridge Window',
    group: 'ny', follow: true,
    anchor: 'bridgeWindow', frame: 'local', target: [0, -0.2, -2.2], azimuth: 62, elevation: 10, distance: 14, zoom: 2.6,
    durationScale: 1.4, atmosphere: 'twilight', effects: { windowLight: 1 },
  },
  {
    id: 'ladder', name: 'Ladder to a Window',
    group: 'sky',
    anchor: 'ladder', target: [0, 4.6, 0], azimuth: -10, elevation: 8, distance: 40, zoom: 1.75,
    durationScale: 1.4, atmosphere: 'twilight', effects: { windowLight: 1 },
  },
  {
    id: 'luggage', name: 'Baggage Belt',
    group: 'sky',
    anchor: 'luggage', target: [0, 2.6, 0], azimuth: 25, elevation: 20, distance: 40, zoom: 1.8,
    atmosphere: 'between',
  },
  {
    id: 'plane', name: 'Airliner',
    group: 'sky', follow: true,
    anchor: 'airplane', target: [0, 0, 0], azimuth: 30, elevation: 62, distance: 30, zoom: 3.2,
    atmosphere: 'harbor',
  },
  {
    id: 'portals', name: 'Portals',
    group: 'sky',
    anchor: 'world', target: [0, 18.5, -4], azimuth: 12, elevation: 12, distance: 80, zoom: 1.35,
    atmosphere: 'late',
  },
  {
    id: 'lamp', name: 'Street Light',
    group: 'small',
    anchor: 'lamp', target: [0, 1.0, 0], azimuth: 15, elevation: 10, distance: 30, zoom: 4.2,
    atmosphere: 'late',
  },
  {
    id: 'subway', name: 'Subway Island',
    group: 'small',
    anchor: 'subway', target: [0, 0.6, 0], azimuth: 20, elevation: 28, distance: 40, zoom: 3.0,
    atmosphere: 'late', effects: { windowLight: 1 },
  },
  {
    id: 'busstop', name: 'Bus Stop Island',
    group: 'small',
    anchor: 'busStop', target: [0, 0.8, 0], azimuth: -5, elevation: 16, distance: 40, zoom: 3.0,
    atmosphere: 'dawn',
  },
  {
    id: 'grove', name: 'Grove Island',
    group: 'small',
    anchor: 'grove', target: [0, 0.6, 0], azimuth: 10, elevation: 22, distance: 40, zoom: 3.2,
    atmosphere: 'lawn',
  },
  {
    id: 'flyers', name: 'Flying Houses',
    hidden: true,
    anchor: 'world', target: [0, 4, -1], azimuth: -25, elevation: -8, distance: 140, zoom: 0.62,
    atmosphere: 'between', effects: { timezone: 0.4 },
  },
  {
    id: 'ladderOrbit', name: 'Ladder & Window (orbit)',
    group: 'sky', follow: true,
    anchor: 'ladderOrbit', frame: 'local', target: [0, 4.4, 0], azimuth: 175, elevation: 10, distance: 100, zoom: 2.0,   // circles the ladder once per loop
    durationScale: 1.4, effects: { windowLight: 1 },
  },
  {
    id: 'apple', name: 'Big Apple',
    group: 'ny', follow: true,
    anchor: 'appleOrbit', frame: 'local', target: [0, 0, 0], azimuth: 20, elevation: 12, distance: 40, zoom: 2.0,   // orbits the apple once per loop
  },
  {
    id: 'windmill', name: 'Windmill Island',
    group: 'small',
    anchor: 'windmill', target: [0, 3.6, 0], azimuth: -10, elevation: 10, distance: 40, zoom: 2.4,
  },
  {
    id: 'departures', name: 'Departures Board',
    group: 'sky', follow: true,
    anchor: 'departures', target: [0, 0.3, 0], azimuth: 0, elevation: 4, distance: 40, zoom: 2.8,
  },
  {
    id: 'clock', name: 'Big Clock',
    group: 'sky',
    anchor: 'clock', target: [0, 0.3, 0], azimuth: -20, elevation: 5, distance: 40, zoom: 2.5,
  },
  {
    id: 'dining', name: 'Dining Room (round table)',
    group: 'tw', scene: true,
    anchor: 'dining', frame: 'local', target: [0, -0.85, 0], azimuth: 6, elevation: 10, distance: 4.4, zoom: 5.9,
  },
  {
    id: 'lookout', name: 'Lookout (room in Taiwan)',
    group: 'tw', scene: true,
    anchor: 'lookout', frame: 'local', target: [0, -0.45, 0], azimuth: 12, elevation: 7, distance: 4.2, zoom: 5.8,
  },
  {
    id: 'bathroom', name: 'Bathroom (floating house)',
    group: 'sky', scene: true,
    anchor: 'bathroom', frame: 'local', target: [0, -0.55, 0], azimuth: -10, elevation: 8, distance: 3.4, zoom: 7.6,
  },
  {
    id: 'twobirds', name: 'Two Birds',
    group: 'sky', follow: true,
    // far back: the birds fly past everything, and a close camera sliced it all open
    anchor: 'birdPair', frame: 'local', target: [0, -0.4, 1.5], azimuth: 180, elevation: 24, distance: 100, zoom: 2.4,
    durationScale: 1.4,
  },
  {
    id: 'roadtrip', name: 'Road Trip (bus round Taiwan)',
    group: 'tw', follow: true,
    anchor: 'roadBus', frame: 'local', target: [0, 0.3, 0.6], azimuth: 205, elevation: 26, distance: 40, zoom: 4.6,
  },
];

export const presetById = (id) => CAMERA_PRESETS.find(p => p.id === id) || CAMERA_PRESETS[0];

// Controller sections, in order, with the order of buttons inside each.
export const GROUPS = [
  { id: 'all', name: 'Overview', ids: ['overview'] },
  { id: 'ny', name: 'New York', ids: ['newyork', 'henge', 'nywindow', 'bridge', 'apple'] },
  { id: 'tw', name: 'Taiwan', ids: ['taiwan', 'window', 'roadtrip', 'lookout', 'dining'] },
  { id: 'small', name: 'Small islands', ids: ['busstop', 'grove', 'subway', 'lamp', 'suitcase', 'lighthouse', 'windmill'] },
  { id: 'sky', name: 'Floating objects', ids: ['ladder', 'ladderOrbit', 'luggage', 'portals', 'departures', 'clock', 'plane', 'bathroom', 'twobirds'] },
  { id: 'cabin', name: 'Cabin', ids: ['airplane'] },
];

// A saved view: a camera of its own, made from where the camera actually was
// when Save view was pressed. Shape:
//   { anchor, frame, target, azimuth, elevation, distance, zoom,
//     follow, scene, overlay, sun, durationScale, label }
// It goes through the same rig as a preset, so the Zoom / Camera angle /
// Orbit sliders keep working on top of it.
export function isView(v) {
  return !!v && typeof v === 'object' && Array.isArray(v.target) && typeof v.azimuth === 'number';
}
