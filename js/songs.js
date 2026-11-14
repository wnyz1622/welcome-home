// Song scenes for the DJ set. Edit freely — this is the only place they live.
//
//   title, artist  shown in the controller
//   view           the song's own camera (saved from the controller; see
//                  presets.js). Fixed spot in the world, or follow: true to
//                  keep following a moving thing. Overrides camera.
//   camera         a CAMERA_PRESETS id, for songs without a saved view
//   atmosphere     optional ATMOSPHERES id (config.js); otherwise the preset's
//   zoom           optional orthographic zoom; otherwise the preset's
//   angle          optional camera elevation in degrees; otherwise the preset's
//   orbit          optional extra azimuth in degrees (e.g. -45 on the crossroads
//                  looks straight down a street at street level)
//   pan            optional [x, y, z] shift of the look-at point
//   time           optional Taiwan hour 0-23 (New York is +12 h)
//   sky            optional ['#top', '#middle', '#bottom'] sky colors (overrides atmosphere)
//   float          floating / displacement intensity (0–1 floats, 1–5 comes apart)
//   birds          optional { count, speed }
//   effects        optional state overrides, e.g. { timezone, windowLight,
//                  halftone, clouds, cloudDensity, stroke }
//   note           why this view — for us, not shown on screen

export const SONG_SCENES = [
  {
    title: '完美落地', artist: 'Luantan Ascent, Fran',
    camera: 'airplane', atmosphere: 'harbor', float: 0.8,
    note: 'a perfect landing — we begin in the air, looking down',
  },
  {
    title: '鹿港小鎮', artist: '羅大佑',
    view: { name: 'Taiwan', anchor: 'world', frame: 'world', target: [17, 1.18, -2], azimuth: 27.6, elevation: 25.1, distance: 90, zoom: 2.162, follow: false }, time: 11, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 0.9,
    effects: { timezone: 0.4 },
    note: 'the small town left behind',
  },
  {
    title: '回家', artist: 'Shunza',
    view: { name: 'Bus Stop', anchor: 'world', frame: 'world', target: [3.5, 2.89, 13.5], azimuth: -5, elevation: 16, distance: 40, zoom: 3.258, follow: false }, time: 10, sky: ['#1d56d6', '#b69ae4', '#ff4b3a'],  // saved view
    float: 1,
    birds: { count: 14, speed: 1 },
    note: 'going home: the bus pulls in at the stop (Taiwan 10:00)',
  },
  {
    title: '想厝的人', artist: '詹雅雯',
    view: { name: 'Taiwan', anchor: 'twWindow', frame: 'local', target: [-0.24, 1.48, -6.12], azimuth: -86.1, elevation: -1.2, distance: 6, zoom: 3.695, follow: true, label: 'Window Close-Up', durationScale: 1.6, effects: {windowLight: 1} }, time: 11, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 0.6,
    effects: { windowLight: 1 },
    note: 'someone missing home — looking in',
  },
  {
    title: '想家', artist: '卓文萱',
    view: { name: 'Tiny House · close-up', anchor: 'twWindow', frame: 'local', target: [-3.26, 1.11, 29.83], azimuth: -30.8, elevation: -1.4, distance: 6, zoom: 5.055, follow: true, label: 'Window Close-Up', durationScale: 1.6, effects: {windowLight: 1} }, time: 19, sky: ['#3a3f9e', '#ff8a5a', '#ffcf6b'],  // saved view
    float: 1,
    effects: { timezone: 1 },
    note: 'homesick: same sky, different hours',
  },
  {
    title: '浪流連', artist: 'EggPlantEgg',
    view: { name: 'Open sky', anchor: 'twWindow', frame: 'local', target: [48.11, -8.09, 22.89], azimuth: 113.4, elevation: 5.8, distance: 6, zoom: 3.807, follow: true, label: 'Window Close-Up', durationScale: 1.6, effects: {windowLight: 1} }, time: 5, sky: ['#7fb3ea', '#f7d7c4', '#f3d98a'],  // saved view
    float: 2.8,
    birds: { count: 12, speed: 2 },
    note: 'wandering — the world starts to loosen',
  },
  {
    title: '大人中', artist: 'Crowd Lu',
    view: { name: 'New York', anchor: 'world', frame: 'world', target: [-20.46, -15.99, -16.05], azimuth: -74.2, elevation: 32.5, distance: 90, zoom: 2.897, follow: false }, time: 23, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 1,
    note: 'becoming an adult: decisions at the crossroads',
  },
  {
    title: '紐約鄰居', artist: 'Gordon',
    view: { name: 'New York · close-up', anchor: 'world', frame: 'world', target: [-19.49, -1.8, -11.37], azimuth: -2.7, elevation: 6.9, distance: 90, zoom: 11.533, follow: false }, time: 23, sky: ['#1858cf', '#2f8ec2', '#86cf9e'],  // saved view
    float: 1,
    note: 'New York neighbors',
  },
  {
    title: '家', artist: 'Cheer Chen',
    view: { name: 'Taiwan', anchor: 'world', frame: 'world', target: [19.55, -8.36, 4.01], azimuth: -154.5, elevation: 58.8, distance: 90, zoom: 1.614, follow: false }, time: 23, sky: ['#0d2c80', '#2a5fbf', '#e2675c'],  // saved view
    float: 0.5,
    effects: { windowLight: 0.85, timezone: 0.2 },
    note: 'home, in daylight this time',
  },
  {
    title: '在這座城市遺失了你', artist: '告五人',
    view: { name: 'New York', anchor: 'world', frame: 'world', target: [-9.67, -10.27, -0.89], azimuth: -97.7, elevation: 57.7, distance: 90, zoom: 1.482, follow: false }, time: 19, sky: ['#7fb3ea', '#f7d7c4', '#f3d98a'],  // saved view
    float: 2.4,
    effects: { windowLight: 1 },
    note: 'lost you in this city — the crossroads at night, coming apart',
  },
  {
    title: '超大行李', artist: 'G.U.T.S',
    view: { name: 'Baggage Belt', anchor: 'world', frame: 'world', target: [1.64, -7.18, -18.99], azimuth: -1.5, elevation: -2.1, distance: 90, zoom: 2.981, follow: false }, time: 0, sky: ['#3a3f9e', '#ff8a5a', '#ffcf6b'],  // saved view
    float: 1.2,
    note: 'oversized luggage',
  },
  {
    title: '不想去遠方', artist: 'Crowd Lu',
    camera: 'lookout', time: 18, viewVersion: 2,
    float: 0.4,
    note: "don't want to go far: from a room, out to the mountains and the neighbors (Taiwan 18:00)",
  },
  {
    title: '浴室', artist: 'deca joins',
    camera: 'bathroom', time: 11, sky: ['#7fb3ea', '#f7d7c4', '#f3d98a'], viewVersion: 2,
    float: 0.7,
    effects: { windowLight: 1, halftone: 0.6 },
    note: 'a small lit room in a big city',
  },
  {
    title: '在凌晨', artist: 'Zhang Zhen Yue',
    view: { name: 'Taiwan · close-up', anchor: 'world', frame: 'world', target: [-7.27, 1.76, -9.45], azimuth: -98, elevation: -0.2, distance: 90, zoom: 6.99, follow: false }, time: 13, sky: ['#0d2c80', '#2a5fbf', '#e2675c'],  // saved view
    float: 1.1,
    effects: { windowLight: 0.9, clouds: 0.9 },
    note: 'early hours: the light keeps searching',
  },
  {
    title: '我想和你一起', artist: 'Wendy Wander',
    camera: 'twobirds', time: 8, sky: ['#0b74cf', '#f2a7b8', '#f3d66a'], viewVersion: 2,
    float: 1.8,                // a little displacement
    birds: { count: 16, speed: 1 },
    note: 'I want to be with you — the birds keep crossing',
  },
  {
    title: '晚安台灣', artist: 'Fire EX.',
    camera: 'roadtrip', time: 0, sky: ['#0d2c80', '#2a5fbf', '#e2675c'], viewVersion: 2,
    float: 0.8,
    effects: { windowLight: 1, timezone: 0.3 },
    note: 'good night, Taiwan',
  },
  {
    title: '我在紐約打電話給你', artist: 'Waa Wei',
    view: { name: 'New York · close-up', anchor: 'world', frame: 'world', target: [1.64, -7.18, -18.99], azimuth: -47, elevation: 16.3, distance: 90, zoom: 12.45, follow: false }, time: 0, sky: ['#3a3f9e', '#ff8a5a', '#ffcf6b'],  // saved view
    float: 1,
    effects: { timezone: 1 },
    note: 'calling from New York: one call, two times of day',
  },
  {
    title: '親愛的', artist: 'Deserts Chang',
    view: { name: 'Lighthouse', anchor: 'world', frame: 'world', target: [1.6, 3.45, -20.51], azimuth: -166.8, elevation: 0.6, distance: 90, zoom: 2.265, follow: false }, time: 7, sky: ['#0d2c80', '#2a5fbf', '#e2675c'],  // saved view
    float: 4.6,
    birds: { count: 16, speed: 1 },
    note: 'dear — the world drifts apart, never fully settling',
  },
  {
    title: '旅行的意義', artist: 'Cheer Chen',
    camera: 'plane', float: 1, time: 10,
    note: 'the meaning of travel: following the plane',
  },
  {
    title: '魚', artist: 'Cheer Chen',
    view: { name: 'Windmill', anchor: 'world', frame: 'world', target: [24.5, 4.51, -19.79], azimuth: -143.8, elevation: 0.9, distance: 140, zoom: 3.317, follow: false }, time: 15, sky: ['#0b74cf', '#f2a7b8', '#f3d66a'],  // saved view
    float: 1.2, viewVersion: 2,
    note: 'neon fish spiraling round the wind turbine',
  },
  {
    title: '忽然之間', artist: 'Karen Mok',
    view: { name: 'Big Clock', anchor: 'world', frame: 'world', target: [25.25, 17.29, -10.35], azimuth: -2.2, elevation: -20, distance: 140, zoom: 2.374, follow: false }, time: 10, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 2.6, viewVersion: 2,
    note: 'suddenly: a big clock floating as the world comes apart',
  },
  {
    title: '抱著你', artist: 'Zhang Zhen Yue',
    view: { name: 'Taiwan · close-up', anchor: 'twWindow', frame: 'local', target: [-0.99, -0.22, 2.27], azimuth: -19.1, elevation: -6.9, distance: 6, zoom: 7.775, follow: true, label: 'Window Close-Up', durationScale: 1.6, effects: {windowLight: 1} }, time: 22, sky: ['#0d2c80', '#2a5fbf', '#e2675c'],  // saved view
    float: 0.6,
    effects: { windowLight: 1 },
    note: 'holding you: a lit room at night',
  },
  {
    title: '我給的愛', artist: 'Naiwen Yang',
    view: { name: 'Taiwan · close-up', anchor: 'world', frame: 'world', target: [10.97, 4.61, 16.68], azimuth: -174.4, elevation: -4.9, distance: 40, zoom: 5.505, follow: false, durationScale: 1.4, effects: {windowLight: 1} }, time: 11, sky: ['#0b74cf', '#f2a7b8', '#f3d66a'],  // saved view
    float: 0.8,
    effects: { windowLight: 1 },
    note: 'the love I gave: fireflies round the window at the top of the ladder',
  },
  {
    title: '牽掛', artist: 'Wu Bai',
    view: { name: 'Crossroads · close-up', anchor: 'bridgeWindow', frame: 'local', target: [1.98, 4.11, -2.56], azimuth: -109, elevation: 0.6, distance: 14, zoom: 5.046, follow: true, label: 'Bridge Window', durationScale: 1.4, effects: {windowLight: 1} }, time: 19, sky: ['#24357f', '#c48bb8', '#f6b26b'],  // saved view
    float: 0.8,
    note: 'worrying for someone: the bridge between two places',
  },
  {
    title: '一桌菜', artist: 'Cosmos People',
    view: { name: 'New York · close-up', anchor: 'bridgeWindow', frame: 'local', target: [-27.63, -1.88, 19.27], azimuth: -35.7, elevation: 13.4, distance: 14, zoom: 8.815, follow: true, label: 'Bridge Window', durationScale: 1.4, effects: {windowLight: 1} }, time: 19, sky: ['#24357f', '#c48bb8', '#f6b26b'],  // saved view
    float: 0.8,
    note: 'a table of food: a round red table, the window on the island',
  },
  {
    title: '無眠', artist: 'sodagreen',
    view: { name: 'New York · close-up', anchor: 'nyWindow', frame: 'local', target: [0, -0.02, 0.1], azimuth: -12, elevation: 5, distance: 6, zoom: 6.673, follow: true, label: 'New York Window', durationScale: 1.6, effects: {windowLight: 1} }, time: 14, sky: ['#1d56d6', '#b69ae4', '#ff4b3a'],  // saved view
    float: 0.7,
    effects: { windowLight: 1 },
    note: 'sleepless: 2 a.m. in New York',
  },
  {
    title: '台北某個地方', artist: 'Cheer Chen',
    view: { name: 'Grove · close-up', anchor: 'world', frame: 'world', target: [4.36, -5.5, -8.86], azimuth: -130.8, elevation: 9.7, distance: 90, zoom: 5.715, follow: false }, time: 17, sky: ['#7fb3ea', '#f7d7c4', '#f3d98a'],  // saved view
    float: 0.8, viewVersion: 2,
    note: 'somewhere in Taipei: laundry drying in the wind',
  },
  {
    title: '愛我別走', artist: 'Zhang Zhen Yue',
    view: { name: 'Baggage Belt', anchor: 'world', frame: 'world', target: [8.4, -10.63, -6.36], azimuth: -60.5, elevation: 7.9, distance: 90, zoom: 4.017, follow: false }, time: 17, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 1,
    note: "don't leave: the luggage keeps going round",
  },
  {
    title: 'San Francisco Street', artist: 'Sun Rai',
    view: { name: 'New York', anchor: 'crossroads', frame: 'local', target: [0.87, 0.8, -1.94], azimuth: 54.4, elevation: 85, distance: 40, zoom: 4.312, follow: true, label: 'Crossroads' }, time: 23, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 1,
    note: 'a street at night (New York 21:00)',
  },
  {
    title: 'Love Lee', artist: 'AKMU',
    view: { name: 'New York', anchor: 'crossroads', frame: 'local', target: [0.87, 0.8, -1.94], azimuth: 98.8, elevation: 21.2, distance: 40, zoom: 2.471, follow: true, label: 'Crossroads' }, time: 23, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 1,
    birds: { count: 16, speed: 2 },
    note: 'light and playful: the camera orbits the Big Apple',
  },
  {
    title: 'Lucky', artist: 'Jason Mraz, Colbie Caillat',
    view: { name: 'Departures Board', anchor: 'world', frame: 'world', target: [-0.51, 14.16, 14.53], azimuth: -3.4, elevation: -12.8, distance: 40, zoom: 1.904, follow: false }, time: 11, sky: ['#7fb3ea', '#f7d7c4', '#f3d98a'],  // saved view
    float: 0.8,
    note: 'an easy afternoon at the bus stop',
  },
  {
    title: 'Soft Spot', artist: 'keshi',
    camera: 'grove', float: 0.8, time: 18,
    note: 'soft dusk in the grove',
  },
  {
    title: '未接來電', artist: 'Naiwen Yang',
    view: { name: 'New York', anchor: 'world', frame: 'world', target: [0.45, 4.026, -1.51], azimuth: 88.5, elevation: 0.9, distance: 40, zoom: 1.856, follow: false }, time: 18, sky: ['#24357f', '#c48bb8', '#f6b26b'],  // saved view
    float: 1,
    note: 'a missed call across the time difference: phones adrift between the islands',
  },
  {
    title: '勇氣', artist: 'Zhang Zhen Yue',
    view: { name: 'Standing Window', anchor: 'world', frame: 'world', target: [1.86, 3.416, -2.32], azimuth: -144.1, elevation: -15.4, distance: 40, zoom: 1.078, follow: false }, time: 11, sky: ['#5aa6e6', '#efe6d4', '#79c25a'],  // saved view
    float: 0.8,
    note: 'courage: the sun lined up down the street',
  },
];
