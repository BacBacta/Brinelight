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
- [ ] **0.3** `npm run build:portal`: Vite in a `portal` mode, base `./`, output `client/dist-portal/`, without the `prototype/` folder. Added to `npm run check`.
  - Does: `npm run build:portal` (`vite build --mode portal`): base `./`, so every address is relative (all of the game's go through `BASE_URL`); output `client/dist-portal/` (ignored by git); the `prototype/` folder removed from it once Vite has copied the public files; the page's title "Brinelight: Hold the Light". Run by `npm run check` after the game's own build.
  - Does not: check the files it makes (task 0.5); serve it on a preview (task 0.4).
  - Tested by: `client/test/portalBuild.test.ts`: the config in each mode (base, output folder); the title put in the page; the folder removal (only `prototype/`, nothing outside the output folder).
- [ ] **0.4** On a branch preview only (the `CF_PAGES_BRANCH` condition the demos use), the main build also serves the portal build at `/portal/`, so testers can play it. Never in the production build: a test builds as Cloudflare does for `main` and checks it.
- [ ] **0.5** A test of the portal's files: no absolute path, none of "wallet", "Solana", "Phantom", "USDC" or a server address, under 20 MB, under 1,500 files. An e2e opens it from a sub-folder (`/some/folder/`) with no error in the console.

## Step 1 · A Night in the rules

- [ ] **1.1** The seeded generator, `shared/src/rules/night/random.ts`: a state you carry, never a global. Tests: the same seed gives the same sequence; draws spread evenly over 100,000 values; a choice of 3 among N gives 3 different items.
- [ ] **1.2** `values.ts` and the Night's types: its state (seed, step, oil, wave, enemies, beam), its inputs (the beam's angle), a strict `parseNight`. Tests: a valid state passes, each wrong field is refused.
- [ ] **1.3** Enemies: each comes on its bearing from the edge of the sea at its speed; on the coast it steals its oil and is gone. Tests: an enemy's step count to the coast; the oil after it lands; the oil never below 0.
- [ ] **1.4** The beam: angle, width, damage a second. Tests: an enemy in the beam dies in the steps its health says; on the beam's edge it is in; just outside it is not; the angle wraps at 360°.
- [ ] **1.5** Waves from the seed: each wave's enemies and when they come, the pause between waves, the Night won after its last wave, lost when the oil reaches 0, and its loot either way. Tests: the same seed and inputs give the same state hash after 10,000 steps; feeding 1/15 s of time gives the same state as two feeds of 1/30 s; a Night with no input is lost at a known step; Night 1 cannot be lost before wave 3.
- [ ] **1.6** `tools/night/`: a simulator with two bots, one that never moves the beam and one that always aims at the nearest enemy. `npm run night` prints each bot's wave reached and loot on Nights 1 to 5. Its numbers go in this file.

## Step 2 · A Night you can play, in plain shapes

- [ ] **2.1** `client/src/night/`: the island as it is, enemies as plain shapes (one `InstancedMesh` per family), the beam as a cone of light on the water.
- [ ] **2.2** The hand: the beam follows the pointer and the finger; the arrow keys and A/D turn it; the fixed-step accumulator (at most 8 steps a frame); the Night pauses when the page is hidden.
- [ ] **2.3** The screen: the oil's gauge, the wave's number, the end screen ("The Lighthouse went dark" or "Dawn", the loot, "Again"). The portal opens in Night 1 at once: no menu, no title screen.
- [ ] **2.4** e2e: the Night starts within 10 s of the page; the beam follows the pointer; a Night left alone ends on the end screen; "Again" starts a new one. Measured: FPS with 150 enemies at 384 × 699 and 907 × 510 (in the container; the S22 at the gate).
- [ ] **Gate A · Is the beam fun?** Five people who never saw the game play it, with nothing explained. Passed if four of five start a second Night on their own and none asks what to do.
  - Packet: (the loop writes it here)
  - Result (owner): 

## Step 3 · Depth

- [ ] **3.1** The three families (Raiders, Beasts, Wraiths) in the rules, with their speed, health, oil stolen and behavior (a Wraith fades out of the beam). Tests for each.
- [ ] **3.2** Posts: a troop on a raft fires on its own at its range; the triangle on the families (`COUNTER_BONUS` 1.2, read from the existing rules, never changed). Tests.
- [ ] **3.3** The cards' engine: three different cards drawn from the seed after each wave, one chosen, its effect held for the rest of the Night. Tests: the draw, the choice refused if not offered, an effect stacking as its card says.
- [ ] **3.4** The first 8 cards (beam, posts, oil, captains: two of each), one test each.
- [ ] **3.5** The other 16 cards, one test each.
- [ ] **3.6** The boss of wave 10 and its phases. Tests.
- [ ] **3.7** The lead captain's power: one power, its cooldown, its effect. Tests.
- [ ] **3.8** On screen: the posts on the rafts (tap a raft, choose a troop), the card choice between waves (three cards, keyboard 1/2/3), the boss and its health bar, the power's button and its cooldown. e2e.

## Step 4 · The city between the Nights

- [ ] **4.1** The portal city's state in the rules: buildings and their levels, the stock, the Nights won; a strict parse with a version.
- [ ] **4.2** The loot at dawn added to the stock; an upgrade at once, its cost from `values.ts`, refused with its reason when the stock is short. Tests.
- [ ] **4.3** Each building's effect on the Night (the design's table), read by the Night's rules when a Night starts. One test each.
- [ ] **4.4** The save on the device: written after each Night and each upgrade; old versions migrated; a bad save set aside and a new city started. Tests, and an e2e with a save edited by hand.
- [ ] **4.5** The Day on screen: the city view the game has, a building's sheet with its effect on the Night and "Upgrade", the "Next Night" button always in sight.
- [ ] **4.6** The first minutes' guide: the quest card points at what to tap next (the building, the Night), and moves the camera there when tapped.
- [ ] **4.7** Nights 1 to 5 as the design's starting values say, played by the simulator's bots; their numbers in this file.
- [ ] **4.8** `?measure`: the game counts, on the device only, each session's length, the Nights started and reached, and the time to the first card; a hidden page shows them for the tester to read out. Nothing is sent.
- [ ] **4.9** e2e: Night, dawn, upgrade, Night again; reload keeps the city.
- [ ] **Gate B · Does a session hold?** Ten new players, read from `?measure`. Passed if the median first session is over 10 minutes, eight of ten play a minute or more, and six of ten reach the third Night.
  - Packet: (the loop writes it here)
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
