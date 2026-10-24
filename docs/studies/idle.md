# Idle builders at Lighthouse 11 to 20 (study)

A study only, at the owner's request of 24 October: from Lighthouse 11 to 20, a builder has nothing to start 70 % of the time. Is it the other buildings' costs at levels 6 to 15, or the production, that sets this pace? And two options to bring it under 30 %, with their effect on Lighthouses 15, 20 and 30. **It changes no value: the owner decides on the numbers.**

## How it is measured

- **The players:** the balance's three (casual: 3 sessions a day; regular: 6; dedicated: 10), with today's rules (E, the slower build times, the costs past 15), played for three years. With the rules, the runs are the balance's own: the study checks they give the milestones of `docs/balance.md`, or it stops.
- **The builders:** the shares of the two builders' time while the Lighthouse is at 11 to 20, as in `docs/studies/durations.md`. A free builder with *nothing to start* is split in two:
  - **the Lighthouse's reserve:** the city could pay for another building, but the player keeps those resources for the Lighthouse's next level (the balance's player keeps the reserve on what a spending uses);
  - **short of everything:** nothing at all could be paid.
- **The setups (section 1):** the other buildings' levels 6 to 15 cheaper (×0.5, ×0.25, ×0.1); the Lighthouse's levels 11 to 20 cheaper (the same); both; and more production (×1.5, ×2, ×3: what the city's buildings make of oil, fish and wood; what the Lighthouse burns and the survivors eat do not change). Plus a player who keeps no reserve at all.
- **The options (section 2)** are played by the three players. Made by `npx tsx tools/balance/idle-run.ts`, through the durations study's rules (`tools/balance/durations-rules.ts`, its cost and production options).

## What it shows

**1. The 70 % is the Lighthouse's reserve, not a lack of resources.** For the regular player, 69 of the 70 points are hours where the city could pay for another building but keeps the resources for the Lighthouse's next level; short of everything: 0 %. The Lighthouse's levels 11 to 20 cost far more than the other buildings' levels 6 to 15, and the player saves for them.

**2. Spending the reserve does not help.** A player who keeps no reserve has nothing to start 77 % of the time, 66 % short of everything: the other buildings take what the Lighthouse needed, and Lighthouse 30 comes on day 576 instead of 184. The reserve is the right way to play; the pace is set elsewhere.

**3. The other buildings' costs at levels 6 to 15 barely count.** Ten times cheaper (×0.1), a builder still has nothing to start 59 % of the time, and Lighthouse 20 comes 1.6 days sooner. These levels are already cheap next to the Lighthouse's.

**4. What sets the pace is the production against the Lighthouse's cost.** The Lighthouse's levels 11 to 20 ten times cheaper: 38 %. Production ×3: 28 %. The two pull on the same thing: how long the city takes to save the Lighthouse's next level. Costs alone never go under 30 % (even the Lighthouse ×0.1 with the others ×0.25 stays at 36 %); production alone does, at about ×3.

## The two options

- **A. Production ×3.5:** the city's buildings make 3.5 times the oil, fish and wood of the rules, at every level. Nothing to start: 19 % (casual), 23 % (regular), 21 % (dedicated).
- **B. Production ×1.75, and the Lighthouse's levels 11 to 20 at a quarter of their cost:** nothing to start 18 %, 26 %, 25 %.

The regular player, Lighthouse 15, 20 and 30:

| | Lighthouse 15 | 20 | 30 | Whole city at 30 |
| --- | --- | --- | --- | --- |
| The rules | day 9.0 | day 26.8 | day 183.9 (6.0 months) | day 479 |
| A | day 4.9 | day 13.3 | day 99.7 (3.3 months) | day 248 |
| B | day 4.4 | day 9.8 | day 133.8 (4.4 months) | day 364 |

**What to weigh:**

- **Both options bring Lighthouse 30 well before the target of 6 to 12 months** (regular: 3.3 and 4.4 months; casual: 3.9 and 5.2). Keeping it at 6 months would need a counterweight on the Lighthouse's levels 21 to 30 (dearer, or slower): that would be another study, not measured here.
- **A moves the whole game.** More production at every level: the other buildings, the whole city at 30 (day 248 instead of 479), and every later balance (the sea, the repairs, the Pearls) feel it. It is the simplest rule, and the one that changes the most.
- **B touches only the Lighthouse's levels 11 to 20 and less production.** Lighthouse 20 comes sooner than with A (day 9.8), the end of the game less so (day 134); the whole city at 30 on day 364.
- **With either option, oil becomes the brake.** The sessions ended with a builder free are almost all short of oil (A: 871 of 905 for the regular player; B: 1,694 of 1,756), and wood starts to fill its storage some days (A: 54 days for the regular player): part of the extra production is lost.
- **Under 30 % is not 0 %.** Even with the options, a builder free while the player is away stays (section 2, *builders at work* 47 to 57 % for the regular and dedicated players): those hours come from the sessions, not from the costs.

<!-- idle:generated:start (npx tsx tools/balance/idle-run.ts) -->

### 1. What sets the pace: the regular player, Lighthouse 11 to 20

Shares of the two builders' time while the Lighthouse is at 11 to 20. *Nothing to start*: a builder free, and nothing the player starts; *of which the Lighthouse's reserve*: the city could pay for another building, but the player keeps those resources for the Lighthouse's next level; *of which short of everything*: nothing could be paid at all.

| Setup | Lighthouse 11 to 20 lasts | Builders at work | Free, the player away | Free, nothing to start | … of which the Lighthouse's reserve | … of which short of everything | Lighthouse 15 | 20 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules | 29.4 days | 19 % | 11 % | 70 % | 69 % | 0 % | day 9.0 | day 26.8 | day 183.9 |
| The rules, a player who keeps no reserve for the Lighthouse | 74.3 days | 22 % | 1 % | 77 % | 10 % | 66 % | day 15.4 | day 60.4 | day 576.2 |
| Other buildings' levels 6 to 15 ×0.5 | 28.3 days | 20 % | 13 % | 66 % | 66 % | 0 % | day 9.0 | day 26.2 | day 178.7 |
| Other buildings' levels 6 to 15 ×0.25 | 27.1 days | 25 % | 15 % | 60 % | 60 % | 0 % | day 9.0 | day 25.4 | day 171.1 |
| Other buildings' levels 6 to 15 ×0.1 | 27.1 days | 25 % | 16 % | 59 % | 59 % | 0 % | day 9.0 | day 25.2 | day 166.7 |
| Lighthouse 11 to 20 ×0.5 | 19.8 days | 29 % | 14 % | 57 % | 57 % | 0 % | day 6.7 | day 17.2 | day 172.9 |
| Lighthouse 11 to 20 ×0.25 | 15.5 days | 36 % | 20 % | 43 % | 43 % | 0 % | day 5.4 | day 12.5 | day 168.9 |
| Lighthouse 11 to 20 ×0.1 | 13.0 days | 39 % | 23 % | 38 % | 38 % | 0 % | day 4.4 | day 9.3 | day 168.7 |
| Lighthouse 11 to 20 and others 6 to 15, ×0.25 | 14.3 days | 40 % | 24 % | 36 % | 36 % | 0 % | day 5.4 | day 11.7 | day 159.7 |
| Production ×1.5 | 24.3 days | 25 % | 15 % | 60 % | 60 % | 0 % | day 7.9 | day 22.5 | day 153.7 |
| Production ×2 | 20.8 days | 34 % | 22 % | 45 % | 45 % | 0 % | day 6.8 | day 19.2 | day 134.6 |
| Production ×3 | 15.8 days | 44 % | 28 % | 28 % | 28 % | 0 % | day 5.4 | day 14.5 | day 107.1 |

### 2. The two options, for the three players

| Option | Player | Free, nothing to start (Lighthouse 11 to 20) | Builders at work | Lighthouse 15 | 20 | 30 | Whole city at 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The rules | Casual (3 sessions) | 68 % | 12 % | day 15.5 | day 40.4 | day 246.6 (8.1 months) | day 588 |
| The rules | Regular (6 sessions) | 70 % | 19 % | day 9.0 | day 26.8 | day 183.9 (6.0 months) | day 479 |
| The rules | Dedicated (10 sessions) | 68 % | 24 % | day 8.4 | day 23.5 | day 162.8 (5.3 months) | day 435 |
| A. Production ×3.5 | Casual (3 sessions) | 19 % | 33 % | day 7.0 | day 17.2 | day 119.1 (3.9 months) | day 272 |
| A. Production ×3.5 | Regular (6 sessions) | 23 % | 48 % | day 4.9 | day 13.3 | day 99.7 (3.3 months) | day 248 |
| A. Production ×3.5 | Dedicated (10 sessions) | 21 % | 57 % | day 4.4 | day 12.6 | day 93.7 (3.1 months) | day 217 |
| B. Production ×1.75, the Lighthouse's levels 11 to 20 ×0.25 | Casual (3 sessions) | 18 % | 32 % | day 6.0 | day 13.2 | day 157.6 (5.2 months) | day 410 |
| B. Production ×1.75, the Lighthouse's levels 11 to 20 ×0.25 | Regular (6 sessions) | 26 % | 47 % | day 4.4 | day 9.8 | day 133.8 (4.4 months) | day 364 |
| B. Production ×1.75, the Lighthouse's levels 11 to 20 ×0.25 | Dedicated (10 sessions) | 25 % | 53 % | day 3.8 | day 9.3 | day 121.8 (4.0 months) | day 309 |

### 3. The resources with the options

| Option | Player | Sessions ended with a builder free (until the city is done) | Short of wood | of oil | of fish | Days ended with oil full | fish full | wood full |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules | Casual (3 sessions) | 1576 of 1764 (89 %) | 666 | 624 | 277 | 0 | 0 | 0 |
| The rules | Regular (6 sessions) | 2559 of 2874 (89 %) | 432 | 2039 | 53 | 0 | 0 | 0 |
| The rules | Dedicated (10 sessions) | 3863 of 4350 (89 %) | 2214 | 1062 | 539 | 0 | 0 | 0 |
| A. Production ×3.5 | Casual (3 sessions) | 503 of 816 (62 %) | 0 | 485 | 0 | 0 | 5 | 44 |
| A. Production ×3.5 | Regular (6 sessions) | 905 of 1488 (61 %) | 1 | 871 | 0 | 0 | 14 | 54 |
| A. Production ×3.5 | Dedicated (10 sessions) | 1112 of 2170 (51 %) | 1 | 1053 | 6 | 0 | 0 | 31 |
| B. Production ×1.75, the Lighthouse's levels 11 to 20 ×0.25 | Casual (3 sessions) | 991 of 1230 (81 %) | 37 | 937 | 0 | 0 | 0 | 9 |
| B. Production ×1.75, the Lighthouse's levels 11 to 20 ×0.25 | Regular (6 sessions) | 1756 of 2184 (80 %) | 30 | 1694 | 0 | 0 | 0 | 35 |
| B. Production ×1.75, the Lighthouse's levels 11 to 20 ×0.25 | Dedicated (10 sessions) | 2273 of 3090 (74 %) | 156 | 1495 | 566 | 0 | 0 | 0 |

<!-- idle:generated:end -->
