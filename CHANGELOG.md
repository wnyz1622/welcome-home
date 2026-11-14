# Changelog

*A Temporary Island*, whnvr for Liminal Landing. The rounds of edits are
listed in the order they were requested, newest at the bottom.

---

## Round 0: free camera (temporary)

- **Mouse camera in the viewer, with no on-screen UI.** Drag to orbit,
  right-drag or Shift-drag to pan, scroll to zoom, double-click to reset.
  It works on top of presets and songs (`js/freecam.js`).

## Round 1: islands, stands, flying houses

- **Digital distortion removed.** That covers the glitch bursts in the
  windows and on screen, the *Digital distortion* slider, and the
  distortion effect on 在這座城市遺失了你.
- **Stands.** New York and Taiwan no longer have the cone under them. The
  small islands keep a shorter, blunt one.
- **Taiwan:**
  - a low-poly mountain range down the middle, with houses arranged around it
  - green ground
  - 招牌: color-block shop signs, vertical and over the shutters, with no text
  - 鐵皮屋頂: corrugated tin rooftop additions and rain covers
  - scooters, later removed in round 2
  - 電線桿 utility poles with wires, later moved into town in round 2
- **New York:**
  - red brick on most buildings
  - more buildings
  - Times Square-style billboards with abstract moving gradients and no
    text, at three heights: low over the shopfronts, mid on the walls, and
    high on the roofs
- **Flying houses.** 26 paper-cut houses in the reference palette, in
  different shapes and sizes. They float in zero gravity, tilt but never
  flip, and loop seamlessly.
- **Mid-size islands:** a subway entrance with green globe lamps, a bus
  stop, and a small grove.
- **New camera presets:** Subway Island, Bus Stop Island, Grove Island,
  Flying Houses.
- **URL option:** `viewer.html?preset=<id>` opens the viewer on a preset.

## Round 2: Manhattan, birds, Taiwan cleanup, sun + moon

- **New York becomes Manhattan.** It's a long, narrow island with two
  avenues and four cross streets, and one intersection with the signal and
  zebra crossings.
- **Skyscrapers.** Five generic towers in the middle (art deco, needle,
  two glass towers and an office slab). Their windows light up at night.
- **Taxis.** Twelve yellow cabs drive slowly, stop and drive again on loops
  around the avenues.
- **Water towers removed** from all buildings.
- **Suspension bridge** off the northern tip, ending in a large lit window
  standing in the air.
- **Manhattanhenge camera.** Street level down the avenue, with the sun
  setting between the buildings.
- **Bridge Window camera.** A side view of the bridge leading to the window.
- **Birds** are now just two flat wings in one color, flying above the
  buildings.
- **Taiwan:**
  - scooters removed
  - table, chairs and floor lamp removed
  - the grove island's lamp removed
  - poles now stand in the lanes beside the houses, with wires going in
    different directions. They move with the houses.
- **Sun and moon** over the islands, with stars.
- **Night slider.** The lights actually go down instead of just glowing.
- **Fix.** A timing bug on the first frame that had always been there.

## Round 3: time of day, ladder, baggage belt, airliner

- **Time slider (00:00–23:00).** This is Taiwan's clock, and New York is
  always 12 hours apart. Each island gets day, golden hour or night light
  from its own hour, with a sun or moon above it.
- **Night darkness** sets how dark night gets. At 100% the lights are almost
  off; only windows, screens, signs, skyscraper windows, subway globes and
  the lighthouse stay lit.
- **Split sky** goes from the blended sky to a hard split down the middle of
  the screen, one island's sky on each side, with a line between.
- **Removed:** the *Different timezones* slider and the sun/moon swap
  toggle, since the clock replaces them.
- **Clouds** stay and float everywhere.
- **Ladder.** A tall ladder standing upright in the air, with a lit window
  floating at its top. No island.
- **Baggage belt.** A long conveyor loop under and around both main
  islands, with suitcases riding it nonstop, past a new island with a hill
  of stacked luggage. No island stops spinning.
- **Airliner restyled** as a flat white plane with swept wings, a pale-blue
  stripe and a dark-blue offset shadow.
- **New camera presets:** Ladder to a Window, Baggage Belt, Airliner.

## Song 1 (完美落地)

- The airplane view is a cabin wall with three rounded windows, well apart,
  shades up, with clouds drifting past outside.
- The song starts in black and slowly fades in on the windows; leaving it,
  the windows fade out in 0.8 s.

## Saved views per song

- **Save camera view, time + sky.** In the controller, frame a shot in the
  viewer, set the time and sky, pick a song and press *Save view*. That
  song then opens on exactly that view, at that hour, under that sky. Saved
  songs show a red ● in the list.
- **Clear** removes a song's saved view.
- **Copy saved views as code** produces lines for `js/songs.js`.
- **Songs support new fields:** `pan`, `time` and `sky`.
- **Your 12 saved views written into `js/songs.js`,** so they work on any
  computer: 大人中, 紐約鄰居, 家, 在這座城市遺失了你, 超大行李, 不想去遠方,
  浴室, 在凌晨, 我想和你一起, 晚安台灣, 我在紐約打電話給你, 親愛的.

## Publishing and sharing

- **Pushed to GitHub:** https://github.com/wnyz/welcome-home
- **Live site:**
  - Controller: https://wnyz.github.io/welcome-home/control.html
  - Viewer at 1920 × 1080:
    https://wnyz.github.io/welcome-home/viewer.html?w=1920&h=1080
- **Share live.** The controller can now reach viewers on other computers
  (a friend's laptop, the projector machine, an OBS Browser Source) through
  a free public relay. Copy the link from the *Share live* panel. Everyone
  with it sees what you control, with a shared animation clock so every
  screen is at the same moment. The room code stays the same unless you
  press *New room code* or use another browser.

## Rounds 4–6: new songs, chain belt, portals

- **Songs 19–34** added to the playlist.
- **Baggage belt** is two rings linked like a chain, one round New York, one
  round Taiwan, passing through each other; 36 bags ride it.
- **Luggage island** in the middle, sitting a little below the belts.
- **Small street-light island** added.
- **Mountains** rebuilt so no faces are missing or clipping.
- **Skyscrapers** have rows of single windows; at night they stay calm
  (about 4 in 10 lit, a few change slowly once a loop, no flicker).
- **One sun and one moon** at all times.
- **Two portals** high in the sky facing each other, birds flying through
  them both ways (reworked in Round 7).
- **Spiral stairs** island; the ladder now leans; the airliner has a rounder
  body, wing fairings and engines.
- **All small and mid islands rotate** slowly (the lighthouse island stays put).

## Round 7: portals, weather, ambient motion, song scenes

- **Portals** are flat discs with a radial gradient (dark center, blue,
  lilac, pink, orange) whose color waves keep rippling outward. Both sides
  show the gradient.
- **Weather:** rain over Taiwan, snow over New York (small flakes). The
  Atmosphere panel has on/off switches and amount sliders for each.
- **Billboards** flow in five gradient styles: radial ripples, diagonal
  bands, a turning conic sweep, drifting color blobs and square ripples.
  Taiwan shop signs shimmer softly.
- **Camera clipping fixed:** normal views sit far back, so nothing in front
  gets cut off.
- **回家:** a bus pulls into the bus stop twice per loop, and three lights on
  the stop board count it in. Taiwan time 10:00.
- **浪流連:** the bridge window opens onto another world, a turning spiral
  of portal colors with a bright center and drifting sparks.
- **紐約鄰居:** taxis have headlights and tail lights that glow at night.
- **超大行李:** bags on the luggage piles jostle, and a few lift off, float,
  turn and settle back.
- **不想去遠方:** new Lookout view from inside a room on Taiwan, through the
  window to the mountains and neighbors. Curtains sway and a fan turns.
- **浴室:** new Bathroom view from inside a pink-tiled bathroom in a floating
  house, looking out at New York's towers. A duck bobs in the tub.
- **我想和你一起:** new Two Birds view following a pair of birds round Taiwan,
  with a little displacement.
- **晚安台灣:** a ring road round Taiwan with street lamps, and a little bus
  doing one lap per loop. New Road Trip view follows it.
- **我在紐約打電話給你:** twinkling Christmas lights on the fire-escape
  balconies.
- Songs whose view changed (`viewVersion: 2` in `js/songs.js`) ignore views
  saved earlier in the browser.

## Round 8: from the meeting notes

- **Big Apple** floating and slowly turning beside New York (it never lands).
  Camera: Big Apple.
- **Windmill island**: a small island with a windmill whose sails turn and a
  ring of flowers. Camera: Windmill Island.
- **Departures board** drifting high across the front of the world: split-flap
  rows of made-up dot glyphs (nothing readable) that riffle to new lines, plus
  status lights per row. Camera: Departures Board.
- **Ripple (memory blur)** slider in Style: the whole picture wavers like it's
  seen through water.
- **Lines only** style: outlines only, light on black, with no fills, glows or clouds.
- **Soft, breathing islands**: the island layers are quilted like a down
  jacket and swell and settle every 15 s; the small islands breathe too.
  Slider: Island breathing (Motion).
- **Earthquake houses**: houses rise and sink unevenly, and every 30 s a wave
  rolls across each island, lifting and shaking them (the two islands take
  turns). Slider: Earthquake (Motion).
- Any setting can be given in the viewer URL for checking looks, e.g.
  `viewer.html?preset=overview&stroke=lines&ripple=0.6`.

## Round 9: tweaks

- The round-island road has 10 street lamps instead of 22.
- The windmill is now a power-making wind turbine: tall white tower, three
  long blades with red tips, a small substation box, a red beacon at night.
  Flying houses keep clear of it.
- Earthquake no longer jumps or shakes: the ground swells in a slow, smooth
  wave, so houses rise and sink in turn.
- **Two Birds:** the birds fly against Taiwan's turn, so the island is seen
  turning behind them.
- **Performance:** boxes of the same size share one shape and outlines are
  worked out once per shape (about a quarter fewer shapes, faster loading);
  balcony lights cut to every other floor, half the bulbs (171 instead of 588).
- **Departures board** moved to drift behind the world, so it never passes in
  front of a close-up.

## Round 10: more song scenes

- The bridge floats on its own off New York's front-left, bobbing and
  swaying; its window shows soft rings drifting inward instead of a spiral.
- Night glows (lamps, car lights, bridge window, balcony bulbs) toned down.
- **Two Birds** view is now a fixed shot of Taiwan with the pair circling it.
- **魚:** neon fish spiral round the wind turbine. Camera: Windmill Island.
- **忽然之間:** a big floating alarm clock; the minute hand goes round once per
  loop, the second hand ticks. Camera: Big Clock.
- **我給的愛:** fireflies flicker round the window at the top of the ladder.
- **一桌菜:** new Dining Room view: a round red table set with dishes and rice
  bowls, steam rising, the window on Taiwan.
- **無眠:** rooftop billboards show dreamy scenes: drifting clouds, stars and
  a moon, liquid blobs, aurora, a sweeping light.
- **台北某個地方:** laundry poles on the Grove island, clothes blowing in the
  wind. Camera: Grove Island.
- **Love Lee:** the Big Apple camera orbits the apple once per loop.
- **未接來電:** rotary phones, mobile phones and radios drift between the
  islands; the phones buzz and light up every 15 s.

## Round 11: fish school, dreamy clock, phone cord, saved views

- **魚:** the neon fish are replaced by a soft school of 22 pastel fish (after
  the fish-tank project) that swims round the wind turbine together,
  stretching and bunching; light on performance (no simulation, loops).
- **忽然之間:** the clock has no bells; its face is a soft sky gradient with
  pastel dots, it breathes slightly out of shape, and time runs fast (minute
  hand every 10 s).
- **我給的愛:** fireflies are paler and less glowy.
- **未接來電:** radios removed; a red phone by New York and a blue phone by
  Taiwan, joined by a coiled blue phone cord hanging across the gap.
- **20 saved views written into `js/songs.js`:** 鹿港小鎮, 回家, 想厝的人, 想家,
  浪流連, 超大行李, 魚, 忽然之間, 抱著你, 我給的愛, 牽掛, 一桌菜, 無眠, 台北某個地方,
  愛我別走, San Francisco Street, Love Lee, Lucky, 未接來電, 勇氣.
  (一桌菜 now uses its saved Bridge framing and Love Lee its saved Crossroads
  framing; the Dining Room and Big Apple cameras are still in the camera list.)

## Round 12: saved views live in the project folder

- **Save view writes into `views.json`** in the project folder through a
  new local server, `serve.py` (start with `python3 serve.py`, not
  `http.server`). Saved views now travel with the zip, and every computer
  sees the same ones. Views saved in a browser before this round are
  ignored.
- **Clear** removes a song's saved view from `views.json`, so the song goes
  back to its default in `js/songs.js`. `views.json.bak` keeps the previous
  version.
- **Copy saved views as code** removed, since it's no longer needed.
- **Share live removed** (the relay, its panel and `js/relay.js`). The show
  runs controller and viewer on one computer, so nothing goes over the
  internet.
- `serve.py` turns off browser caching, so a normal reload shows newly
  unzipped files.

## Round 13: controller cleanup

- **Removed controls:**
  - the second *Transition duration* slider (in Camera); the one under the
    song list stays
  - the *Autonomous camera tour*
  - the *Main islands*, *Satellite islands*, *Birds* and *Airplane* switches,
    so everything is always shown
  - *Lines only* in Style
  - the three manual sky color pickers; the sky comes from the atmosphere
    buttons now
  - *Split sky*; 未接來電 no longer splits the sky
  - every cloud slider
- **Clouds fixed:** 12 clouds, density 0%, opacity 50%, softness 100%,
  drift 1.5×.
- **New sky: midnight**, a deep black sky.
- Removed settings are locked in `FIXED` in `js/config.js`, so old browser
  settings or a song can't turn them back on.

## Round 14: Motion, Camera and saved views

- **Status line** shows only whether the viewer is connected, and its fps.
- **Motion:**
  - *Auto-animation* removed; the world always animates
  - *Island rotation* fixed at one turn per loop
  - *Island breathing* is now a switch, stronger, and eases in and out
  - *Earthquake* merged into breathing: a wave rolls across each island and
    houses and towers lift, stretch and lean with it, and the mountains
    swell
  - the loop hint removed
- **Camera:**
  - number-key shortcuts removed
  - buttons grouped by place, with headings (全景, 紐約, 台灣, 中小型島,
    飄浮物件, 機艙)
  - Between Islands, Different Timezones, Crossroads and Flying Houses
    buttons removed (the cameras stay in `presets.js` for old songs)
  - ↻ marks cameras that follow something
- **Saved views are cameras of their own.**
  - Fixed spots in the world, or following a moving thing when saved from
    a ↻ camera.
  - The cabin windows and interiors are remembered by the view.
  - The 27 saved views in `js/songs.js` were converted, and land on the
    same shot.
  - Views saved earlier into `views.json` still work and switch to the new
    format when saved again.
- **Two Birds:**
  - the pair flies a figure-eight round both islands, one lap per loop
  - the camera chases from behind and a little above

## Round 15: Motion + Atmosphere

- **Motion** now holds what used to be in Motion, World and Style:
  - Floating / Displacement, with float / separate / disassemble / scatter
    buttons under it
  - Birds (count and speed)
  - Island breathing
  - Ripple
  - Rearrange houses
- Floating / Displacement changes drift over about 3 s.
- Houses fixed at 12 per island.
- **Atmosphere** has three sub-headings:
  - Sky + time: the sky buttons and Time
  - Weather: rain and snow switches only, rain 60% and snow 100%, easing in
    and out over about 4 s
  - Look: Stroke, Reduced stroke, No stroke
- **Windows follow each island's hour.** By day most are dark, they come on
  at golden hour, and at night most are lit. Close-up windows always stay
  lit. The *Window light* slider was removed, and so were the songs'
  window-light settings.
- Night darkness fixed at 85%.
- Grain removed.
- **Halftone breathes** between 30% and 70%, three times per loop. A large
  patch of dots now wanders the whole upper half, top-left corner included.

## Round 16: one-screen controller

- **Title:** "If this is home, welcome home." (controller and viewer).
- **One screen.** The controller fits a 14" laptop window without
  scrolling, in three columns: Song scenes | Camera | Motion + Atmosphere.
  The song list and camera buttons scroll inside their boxes. On a smaller
  window it falls back to a normal scrolling page.
- **Top bar:**
  - Open viewer sits next to the connected / fps status
  - a note there says to press f in the viewer for fullscreen
- **Session card removed:** Restart loop, Reset everything, the viewer's
  r key and the keys hint.
- **Song scenes:**
  - song rows are one line, with the artist small beside the title
  - the song dropdown is gone: *Save view → (song)* and *Clear* act on
    the song selected in the list
  - no red dot on the playing row; a red dot means "saved view"
  - shorter hint
- **Views are named** after what they look at (e.g. "Bus Stop", "Taiwan ·
  close-up"), shown in the song list. All 27 saved views in songs.js were
  named.
- **Camera group headings in English:** Overview, New York, Taiwan, Small
  islands, Floating objects, Cabin.
- **Motion:**
  - Floating / Displacement is five buttons (still, float, separate,
    disassemble, scatter) moving at a steady eased pace, about 2 s per
    step
  - 20 birds, with speed only
  - Ripple is a switch that fades over about 3 s
- **Sun and moon** trade places slowly (about 4 s) whatever the Time
  slider does, one passing above the other, with no jump.

## Round 17: save the whole scene per song

- **Save view saves the whole scene for the song:**
  - the camera
  - Floating / Displacement, bird speed, Island breathing and Ripple
  - Time and sky
  - rain and snow
- Activating the song restores all of it with the usual eased
  transitions.
- House layout and stroke style are not saved per song.
- Settings a song hasn't saved keep their songs.js value or the value from
  the song before.
- **Columns:** Song scenes | Motion + Atmosphere | Camera.
- **More snow** on New York: twice the flakes, slightly larger.


## Round 18: safer saving, cleanup

- **Save view and Clear re-read `views.json` first**, so a controller tab
  that was open before a new zip was unzipped (or before another tab saved)
  only changes its own song and never wipes the other saved views.
- **Only the controller can write `views.json`.** `serve.py` now accepts only
  JSON posts, which other websites open in the same browser can't send.
- **`views.json` is never missing after a failed save.** `serve.py` writes the
  new file first, then copies the old one to `views.json.bak` and swaps.
- **README:** recording no longer mentions the removed *Restart loop* button;
  any 2:00 loops seamlessly.
- **Removed leftovers:** the lines-only drawing mode, number formats for
  removed sliders, and the unused loop-restart code.

## Round 19: bus lane, contrast, steady camera

- **The Taiwan bus no longer drives through houses**, in any *Rearrange*
  layout. Each house (with its poles and street lamp) is placed by its own
  footprint: clear of the bus on the ring road, not up a mountain slope,
  not overlapping another house. To fit all 12 around the mountains, the
  Taiwan walk-ups are drawn at 80% size. The hero house is unchanged.
- **Fewer rendering glitches:**
  - mountains no longer poke through houses
  - houses stay on the ground while the island breathes (they still
    stretch and lean, but no longer lift off)
  - roofs lift far less, so no gap opens under them
- **Contrast slider** in Atmosphere → Look: contrast and saturation
  together, for the scrim. Saved per song with *Save view*.
- **Camera moves at a steady speed** from start to end (no ease-in/out),
  turning at a steady rate too.
- **No sliced picture when zooming out** (Winnie's fix): the camera sits
  far back (320) for every normal view. A close-up's short cutaway
  distance only holds while you stay zoomed in; zoom out (song, slider or
  mouse wheel) and it moves back automatically. A view saved after zooming
  out is stored without the cutaway.

## Round 20: smoother show, no jumps, less clipping

- **Controller layout.** *◀ Prev*, *Activate selected* and *Next ▶* sit
  inside the Active box, right under the playing song, above the list.
  Clicking them (or **←/→**) never scrolls the page any more; only the song
  list scrolls to show the active song.
- **Song changes are hard to notice as a cut:**
  - the camera pans at one steady speed *on screen*, even while it zooms
    (it used to whip in at the end of a zoom-in)
  - sky, hour, light and effects change at an even pace and land together
    with the camera, instead of jumping most of the way in the first second
  - leaving song 1, the cabin fades out over the whole camera move
- **Big camera turns are gentler.** A turn over 90° takes longer (up to
  2.5× for a full 180°, e.g. 18 → 19) and rises up to ~25° in the middle,
  curving over the scene instead of whipping round. The camera always
  orbits round the vertical axis, so near-opposite views no longer tip over
  a random axis.
- **Islands no longer jump to a random angle.** The controller's loop clock
  lost time while its window was in the background, and a second controller
  tab could pull the viewer between two clocks. Now both clocks count real
  time, the viewer follows one controller, controllers share one clock, and
  any small difference is blended in over ~2 s instead of snapped.
- **Song 1 / Airplane Window:** a dark cabin (only the view outside reads)
  and three much bigger windows (about 54% of the screen height).
- **Sky dimmer** in Atmosphere → Look: darkens only the sky behind the
  world, off to −90%; the islands' light is untouched. Saved per song.
- **Island breathing is off by default.** (Songs saved with it on still
  switch it on.)
- **The floating phones no longer vibrate**, and the two mobile phones are
  gone. The two rotary phones and the blue cord between them stay.
- **Close-ups cut only what's in the way.** Cutaway cameras (window
  close-ups, the bathroom, Manhattanhenge, the bridge) used to slice off
  everything past a fixed distance. Now a close camera finds the first solid
  thing between it and the subject and cuts just in front of that; with
  nothing in the way, nothing is cut. Anything within 1.2 of the subject
  (a window's cage or sill) always stays.
- **Song 15 / Two Birds:** the camera sits far back, so things the birds fly
  past are no longer sliced open.
- **Song 20 / 魚:** each fish has a real rounded, shaded body (no more paper
  edge when it turns) and a fin on each side; the school is spread about
  2.5× wider and trails almost twice as far.
- **Song 23 / 我給的愛:** the camera slowly circles the ladder and its window
  (once per loop). New camera button *Ladder & Window (orbit)* ↻.
- **README split.** `README.md` is now a short introduction and quick start;
  the full manual moved to `GUIDE.md`, with a new section on streaming to
  YouTube with OBS.
