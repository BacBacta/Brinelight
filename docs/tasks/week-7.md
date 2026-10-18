# Week 7 · The Mist, the rafts, the Leviathan, the objectives

Goal of the week: the Mist becomes a rule, not just a look. It comes at fixed hours, hides the far sea, slows the city unless the Lighthouse is stoked, and damages the rafts of a city that did not hold. Repairing the rafts gives oil a use: it overflows today (open questions in `docs/decisions.md`). A Leviathan rises at sea, to hunt alone for now. A list of objectives guides the first hours, and daily tasks bring the player back. A last task checks, with the balance simulation, that the Lighthouse's pace set in week 6 does not move by more than 10 %.

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- Every rule lives in `shared/src/rules/` with its tests in `shared/test/`, test first when possible. The server decides; the client sends intentions only ("stoke the Lighthouse", "repair the rafts", "send a fleet to the Leviathan", "claim this objective"), never a result, a time or an amount.
- Every balance value is new and announced: the owner approves the values before the task starts (the open questions below), and each one is written down in `docs/decisions.md`.
- **Nothing for sale is ever a reward.** The Leviathan, the objectives and the daily tasks give resources, Pearls and captain shards only. They never give convenience time (the "speedups" of the prototype are paid convenience: `COMFORT_CAP`), never a recruitment, never anything bought.
- **No randomness.** The prototype draws the Mist's next hour, the Leviathan's next rise and the captain who gets the Leviathan's shards at random; here all three are fixed and published. The daily recruitment (week 15) stays the only random draw.
- No multiplayer: no alliance help, no treasury, no Sea Pact, no notarization on Solana (week 8 at the earliest). The Leviathan is hunted alone this week.
- Recurring hours (the Mist, the Leviathan, the daily reset) are fixed UTC hours for now, provisional: they become hours per server with multiplayer.
- The city gets new fields: each task that adds some raises `CITY_SHAPE` by one, with its step in `shared/src/state/migrate.ts` (it adds what is missing, never changes a value) and its test with the week 6 city.
- Player text in English, short, second person. Every new sheet or banner is checked at 412 × 915 and 360 × 800; the look references that change are made again by the CI (`e2e/look/README.md`), and the owner is told which ones before they are committed.
- What the player sees never decides anything: the countdowns, banners and celebrations follow the city the rules made.

## Task 1 · The Mist

What it does:

- **A clock in the city.** The city gets `clock`: its game time, in seconds since 1 January 1970 (UTC), that `advance` moves forward. The server sets it when the city is made, and the migration of the stored cities sets it from their last save. The client never sends it. With `DEV_SPEED`, the clock runs faster, like the rest of the game.
- **A fixed calendar, the same for every city** (`shared/src/rules/mist.ts`): `mistAt(clock)` says whether the Mist is on, when it starts and when it ends. Every Mist is announced one hour before it starts. A fixed calendar lets the alliances of weeks 9 to 13 face the same Mist without changing the rule.
- **Stoking is an order that stays, on by default.** The action `stoke { on }` ("Keep the Lighthouse stoked") can be given at any time; it applies during every Mist, offline too, as long as there is oil. During the Mist:
  - stoked: the Lighthouse burns 1.5 times its oil (`STOKE_MULTIPLIER`, 2.2 until the owner chose 1.5 on 18 October), production stays normal;
  - not stoked, or out of oil: production of oil, fish and wood is cut by 30 % (`MIST_PENALTY`, already in the rules).
- **What it hides.** During the Mist, the sea beyond the Lighthouse's light is hidden: you cannot send a new fleet to a site farther from your city than `lightRadius(lighthouse, stoked)`. Fleets already at sea carry on. Refusal: "The Mist hides this place. Stoke the Lighthouse or wait for it to lift."
- **What pushes it back.** The light's reach grows with the Lighthouse's level, and stoking adds to it.
- **Held or not.** A Mist is held when the Lighthouse stayed stoked from its start to its end without running out of oil.
  - Held: +30 Pearls, as in the prototype.
  - Not held: each raft loses 35 sturdiness, never below 25 (`MIST_RAFT_DAMAGE` and `applyMistDamage`, already in the rules, never used until now).
  - Either way, the end of a Mist is an event of `advance` (one celebration: "You held the Mist · +30 Pearls" or "The Mist damaged 4 rafts. Repair them.").
- `advance` cuts at each Mist's start and end, as it does for the other events: advancing 10 hours at once gives the same city as ten times one hour.
- **Client:**
  - `seaMood()` reads the rule; `?mist` stays as a preview.
  - The banner says "Mist in 52 min · enough oil" or "Mist · 1 h 10 left · Lighthouse stoked".
  - The Lighthouse's sheet gets the stoke switch.
  - At sea, hidden sites are drawn in the fog and refuse a fleet with the reason.

What it does not do:

- No morale or survivors moved by the Mist (morale does not move at all today; see question 1.6).
- No Nera skill ("−50 % losses in the Great Mist" stays text only, as in the prototype).
- No Mist per alliance, no notarization.
- The Mist's look of week 6 does not change.

How it is tested:

- `shared/test/mist.test.ts`:
  - the calendar at its edges (a second before, at, a second after), the warning;
  - the light's reach by level, stoked or not;
  - a hidden site refused, a visible one accepted, a fleet already at sea untouched.
- State tests:
  - production and oil during a Mist, stoked or not;
  - running out of oil in the middle (the Mist is then not held, and production drops at that moment);
  - held → +30 Pearls; not held → every raft −35, never below 25;
  - one long `advance` equals many short ones, across several Mists.
- Migration 5 → 6 with the week 6 city; `parseState` refuses a city without a clock.
- Server cheat cases: a client sending a clock, Pearls or raft sturdiness gets the server's city; `stoke` with anything but a boolean is refused.
- e2e: the banner counts down to a Mist (server with `DEV_SPEED`); the stoke switch is applied by the server and found again after a reload.

Decided by the owner (18 October):

1. **The calendar:** three Mists a day, every 8 hours, each lasting 2 hours, at 04:00, 12:00 and 20:00 UTC, announced one hour before. These fixed UTC hours are provisional: they become hours per server with multiplayer (`docs/decisions.md`).
2. **Stoking is an order that stays, on by default for a new city.** The Mist punishes a lack of oil, never an absence. A stored city gets it on too.
3. **The light's reach:** 15 + 2 × the Lighthouse's level map units, +10 when stoked.
4. **A Mist held:** +30 Pearls.
5. **A Mist not held:** each raft loses 35 sturdiness, **never below 25**. A raft is never stopped: below 60 it runs at half efficiency, as today. An absent player does not find a city at a standstill.
6. **Morale and survivors:** not this week.

**Done (18 October).**
- **Rule:** `shared/src/rules/mist.ts`; the clock and the Mist in the city (shape 6, migrated from the last save); the action `stoke`; the far sea hidden in the Mist.
- **Celebrations:** "You held the Mist · +30 Pearls" and "Your Lighthouse went dark in the Mist · N rafts damaged".
- **Client:** the banner counts down ("Mist in 52 min · enough oil", "Mist · 1 h 10 left · Lighthouse stoked"); the 3D view fades into the Mist when the rules say so; the Lighthouse's sheet has the order to stoke and the camps and wrecks its light reaches; at sea, the places beyond the light fade.
- **Tests:** shared (`mist.test.ts` and the others), the server's cheat case, an e2e scenario (the countdown, the order sent and found again, the Mist lifting by the server's clock).
- **Balance:** the simulation plays the Mist. Task 5 looks at its effect: the casual player's Lighthouse 10 moves from day 7.6 to 12.6, short of oil.

## Task 2 · Repairing the rafts

What it does:

- **A new shipyard work, "Repair the rafts"** (`yard.kind: "repair"`): all the damaged rafts at once, one action, the shipyard busy while it lasts.
- **Its cost is mostly oil** (tar to caulk the hulls), so a city that does not hold the Mist spends its extra oil on it. A little wood too. The cost grows with the Lighthouse's level, so that oil still has a use when the storage holds hundreds of thousands. Today's `repairCost` (3 wood per missing point, instant, never used) is replaced.
- **What it unlocks:**
  - a raft back at 100 runs at full efficiency again (below 60 it runs at half, as today);
  - a raft below 60 cannot be upgraded until it is repaired ("Repair this raft first");
  - a raft never goes below 25, and is never stopped (owner's decision).
- **Client:**
  - the raft's sheet shows the sturdiness, the cost and the button;
  - the shipyard's queue row says "Repairing 4 rafts";
  - the city already shows damaged rafts (week 5).

What it does not do:

- No raft is ever destroyed.
- No other damage than the Mist's: no storms, no attacks on rafts.
- No repair one raft at a time (see question 2.3).

How it is tested:

- Rule tests:
  - the cost and duration for one and several rafts and at several Lighthouse levels;
  - nothing to repair → "Your rafts are in good shape";
  - shipyard busy, not enough resources;
  - efficiency at 100, 59 and 25;
  - upgrade refused below 60.
- State tests: the repair ends as an event of `advance`, every repaired raft at 100.
- Migration (a yard of kind `repair` is new: shape 7), parse, server cheat cases, e2e (a city damaged by a Mist under `DEV_SPEED`, repaired from a raft's sheet).

Decided by the owner (18 October):

1. **The cost:** per missing sturdiness point, 2 × the Lighthouse's level in oil and 1 wood.
2. **The duration:** 6 minutes of shipyard per 35 missing points (per raft), every damaged raft in one work.
3. **All at once:** one tap repairs every damaged raft.
4. **No raft is ever stopped:** a raft never goes below 25 (task 1), and below 60 its building runs at half efficiency, never at a standstill. What the repair unlocks: full efficiency again, and the raft's building can be upgraded again (refused below 60: "Repair this raft first").

**Done (18 October).**
- **Rule:** `repairRafts` repairs every damaged raft at once at the shipyard: 2 × the Lighthouse's level in oil and 1 wood per missing point, 6 minutes per 35 points; a raft below 60 must be repaired before its building is upgraded.
- **Client:** every raft's sheet offers the repair while some rafts are damaged (cost, time), the rafts under repair show it, the queue says "Shipyard · repairing 2 rafts", and "2 rafts repaired" is celebrated.
- **Tests:** `shared/test/repair.test.ts`, the server's cheat case, an e2e scenario (repaired from a raft's sheet, sound again by the server's clock).
- **No shape change:** the plan's shape 7 was not needed, since the repair adds no field to the city.
- **What it cannot do alone:** halve the oil that overflows. The regular and dedicated players never miss a Mist, so they never repair; task 5 measures this.

## Task 3 · The Leviathan

What it does:

- **A Leviathan rises at sea at fixed hours**, the same for every city (on the city's clock). It stays for its hunt and then dives.
- **The hunt:**
  - you send a fleet to it (a new fleet kind, `hunt`), with all your troops and veterans, as for a camp;
  - the fleet stays until the hunt ends, then comes home;
  - it deals damage while it is there: its attack, as computed for a camp (troops, veterans, lead captain, Watchtowers, research), per hour on site.
- **The Leviathan's health depends on its level.** Its level is per city, as the pirate camps' are, and rises by one each time you kill it. It is hunted alone this week; the alliance's hunt comes with multiplayer.
- **Rewards, fixed and published, at the hunt's end:**
  - Pearls by the share of its health you took;
  - shards when you kill it;
  - experience for the captain who led the fleet.
- **No troop is lost:** the Leviathan dives, it does not sink fleets (as in the prototype).
- **Client:**
  - the Leviathan on the sea map, with its countdown (the week 5 model);
  - its sheet: health, level, time left, the rewards, and the button "Send my fleet";
  - a report at the end of each hunt.

What it does not do:

- No alliance, no treasury, no share between players, no notarization.
- No random captain for the shards.
- No troop losses or wounded.
- The Mist does not hide the Leviathan (it rises near the Great Lighthouse, 18 units from your city).

How it is tested:

- Rule tests:
  - the calendar;
  - health by level;
  - damage for a known fleet (the same attack as against a camp);
  - killed or not, the rewards for a known share;
  - the level rising after a kill;
  - the refusals: no hunt now, fewer than 5 troops, all fleets at sea.
- State tests:
  - a fleet sent mid-hunt deals damage only for the time it is there;
  - the report;
  - one long `advance` equals many short ones.
- Migration (`leviathan` in the city, the fleet kind `hunt`: shape 8), parse, server cheat cases (a client sending damage or Pearls), e2e (the hunt under `DEV_SPEED`: send, report).

Decided by the owner (18 October):

1. **The calendar:** twice a day, at 13:00 and 19:00 UTC, each hunt lasting 2 hours (provisional UTC hours, as the Mist's).
2. **Its health:** 4,000 at level 1, ×1.5 a level; its level rises by one after each kill.
3. **The rewards:** 20 + 180 × your share of its health in Pearls; 3 shards of the captain who led the hunt when you kill it; +30 experience for that captain. Never anything for sale.
4. **No troop is lost.**

**Done (18 October).**
- **Rule:** `shared/src/rules/leviathan.ts` (calendar, health, Pearls), and in `sea.ts` the site `leviathan`, the fleet kind `hunt` and the hunt in `advanceFleets`: damage = the fleet's attack as against a camp, with no troop to counter (`huntAttack`), per hour on site; killed when its health is all taken, or it dives at the hunt's end; the rewards then, at once. Refusals: "The Leviathan is not at sea. Wait for it to rise.", "The Leviathan has dived. Wait for it to rise again.", "Your fleet would get there after the Leviathan dives", and those of a camp (fewer than 5 troops, every fleet at sea). The Mist never hides it.
- **The city** (shape 7): `leviathan { level, hunt, damage, over }`; the report of a hunt is a combat report with `hunt { damage, health, share }`, no loss, its Pearls as loot.
- **Where:** by the Great Lighthouse, 17 map units from your city (−6, −3), in the sea map's first view; at (1.6, 2.6), 18 units away, it was off screen.
- **Client:** the prototype's sea serpent, shown while it is at sea for you; its label counts down ("Leviathan · 1 h 59 left", "Leviathan in 4 h 00"); its sheet (level, health, time left, your damage, the rewards, "Send my fleet"); the hunt report.
- **Tests:** `shared/test/leviathan.test.ts`, migration 6 → 7, a server cheat case (a client sending damage, a share, Pearls, a level or shards), client tests, an e2e scenario (the sheet at sea, the fleet sent, the report when it dives by the server's clock).
- **Not measured yet:** how much of its health the simulated players take; task 5 adds the hunt to the simulation.

## Task 4 · Objectives and daily tasks

What it does:

- **Objectives** (`shared/src/rules/objectives.ts`): a fixed list, one at a time, in order. Each one has a condition read from the city and a reward you claim (action `claimObjective`). The list is the prototype's, without what needs other players or a payment:
  - the alliance's help, the free recruitment and the Sea Pact are left out;
  - the speedups in its rewards are replaced by resources.

  **Recommendation** (the prototype's order and rewards, the speedups replaced):

  | # | Objective | Reward |
  | --- | --- | --- |
  | 1 | Upgrade the Refinery to level 2 | 150 wood, 100 fish |
  | 2 | Build the Barracks | 200 fish |
  | 3 | Build the Harbor | 150 oil |
  | 4 | Build the Observatory | 200 oil, 150 wood |
  | 5 | Start your first research | 200 wood (2 speedups in the prototype) |
  | 6 | Send a fleet to gather at sea | 100 Pearls |
  | 7 | Upgrade the Lighthouse to level 3 | 300 oil, 300 wood |
  | 8 | Train troops at the Barracks | 200 fish (2 speedups) |
  | 9 | Beat a pirate camp | 150 Pearls |
  | 10 | Build the Infirmary | 250 fish |
  | 11 | Keep the Lighthouse stoked through a Mist | 250 oil |
  | 12 | Upgrade the Lumberyard to level 3 | 300 fish (the prototype's "Join the Leviathan hunt", which needs you online at a fixed hour) |
  | 13 | Upgrade the Shelters to level 3 | 300 fish |
  | 14 | Upgrade the Lighthouse to level 4 | 400 oil, 400 wood, 400 fish |
  | 15 | Moor your first raft | 2 rope, 300 wood |
  | 16 | Put a Kelp Greenhouse on a raft | 400 fish |
  | 17 | Upgrade the Harbor to level 3 | 200 Pearls |
  | 18 | Bring the Lighthouse to level 5 | 300 Pearls (and 5 speedups) |

- **Daily tasks** (`shared/src/rules/daily.ts`):
  - a fixed list of tasks with points, counted by the rules as you play;
  - chests at 20, 40, 60, 80 and 100 points, claimed by an action (`claimChest`);
  - everything resets at 00:00 UTC on the city's clock;
  - the counters the tasks need (gathers, camps beaten, troops trained, Mists held, hunts joined) are kept by the rules.
- **Client:**
  - the current objective under the top bar, with "Claim" when it is done;
  - a Daily Tasks sheet: the tasks, the points, the five chests.

What it does not do:

- No season pass, no badges (a cNFT badge is a Solana task).
- No alliance tasks, no free recruitment task.
- No claim on the client's word: the server checks the condition.

How it is tested:

- Rule tests:
  - every objective's condition on a city that meets it and one that does not;
  - claim in order only ("Finish your current objective first"), once only;
  - the rewards;
  - daily points counted from the city's actions;
  - chests at their thresholds, once a day;
  - the reset at midnight UTC, including across an `advance` that spans midnight.
- Migration (`objective`, `daily`, counters: shape 9), parse, server cheat cases (claiming an unmet objective, a chest twice, a chest from yesterday), e2e (claim the first objective, open a chest), look captures of the new sheets.

Decided by the owner (18 October):

- **No objective and no daily task asks you to be online at a fixed hour.**
  - "Keep the Lighthouse stoked through a Mist" stays: stoking is on by default and works offline, so only oil counts.
  - "Join the Leviathan hunt" is out of both lists, unless task 3 lets you join any rising of the day without being there at that hour (for instance a fleet ordered ahead to wait for the next rising). That is decided with task 3.
1. **The objectives:** the table above, with objective 12 replaced by "Upgrade the Lumberyard to level 3" (300 fish).
2. **The daily tasks**, 110 points, so one can be skipped:
   - "Start 3 upgrades" (30);
   - "Gather at sea 3 times" (20);
   - "Beat 2 pirate camps" (20);
   - "Train troops" (10);
   - "Keep the Lighthouse stoked through a Mist" (20);
   - "Start a research" (10).

   The chests:
   - 20: 300 wood and 300 fish × the Lighthouse's level / 5;
   - 40: 400 oil × the level / 5;
   - 60: 100 Pearls;
   - 80: 400 oil and 2 rope;
   - 100: 200 Pearls.
3. **The reset:** 00:00 UTC (provisional, as the Mist's hours).
4. **Points are counted alone;** only the chests are claimed.

**Done (18 October).**
- **Rules:** `shared/src/rules/objectives.ts` (the 18 objectives, each read from the city) and `shared/src/rules/daily.ts` (the six tasks, the five chests, the day on the city's clock). `applyAction` counts what an action starts (an upgrade, a fleet to a wreck, a training, a research); `advance` counts the camps beaten and the Mists held, and cuts time at 00:00 UTC so a day's counts never straddle two days. Actions `claimObjective` (no field) and `claimChest { chest }`. Refusals: "Finish your current objective first", "You have finished every objective", "Not enough points yet", "You already opened this chest today".
- **Rewards** go into the stock with no storage cap, as a camp's loot, and the Pearls to the Pearls.
- **The city** (shape 8): `objective`, `progress { gathers, trained, camps }` (since the city was founded, for objectives 6, 8 and 9), `daily { day, counts, chests }`.
- **Client:** the current objective in a card above the bottom menu, where the prototype has it (not under the top bar: the top bar's and the queue's captures stay as they are); a Tasks button on the right under the top bar, with today's points and a dot when a chest can be opened; the Daily Tasks sheet. Both are hidden at sea.
- **Tests:** `shared/test/objectives.test.ts` (each condition, in order, once, the rewards, the counts, the chests, the reset at midnight across an `advance`), migration 7 → 8, a server cheat case, client tests, an e2e scenario, and the look captures `quest-412`, `quest-360`, `daily-412`, `daily-360` (taken from the CI).

## Task 5 · The balance, with the new rules

What it does:

- `tools/balance/` plays the new rules. Its player:
  - keeps the Lighthouse stoked when the oil lasts;
  - repairs the rafts when they are below 60;
  - joins each Leviathan hunt it is present for;
  - claims every objective and chest at its sessions.
- `npm run balance` writes the CSV, the chart and the tables again (one year). `docs/balance.md` gets three new tables:
  - oil spent (stoking, repairs) against oil full;
  - Mists held and missed per profile;
  - hunts joined and killed.
- **The check:** each Lighthouse milestone (5, 10, 15, 20, 25, 30) of each profile stays within 10 % of week 6's (`c307f9f`). A test keeps that true until the owner changes it.
- If a milestone moves by more than 10 %, or oil still overflows, the task stops there. It gives the measured options to the owner (as in week 6); no value changes without their approval.

What it does not do:

- No balance value changed without approval.
- Still not modeled: other players, the daily recruitment.

How it is tested:

- The simulation's tests (determinism, every city readable by `parseState`, the committed files up to date) and the new ±10 % test.

Decided by the owner (18 October):

1. **The 10 %:** against the days of week 6 (`c307f9f`), milestone by milestone, per profile.
2. **The target for oil:** the regular player's hours with full oil in the first 90 days fall by at least half (651 today).
3. **Two more profiles:** "never stokes" (the order turned off at the start) and "away 3 days, then back" (a regular player who stops on day 20 and comes back on day 23). For each, the report gives what they find on their return, and the oil and time it takes to repair everything.
4. **The Pearls:** per profile, Pearls earned a day and from what (the Mist, the Leviathan, objectives, chests), against what Pearls can buy today. If nothing spends them yet, say so and propose where, without applying it.
