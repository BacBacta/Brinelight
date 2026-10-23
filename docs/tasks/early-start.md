# The early start: A + C

The owner's decision of 23 October, from `docs/studies/early-game.md`: the start was too slow ("my city is at Lighthouse 2"). Two balance changes, accepted value by value by the owner:

- **A. Quick first levels:** up to level 5, an island building's upgrade takes at most 1, 2, 5 or 15 minutes. For **every city**.
- **C. A richer start:** a new city starts with 2,000 wood, 1,400 oil and 800 fish, instead of 520, 380 and 420 (rope stays at 3). For **new cities only**: no city already made is changed.

The owner loosens the limit of 18 October for this change only: the regular player's Lighthouse 15 and 20 may come 13 to 15 % before week 6. The new milestones become the reference (`docs/balance.md` and the milestone tests).

**Status: A + C done (23 October), after the owner's yes on the table below and on two points:**
- research, rafts, training, healing and repairs stay uncapped, with every wait over 15 minutes they cause measured on the first hour and the quests (below);
- a job already under way keeps its time.

**The soft transition (levels 6 to 9) is measured below, not coded: the owner chooses.**

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

## Done (23 October)

- `QUICK_LEVELS` in `shared/src/rules/buildings.ts` and the new `STARTING_STOCK` in `shared/src/rules/start.ts`.
- Tests written first, then the rule:
  - `shared/test/buildings.test.ts`: the table, exactly; levels 6 and above, and the costs, unchanged;
  - `shared/test/start.test.ts`: the new start; a stored city keeps its stock, and its job under way keeps its time;
  - `server/test/actions.test.ts`: on the server, a stored city keeps its stock and its job; a new upgrade gets the quick time.
- `docs/balance.md` and `tools/balance/balance.test.ts`:
  - the new milestones are the reference;
  - week 6's limit stays for Lighthouse 15 to 30, with the owner's exception for the regular player's 15 and 20. Measured: 13.2 % and **15.4 %** sooner. The study had rounded the second to 15 %.
- **The tutorial and the quests, checked:**
  - the game's guide is the quest card ("1/18", `OBJECTIVES`) and the suggested upgrades (`client/src/city/suggest.ts`);
  - none of their texts tells a time, or says to wait or to come back, so nothing in them is out of date;
  - no quest blocks: all 18 are done by the simulated attentive player. What they wait on is below;
  - the e2e plays them.
- The measures below: `npx tsx tools/balance/start-run.ts` writes them (`tools/balance/start.ts`, with the study's rules of `early-rules.ts`, which now also write down the uncapped works and the claims).

## What A + C gives, and the soft transition

### The first hour

A player who stays the first hour sees 11 upgrades finish within 10 minutes, and 13 within 30. Lighthouse 5 comes at 22 minutes.

After that, nothing more finishes in the hour. Lighthouse 6 asks 970 wood and 4 h 02, and the wood runs out first.

### The quests

- **Quests 1 to 8** are done in the first 5 minutes.
- **Quest 9, "Beat a pirate camp", comes 10 h 19 later** with the simulated player. It is the only quest of 1 to 9 that waits on an uncapped work, and only partly:
  - the simulated player attacks only at "easy" odds. These need two batches of 20 soldiers on top of the start's 75, 48 minutes each. The first starts at once. The second waits until 7 h 24 on wood, which the simulated player keeps for the Lighthouse;
  - then it needs a free fleet, as its fleets are at the wrecks: it sails at 9 h 30;
  - then **53 minutes at sea** to the first camp. A camp is beaten when the fleet arrives.
- **As fast as the rules allow:**
  - With the start's troops, the odds on a level-1 camp are "close". That is a win: combat is decided by strength, never by chance, with more losses. The nearest camp (camp-5) is **31 minutes** away.
  - At "easy" odds: one batch (48 min), then 49 minutes to camp-2, about **1 h 40** after quest 8.
- **Quests 15 and 16** wait on the shipyard:
  - the first raft, **1 h 12**;
  - the Kelp Greenhouse put on it, **48 minutes**.
- **Quests 13 and 17** wait on wood and the night, not on an uncapped work.

**The uncapped works that block a quest for more than 15 minutes:**
- the fleet to the first camp (31 to 53 min, quest 9);
- the first raft (1 h 12, quest 15);
- the first raft building (48 min, quest 16);
- training (48 min a batch), only for a player who waits for "easy" odds before quest 9.

Research (1 h) and the wreck trips (1 h 30 to 2 h 30) block no quest: the quest counts its start.

**Caps proposed to the owner (not coded),** in A's spirit: for every city, only while the Lighthouse is below level 6, never a reward:
1. **The shipyard:** a raft, and a raft building's first level, at most 5 minutes. Quests 15 and 16: from about 2 h to about 10 min.
2. **Training:** a batch at most 5 minutes. The "easy" odds before quest 9 within about 5 minutes instead of 48.
3. **The sea, to a pirate camp only:** the trip out at most 10 minutes. Quest 9 within about 15 minutes of quest 8. The wrecks keep their trips: their loot by the hour does not change.

Each one is a balance change that would need its own measure and the owner's yes, value by value.

### The soft transition: why it is not recommended

- **Lighthouse 6 comes about 3 hours sooner** (29 h 45 instead of 33 h 02; 23 h 45 instead of 27 h 02 for the dedicated player).
- **Lighthouse 10 does not:**
  - the casual player gains 5 hours;
  - the dedicated player loses 5 hours;
  - the regular player loses 1.6 days (day 6.5 instead of 4.9).
- **Lighthouse 15 and 20 come later:**
  - the regular player's Lighthouse 15, 40 % later than A + C, and 22 % later than week 6, outside the limit;
  - the casual player's, 8 % later; the dedicated player's, 11 % later.
- **The second day is not the time of the builds; it is wood.**
  - With A + C, both builders are idle 43.9 hours of the 48 on day 2, for every profile: the player is short of wood (the Lumberyard makes a few dozen an hour, and Lighthouse 6 asks 970).
  - With the transition: 47.2 hours, and fewer upgrades finish (2 instead of 2 to 4).
  - Quicker builds spend the wood sooner, on the other buildings, and the Lighthouse waits longer for its own.
- The study had seen the same with A carried to level 9: shorter builds alone slow the regular player down.

**What would help day 2: wood, not time.** To look at with the economy of week 10 (`docs/tasks/roadmap.md`: "review the curve of Lighthouse 10 to 20 after A + C").

<!-- start:generated:start (npx tsx tools/balance/start-run.ts) -->

### The first hour

A new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual player.

| Variant | Upgrades finished within 10 min | 30 min | 60 min | Lighthouse 5 at | Lighthouse after 1 h |
| --- | --- | --- | --- | --- | --- |
| A + C (the rules) | 11 | 13 | 13 | 22 min | 5 |
| A + C + soft transition | 11 | 13 | 13 | 22 min | 5 |

### The quests, and the uncapped works (A + C)

An attentive player, there every minute from 8:00 to 22:00, who plays as the balance's players (the Lighthouse first, its wood kept; a camp only at easy odds). A quest waited on an uncapped work (research, training, healing, the shipyard, the sea) when that work was done in the minute before the quest was claimed (a fleet: when it arrives).

| Quest | Claimed at | After the one before | Waited on an uncapped work |
| --- | --- | --- | --- |
| 1. Upgrade the Refinery to level 2 | 5 min | 5 min | no |
| 2. Build the Barracks | 5 min | 0 min | no |
| 3. Build the Harbor | 5 min | 0 min | no |
| 4. Build the Observatory | 5 min | 0 min | no |
| 5. Start your first research | 5 min | 0 min | no |
| 6. Send a fleet to gather at sea | 5 min | 0 min | no |
| 7. Upgrade the Lighthouse to level 3 | 5 min | 0 min | no |
| 8. Train troops at the Barracks | 5 min | 0 min | no |
| 9. Beat a pirate camp | 10 h 24 | 10 h 19 | fleet to camp-1, 53 min out, from 9 h 30 |
| 10. Build the Infirmary | 10 h 24 | 0 min | no |
| 11. Keep the Lighthouse stoked through a Mist | 10 h 24 | 0 min | no |
| 12. Upgrade the Lumberyard to level 3 | 10 h 24 | 0 min | no |
| 13. Upgrade the Shelters to level 3 | 24 h 08 | 13 h 44 | no |
| 14. Upgrade the Lighthouse to level 4 | 24 h 08 | 0 min | no |
| 15. Moor your first raft | 25 h 12 | 1 h 04 | shipyard: raft, 1 h 12, from 24 h |
| 16. Put a Kelp Greenhouse on a raft | 26 h | 48 min | shipyard: install, 48 min, from 25 h 12 |
| 17. Upgrade the Harbor to level 3 | 2 d 1 h | 23 h 46 | no |
| 18. Bring the Lighthouse to level 5 | 2 d 1 h | 0 min | no |

Uncapped works longer than 15 minutes, started before quest 9 was claimed:

| Uncapped work | Started at | Took | Blocked a quest |
| --- | --- | --- | --- |
| fleet to wreck-6 | 3 h 04 | 2 h 27 | no |
| fleet to wreck-6 | 7 h 03 | 2 h 27 | no |
| fleet to wreck-1 | 1 h 50 | 2 h 17 | no |
| fleet to wreck-1 | 5 h 54 | 2 h 17 | no |
| fleet to camp-1 | 9 h 30 | 1 h 54 | quest 9 |
| fleet to wreck-5 | 3 min | 1 h 47 | no |
| fleet to wreck-5 | 4 h 07 | 1 h 47 | no |
| fleet to wreck-5 | 8 h 11 | 1 h 47 | no |
| fleet to wreck-8 | 0 min | 1 h 32 | no |
| fleet to wreck-8 | 1 h 32 | 1 h 32 | no |
| fleet to wreck-8 | 5 h 31 | 1 h 32 | no |
| fleet to wreck-8 | 9 h 58 | 1 h 32 | no |
| research refining | 2 min | 1 h | no |
| research saws | 6 h 39 | 1 h | no |
| research nets | 7 h 41 | 1 h | no |
| research sails | 9 h 20 | 1 h | no |
| train 20 boarders | 1 min | 48 min | no |
| train 20 harpooners | 7 h 24 | 48 min | no |
| train 20 crossbowmen | 9 h 30 | 48 min | no |
| heal the wounded | 10 h 24 | 25 min | no |

### The soft transition (not in the game): its times

| Building | → 6 | → 7 | → 8 | → 9 | → 10 (unchanged) |
| --- | --- | --- | --- | --- | --- |
| Lighthouse | 4 h 02 → **45 min** | 5 h 27 → **1 h 30** | 7 h 21 → **3 h** | 9 h 56 → **5 h** | 13 h 24 |
| Refinery | 4 h 33 → **50 min** | 6 h 50 → **1 h 55** | 10 h 15 → **4 h 10** | 15 h 23 → **7 h 45** | 23 h 04 |
| Fishery | 4 h 33 → **50 min** | 6 h 50 → **1 h 55** | 10 h 15 → **4 h 10** | 15 h 23 → **7 h 45** | 23 h 04 |
| Lumberyard | 4 h 33 → **50 min** | 6 h 50 → **1 h 55** | 10 h 15 → **4 h 10** | 15 h 23 → **7 h 45** | 23 h 04 |
| Shelters | 5 h 19 → **1 h** | 7 h 58 → **2 h 10** | 11 h 58 → **4 h 55** | 17 h 56 → **9 h** | 26 h 55 |
| Barracks | 6 h 05 → **1 h 10** | 9 h 07 → **2 h 30** | 13 h 40 → **5 h 35** | 20 h 30 → **10 h 20** | 30 h 45 |
| Harbor | 6 h 05 → **1 h 10** | 9 h 07 → **2 h 30** | 13 h 40 → **5 h 35** | 20 h 30 → **10 h 20** | 30 h 45 |
| Observatory | 6 h 05 → **1 h 10** | 9 h 07 → **2 h 30** | 13 h 40 → **5 h 35** | 20 h 30 → **10 h 20** | 30 h 45 |
| Infirmary | 5 h 19 → **1 h** | 7 h 58 → **2 h 10** | 11 h 58 → **4 h 55** | 17 h 56 → **9 h** | 26 h 55 |

### Milestones: A + C, and A + C with the soft transition

Lighthouse 5 to 10: time after the founding. 15 and 20: the day, against A + C (the reference since 23 October) and against week 6.

| Variant | Profile | Lighthouse 5 | 6 | 8 | 10 | 15 (vs A + C; vs week 6) | 20 (vs A + C; vs week 6) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A + C (the rules) | Casual (3 sessions) | 13 h 15 | 33 h 02 | 3 d 7 h | 6 d 18 h | day 25.5 (0 %; -1.9 %) | day 64.6 (0 %; +2.5 %) |
| A + C (the rules) | Regular (6 sessions) | 5 h 15 | 33 h 02 | 2 d 18 h | 4 d 21 h | day 17.1 (0 %; -13.3 %) | day 44.5 (0 %; -15.5 %) |
| A + C (the rules) | Dedicated (10 sessions) | 2 h 35 | 27 h 02 | 3 d 6 h | 5 d 14 h | day 16.7 (0 %; -4.7 %) | day 46.0 (0 %; +1.9 %) |
| A + C + soft transition | Casual (3 sessions) | 13 h 15 | 29 h 45 | 3 d 3 h | 6 d 13 h | day 27.5 (+7.8 %; +5.8 %) | day 68.6 (+6.2 %; +8.8 %) |
| A + C + soft transition | Regular (6 sessions) | 5 h 15 | 29 h 45 | 3 d 2 h | 6 d 12 h | day 24.0 (+40.2 %; +21.6 %) | day 54.0 (+21.4 %; +2.6 %) |
| A + C + soft transition | Dedicated (10 sessions) | 2 h 35 | 23 h 45 | 3 d 2 h | 5 d 19 h | day 18.5 (+10.7 %; +5.5 %) | day 48.0 (+4.2 %; +6.1 %) |

### The second day

The calendar day after the founding. Builders idle: hours with a builder free (two builders: up to 48 hours), the player away or short of resources.

| Variant | Profile | Builders idle on day 2 (hours, both builders) | Upgrades finished on day 2 | Longest upgrade started on day 2 |
| --- | --- | --- | --- | --- |
| A + C (the rules) | Casual (3 sessions) | 43.9 | 2 | lighthouse 6, 4 h 02 |
| A + C (the rules) | Regular (6 sessions) | 43.9 | 3 | lighthouse 6, 4 h 02 |
| A + C (the rules) | Dedicated (10 sessions) | 43.9 | 4 | lighthouse 6, 4 h 02 |
| A + C + soft transition | Casual (3 sessions) | 47.2 | 2 | lighthouse 6, 45 min |
| A + C + soft transition | Regular (6 sessions) | 47.2 | 2 | lighthouse 6, 45 min |
| A + C + soft transition | Dedicated (10 sessions) | 47.2 | 2 | lighthouse 6, 45 min |

<!-- start:generated:end -->
