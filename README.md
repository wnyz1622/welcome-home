# If this is home, welcome home.

*whnvr, for* Liminal Landing

A floating archipelago of temporary homes. **New York** is long and narrow
like Manhattan: two avenues and four cross streets, red-brick walk-ups with
fire escapes, a midtown of skyscrapers whose windows light up at night,
Times Square-style screens (abstract gradients, low, mid and high), yellow
cabs that drive, stop and drive again, and a suspension bridge off the
northern tip that ends in a lit window standing in the air. **Taiwan** is a
long green leaf of land with a mountain range down the middle, tiled
walk-ups, iron window cages and potted plants, rolling shutters, 鐵皮屋頂 tin
rooftop additions, color-block 招牌 shop signs, and 電線桿 utility poles in
the lanes between houses with wires strung every which way.
Three mid-size islands sit between: a subway entrance with green globe
lamps, a bus stop, and a small grove. A baggage belt loops underneath and
around everything, carrying suitcases past a hill of luggage, and a tall
ladder stands in the air with a window floating at its top. Around them are smaller islands: a
suitcase, a lighthouse that keeps searching, a window standing on its own,
a tiny house, stairs to nowhere, and a lone gable wall. Paper-cut houses
drift through the sky in zero gravity. Pigeons and sparrows (two flat
wings each) commute between the two main islands, and a flat white airliner
with a dark-blue shadow passes overhead. Each island can live
in its own time of day.

Built with Three.js (vendored in `lib/`, so it runs offline), an orthographic
camera, and procedural geometry only. There is no backend.

## Run it

**Start the server from inside this folder** (the one with `viewer.html`):

```bash
cd path/to/temporary-island      # tip: type "cd ", then drag the folder into Terminal
python3 serve.py
```

Then open http://localhost:8080/control.html and press *Open viewer* (top
right). Drag the viewer window onto the projector and press **f** in it for
fullscreen. The controller fits on one screen (a 14" laptop window or
larger); the song list and the camera buttons scroll inside their own boxes.

`serve.py` works like `python3 -m http.server`, and it also lets *Save
view* write into `views.json` in this folder. It uses only the Python built
into macOS, needs no internet, and is reachable only from this computer. It
also turns off browser caching, so a normal reload always shows the newest
files. To use another port, run `python3 serve.py 8081`.

If you start it with `python3 -m http.server` instead, everything plays
normally, but *Save view* can't write. The controller shows this in red.

The controller and viewer sync through `BroadcastChannel`, so they need to
be in the same browser on the same computer. If the page shows a 404, the
server was started from the wrong folder.

## Performing

**Song scenes.** Click a song, then *Activate selected*. You can also
double-click a song, or use **←/→** to move to the previous or next scene
(**↑/↓** then **Enter** picks one). The camera, atmosphere, floating level and
birds all move together over the *transition duration*. The camera moves
at one steady speed the whole way, with no speeding up or slowing down.

**Saving a song's scene.** *Save view* stores, for the selected song: the
camera, plus everything in Motion and Atmosphere (Floating / Displacement,
bird speed, Island breathing, Ripple, Time, sky, rain, snow, Contrast). Activating
the song brings it all back, each easing in at its usual pace. Not saved
per song: the house layout (*Rearrange houses*) and the stroke style, which
stay as set for the whole night. A song that hasn't saved something keeps
the value from `js/songs.js` (each song sets its own floating level), or
else the value from the song before.

**Saving a view (and time) for a song.** Frame a shot in the viewer: drag to
orbit, right-drag (or Shift-drag) to pan, scroll to zoom, double-click to
reset. Set the *Time* slider and pick the sky (an atmosphere button). Select the song in the list and press *Save view → (song)*. That song now opens on exactly this view, at
this hour, under this sky, and a red ● marks it in the song list.

Saved views go straight into **`views.json`** in the project folder, so zipping
the folder carries them to the other computer. A saved view overrides the
song's default camera in `js/songs.js`. *Clear* removes it and puts the song
back to that default. `views.json.bak` keeps the version from before the
last save, in case you need to undo one.

**Passing the project back and forth:** take turns. Each zip replaces the
whole folder, views included, and nothing merges two people's changes. So
always continue from the newest zip you've received, and don't edit your
old copy at the same time.

**Camera buttons** are grouped by place: 全景, 紐約, 台灣, 中小型島, 飄浮物件,
機艙. Press one to fly there, then frame the shot with the mouse or the
*Zoom*, *Camera angle* and *Orbit* sliders. To open the viewer straight on
one, add `?preset=<id>` (e.g. `viewer.html?preset=subway`).

**How a saved view is stored.** Every song remembers its own camera: where
it is, where it looks and how zoomed. It doesn't depend on any button. Each
view is named automatically after what it looks at (e.g. "Bus Stop",
"Taiwan · close-up"); the name shows in the song list.
- **Fixed views.** Most views are a fixed spot in the world.
- **Following views.** Buttons marked **↻** follow something that moves:
  New York Window, Bridge Window, Manhattanhenge and Big Apple (New York);
  Window Close-Up and Road Trip (Taiwan); Departures Board, Airliner and Two
  Birds (sky); and the Airplane Window. A view saved while on one of these
  keeps following it, so the window or bus stays in frame as things move.
  To make a fixed view near a moving thing, start from a button without ↻
  and frame it with the mouse.
- **Special scenes.** The airplane cabin windows and the interiors (Lookout,
  Dining Room, Bathroom) are remembered by the view itself.

**Floating / Displacement**
- 0–1: gentle floating, as before.
- 1–2: windows, roofs and fixtures begin to separate.
- 2–3.6: houses and streets disassemble.
- 3.6–5: everything, including the island layers, drifts apart into space.

Bringing the slider back down returns every object exactly to its place.
Each object has a stored home position and a fixed, seeded drift, so
nothing accumulates error or gets lost. Five buttons set it: still (no motion),
float, separate, disassemble and scatter. It moves at a steady pace with a
soft start and stop, about 2 s per step, so going from float to scatter
takes about 8 s and you see the world come apart. There are always 12 houses per island;
*Rearrange houses* shuffles where they stand. On Taiwan every arrangement
keeps the houses (with their poles and lamps) off the ring road the bus
drives on and off the mountain slopes.

**Birds.** 20 birds; only their speed is adjustable.

**Ripple** (switch). The picture wavers as if seen through water. It fades in
and out over about 3 s.

**Island breathing** (switch). The islands swell and settle every 15 s, and
a wave rolls across each one: houses and towers lift, stretch and lean a
little with it, and the mountains swell. Switching it on or off eases in or
out over a few seconds. The islands always turn one full turn per 2-minute
loop.

**Time.** The *Time* slider is Taiwan's clock (00:00–23:00); New York is
always 12 hours apart. When the island with daylight changes, the sun and
moon trade places slowly (about 4 s), one passing above the other.
Each island gets its own light from its hour: day,
golden hour or night, with a sun or a moon above it. Windows follow the
hour too. By day most are dark and a few are lit; at golden hour they come
on; at night most are lit. The windows the close-up cameras look into
always stay lit. Night darkness is fixed at 85%. The sky comes from the
atmosphere buttons; *midnight* is a deep black sky.

**Weather.** Two switches: rain on Taiwan (60%) and snow on New York (100%).
They build up and die away over about 4 s.

**Halftone** breathes on its own, between 30% and 70% three times per loop,
and a patch of dots wanders across the upper half of the picture.

**Song 1 / Airplane Window** looks out through a row of three cabin windows,
shades up, with clouds drifting past.

**Look** (in Atmosphere). Choose between Stroke, Reduced stroke and No
stroke. In No stroke, shading contrast rises slightly so forms stay
readable. **Contrast** raises or lowers contrast and color saturation
together (for the projection through the scrim); it is saved per song.

## Recording at 1920 × 1080

1. Open `viewer.html?w=1920&h=1080` and press **f** for fullscreen.
2. Keep bird speed on a whole number (the slider snaps toward them).
3. Start recording at any moment and record **2:00**: any two minutes loop
   seamlessly, so there is no need to start at 0:00.
   Clouds drift at a fixed 1.5×, so they line up every 4:00 instead of 2:00.
   Over 2:00 that's barely noticeable, but if a perfect loop matters,
   record **4:00**.

Camera moves and song scenes run on their own clock, separate from the
2-minute loop. They never reset the animation, so you can cut between views
mid-recording.

## Editing

- **Song scenes:** `js/songs.js` has one entry per song: camera, atmosphere,
  zoom, angle, orbit, float, birds, and other effects.
- **Camera presets:** `js/presets.js` gives each preset an anchor, angles,
  distance, zoom, transition scale, atmosphere and effects. Anchors are
  objects in the world, so presets follow islands as they float and turn.
- **Atmospheres and local times:** `ATMOSPHERES` and `TIMES` in `js/config.js`.
- **Memories behind windows:** add images to `MEMORY_IMAGES` in
  `js/memories.js`. Each window shader also accepts `fixedMem`, `light`,
  `curtain` and `depth` (see `windowMaterial` in `js/materials.js`), which is
  where per-window interiors and lighting can grow later.

## Files

```
viewer.html, control.html, css/
js/config.js        defaults, palette, atmospheres, local times, world layout
js/presets.js       camera presets
js/songs.js         the 34 song scenes (default camera, time, sky per song)
views.json          camera views saved from the controller (overrides songs.js)
serve.py            local server: serves the folder + writes views.json
js/viewer.js        renderer, post-processing (sky, timezones, halftone, grain,
                    airplane window), state easing, sync
js/control.js       controller UI
js/camera.js        camera rig + transitions
js/world.js         archipelago layout, satellites, airplane, displacement system
js/architecture.js  buildings, crossroads, lighthouse, suitcase, objects
js/materials.js     toon shader, stroke modes, window-room shader, light beam
js/memories.js      procedural window memories + hook for real images
js/clouds.js        atmospheric clouds
js/weather.js       rain over Taiwan, snow over New York
js/freecam.js       mouse camera in the viewer (drag / right-drag / scroll)
js/birds.js         pigeons + sparrows
lib/three.module.js Three.js r170
```

## Partial or simplified in this version

- **Birds** follow smooth looping routes: they circle one island, slow
  almost to a hover, cross over, circle the other island, and return. This
  is choreographed rather than simulated flocking.
- **Window interiors** are a convincing fake room (walls, floor, ceiling
  lamp, curtain, and a memory on the back wall). They are not real 3D
  interiors. Two windows are set up as hero windows for the close-ups.
- **Airplane Window** is a 2D cabin-window overlay in the post pass over the
  real 3D world. The visible airliner hides while you're "inside" it.
- **Street-level crossroads** is a low orthographic angle, not a true
  eye-level perspective. That keeps the 2.5D look but means no vanishing
  point.
#   l i m i n a l - l a n d i n g - i s l a n d s  
 #   w e l c o m e - h o m e  
 #   w e l c o m e - h o m e  
 