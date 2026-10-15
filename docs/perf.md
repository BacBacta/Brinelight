# Performance on a phone

Goal of week 2 (task 6): **30 FPS or more on the low-end Android test phone**, in the city and at sea.

## Tools in the game

- `?fps` in the URL shows a small counter in the top right corner, refreshed every second:
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
| | | City | | | | |
| | | Sea | | | | |

The container rows only show the order of the costs: going from step 0 to step 2 roughly quadruples the frame rate in the city. A real phone with a graphics chip will be much faster. Only the phone rows decide whether the goal is met.

## If a phone stays under 30 FPS

From the simplest to the heaviest:

1. **Start mobiles at step 1** (pixel ratio 1) instead of 0. One line, and the biggest gain on high-density screens.
2. **Smaller shadow map**: 1024 instead of 2048, or no soft shadows (`PCFShadowMap`).
3. **Pixel ratio 1.5** at most instead of 2, as a middle step between 0 and 1.
4. **Lighter water**: the wave plane has 140 × 140 segments; 64 × 64 looks the same from the usual camera distance.
5. **Fewer draw calls**: merge the island tiles and repeated models into one mesh (`BufferGeometryUtils.mergeGeometries`) or use instancing. The city draws about 80 calls, the sea about 140.
6. **Labels drawn in the 3D view** (sprites or a canvas) instead of HTML elements moved on every frame.
7. **A 30 FPS cap** on weak phones: draw one frame in two. It is steadier, and it saves battery and heat.

## Build size

three.js now has its own file (`manualChunks` in `client/vite.config.ts`): **568 kB** minified, **146 kB** gzipped. The game's own code is 50 kB (20 kB gzipped). Because three.js changes rarely, browsers keep it in cache across game updates.

Vite still warns that one file is over 500 kB. That file is three.js alone, which the game needs from the first second, so loading it later would not help. The warning limit is left as it is: it applies to every file, and raising it would also hide a real growth of the game's own code.
