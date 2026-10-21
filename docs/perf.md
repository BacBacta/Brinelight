# Performance on a phone

Goal of week 2 (task 6): **30 FPS or more on the low-end Android test phone**, in the city and at sea.

## Tools in the game

- `?fps` in the URL shows a small counter at the top center, under the top bar, over everything and never in the way of a tap, refreshed every second:
  - FPS: the average over the last second;
  - min: the lowest one-second rate of the last 10 seconds;
  - the quality step (`0`, `1` or `2`), `auto` or `forced`;
  - the view (City or Sea);
  - the draw calls and triangles of the last frame (`renderer.info`).
  - the longest frame of the last 10 seconds (a hitch is one frame much longer than the others);
  - from the Lighthouse 5, "Land built in X ms aside, shown in Y ms": the land's last rebuild, X in its worker (the display goes on, the old land shown) and Y on the display's thread to put the new one in place (it is built again only when a slot or the era changes).
- The minimum ignores the 5 seconds after the 3D models load, and starts over after a change of view or a return to the tab.
- `?quality=0`, `?quality=1` or `?quality=2` forces a quality step, to compare steps on the same phone. The automatic tuning is then off.
  - `0`: full quality.
  - `1`: pixel ratio 1, and a 1024 px shadow map instead of 2048.
  - `2`: pixel ratio 1, no shadows, and the water without its sky reflection, small ripples and moving foam, on a coarser grid (week 6, task 4).
- Without `?quality`, the game starts at step 0 and lowers the step by itself when it stays under 30 FPS for 3 seconds, as the prototype did.
- `?mist` shows the Mist's look (its mood only, no rule): the banner says "Mist", and the counter adds "Mist" after the view.
- `?demo=phare30` shows a demonstration city for measuring the worst case: Lighthouse 30, the other buildings at 30, 39 rafts (each raft building type on two rafts at level 3), the Refinery's building site, 106 survivors. `?demo=phare15`: Lighthouse 15, 15 rafts, the same site, 46 survivors. Phare 30 has 38 rafts and fills the last slot at the shipyard; in both, the eighth raft is damaged (hp 40). With `?blender` they show the land: a flooded plot and a landfill under way. It lives in memory only: nothing is sent to the server, nothing is written on the device, and your own city stays as it was. Only in development and on the branch previews (`*.brinelight.pages.dev` built from a branch other than `main`); the production build does not even contain it (`client/test/demo.test.ts`).
- `?demo=phare30&cycle` (or `phare15`) floods and mends the demo's flooded plot every 4 seconds: the land is built again each time, to read its hitch on a phone with `&fps`.
- They can be combined: `?fps&quality=1`, `?fps&mist&quality=2`, `?demo=phare30&fps`.

## Protocol (5 steps)

Before you start, plug the phone in and set the brightness to the maximum, for every measure. On battery or with a dim screen, the phone slows itself down to save power.

1. Open https://brinelight.pages.dev/?fps in the phone's usual browser.
   - Cloudflare Pages builds every push. brinelight.pages.dev follows `main`, so it shows the week's work once the weekly pull request is merged. Before that, use the preview link that the Cloudflare bot posts on the pull request, followed by `?fps`.
   - Without a network link: on a computer on the same Wi-Fi, run `npm run build`, then `npm run preview -w client -- --host`. On the phone, open the "Network" address it prints, followed by `?fps`.
2. Wait for the city to show, then 30 seconds without touching anything. Note the FPS and min in the table, with the step shown (`auto`).
3. Tap Sea and wait 10 seconds, then 20 more without touching anything. Note the FPS and min for the sea.
4. Reload with `?fps&quality=0`, then `?fps&quality=1`, then `?fps&quality=2`. For each one, wait 10 seconds after the city shows before reading, note the city, then tap Sea and wait another 10 seconds before reading the sea.
5. Fill in one row per view and step. Write the phone model, its browser and version, and anything you noticed in Remarks (heat, stutter when turning the camera).

Always wait 10 seconds after a change of view or of quality step before reading the numbers.

## Results

| Phone | Browser | View | Average FPS | Minimum FPS | Step | Remarks |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium (container, software rendering) | Chromium (Playwright), 412 × 915, pixel ratio 2.625 | City | 11 | 9 | 2 (auto) | Reference only, not a phone: no graphics chip, everything is drawn by the processor. 80 draw calls, 61.4 k triangles. |
| Chromium (container, software rendering) | same | Sea | 12 | 11 | 2 (auto) | 142 draw calls, 65.5 k triangles. |
| Chromium (container, software rendering) | same | City | 3 | 2 | 0 (forced) | Full pixel ratio and shadows cost the most here. |
| Chromium (container, software rendering) | same | Sea | 6 | 5 | 0 (forced) | |
| Chromium (container, software rendering) | same | City | 7 | 6 | 1 (forced) | |
| Chromium (container, software rendering) | same | Sea | 13 | 11 | 1 (forced) | |
| Chromium (container, software rendering) | same | City | 12 | 9 | 2 (forced) | |
| Chromium (container, software rendering) | same | Sea | 14 | 12 | 2 (forced) | |
| Samsung Galaxy S22 (SM-S901U) | Chrome Android | City | 60 | 60 | 0 (auto) | Cloudflare preview. 86 draw calls, 66.7 k triangles. |
| Samsung Galaxy S22 (SM-S901U) | Chrome Android | Sea | 60 | 60 | 0 (auto) | Cloudflare preview. 200 draw calls, 73.3 k triangles. |
| Samsung Galaxy S22 (SM-S901U) | Chrome Android | City | 60 | 60 | auto | Week 5, brinelight.pages.dev, not signed in, Termux stopped. 84 draw calls, 61.4 k triangles. |
| Samsung Galaxy S22 (SM-S901U) | Chrome Android | Sea | 60 | 60 | auto | Same. 64 draw calls, 51.8 k triangles. |

The container rows only show the order of the costs: going from step 0 to step 2 roughly quadruples the frame rate in the city. A real phone with a graphics chip is much faster. Only the phone rows decide whether the goal is met.

## Conclusion

The 30 FPS goal is met on the Samsung Galaxy S22: 60 FPS with a minimum of 60, in the city and at sea, at full quality (step 0), so the automatic tuning never had to lower the quality.

This is a high-end phone. Before the beta, the same protocol must still be run on an entry-level Android phone (about 120 €), which is the phone the goal is about.

## Signed in at ×1000 (week 5)

On the S22, the game signed in at ×1000 stuttered during a test where the server (with PGlite) and both Cloudflare tunnels ran in Termux, on the same phone. The same game, not signed in and with Termux stopped, holds 60 FPS (min 60), in the city and at sea (Results). The stutter came from the test setup: the server and the tunnels shared the phone's processor with the game. The real server will run at Hetzner.

Measures in the container (Chromium, 412 × 915, pixel ratio 2.625, `?fps`, auto quality), week 2 code (`bc089bc`) against week 5 (`ad7bcee`). The signed-in city has the Lighthouse at level 4, several buildings and one raft. In the "active" case, an upgrade is tapped every 0.7 s from the open sheet.

| Case | FPS (min) | Draw calls | Triangles | Our script per frame | Style, layout, paint per frame |
| --- | --- | --- | --- | --- | --- |
| Week 2, not signed in | 7–8 (7) | 80 | 61.4 k | 1.5 ms | 0.3 ms |
| Week 5, not signed in | 7–8 (7) | 80 | 61.4 k | 1.5 ms | 0.3 ms |
| Week 5, signed in ×1 | 9 (8) | 93 | 61.9 k | 1.6 ms | 0.3 ms |
| Week 5, signed in ×1000 | 9 (8) | 93 | 61.9 k | 1.7 ms | 0.4 ms |
| Week 5, signed in ×1000, active | 8 (7) | 95–97 | 65–67 k | 1.7 ms | 0.9 ms |

- The container has no graphics chip: its main thread spends 87 to 105 ms of each frame waiting for the drawing. Our script is under 2 ms per frame in every case.
- In the CPU profiles (ms per frame), the three.js render takes 1.0 to 1.2, the labels' `place()` 0.3, `refresh()` 0.15 to 0.33, and `account.city()` 0.04 to 0.13. `signature()` stays under 0.01.
- `advance()` alone takes under 0.2 ms, even for a busy city advanced by an hour of real time at ×1000.
- Signed in, the client calls the server only to open the city (`GET /city`) and once per action: nothing is polled.
- The signed-in cities have more draw calls because more buildings are built, not because of the account.

## City buildings (week 5)

The nine buildings now have their own models, generated from the art direction's concepts (`docs/art-direction.md`). `assets/make-models.py` (Python and Pillow, out of the build; first named `assets/buildings/make-buildings.py`) makes the files the game serves from the originals in `assets/buildings/src/`. Each original has about 2 500 triangles and one 2048 px JPEG texture, and weighs 3.1 to 3.8 MB.

The script makes three changes:
- the texture becomes a 512 px WebP at quality 82 (`EXT_texture_webp`);
- the geometry is quantized (`KHR_mesh_quantization`): positions on 16 bits (largest error 0.000014 model units), normals on 8 bits, texture coordinates on 16 bits;
- identical vertices are welded, with 16-bit indices.

| Building | File | Triangles | Vertices |
| --- | --- | --- | --- |
| Lighthouse | 142 kB | 2 451 | 5 038 |
| Refinery | 143 kB | 2 485 | 5 053 |
| Fishery | 135 kB | 2 270 | 5 106 |
| Lumberyard | 162 kB | 2 369 | 5 355 |
| Shelters | 153 kB | 2 384 | 5 272 |
| Barracks | 162 kB | 2 404 | 5 408 |
| Harbor | 154 kB | 2 427 | 5 341 |
| Observatory | 160 kB | 2 511 | 5 165 |
| Infirmary | 140 kB | 2 257 | 4 964 |
| **Total** | **1 352 kB** | | |

Each model is a single mesh with a single material: one draw call per building, plus its shadow.

Measures in the container (Chromium, 412 × 915, quality 2, cache off). Each time is the median of 3 loads, until "Loading your city…" goes away. The new city has its starting buildings. The built city has all nine buildings, with the Lighthouse at level 4.

| | Network | Load, new city | Load, built city | Downloaded | Draw calls (new / built) | Triangles (new / built) |
| --- | --- | --- | --- | --- | --- | --- |
| Before (kit models) | local | 1.67 s | 1.71 s | 3.08 MB | 80 / 92 | 61.4 k / 62.3 k |
| After (nine models) | local | 2.47 s | 2.37 s | 4.41 MB | 71 / 81 | 63.1 k / 62.5 k |
| Before | 10 Mbit/s, 40 ms | 4.05 s | 4.03 s | 3.08 MB | | |
| After | 10 Mbit/s, 40 ms | 5.25 s | 5.61 s | 4.41 MB | | |

- The new models save 9 to 11 draw calls, with about as many triangles.
- They cost 1.3 MB more to download, about 1.2 to 1.6 s at 10 Mbit/s, and some decoding time. The kit (`phare.glb`, 2.9 MB) still loads for the island, the scaffolding, the flags, the rafts and the sea.
- To check on the phone with `?fps`.
- A smaller kit, holding only the models still used, so that `phare.glb` no longer loads in full: not planned yet (it is not among week 6's tasks).

## The island, the sea's models and the icons (week 5)

New models from the art direction, made by `assets/make-models.py` from `assets/models/src/`, with the same treatment as the buildings: a 512 px WebP texture (1 024 px for the island, the largest thing on screen), quantized geometry and welded vertices.

Before quantizing, the island is flattened:
- its meadow is flat at -0.07 in the original's units;
- its two windswept pines stood inside plots: the smaller one (422 vertices) moves to the rim at the pier's gap, turned to lean out to sea; the other one's top (1 113 vertices) goes. What lay flat under them takes the meadow's texture;
- its 2 512 vertices between the meadow and 0.08 (grass tufts, the edge of the meadow) are brought down to it;
- the meadow then moves to y = 0.

| Model | Original | Served | Triangles | Loaded |
| --- | --- | --- | --- | --- |
| Island | 3 666 kB | 218 kB | 2 517 | yes |
| Raft | 3 290 kB | 101 kB | 1 384 | yes |
| Wreck | 3 552 kB | 157 kB | 2 452 | yes |
| Pirate camp | 3 639 kB | 167 kB | 2 930 | yes |
| Boat | 3 012 kB | 119 kB | 1 965 | yes |
| Kelp Greenhouse | 3 631 kB | 156 kB | 2 309 | since week 5, task 4 |
| Smokehouse | 3 071 kB | 145 kB | 2 332 | since week 5, task 4 |
| Watchtower | 3 491 kB | 151 kB | 2 498 | since week 5, task 4 |
| **Total** | | **1 214 kB** | | |

The 24 icons (`assets/icons/make-icons.py`, from the sheet) weigh 256 kB in all, at 48 and 96 px.

What changed on screen:
- the island replaces the 19 grass tiles and the ring of sand. Turned by 15°, its pine stands 1.75 from the center of the nearest tile and 1.74 from the nearest raft slot, and 96% of the 19 plots' area is on its meadow, 4% on sand (part of the Infirmary's plot and of an empty plot next to it), none on rock;
- one raft model replaces the deck and the planks (still one InstancedMesh for up to 39 rafts);
- at sea, a wreck model replaces the ruined house and the barrel, and the pirate camp floats as one model; your boat is one model;
- the kit's flags on the buildings are gone.

Measures in the container (Chromium, 412 × 915, quality 2, cache off), on a city with all nine buildings, the Lighthouse at level 6, six rafts and a fleet at sea. Each load time is the median of 3 loads, until "Loading your city…" goes away. FPS, draw calls and triangles are read with `?fps` 12 s after the city, then the sea, shows.

| | Downloaded | Load, local | Load at 10 Mbit/s, 40 ms | City | Sea |
| --- | --- | --- | --- | --- | --- |
| Before (`7d5744c`) | 4.41 MB | 2.44 s | 5.50 s | 6 FPS, 83 calls, 62.8 k triangles | 10 FPS, 151 calls, 65.7 k triangles |
| After | 5.20 MB | 2.23 s | 6.14 s | 6 FPS, 39 calls, 72.8 k triangles | 12 FPS, 139 calls, 68.1 k triangles |

- The city draws half as many calls: one island instead of 19 tiles and a sand ring, no more flags, and one raft mesh instead of two.
- It downloads 0.8 MB more, about 0.7 s more at 10 Mbit/s.
- The container's FPS only shows that nothing got slower; the phone's numbers decide.

### Sources in `assets/`

The originals (concepts, meshes, portraits, the icon sheet) take **90 MB** in `assets/` today (the first, sandy island was replaced by the green one, not kept), out of the client build. They stay in git while they are small; beyond **300 MB**, they will move out of git (Git LFS or a storage bucket).

## Rafts (week 4, task 6)

Up to 39 rafts can sit around the island. Each part (deck, planks, free slots, their rings, the tap shapes) is one `InstancedMesh`, so rafts add about 5 draw calls whatever their number, plus one scaffolding model while the shipyard works (`client/test/rafts.test.ts` checks it with 39 rafts). Their bobbing moves the instances, without creating objects.

To check on a phone, with `?fps`: a city with the Lighthouse at level 10 and its 39 rafts, in the city view, against the same city without rafts. The container has no graphics chip, so this measure is to be made on the phone.

## Buildings on rafts (week 5, task 4)

The Kelp Greenhouse, the Smokehouse and the Watchtower stand on the rafts that carry them: one `InstancedMesh` per type, with room for the 2 rafts a type may have, hidden while no raft carries one. So they add at most 3 draw calls (and 3 in the shadow pass), whatever the number of rafts. Their three models (464 kB) are loaded once the city shows, so the first screen waits for nothing more.

Measured in the container (Chromium, 412 × 915, quality 2, cache off, `?fps` 12 s after the city shows), on a city with all nine buildings, the Lighthouse at level 6 and six rafts, before (`29ac133`) and after:

| | Downloaded | Six free rafts | Six rafts with buildings (two of each type) |
| --- | --- | --- | --- |
| Before | 5.18 MB | 39 calls, 72.3 k triangles | 39 calls, 72.3 k triangles (not shown yet) |
| After | 5.62 MB | 39 calls, 72.3 k triangles | 42 calls, 86.6 k triangles |

- A city with no building on its rafts draws exactly as before.
- Six buildings add 3 calls and 14.3 k triangles (about 2 400 each). The FPS of the container (9 before, 7 after with six buildings) only says it draws on the processor; the phone's numbers decide.

## If a phone stays under 30 FPS

From the simplest to the heaviest:

1. **Start mobiles at step 1** (pixel ratio 1) instead of 0. One line, and the biggest gain on high-density screens.
2. **Smaller shadow map**: 1024 instead of 2048, or no soft shadows (`PCFShadowMap`).
3. **Pixel ratio 1.5** at most instead of 2, as a middle step between 0 and 1.
4. **Lighter water**: the wave plane has 140 × 140 segments; 64 × 64 looks the same from the usual camera distance.
5. **Fewer draw calls**: merge the island tiles and repeated models into one mesh (`BufferGeometryUtils.mergeGeometries`) or use instancing. The city draws about 85 calls, the sea 140 to 200.
6. **Labels drawn in the 3D view** (sprites or a canvas) instead of HTML elements moved on every frame.
7. **A 30 FPS cap** on weak phones: draw one frame in two. It is steadier, and it saves battery and heat.

To take up when measuring on the entry-level phone (week 5 measures, above). Item 1 is also the first step if the drawing is what limits the phone.

8. **A `?perf` counter** next to `?fps`: milliseconds per frame in `account.city()`, `refresh()`, the labels and the render, measured on the phone itself. Measure this first, before changing anything else.
9. **Labels: read the canvas position once per frame.** Today `project()` calls `canvas.getBoundingClientRect()` once per label, 9 times per frame. Reading it once per frame, or only on resize, also removes the forced layout seen when the city changes often.
10. **One `requestAnimationFrame` loop** instead of two (the scene's and `main.ts`'s), in a fixed order: the state, `refresh()`, the labels, the render. Writes to the page would no longer come between the reads of the same frame.
11. **The queue at the top left** rebuilds its HTML 4 times a second. Update only the times and the bars, and rebuild only when a row comes or goes.

## Build size

three.js now has its own file (`manualChunks` in `client/vite.config.ts`): **568 kB** minified, **146 kB** gzipped. The game's own code is 50 kB (20 kB gzipped). Because three.js changes rarely, browsers keep it in cache across game updates.

Vite still warns that one file is over 500 kB. That file is three.js alone, which the game needs from the first second, so loading it later would not help. The warning limit is left as it is: it applies to every file, and raising it would also hide a real growth of the game's own code.

## Shared interface components (week 6, task 2)

The game's own JavaScript and CSS (`client/dist/assets/index-*.js` and `index-*.css` after `npm run build`, gzip at level 9; three.js and the fonts do not change):

| | JS | CSS | Total |
| --- | --- | --- | --- |
| Before (`527d7d1`) | 93 315 B, 33 334 B gzipped | 28 535 B, 9 001 B gzipped | 121 850 B, 42 335 B gzipped |
| After | 89 906 B, 33 407 B gzipped | 28 769 B, 9 060 B gzipped | 118 675 B, 42 467 B gzipped |
| Change | −3 409 B, +73 B gzipped | +234 B, +59 B gzipped | **−3 175 B, +132 B gzipped** |

The goal was no growth at all; gzipped, it is missed by 132 B (0.31 %), which the owner accepted on 17 October. **The rule for a tidying-up of the code (no new feature) is now: the raw size does not grow, and the gzipped size does not grow by more than 0.5 %.** The CSS's 59 B are the invisible 44 px tap areas (the sheets' close button has its own, placed from the sheet, so that its ✕ is drawn as before). The JS's 73 B are the components themselves: the same HTML written again in every sheet compressed very well, and a function that writes it costs a little more than the copies it replaces. Tried and left out because they were heavier: the interface's own shades as CSS variables (+150 B gzipped), full class names in the buttons' calls, a component for paragraphs, the top bar and the queue on components.

The 44 look references in `e2e/look/` (42 captures, and the second reference of `captains-top` at both sizes) weigh 1 956 368 B in git.

## Feel: celebrations, sounds, motions, building tiers (week 6, task 3)

Measured in the container (Chromium, software rendering, 412 × 915, `?quality=2&fps`), 12 s after the city shows, on a city with every building at the same level. "Before" is the code just before the tiers (`95fb056`), with the same cities. The container only shows the order of the costs: the phone rows of this file decide whether the goal of 30 FPS is met.

| City | Before: FPS, draw calls, triangles | After: FPS, draw calls, triangles |
| --- | --- | --- |
| Tier 1: every building at level 1, Lighthouse 4 | 8, 38, 64.1 k | 9, 38, 64.1 k |
| Tier 2: level 5, Lighthouse 9 | 10, 38, 64.5 k | 9, 39, 64.9 k |
| Tier 3: level 10, Lighthouse 12 | 9, 38, 64.5 k | 9, 40, 68.1 k |
| During the Lighthouse's full-screen celebration (Lighthouse 9 → 10) | – | 9 at quality step 2 (5 with the beam still turning) |

- The flags, crates and barrels of every plot are one merged mesh, and the lanterns one InstancedMesh: one draw call more from the second tier, two from the third, whatever the number of buildings.
- The full-screen celebration's turning beam cost almost half of the frames in the container (5 FPS instead of 9): at the lowest quality step (2), the beam is not shown, and the celebration costs nothing measurable. The automatic tuning lowers the step on a phone that stays under 30 FPS for 3 seconds.
- To check on the entry-level phone (and the S22) with `?fps`, with the protocol at the top of this file: the city at the three tiers, and a Lighthouse celebration.

The game's own JavaScript and CSS (as in the section above): from 118 675 B (42 467 B gzipped) after task 2 to 131 113 B (46 793 B gzipped), +10 % gzipped: the celebrations, the ten sounds made in code, the motions and the tiers. This is new work, not a tidying-up: the 0.5 % rule does not apply.

The island's shore steadied (week 6, after task 3): the prototype's 18 foam hexagons of ring 3 are removed, so 16 draw calls fewer on the start city (34 to 18, at 412 × 915), and 20, 21 and 22 instead of 38, 39 and 40 for the three tiers above (container, `npm run e2e`). `island.glb` grows by 5 424 B (228 200 B): 194 faces of the meadow turned face up, on vertices of their own.

Recorded sounds (week 6, after task 3): 11 MP3 in `client/public/sounds/`, 350 kB in all (the interface sounds 3 to 12 kB each, the rewards 11 to 27 kB, the sea loop 224 kB). None is in the first screen: they load after the first tap, in the background. The game's own JavaScript grows by about 1.5 kB gzipped (the loader and the sea).

## Light, water and the Mist's mood (week 6, task 4)

Measured in the container (Chromium, software rendering, 412 × 915, `?fps&quality=0` or `2`), 10 s after the city or the sea shows, on a new city. "Before" is `c912d7f`, "after" the end of the task, the same day on the same machine. The container only shows the order of the costs: the phone rows of this file decide whether the goal of 30 FPS is met.

| View | Step | Before: FPS, draw calls, triangles | After, calm: FPS, draw calls, triangles | After, `?mist` |
| --- | --- | --- | --- | --- |
| City | 0 | 4, 18, 64.8 k | 3, 14, 43.9 k | 4, 19, 44.1 k |
| City | 2 | 6, 18, 64.8 k | 7, 14, 30.1 k | 6, 19, 30.3 k |
| Sea | 0 | 10 to 12, 135 to 139, 66.2 k | 7, 109, 44.5 k | 7, 137, 45.4 k |
| Sea | 2 | 10 to 12, 133, 66.0 k | 11, 109, 30.7 k | 12, 133, 31.4 k |

The three tiers of the e2e (step 2, after): 16, 17 and 18 draw calls, 29.3 k, 30.0 k and 33.3 k triangles (20, 21, 22 and 64.0 k, 64.8 k, 68.0 k before).

- **Triangles:** the water's grid goes from 140 to 96 segments a side at steps 0 and 1 (39.2 k → 18.4 k triangles), and 48 at step 2 (4.6 k); its small ripples are drawn per pixel instead.
- **Draw calls:** in calm weather the Lighthouses' beams are hidden: 4 calls fewer in the city (two cones, each drawn on both sides), 28 at sea (7 Lighthouses). In the Mist they sweep again, and the veil on the horizon adds 1 in the city.
- **The water's shader** (sky reflection, ripples, foam) costs fragments. At sea, step 0 falls from about 11 to 7 FPS in the container, where the whole screen is water drawn by the processor; at step 2, without the reflection and the ripples, it is back where it was. A phone's graphics chip does this work; only its rows count.
- **Foam:** no draw call and no extra render pass. Its grid (256 × 256, 64 kB) is built on the CPU when the city shows and again only when the rafts change.
- **Weight:** the game's own JavaScript goes from 101 856 B (37 799 B gzipped) to 111 429 B (41 510 B gzipped), +3 711 B gzipped: the light, the water's shader, the shore's grid, the Mist's mood. The CSS does not change. This is new work, not a tidying-up: the 0.5 % rule does not apply.

**The 30 FPS goal on an entry-level phone is still to be checked**: there is none to measure on yet.

### To measure on the S22 (owner)

With the protocol at the top of this file, on the pull request's Cloudflare preview, plugged in and at full brightness; wait 10 s after each change before reading:

1. `?fps`: the city 30 s without touching, then Sea 20 s. Note the step `auto` reached.
2. `?fps&quality=0`, then `?fps&quality=2`: the city, then the sea.
3. `?fps&mist&quality=0`, then `?fps&mist&quality=2`: the city, then the sea.
4. In the city at step 0, turn the camera toward the horizon: the Mist's veil (with `&mist`) and the shore's foam should hold still while the camera stays still.

Note each FPS and min, with the draw calls and triangles the counter shows, in the results table above.

## How many players one CX23 holds (week 8, task 4)

`npm run load` (`tools/load/`, Node, no new dependency) plays simulated players against a game server. Each one signs in with its own throwaway Ed25519 key, made by the script and forgotten when it ends, exactly as a wallet signs in. Then it plays at a human rhythm: an action every 20 to 60 seconds (an upgrade, a fleet, a claim; the rules refuse many of them, as they would a new player's), and a `GET /city` at each "launch", every 3 to 7 minutes. The server's limits are never changed: sign-ins go at 18 a minute, under the limit of 20 a minute per address, so 500 players take about 28 minutes to arrive. Sign-ins are counted apart, never in a stage's measures.

It reports, for each stage: the answers a second, the median and the slowest 1 % (p99), the refusals by the rules, the "too many" (429) and the errors. It exits with 1 at the first 429 or error. The CI runs it with 20 players for 30 seconds against the whole stack (job `deploy`).

### On the real server, before it opens (owner, with Claude Code)

1. **A backup just before** (on the server): `sudo systemctl start brinelight-backup.service`, and note the file name it prints (`journalctl -u brinelight-backup.service -n 3`).
2. **The machine's processor and memory**, in a second SSH window on the server, until the test ends (`Ctrl+C`):

   ```
   while true; do docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' | sed "s/^/$(date -u +%T),/" >> ~/load-stats.csv; sleep 5; done
   ```

3. **The test**, from your computer (not from the server: it would take the server's processor), about an hour:

   ```
   npm run load -- --url https://api.brinelight.xyz --origin https://play.brinelight.xyz --stages 100,250,500 --stage-seconds 600
   ```

4. **The database put back as it was**: `sudo ./restore.sh replace` with the backup of step 1 (it removes the test's players and cities).
5. The results go in the table below, with `~/load-stats.csv`'s highest processor and memory for each stage; then delete `~/load-stats.csv`.

### When to move to the CX33

When, at the busy hour, the processor stays over 70 %, or the p99 of the actions goes over 500 ms. The CX33 (4 vCPU, 8 GB, about €10.70 a month) is one click in the Hetzner console and a few minutes offline; the data stays (`docs/tasks/week-8.md`, "What it costs").

### Results

| Where | Players | Answers a second | p50 (ms) | p99 (ms) | Processor (server, db) | Memory (server, db) | Refused by the rules | 429 / errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| This machine's container, the whole stack in Docker (19 October; not a measure of the CX23) | 20 | 0.37 | 17 | 25 | 2.5 %, 0.8 % | 58 MB, 38 MB | 6 | 0 / 0 |
| CX23 | 100 | | | | | | | |
| CX23 | 250 | | | | | | | |
| CX23 | 500 | | | | | | | |

## The city remade in Blender (week 8): meeting 1, the island, the Lighthouse and the Refinery

Measured with the city at 412 × 915 (container, quality 2, the e2e's counter), `?blender`, three rafts. The other seven buildings still have their old models and details.

| City | Draw calls | Triangles |
| --- | --- | --- |
| Level 15, old look (today) | 22 | 37.9 k |
| Level 15, the island, the Lighthouse and the Refinery remade | 20 | 38.7 k |
| Level 1 (Lighthouse 2) | 16 | 32.7 k |
| Level 5 | 19 | 34.1 k |
| Level 10 | 20 | 38.0 k |
| Level 30 | 20 | 41.0 k |
| Level 12, the Refinery at work (its building site) | 24 | 39.5 k |
| Level 20, 15 rafts, 360 px | 20 | 56.1 k |

- **One draw call per building, whatever its level:** a stage's model holds its levels' details with its triangles ordered by level, and the game draws a range of it.
- **A building site:** four draw calls (scaffolding, mast, arm, crate) while it works, against two for all sites before. There are at most two at once (two builders).

**The files** (served: 512 px WebP, 1,024 for the island, quantized):

| Model | Triangles | File |
| --- | --- | --- |
| The island (made to the grid) | 2,656 | 171 kB (the old one: 2,517 and 222 kB) |
| The Lighthouse, six eras (seven models) | 1,378 to 2,022 | 93 to 127 kB |
| The island's ground, one an era (six models) | 588 to 2,480 | 76 to 198 kB |
| The Refinery, six eras (seven models) | 896 to 1,556 | 69 to 109 kB |
| The building site, four pieces | 1,076 in all | 93 kB in all |
| The Shelters, six eras (seven models) | 772 to 1,316 | 57 to 87 kB |
| The Barracks, six eras (seven models) | 710 to 1,072 | 53 to 83 kB |
| The Infirmary, six eras (seven models) | 708 to 1,232 | 53 to 80 kB |
| The Fishery, six eras (seven models) | 646 to 1,036 | 52 to 70 kB |
| The Lumberyard, six eras (seven models) | 764 to 1,024 | 57 to 70 kB |
| The Harbor, six eras (seven models) | 720 to 928 | 55 to 65 kB |
| The Harbor's pier and boat (one an era) | 460 to 780 | 43 to 59 kB (one more draw call) |
| The Observatory, six eras (seven models) | 892 to 1,392 | 68 to 94 kB |

- **What is downloaded:** only the stage each building shows, and the next one while an upgrade toward it runs. With the Observatory, all nine buildings are remade: with `?blender`, no old building model is fetched any more.
- **At level 30:** 171 + 163 + 113 + 109 kB for the island, its ground, the Lighthouse and the Refinery, about 0.55 MB. The ground adds one draw call.

### What a phone downloads, and how soon the city shows (owner, 19 October)

With `?blender`, the old models of the buildings remade and the old island are no longer fetched, and the city waits for the models of its buildings' current era before its first image (they no longer pop in after it). The next era is fetched in the background once an upgrade toward it runs. Measured in Chromium at 412 × 915 with the network held to 10 Mbit/s and 40 ms, cache off, three runs each (median):

| City | First image | Downloaded in all |
| --- | --- | --- |
| New player, old look (today's default) | 11.0 s | 5.8 MB |
| New player, `?blender` before | 10.5 s | 6.2 MB |
| New player, `?blender` now | 10.3 s | 5.7 MB |
| Lighthouse 30 city, old look | 11.7 s | 5.8 MB |
| Lighthouse 30 city, `?blender` before | 11.0 s | 6.3 MB |
| Lighthouse 30 city, `?blender` now | 10.6 s | 5.9 MB |

- **Half of it is the prototype's kit** (`phare.glb`, 2.9 MB): the sea's sites and the old details still use it. Once every building is remade, it can wait until you first go to sea, and the city's first image would need about 2.9 MB.
- The game's code is about 340 kB; the old models of the seven buildings not remade yet about 1.07 MB.

### The sea's models wait for the sea (owner, 19 October, night)

With `?blender`, the prototype's kit (`phare.glb`, 2.9 MB) and the wreck, the camp and your boat wait for your first visit at sea; the island's ground is now counted. Same measure (10 Mbit/s, 40 ms, three runs, median), the Blender bake paused so the machine is free:

| City | First image | Downloaded in all |
| --- | --- | --- |
| New player, old look (today's default) | 10.6 s | 5.8 MB |
| New player, `?blender` | 7.5 s | 2.5 MB, all before the first image |
| Lighthouse 30 city, old look | 10.5 s | 5.8 MB |
| Lighthouse 30 city, `?blender` | 8.0 s | 2.6 MB, of which 0.45 MB after the first image (the raft buildings) |

- **The goal of about 3 MB holds; the goal of 5 s cannot be judged here.** With no network limit at all, the first image still takes 7.2 s with `?blender` and 7.5 s with the old look: this container draws without a graphics chip (software WebGL), and decoding the textures, compiling the shaders and building the scene take that time. The network now costs about 1 s of the 7.5. A real phone must say what is left.
- **What weighs the most before the first image** (new player): the old models of the seven buildings not remade yet (1.07 MB; each building remade takes its old model off), the island (171 kB), three.js (145 kB), the raft (101 kB), the Lighthouse (98 kB), the Refinery (86 kB), the building site's parts (95 kB), the ground (57 kB), the game's code (59 kB), the fonts (76 kB).

### All nine buildings remade, then the floating village (owner, 20 October)

Same measure (10 Mbit/s, 40 ms, cache off, three runs, median), with `?blender`; "before the first image" leaves out what comes after it (the raft buildings' old models, while the floating village was not made yet):

| City | First image | Before the first image | Without any network limit |
| --- | --- | --- | --- |
| New player | 6.0 s | 1.1 MB | 5.9 s |
| Lighthouse 30 city | 6.4 s | 1.5 MB | 5.7 s |
| Lighthouse 30 city, 39 rafts and six buildings on rafts (the floating village made in Blender) | 7.1 s | 2.0 MB | |
| The same, old look | 10.2 s | 5.4 MB | |

- **About 3 MB: held.** **5 s: not reached here**, and the network is not what is missing: with no limit at all, the first image takes the same 5.7 to 5.9 s. This container draws without a graphics chip; a real phone must say what is left.

**The floating village** (`?blender`), at 412 × 915 (container, quality 2):

| City | Draw calls | Triangles |
| --- | --- | --- |
| 3 rafts, Lighthouse 5 (free slots shown) | 24 | 24.7 k |
| 15 rafts, Lighthouse 15, the shipyard at work | 26 | 39.2 k |
| 39 rafts, Lighthouse 30, six buildings on rafts, two damaged | 27 | 63.7 k |
| The same 39 rafts, old look | 23 | 103.5 k |

- Each model of the village shown is one InstancedMesh: the draw calls grow with the kinds of things afloat (three decks, a damaged one, the shipyard's, the walkways, the buoys, each building at its level), never with the rafts.
- Its files (served: 512 px WebP, quantized), one set for each of its three ages:

| Model | Triangles | File |
| --- | --- | --- |
| A deck (three variants) | 864 to 998 | 76 to 81 kB |
| The damaged deck | 628 to 784 | 61 to 68 kB |
| The shipyard's raft | 908 to 1,012 | 70 to 75 kB |
| A walkway | 168 | 17 to 23 kB |
| The free slot's buoys (one for all ages) | 324 | 35 kB |
| The Kelp Greenhouse, levels 1 to 3 | 364 to 832 | 31 to 66 kB |
| The Smokehouse, levels 1 to 3 | 272 to 540 | 24 to 45 kB |
| The Watchtower, levels 1 to 3 | 322 to 566 | 31 to 52 kB |

**Next:** an entry-level phone must still be measured before players are invited.

### The island's life (meeting 4, owner, 20 October)

With `?blender`: survivors at work and on their ways, animals, plants that follow the Lighthouse, smoke, washing, lanterns that light in the Mist, lapping against the rafts. To make room, the city's water keeps 64 subdivisions at most (96 before) and the rafts show a light version in the normal view (their full models are fetched the first time the camera comes near). Same cities before (12e11a2) and after, each with one building site, at 412 × 915, the life fully loaded; the counter is `?fps`'s (the shadow pass is never in it):

| City | Quality | Before: draw calls, triangles | After: draw calls, triangles |
| --- | --- | --- | --- |
| New player (8 survivors: 5 shown) | full | 19, 29.7 k | 35, 27.2 k |
| New player | 2 | 19, 15.9 k | 35, 23.6 k |
| 15 rafts, Lighthouse 15, 80 survivors | full | 30, 61.7 k | 49, 54.7 k |
| 15 rafts, Lighthouse 15 | 2 | 30, 47.9 k | 50, 51.1 k |
| 39 rafts, Lighthouse 30, 150 survivors (24 shown) | full | 30, 79.7 k | 49, 68.7 k |
| 39 rafts, Lighthouse 30 | 2 | 30, 65.9 k | 50, 65.1 k |

- The life's share in the 39-raft city: the survivors 4.5 k (24 × 188), their tools 0.2 k, the plants 3.9 k (the Modern era's vegetable plots and trees in rows), the animals 1.6 k, the washing 0.1 k; the smoke and the lanterns are points (no triangle). About 10 k in all, 19 draw calls more.
- The light rafts save 3 to 4 hundred triangles each (484 to 664 instead of 628 to 1,012): about 10.5 k for 39 rafts, less than the 17 k foreseen. The water's 64 subdivisions save 10.2 k (quality 2 keeps its 48).
- At full quality the 39-raft city drops from 79.7 k to 68.7 k, between the S22's city (66.7 k) and its sea (73.3 k), both at 60 FPS. At quality 2, the life about makes up for what was saved.
- Frame rate here (no graphics chip, quality 2, 8 s): new player 13.0 → 10.9 FPS, 39 rafts 6.4 → 6.5. The S22 and an entry-level phone must say what is left.

Time to the city's first image (10 Mbit/s, 40 ms, cache off, five runs, median) and what is fetched before it; the life comes after it:

| City | Before: first image, before it | After: first image, before it | All fetched in the first 6 s after, then |
| --- | --- | --- | --- |
| New player | 6.00 s, 1,022 kB | 5.94 s, 1,033 kB | 1,334 → 1,477 kB |
| Lighthouse 30 | 6.42 s, 1,472 kB | 6.60 s, 1,482 kB | 1,566 → 1,694 kB |
| Lighthouse 30, 39 rafts | 7.46 s, 1,931 kB | 6.97 s, 1,889 kB | 2,025 → 2,107 kB |

- The first image waits for nothing more (10 kB: the code). The life's models (the survivor 16.5 kB, its seven tools 26 kB, six animals 57 kB, a look's plants 25 to 40 kB, the washing 6.5 kB) come once the city shows.


### The style pass, step 2 (owner, 20 October)

With `?blender`: one island in three looks (`terrain-wild`, `-garden`, `-modern`: 3,600 triangles, 89 to 92 kB each, in place of the island, 171 kB, and an era's ground, 57 to 174 kB), its groves in one model per look, the buildings 1.15 times larger, the survivors 1.5 times, the mix's light and water, the rafts rebaked, lighter walkways (128 triangles, 168 before) and moorings (96 to 116, 104 to 140 before), the smoke and the lanterns in one cloud of points, and at full quality the finish (a glow around the lamps and a color grade). Same cities before (a99060c) and after, at 412 × 915, quality 0, the life fully loaded; the counter leaves the shadow pass out, as before:

| City | Before: draw calls, triangles | After: draw calls, triangles | After: the finish's own passes |
| --- | --- | --- | --- |
| Lighthouse 5, two building sites (the owner's capture) | 46, 38.5 k | 40, 36.3 k | 14 |
| 3 rafts, Lighthouse 5 | 38, 35.0 k | 33, 32.9 k | 14 |
| 15 rafts, Lighthouse 15, a building site, the shipyard at work | 49, 45.9 k | 43, 46.5 k | 14 |
| 39 rafts, Lighthouse 30, a building site | 50, 68.8 k | 43, 66.0 k | 14 |
| 39 rafts, Lighthouse 30, no building site | 49, 68.7 k (meeting 4) | 38, 64.8 k | 14 |
| The same, quality 2 (no finish) | 50, 65.1 k (meeting 4) | 38, 62.5 k | 0 |

- The worst city stays under the S22's 66.7 k (66.0 k with a site, the animals all out); its draw calls go from 50 to 43 (a building site's scaffolding, mast, arm and crate are four of them).
- The finish draws 14 full-screen passes of its own (the glow at half the screen's size and its five blurs, then the output pass with the grade in it), and no triangle. Its cost, measured apart on the 39-raft city in the container (no graphics chip): 1.35 FPS without it, 0.85 with it. A phone's graphics chip must say the real cost; a phone that falls under 30 FPS drops it with quality step 1.
- The finish starts 4 seconds after the city's first image, once the life has come: drawn from the first frames, it slowed the first image down by 5 seconds in the container.
- The free slots' golden marks: 24 triangles each, in the same draw call as before.

Time to the city's first image (10 Mbit/s, 40 ms, cache off, five runs, median), measured again before and after on the same machine:

| City | Before: first image, before it | After: first image, before it |
| --- | --- | --- |
| New player | 6.40 s, 1,033 kB | 6.48 s, 903 kB |
| Lighthouse 30 | 6.56 s, 1,482 kB | 6.62 s, 1,255 kB |
| Lighthouse 30, 39 rafts | 7.45 s, 1,889 kB | 7.84 s, 1,665 kB |

- 130 to 230 kB fewer before the first image (the terrain in place of the island and its ground); the times are within one run's spread for the new player and the Lighthouse 30, 0.4 s slower for the 39 rafts (its first frames cost more in the container).
- After the first image, a look's groves weigh 245 to 347 kB (25 to 40 kB for the plants before): one model with its own baked texture.

### The style pass's cleanup (owner, 20 October)

Behind `?blender`: labels only where something is to say, lamps out by day, a glow only around lit lamps, four raft decks in calmer wood, free slots shown only when a raft can be moored, the sea 0.2 higher (half-height cliffs, beaches), a fresher, brighter look. Same cities before (f35faa9) and after, 412 × 915 unless noted, the life loaded; the counter leaves the shadow pass out:

| City | Quality 0 before | Quality 0 after | Quality 1 before | Quality 1 after |
| --- | --- | --- | --- | --- |
| Lighthouse 5, two building sites (the owner's) | 40, 36.3 k | 37, 32.2 k | 40, 36.3 k | 37, 32.2 k |
| Lighthouse 5, 3 rafts | 34, 33.0 k | 30, 28.8 k | 34, 33.0 k | 31, 28.9 k |
| Lighthouse 15, 15 rafts, a site, the shipyard at work | 42, 46.4 k | 43, 46.4 k | 42, 46.4 k | 43, 46.4 k |
| Lighthouse 30, 39 rafts, a site | 43, 66.0 k | 43, 65.9 k | 43, 66.0 k | 43, 65.9 k |
| Lighthouse 15 in the Mist | 47, 46.6 k | 48, 46.6 k | 47, 46.6 k | 48, 46.6 k |

- The finish keeps its 14 passes of its own at quality 0. The worst city stays under 66.7 k.
- The free slots nobody can fill now are no longer drawn: about 4 k triangles fewer in the small cities. The fourth deck adds one draw call when it floats.
- The light decks stay within the light budget: 514 to 644 triangles (664 at most before).

Time to the first image (10 Mbit/s, 40 ms, cache off, five runs, median):

| City | Quality 0 before | Quality 0 after | Quality 1 before | Quality 1 after |
| --- | --- | --- | --- | --- |
| New player | 6.19 s, 903 kB | 6.39 s, 903 kB | 2.98 s | 2.93 s |
| Lighthouse 30 | 6.45 s, 1,255 kB | 6.60 s, 1,252 kB | 3.48 s | 3.58 s |
| Lighthouse 30, 39 rafts | 7.18 s, then 7.63 s | 7.96 s, then 7.52 s | 4.11 s | 4.25 s |

- The 39-raft city was measured twice at quality 0: the runs' spread is wider than the gap.

### The first image at full quality (owner, 20 October)

With `?blender`, quality 0 showed the city about 3.5 s later than quality 1. Each step of the load, measured in the container (a new player, 10 Mbit/s):

| Step | Quality 0 | Quality 1 |
| --- | --- | --- |
| The models fetched and read | 6.9 s | 2.4 s |
| The island, its shore and the city made | +0.06 s | +0.05 s |
| "Loading your city…" gone, as the page sees it | 7.6 s | 3.1 s |

- The draw calls took 0.24 s in all while loading, and only 11 frames came in 6 s. The cost was the screen's raster at full quality (pixel ratio 2): in the container the processor draws, so the sea behind "Loading your city…" took it from the models' decoding. It was not the shadows, the shaders or the finish: the finish starts 4 s after the first image.
- Now, until the city shows, that sea is drawn twice a second at most, at one pixel per CSS pixel. The city's first image and everything after it are as before: its step's pixels and shadows, and the finish 4 s later, now fading in over 1 s.

Time to the first image (10 Mbit/s, 40 ms, cache off, five runs, median), before (036efbc) and after:

| City | Quality 0 before | Quality 0 after | Quality 1 before | Quality 1 after |
| --- | --- | --- | --- | --- |
| New player | 6.05 s | 2.85 s | 2.91 s | 2.16 s |
| Lighthouse 30 | 6.39 s | 3.38 s | 3.50 s | 2.50 s |
| Lighthouse 30, 39 rafts | 7.07 s | 3.95 s | 4.09 s | 3.17 s |

- All under 5 s. Quality 0 still trails quality 1 by 0.7 to 0.9 s here: its first image itself (4 times the pixels, 2048 shadows) takes the processor that long in the container.

### The land won on the sea, step 2 (owner, 21 October)

With `?blender` from the Lighthouse 5, the rafts are land: one mesh built in the game from the slots taken (`client/src/city/land/`), its dike in instances, a flooded plot, a landfill. Draw calls and triangles read on the `?fps` counter, the life loaded, quality 1 (quality 0 gives the same at 384 × 699; at 412 × 915 its counter had not drawn enough frames in the container to count the life):

| City | Draw calls, triangles | Land built in (container) |
| --- | --- | --- |
| Lighthouse 4, 3 rafts (no land yet) | 28, 30.7 k | – |
| Lighthouse 5, 3 plots | 29, 34.6 k | 97 to 102 ms |
| Lighthouse 15, 15 plots (one flooded), a landfill | 39, 51.3 k | 131 to 141 ms |
| Lighthouse 30, 38 plots (one flooded), a landfill | 40, 54.5 k | 146 to 154 ms |

- The worst city goes from 43 draw calls and 65.9 k triangles (the floating village) to 40 and 54.5 k: the decks, walkways and moorings are gone, the land itself is one mesh of about 10 k triangles at most (tested on 200 random cities) and its dike two to four instanced meshes.
- "Land built in" is the whole rebuild: the mesh (13 to 17 ms in Node on this machine, whatever the slots), the dike and its props, and the shore's distances for the water's foam. It happens once at load and again only when a slot or the era changes. The container has no graphics chip and a shared processor; the S22 must say the real figure.

Time to the first image (10 Mbit/s, 40 ms, cache off, five runs, median), before (33a13c5) and after:

| City | Quality 0 before | Quality 0 after | Quality 1 before | Quality 1 after | Downloaded before → after |
| --- | --- | --- | --- | --- | --- |
| New player | 3.12 s | 3.09 s | 2.28 s | 2.30 s | 1,641 → 1,649 kB |
| Lighthouse 30 | 3.42 s | 4.05 s | 2.64 s | 3.05 s | 1,682 → 1,817 kB |
| Lighthouse 30, 39 rafts | 4.56 s, then 5.24 s | 5.80 s, then 5.05 s and 5.22 s | 3.88 s | 3.94 s | 2,173 → 1,964 kB |

- The 39-raft city was measured three times at quality 0: one run in five reached 7.7 to 8.2 s in two series, and the medians fall within each other's spread.
- The Lighthouse 30 without rafts is 0.4 to 0.6 s slower: it fetches the land's texture (126 kB) on top of the island's, which the land hides. Dropping the island's texture once the land is the default (plan step B) saves its 86 to 92 kB again.
- The 39-raft city downloads 209 kB fewer: the raft decks, walkways and moorings are no longer fetched.

### The land built away from the display (owner, 21 October, on the S22)

On the S22, "Land built in 122.7 ms": the land's rebuild held the display about 7 frames at each mooring, flood or repair. Now its mesh, the ground under its props and plants, its landfill's stakes and the shore's grid and foam are computed in a worker (`client/src/city/land/land.worker.ts`, 12.9 kB, no three.js); the old land stays shown until the new one is ready, then it is put in place in one frame. The shore's foam around the moored rafts is measured there too (it was measured on the display's thread at every mooring). The first land, before the city's first image, is still built at once: no frame is shown yet.

Measured in Chromium on `?demo=phare30&cycle` (a plot flooded and mended every 4 s), 10 rebuilds:

| On the display's thread | Before | After |
| --- | --- | --- |
| The land's rebuild | 134 to 270 ms (all of it) | 0.8 to 2.4 ms (putting the new land in place) |
| The city's whole refresh at that moment (the land, the buildings, the rafts, the life, the labels) | – | 2.2 to 6.1 ms |
| In the worker, beside the display | – | 22 to 57 ms |

- The container draws without a graphics chip (a frame takes 80 to 170 ms here whatever happens), so it cannot show the frame itself; the S22 with `?demo=phare30&cycle&fps` reads it on the "Longest frame" line, which should stay near 16.7 ms.


### The city fabric (owner, 21 October)

The houses, equipment, camp, streets, fields, lamps, poles, turbines and port of `client/src/city/fabric/`: three meshes at most (the still pieces, their windows, the turbines' rotors), the streets, yards, square and fields painted by the ground's own shader (one read of a 16 × 16 texture for the fields, however many plots are won). The land's dike now joins its props' mesh. Read on the `?fps` counter at 384 × 699, quality 1, the life loaded, before (7520da7) and after:

| City | Before: draw calls, triangles | After: draw calls, triangles |
| --- | --- | --- |
| Lighthouse 4, 3 rafts (no land yet) | 28, 30.7 k | 30, 30.1 k |
| Lighthouse 5, 3 plots | 29, 34.6 k | 27, 33.0 k |
| Lighthouse 15, 15 plots (one flooded), a landfill | 39, 51.3 k | 38, 49.0 k |
| Lighthouse 30, 38 plots (one flooded), a landfill | 40, 54.5 k | 40, 54.0 k |
| `?demo=phare30` | 45, 55.9 k | 44, 54.8 k |

- The fabric adds two draw calls (three with the turbines, from the Lighthouse 20); the dike merged into the props saves two to three. Its triangles, 9.0 k at most in the worst city of each era (`client/test/fabric.test.ts`), are about what the wild plants it replaces on the plots it takes weighed.
- Planning and merging the fabric, once at each change of the city (a level, a plot): 1.5 to 3.6 ms and 2.2 to 5.4 ms in Node on this machine. The Harbor's coast it needs is found in fewer steps (about 80 ms less when the game starts).
- On `?demo=phare30`, "shown in" (the land put in place with the fabric and the plants giving way) goes from 9 to 18 ms in the container: the S22 must say the real figure with `?demo=phare30&cycle&fps`.

Time to the first image (10 Mbit/s, 40 ms, cache off, five runs, median; quality 0 measured twice each way, in turn):

| City | Quality 0 before | Quality 0 after | Quality 1 before | Quality 1 after | Downloaded before → after |
| --- | --- | --- | --- | --- | --- |
| New player | 3.23 s, 3.13 s | 3.39 s, 3.39 s | 2.52 s | 2.54 s | 1,643 → 1,671 kB |
| Lighthouse 30 | 4.06 s, 3.84 s | 4.46 s, 4.40 s | 3.20 s | 3.46 s | 1,810 → 1,864 kB |
| Lighthouse 30, 39 plots | 4.62 s, 5.10 s | 5.27 s, 5.34 s | 4.44 s | 4.46 s | 1,957 → 2,013 kB |

- The era's fabric file is 20 to 39 kB. At quality 1 the first image hardly moves; at quality 0 it comes 0.2 to 0.45 s later in the container, which draws without a graphics chip at twice the pixels (the ground's shader and the fabric's three new programs). The S22 must say whether a phone feels it.
