# Week 6 · Ready to last, and good to touch

Goal of the week: the stored cities can change shape without being refused, the interface is built from shared pieces, and the game feels alive (short animations, celebrations, sounds, building tiers, light, water and the Mist's mood), while staying at 30 FPS on an entry-level Android phone. A simulation shows how a player progresses over 30 days. No game rule changes this week, except what task 1 needs to read old cities.
The migration comes first: the server is rented in week 8, and from then on a city refused for its shape would be a lost player.

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- No balance value changes (CLAUDE.md rule 3). Task 5 measures; it changes nothing without the owner's approval.
- No new generated asset: no new Higgsfield credit. The models, portraits and icons of week 5 are reused.
- Every visual change is checked at 412 × 915 and 360 × 800, with screenshots; FPS, draw calls and download size are measured before and after in `docs/perf.md` when the 3D changes.
- What the player sees and hears never decides anything: celebrations, sounds and animations follow the city the rules made, they never change it.
- Player text in English, short, second person.

## Task 1 · Migrate the stored cities

- Each stored city carries a shape version. The server brings an older city up to the current shape instead of refusing it: it adds the fields of week 5 (`veterans` in the city and in each fleet, `shards`, `training` and `healing` empty), keeps the shipyard's work as it is (a `yard` of kind `raft` stays valid now that it has three kinds), and keeps the reports (one without `infirmary`, `veteranSent` or `captainXp` stays readable).
- The migration only adds what is missing: it never changes a value, and running it twice gives the same city. A city that is still unreadable after it stays as it is in the database, reported and logged with the player id only, as today. A city from a newer shape than the server knows is refused, never brought down.
- Tested on a real PostgreSQL in CI (the `postgres` job), with a city from week 4 stored as it is: it has a fleet at sea and at least one combat report, and the migration keeps both. Also tested on PGlite with the other tests.
- The open question on stored cities in `docs/decisions.md` is closed.
- Done when: a city saved by the week 4 server opens on today's server, with its fleet and its reports, and the next action saves it in the current shape.

**Done (17 October).** A column `cities.shape` (migration `0003`: the rows already stored are shape 4) and `migrateCity` in `shared/src/state/migrate.ts`: shape 4 → 5 adds only what is missing (`training`, `healing`, `veterans` in the city and in each fleet, `shards`), shapes below 4 or above 5 are refused. The server reads every stored city with it; `GET /city` writes nothing, the first action that changes the city writes it in shape 5, logged with the player id and the two shapes only. The client's `migrateSave` uses the same step. Tests: the city of week 4 made by the week 4 code (`shared/test/fixtures/city-week4.json`, with a fleet at sea and two reports), in `shared/test/migrate.test.ts` and `server/test/migration.test.ts`, on PGlite and on PostgreSQL in the CI's `postgres` job, including a database left by the week 4 server (migrations 0000 to 0002) opened by today's.

## Task 2 · Shared interface components

- Buttons, sheets, progress bars and chips become shared components used by every sheet (buildings, rafts, Captains, sea, reports, Profile), instead of HTML written again in each one.
- Nothing changes in how the game looks: screenshots before and after are the same, at both sizes.
- The refusal shown under a button, and the button that stays tappable when refused, are part of the component.

**Done (17 October).** `client/src/ui/components.ts`: `button` and `actionButton` (a refused button gets `aria-disabled="true"`, stays tappable, and its reason is written under it; the tap shows the rules' reason in a toast), `why`, `progressBar`, `chip`, `box`, `costLine` and `costText`, `kv` and `keyValues`, `listRow`, `verdict`, `esc`, and `createSheetView` (a sheet's frame, opening, closing, and drawing again only when what it shows changed). The building, Observatory, Barracks, Infirmary, raft, Captains, camp, wreck, combat report and Profile sheets use them; their HTML is the same to the character (the existing tests did not change, `client/test/components.test.ts` checks each piece). The top bar and the queue keep their own HTML: on components, they made the game heavier. Every button can be tapped on 44 × 44 px at least (an invisible `::after` on `.b`, the sheets' ✕, "+N more" and the building badge). Checked by the e2e `the look`: 42 captures (every sheet, the top bar, the queue, at 412 and 360 px) compared with `e2e/look/` at zero pixels, the references made by the CI's e2e job; on every capture, a tap at the middle of each side of each button's 44 px square reaches the button. Neighbor buttons whose squares overlap, listed by the e2e (`e2e/.shots/look/pairs.txt`): the sheet's ✕ and the Observatory's "Research" for Saws and for Warehouses, and the ✕ and Bran's "Unlock" in the Captains sheet, only when the sheet is scrolled to the bottom and that button sits just under the title. Weight: −3 175 B, and +132 B gzipped, accepted by the owner (`docs/perf.md`). `captains-top` has a second reference, the variant some AMD machines of the CI draw (`docs/decisions.md`, `e2e/look/README.md`).

## Task 3 · Make it feel good

- Short animations (a sheet that opens, a number that changes, a button pressed), one motion at a time, as the art direction says.
- A celebration at the end of works: floating gold text and a short sound; full screen for the Lighthouse. A celebration when a captain levels up, with their 512 px portrait.
- Light sounds in one family (wood and rope, not metal), that you can turn off; the choice is kept on the device.
- Three visual tiers per building (levels 1 to 4, 5 to 9, 10 and up), made from the existing models (size, details, light, flag or lantern), with no new model.
- This also answers the open question "A message when a work ends".
- The look references are made again from the CI (`e2e/look/README.md`), including the variant of `captains-top`, from any run that draws it.

**Done (17 October).**
- **Celebrations** (`client/src/ui/celebrate.ts`), one at a time, closed by a tap: floating gold text for a work that ends (building, research, raft, raft building, troops, veterans, healing), the full screen for the Lighthouse, a card with the 512 px portrait for a captain who rises a level. What ended comes from `eventsBetween` (`shared/src/state/events.ts`, pure, no rule), which compares two cities.
- **While you were away:** at launch, the city shown (the server's, or the one advanced on this device) is compared with the last city seen on this device, kept with its owner. Several events make one card, one makes a normal celebration; nothing on the very first launch, nothing when the account's city replaces the city of this device. Tested on the three cases, in the client tests and the e2e.
- **Sounds** (`client/src/ui/sound.ts`): ten sounds of wood and rope made with the Web Audio API, no file, no dependency, none before the first tap. On by default; the switch is in the Profile, with or without an account, kept on this device.
- **Motions:** a sheet closes down (160 ms) and opens up (220 ms), a pressed button sinks (80 ms), bars fill (300 ms), the amounts of the top bar roll after an action (400 ms, never during a celebration). With reduced motion, nothing moves.
- **Building tiers** (`client/src/city/tiers.ts`): 86 %, 93 %, 100 % of the full size; a flag at the second tier; a crate, a barrel and a lantern at the third. Two draw calls at most for all the details. `client/test/tiers.test.ts` checks that nothing leaves its plot or touches a neighbor plot or a raft slot (the Barracks and the Fishery are a little smaller for it, and the Lighthouse stops widening once it fills its plot). Captures of the three tiers in the CI's artifact (`shot-tier-*`).
- **Measures** in `docs/perf.md`: one draw call more from the second tier, two from the third; the full-screen celebration's beam stops at the lowest quality step. The entry-level phone still has to be measured.
- **The look:** the Profile (412 and 360 px) changes on purpose (the sounds' switch); six new captures of the celebrations; every other capture is unchanged.

## Task 4 · Light, water and the Mist's mood

- The three lights of the art direction (calm day, Mist, Lighthouse night), the water near the island and far away, and the Mist's mood (fog, leaden water, the Lighthouse's beam as the only warm point).
- Visual only: no rule, no timer, no damage. The Mist's mechanism comes in week 7.
- 30 FPS or more on an entry-level Android phone, in the city and at sea: measured before and after, in `docs/perf.md`.
- **Postponed:** the Lighthouse night. By the owner's decision (17 October), the light is a fixed late afternoon; the night comes back with the Mist's calendar or later.

**Done (17 October).**
- **Light** (`client/src/scene/look.ts`): a fixed, warm late afternoon in the city and at sea: a cream-to-turquoise sky, a low sun in the west-southwest (about 26° up) with long, soft shadows, a warm sky light, and a haze the far sea melts into.
- **Water** (`client/src/scene/water.ts`, `shore.ts`): turquoise near the island, navy from 30 m out; it reflects the sky (a PMREM of its gradient, on the water only), with small waves (±0.06) and finer ripples drawn pixel by pixel. Foam along the island's shore and around the rafts afloat, from a grid of distances built on the CPU from the island's triangles, and again only when the rafts change. No texture file, no new dependency, no extra draw call.
- **The Mist's mood** (visual only): `seaMood()` is read by the banner and the 3D view alike; it is calm until the Mist's calendar (week 7), and `?mist` shows the Mist's look (the banner then says "Mist · oil for …"). In the Mist: a grey-violet sky and fog, a light violet veil on the horizon, leaden water, a dim, cold sun, and the Lighthouses' beams sweeping, the only warm point. In calm weather the beams are hidden and the lantern keeps its tier's glow. The two looks fade into each other in 1.5 s, at once with reduced motion.
- **Quality steps** (`QUALITY_STEPS`): step 1 also halves the shadow map; step 2 drops the shadows, the water's reflection, ripples and moving foam, and draws the water on a coarser grid.
- **At sea:** the islets' sand and foam lie just above the highest wave, where the waves never cross them (they flickered).
- **Measures** in `docs/perf.md`: fewer triangles (the water's grid) and, in calm weather, fewer draw calls (the beams). The 30 FPS goal on an entry-level phone is still to be checked; the measures to take on the S22 are listed there.
- **The look:** the 48 references did not move (the 3D view is hidden during the captures).

## Task 5 · Balance simulation

- A script plays 30 days with the rules of `shared/` alone (no server, no client), following a simple, written player behavior.
- It prints a table per day: Lighthouse level, Power, resources, and what was built, researched and trained.
- It changes no value: what it shows is discussed with the owner first. It gives the first numbers for the open questions on the early game and the Lighthouse beyond level 10.

## Not this week

The Mist's mechanism and raft repair, the Leviathan, objectives and Daily Tasks (week 7); renting the server, the load test, the first Solana proof (week 8); multiplayer (weeks 9 to 13); the daily recruitment (week 15).
