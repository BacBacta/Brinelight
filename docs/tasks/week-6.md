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

**Done (17 October).** `client/src/ui/components.ts`: `button` and `actionButton` (a refused button gets `aria-disabled="true"`, stays tappable, and its reason is written under it; the tap shows the rules' reason in a toast), `why`, `progressBar`, `chip`, `box`, `costLine` and `costText`, `kv` and `keyValues`, `listRow`, `verdict`, `esc`, and `createSheetView` (a sheet's frame, opening, closing, and drawing again only when what it shows changed). The building, Observatory, Barracks, Infirmary, raft, Captains, camp, wreck, combat report and Profile sheets use them; their HTML is the same to the character (the existing tests did not change, `client/test/components.test.ts` checks each piece). The top bar and the queue keep their own HTML: on components, they made the game heavier. Every button can be tapped on 44 × 44 px at least (an invisible `::after` on `.b`, the sheets' ✕, "+N more" and the building badge). Checked by the e2e `the look`: 42 captures (every sheet, the top bar, the queue, at 412 and 360 px) compared with `e2e/look/` at zero pixels, the references made by the CI's e2e job; on every capture, a tap at the middle of each side of each button's 44 px square reaches the button. Neighbor buttons whose squares overlap, listed by the e2e (`e2e/.shots/look/pairs.txt`): the sheet's ✕ and the Observatory's "Research" for Saws and for Warehouses, and the ✕ and Bran's "Unlock" in the Captains sheet, only when the sheet is scrolled to the bottom and that button sits just under the title. Weight: −3 175 B, and +132 B gzipped, accepted by the owner (`docs/perf.md`). `captains-top` has a second reference, for the CI's AMD EPYC 9V74 machines (`docs/decisions.md`, `e2e/look/README.md`).

## Task 3 · Make it feel good

- Short animations (a sheet that opens, a number that changes, a button pressed), one motion at a time, as the art direction says.
- A celebration at the end of works: floating gold text and a short sound; full screen for the Lighthouse. A celebration when a captain levels up, with their 512 px portrait.
- Light sounds in one family (wood and rope, not metal), that you can turn off; the choice is kept on the device.
- Three visual tiers per building (levels 1 to 4, 5 to 9, 10 and up), made from the existing models (size, details, light, flag or lantern), with no new model.
- This also answers the open question "A message when a work ends".
- The look references are made again from the CI (`e2e/look/README.md`), including the AMD EPYC 9V74 variant of `captains-top`.

## Task 4 · Light, water and the Mist's mood

- The three lights of the art direction (calm day, Mist, Lighthouse night), the water near the island and far away, and the Mist's mood (fog, leaden water, the Lighthouse's beam as the only warm point).
- Visual only: no rule, no timer, no damage. The Mist's mechanism comes in week 7.
- 30 FPS or more on an entry-level Android phone, in the city and at sea: measured before and after, in `docs/perf.md`.

## Task 5 · Balance simulation

- A script plays 30 days with the rules of `shared/` alone (no server, no client), following a simple, written player behavior.
- It prints a table per day: Lighthouse level, Power, resources, and what was built, researched and trained.
- It changes no value: what it shows is discussed with the owner first. It gives the first numbers for the open questions on the early game and the Lighthouse beyond level 10.

## Not this week

The Mist's mechanism and raft repair, the Leviathan, objectives and Daily Tasks (week 7); renting the server, the load test, the first Solana proof (week 8); multiplayer (weeks 9 to 13); the daily recruitment (week 15).
