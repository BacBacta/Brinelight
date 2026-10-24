# The build times, levels 6 to 30 (study)

**The owner chose the slower curve on 24 October; it is in the game since (`BUILD_MINUTES` in `shared/src/rules/buildings.ts`, `docs/decisions.md`).** The study is kept as it was measured: "today" below means the times before 24 October, frozen in `tools/balance/durations.ts` (`beforeTime`) so that `durations-run.ts` still plays them; the slower curve is now the rules' own.

A study only (owner's request, 24 October). It changes no value. It measures today's build times level by level, then two curves for levels 6 to 30 built on the player's day, played by the balance's simulator with E in place, and the alliance's help. **Nothing goes into the game without the owner's agreement, value by value.**

The owner's starting point: from 15 minutes at level 5, a build jumps to 4 to 6 hours at level 6, and the gap keeps growing until years at level 30. With E, wood no longer holds the owner's city back (9,900 in stock); the builds do. The reason the "soft transition" was set aside (day 2 short of wood, not of time) no longer holds.

## How it is measured

- **The players:** the balance's three (casual: 3 sessions a day at 8:00, 13:00 and 21:00; regular: 6; dedicated: 10), with today's rules (E since 23 October). They keep the Lighthouse's reserve only on what a spending uses. They are played for **two years**.
- **The other times are played in place of the rules by the study alone.**
  - `tools/balance/durations-rules.ts` replaces an upgrade's time when it starts (the times before 24 October, or the faster curve). It also applies the cost option and the alliance's help when the study asks for them, and writes down what the builders do, hour by hour.
  - `tools/balance/durations-hooks.mjs` gives it to the simulator in place of `@brinelight/shared`. Nothing in `shared/` changes.
  - With the rules' own times (the slower curve since 24 October), the runs are the balance's own: the study checks they give the milestones of `docs/balance.md` exactly, or it stops.
- **What the builders do**, by the Lighthouse's level at the time, in shares of the two builders' time:
  - **at work**;
  - **free, the player away**: something could start (paid in full, the Lighthouse's reserve kept), but the player is not there until the next session;
  - **free, nothing to start**: short of resources (the reserve included), or every building already at the Lighthouse's level;
  - **everything waits for a build**: both builders at work while the city could pay for something else.
- **Reproduce:** `npx tsx tools/balance/durations-run.ts` (about a minute). It writes the tables at the end of this page. The curves' tests are in `tools/balance/durations.test.ts`.

## What it finds

1. **Today's times have one cliff and one runaway** (table 1).
   - The cliff: **level 5 → 6 is ×16 for the Lighthouse, ×18 to ×24 for the other buildings** (15 minutes to 4 to 6 hours). Before it, each level is ×1 to ×3.
   - The runaway: past level 6, every other building takes ×1.5 the level before, all the way to 30. The Lighthouse takes ×1.35, then ×1.2 past level 15.
     - At level 20, the producers take 55 days, the Barracks 74.
     - Level 30 takes 8.8 to 11.7 years.
     - The Lighthouse's own level 30 takes 43 days.
   - **From level 6 on, the Lighthouse is shorter than every other building of its level** (4 h 02 against 4 h 33 to 6 h 05 at level 6), and the gap only grows.
   - What the players live: from Lighthouse 11 on, the builders are at work 83 to 100 % of the time, and **everything waits for a build 71 to 99 % of the time** (table 3, builders). Resources almost never hold a builder back (0 to 3 % of sessions). The owner's reading is right: the builds are the brake.
2. **The owner's bands, taken together, cannot all hold on a curve without a cliff.**
   - With each level rising less than the one before, a level 20 within a night (about 10 to 12 hours) caps level 21 near 14 hours and level 30 near 2 days.
   - A level 21 of a day or more needs a level 20 of about 20 hours.
   - Hence two curves:
     - **Faster** keeps the night at level 20 (12 h 34 for the producers). Its levels 21 to 24 take less than a day.
     - **Slower** keeps 1 to 5 days for levels 21 to 30 (23 h 39 to 3 d 12 h for the producers, 4 d 16 h for the Barracks). Its levels 18 to 20 take 14 to 25 hours, a night and a morning.
3. **With either curve, the builds are no longer the brake; the resources are, wood above all** (table 3).
   - The Lighthouse's milestones move little between the two curves: by 3 days at most up to Lighthouse 20. At Lighthouse 25 and 30, the slower curve is 2 to 10 days later for the regular and dedicated players, and 9 to 13 days sooner for the casual one.
   - From Lighthouse 11 on, a builder is free with nothing to start **68 to 90 % of the time**. 96 to 98 % of sessions end with a builder free, 75 to 88 % of them for lack of wood.
   - From Lighthouse 11 on, everything waits for a build less than 10 % of the time.
   - The wall moves from the builds to the costs: the other buildings cost ×1.6 a level, while a producer adds the same production at each level.
4. **A wall hidden before: the other buildings can never pass level 21 or 22** (table 3, storage).
   - Their level 22 or 23 costs more than the storage holds at Lighthouse 30 with every Sealed Warehouses (2.6 million): 2.7 to 3.4 million wood.
   - Today the years of build hide it. With the curves, the regular player has the Lighthouse at 30 on day 185, then the others stop at 21 to 23 for good.
   - "The whole city at 30" takes 134 days of builds with two builders on the slower curve, and never happens with today's costs.
5. **The costs past level 15 are to review** (a cost option, measured only, never proposed as a value here).
   - The other buildings costing ×1.1 a level past 15 (not ×1.6) brings the whole city to 30 on day 665 for the regular player, and ×1.05 on day 506.
   - The Lighthouse's milestones do not move: it keeps its costs.
   - What to change is a study of its own: costs and production past level 15, now that the builds no longer hold them back.
6. **The casual player** (table 3, casual).
   - With either curve, every build of levels 6 to 10 ends before the next session. The builder then waits about 6 hours for the player.
   - Of levels 11 to 20, half end before the next session on the faster curve, a third on the slower one.
   - Today: 31 % of levels 6 to 10, and none above.
7. **The end of the game** (table 3, the regular player's last levels).
   - On the slower curve, each Lighthouse level from 25 takes 15 to 31 days, against 21 to 44 today. Every level stays within a month, and the Lighthouse never meets the storage's wall.
   - Lighthouse 30 comes on day 185 (6.1 months) for the regular player, day 249 (8.2 months) for the casual one, and day 166 (5.4 months) for the dedicated one.

## The game's length: a proposal

- **Lighthouse 30 in 6 to 7 months for the regular player** (the slower curve: 6.1), 8 to 9 for the casual one, never under 5 for the dedicated one.
- **The end of the game:** Lighthouse 25 → 30 in about 3 to 4 months, **no level over a month**, and no storage wall for the Lighthouse.
- **A second, longer goal:** the whole city at 30, in about a year and a half for the regular player. It needs the costs of the other buildings past level 15 reviewed (finding 5): ×1.05 a level gives 17 months, ×1.1 gives 22.
- What sets these dates is no longer the builds but the costs:
  - lengthening the game past 7 months goes through the Lighthouse's last costs;
  - shortening the whole city's goal goes through the other buildings' costs.
  - The durations only set how the days feel.

## The alliance's help

The idea: each member can touch an ally's build to take a few minutes off it, a limited number of times.

**Is it compatible with the game's principles? Yes, with four conditions.**

- **It is never for sale.**
  - No help can be bought or traded.
  - It adds nothing to the paid convenience.
  - The alliance seats that give it are never for sale already (`CLAUDE.md`).
- **It is never a reward.** No objective, chest, event or Tide gives helps. The principle "speed-ups are never rewards" stays whole: a help is a gesture between players, not a prize.
- **It is a fixed number of minutes, a few times a build, only from level 6.** Never a share of the build: a share would make the help's worth grow with the build.
- **It can only help.** It touches a timer and nothing else of the ally's city, as the rule "a city can never be attacked" asks.

A limit to keep in mind: a player could make extra accounts to help themselves. The cap per build makes this worth little (at most 30 minutes a build in the study).

**Its effect, measured** (table 5, on the slower curve; 10 allies, 3 minutes each, never more than half the build, every help assumed given):

- it takes 3 to 4 % off the builds' time;
- the milestones move by 2 days at most, and rather later: the builds end sooner, so other spendings come sooner, and the resources set the pace.

Its worth is social: a reason to open the game and see one's allies. It does nothing for the pace. **Proposal:** keep it for when alliances come, with the Tides, under the four conditions above. It is not needed to fix the builds.

## Recommendation

**The slower curve, for levels 6 to 30** (all its values: table 2, "Slower"; levels 1 to 5 unchanged).

- The producers' time to reach level L is `15 min × exp(0.9884 × (L − 5)^0.5506)`, rounded to the minute.
  - Level 6 in 40 minutes, level 10 in 2 h 45, level 30 in 3 d 12 h.
- Every other building follows the same curve, rising a little faster: at level 30 it takes today's proportions of the producers' time.
  - Shelters and Infirmary: × 7/6, so 4 d 2 h.
  - Barracks, Harbor and Observatory: × 8/6, so 4 d 16 h.
  - The Lighthouse: × 1.6, so 5 d 14 h, the longest of its level from level 6 on.
- Why the slower one:
  - it keeps the owner's 1 to 5 days for levels 21 to 30, and a Lighthouse a little longer, never weeks;
  - it costs little pace against the faster one: 3 days at most up to Lighthouse 20, and at Lighthouse 30 6 to 10 days later for the regular and dedicated players, 13 days sooner for the casual one;
  - its builders are at work a little more from Lighthouse 11 (11 to 24 % of the time, against 6 to 14 %).
- What it does not fix: the resources become the brake from Lighthouse 6 to 10 on, and the other buildings meet the storage's wall at 22 and 23. **The next study should be the costs past level 15** (finding 5), before or with this curve.

If the owner agrees, value by value:

- the curve goes into `shared/src/rules/buildings.ts`, with its tests first;
- a build under way keeps the time it started with;
- the balance's reference (`docs/balance.md`) and its milestone tests are run again.

## The tables

<!-- durations:generated:start (npx tsx tools/balance/durations-run.ts) -->

### 1. The build times before 24 October

The time to reach each level from the one before (the rules' `upgradeTime` until 24 October), and its ratio to the level before. The buildings of a column share their times.

| Level | Lighthouse | ratio | Refinery, Fishery, Lumberyard | ratio | Shelters, Infirmary | ratio | Barracks, Harbor, Observatory | ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 min |  | 1 min |  | 1 min |  | 1 min |  |
| 2 | 1 min | ×1.00 | 1 min | ×1.00 | 1 min | ×1.00 | 1 min | ×1.00 |
| 3 | 2 min | ×2.00 | 2 min | ×2.00 | 2 min | ×2.00 | 2 min | ×2.00 |
| 4 | 5 min | ×2.50 | 5 min | ×2.50 | 5 min | ×2.50 | 5 min | ×2.50 |
| 5 | 15 min | ×3.00 | 15 min | ×3.00 | 15 min | ×3.00 | 15 min | ×3.00 |
| 6 | 4 h 02 | ×16.14 | 4 h 33 | ×18.23 | 5 h 19 | ×21.26 | 6 h 05 | ×24.30 |
| 7 | 5 h 27 | ×1.35 | 6 h 50 | ×1.50 | 7 h 58 | ×1.50 | 9 h 07 | ×1.50 |
| 8 | 7 h 21 | ×1.35 | 10 h 15 | ×1.50 | 11 h 58 | ×1.50 | 13 h 40 | ×1.50 |
| 9 | 9 h 56 | ×1.35 | 15 h 23 | ×1.50 | 17 h 56 | ×1.50 | 20 h 30 | ×1.50 |
| 10 | 13 h 24 | ×1.35 | 23 h 04 | ×1.50 | 26 h 55 | ×1.50 | 30 h 45 | ×1.50 |
| 11 | 18 h 06 | ×1.35 | 34 h 36 | ×1.50 | 40 h 22 | ×1.50 | 46 h 08 | ×1.50 |
| 12 | 24 h 26 | ×1.35 | 2 d 3 h | ×1.50 | 2 d 12 h | ×1.50 | 2 d 21 h | ×1.50 |
| 13 | 32 h 59 | ×1.35 | 3 d 5 h | ×1.50 | 3 d 18 h | ×1.50 | 4 d 7 h | ×1.50 |
| 14 | 44 h 31 | ×1.35 | 4 d 20 h | ×1.50 | 5 d 16 h | ×1.50 | 6 d 11 h | ×1.50 |
| 15 | 2 d 12 h | ×1.35 | 7 d 7 h | ×1.50 | 8 d 12 h | ×1.50 | 9 d 17 h | ×1.50 |
| 16 | 3 d 9 h | ×1.35 | 10 d 22 h | ×1.50 | 12 d 18 h | ×1.50 | 14 d 14 h | ×1.50 |
| 17 | 4 d 1 h | ×1.20 | 16 d 10 h | ×1.50 | 19 d 3 h | ×1.50 | 21 d 21 h | ×1.50 |
| 18 | 4 d 20 h | ×1.20 | 24 d 15 h | ×1.50 | 28 d 17 h | ×1.50 | 32 d 20 h | ×1.50 |
| 19 | 5 d 20 h | ×1.20 | 36 d 22 h | ×1.50 | 43 d 2 h | ×1.50 | 49 d 6 h | ×1.50 |
| 20 | 7 d | ×1.20 | 55 d 10 h | ×1.50 | 64 d 15 h | ×1.50 | 73 d 21 h | ×1.50 |
| 21 | 8 d 9 h | ×1.20 | 83 d 3 h | ×1.50 | 96 d 23 h | ×1.50 | 110 d 20 h | ×1.50 |
| 22 | 10 d 2 h | ×1.20 | 124 d 16 h | ×1.50 | 145 d 11 h | ×1.50 | 166 d 6 h | ×1.50 |
| 23 | 12 d 2 h | ×1.20 | 187 d 1 h | ×1.50 | 218 d 5 h | ×1.50 | 249 d 9 h | ×1.50 |
| 24 | 14 d 12 h | ×1.20 | 280 d 13 h | ×1.50 | 327 d 7 h | ×1.50 | 1.0 y | ×1.50 |
| 25 | 17 d 10 h | ×1.20 | 1.2 y | ×1.50 | 1.3 y | ×1.50 | 1.5 y | ×1.50 |
| 26 | 20 d 22 h | ×1.20 | 1.7 y | ×1.50 | 2.0 y | ×1.50 | 2.3 y | ×1.50 |
| 27 | 25 d 2 h | ×1.20 | 2.6 y | ×1.50 | 3.0 y | ×1.50 | 3.5 y | ×1.50 |
| 28 | 30 d 3 h | ×1.20 | 3.9 y | ×1.50 | 4.5 y | ×1.50 | 5.2 y | ×1.50 |
| 29 | 36 d 4 h | ×1.20 | 5.8 y | ×1.50 | 6.8 y | ×1.50 | 7.8 y | ×1.50 |
| 30 | 43 d 9 h | ×1.20 | 8.8 y | ×1.50 | 10.2 y | ×1.50 | 11.7 y | ×1.50 |

### 2. The two curves

#### Faster: level 10 in 2 h, level 30 in 2 d (producers; k = 0.8225, p = 0.5763)

| Level | Lighthouse | ratio | Refinery, Fishery, Lumberyard | ratio | Shelters, Infirmary | ratio | Barracks, Harbor, Observatory | ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 min |  | 1 min |  | 1 min |  | 1 min |  |
| 2 | 1 min | ×1.00 | 1 min | ×1.00 | 1 min | ×1.00 | 1 min | ×1.00 |
| 3 | 2 min | ×2.00 | 2 min | ×2.00 | 2 min | ×2.00 | 2 min | ×2.00 |
| 4 | 5 min | ×2.50 | 5 min | ×2.50 | 5 min | ×2.50 | 5 min | ×2.50 |
| 5 | 15 min | ×3.00 | 15 min | ×3.00 | 15 min | ×3.00 | 15 min | ×3.00 |
| 6 | 37 min | ×2.47 | 34 min | ×2.27 | 35 min | ×2.33 | 36 min | ×2.40 |
| 7 | 57 min | ×1.54 | 51 min | ×1.50 | 53 min | ×1.51 | 55 min | ×1.53 |
| 8 | 1 h 21 | ×1.42 | 1 h 11 | ×1.39 | 1 h 14 | ×1.40 | 1 h 17 | ×1.40 |
| 9 | 1 h 50 | ×1.36 | 1 h 33 | ×1.31 | 1 h 39 | ×1.34 | 1 h 43 | ×1.34 |
| 10 | 2 h 25 | ×1.32 | 2 h | ×1.29 | 2 h 08 | ×1.29 | 2 h 14 | ×1.30 |
| 11 | 3 h 06 | ×1.28 | 2 h 31 | ×1.26 | 2 h 42 | ×1.27 | 2 h 51 | ×1.28 |
| 12 | 3 h 55 | ×1.26 | 3 h 07 | ×1.24 | 3 h 22 | ×1.25 | 3 h 35 | ×1.26 |
| 13 | 4 h 52 | ×1.24 | 3 h 49 | ×1.22 | 4 h 08 | ×1.23 | 4 h 26 | ×1.24 |
| 14 | 6 h | ×1.23 | 4 h 38 | ×1.21 | 5 h 02 | ×1.22 | 5 h 26 | ×1.23 |
| 15 | 7 h 20 | ×1.22 | 5 h 33 | ×1.20 | 6 h 05 | ×1.21 | 6 h 35 | ×1.21 |
| 16 | 8 h 52 | ×1.21 | 6 h 37 | ×1.19 | 7 h 17 | ×1.20 | 7 h 55 | ×1.20 |
| 17 | 10 h 39 | ×1.20 | 7 h 50 | ×1.18 | 8 h 40 | ×1.19 | 9 h 27 | ×1.19 |
| 18 | 12 h 43 | ×1.19 | 9 h 13 | ×1.18 | 10 h 14 | ×1.18 | 11 h 13 | ×1.19 |
| 19 | 15 h 06 | ×1.19 | 10 h 47 | ×1.17 | 12 h 02 | ×1.18 | 13 h 15 | ×1.18 |
| 20 | 17 h 49 | ×1.18 | 12 h 34 | ×1.17 | 14 h 05 | ×1.17 | 15 h 34 | ×1.17 |
| 21 | 20 h 57 | ×1.18 | 14 h 34 | ×1.16 | 16 h 25 | ×1.17 | 18 h 12 | ×1.17 |
| 22 | 24 h 32 | ×1.17 | 16 h 50 | ×1.16 | 19 h 03 | ×1.16 | 21 h 12 | ×1.16 |
| 23 | 28 h 36 | ×1.17 | 19 h 23 | ×1.15 | 22 h 01 | ×1.16 | 24 h 36 | ×1.16 |
| 24 | 33 h 14 | ×1.16 | 22 h 15 | ×1.15 | 25 h 22 | ×1.15 | 28 h 26 | ×1.16 |
| 25 | 38 h 29 | ×1.16 | 25 h 27 | ×1.14 | 29 h 09 | ×1.15 | 32 h 47 | ×1.15 |
| 26 | 44 h 25 | ×1.15 | 29 h 02 | ×1.14 | 33 h 23 | ×1.15 | 37 h 40 | ×1.15 |
| 27 | 2 d 3 h | ×1.15 | 33 h 03 | ×1.14 | 38 h 08 | ×1.14 | 43 h 10 | ×1.15 |
| 28 | 2 d 10 h | ×1.15 | 37 h 30 | ×1.13 | 43 h 27 | ×1.14 | 2 d 1 h | ×1.14 |
| 29 | 2 d 19 h | ×1.15 | 42 h 29 | ×1.13 | 2 d 1 h | ×1.14 | 2 d 8 h | ×1.14 |
| 30 | 3 d 4 h | ×1.14 | 2 d | ×1.13 | 2 d 8 h | ×1.13 | 2 d 16 h | ×1.14 |

#### Slower: level 10 in 2 h 45, level 30 in 3 d 12 h (producers; k = 0.9884, p = 0.5506)

| Level | Lighthouse | ratio | Refinery, Fishery, Lumberyard | ratio | Shelters, Infirmary | ratio | Barracks, Harbor, Observatory | ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 min |  | 1 min |  | 1 min |  | 1 min |  |
| 2 | 1 min | ×1.00 | 1 min | ×1.00 | 1 min | ×1.00 | 1 min | ×1.00 |
| 3 | 2 min | ×2.00 | 2 min | ×2.00 | 2 min | ×2.00 | 2 min | ×2.00 |
| 4 | 5 min | ×2.50 | 5 min | ×2.50 | 5 min | ×2.50 | 5 min | ×2.50 |
| 5 | 15 min | ×3.00 | 15 min | ×3.00 | 15 min | ×3.00 | 15 min | ×3.00 |
| 6 | 44 min | ×2.93 | 40 min | ×2.67 | 41 min | ×2.73 | 42 min | ×2.80 |
| 7 | 1 h 12 | ×1.64 | 1 h 04 | ×1.60 | 1 h 06 | ×1.61 | 1 h 09 | ×1.64 |
| 8 | 1 h 46 | ×1.47 | 1 h 32 | ×1.44 | 1 h 36 | ×1.45 | 1 h 40 | ×1.45 |
| 9 | 2 h 28 | ×1.40 | 2 h 05 | ×1.36 | 2 h 12 | ×1.38 | 2 h 19 | ×1.39 |
| 10 | 3 h 20 | ×1.35 | 2 h 45 | ×1.32 | 2 h 56 | ×1.33 | 3 h 06 | ×1.34 |
| 11 | 4 h 23 | ×1.31 | 3 h 33 | ×1.29 | 3 h 48 | ×1.30 | 4 h 02 | ×1.30 |
| 12 | 5 h 39 | ×1.29 | 4 h 29 | ×1.26 | 4 h 50 | ×1.27 | 5 h 10 | ×1.28 |
| 13 | 7 h 11 | ×1.27 | 5 h 35 | ×1.25 | 6 h 04 | ×1.26 | 6 h 31 | ×1.26 |
| 14 | 8 h 59 | ×1.25 | 6 h 53 | ×1.23 | 7 h 30 | ×1.24 | 8 h 06 | ×1.24 |
| 15 | 11 h 08 | ×1.24 | 8 h 23 | ×1.22 | 9 h 12 | ×1.23 | 9 h 58 | ×1.23 |
| 16 | 13 h 39 | ×1.23 | 10 h 08 | ×1.21 | 11 h 10 | ×1.21 | 12 h 10 | ×1.22 |
| 17 | 16 h 37 | ×1.22 | 12 h 09 | ×1.20 | 13 h 28 | ×1.21 | 14 h 43 | ×1.21 |
| 18 | 20 h 05 | ×1.21 | 14 h 28 | ×1.19 | 16 h 07 | ×1.20 | 17 h 41 | ×1.20 |
| 19 | 24 h 06 | ×1.20 | 17 h 08 | ×1.18 | 19 h 10 | ×1.19 | 21 h 07 | ×1.19 |
| 20 | 28 h 46 | ×1.19 | 20 h 11 | ×1.18 | 22 h 40 | ×1.18 | 25 h 04 | ×1.19 |
| 21 | 34 h 10 | ×1.19 | 23 h 39 | ×1.17 | 26 h 41 | ×1.18 | 29 h 37 | ×1.18 |
| 22 | 40 h 22 | ×1.18 | 27 h 36 | ×1.17 | 31 h 16 | ×1.17 | 34 h 50 | ×1.18 |
| 23 | 47 h 29 | ×1.18 | 32 h 05 | ×1.16 | 36 h 29 | ×1.17 | 40 h 47 | ×1.17 |
| 24 | 2 d 7 h | ×1.17 | 37 h 09 | ×1.16 | 42 h 25 | ×1.16 | 47 h 34 | ×1.17 |
| 25 | 2 d 16 h | ×1.17 | 42 h 52 | ×1.15 | 2 d 1 h | ×1.16 | 2 d 7 h | ×1.16 |
| 26 | 3 d 3 h | ×1.16 | 2 d 1 h | ×1.15 | 2 d 8 h | ×1.15 | 2 d 16 h | ×1.16 |
| 27 | 3 d 15 h | ×1.16 | 2 d 8 h | ×1.15 | 2 d 17 h | ×1.15 | 3 d 1 h | ×1.15 |
| 28 | 4 d 5 h | ×1.16 | 2 d 16 h | ×1.14 | 3 d 2 h | ×1.15 | 3 d 13 h | ×1.15 |
| 29 | 4 d 20 h | ×1.15 | 3 d 1 h | ×1.14 | 3 d 13 h | ×1.14 | 4 d 1 h | ×1.15 |
| 30 | 5 d 14 h | ×1.15 | 3 d 12 h | ×1.14 | 4 d 2 h | ×1.14 | 4 d 16 h | ×1.15 |

#### The bands, side by side

| Curve | Group | Levels 6 to 10 | Levels 11 to 20 | Levels 21 to 30 |
| --- | --- | --- | --- | --- |
| Before 24 October | Lighthouse | 4 h 02 to 13 h 24 | 18 h 06 to 7 d | 8 d 9 h to 43 d 9 h |
| Before 24 October | Refinery, Fishery, Lumberyard | 4 h 33 to 23 h 04 | 34 h 36 to 55 d 10 h | 83 d 3 h to 8.8 y |
| Before 24 October | Shelters, Infirmary | 5 h 19 to 26 h 55 | 40 h 22 to 64 d 15 h | 96 d 23 h to 10.2 y |
| Before 24 October | Barracks, Harbor, Observatory | 6 h 05 to 30 h 45 | 46 h 08 to 73 d 21 h | 110 d 20 h to 11.7 y |
| Faster | Lighthouse | 37 min to 2 h 25 | 3 h 06 to 17 h 49 | 20 h 57 to 3 d 4 h |
| Faster | Refinery, Fishery, Lumberyard | 34 min to 2 h | 2 h 31 to 12 h 34 | 14 h 34 to 2 d |
| Faster | Shelters, Infirmary | 35 min to 2 h 08 | 2 h 42 to 14 h 05 | 16 h 25 to 2 d 8 h |
| Faster | Barracks, Harbor, Observatory | 36 min to 2 h 14 | 2 h 51 to 15 h 34 | 18 h 12 to 2 d 16 h |
| Slower (the rules since 24 October) | Lighthouse | 44 min to 3 h 20 | 4 h 23 to 28 h 46 | 34 h 10 to 5 d 14 h |
| Slower (the rules since 24 October) | Refinery, Fishery, Lumberyard | 40 min to 2 h 45 | 3 h 33 to 20 h 11 | 23 h 39 to 3 d 12 h |
| Slower (the rules since 24 October) | Shelters, Infirmary | 41 min to 2 h 56 | 3 h 48 to 22 h 40 | 26 h 41 to 4 d 2 h |
| Slower (the rules since 24 October) | Barracks, Harbor, Observatory | 42 min to 3 h 06 | 4 h 02 to 25 h 04 | 29 h 37 to 4 d 16 h |

### 3. What the players get (E in place, the balance's players, two years)

#### The Lighthouse's milestones

| Durations | Player | Lighthouse 5 | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Lighthouse 25 | Lighthouse 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before 24 October | Casual (3 sessions) | day 0.6 | day 4.6 | day 16.0 | day 42.6 | day 117.4 | day 299.4 (9.8 months) |
| Before 24 October | Regular (6 sessions) | day 0.2 | day 3.5 | day 12.5 | day 38.0 | day 101.4 | day 264.6 (8.7 months) |
| Before 24 October | Dedicated (10 sessions) | day 0.1 | day 2.8 | day 11.5 | day 37.0 | day 100.0 | day 256.0 (8.4 months) |
| Faster | Casual (3 sessions) | day 0.6 | day 4.1 | day 14.8 | day 43.3 | day 109.6 | day 261.2 (8.6 months) |
| Faster | Regular (6 sessions) | day 0.2 | day 2.4 | day 9.4 | day 26.8 | day 70.1 | day 175.2 (5.8 months) |
| Faster | Dedicated (10 sessions) | day 0.1 | day 2.1 | day 8.4 | day 23.2 | day 63.2 | day 159.2 (5.2 months) |
| Slower (the rules since 24 October) | Casual (3 sessions) | day 0.6 | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 248.6 (8.2 months) |
| Slower (the rules since 24 October) | Regular (6 sessions) | day 0.2 | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 184.7 (6.1 months) |
| Slower (the rules since 24 October) | Dedicated (10 sessions) | day 0.1 | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 165.6 (5.4 months) |

#### The regular player's last levels: days from one Lighthouse level to the next

| Durations | 20 → 21 | 21 → 22 | 22 → 23 | 23 → 24 | 24 → 25 | 25 → 26 | 26 → 27 | 27 → 28 | 28 → 29 | 29 → 30 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Before 24 October | 8.5 d | 10.2 d | 12.4 d | 14.5 d | 17.8 d | 21.0 d | 25.2 d | 37.1 d | 36.4 d | 43.5 d |
| Faster | 5.6 d | 6.8 d | 8.3 d | 10.3 d | 12.2 d | 13.1 d | 17.0 d | 20.4 d | 24.5 d | 30.0 d |
| Slower (the rules since 24 October) | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.6 d | 22.1 d | 25.1 d | 30.7 d |

#### The builders, by the Lighthouse's level

Shares of the builders' time (two builders). *The player away*: a builder free while something could start, until the next session. *Nothing to start*: a builder free, short of resources, or every building at the Lighthouse's level. The last column: the share of the hours with both builders at work while the city could pay for something else: everything waits for a build.

| Durations | Player | Lighthouse | Time there | Builders at work | A builder free, the player away | A builder free, nothing to start | Both at work, something else could start |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before 24 October | Casual (3 sessions) | Lighthouse 2 to 5 | 29 h | 21 % | 62 % | 17 % | 14 % |
| Before 24 October | Casual (3 sessions) | 6 to 10 | 5 d 3 h | 30 % | 57 % | 12 % | 10 % |
| Before 24 October | Casual (3 sessions) | 11 to 20 | 45 d 2 h | 83 % | 15 % | 2 % | 71 % |
| Before 24 October | Casual (3 sessions) | 21 to 29 | 248 d | 94 % | 2 % | 4 % | 82 % |
| Before 24 October | Casual (3 sessions) | 30, after it | 1.2 y | 100 % | 0 % | 0 % | 99 % |
| Before 24 October | Regular (6 sessions) | Lighthouse 2 to 5 | 16 h | 41 % | 34 % | 25 % | 25 % |
| Before 24 October | Regular (6 sessions) | 6 to 10 | 4 d 2 h | 41 % | 39 % | 19 % | 20 % |
| Before 24 October | Regular (6 sessions) | 11 to 20 | 41 d 18 h | 92 % | 8 % | 1 % | 84 % |
| Before 24 October | Regular (6 sessions) | 21 to 29 | 218 d 3 h | 99 % | 1 % | 0 % | 98 % |
| Before 24 October | Regular (6 sessions) | 30, after it | 1.3 y | 100 % | 0 % | 0 % | 99 % |
| Before 24 October | Dedicated (10 sessions) | Lighthouse 2 to 5 | 14 h | 39 % | 37 % | 24 % | 26 % |
| Before 24 October | Dedicated (10 sessions) | 6 to 10 | 3 d 7 h | 52 % | 34 % | 13 % | 22 % |
| Before 24 October | Dedicated (10 sessions) | 11 to 20 | 41 d 13 h | 94 % | 6 % | 0 % | 88 % |
| Before 24 October | Dedicated (10 sessions) | 21 to 29 | 210 d 13 h | 99 % | 1 % | 0 % | 98 % |
| Before 24 October | Dedicated (10 sessions) | 30, after it | 1.3 y | 100 % | 0 % | 0 % | 99 % |
| Faster | Casual (3 sessions) | Lighthouse 2 to 5 | 25 h | 16 % | 64 % | 20 % | 16 % |
| Faster | Casual (3 sessions) | 6 to 10 | 4 d 3 h | 11 % | 48 % | 41 % | 5 % |
| Faster | Casual (3 sessions) | 11 to 20 | 46 d 17 h | 7 % | 16 % | 77 % | 2 % |
| Faster | Casual (3 sessions) | 21 to 29 | 209 d 8 h | 6 % | 4 % | 90 % | 1 % |
| Faster | Casual (3 sessions) | 30, after it | 1.3 y | 3 % | 2 % | 95 % | 0 % |
| Faster | Regular (6 sessions) | Lighthouse 2 to 5 | 12 h | 33 % | 33 % | 33 % | 25 % |
| Faster | Regular (6 sessions) | 6 to 10 | 2 d 21 h | 18 % | 41 % | 41 % | 12 % |
| Faster | Regular (6 sessions) | 11 to 20 | 29 d 2 h | 13 % | 10 % | 77 % | 3 % |
| Faster | Regular (6 sessions) | 21 to 29 | 142 d 17 h | 10 % | 2 % | 88 % | 0 % |
| Faster | Regular (6 sessions) | 30, after it | 1.5 y | 2 % | 1 % | 97 % | 0 % |
| Faster | Dedicated (10 sessions) | Lighthouse 2 to 5 | 10 h | 30 % | 37 % | 33 % | 27 % |
| Faster | Dedicated (10 sessions) | 6 to 10 | 2 d 4 h | 18 % | 39 % | 43 % | 8 % |
| Faster | Dedicated (10 sessions) | 11 to 20 | 25 d 16 h | 14 % | 7 % | 79 % | 5 % |
| Faster | Dedicated (10 sessions) | 21 to 29 | 130 d 23 h | 10 % | 2 % | 89 % | 0 % |
| Faster | Dedicated (10 sessions) | 30, after it | 1.6 y | 2 % | 0 % | 97 % | 0 % |
| Slower (the rules since 24 October) | Casual (3 sessions) | Lighthouse 2 to 5 | 25 h | 16 % | 64 % | 20 % | 16 % |
| Slower (the rules since 24 October) | Casual (3 sessions) | 6 to 10 | 4 d 4 h | 13 % | 50 % | 38 % | 5 % |
| Slower (the rules since 24 October) | Casual (3 sessions) | 11 to 20 | 43 d 19 h | 12 % | 20 % | 68 % | 3 % |
| Slower (the rules since 24 October) | Casual (3 sessions) | 21 to 29 | 199 d 15 h | 11 % | 4 % | 86 % | 1 % |
| Slower (the rules since 24 October) | Casual (3 sessions) | 30, after it | 1.3 y | 4 % | 2 % | 94 % | 0 % |
| Slower (the rules since 24 October) | Regular (6 sessions) | Lighthouse 2 to 5 | 12 h | 33 % | 33 % | 33 % | 25 % |
| Slower (the rules since 24 October) | Regular (6 sessions) | 6 to 10 | 3 d 1 h | 22 % | 39 % | 39 % | 12 % |
| Slower (the rules since 24 October) | Regular (6 sessions) | 11 to 20 | 29 d 9 h | 19 % | 11 % | 70 % | 8 % |
| Slower (the rules since 24 October) | Regular (6 sessions) | 21 to 29 | 151 d 19 h | 15 % | 2 % | 82 % | 0 % |
| Slower (the rules since 24 October) | Regular (6 sessions) | 30, after it | 1.5 y | 4 % | 1 % | 96 % | 0 % |
| Slower (the rules since 24 October) | Dedicated (10 sessions) | Lighthouse 2 to 5 | 10 h | 30 % | 37 % | 33 % | 27 % |
| Slower (the rules since 24 October) | Dedicated (10 sessions) | 6 to 10 | 2 d 18 h | 19 % | 40 % | 41 % | 12 % |
| Slower (the rules since 24 October) | Dedicated (10 sessions) | 11 to 20 | 25 d 6 h | 24 % | 9 % | 68 % | 9 % |
| Slower (the rules since 24 October) | Dedicated (10 sessions) | 21 to 29 | 137 d 4 h | 16 % | 2 % | 82 % | 0 % |
| Slower (the rules since 24 October) | Dedicated (10 sessions) | 30, after it | 1.5 y | 4 % | 0 % | 96 % | 0 % |

#### The casual player (3 sessions: 8:00, 13:00, 21:00): builds that end before the next session

| Durations | Levels | Builds started (two years) | Ended before the next session | The builder then waited, on average |
| --- | --- | --- | --- | --- |
| Before 24 October | 6 to 10 | 45 | 14 (31 %) | 2 h 41 |
| Before 24 October | 11 to 20 | 85 | 0 (0 %) | 0 min |
| Before 24 October | 21 to 30 | 10 | 0 (0 %) | 0 min |
| Faster | 6 to 10 | 45 | 45 (100 %) | 6 h 06 |
| Faster | 11 to 20 | 90 | 45 (50 %) | 3 h 35 |
| Faster | 21 to 30 | 17 | 0 (0 %) | 0 min |
| Slower (the rules since 24 October) | 6 to 10 | 45 | 45 (100 %) | 6 h 08 |
| Slower (the rules since 24 October) | 11 to 20 | 90 | 30 (33 %) | 3 h 15 |
| Slower (the rules since 24 October) | 21 to 30 | 18 | 0 (0 %) | 0 min |

#### The whole city at level 30

| Durations | Every level of every building, added up | With two builders, at best | The regular player at day 730 | Whole city at 30 |
| --- | --- | --- | --- | --- |
| Before 24 October | 245.8 y | 122.9 y | Lighthouse 30, the others 19 to 20 | never in two years |
| Faster | 160 d 2 h | 80 d 1 h | Lighthouse 30, the others 21 to 23 | never in two years |
| Slower (the rules since 24 October) | 267 d 14 h | 133 d 19 h | Lighthouse 30, the others 21 to 23 | never in two years |

#### Where the resources hold the builders back

| Durations | Player | Sessions ended with a builder free (two years) | Short of wood | Short of oil | Short of fish | Every building at its cap |
| --- | --- | --- | --- | --- | --- | --- |
| Before 24 October | Casual (3 sessions) | 65 of 2190 (3 %) | 38 | 27 | 0 | 0 |
| Before 24 October | Regular (6 sessions) | 4 of 4380 (0 %) | 2 | 2 | 0 | 0 |
| Before 24 October | Dedicated (10 sessions) | 10 of 7300 (0 %) | 3 | 7 | 0 | 0 |
| Faster | Casual (3 sessions) | 2115 of 2190 (97 %) | 1583 | 479 | 53 | 0 |
| Faster | Regular (6 sessions) | 4274 of 4380 (98 %) | 3259 | 914 | 101 | 0 |
| Faster | Dedicated (10 sessions) | 7148 of 7300 (98 %) | 6280 | 816 | 52 | 0 |
| Slower (the rules since 24 October) | Casual (3 sessions) | 2095 of 2190 (96 %) | 1726 | 302 | 67 | 0 |
| Slower (the rules since 24 October) | Regular (6 sessions) | 4225 of 4380 (96 %) | 3236 | 937 | 52 | 0 |
| Slower (the rules since 24 October) | Dedicated (10 sessions) | 7058 of 7300 (97 %) | 6195 | 813 | 50 | 0 |

The levels the storage can never hold, today's costs:

| Group | First level out of reach (storage at most 2,597,893) | Its cost |
| --- | --- | --- |
| Lighthouse | none |  |
| Refinery, Fishery, Lumberyard | 23 | 2,785,370 wood + 1,237,940 fish |
| Shelters, Infirmary | 23 | 3,404,340 wood + 1,856,910 fish |
| Barracks, Harbor, Observatory | 22 | 2,707,990 wood + 1,160,570 oil + 1,160,570 fish |

#### A cost option, measured only: the other buildings' costs past level 15

| Durations and costs | Regular player: Lighthouse 30 | Whole city at 30 | At day 730 |
| --- | --- | --- | --- |
| Slower (the rules since 24 October) | day 184.7 | not in two years | the others 21 to 23 |
| Slower, others ×1.15 a level past 15 | day 185.7 | not in two years | the others 27 to 30 |
| Slower, others ×1.1 a level past 15 | day 185.6 | day 665 | the others 30 to 30 |
| Slower, others ×1.05 a level past 15 | day 185.1 | day 506 | the others 30 to 30 |

### 5. The alliance's help, measured on the slower curve

Ten allies, three minutes each, on every build of level 6 or more, never more than half of it; the slower curve's days in brackets.

| Player | Lighthouse 10 | 20 | 30 | Build time taken off by the help (two years) | Share of the builds' time |
| --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | day 4.1 (4.1) | day 40.4 (40.4) | day 250.8 (248.6) | 3 d 3 h | 4 % |
| Regular (6 sessions) | day 2.5 (2.5) | day 27.4 (26.8) | day 185.9 (184.7) | 3 d 5 h | 3 % |
| Dedicated (10 sessions) | day 2.1 (2.2) | day 23.5 (23.5) | day 167.0 (165.6) | 3 d 5 h | 3 % |

<!-- durations:generated:end -->
