# Decisions

One line per decision, most recent first.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-15 | Starting values of a new city (stock, troops, survivors, morale, captain) and the offline cap (8 h) live in `shared/src/rules/start.ts`, with the prototype's values. | The client and the server create the same city; no starting value is written in the client. |
| 2026-10-15 | `phare.glb` is a kit of models (island tiles, buildings, decor), not the Lighthouse; the Lighthouse is built in code (`client/src/scene/lighthouse.ts`), as in the prototype. | Its look depends on the game (level, skins, Mist), and the name of the file is misleading. |
| 2026-10-15 | Rules are expressed in real seconds and rates per hour; 1 prototype second = 6 real minutes (`TIME_SCALE = 360`). | One set of rules for the server, the client and the tests; development speedup happens on the server. |
| 2026-10-15 | npm monorepo with three packages (`shared`, `client`, `server`), TypeScript everywhere. | The client and the server read exactly the same rules. |
| 2026-10-15 | The prototype is kept as is in `client/public/prototype/` as a reference. | Compare behavior during the port. |

## Open questions

- **Early game too slow at the current scale.** Refinery level 2 takes 54 real minutes, while the design document plans two very fast first hours. To be fixed in week 17 with a time curve specific to the first levels.
- **Lighthouse level 30.** Costs and durations beyond level 10 are extrapolated from the prototype. To be balanced by simulation in week 17.
- **Offline cap of 8 h: keep it or rely on storage only?** To decide in week 17.
