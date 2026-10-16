# Week 5 · The whole city on the server

Goal of the week (roadmap, phase 2): what the city does in the prototype is decided by the server: training troops, healing the wounded, veterans, buildings on rafts and captains.
Training comes first: today a player who loses troops at sea can never get new ones, and soon cannot attack at all.

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- The values come from the prototype (`client/public/prototype/index.html`), with durations in real seconds through `protoSeconds`. They are new balance values: list them in your plan (CLAUDE.md rule 3). None of the existing values changes.
- A rule refuses with a readable reason in English. Use the prototype's words when it has some.
- Every timer ends as an event of `advance`, like research and the shipyard: what it changes (troops, production, attack) changes at the exact moment, even during a long time away.
- A new field of the city: `parseState` requires it, `migrateSave` fills it in for old saves without an account, and there is no server migration (no real city is stored yet).
- A new action: strict `parseAction`, `applyAction`, applied by the server like the others; its refusals in `server/test/cheat.test.ts` with the reference city; it also works without an account.
- Sheets as in the prototype, player text in English.

## Task 1 · Train troops at the Barracks

- As in the prototype: Barracks level 1 or more ("Build the Barracks first"), one training at a time ("Training is already underway"), a batch of Barracks level × 20 soldiers of one type, 3 fish and 2 wood per soldier, (n × 0.25 + 3) prototype seconds.
- Action `train` (troop type). The training is a new field of the city. When it ends, the soldiers join the troops in the city, never a fleet at sea.
- Barracks sheet as in the prototype: the three types with their count and their "+N" button, and the cost line.
- e2e: train signed in, reload, the training is there; a city whose training ends in a few seconds (the harness's `putCity`, as for research) shows the new soldiers on the server and on screen.
- Done when: a player who lost all their troops at sea trains new ones, and the server decides.

**Done (16 October).** One training at a time (`training` in the city, with a `kind` ready for the veterans), ended as an event of `advance`; the prototype's values (Barracks level × 20 soldiers, 3 fish and 2 wood each, n × 0.25 + 3 prototype seconds) and refusals; action `train` (the troop type only); the Barracks sheet from the prototype, the queue row "20 harpooners"; `migrateSave` adds `training: null`; works without an account; cheat cases (no Barracks, already underway, not enough resources, unknown troop type, a number of soldiers sent) and the done-when case on the server; e2e: training started from the sheet, found again after a reload, then the soldiers in the city by the server's clock. No message at the end of a work yet: it will come for research, shipyard and training together (open question).

## Task 2 · Heal the wounded at the Infirmary

- As in the prototype: Infirmary level 1 or more, at least one wounded, one healing at a time; all the wounded at once, 2 fish per wounded, (n × 0.12 + 2) prototype seconds. When it ends, they go back to the troops in the city.
- During a healing, new wounded take the free beds, as in the prototype: the beds count only the wounded not being healed.
- Infirmary sheet as in the prototype: wounded by type, beds in use, battle losses saved, "Heal N wounded · X fish".

## Task 3 · Veterans

- As in the prototype: the Veteran Doctrine research and Barracks level 3; promote 10 soldiers of one type for 60 fish and 40 oil, in 6 prototype seconds, in the same slot as training (one or the other).
- Veterans in the city and in fleets: an attack fleet takes them with the soldiers. `resolveCombat` already counts a veteran as 1.8 soldiers (`VETERAN_WEIGHT`) and gives `veteranLosses` and `veteranSurvivors`; the report shows them. `power` already counts them.
- The Observatory sheet loses its "coming soon" note: the Veteran Doctrine now has its effect.

## Task 4 · Buildings on rafts

- The shipyard's two other kinds, planned in week 4: `install` (a building on a free raft) and `upgrade`.
- As in the prototype: installing costs `raftBuildingCost(id, 0)` and takes 8 prototype seconds, at most `RAFT_BUILDING_MAX_COPIES` (2) rafts per type; upgrading costs `raftBuildingCost(id, level)` and takes 8 × 1.5^level prototype seconds, up to `RAFT_BUILDING_MAX_LEVEL` (3). One work at a time at the shipyard, new rafts included.
- The effects are already in the rules (Kelp Greenhouse: fish; Smokehouse: fish eaten; Watchtower: fleet attack). They follow the end of the work at the exact moment.
- Raft sheet as in the prototype. Repair waits for the Mist (week 6): until then, no raft can be damaged.

## Task 5 · Captains

- Experience, as in the prototype: after each combat, the fleet's captain gains 20 + 10 × the camp's level for a victory, 10 for a defeat, with the level-ups of `addXp` (up to `CAPTAIN_MAX_LEVEL`).
- The Logbook: +40 XP to the lead captain for 50 Pearls (`LOGBOOK`). Pearls are earned by playing, never sold.
- Choosing the lead captain among the captains owned (action `setLead`).
- Captains sheet as in the prototype: level, XP, skill, stars, shards, lead.
- **Shards: decision for the owner before coding.** In the prototype, a victory gives its shards to a captain drawn at random. CLAUDE.md allows one random draw only, the daily recruitment.
  - **A (recommended):** each pirate camp gives the shards of one fixed captain, named on its sheet (`pirateLoot` already gives the camp's level in shards). 10 shards unlock a captain or add a star, as in the prototype (`FRAGMENTS_PER_STAR`). No luck: the player chooses whom to work for. The plan proposes which captain each camp gives.
  - **B:** no shards before the recruitment (week 15).
- Not the daily recruitment: it is the only random draw, and it must be verifiable (roadmap week 15, with Switchboard).

## Not this week

The daily recruitment (week 15); raft repair and Mist damage, the Mist and the Leviathan, objectives and Daily Tasks (week 6); the load test and renting the server (week 7); multiplayer (weeks 8 to 12).
