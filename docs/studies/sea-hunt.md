# The sea hunt, speed-ups paid in resources, contested shoals (study)

A study only, at the owner's request of 25 October 2026, after the House (pull request #27). It measures, by simulation, three ideas: **long expeditions** to far zones that bring back a rare resource and base resources, at the risk of a share of the fleet's escort; **speeding up a construction with wood, oil or fish**, with a daily cap; and **contested shoals**, where two cities on the same isle or shoal share its harvest. **It changes no rule and no value: nothing goes into the game without the owner's agreement, value by value.** Every number below is a starting value for that choice.

## The answer in short

1. **The sea hunt: the casual player gains the most, if the zones fit their absences.** With zones of 5, 8 and 12 hours (the gaps of a player who comes at 8:00, 13:00 and 21:00), Lighthouse 30 comes **13.7 days sooner for the casual player**, 9.1 to 9.5 for the regular and 8.1 for the dedicated (options A and C). With the owner's example of 2, 8 and 12 hours it is the other way round: the 2-hour zone fits the regular player's 3-hour gaps (8,391 of them in two years), who gains 14.4 days, the casual 9.7, and the dedicated loses 2.6. Options A and C with these zones hold the House's bar for fish (about 300 sessions short of fish at most for the casual player, 150 for the others): 184, 6 and 20 at most.
2. **Speed-ups paid in resources slow every player down:** Lighthouse 30 comes 14.3, 3.0 and 3.2 days later with 1 hour a day, 25.0, 2.9 and 6.7 with 2 hours. What holds the Lighthouse back is the resources, never the builders' time (`docs/studies/idle.md`, `population.md`): every resource spent on time is a resource the next level waits for. Paid only from a full storage, it is never used (0 hours in two years). **It is compatible with `comfort.ts`** (below), without changing it.
3. **Contested shoals hurt every player and break the bar for fish:** a quarter of the isles' and shoals' harvest to another city gives 465, 438 and 852 sessions short of fish (156, 0 and 50 today), and the whole city at 30 45 to 53 days later. **With the Tides, they fit only as the Tides' own zones**, which already do this without loss (below).
4. **`CLAUDE.md`:** "builders" and "Tides attacks" are both in "Never for sale" (line 46). Nothing to add.

## How it is measured

- **The players:** the balance's three (casual: 3 sessions a day at 8:00, 13:00 and 21:00; regular: 6, every 3 hours from 7:00; dedicated: 10, every 1 h 40 from 7:00), with today's rules (the population at 0.2 fish an hour and the House), for **two years**. With the rules, the runs are the balance's own (Lighthouse 30 on day 248.8, 188.1 and 168.0; 156, 0 and 50 sessions short of fish until the whole city is at 30).
- **The study's rules** (`tools/balance/sea-hunt.ts`, `sea-hunt-rules.ts`, `sea-hunt-hooks.mjs`; `npx tsx tools/balance/sea-hunt-run.ts`, which writes the tables at the end of this page). Nothing is changed in `shared/`.
- **The study's player at sea:** the Leviathan first and the camps next, as the balance plays them; then one fleet sails on the longest expedition that is home by the next session (an hour late at most) and that its soldiers can escort, for the resource it holds least of; every other fleet gathers, as today. At most half the city's fleets are away on an expedition at once (or one fleet, in the setups that say so).
- **The study's player at the builders:** a quarter of an hour at a time off the Lighthouse's upgrade (or else the longest one), up to the day's cap, keeping the Lighthouse's reserve as every other spending.
- **"Sessions short of fish":** the sessions that ended with a builder free and the first thing to start short of fish, until the whole city is at 30, as in `docs/studies/population.md`; in brackets, the first year.

## 1. The sea hunt

### The zones

| Zone | Trip, there and back | Base resources brought (full isles or shoals of the Lighthouse's level) | at Lighthouse 20 | Amber | Escort (soldiers) | Lost on the way |
| --- | --- | --- | --- | --- | --- | --- |
| The Far Reef | 5 h | 1.25 | 1,631 | 3 | 1 × the Lighthouse's level | 3 % of the escort |
| The Drowned Deeps | 8 h | 2 | 2,610 | 5 | 1 × the Lighthouse's level | 5 % |
| The Abyss | 12 h | 3 | 3,915 | 8 | 1.5 × the Lighthouse's level | 10 % |
| *(The owner's example)* The Outer Shelf | 2 h | 0.5 | 653 | 1 | 1 × the Lighthouse's level | 0 % |

- **Open at Lighthouse 10**, after the early start.
- **The base resources:** all of one resource, oil, fish or wood, chosen by the player; with no storage cap when they land, as a fleet's cargo today. An hour of an expedition brings about a quarter of a full isle, less than a fleet gathering when the isles and shoals are full (about half an isle an hour): **it is worth sailing when the fleet would otherwise wait in the harbour**, that is, while the player is away.
- **The risk, never the city:** the escort leaves the city with the fleet; a share of it is lost on the way, **known before sailing, never drawn** (the rules have no randomness). In the game it would follow the fleet's strength, as the odds of a camp. The fleet and its cargo always come home; the city is never touched.
- **Amber**, the rare resource: brought only by the expeditions, never for sale, never a reward, never traded.

### What Amber is for: three options

- **A · Needed for the high levels:** each level past 15 of the eight island buildings needs Amber, **never the Lighthouse's** (2 Amber a level past 15: 2 for level 16, 30 for level 30; or 1); and the House's levels 4 and 5 (10 and 20; or 5 and 10). The Lighthouse's own path is never held back by Amber.
- **B · In place of part of a cost:** from level 16, Lighthouse included, each Amber pays 1 % of an upgrade's wood, oil and fish, up to 25 % (or 10 %) of it, when the city is short. Nothing needs it.
- **C · Nothing:** the expeditions bring base resources only, to tell what the hunt itself gives from what Amber gives.

### What it gives (the tables at the end)

| Setup | Lighthouse 30: casual | regular | dedicated | Whole city at 30: casual | regular | dedicated | Sessions short of fish: casual | regular | dedicated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules | day 248.8 | 188.1 | 168.0 | day 633 | 497 | 474 | 156 | 0 | 50 |
| C · zones of 2, 8 and 12 h | −9.7 | −14.4 | **+2.6** | −19 | −39 | −46 | 203 | 19 | 2 |
| C · zones of 5, 8 and 12 h | **−13.7** | −9.5 | −8.1 | −27 | −26 | −37 | 184 | 6 | 0 |
| A · 2 Amber a level past 15 | **−13.7** | −9.1 | −8.1 | −27 | −23 | −38 | 184 | 0 | 20 |
| A · 1 Amber a level past 15 | **−13.7** | −9.5 | −8.1 | −27 | −26 | −37 | 184 | 6 | 0 |
| B · up to 25 % of a cost | **−29.7** | −23.2 | −17.2 | −121 | −92 | −97 | 47 | 8 | 21 |
| B · up to 10 % of a cost | −4.7 | −18.1 | −15.4 | −64 | −52 | −68 | 125 | 0 | 52 |
| C · one fleet away at a time | **−10.2** | −9.5 | −8.1 | −23 | −9 | −14 | 245 | 7 | **280** |
| B · 25 %, one fleet away at a time | **−33.7** | −23.2 | −17.2 | −118 | −60 | −55 | 85 | 4 | 97 |

What it shows:

1. **The zones decide who gains.** Zones of 5, 8 and 12 hours give the casual player a fleet's work for each absence (611 expeditions to the Far Reef, 678 to the Abyss in two years), the regular and dedicated players one a night (2,765 and 3,432 to the Drowned Deeps). A 2-hour zone is played by the regular and dedicated players between their sessions (8,391 and 9,468 times) and the casual player gains less than they do.
2. **Amber is plentiful.** The casual player brings 7,257 in two years, the regular 13,825, the dedicated 17,160, for 1,455 (1 a level) or 2,910 (2 a level) that option A needs for the whole city. With 1 a level it never holds anything back: option A plays exactly as C. With 2, the regular and dedicated players wait for it in 856 and 849 sessions, never the casual player, and it changes their Lighthouse 30 by 0.3 day at most. **Amber would then need a sink of its own, or fewer Amber an expedition** (for example 1, 2 and 3), for the choice to be felt.
3. **Option B accelerates the late game the most**, and the casual player the most (−29.7 days, the whole city 4 months sooner), because it shortens the walls past 15 where the casual player waits longest. Its 10 % version gains the casual player little (−4.7): reaching Lighthouse 25 ten days sooner, they then wait for the Pearls of Lighthouse 26 to 30 (60 sessions short of Pearls).
4. **One fleet away at a time** gives the casual player more Amber and more base resources than the other two (4,474 Amber against 3,085 and 3,030), but the dedicated player's fish falls short in 280 sessions (50 today), above the bar of 150.
5. **The soldiers lost:** 2,600 to 3,700 in two years with half the fleets away, about 600 for the regular and dedicated players with one fleet. Retrained at the Barracks as any soldier; the camps keep their Pearls because the expeditions sail after the camps' attacks (in a first version where they sailed before, the casual player's camps gave about 10,000 fewer Pearls in two years and Lighthouse 30 came about three weeks later).

**Recommendation:** zones of **5, 8 and 12 hours**, at most **half the fleets** away, and Amber **needed for the high levels (option A)**: the casual player gains the most (−13.7 days), every player holds the fish bar, the Lighthouse is never held back by Amber, and the high levels get a reason to sail. With Amber at 1 or 2 a level it changes almost nothing of the pace; if the owner wants Amber to be felt, fewer Amber an expedition. Option B if the owner wants a stronger lift for the late game, knowing it brings Lighthouse 30 a month sooner for the casual player.

### Amber a little short (the owner's request of 25 October)

> **The owner's decisions of 25 October:** option A kept in principle (Amber needed for the levels 16 to 30 of the island's buildings, never for the Lighthouse), zones of 5, 8 and 12 hours; speed-ups paid in resources and contested shoals given up (`docs/decisions.md`). Asked: the numbers with 1, 2 and 3 Amber an expedition, and values that leave Amber a little short, the casual player having just enough over two years.

The same zones, each bringing **1, 2 and 3 Amber** (the Far Reef, the Drowned Deeps, the Abyss). The casual player brings home 2,200 to 2,650 Amber in two years, the regular 3,000 to 5,600, the dedicated 6,300 to 7,200 (fewer when the Amber holds the builders back: the fleets wait with the rest).

| Amber needed (a level past 15; the House's levels 4 and 5) | In all | Lighthouse 30: casual | regular | dedicated | Whole city at 30: casual | regular | dedicated | Casual: Amber brought, sessions short of it | Sessions short of fish: casual, regular, dedicated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules (no expedition) | | day 248.8 | 188.1 | 168.0 | day 633 | 497 | 474 | | 156, 0, 50 |
| 1; 5 and 10 | 1,455 | −13.7 | −9.9 | −9.1 | −27 | −21 | −36 | 2,645 (1.8 times what is needed), 0 | 184, 7, 15 |
| **2; none for the House** | **1,920** | **−13.7** | **−9.5** | **−8.1** | **−9** | **−20** | **−38** | **2,587 (1.35 times), 315** | **101, 0, 22** |
| 2; 2 and 4 | 2,118 | −13.7 | −9.5 | −8.1 | +50 | +24 | −30 | 2,400, 710 | 6, 0, 59 |
| 2; 3 and 6 | 2,217 | −13.7 | −9.1 | −8.1 | +70 | +85 | −34 | 2,418, 820 | 6, 0, 225 |
| 2; 5 and 10 | 2,415 | −13.7 | −9.4 | −8.4 | never in two years | +62 | −22 | 2,305, 1,136 | 2, 0, 52 |
| 2; 10 and 20 | 2,910 | −13.7 | −10.5 | −7.8 | never | +101 | −19 | 2,177, 1,330 | 0, 0, 0 |
| 3; 10 and 20 | 3,870 | −13.7 | −10.5 | −7.4 | never | never | +100 | 2,180, 1,360 | 0, 0, 0 |

- **Lighthouse 30 does not move with Amber** (−13.7, −9.1 to −10.5, −7.4 to −9.1 days): the Lighthouse never needs it. What Amber moves is the rest of the city past 15.
- **The House's levels 4 and 5 are where Amber runs out:** they come last, when the casual player has spent most of it. With 2 and 4 Amber for them, the casual player's whole city is at 30 50 days later than today; with 5 and 10, not in two years.
- **The proposal: 1, 2 and 3 Amber an expedition; 2 Amber a level past 15 for the eight island buildings (2 for level 16, 30 for level 30: 240 a building, 1,920 in all); no Amber for the House.** The casual player brings 2,587 in two years, 1.35 times what the city needs, and still waits for it in 315 sessions on the way: Amber is a little short, and their whole city is at 30 9 days sooner than today. The regular and dedicated players bring 2.8 and 3.7 times what they need, and wait for it in 1,267 and 163 sessions: they climb past 15 faster than the Amber comes. Every player holds the fish bar (101, 0 and 22).
- **"Sessions short of fish"** falls when Amber holds the city back (6 to 0 in the last rows): those sessions are short of Amber first.

## 2. Speed-ups paid in resources

### The rule played

- Taking an hour off a construction costs the job's cost × its share of the job's full time × the price (×1: an hour off a 10-hour upgrade costs a tenth of its cost), **in the job's own resources: wood, oil or fish, never Pearls.**
- **A daily cap:** 1 hour (or 2) a day, for each city. **Never an object given as a reward**: the speed-up is bought with resources at the moment it is used, as the week 7 rule says (`docs/tasks/week-7.md`: "never convenience time").

### What it gives

| Setup | Lighthouse 30: casual | regular | dedicated | Whole city at 30: casual | regular | dedicated | Hours taken off (casual) | Resources spent (casual) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules | day 248.8 | 188.1 | 168.0 | day 633 | 497 | 474 | 0 | 0 |
| 1 h a day, price ×1 | +14.3 | +3.0 | +3.2 | +38 | +21 | +29 | 317 | 2,438,534 |
| 1 h a day, from a full storage only | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 h a day, price ×1 | +25.0 | +2.9 | +6.7 | +70 | +46 | +50 | 623 | 4,748,705 |
| 1 h a day, price ×2 | +13.3 | +6.0 | +2.9 | +54 | +48 | +49 | 304 | 4,640,902 |

**Every player loses, the casual player the most.** The builders wait for resources, not for time: 71 % of their time with nothing to start past Lighthouse 20 (`docs/studies/population.md`). A speed-up turns resources the next level needs into time no one needed. A player who keeps their speed-ups for a full storage never uses them: no resource is ever still at 80 % of the storage once a speed-up is paid. **A speed-up paid in resources is a convenience for the moment (to see a building finish before leaving), never a way to go faster.** If the owner wants it, 1 hour a day at price ×1 is enough; its cost to the pace should be said in the game ("This slows your city").

### With `comfort.ts` and the cap of 4 hours a day

`shared/src/rules/comfort.ts` caps the **convenience bought with USDC**: 100 USDC a month (30 for a minor), and **4 hours a day of convenience bought** (`canBuyComfort` counts the hours of each item paid). It is read here, not changed.

- **Compatible:** a speed-up paid in wood, oil or fish earned by playing is not bought: it is outside the cap's scope, and `comfort.ts` needs no change. The two caps stand side by side: at most 4 hours a day bought, plus the free speed-up's 1 hour a day.
- **The public promise holds:** `maxPaidAdvance` measures the lead a payer can buy over a free player (4 / 26 = 15.4 % for a player active an hour a day). With a free speed-up of 1 hour a day open to every player, the lead a payer can buy is 4 / 27 = 14.8 %, a little less, never more.
- **On one condition:** the resources must never be sold (they are not today: what the cap sells is hours). If a pack of wood, oil or fish were ever sold, the hours it could buy through the speed-up would have to count in the 4 hours, and `comfort.ts` would change (a protected area, with the owner's review).
- **What it does not allow:** a speed-up with Pearls, a speed-up given as a reward, or a free speed-up counted in the bought hours' cap to raise it.

## 3. Contested shoals

### The rule played

Two cities on the same isle or shoal share its harvest: the study gives another city a quarter, or half, of everything the city's fleets take from the isles and shoals (the wrecks stay the city's own). The cities are never attacked: nothing is taken from a city, only from the sea.

### What it gives

| Setup | Lighthouse 30: casual | regular | dedicated | Whole city at 30: casual | regular | dedicated | Sessions short of fish: casual | regular | dedicated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules | day 248.8 | 188.1 | 168.0 | day 633 | 497 | 474 | 156 | 0 | 50 |
| A quarter to another city | +3.3 | +4.9 | +3.1 | +45 | +43 | +53 | 465 | 438 | 852 |
| Half to another city | −0.2 | +8.6 | +12.6 | never in two years | +132 | +155 | 662 | 1,142 | 2,321 |

**Every player loses**, through the fish above all (the survivors eat it, the House and the population made it a brake): the bar of the House (300, 150, 150) is broken from a quarter shared. The isles and shoals bring 14 million wood and fish to the casual player in two years, 24 million to the others: about three quarters of what the fleets gather (the wrecks' oil is the rest).

### With the Tides

- **The Tides already have contested waters:** a small sea of 7 zones a week, 2 of oil, 2 of fish and 2 of wood around a center of Pearls; the alliance that holds a zone at the end of a Tide gets **+15 % harvest of its resource for the following week**, a bonus no one can take back (`docs/design/tides.md`). That is a contested shoal, at sea, between alliances, with no loss.
- **Contested shoals on the city's own map do not fit the Tides' rules:** "Tides lose nothing" (`docs/decisions.md`, 21 October), and a shared shoal takes from one city what another gets; "real-time player-versus-player on the shared map" was not retained when the Tides were designed; and a city that plays more sessions would empty the shoals first, against the casual player.
- **What would fit:** a shoal two cities reach together gives each **a bonus, never less than alone** (each keeps its own amount, and a small share more), or nothing at all: the contest stays in the Tides' zones. Not measured: it can only gain.

## The values to choose (value by value)

1. **The expeditions:** kept in principle (option A); open at Lighthouse 10.
2. **The zones:** 5, 8 and 12 hours (the owner's choice).
3. **What each brings:** 1.25, 2 and 3 full isles or shoals of the Lighthouse's level; **1, 2 and 3 Amber** (proposed, "Amber a little short").
4. **The escort and its loss:** 1, 1 and 1.5 soldiers a Lighthouse level; 3, 5 and 10 % lost, known before sailing.
5. **The fleets away:** half the city's fleets at most (proposed), or one.
6. **What Amber is for:** option A (the owner's choice): **2 Amber a level past 15** for the eight island buildings (proposed), never the Lighthouse; **none for the House** (proposed).
7. **The speed-up paid in resources:** given up (the owner's decision).
8. **Contested shoals:** given up (the owner's decision); the contest stays in the Tides' zones.

## What the study leaves out

- **Other players:** the contested shoals are a share given away, not two players' choices.
- **The game's odds:** the escort's loss is a fixed share, where the game would follow the fleet's strength as for a camp.
- **What Amber looks like, where the zones are on the map, the fleet's sheet:** design, after the owner's choice.
- **One policy per player:** the study's players always sail the longest zone that fits; a real player may choose otherwise.

## The measures

<!-- sea-hunt:generated:start (npx tsx tools/balance/sea-hunt-run.ts) -->

### Expeditions

| Setup | Player | Lighthouse 15 | 20 | 25 | 30 (vs the rules) | Whole city at 30 | Sessions short of fish (first year) | Short of Pearls | Expeditions (short, 8 h, 12 h) | Base resources brought | Amber brought, spent, sessions short of it | Soldiers lost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules (no expedition, no speed-up) | Casual (3 sessions) | 15.5 | 40.4 | 104.7 | 248.8 | day 633 | 156 (5) | 0 | 0, 0, 0 | 0 | 0, 0, 0 | 0 |
| The rules (no expedition, no speed-up) | Regular (6 sessions) | 9.0 | 26.8 | 73.8 | 188.1 | day 497 | 0 (0) | 0 | 0, 0, 0 | 0 | 0, 0, 0 | 0 |
| The rules (no expedition, no speed-up) | Dedicated (10 sessions) | 8.4 | 23.6 | 66.2 | 168.0 | day 474 | 50 (5) | 0 | 0, 0, 0 | 0 | 0, 0, 0 | 0 |
| C · base resources only, zones of 2, 8 and 12 h | Casual (3 sessions) | 14.5 | 39.7 | 101.7 | 239.1 (−9.7) | day 614 (−19) | 203 (3) | 0 | 600, 0, 676 | 4,019,613 | 6,008, 0, 0 | 2,659 |
| C · base resources only, zones of 2, 8 and 12 h | Regular (6 sessions) | 9.0 | 26.2 | 69.9 | 173.7 (−14.4) | day 458 (−39) | 19 (19) | 0 | 8391, 2747, 0 | 16,920,311 | 22,126, 0, 0 | 2,738 |
| C · base resources only, zones of 2, 8 and 12 h | Dedicated (10 sessions) | 8.4 | 23.4 | 65.7 | 170.6 (+2.6) | day 428 (−46) | 2 (2) | 17 | 9468, 3388, 0 | 20,035,994 | 26,408, 0, 0 | 3,377 |
| C · base resources only, zones of 5, 8 and 12 h | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | day 606 (−27) | 184 (2) | 0 | 611, 0, 678 | 4,806,882 | 7,257, 0, 0 | 2,646 |
| C · base resources only, zones of 5, 8 and 12 h | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.6 (−9.5) | day 471 (−26) | 6 (6) | 0 | 0, 2765, 0 | 9,663,750 | 13,825, 0, 0 | 2,755 |
| C · base resources only, zones of 5, 8 and 12 h | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 437 (−37) | 0 (0) | 0 | 0, 3432, 0 | 11,999,340 | 17,160, 0, 0 | 3,423 |
| A · Amber needed for the high levels (2 a level past 15) | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | day 606 (−27) | 184 (2) | 0 | 611, 0, 678 | 4,806,882 | 7,257, 2,910, 0 | 2,646 |
| A · Amber needed for the high levels (2 a level past 15) | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.9 (−9.1) | day 474 (−23) | 0 (0) | 0 | 0, 2777, 0 | 9,706,140 | 13,885, 2,910, 856 | 2,767 |
| A · Amber needed for the high levels (2 a level past 15) | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 436 (−38) | 20 (19) | 0 | 0, 3496, 0 | 12,223,980 | 17,480, 2,910, 849 | 3,487 |
| A · Amber needed for the high levels (1 a level past 15) | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | day 606 (−27) | 184 (2) | 0 | 611, 0, 678 | 4,806,882 | 7,257, 1,455, 0 | 2,646 |
| A · Amber needed for the high levels (1 a level past 15) | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.6 (−9.5) | day 471 (−26) | 6 (6) | 0 | 0, 2765, 0 | 9,663,750 | 13,825, 1,455, 0 | 2,755 |
| A · Amber needed for the high levels (1 a level past 15) | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 437 (−37) | 0 (0) | 0 | 0, 3432, 0 | 11,999,340 | 17,160, 1,455, 0 | 3,423 |
| B · Amber in place of up to 25 % of a cost | Casual (3 sessions) | 13.7 | 34.2 | 96.9 | 219.1 (−29.7) | day 512 (−121) | 47 (5) | 20 | 607, 0, 694 | 4,893,848 | 7,373, 2,571, 0 | 2,719 |
| B · Amber in place of up to 25 % of a cost | Regular (6 sessions) | 8.5 | 25.2 | 64.7 | 164.8 (−23.2) | day 405 (−92) | 8 (8) | 0 | 0, 3338, 0 | 11,663,910 | 16,690, 2,276, 0 | 3,330 |
| B · Amber in place of up to 25 % of a cost | Dedicated (10 sessions) | 8.4 | 22.2 | 57.2 | 150.8 (−17.2) | day 377 (−97) | 21 (21) | 50 | 0, 3681, 0 | 12,870,540 | 18,405, 2,327, 0 | 3,673 |
| B · Amber in place of up to 10 % of a cost | Casual (3 sessions) | 13.7 | 37.4 | 94.9 | 244.1 (−4.7) | day 569 (−64) | 125 (5) | 60 | 619, 0, 688 | 4,856,748 | 7,361, 793, 0 | 2,672 |
| B · Amber in place of up to 10 % of a cost | Regular (6 sessions) | 8.5 | 24.8 | 69.2 | 169.9 (−18.1) | day 445 (−52) | 0 (0) | 0 | 0, 2819, 0 | 9,846,900 | 14,095, 931, 0 | 2,810 |
| B · Amber in place of up to 10 % of a cost | Dedicated (10 sessions) | 8.4 | 22.4 | 60.7 | 152.6 (−15.4) | day 406 (−68) | 52 (23) | 0 | 0, 3543, 0 | 12,382,740 | 17,715, 971, 0 | 3,533 |
| A · 1, 2 and 3 Amber an expedition; 1 a level past 15, 5 and 10 for the House's levels 4 and 5 | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | day 606 (−27) | 184 (2) | 0 | 611, 0, 678 | 4,806,882 | 2,645, 1,455, 0 | 2,646 |
| A · 1, 2 and 3 Amber an expedition; 1 a level past 15, 5 and 10 for the House's levels 4 and 5 | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.2 (−9.9) | day 476 (−21) | 7 (0) | 0 | 0, 2780, 0 | 9,716,940 | 5,560, 1,455, 1179 | 2,770 |
| A · 1, 2 and 3 Amber an expedition; 1 a level past 15, 5 and 10 for the House's levels 4 and 5 | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 158.8 (−9.1) | day 438 (−36) | 15 (10) | 0 | 0, 3597, 0 | 12,579,120 | 7,194, 1,455, 870 | 3,588 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 0 and 0 for the House's levels 4 and 5 | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | day 624 (−9) | 101 (2) | 0 | 610, 0, 659 | 4,704,653 | 2,587, 1,920, 315 | 2,570 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 0 and 0 for the House's levels 4 and 5 | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.6 (−9.5) | day 477 (−20) | 0 (0) | 0 | 0, 2728, 0 | 9,533,880 | 5,456, 1,920, 1267 | 2,718 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 0 and 0 for the House's levels 4 and 5 | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 436 (−38) | 22 (13) | 0 | 0, 3529, 0 | 12,339,810 | 7,058, 1,920, 163 | 3,520 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 2 and 4 for the House's levels 4 and 5 | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | day 683 (+50) | 6 (2) | 0 | 612, 0, 596 | 4,377,346 | 2,400, 2,118, 710 | 2,318 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 2 and 4 for the House's levels 4 and 5 | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.6 (−9.5) | day 521 (+24) | 0 (0) | 0 | 0, 2443, 0 | 8,533,530 | 4,886, 2,118, 1738 | 2,433 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 2 and 4 for the House's levels 4 and 5 | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 444 (−30) | 59 (18) | 0 | 0, 3470, 0 | 12,132,720 | 6,940, 2,118, 1501 | 3,461 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 3 and 6 for the House's levels 4 and 5 | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | day 703 (+70) | 6 (2) | 0 | 612, 0, 602 | 4,408,936 | 2,418, 2,217, 820 | 2,342 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 3 and 6 for the House's levels 4 and 5 | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.9 (−9.1) | day 582 (+85) | 0 (0) | 0 | 0, 2123, 0 | 7,411,500 | 4,246, 2,217, 2316 | 2,113 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 3 and 6 for the House's levels 4 and 5 | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 440 (−34) | 225 (19) | 0 | 0, 3553, 0 | 12,424,050 | 7,106, 2,217, 1650 | 3,544 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 5 and 10 for the House's levels 4 and 5 | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | never | 2 (2) | 0 | 610, 0, 565 | 4,209,743 | 2,305, 2,295, 1136 | 2,194 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 5 and 10 for the House's levels 4 and 5 | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.7 (−9.4) | day 559 (+62) | 0 (0) | 0 | 0, 2345, 0 | 8,189,820 | 4,690, 2,415, 2111 | 2,335 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 5 and 10 for the House's levels 4 and 5 | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.6 (−8.4) | day 452 (−22) | 52 (0) | 0 | 0, 3493, 0 | 12,213,000 | 6,986, 2,415, 2181 | 3,484 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 10 and 20 for the House's levels 4 and 5 | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | never | 0 (0) | 0 | 614, 0, 521 | 3,986,859 | 2,177, 2,166, 1330 | 2,018 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 10 and 20 for the House's levels 4 and 5 | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 177.6 (−10.5) | day 598 (+101) | 0 (0) | 0 | 0, 2346, 0 | 8,191,890 | 4,692, 2,910, 2532 | 2,336 |
| A · 1, 2 and 3 Amber an expedition; 2 a level past 15, 10 and 20 for the House's levels 4 and 5 | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 160.2 (−7.8) | day 455 (−19) | 0 (0) | 0 | 0, 3507, 0 | 12,262,770 | 7,014, 2,910, 3272 | 3,498 |
| A · 1, 2 and 3 Amber an expedition; 3 a level past 15, 10 and 20 for the House's levels 4 and 5 | Casual (3 sessions) | 13.7 | 39.4 | 101.2 | 235.1 (−13.7) | never | 0 (0) | 0 | 617, 0, 521 | 3,993,441 | 2,180, 2,163, 1360 | 2,018 |
| A · 1, 2 and 3 Amber an expedition; 3 a level past 15, 10 and 20 for the House's levels 4 and 5 | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 177.6 (−10.5) | never | 0 (0) | 0 | 0, 1489, 0 | 5,183,820 | 2,978, 2,940, 3554 | 1,479 |
| A · 1, 2 and 3 Amber an expedition; 3 a level past 15, 10 and 20 for the House's levels 4 and 5 | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 160.6 (−7.4) | day 574 (+100) | 0 (0) | 0 | 0, 3152, 0 | 11,015,640 | 6,304, 3,870, 4219 | 3,143 |
| C · base resources only, one fleet away at a time | Casual (3 sessions) | 13.7 | 39.4 | 101.7 | 238.6 (−10.2) | day 610 (−23) | 245 (2) | 0 | 134, 0, 509 | 2,889,805 | 4,474, 0, 0 | 1,970 |
| C · base resources only, one fleet away at a time | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.6 (−9.5) | day 488 (−9) | 7 (5) | 0 | 0, 617, 0 | 2,124,270 | 3,085, 0, 0 | 607 |
| C · base resources only, one fleet away at a time | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 460 (−14) | 280 (0) | 0 | 0, 606, 0 | 2,080,080 | 3,030, 0, 0 | 597 |
| A · Amber needed (1 a level past 15), one fleet away at a time | Casual (3 sessions) | 13.7 | 39.4 | 101.7 | 238.6 (−10.2) | day 610 (−23) | 245 (2) | 0 | 134, 0, 509 | 2,889,805 | 4,474, 1,455, 0 | 1,970 |
| A · Amber needed (1 a level past 15), one fleet away at a time | Regular (6 sessions) | 8.5 | 25.8 | 71.8 | 178.6 (−9.5) | day 488 (−9) | 7 (5) | 0 | 0, 617, 0 | 2,124,270 | 3,085, 1,455, 0 | 607 |
| A · Amber needed (1 a level past 15), one fleet away at a time | Dedicated (10 sessions) | 8.4 | 23.2 | 64.0 | 159.9 (−8.1) | day 460 (−14) | 280 (0) | 0 | 0, 606, 0 | 2,080,080 | 3,030, 1,455, 0 | 597 |
| B · Amber in place of up to 25 % of a cost, one fleet away at a time | Casual (3 sessions) | 13.7 | 34.2 | 96.9 | 215.1 (−33.7) | day 515 (−118) | 85 (6) | 2 | 136, 0, 506 | 2,888,816 | 4,456, 2,627, 0 | 1,967 |
| B · Amber in place of up to 25 % of a cost, one fleet away at a time | Regular (6 sessions) | 8.5 | 25.2 | 64.7 | 164.8 (−23.2) | day 437 (−60) | 4 (4) | 0 | 0, 622, 0 | 2,130,750 | 3,110, 1,705, 0 | 614 |
| B · Amber in place of up to 25 % of a cost, one fleet away at a time | Dedicated (10 sessions) | 8.4 | 22.2 | 57.2 | 150.8 (−17.2) | day 419 (−55) | 97 (49) | 50 | 0, 613, 0 | 2,101,860 | 3,065, 1,572, 0 | 605 |

### Speed-ups

| Setup | Player | Lighthouse 15 | 20 | 25 | 30 (vs the rules) | Whole city at 30 | Sessions short of fish (first year) | Hours taken off | Resources spent on them |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules (no expedition, no speed-up) | Casual (3 sessions) | 15.5 | 40.4 | 104.7 | 248.8 | day 633 | 156 (5) | 0 | 0 |
| The rules (no expedition, no speed-up) | Regular (6 sessions) | 9.0 | 26.8 | 73.8 | 188.1 | day 497 | 0 (0) | 0 | 0 |
| The rules (no expedition, no speed-up) | Dedicated (10 sessions) | 8.4 | 23.6 | 66.2 | 168.0 | day 474 | 50 (5) | 0 | 0 |
| Speed-up, 1 h a day, price ×1, what the reserve leaves | Casual (3 sessions) | 16.7 (+1.2) | 43.4 (+3.0) | 110.2 (+5.5) | 263.1 (+14.3) | day 671 (+38) | 232 (5) | 317 | 2,438,534 |
| Speed-up, 1 h a day, price ×1, what the reserve leaves | Regular (6 sessions) | 9.8 (+0.8) | 28.4 (+1.6) | 75.8 (+2.0) | 191.1 (+3.0) | day 518 (+21) | 10 (10) | 330 | 2,525,576 |
| Speed-up, 1 h a day, price ×1, what the reserve leaves | Dedicated (10 sessions) | 8.6 (+0.1) | 24.7 (+1.1) | 68.8 (+2.7) | 171.2 (+3.2) | day 503 (+29) | 48 (0) | 332 | 2,560,247 |
| Speed-up, 1 h a day, price ×1, from a full storage only | Casual (3 sessions) | 15.5 (+0.0) | 40.4 (+0.0) | 104.7 (+0.0) | 248.8 (+0.0) | day 633 (+0) | 156 (5) | 0 | 0 |
| Speed-up, 1 h a day, price ×1, from a full storage only | Regular (6 sessions) | 9.0 (+0.0) | 26.8 (+0.0) | 73.8 (+0.0) | 188.1 (+0.0) | day 497 (+0) | 0 (0) | 0 | 0 |
| Speed-up, 1 h a day, price ×1, from a full storage only | Dedicated (10 sessions) | 8.4 (+0.0) | 23.6 (+0.0) | 66.2 (+0.0) | 168.0 (+0.0) | day 474 (+0) | 50 (5) | 0 | 0 |
| Speed-up, 2 h a day, price ×1, what the reserve leaves | Casual (3 sessions) | 17.0 (+1.5) | 47.7 (+7.3) | 118.7 (+14.0) | 273.8 (+25.0) | day 703 (+70) | 244 (1) | 623 | 4,748,705 |
| Speed-up, 2 h a day, price ×1, what the reserve leaves | Regular (6 sessions) | 10.7 (+1.6) | 29.2 (+2.4) | 76.7 (+2.9) | 190.9 (+2.9) | day 543 (+46) | 34 (13) | 635 | 4,896,155 |
| Speed-up, 2 h a day, price ×1, what the reserve leaves | Dedicated (10 sessions) | 8.8 (+0.3) | 26.4 (+2.8) | 70.2 (+4.0) | 174.7 (+6.7) | day 524 (+50) | 139 (22) | 623 | 4,821,756 |
| Speed-up, 1 h a day, price ×2, what the reserve leaves | Casual (3 sessions) | 14.5 (−1.0) | 40.4 (+0.0) | 105.7 (+1.0) | 262.1 (+13.3) | day 687 (+54) | 267 (7) | 304 | 4,640,902 |
| Speed-up, 1 h a day, price ×2, what the reserve leaves | Regular (6 sessions) | 11.0 (+2.0) | 31.2 (+4.4) | 79.9 (+6.1) | 194.1 (+6.0) | day 545 (+48) | 40 (17) | 316 | 4,812,520 |
| Speed-up, 1 h a day, price ×2, what the reserve leaves | Dedicated (10 sessions) | 8.6 (+0.2) | 24.8 (+1.2) | 69.7 (+3.6) | 170.9 (+2.9) | day 523 (+49) | 130 (26) | 316 | 4,898,924 |

### Contested isles and shoals

| Setup | Player | Lighthouse 30 (vs the rules) | Whole city at 30 | Sessions short of fish (first year) | short of wood | Wood and fish the fleets took from isles and shoals | of which to another city |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The rules (no expedition, no speed-up) | Casual (3 sessions) | 248.8 | day 633 | 156 (5) | 801 | 14,038,446 | 0 |
| The rules (no expedition, no speed-up) | Regular (6 sessions) | 188.1 | day 497 | 0 (0) | 1910 | 24,283,344 | 0 |
| The rules (no expedition, no speed-up) | Dedicated (10 sessions) | 168.0 | day 474 | 50 (5) | 3268 | 24,767,028 | 0 |
| Contested isles and shoals: a quarter of their harvest to another city | Casual (3 sessions) | 252.1 (+3.3) | day 678 (+45) | 465 (4) | 948 | 14,203,716 | 3,552,363 |
| Contested isles and shoals: a quarter of their harvest to another city | Regular (6 sessions) | 192.9 (+4.9) | day 540 (+43) | 438 (45) | 1762 | 24,126,030 | 6,033,864 |
| Contested isles and shoals: a quarter of their harvest to another city | Dedicated (10 sessions) | 171.0 (+3.1) | day 527 (+53) | 852 (77) | 3146 | 24,733,602 | 6,185,810 |
| Contested isles and shoals: half their harvest to another city | Casual (3 sessions) | 248.6 (−0.2) | never | 662 (4) | 889 | 14,643,558 | 7,321,779 |
| Contested isles and shoals: half their harvest to another city | Regular (6 sessions) | 196.7 (+8.6) | day 629 (+132) | 1142 (36) | 1650 | 23,982,156 | 11,990,986 |
| Contested isles and shoals: half their harvest to another city | Dedicated (10 sessions) | 180.6 (+12.6) | day 629 (+155) | 2321 (391) | 2921 | 24,443,298 | 12,221,449 |

<!-- sea-hunt:generated:end -->
