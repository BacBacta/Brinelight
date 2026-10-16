# Performance on a phone

Goal of week 2 (task 6): **30 FPS or more on the low-end Android test phone**, in the city and at sea.

## Tools in the game

- `?fps` in the URL shows a small counter in the bottom left corner, just above the bottom menu, refreshed every second:
  - FPS: the average over the last second;
  - min: the lowest one-second rate of the last 10 seconds;
  - the quality step (`0`, `1` or `2`), `auto` or `forced`;
  - the view (City or Sea);
  - the draw calls and triangles of the last frame (`renderer.info`).
- The minimum ignores the 5 seconds after the 3D models load, and starts over after a change of view or a return to the tab.
- `?quality=0`, `?quality=1` or `?quality=2` forces a quality step, to compare steps on the same phone. The automatic tuning is then off.
  - `0`: full quality.
  - `1`: pixel ratio 1.
  - `2`: pixel ratio 1 and no shadows.
- Without `?quality`, the game starts at step 0 and lowers the step by itself when it stays under 30 FPS for 3 seconds, as the prototype did.
- Both can be combined: `?fps&quality=1`.

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

## Rafts (week 4, task 6)

Up to 39 rafts can sit around the island. Each part (deck, planks, free slots, their rings, the tap shapes) is one `InstancedMesh`, so rafts add about 5 draw calls whatever their number, plus one scaffolding model while the shipyard works (`client/test/rafts.test.ts` checks it with 39 rafts). Their bobbing moves the instances, without creating objects.

To check on a phone, with `?fps`: a city with the Lighthouse at level 10 and its 39 rafts, in the city view, against the same city without rafts. The container has no graphics chip, so this measure is to be made on the phone.

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
