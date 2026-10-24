# The early start: A + C

The owner's decision of 23 October, from `docs/studies/early-game.md`: the start was too slow ("my city is at Lighthouse 2"). Two balance changes, accepted value by value by the owner:

- **A. Quick first levels:** up to level 5, an island building's upgrade takes at most 1, 2, 5 or 15 minutes. For **every city**.
- **C. A richer start:** a new city starts with 2,000 wood, 1,400 oil and 800 fish, instead of 520, 380 and 420 (rope stays at 3). For **new cities only**: no city already made is changed.

- **Three caps on works A does not cap**, accepted value by value by the owner the same day, for **every city** and only **while the Lighthouse is below level 6**:
  - the city's first raft, and a raft building's first level: at most 5 minutes;
  - a batch of soldiers: at most 5 minutes;
  - a fleet's way out to a pirate camp: at most 10 minutes (its way back, the wrecks and the Leviathan keep their trips).

The owner loosens the limit of 18 October for this change only: the regular player's Lighthouse 15 and 20 may come 13.2 % and 15.4 % before week 6. The new milestones become the reference (`docs/balance.md` and the milestone tests).

**Status: done (23 October).**
- A + C, after the owner's yes on the table below; a job already under way keeps its time.
- The three caps, after the waits over 15 minutes that research, rafts, training, healing, repairs and the sea caused were measured on the first hour and the quests (below), and the owner's yes on each value.
- **The soft transition (levels 6 to 9): measured, then abandoned by the owner.** Day 2 is short of wood, not of build time: week 10 starts there (`docs/tasks/roadmap.md`).

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

**What A does not cap**, as in the study: research (the Observatory's techs), rafts and the raft buildings, training, healing, raft repairs, the sea. Only the nine island buildings above. Three of these have their own cap below Lighthouse 6 (above, and `shared/src/rules/early.ts`): the first raft, a raft building's first level, a batch of soldiers, and the way out to a camp.

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

### The quests, before the three caps (A + C alone)

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

### The quests with the three caps (owner's yes of 23 October, done)

The caps: the first raft, a raft building's first level and a batch of soldiers at most 5 minutes, and the way out to a pirate camp at most 10 minutes, while the Lighthouse is below level 6 (`shared/src/rules/early.ts`, tests in `shared/test/early.test.ts`).

**A player who follows the quests** (a new simulated player, `questFirst` in `tools/balance/simulate.ts`):
- there every minute;
- at each session, the current quest's own action first;
- no wood kept for the Lighthouse, one builder and one fleet kept for the quests;
- a camp attacked at any odds it wins.

What it gives:
- **quest 9 at 14 minutes**, 10 minutes after quest 8: the way out to the camp;
- **quest 15** waits on nothing: its first raft (5 minutes) is already moored when the quest comes;
- **quest 16** 5 minutes later: the Kelp Greenhouse;
- all 18 quests are done at **8 h 50**. What remains is wood and the Mist's hours, never an uncapped work over 15 minutes. (Since the Mist's quest moved: 5 h 40, below.)

**The balance's players** keep the Lighthouse's wood and attack only at easy odds:
- the attentive one beats its first camp at 1 h 42 (10 h 24 before the caps);
- it reaches quests 15 and 16 only on day 2, past Lighthouse 6, where the caps no longer hold;
- the Lighthouse milestones of the three profiles do not move (`docs/balance.md`).

### The Mist's quest moved (owner's decision of 23 October, done)

The eleventh quest waited for the Mist: it comes at fixed hours (three times a day), so in the middle of the tutorial the player waited hours they could neither choose nor shorten (4 h 44 for the player who follows the quests, founded at 8:00).

- **Quest 11** is now "Keep 500 oil in store for the Mist": done if the city holds 500 oil or more when you claim it; its reward is unchanged (250 oil). A Mist burns 23 to 38 oil at Lighthouse 3 to 5, so 500 leaves a wide margin.
- **Quest 19** is the real Mist, with its text: "Keep the Lighthouse stoked through a Mist", 250 oil. The quest card shows "1/19".
- **A city that had claimed the Mist** (its quest past the eleventh, shape 10) has the nineteenth marked as claimed (`claimedAhead`, shape 11): its reward is never paid twice. A city that had claimed all 18 has nothing left.

What it gives, for the player who follows the quests: quest 11 at 1 h 16, with no wait; the first 18 at **5 h 40** (8 h 50 before); the nineteenth at 6 h, when the first Mist lifts. A casual player who follows the quests ends them on day 5 at 13:00, as before: a Mist passes between their sessions, and the Lighthouse holds it on its own.

### The soft transition: abandoned by the owner (23 October)

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

**What would help day 2: wood, not time.** The first point of week 10 (`docs/tasks/roadmap.md`), with 44 hours of 48 as the measure to bring down.

Since E (the producers' curve and the isles and shoals, 23 October, `docs/studies/resources.md`), the tables below are those of today's rules, played by the balance's players who keep the reserve only on what a spending uses; the figures in the text above are those of A + C before E. With E and the Mist's quest moved, the player who follows the quests ends the first 18 at **2 h 15** and the nineteenth at 6 h, when the first Mist lifts; the casual player who follows them ends all 19 at 13 h 50.

<!-- start:generated:start (npx tsx tools/balance/start-run.ts) -->

### The first hour

A new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual player.

| Variant | Upgrades finished within 10 min | 30 min | 60 min | Lighthouse 5 at | Lighthouse after 1 h |
| --- | --- | --- | --- | --- | --- |
| A + C (the rules) | 10 | 11 | 12 | 46 min | 5 |
| A + C + soft transition | 10 | 11 | 12 | 46 min | 5 |

### The quests, for a player who follows them (A + C and the three caps)

There every minute from 8:00 to 22:00. At each session, the current quest's own action first, with no wood kept for the Lighthouse, and a camp attacked at any odds it wins. A quest waited on an uncapped work (research, training, healing, the shipyard, the sea) when that work was done in the minute before the quest was claimed (a fleet: when it arrives).

| Quest | Claimed at | After the one before | Waited on an uncapped work |
| --- | --- | --- | --- |
| 1. Upgrade the Refinery to level 2 | 1 min | 1 min | no |
| 2. Build the Barracks | 2 min | 1 min | no |
| 3. Build the Harbor | 3 min | 1 min | no |
| 4. Build the Observatory | 4 min | 1 min | no |
| 5. Start your first research | 4 min | 0 min | no |
| 6. Send a fleet to gather at sea | 4 min | 0 min | no |
| 7. Upgrade the Lighthouse to level 3 | 4 min | 0 min | no |
| 8. Train troops at the Barracks | 4 min | 0 min | no |
| 9. Beat a pirate camp | 14 min | 10 min | fleet to camp-1, 10 min out, from 4 min |
| 10. Build the Infirmary | 53 min | 39 min | no |
| 11. Keep 500 oil in store for the Mist | 53 min | 0 min | no |
| 12. Upgrade the Lumberyard to level 3 | 55 min | 2 min | no |
| 13. Upgrade the Shelters to level 3 | 1 h 58 | 1 h 03 | no |
| 14. Upgrade the Lighthouse to level 4 | 1 h 58 | 0 min | no |
| 15. Moor your first raft | 1 h 58 | 0 min | no |
| 16. Put a Kelp Greenhouse on a raft | 2 h 03 | 5 min | shipyard: install, 5 min, from 1 h 58 |
| 17. Upgrade the Harbor to level 3 | 2 h 15 | 12 min | no |
| 18. Bring the Lighthouse to level 5 | 2 h 15 | 0 min | no |
| 19. Keep the Lighthouse stoked through a Mist | 6 h | 3 h 45 | no |

Uncapped works longer than 15 minutes, started before quest 9 was claimed:

| Uncapped work | Started at | Took | Blocked a quest |
| --- | --- | --- | --- |
| fleet to wreck-8 | 3 min | 1 h 32 | no |
| fleet to camp-1 | 4 min | 1 h 11 | quest 9 |
| research refining | 4 min | 1 h | no |

### The quests, for the balance's attentive player

The same sessions, played as the balance's players: the Lighthouse first, its wood kept; a camp only at easy odds.

| Quest | Claimed at | After the one before | Waited on an uncapped work |
| --- | --- | --- | --- |
| 1. Upgrade the Refinery to level 2 | 5 min | 5 min | no |
| 2. Build the Barracks | 5 min | 0 min | no |
| 3. Build the Harbor | 5 min | 0 min | no |
| 4. Build the Observatory | 5 min | 0 min | no |
| 5. Start your first research | 5 min | 0 min | no |
| 6. Send a fleet to gather at sea | 1 h 30 | 1 h 25 | fleet to camp-1, 10 min out, from 1 h 20 |
| 7. Upgrade the Lighthouse to level 3 | 1 h 30 | 0 min | no |
| 8. Train troops at the Barracks | 1 h 30 | 0 min | no |
| 9. Beat a pirate camp | 1 h 30 | 0 min | no |
| 10. Build the Infirmary | 1 h 30 | 0 min | no |
| 11. Keep 500 oil in store for the Mist | 2 h 31 | 1 h 01 | no |
| 12. Upgrade the Lumberyard to level 3 | 2 h 31 | 0 min | no |
| 13. Upgrade the Shelters to level 3 | 11 h 03 | 8 h 32 | no |
| 14. Upgrade the Lighthouse to level 4 | 11 h 03 | 0 min | no |
| 15. Moor your first raft | 12 h 34 | 1 h 31 | shipyard: raft, 1 h 12, from 11 h 22 |
| 16. Put a Kelp Greenhouse on a raft | 13 h 50 | 1 h 16 | shipyard: install, 48 min, from 13 h 02 |
| 17. Upgrade the Harbor to level 3 | 13 h 50 | 0 min | no |
| 18. Bring the Lighthouse to level 5 | 13 h 50 | 0 min | no |
| 19. Keep the Lighthouse stoked through a Mist | 13 h 50 | 0 min | no |

Uncapped works longer than 15 minutes, started before quest 9 was claimed:

| Uncapped work | Started at | Took | Blocked a quest |
| --- | --- | --- | --- |
| fleet to wreck-8 | 1 h 30 | 1 h 32 | no |
| fleet to fish-2 | 0 min | 1 h 30 | no |
| fleet to isle-1 | 3 min | 1 h 17 | no |
| fleet to camp-1 | 1 h 20 | 1 h 11 | quest 6 |
| research refining | 2 min | 1 h | no |
| heal the wounded | 1 h 30 | 26 min | no |

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
| A + C (the rules) | Casual (3 sessions) | 13 h 15 | 28 h 02 | 2 d 12 h | 4 d 13 h | day 16.0 (0 %; -38.3 %) | day 42.6 (0 %; -32.5 %) |
| A + C (the rules) | Regular (6 sessions) | 5 h 15 | 15 h 02 | 39 h 21 | 3 d 12 h | day 12.5 (0 %; -36.7 %) | day 38.0 (0 %; -27.8 %) |
| A + C (the rules) | Dedicated (10 sessions) | 2 h 35 | 13 h 02 | 33 h 41 | 2 d 19 h | day 11.5 (0 %; -34.5 %) | day 37.0 (0 %; -18.2 %) |
| A + C + soft transition | Casual (3 sessions) | 13 h 15 | 24 h 45 | 2 d 8 h | 4 d 13 h | day 16.0 (0 %; -38.3 %) | day 43.2 (+1.6 %; -31.4 %) |
| A + C + soft transition | Regular (6 sessions) | 5 h 15 | 11 h 45 | 32 h | 3 d 3 h | day 12.6 (+1 %; -36.1 %) | day 38.3 (+1 %; -27.1 %) |
| A + C + soft transition | Dedicated (10 sessions) | 2 h 35 | 9 h 45 | 26 h | 2 d 15 h | day 11.5 (0 %; -34.5 %) | day 37.0 (0 %; -18.2 %) |

### The second day

The calendar day after the founding. Builders idle: hours with a builder free (two builders: up to 48 hours), the player away or short of resources.

| Variant | Profile | Builders idle on day 2 (hours, both builders) | Upgrades finished on day 2 | Longest upgrade started on day 2 |
| --- | --- | --- | --- | --- |
| A + C (the rules) | Casual (3 sessions) | 40.9 | 3 | lighthouse 7, 5 h 27 |
| A + C (the rules) | Regular (6 sessions) | 35.1 | 9 | lighthouse 8, 7 h 21 |
| A + C (the rules) | Dedicated (10 sessions) | 34.9 | 12 | lighthouse 9, 9 h 56 |
| A + C + soft transition | Casual (3 sessions) | 45.7 | 4 | lighthouse 7, 1 h 30 |
| A + C + soft transition | Regular (6 sessions) | 43.4 | 7 | lighthouse 8, 3 h |
| A + C + soft transition | Dedicated (10 sessions) | 39.8 | 8 | lighthouse 9, 5 h |

<!-- start:generated:end -->
