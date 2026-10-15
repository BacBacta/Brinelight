# Decisions

One line per decision, most recent first.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-15 | The game fonts (Lilita One 400, Nunito 600 to 900) are served by the game itself with `@fontsource/lilita-one` and `@fontsource/nunito` 5.3.0, never from Google Fonts. | GDPR: loading Google Fonts sends the players' IP addresses to Google. |
| 2026-10-15 | Pearls live in the player state apart from the stock (`STARTING_PEARLS = 200` in `start.ts`); storage never caps them. | They are earned by playing and are not stored in the warehouses. |
| 2026-10-15 | The build queue is a shared rule (`startUpgrade`, `advanceQueue`, `UpgradeJob` in `shared/src/rules/buildings.ts`): a job keeps the duration fixed at its start, and jobs ending at the same moment finish in the order they were started. | The client and the server run the same queue; the client cuts production at each finished job, so time away gives the same result as playing live. |
| 2026-10-15 | Starting values of a new city (stock, troops, survivors, morale, captain) and the offline cap (8 h) live in `shared/src/rules/start.ts`, with the prototype's values. | The client and the server create the same city; no starting value is written in the client. |
| 2026-10-15 | `phare.glb` is a kit of models (island tiles, buildings, decor), not the Lighthouse; the Lighthouse is built in code (`client/src/scene/lighthouse.ts`), as in the prototype. | Its look depends on the game (level, skins, Mist), and the name of the file is misleading. |
| 2026-10-15 | Rules are expressed in real seconds and rates per hour; 1 prototype second = 6 real minutes (`TIME_SCALE = 360`). | One set of rules for the server, the client and the tests; development speedup happens on the server. |
| 2026-10-15 | npm monorepo with three packages (`shared`, `client`, `server`), TypeScript everywhere. | The client and the server read exactly the same rules. |
| 2026-10-15 | The prototype is kept as is in `client/public/prototype/` as a reference. | Compare behavior during the port. |

## Open questions

- **Early game too slow at the current scale.** Refinery level 2 takes 54 real minutes, while the design document plans two very fast first hours. To be fixed in week 17 with a time curve specific to the first levels.
- **Lighthouse level 30.** Costs and durations beyond level 10 are extrapolated from the prototype. To be balanced by simulation in week 17.
- **Offline cap of 8 h: keep it or rely on storage only?** To decide in week 17.
