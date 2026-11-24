# Hold the Light · the backlog

Where the build of the portal edition stands. The loop (`docs/design/hold-the-light-loop.md`) reads this file first and ticks one task an iteration. The design and the reasons behind each step: `docs/design/hold-the-light.md`.

Under a task, the loop writes **Does / Does not / Tested by** before building it, then the date and what it measured when done. Under a gate, only the owner writes the result.

## Step 0 · The portal build

- [x] **0.1** Move the Lighthouse kit the scene still loads from `client/public/prototype/assets/phare.glb` to `client/public/models/`, and load it from there. The main game looks the same (its look references unchanged).
  - Does: a copy of the kit at `client/public/models/phare.glb` (the prototype is never modified, `CLAUDE.md`), and the scene loads that copy (`kitUrl`, `client/src/scene/models.ts`).
  - Does not: remove or shrink the kit; leave the prototype's copy out of a build (task 0.3).
  - Tested by: `client/test/models.test.ts`: the kit's address is under `models/`, its file is byte for byte the prototype's, and no source of the client loads anything from `prototype/assets/`.
  - Done 24 November: `npm run check` green (1,263 tests), `npm run e2e` 40 of 40 (with `E2E_CHROMIUM`). The kit (2.9 MB) still loads on your first visit at sea, now from `/models/`; the e2e that counts the sea's models counts it.
- [x] **0.2** The portal's entry: `client/portal.html` and `client/src/portal.ts`. It opens the city with no account, no server address and no import from `client/src/account/`. Its own save key, `brinelight-portal-v1`.
  - Does: one entry, two builds. `client/src/main.ts` reads `VITE_PORTAL`, set by the Vite mode `portal` (as the demos read `VITE_BRANCH_PREVIEW`): in the portal build it makes no account, reads no server address, shows no demo and no `?rules`, and the Power card opens a Settings sheet with the sounds only (`client/src/ui/settings.ts`). Everything it keeps on the device goes under `brinelight-portal-v1/` (`client/src/portal/store.ts`), so the portal and the Brinelight on Solana never read each other's city, even served from the same address. In the main build nothing changes.
  - Does not: the build command and its output folder (task 0.3); remove Alliance and Shop (step 2, when the portal opens in the Night). No `portal.html`: one page, the build decides.
  - Tested by: `client/test/portal.test.ts` (the store's prefix, both ways; the Settings sheet's text); a portal-mode build checked by hand for the account's words until task 0.5's test; `npm run e2e` for the main build.
  - Done 24 November: `npm run check` green (1,267 tests), `npm run e2e` 40 of 40. Portal-mode build by hand: none of "wallet", "Phantom", "Solana", "proof", "notary", "/auth/" in its code (main script 280.9 kB, 99.4 kB gzipped, against 288.5 kB); the main build holds no portal code. In a browser: `?rules` and `?demo` ignored, Settings with the sounds, the three keys written all under `brinelight-portal-v1/`, no console error.
- [x] **0.3** `npm run build:portal`: Vite in a `portal` mode, base `./`, output `client/dist-portal/`, without the `prototype/` folder. Added to `npm run check`.
  - Does: `npm run build:portal` (`vite build --mode portal`): base `./`, so every address is relative (all of the game's go through `BASE_URL`); output `client/dist-portal/` (ignored by git); the `prototype/` folder removed from it once Vite has copied the public files; the page's title "Brinelight: Hold the Light". Run by `npm run check` after the game's own build.
  - Does not: check the files it makes (task 0.5); serve it on a preview (task 0.4).
  - Tested by: `client/test/portalBuild.test.ts`: the config in each mode (base, output folder); the title put in the page; the folder removal (only `prototype/`, nothing outside the output folder).
  - Done 24 November: 15 MB, 278 files; served from `/some/folder/`, no console error and no request outside it. `npm run check` green (1,271 tests). e2e at the end of the step.
- [x] **0.4** On a branch preview only (the `CF_PAGES_BRANCH` condition the demos use), the main build also serves the portal build at `/portal/`, so testers can play it. Never in the production build: a test builds as Cloudflare does for `main` and checks it.
  - Does: when Cloudflare builds a branch other than `main` (`previewBuild`), the game's own build ends by building the portal into `dist/portal/` (`client/vite.config.ts`); Cloudflare's command stays `npm run build`. Tested by: `client/test/portalPreview.test.ts`, a build as Cloudflare does for a branch (the portal at `portal/`, relative, no prototype in it, the game's own prototype kept) and for `main` (no `portal/`).
  - Done 24 November: `npm run check` green (1,273 tests); the branch's build takes about 6 s, `main`'s 2.4 s. e2e at the end of the step.
- [x] **0.5** A test of the portal's files: no absolute path, none of "wallet", "Solana", "Phantom", "USDC" or a server address, under 20 MB, under 1,500 files. An e2e opens it from a sub-folder (`/some/folder/`) with no error in the console.
  - Does: `client/test/portalFiles.test.ts` (in `npm run check`): under 1,500 files and 20 MB, no `prototype/`, only relative addresses in the page and the code, none of the wallet's, Solana's or a server's words in the code and the page, no web address but the two three.js carries as text; `e2e/portal.e2e.ts`: the portal served from `/games/brinelight-hold-the-light/` opens the city with no error, fetches nothing outside its folder, opens Settings and keeps everything under `brinelight-portal-v1/`. The page now has an empty icon (`data:,`): without one the browser asked for `/favicon.ico` at the root, outside the folder (a 404 in both builds).
  - Does not: check the style sheet's class names for the words (the shared sheet keeps the Profile's `.wallet`, never shown; renaming it would touch the wallet's sign-in, a protected area).
  - Done 24 November: `npm run check` green (1,276 tests); e2e at the end of the step.

## Step 1 · A Night in the rules

- [x] **1.1** The seeded generator, `shared/src/rules/night/random.ts`: a state you carry, never a global. Tests: the same seed gives the same sequence; draws spread evenly over 100,000 values; a choice of 3 among N gives 3 different items.
  - Done 24 November: mulberry32 (`nextFloat`, `nextInt`, `pickDistinct`), its state a number carried by the caller; its first three values for the seed 1 are pinned to the algorithm's own, so a Night replayed from its seed always draws the same. 7 tests; the purity test covers `night/`.
- [x] **1.2** `values.ts` and the Night's types: its state (seed, step, oil, wave, enemies, beam), its inputs (the beam's angle), a strict `parseNight`. Tests: a valid state passes, each wrong field is refused.
  - Done 24 November: `values.ts` (a step of 1/30 s; sea 30 units, coast 6; oil 100; beam 40° and 60 a second; the Raider: speed 3, health 30, oil 5 — starting values, none is balance), `state.ts` (`newNight`, `parseNight`: exact fields, each in its range, unique enemy ids below `nextId`; shape 1). 7 tests.
- [x] **1.3** Enemies: each comes on its bearing from the edge of the sea at its speed; on the coast it steals its oil and is gone. Tests: an enemy's step count to the coast; the oil after it lands; the oil never below 0.
  - Done 24 November: `step.ts`, `stepNight(night, { beam })`: the beam turned to any angle brought into [0, 360) (a wrong one leaves it), each enemy brought in by its speed, one on the coast removed and its oil stolen, the Night lost at 0 oil and frozen once over. 6 tests.
- [x] **1.4** The beam: angle, width, damage a second. Tests: an enemy in the beam dies in the steps its health says; on the beam's edge it is in; just outside it is not; the angle wraps at 360°.
  - Done 24 November: `inBeam` (the shortest way round, the edge in); the beam burns before the enemies move, so what it lights in a step never lands in it. A Raider in the beam: 15 steps (half a second). 5 tests.
- [x] **1.5** Waves from the seed: each wave's enemies and when they come, the pause between waves, the Night won after its last wave, lost when the oil reaches 0, and its loot either way. Tests: the same seed and inputs give the same state hash after 10,000 steps; feeding 1/15 s of time gives the same state as two feeds of 1/30 s; a Night with no input is lost at a known step; Night 1 cannot be lost before wave 3.
  - Done 24 November: `stepNight` sends each wave's Raiders from the edge, one every 1.5 s at a bearing drawn from the seed; a wave ends when all are sent and none is left, then 6 s of pause; the Night is won after its last wave and lost at 0 oil; Night 1's first 2 waves leave a drop of oil. `clock.ts`: `feedTime` turns a frame's time into whole steps (8 at most). `loot.ts`: 40 wood and 30 fish a wave cleared, 2 wood a Raider burned, 10 Pearls if won, 60 wood at least. The state counts what the beam burned (`burned`). 16 tests.
  - Measured (seed 5): a player who aims at the nearest enemy at once wins Nights 1 to 5 in 1.3, 3.2, 4.3, 5.5 and 7.8 minutes **without losing any oil**; a beam left at 0° loses Night 1 at wave 4 (76 s) and Nights 2 to 5 at waves 3 to 2 (about a minute). To tune with the simulator (1.6) and at gate A: Night 1 is shorter than the design's 3 minutes, and a perfect aim meets no threat until the families and the posts (step 3).
- [x] **1.6** `tools/night/`: a simulator with two bots, one that never moves the beam and one that always aims at the nearest enemy. `npm run night` prints each bot's wave reached and loot on Nights 1 to 5. Its numbers go in this file.
  - Done 24 November: `tools/night/` (`simulate.ts`, `run.ts`, a test); the Night exported from the shared rules as `night`, apart from the Brinelight on Solana's names. `npm run night`, 20 seeds:

    | Night | Bot | Won | Wave reached (median) | Minutes (median) | Oil left | Wood | Fish |
    | --- | --- | --- | --- | --- | --- | --- | --- |
    | 1 | still beam | 0/20 | 4 | 1.3 | 0 | 126 | 90 |
    | 1 | aims at the nearest | 20/20 | 5 | 1.3 | 100 | 280 | 150 |
    | 2 | still beam | 0/20 | 3 | 1.1 | 0 | 84 | 60 |
    | 2 | aims at the nearest | 20/20 | 8 | 3.2 | 100 | 528 | 240 |
    | 3 | still beam | 0/20 | 3 | 1.1 | 0 | 86 | 60 |
    | 3 | aims at the nearest | 20/20 | 9 | 4.3 | 100 | 648 | 270 |
    | 4 | still beam | 0/20 | 2 | 0.9 | 0 | 60 | 30 |
    | 4 | aims at the nearest | 20/20 | 10 | 5.5 | 100 | 780 | 300 |
    | 5 | still beam | 0/20 | 2 | 0.9 | 0 | 60 | 30 |
    | 5 | aims at the nearest | 20/20 | 12 | 7.8 | 100 | 1032 | 360 |

    What it says: doing nothing always loses, within about a minute; a perfect aim never loses oil. The space between is the player's hand, which the bots do not have: measured at gate A, where the beam must feel worth holding.

## Step 2 · A Night you can play, in plain shapes

- [x] **2.1** `client/src/night/`: the island as it is, enemies as plain shapes (one `InstancedMesh` per family), the beam as a cone of light on the water.
  - Done 24 November: `client/src/night/` (`view.ts`, pure and tested: the rules' coast on the island's, the edge of the sea at 12 world units; `index.ts`: the Night run by the frames' time through `feedTime`, the Raiders as dark red blocks in one `InstancedMesh`, the beam as a wedge of light, the city's panels hidden). The scene's `setReach` keeps the edge of the sea in the normal view. The portal starts Night 1 as its city loads, with a seed from the browser. Captured at 907 × 510 and 384 × 699: no console error. The main build's code holds none of it (only its few CSS lines, under `body.night`). Display values to judge at gate A: the sea's edge at 12, the camera's angle.
- [x] **2.2** The hand: the beam follows the pointer and the finger; the arrow keys and A/D turn it; the fixed-step accumulator (at most 8 steps a frame); the Night pauses when the page is hidden.
  - Done 24 November: the beam follows the mouse, and the finger held on the water (`pointerBearing`, the water under the pointer); ← → or A D by their place on the keyboard (Q D on AZERTY) turn it at 180° a second (`turnBy`); the camera locked during the Night (the scene's `lockCamera`), and the city's taps held back; a hidden page runs no time and forgets the keys held. 2 tests; checked in a browser (the mouse east, then ← held).
- [x] **2.3** The screen: the oil's gauge, the wave's number, the end screen ("The Lighthouse went dark" or "Dawn", the loot, "Again"). The portal opens in Night 1 at once: no menu, no title screen.
  - Done 24 November: `client/src/night/hud.ts` (the oil's gauge, "Wave 2 of 5" and "Next wave in 4 s"; the end card "The Lighthouse went dark" or "Dawn", the waves held, what you bring back, and Again, focused for the keyboard); Again starts the same Night from a new seed. 5 tests on the text. Played in a browser: Night 1 left alone ends at wave 4 after about 80 s; Again brings back the full oil and wave 1. Seen at gate A: in portrait the island is small behind the end card.
- [x] **2.4** e2e: the Night starts within 10 s of the page; the beam follows the pointer; a Night left alone ends on the end screen; "Again" starts a new one. Measured: FPS with 150 enemies at 384 × 699 and 907 × 510 (in the container; the S22 at the gate).
  - Done 24 November: `e2e/portal.e2e.ts` (`npm run e2e:portal`, 3 tests, 110 s): the Night's panel within 10 s of the page, no error, nothing fetched outside the folder; the beam east under the mouse at the right of the screen, west at the left, and turned by →; Night 1 left alone ends on its card (about 90 s here), and Again brings back wave 1 and full oil. The canvas carries the beam's bearing (`data-beam`) for the tests. Measured in the container (no GPU): 7 FPS at 907 × 510 during a Night, as the city itself; the Raiders are one draw call whatever their number. 150 enemies at once are not reached by Nights 1 to 5 (12 at most on the sea): the FPS with many is measured on the S22 with `?fps` when step 3 brings more.

## Step 4 · The city between the Nights (before step 3: owner, 24 November)

- [x] **4.1** The portal city's state in the rules: buildings and their levels, the stock, the Nights won; a strict parse with a version.
  - Done 24 November: `city.ts` (`newCity`, `nextNight`, `parseCity`, shape 1): three buildings for now, the Lighthouse and the Refinery from level 1 and the Infirmary from 0 (to be built), 10 levels at most; the store holds wood, fish and Pearls; the highest Night won and the Nights played (never fewer). 5 tests.
- [x] **4.2** The loot at dawn added to the stock; an upgrade at once, its cost from `values.ts`, refused with its reason when the stock is short. Tests.
  - Done 24 November: `upgrade.ts` (`dawn`, `upgradeCost`, `upgradeCity`): the loot into the store, a Night won opens the next; an upgrade paid and done at once; refused with "You need 80 more wood and 60 more fish.", "Upgrade the Lighthouse first." (no building above the Lighthouse) or "Your Lighthouse is at its highest level.". Starting costs: Lighthouse 1→2 80 wood and 60 fish (the poorest lost Night 1 pays it), Refinery 60 and 20, Infirmary built for 120 and 80, each level ×1.6. 8 tests.
- [x] **4.3** The effects that exist without step 3, read by the Night's rules when a Night starts: the Lighthouse (the beam's damage), the Refinery (the oil a Night starts with), the Infirmary (one second chance a Night). One test each. The Barracks, the Harbor and the Observatory get theirs in step 3 (task 3.9), with the posts and the cards; the Fishery, the Lumberyard and the Shelters in step 5 (what the city makes while you are away).
  - Done 24 November: `powers.ts` (`cityPowers`): the Lighthouse's beam 15 % stronger a level above 1, the Refinery's 15 more oil a level, the Infirmary's second chance (once a Night, the Lighthouse lights again with 30 % of its oil, 5 % more a level). The Night carries its powers and whether its second chance is spent (read back and refused out of range); the oil's gauge measures against this Night's own oil. 6 tests.
- [x] **4.4** The save on the device: written after each Night and each upgrade; old versions migrated; a bad save set aside and a new city started. Tests, and an e2e with a save edited by hand.
  - Done 24 November: `client/src/portal/save.ts` (`saveCity`, `openCity`): the city under `brinelight-portal-v1/hold-the-light-city`, in a file with its own version; a save the rules refuse (edited, broken, unknown version) set aside untouched under `…-rejected` and a new city begun; a blocked or full storage never stops the game. 5 tests. Written after each Night and upgrade once the Day is on screen (4.5); its e2e with a save edited by hand in 4.9.
- [x] **4.5** The Day on screen: the city view the game has, a building's sheet with its effect on the Night and "Upgrade", the "Next Night" button always in sight.
  - Done 24 November: `client/src/night/portal.ts` chains Night, dawn and Day: a new player starts in Night 1 at once, a player back finds their city; a Night's loot goes home and is saved the moment it ends; the end card leads "To your city" (Again is gone). `day.ts`: the store (wood, fish, Pearls), each building with what it does for the Night now and next ("Beam: 60 → 69 a second"), its cost, Upgrade or Build, or the rules' reason in red; "Start Night N" always in sight. The island shows the city's levels (its Lighthouse changes look). Taps on the 3D view are the beam's by Night and open none of the Brinelight on Solana's sheets by Day; a Night's frame callback is stopped when it ends (`onFrame` now gives a way to stop it). 4 tests on the Day's text; the portal's third e2e plays the loop (a Night lost, its loot, the Lighthouse upgraded, a reload, the next Night): `npm run e2e:portal` 3 of 3. Played by hand: Night 1 lost brought 128 wood and 90 fish; the Lighthouse 1→2 paid; 48 wood and 30 fish left.
- [x] **4.6** The first minutes' guide: the quest card points at what to tap next (the building, the Night), and moves the camera there when tapped.
  - Done 24 November: in the first 3 Days, one line at the top of the Day and a glow on its button: an upgrade you can pay (the Lighthouse first, "Upgrade the Lighthouse: your beam burns harder.", else the cheapest), or "Start the next Night to bring back more." (`dayGuide`, 4 tests; still with reduced motion, as an outline). Night 1's own line (task A.1) guides the first Night. Not done: moving the camera to the building, since the Day's panel, not the 3D view, is where you act in the portal.
- [x] **4.7** Nights 1 to 5 as the design's starting values say, played by the simulator's bots; their numbers in this file.
  - Done 24 November: `npm run night` gains a bot that turns toward the nearest boat at 180° a second (a hand on the keys) and a campaign: a new city, Night after Night, its loot spent as the guide says, until Night 5 is won. With the values of step 1, even that bot won every Night at once without losing oil: nothing to tune, nothing to spend for. **Starting values changed:** the Raider has 60 health (1 s in the beam, was 0.5 s) and speed 4 (6 s from the edge, was 8 s); Raiders come 1 at a time in Nights 1 and 2, 2 in Nights 3 and 4, 3 in Night 5, each at its own bearing (`SPAWN_BURST`). Tests that had the old values written in now read them.

    Each Night with a new city's powers, 20 seeds:

    | Night | Bot | Won | Wave reached (median) | Minutes (median) | Oil left | Wood | Fish |
    | --- | --- | --- | --- | --- | --- | --- | --- |
    | 1 | still beam | 0/20 | 4 | 1.1 | 0 | 124 | 90 |
    | 1 | turns at 180°/s | 20/20 | 5 | 1.4 | 100 | 280 | 150 |
    | 1 | aims at the nearest | 20/20 | 5 | 1.4 | 100 | 280 | 150 |
    | 2 | still beam | 0/20 | 3 | 1.0 | 0 | 84 | 60 |
    | 2 | turns at 180°/s | 20/20 | 8 | 3.3 | 100 | 528 | 240 |
    | 2 | aims at the nearest | 20/20 | 8 | 3.2 | 100 | 528 | 240 |
    | 3 | still beam | 0/20 | 3 | 0.7 | 0 | 86 | 60 |
    | 3 | turns at 180°/s | 19/20 | 9 | 3.1 | 40 | 624 | 270 |
    | 3 | aims at the nearest | 20/20 | 9 | 2.9 | 100 | 648 | 270 |
    | 4 | still beam | 0/20 | 2 | 0.5 | 0 | 60 | 30 |
    | 4 | turns at 180°/s | 13/20 | 10 | 3.9 | 5 | 742 | 300 |
    | 4 | aims at the nearest | 20/20 | 10 | 3.6 | 100 | 780 | 300 |
    | 5 | still beam | 0/20 | 2 | 0.5 | 0 | 60 | 30 |
    | 5 | turns at 180°/s | 0/20 | 6 | 1.7 | 0 | 354 | 150 |
    | 5 | aims at the nearest | 20/20 | 12 | 4.1 | 65 | 1018 | 360 |

    A new city, Night after Night:

    | Bot | Night 5 won | Tries for Nights 1 to 5 (median) | Minutes (median) | Lighthouse · Refinery · Infirmary at the end |
    | --- | --- | --- | --- | --- |
    | turns at 180°/s | 20/20 | 1 · 1 · 1 · 1 · 1 | 15 | 5 · 5 · 4 |
    | aims at the nearest | 20/20 | 1 · 1 · 1 · 1 · 1 | 14 | 5 · 5 · 4 |

    What it says: with a new city's beam, the hand-speed bot loses Night 5 every time and Night 4 one time in three; the city it grows (Lighthouse 5, Refinery 5, Infirmary 4) wins them at the first try. A player's hand is slower and less steady than the bot's: they will lose some Nights, and the city is what wins them back. To judge at gate A.
- [x] **4.8** `?measure`: the game counts, on the device only, each session's length, the Nights started and reached, and the time to the first card; a hidden page shows them for the tester to read out. Nothing is sent.
  - Done 24 November: `client/src/portal/measure.ts`: each session's length, the time before the beam first moved, and each Night's end (its number, the wave, won or lost), kept under `brinelight-portal-v1/hold-the-light-measure` (the last 20 sessions), saved every 15 s, when the page is hidden and at each Night's end; with `?measure` a panel over the game lists them, a line a session, for the tester to read out. Nothing is sent. Not counted yet: the time to the first card (the cards come with step 3). 3 tests.
- [x] **4.9** e2e: Night, dawn, upgrade, Night again; reload keeps the city.
  - Done 24 November: `npm run e2e:portal`, 5 of 5 (112 s): a Night lost, its loot in the city, the Lighthouse upgraded, a reload that keeps it, the next Night; a save edited by hand set aside (a new city, Night 1, the toast, the copy kept); `?measure` listing the sessions. `npm run check` green (1,370 tests).
- [x] **Gate A · Is the loop fun?** Moved after step 4 (owner, 24 November): five people who never saw the game play a Night, spend its loot in the city, and play again, with nothing explained. Passed if four of five start a second Night on their own and none asks what to do.
  - Packet (24 November, for step 4's build):
    - **Where:** https://ccr-9319aa6a-txz4sk.brinelight.pages.dev/portal/ (the branch's preview; it follows every push, a minute or two after). On a phone or a computer, in a browser, full screen if you can. Each tester on a device that never opened it, or in a private window (the city is kept on the device).
    - **What to tell the testers:** nothing. Hand them the phone or the mouse, say only "try this", and do not answer questions while they play (note them). Let them play as long as they like.
    - **What they meet:** Night 1 at once, with one line saying what to do; the oil's gauge and the wood and fish they earn; at the end, what they bring back and "To your city"; the city's panel (the Lighthouse, the Refinery, the Infirmary: what each does for the Night, its cost, Upgrade), with a glowing hint the first Days; "Start Night N". Nights 1 to 5, harder each; a lost Night is played again, stronger.
    - **What to watch, for each tester:** how long before they move the beam; whether they understand the oil; whether they upgrade something in the city without being told; whether they start the next Night on their own; how many Nights they play; every question; what they say at the end.
    - **What the game counts for you:** after each tester, open the same address with `?measure` at the end (`…/portal/?measure`): each session's length, when the beam first moved, and each Night's end. Nothing is sent.
    - **Passed if:** four of five start a second Night on their own, and none asks what to do.
    - **Known, not to explain:** plain shapes (red blocks for the boats, a wedge of light); no sound in the Night yet; one kind of enemy; in portrait the island is small.
    - **On the S22:** open it once with `?fps` (`…/portal/?fps`) and note the FPS line during a wave of Night 3 or later.
    - **Write here:** passed or not passed, the five testers' notes in a line each (with their `?measure` line), and what to rework if not passed.
  - Owner's first note (24 November, before the test with five players): "no explanation of the resources, you do not even see them; you only see what you won at the end".
  - [x] **A.1** What you earn and what to do, during the Night: the wood and fish earned so far beside their icons under the oil's gauge, flashing as they rise (`lootSoFar` in the rules, tested); the gauge with the oil's icon and its name for screen readers and on hover ("Oil: the Lighthouse's life"); in Night 1, until the first boat burns, one line at the bottom: "Turn the light onto the boats. Boats that land steal oil." 4 tests. Captured at 384 × 699 and 907 × 510. Not done: what the loot is for. It is spent in the city between the Nights (step 4); until then it only adds up.
  - Result (owner): **skipped** (24 November): "Saute la porte A, enchaîne sur l'étape 3." Not tested with players; the risk accepted is to learn at gate B, after step 3, whether the beam and the loop hold.

## Step 3 · Depth

- [x] **3.1** The three families (Raiders, Beasts, Wraiths) in the rules, with their speed, health, oil stolen and behavior (a Wraith fades out of the beam). Tests for each.
  - Done 24 November: Raiders (speed 4, health 60, 5 oil), Beasts (speed 2, health 240, 20 oil), Wraiths (speed 3, health 90, 10 oil; lit 0.6 s without a break, they fade for 1.5 s: the beam goes through them and they come on). Night 1 sends Raiders only, Nights 2 and 3 one Beast in five, Nights 4 and 5 one Beast and one Wraith in five (`NIGHT_MIX`, drawn from the seed). The Night's shape is 2 (each enemy counts its time lit and its fading). 8 tests. The screen still draws every family as a Raider's block until task 3.8.
  - Measured (`npm run night`, 20 seeds): with a new city's powers, even a perfect aim loses Nights 3 to 5; the hand-speed bot's campaign wins Nights 1 to 3 at once, Night 4 in 5 tries and Night 5 in 9 (65 minutes, Lighthouse 7, Refinery 7, Infirmary 5 at the end). Hard; the posts and the cards (3.2 to 3.5) make the player stronger, and the curve is measured again then.
- [x] **3.2** Posts: a troop on a raft fires on its own at its range; the triangle on the families (`COUNTER_BONUS` 1.2, read from the existing rules, never changed). Tests.
  - Done 24 November: two posts for every city (`POSTS_BASE`; the Harbor adds in 3.9), at 45° and 225°; a troop put on a post by an input (`post: { slot, troop }`), any time; each post fires on its own at the enemy nearest the coast within 16 units and 60° of it, 20 a second, ×1.2 (`COUNTER_BONUS`, read from `combat.ts`) on the family its troop beats: crossbowmen on Raiders, harpooners on Beasts, boarders on Wraiths. The posts hit a faded Wraith the beam goes through. The Night's shape is 3. 7 tests. The bots place no troop yet: the curve is measured again with the cards.
- [x] **3.3** The cards' engine: three different cards drawn from the seed after each wave, one chosen, its effect held for the rest of the Night. Tests: the draw, the choice refused if not offered, an effect stacking as its card says.
- [x] **3.4** The first 8 cards (beam, posts, oil, captains: two of each), one test each.
  - Done 24 November, 3.3 and 3.4 together (an engine with no card cannot be tested): `cards.ts`. After each wave but the last, three different cards drawn from the seed (`pickDistinct`), among those not held at their most; the next wave waits until you choose (`card` in the input), and the card holds until dawn. The first 8: Wider beam (+10°, 3 at most), Brighter beam (+25 %, 5), Sharp posts (+30 %, 5), Long reach (+4, 3), Wide watch (+20°, 3), Oil barrel (25 oil at once, never above the Night's own), Tar pots (3 oil back after each wave, 5), Slack tide (enemies 15 % slower, 2). The two cards of the captains move to 3.7, with their powers. The Night's shape is 4. 13 tests. Until the cards are on screen (3.8), the client and the bots take the first card offered.
  - Measured: with the first card taken blindly, the hand-speed bot's campaign wins every Night at once again (18 minutes; Lighthouse 6, Refinery 6, Infirmary 3). The cards outweigh the families; tuned with the posts on screen and at gate B.
- [x] **3.5** The other 16 cards, one test each.
  - Done 24 November: 24 cards. The beam: Focus (10° narrower, 50 % harder), Hunter (Beasts 40 % harder), Ghostlight (Wraiths lit 0.3 s longer before they fade), Ember (25 % harder within 12 of the Lighthouse). The posts: Drill (15 % harder, 2 farther), Know your foe (the triangle's bonus 1.5, not 1.2), Third raft (one more post at once), Nets (enemies a post reaches 25 % slower). The oil: Deep tanks (20 more held, poured now), Patches (Raiders steal 1 less), Seawall (Beasts 5 less), Salvage (2 more wood a boat burned). The sea: Low fog (faded Wraiths show again 0.5 s sooner), Headwind (Raiders 20 % slower), Fish shoal (20 more fish a wave held), Lucky star (5 more Pearls at dawn if won). One test each (14 tests). The captains' cards come with their powers (3.7).
- [x] **3.6** The boss of wave 10 and its phases. Tests.
  - Done 24 November: the Mist Galleon (speed 1, health 1,500, steals 50 oil; harpooners beat it) comes first in wave 10, in Nights 4 and 5. At two thirds of its health it sends 3 Raiders around it, once; at a third it rages, 1.6 times faster. Each enemy carries its stage (the Night's shape is 5). On screen: a dark hull, and its health bar at the top while it is on the sea. 7 tests.
- [x] **3.7** The lead captain's power: one power, its cooldown, its effect. Tests.
  - Done 24 November: the flare (`power` in the input): ready from the start; fired, the whole sea burns at half the beam's strength for 2 s, faded Wraiths too, then it waits 20 s. The captains' two cards: Quick hands (25 % sooner), Long flare (a second longer): 26 cards in all. On screen: a Flare button at the bottom right with its seconds, and Space or F. The Night's shape is 6. 7 tests (5 rules, 2 panel).
- [x] **3.8** On screen: the posts on the rafts (tap a raft, choose a troop), the card choice between waves (three cards, keyboard 1/2/3), the boss and its health bar, the power's button and its cooldown. e2e.
  - Done 24 November, before 3.5 to 3.7 (until then the game chose the first card and nobody could put troops anywhere): each family in its own shape and color (Raiders' red skiffs, Beasts' dark green humps, Wraiths' violet shards, ghostly when faded); a round button over each raft, ＋ when empty, its troop's icon when held, opening the three troops at the bottom of the screen ("Strong against Raiders"…); between waves the three cards in the middle, a tap or 1 2 3; after Night 1, "Tap ＋ on a raft to put troops there. They fire on their own." while every raft is empty. Found on the way: the panels' own `display` beat their `hidden` (they stayed on screen and took the taps): fixed. 4 tests on the text; `npm run e2e:portal` 6 of 6 (a new one: troops on a raft, a card by key, the next wave). The boss's health bar and the captain's power button come with 3.6 and 3.7.
- [x] **3.9** The Barracks (the posts' troops' level), the Harbor (the rafts, so the posts) and the Observatory (new cards in the draw) given their effect on the Night (moved from task 4.3). One test each.
  - Done 24 November: the city's six buildings (shape 2; a city saved before gets the three new ones at 0). The Barracks: the posts' troops 20 % harder a level (built for 100 wood, 80 fish). The Harbor: one more raft at levels 1, 3, 5… (120, 60). The Observatory: the cards open by tiers, the first 8 for every city, 6 more a level, all 26 at level 3 (90, 90). The Day shows each with what it does for the Night, and the guide a line for each; the island shows their levels. The Night's shape is 7. 8 tests.
  - Step 3 measured (`npm run night`, 20 seeds, the bots taking the first card and placing no troop): the hand-speed bot's campaign wins Nights 1 to 4 at once and Night 5 in 2 tries (22 minutes; Lighthouse 6, Refinery 4, Infirmary 2 at the end, the rest spread on the new buildings). The curve the testers meet at gate B is a person's, not the bots'.
- [ ] **Gate B · Does a session hold?** (After step 3 now.) Ten new players, read from `?measure`. Passed if the median first session is over 10 minutes, eight of ten play a minute or more, and six of ten reach the third Night.
  - Packet (24 November, for step 3's build):
    - **Where:** https://ccr-9319aa6a-txz4sk.brinelight.pages.dev/portal/ (it follows every push, a minute or two after). Each player on a device that never opened it, or in a private window.
    - **Who:** ten people who never saw the game. Five of them on a phone, five on a computer, if you can.
    - **What to tell them:** nothing. Let them play as long as they like; note their questions, do not answer them while they play.
    - **What they meet:** Night 1 at once (Raiders only, one line on the beam); the city between the Nights with six buildings; from Night 2 the rafts' troops (tap ＋), Beasts and three cards between waves; from Night 4 Wraiths and, in wave 10, the Mist Galleon; the Flare (button, Space or F). Plain shapes, no sound in the Night.
    - **What the game counts:** after each player, open `…/portal/?measure` on the same device and copy the session's line (its length, when the beam first moved, each Night's end).
    - **Passed if:** the median first session is over 10 minutes, eight of ten play a minute or more, and six of ten reach the third Night.
    - **Worth noting too:** whether they find the rafts' ＋ alone, whether they read the cards, whether a Night felt unfair, when and why they stopped.
    - **On the S22:** `…/portal/?fps` during wave 10 of Night 4 (the Galleon and its Raiders), the FPS line.
    - **Write here:** passed or not, the ten `?measure` lines and a line of notes each, and what to rework if not passed.
  - Result (owner): 

## Step 5 · Content and return

- [ ] **5.1** The sea chart: 30 Nights, each with its families and its rule (a Night of Wraiths, a Night with no pause…), in the rules, with tests that each rule does what it says.
- [ ] **5.2** The chart on screen: the Nights as points on the sea, the next one lit, the ones won marked.
- [ ] **5.3** The bosses of waves 20 and 30 (the Leviathan). Tests.
- [ ] **5.4** The six captains' powers and their unlock by shards. Tests.
- [ ] **5.5** The Endless Night and your record, kept on the device.
- [ ] **5.6** What the city makes while you are away, up to 4 hours' worth, from the device's clock given to the rules (never read in them); a clock moved back gives nothing. Tests.
- [ ] **5.7** The daily tasks and the free daily recruitment, from the rules that exist. `RECRUIT_ODDS` is read, never changed.
- [ ] **5.8** The curve: each Night of the chart won by the aiming bot with the city its place supposes, and lost with the city of five Nights before (`tools/night/`, a test).
- [ ] **5.9** The sea's names in English in the portal edition, as the owner settled (`docs/design/hold-the-light.md`); the Brinelight on Solana keeps its own.

## Step 6 · The look and the sound

- [ ] **6.1** The three families' models and the three bosses (made in `assets/blender/`, one instanced draw call a family).
- [ ] **6.2** The beam, the Mist, the hits and the deaths: effects within the frame budget.
- [ ] **6.3** The Night's sounds and its music, each file's origin and license written in `docs/decisions.md`; muted when the page is hidden.
- [ ] **6.4** The cards' pictures.
- [ ] **6.5** Loading in two parts: what Night 1 needs first (under 5 MB), the rest during it. Measured.
- [ ] **6.6** 60 FPS at wave 30: measured in the container, then on the S22 by the owner with `?fps`. The e2e's look references, shown to the owner before they change.

## Step 7 · To CrazyGames

- [ ] **7.1** Read CrazyGames' requirement pages again and write any change here.
- [ ] **7.2** e2e captures at 821 × 462, 907 × 510, 1216 × 684, 1920 × 1080, 800 × 450, 1080 × 607 and 384 × 699, at a pixel ratio of 1: no text cut, no button under another.
- [ ] **7.3** The same Night at 60, 144 and 165 Hz (a test of the accumulator); sound starts on iOS after the first tap.
- [ ] **7.4** The checks of task 0.5 on the final build; no outside link anywhere.
- [ ] **7.5** The covers (1920 × 1080, 800 × 1200, 800 × 800, the title as the only text) and the two videos (15 to 20 s, no sound, 1080p in 16:9 and in 2:3), captured from the game.
- [ ] **7.6** The description and the controls in English, under the name the owner chose: "Brinelight: Hold the Light". Check it is not taken on CrazyGames.
- [ ] **7.7** The upload folder (`client/dist-portal/` zipped) and a checklist of the developer portal's fields.
- [ ] **Gate C · Submit?** The owner plays the final build in CrazyGames' preview tool and says yes.
  - Packet: (the loop writes it here)
  - Result (owner): 

## Found on the way

(The loop writes here what it finds outside its task: a test that fails before any change, a bug in the main game, a page of CrazyGames that changed.)

- 24 November: the e2e's Playwright (1.56.1) expects a Chromium build a cloud container may not have; `E2E_CHROMIUM` names another one (`e2e/harness.ts`). CI sets none.
