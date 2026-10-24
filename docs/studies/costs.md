# The costs past level 15 (study)

**The owner chose the recommendation on 24 October, every value: it is in the game since (`COST_PAST_15` in `shared/src/rules/buildings.ts`, `docs/decisions.md`).** The study is kept as it was measured: "today" below means the costs before 24 October, frozen in `tools/balance/costs.ts` (`beforeCost`) so that `costs-run.ts` still plays them; the recommended option is now the rules' own.

A study only, at the owner's request of 24 October, after the slower build times went into the game (`docs/studies/durations.md`). It changes no value.

It measures what the other buildings' costs do past level 15 now that the builds no longer hold the game back, and seven options, played by the balance's simulator for three years. **Nothing goes into the game without the owner's agreement, value by value.**

## How it is measured

- **The players:** the balance's three (casual: 3 sessions a day; regular: 6; dedicated: 10), with today's rules:
  - E (the producers' curve, and the isles and shoals);
  - the slower build times;
  - the Lighthouse's reserve kept only on what a spending uses.
  - They are played for **three years**.
- **The options change only the other buildings' costs from level 16 on.** Levels up to 15 keep the rules' costs, and the Lighthouse keeps its own (×1.4 a level, then ×1.3 past 15).
- **How the runs are made:**
  - The options are played through the durations study's rules (`tools/balance/durations-rules.ts`, its cost option).
  - With the rules' costs, the runs are the balance's own: the study checks they give the milestones of `docs/balance.md` exactly, or it stops.
- **The whole city at 30:** the first day every building is at 30. The builders' and the resources' measures stop that day, since nothing is left to build after it.
- **The storage's wall:** a level whose cost of one resource is more than the most the storage ever holds. That is 2,597,893, at Lighthouse 30 with every Sealed Warehouses. No one can ever pay for such a level.
- **Reproduce:** `npx tsx tools/balance/costs-run.ts`, about a minute. It writes the tables at the end of this page. The tests are in `tools/balance/costs.test.ts`.

## The options

All of them change only the other buildings, from level 16 on.

- **Growths.** Each level costs ×1.3, ×1.2, ×1.15 or ×1.1 the level before, instead of today's ×1.6. ×1.3 is the Lighthouse's own growth past 15.
- **Less wood.** A growth, with **a third (or half) of each level's wood asked in oil and fish instead**.
  - The wood is converted at what each resource is worth in wood, from what a producer's level adds an hour: 42 wood, 11 oil, 14 fish. So 1 oil is worth about 3.8 wood, and 1 fish 3.
  - It is shared equally between the oil and fish the building already costs.
  - The Lumberyard costs no wood: it does not change.
  - Why: wood holds the builders back three times in four, while the oil and the fish fill the storage hundreds of days in three years (table 5).

## What it finds

1. **Today's ×1.6 makes the end of the city impossible** (table 1).
   - The other buildings' levels 22 to 24 cost more than the storage ever holds: the Barracks, the Harbor and the Observatory from 22, the Refinery, the Shelters and the Infirmary from 23, the Fishery and the Lumberyard from 24.
   - The levels 16 to 30 of the eight buildings add up to 1.9 billion wood.
   - In three years, the regular player has the city at 20 on day 499, and never at 25.
2. **×1.3, the Lighthouse's own growth, is not enough.** The walls only move to levels 27 to 30. The whole city is still never at 30 in three years.
3. **From ×1.2 down, every level fits in the storage.**
   - The whole city at 30, for the regular player: day 1008 with ×1.2 (33 months), day 699 with ×1.15 (23 months), day 509 with ×1.1 (16.7 months).
   - With growths alone, wood stays the brake.
   - The oil and the fish fill the storage: with ×1.1, up to 79 days ended with fish full, and 93 with oil full for the dedicated player.
4. **Asking a third of the wood in oil and fish uses what was lost** (table 5).
   - No day ends with a resource full until the city is done: no production is wasted.
   - The sessions ended with a builder free fall from 92 to 95 % to 84 to 93 %, and their cause is now shared between wood and oil.
   - The whole city at 30 comes sooner: day 573 with ×1.15 (18.8 months), **day 479 with ×1.12 (15.7 months)**, day 430 with ×1.1 (14.1 months).
   - Half of the wood (not a third) overshoots: oil becomes the brake, and the city is no sooner than with a third.
5. **The Lighthouse does not move.**
   - Lighthouse 30 comes on day 181 to 186 for the regular player with every option (185 today), 244 to 249 for the casual one, and 162 to 166 for the dedicated one.
   - Each level from 25 to 30 still takes 15 to 31 days.
   - The options shape the second goal, the whole city, without touching the first.
6. **What the options do not fix:** from Lighthouse 11 to 20, a builder is free with nothing to start 70 % of the time, with every option (table 4).
   - There, the other buildings are at most at 15: the costs of levels 6 to 15, or the production, set the pace.
   - That would be a study of its own, if the owner wants it.

## Recommendation

**Past level 15, every building but the Lighthouse costs ×1.12 its level before, with a third of each level's wood asked in oil and fish.** All its values are in the table "The recommended option's values" below. The levels between follow the same rule.

- The cost to reach level L (16 to 30) is the cost to reach level 15, × 1.12^(L − 15), rounded to ten. Then a third of its wood is taken off, and asked instead in the building's other resources: 42/11 wood for 1 oil, 42/14 for 1 fish, shared equally.
- What it gives:
  - Lighthouse 30 unchanged: about 6 months for the regular player;
  - the whole city at 30 in **15.7 months** for the regular player, 19.3 for the casual one, and 14.3 for the dedicated one;
  - no level the storage cannot hold;
  - no resource full until the city is done.
- Why ×1.12: it lands the second goal at about 15 to 18 months, as the durations study proposed. ×1.15 gives 18.8 months (23 for the casual player), and ×1.1 gives 14.1.

If the owner agrees, value by value:

- the rule goes into `upgradeCost` (`shared/src/rules/buildings.ts`), with its tests first, level by level;
- a build under way keeps what it was paid;
- the balance's reference is run again.

## The tables

<!-- costs:generated:start (npx tsx tools/balance/costs-run.ts) -->

### The regular player, in short

- Before 24 October (×1.6 a level): Lighthouse 30 on day 184.7 (6.1 months); the whole city at 30 not in three years.
- ×1.3 a level past 15 (as the Lighthouse): Lighthouse 30 on day 184.9 (6.1 months); the whole city at 30 not in three years.
- ×1.2: Lighthouse 30 on day 186.1 (6.1 months); the whole city at 30 on day 1008 (33.1 months).
- ×1.15: Lighthouse 30 on day 185.7 (6.1 months); the whole city at 30 on day 699 (23.0 months).
- ×1.1: Lighthouse 30 on day 184.7 (6.1 months); the whole city at 30 on day 509 (16.7 months).
- ×1.15, a third of the wood in oil and fish: Lighthouse 30 on day 184.2 (6.1 months); the whole city at 30 on day 573 (18.8 months).
- ×1.12, a third of the wood in oil and fish (the rules since 24 October): Lighthouse 30 on day 183.9 (6.0 months); the whole city at 30 on day 479 (15.7 months).
- ×1.1, a third of the wood in oil and fish: Lighthouse 30 on day 184.2 (6.1 months); the whole city at 30 on day 430 (14.1 months).
- ×1.1, half the wood in oil and fish: Lighthouse 30 on day 180.7 (5.9 months); the whole city at 30 on day 441 (14.5 months).

### 1. What each option costs past level 15

The other buildings' levels 16 to 30 added up (every building), by resource; and the first level the storage can never hold (its cost of one resource is more than the most the storage ever holds, 2,597,893).

| Option | Other buildings' levels 16 to 30, all of them: wood | oil | fish | Levels the storage can never hold |
| --- | --- | --- | --- | --- |
| Before 24 October (×1.6 a level) | 1881.4 M | 641.9 M | 708.3 M | refinery 23, fishery 24, lumberyard 24, shelters 23, barracks 22, harbor 22, observatory 22, infirmary 23 |
| ×1.3 a level past 15 (as the Lighthouse) | 133.2 M | 45.4 M | 50.1 M | refinery 30, fishery 30, shelters 29, barracks 28, harbor 28, observatory 27, infirmary 28 |
| ×1.2 | 52.9 M | 18.1 M | 19.9 M | none |
| ×1.15 | 33.5 M | 11.4 M | 12.6 M | none |
| ×1.1 | 21.4 M | 7.3 M | 8.1 M | none |
| ×1.15, a third of the wood in oil and fish | 22.3 M | 13.0 M | 14.3 M | none |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | 17.0 M | 9.9 M | 10.9 M | none |
| ×1.1, a third of the wood in oil and fish | 14.3 M | 8.3 M | 9.1 M | none |
| ×1.1, half the wood in oil and fish | 10.7 M | 8.8 M | 9.7 M | none |

### The recommended option's values: ×1.12, a third of the wood in oil and fish (the rules since 24 October)

The cost to reach each level (from the one before); the levels between follow the same rule. The Lighthouse keeps its costs.

| Building | Level | Before 24 October | With the option |
| --- | --- | --- | --- |
| refinery | 16 | 103,760 wood + 46,120 fish | 48,420 wood + 40,350 fish |
| refinery | 20 | 680,020 wood + 302,230 fish | 76,190 wood + 63,490 fish |
| refinery | 25 | 7,130,530 wood + 3,169,130 fish | 134,270 wood + 111,890 fish |
| refinery | 30 | 74,769,070 wood + 33,230,700 fish | 236,640 wood + 197,190 fish |
| fishery | 16 | 92,230 wood + 34,590 oil | 43,050 wood + 29,850 oil |
| fishery | 20 | 604,460 wood + 226,670 oil | 67,730 wood + 46,970 oil |
| fishery | 25 | 6,338,250 wood + 2,376,840 oil | 119,370 wood + 82,780 oil |
| fishery | 30 | 66,461,400 wood + 24,923,020 oil | 210,370 wood + 145,890 oil |
| lumberyard | 16 | 34,590 oil + 80,700 fish | 24,210 oil + 56,490 fish |
| lumberyard | 20 | 226,670 oil + 528,910 fish | 38,100 oil + 88,890 fish |
| lumberyard | 25 | 2,376,840 oil + 5,545,970 fish | 67,150 oil + 156,660 fish |
| lumberyard | 30 | 24,923,020 oil + 58,153,720 fish | 118,340 oil + 276,090 fish |
| shelters | 16 | 126,820 wood + 69,180 fish | 59,180 wood + 58,280 fish |
| shelters | 20 | 831,140 wood + 453,350 fish | 93,120 wood + 91,710 fish |
| shelters | 25 | 8,715,100 wood + 4,753,690 fish | 164,110 wood + 161,620 fish |
| shelters | 30 | 91,384,420 wood + 49,846,050 fish | 289,220 wood + 284,820 fish |
| barracks | 16 | 161,410 wood + 69,180 oil + 69,180 fish | 75,330 wood + 53,350 oil + 54,700 fish |
| barracks | 20 | 1,057,810 wood + 453,350 oil + 453,350 fish | 118,530 wood + 83,950 oil + 86,070 fish |
| barracks | 25 | 11,091,940 wood + 4,753,690 oil + 4,753,690 fish | 208,880 wood + 147,950 oil + 151,680 fish |
| barracks | 30 | 116,307,450 wood + 49,846,050 oil + 49,846,050 fish | 368,110 wood + 260,720 oil + 267,300 fish |
| harbor | 16 | 172,940 wood + 92,230 oil | 80,710 wood + 75,140 oil |
| harbor | 20 | 1,133,370 wood + 604,460 oil | 126,990 wood + 118,230 oil |
| harbor | 25 | 11,884,220 wood + 6,338,250 oil | 223,810 wood + 208,360 oil |
| harbor | 30 | 124,615,120 wood + 66,461,400 oil | 394,430 wood + 367,200 oil |
| observatory | 16 | 184,470 wood + 103,760 oil | 86,080 wood + 83,900 oil |
| observatory | 20 | 1,208,930 wood + 680,020 oil | 135,450 wood + 132,030 oil |
| observatory | 25 | 12,676,510 wood + 7,130,530 oil | 238,710 wood + 232,670 oil |
| observatory | 30 | 132,922,800 wood + 74,769,070 oil | 420,700 wood + 410,050 oil |
| infirmary | 16 | 138,350 wood + 103,760 fish | 64,570 wood + 83,390 fish |
| infirmary | 20 | 906,690 wood + 680,020 fish | 101,590 wood + 131,220 fish |
| infirmary | 25 | 9,507,380 wood + 7,130,530 fish | 179,040 wood + 231,250 fish |
| infirmary | 30 | 99,692,100 wood + 74,769,070 fish | 315,530 wood + 407,550 fish |

### 2. The pace (three years)

| Option | Player | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Lighthouse 25 | Lighthouse 30 | Whole city at 20 | at 25 | at 30 | Other buildings, day 365 | day 730 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Before 24 October (×1.6 a level) | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 248.6 | day 617 | not in 3 years | not in 3 years | 17 to 20 | 20 to 23 |
| Before 24 October (×1.6 a level) | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 184.7 | day 499 | not in 3 years | not in 3 years | 18 to 22 | 21 to 23 |
| Before 24 October (×1.6 a level) | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 165.6 | day 484 | not in 3 years | not in 3 years | 19 to 22 | 21 to 23 |
| ×1.3 a level past 15 (as the Lighthouse) | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 247.8 | day 439 | day 995 | not in 3 years | 18 to 23 | 23 to 28 |
| ×1.3 a level past 15 (as the Lighthouse) | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 184.9 | day 328 | day 837 | not in 3 years | 20 to 26 | 24 to 29 |
| ×1.3 a level past 15 (as the Lighthouse) | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 163.8 | day 315 | day 796 | not in 3 years | 20 to 26 | 24 to 29 |
| ×1.2 | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 246.8 | day 388 | day 662 | not in 3 years | 19 to 25 | 25 to 30 |
| ×1.2 | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 186.1 | day 291 | day 551 | day 1008 | 21 to 30 | 26 to 30 |
| ×1.2 | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 163.0 | day 278 | day 543 | day 984 | 22 to 30 | 26 to 30 |
| ×1.15 | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 246.6 | day 377 | day 567 | day 806 | 19 to 27 | 28 to 30 |
| ×1.15 | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 185.7 | day 281 | day 469 | day 699 | 22 to 30 | 30 to 30 |
| ×1.15 | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 163.7 | day 269 | day 450 | day 677 | 23 to 30 | 30 to 30 |
| ×1.1 | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 243.6 | day 363 | day 490 | day 606 | 20 to 30 | 30 to 30 |
| ×1.1 | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 184.7 | day 273 | day 394 | day 509 | 23 to 30 | 30 to 30 |
| ×1.1 | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 163.7 | day 259 | day 380 | day 484 | 24 to 30 | 30 to 30 |
| ×1.15, a third of the wood in oil and fish | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 246.6 | day 351 | day 516 | day 691 | 20 to 25 | 30 to 30 |
| ×1.15, a third of the wood in oil and fish | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 184.2 | day 273 | day 396 | day 573 | 24 to 29 | 30 to 30 |
| ×1.15, a third of the wood in oil and fish | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 161.8 | day 228 | day 341 | day 531 | 25 to 30 | 30 to 30 |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 246.6 | day 346 | day 482 | day 588 | 20 to 27 | 30 to 30 |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 183.9 | day 264 | day 351 | day 479 | 25 to 30 | 30 to 30 |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 162.8 | day 230 | day 319 | day 435 | 26 to 30 | 30 to 30 |
| ×1.1, a third of the wood in oil and fish | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 243.6 | day 351 | day 452 | day 535 | 21 to 28 | 30 to 30 |
| ×1.1, a third of the wood in oil and fish | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 184.2 | day 262 | day 345 | day 430 | 26 to 30 | 30 to 30 |
| ×1.1, a third of the wood in oil and fish | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 161.9 | day 228 | day 296 | day 379 | 28 to 30 | 30 to 30 |
| ×1.1, half the wood in oil and fish | Casual (3 sessions) | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 243.6 | day 363 | day 455 | day 536 | 20 to 30 | 30 to 30 |
| ×1.1, half the wood in oil and fish | Regular (6 sessions) | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 180.7 | day 267 | day 350 | day 441 | 26 to 30 | 30 to 30 |
| ×1.1, half the wood in oil and fish | Dedicated (10 sessions) | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 163.1 | day 231 | day 310 | day 394 | 26 to 30 | 30 to 30 |

### 3. The regular player's last levels: days from one Lighthouse level to the next

| Option | 20 → 21 | 21 → 22 | 22 → 23 | 23 → 24 | 24 → 25 | 25 → 26 | 26 → 27 | 27 → 28 | 28 → 29 | 29 → 30 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Before 24 October (×1.6 a level) | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.6 d | 22.1 d | 25.1 d | 30.7 d |
| ×1.3 a level past 15 (as the Lighthouse) | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.6 d | 21.8 d | 25.9 d | 30.5 d |
| ×1.2 | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.5 d | 22.6 d | 26.3 d | 30.6 d |
| ×1.15 | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.5 d | 22.6 d | 25.9 d | 30.6 d |
| ×1.1 | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.5 d | 22.2 d | 25.4 d | 30.5 d |
| ×1.15, a third of the wood in oil and fish | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 19.0 d | 21.2 d | 25.1 d | 30.7 d |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.0 d | 21.7 d | 25.4 d | 30.7 d |
| ×1.1, a third of the wood in oil and fish | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.9 d | 21.2 d | 25.6 d | 30.4 d |
| ×1.1, half the wood in oil and fish | 6.1 d | 7.1 d | 8.9 d | 10.3 d | 13.5 d | 15.3 d | 18.6 d | 19.9 d | 24.3 d | 29.7 d |

### 4. The regular player's builders, by the Lighthouse's level

Shares of the builders' time, as in `docs/studies/durations.md`. At Lighthouse 30: until the whole city is at 30.

| Option | Lighthouse | Builders at work | A builder free, the player away | A builder free, nothing to start | Both at work, something else could start |
| --- | --- | --- | --- | --- | --- |
| Before 24 October (×1.6 a level) | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| Before 24 October (×1.6 a level) | 21 to 29 (151 d 19 h) | 15 % | 2 % | 82 % | 0 % |
| Before 24 October (×1.6 a level) | 30, until the city is done (2.5 y) | 2 % | 0 % | 97 % | 0 % |
| ×1.3 a level past 15 (as the Lighthouse) | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.3 a level past 15 (as the Lighthouse) | 21 to 29 (152 d 1 h) | 16 % | 3 % | 81 % | 0 % |
| ×1.3 a level past 15 (as the Lighthouse) | 30, until the city is done (2.5 y) | 7 % | 1 % | 92 % | 0 % |
| ×1.2 | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.2 | 21 to 29 (153 d 4 h) | 17 % | 3 % | 80 % | 1 % |
| ×1.2 | 30, until the city is done (2.2 y) | 13 % | 1 % | 86 % | 0 % |
| ×1.15 | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.15 | 21 to 29 (152 d 19 h) | 18 % | 3 % | 80 % | 1 % |
| ×1.15 | 30, until the city is done (1.4 y) | 20 % | 2 % | 78 % | 0 % |
| ×1.1 | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.1 | 21 to 29 (151 d 19 h) | 18 % | 3 % | 79 % | 2 % |
| ×1.1 | 30, until the city is done (323 d 23 h) | 32 % | 3 % | 65 % | 0 % |
| ×1.15, a third of the wood in oil and fish | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.15, a third of the wood in oil and fish | 21 to 29 (151 d 7 h) | 18 % | 3 % | 79 % | 2 % |
| ×1.15, a third of the wood in oil and fish | 30, until the city is done (1.1 y) | 27 % | 2 % | 71 % | 0 % |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | 21 to 29 (151 d 1 h) | 19 % | 3 % | 78 % | 2 % |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | 30, until the city is done (294 d 17 h) | 34 % | 2 % | 64 % | 0 % |
| ×1.1, a third of the wood in oil and fish | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.1, a third of the wood in oil and fish | 21 to 29 (151 d 7 h) | 19 % | 4 % | 78 % | 4 % |
| ×1.1, a third of the wood in oil and fish | 30, until the city is done (245 d 11 h) | 42 % | 3 % | 56 % | 0 % |
| ×1.1, half the wood in oil and fish | 11 to 20 (29 d 9 h) | 19 % | 11 % | 70 % | 8 % |
| ×1.1, half the wood in oil and fish | 21 to 29 (147 d 19 h) | 20 % | 2 % | 77 % | 4 % |
| ×1.1, half the wood in oil and fish | 30, until the city is done (259 d 23 h) | 39 % | 2 % | 59 % | 0 % |

### 5. The resources

Until the whole city is at 30 (or three years). The sessions that ended with a builder free, and why; then the days that ended with a resource full (its production lost).

| Option | Player | Sessions ended with a builder free | Short of wood | of oil | of fish | Days ended full: wood | oil | fish |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Before 24 October (×1.6 a level) | Casual (3 sessions) | 3190 of 3285 (97 %) | 2815 | 302 | 73 | 83 | 169 | 124 |
| Before 24 October (×1.6 a level) | Regular (6 sessions) | 6415 of 6570 (98 %) | 5426 | 937 | 52 | 171 | 417 | 331 |
| Before 24 October (×1.6 a level) | Dedicated (10 sessions) | 10708 of 10950 (98 %) | 9845 | 813 | 50 | 190 | 529 | 333 |
| ×1.3 a level past 15 (as the Lighthouse) | Casual (3 sessions) | 3188 of 3285 (97 %) | 2682 | 294 | 212 | 0 | 19 | 0 |
| ×1.3 a level past 15 (as the Lighthouse) | Regular (6 sessions) | 6392 of 6570 (97 %) | 5395 | 932 | 65 | 0 | 235 | 60 |
| ×1.3 a level past 15 (as the Lighthouse) | Dedicated (10 sessions) | 10633 of 10950 (97 %) | 9328 | 1191 | 114 | 0 | 357 | 64 |
| ×1.2 | Casual (3 sessions) | 3170 of 3285 (96 %) | 2867 | 292 | 11 | 0 | 122 | 132 |
| ×1.2 | Regular (6 sessions) | 5833 of 6048 (96 %) | 4923 | 878 | 0 | 0 | 235 | 234 |
| ×1.2 | Dedicated (10 sessions) | 9502 of 9840 (97 %) | 8372 | 1001 | 71 | 0 | 345 | 208 |
| ×1.15 | Casual (3 sessions) | 2291 of 2418 (95 %) | 1962 | 306 | 7 | 0 | 36 | 69 |
| ×1.15 | Regular (6 sessions) | 3962 of 4194 (94 %) | 3013 | 915 | 0 | 0 | 110 | 133 |
| ×1.15 | Dedicated (10 sessions) | 6406 of 6770 (95 %) | 5302 | 1035 | 10 | 0 | 192 | 121 |
| ×1.1 | Casual (3 sessions) | 1697 of 1818 (93 %) | 1329 | 347 | 4 | 0 | 0 | 13 |
| ×1.1 | Regular (6 sessions) | 2807 of 3054 (92 %) | 1865 | 909 | 0 | 0 | 36 | 79 |
| ×1.1 | Dedicated (10 sessions) | 4471 of 4840 (92 %) | 3198 | 1214 | 0 | 0 | 93 | 62 |
| ×1.15, a third of the wood in oil and fish | Casual (3 sessions) | 1912 of 2073 (92 %) | 751 | 714 | 440 | 0 | 0 | 0 |
| ×1.15, a third of the wood in oil and fish | Regular (6 sessions) | 3164 of 3438 (92 %) | 670 | 2405 | 54 | 2 | 0 | 0 |
| ×1.15, a third of the wood in oil and fish | Dedicated (10 sessions) | 4927 of 5310 (93 %) | 2843 | 1029 | 1011 | 0 | 0 | 0 |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | Casual (3 sessions) | 1576 of 1764 (89 %) | 666 | 624 | 277 | 0 | 0 | 0 |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | Regular (6 sessions) | 2559 of 2874 (89 %) | 432 | 2039 | 53 | 0 | 0 | 0 |
| ×1.12, a third of the wood in oil and fish (the rules since 24 October) | Dedicated (10 sessions) | 3863 of 4350 (89 %) | 2214 | 1062 | 539 | 0 | 0 | 0 |
| ×1.1, a third of the wood in oil and fish | Casual (3 sessions) | 1429 of 1605 (89 %) | 556 | 712 | 145 | 0 | 0 | 0 |
| ×1.1, a third of the wood in oil and fish | Regular (6 sessions) | 2172 of 2580 (84 %) | 302 | 1815 | 0 | 0 | 0 | 0 |
| ×1.1, a third of the wood in oil and fish | Dedicated (10 sessions) | 3231 of 3790 (85 %) | 1715 | 1247 | 227 | 0 | 0 | 0 |
| ×1.1, half the wood in oil and fish | Casual (3 sessions) | 1336 of 1608 (83 %) | 372 | 783 | 166 | 5 | 0 | 0 |
| ×1.1, half the wood in oil and fish | Regular (6 sessions) | 2256 of 2646 (85 %) | 148 | 2050 | 0 | 54 | 0 | 0 |
| ×1.1, half the wood in oil and fish | Dedicated (10 sessions) | 3208 of 3940 (81 %) | 391 | 1642 | 1037 | 30 | 0 | 0 |

<!-- costs:generated:end -->
