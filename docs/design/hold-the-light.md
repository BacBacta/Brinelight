# Hold the Light

The design and the plan of Brinelight's portal edition, approved by the owner on 24 November 2026: a game of its own beside the Brinelight on Solana, made for CrazyGames, with no server, no account and no blockchain.

This is a design and a plan, not the game. Every number below is a **starting value**, to be confirmed by play tests before it is called balance. Nothing here changes a rule or a value of the Brinelight on Solana.

## Why

- Brinelight today is a city builder on real-hour timers. After 15 minutes a new player has almost nothing to do (`docs/tasks/early-start.md`): quest 9 at 14 minutes, quest 10 at 53.
- CrazyGames judges a game in its Basic Launch on its average play time (10 minutes and more for the games it keeps), its return the next day (10 to 15 %) and the share of visitors who play a minute or more (80 % and more).
- Its most popular strategy games on 24 November 2026 are, six out of seven, games of waves played from the first second: the defense of a tower with choices at each wave, short runs, a permanent progress between runs, daily tasks.

## The game in one paragraph

Each Night the Mist falls and things come out of it, from every side of the sea, toward your island. You turn the Lighthouse's beam on them, post your troops on your rafts, and choose one card of three after each wave. Your oil is the Lighthouse's life: when it runs out, the Night ends. At dawn you bring back what the Night gave and spend it in your city, where every building makes the next Night's Lighthouse stronger, at once, with no timer.

## A Night

| | |
| --- | --- |
| Length | 4 to 12 minutes |
| Your hand | The beam: it follows the pointer (mouse or finger; arrow keys or A/D turn it). It burns what it lights. |
| Your posts | Your rafts around the island. On each, one troop of harpooners, crossbowmen or boarders, who fire on their own. |
| Your life | The oil. An enemy that reaches the coast steals some. The beam burns none: holding it costs nothing, so you never stop playing. |
| A wave | 20 to 40 seconds of enemies, then a pause: choose 1 card of 3. |
| A boss | Every 10 waves. The Leviathan at wave 30. |
| The end | The Lighthouse goes dark (Night lost) or the Night's last wave is beaten (dawn). Both pay. |

**Three families of enemies**, on the troops' triangle already in the rules (boarders beat harpooners, who beat crossbowmen, who beat boarders):

| Family | What it does | Weak to |
| --- | --- | --- |
| Raiders (pirate skiffs) | Many, quick, straight to the coast | Crossbowmen |
| Beasts of the Mist | Few, slow, tough | Harpooners |
| Wraiths | Fade out of the beam, strike the posts | Boarders |

The beam hurts all three. A post hurts its own family 1.2 times as much (`COUNTER_BONUS`), so where you post what matters, and the beam covers the side your posts do not.

**Cards.** About 24 at first, in four groups: the beam (wider, a second beam, it slows), the posts (one more raft tonight, a troop's level, a quicker fire), the oil (a reserve, oil back per wave), the captains (one captain's power tonight). Three are drawn after each wave from the Night's seed: free, and the same seed always gives the same draw.

**Captains.** The six captains become the Night's active powers: one lead captain, one power on a cooldown (a flare that lights the whole sea, a volley, a wall of nets…). Shards unlock them, as today.

## The Day: your city

No timer. You spend the Night's loot; the building changes at once, and the city you already know grows on the screen.

| Building | What it gives the Nights |
| --- | --- |
| Lighthouse | The beam's strength and reach. Its level opens the next Nights and the city's eras. |
| Refinery | The oil you start a Night with. |
| Barracks | The level of the troops you post. |
| Harbor (shipyard) | The number of rafts, so of posts. |
| Observatory | New cards in the draw. |
| Infirmary | One second chance a Night. |
| Fishery, Lumberyard, Shelters | What the city makes while you are away. |

## What makes you come back

- **In a session:** a lost Night still pays for one upgrade. The next Night starts in one tap.
- **The sea chart:** 30 Nights, each with its mix of families and its rule (a Night of Wraiths, a Night with no pause…), then the Endless Night and your own record.
- **While you are away:** the city makes wood, fish and oil, up to a few hours' worth. It is the chest of your return.
- **Daily tasks and the free daily recruitment:** already in the game.
- **The eras:** the city changes its look with the Lighthouse. Already modeled.

## What it keeps, what it leaves

- **Keeps:** the engine, the 3D city and its eras, the rafts and their slots, the captains, the troops' triangle, the four resources and the Pearls, the sounds, the UI kit, the tests, rules apart from display.
- **Leaves, in this edition:** timers in hours, fleets' trips, the server, accounts, the wallet, proofs, Alliance, Shop, payments.
- **To make:** the enemies and bosses, the beam's and the Mist's effects, the cards' pictures, the sea chart.

## The principles, checked

- **"A city can never be attacked"** speaks of players. Here creatures come at the Lighthouse; nothing of the city is destroyed or stolen for good, and a Night lost still pays. Owner's yes of 24 November with the concept.
- **Never paid randomness:** the cards' draw and the waves are free, and come from a seed.
- **Nothing for sale** in the Basic Launch build: no payment, no ads.
- **Rewarded ads** (Full Launch) are **not** in this design: a reward for an ad is a decision for the owner, then.
- **Protected areas:** none is touched. The portal build carries no code of sign-in, payments or the notary.

## Where it lives

| What | Where |
| --- | --- |
| The Night's rules, pure and tested | `shared/src/rules/night/`, tests in `shared/test/night/` |
| The Night's and the portal city's state, its save | `shared/src/state/night/` |
| The Night's scene, input and screens | `client/src/night/` |
| The portal's entry | `client/portal.html` → `client/src/portal.ts` |
| Its build | `npm run build:portal` → `client/dist-portal/` |
| Its save on the device | `brinelight-portal-v1` (never the keys of the Brinelight on Solana) |

Rules that hold for all of it:

- **A fixed step.** The Night advances by steps of 1/30 s inside the rules, whatever the screen's rate: the same Night on a 60 Hz phone and a 165 Hz monitor (a CrazyGames requirement), and a Night can be replayed in a test.
- **No clock and no randomness in `shared/`.** The Night's state carries its seed and its step count; the client gives the time elapsed and the pointer's angle, nothing else.
- **The client still only sends intentions:** "the beam at this angle", "this troop on this raft", "this card". The rules decide the rest. The day a server checks a record, it replays the Night from its seed and its inputs.
- **The portal's values are its own** (`shared/src/rules/night/values.ts`). No value of the Brinelight on Solana is read as balance or changed.

## The plan

Seven steps, three gates. **Order changed by the owner on 24 November: step 4 (the city between the Nights) comes before step 3 (depth), and gate A after step 4**, so that the first testers play the whole loop (a Night, its loot spent, the next Night) and not a gesture with no purpose; gate B stays after step 3. The steps keep their numbers. A step starts only when the one before is green (`npm run check`) and, at a gate, when the owner has said yes.

### Step 0 · The portal build

- **Does:** `build:portal`: its own entry, relative paths, no `prototype/` folder (the Lighthouse kit it still loads moves to `client/public/models/`), no account, wallet or proof code.
- **Does not:** change the build of brinelight.pages.dev.
- **Tested:** a test builds it and checks its files: no absolute path, none of "wallet", "Solana", "Phantom", no server address, under 20 MB, under 1,500 files; it opens from a sub-folder.

### Step 1 · A Night in the rules

- **Does:** the Night's state and its step: enemies on their bearing toward the coast, the beam (angle, width, damage a second), the oil stolen, the waves from the seed, the Night won or lost, the loot.
- **Does not:** posts, cards, bosses, the city. No display.
- **Tested:** written first. An enemy in the beam dies in the time its health says; outside it, it reaches the coast and steals its oil; the same seed and inputs give the same Night step for step; 1 step of 1/15 s equals 2 of 1/30 s; a Night with no input is lost at a known step.

### Step 2 · A Night you can play, in plain shapes

- **Does:** the island as it is, enemies as plain shapes, the beam as a cone of light, the pointer and the keys, the oil's gauge, the wave's number, the end screen with "Again". The game opens **in** the first Night: no menu.
- **Does not:** any new model, any sound of its own, the city's screens.
- **Tested:** e2e: the Night starts within 10 s of the page, the beam follows the pointer, a Night left alone ends on the end screen; 60 FPS at the S22's size with 150 enemies.

> **Gate A · Is the beam fun?** Five people who never saw the game play it, with nothing explained. Yes if four of five start a second Night on their own and none asks what to do. If not, the beam is reworked before anything else is built.

### Step 3 · Depth

- **Does:** the posts on the rafts and the three families; the cards (24, three drawn from the seed); the first boss at wave 10; a captain's power.
- **Does not:** the sea chart, the other bosses.
- **Tested:** the triangle (a post against its family, 1.2 times); a draw is three different cards, the same for the same seed; each card's effect, one test each; the boss's phases.

### Step 4 · The city between the Nights

- **Does:** the loot at dawn; the buildings' upgrades at once, each with its effect on the Night; the save (`brinelight-portal-v1`, strict parse, as `parseState`); the first minutes' guide (the quest card, pointing at what to tap); the Nights 1 to 5.
- **Does not:** offline production, daily tasks.
- **Tested:** each building's effect read by the Night's rules; an upgrade refused with its reason when the loot is short; a save edited by hand is refused or repaired, never trusted blindly by a future server; e2e: Night, dawn, upgrade, Night again.

> **Gate B · Does a session hold?** Ten new players, measured by the game itself on the device (nothing sent): the median first session over 10 minutes, eight of ten play a minute or more, six of ten reach the third Night. If not, the first five Nights and their loot are tuned before any content is added.

### Step 5 · Content and return

- **Does:** the sea chart (30 Nights and their rules), the bosses of waves 20 and 30 (the Leviathan), the six captains' powers, the Endless Night and your record; what the city makes while you are away; the daily tasks and the free daily recruitment, from the rules that exist.
- **Does not:** rankings between players (they need the SDK or a server).
- **Tested:** each Night of the chart can be won by a simulated player with the city its place on the chart supposes (`tools/night/`), and cannot with the city of five Nights before: a curve, not a wall.

### Step 6 · The look and the sound

- **Does:** the enemies' and bosses' models (one draw call a family, instanced), the beam and the Mist, the hits, the Night's sounds and its music, the cards' pictures.
- **Does not:** change a rule.
- **Tested:** 60 FPS on the S22 at wave 30; the first Night's download under 5 MB before play, the rest fetched during it; the look references of the e2e.

### Step 7 · To CrazyGames

- **Does:** the frame sizes they ask for (821 × 462 to 1920 × 1080, 800 × 450, portrait on a phone), Safari and a 4 GB Chromebook, no outside link, the three covers and the two videos, the English description and controls, their preview tool, the submission.
- **Tested:** the checks of step 0 on the final build; a capture at each size in the e2e.

> **Gate C · Submit?** The owner plays the final build in CrazyGames' preview tool and says yes. A clear failure in Basic Launch means submitting again as a new game: better a week late than a week early.

### After the Basic Launch

Only if CrazyGames invites the game to a Full Launch: their SDK (a new dependency, announced then), gameplay start and stop events, the mute setting, the save through their data module, rankings of the Endless Night. Ads: the owner's decision, with the principles in hand.

## Starting values

To be tuned at gates A and B; none is balance yet.

| | Starting value |
| --- | --- |
| Step | 1/30 s |
| Night 1 | 5 waves, about 3 minutes, Raiders only, cannot be lost before wave 3 |
| Nights 2 to 5 | 8 to 12 waves; Beasts from Night 2, posts from Night 2, Wraiths from Night 4 |
| Beam | 40° wide, turns as fast as the pointer |
| Oil at the start | 100; a Raider steals 5, a Beast 20, a Wraith 10 |
| First card | after wave 1, about 40 s into the game |
| Loot of a lost Night | at least the cheapest upgrade then on offer |
| Away | the city's production, up to 4 hours' worth |

## Settled by the owner

- **The game's name on CrazyGames: "Brinelight: Hold the Light"** (24 November). Its uniqueness there is checked at step 7.
- **The sea's names in English in this edition** (24 November): Murène → Moray, Vorace → Ravener, Barbe-Sel → Saltbeard, Lierre → Ivy, Orme → Elm, Perle → Pearl, Ondine → Undine, Topaze → Topaz, Gaspard → Jasper, Krake → Kraken; Aldo, Runa and Brann stay. The Brinelight on Solana keeps its names.

## Open question for the owner

- Rewarded ads at the Full Launch: yes or no, and for what.
