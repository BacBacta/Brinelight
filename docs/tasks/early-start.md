# The early start: A + C

The owner's decision of 23 October, from `docs/studies/early-game.md`: the start was too slow ("my city is at Lighthouse 2"). Two balance changes, accepted value by value by the owner:

- **A. Quick first levels:** up to level 5, an island building's upgrade takes at most 1, 2, 5 or 15 minutes. For **every city**.
- **C. A richer start:** a new city starts with 2,000 wood, 1,400 oil and 800 fish, instead of 520, 380 and 420 (rope stays at 3). For **new cities only**: no city already made is changed.

The owner loosens the limit of 18 October for this change only: the regular player's Lighthouse 15 and 20 may come 13 to 15 % before week 6. The new milestones become the reference (`docs/balance.md` and the milestone tests).

**Status: the table below waits for the owner's yes before any code.**

## A, exactly: the longest an upgrade takes, by the level it reaches

The rule: `upgrade time = min(today's time, the cap of the level reached)`. A time already under the cap stays as it is (none is, today). Level 6 and above: today's times, unchanged.

| Level reached | Cap |
| --- | --- |
| 1 | 1 min |
| 2 | 1 min |
| 3 | 2 min |
| 4 | 5 min |
| 5 | 15 min |

Building by building, today's time → the new one:

| Building | → 1 | → 2 | → 3 | → 4 | → 5 | → 6 (unchanged) |
| --- | --- | --- | --- | --- | --- | --- |
| Lighthouse | 54 min → **1 min** (a city starts at 2) | 1 h 13 → **1 min** (a city starts at 2) | 1 h 38 → **2 min** | 2 h 13 → **5 min** | 2 h 59 → **15 min** | 4 h 02 |
| Refinery | 36 min → **1 min** (a city starts at 1) | 54 min → **1 min** | 1 h 21 → **2 min** | 2 h 02 → **5 min** | 3 h 02 → **15 min** | 4 h 33 |
| Fishery | 36 min → **1 min** (a city starts at 1) | 54 min → **1 min** | 1 h 21 → **2 min** | 2 h 02 → **5 min** | 3 h 02 → **15 min** | 4 h 33 |
| Lumberyard | 36 min → **1 min** (a city starts at 1) | 54 min → **1 min** | 1 h 21 → **2 min** | 2 h 02 → **5 min** | 3 h 02 → **15 min** | 4 h 33 |
| Shelters | 42 min → **1 min** (a city starts at 1) | 1 h 03 → **1 min** | 1 h 35 → **2 min** | 2 h 22 → **5 min** | 3 h 33 → **15 min** | 5 h 19 |
| Barracks | 48 min → **1 min** | 1 h 12 → **1 min** | 1 h 48 → **2 min** | 2 h 42 → **5 min** | 4 h 03 → **15 min** | 6 h 05 |
| Harbor | 48 min → **1 min** | 1 h 12 → **1 min** | 1 h 48 → **2 min** | 2 h 42 → **5 min** | 4 h 03 → **15 min** | 6 h 05 |
| Observatory | 48 min → **1 min** | 1 h 12 → **1 min** | 1 h 48 → **2 min** | 2 h 42 → **5 min** | 4 h 03 → **15 min** | 6 h 05 |
| Infirmary | 42 min → **1 min** | 1 h 03 → **1 min** | 1 h 35 → **2 min** | 2 h 22 → **5 min** | 3 h 33 → **15 min** | 5 h 19 |

Costs do not change: only the time. The step from level 5 to 6 is steep (15 min, then 4 h 02 to 6 h 05): it is where the start ends.

**What A does not cap**, as in the study: research (the Observatory's techs), rafts and the raft buildings, training, healing, raft repairs, the sea. Only the nine island buildings above.

## What it does

- `shared/src/rules/buildings.ts`: `upgradeTime` takes the cap (`QUICK_LEVELS`, the table above), tests first in `shared/test/`.
- `shared/src/rules/start.ts`: the new city's stock (`STARTING_STOCK`), tests first.
- Every city: an upgrade **started after the update** gets the new time. One already under way keeps the time it was started with (no city in the database is rewritten).
- New cities only get the richer start: `newPlayerState` makes a city; a city already made keeps its stock.
- The simulation run again: `docs/balance.md` and its milestone tests (`tools/balance/balance.test.ts`) with the new reference, the owner's exception written next to the limit.
- The first hour checked in the simulator: Lighthouse 5 near 22 minutes, and how many upgrades finish in the first 10, 30 and 60 minutes.
- The tutorial and the quests ("1/18") checked against the quicker pace: no step that blocks, no text that no longer fits (a time, an "come back later"); what is found is fixed or brought to the owner.
- `docs/decisions.md`; `docs/tasks/roadmap.md`, week 10: "review the curve of Lighthouse 10 to 20 after A + C, with the late game".

## What it does not do

- No value other than these two (costs, rates, caps, other times unchanged).
- Nothing for sale, and never a reward: the same for every city.
- No city already made is changed: neither its stock nor a job under way.
- Nothing in the protected areas (`comfort.ts`, `RECRUIT_ODDS`, payments, sign-in, the notary).

## How it is tested

- `shared/test/`: each building's time at levels 1 to 6 (the table above, exactly); costs unchanged; the new stock of `newPlayerState`; a city parsed from before keeps its stock.
- The server: an upgrade started after the update gets the capped time; a job already under way keeps its time.
- `tools/balance/balance.test.ts`: the new milestones, within 10 %, except the owner's exception for the regular player's Lighthouse 15 and 20.
- The first hour, measured and written in `docs/balance.md`.
- `npm run check` and `npm run e2e` (the tutorial and the quests are played there).
