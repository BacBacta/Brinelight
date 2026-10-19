# Week 8 · The game server online

Goal of the week: the game server runs on a Hetzner machine, at `https://api.brinelight.xyz`, with the game at `https://play.brinelight.xyz`. Its database is backed up every night, a restore is tested on its own every week, and you get an e-mail when the server is down. The kit has been ready since week 4 (`deploy/`, `docs/deploy.md`) and the CI starts it on every push. This week makes it real, then measures how many players one machine holds. Before it, a task from the players' feedback that needs nothing from the server: buildings that change with every level. Three smaller tasks follow: the Mist and Leviathan hours per server, the CI actions on Node 24, and the other buildings that pass the storage.

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- **Secrets never leave the server.** `deploy/.env` (the database password, the e-mail for the certificates), the SSH private key, the `brinelight` user's password, and the Hetzner, Vercel and Cloudflare logins: only you type them, on the server or in the provider's console.
  - Claude Code never reads, shows, asks for or commits them.
  - When something fails, you send command outputs that hold no secret: `docker compose ps`, `/health`, the last lines of `docker compose logs`. The server's logs never contain a session token.
- **No new dependency.** Everything below uses what the repository and the server already have: Node, Docker, Caddy, PostgreSQL, systemd, GitHub Actions. A paid service or a new account is a question for you (at the end), never a default.
- **No change to the rules of the game**, except in task 5 (the hours) and task 7 (only if you choose an option).
- **Protected areas stay untouched:** sign-in and sessions, payments, `comfort.ts`, `RECRUIT_ODDS`.

## What it costs

Hetzner prices since 15 June 2026, excluding VAT. They come from a price tracker (costgoat.com, updated September 2026), not from Hetzner's own page, which does not show them without an account. You check them in the Hetzner console before creating the server; `docs/decisions.md` still says "about €5", from week 4.

| Item | What | € a month (excluding VAT) |
| --- | --- | --- |
| Server | Hetzner Cloud **CX23**: 2 vCPU, 4 GB RAM, 40 GB SSD, 20 TB traffic, Germany | 5.49 |
| IPv4 address | Needed: many players have no IPv6 | 0.50 |
| Hetzner Backups | The whole server, once a day, the last 7 kept, outside the machine (20 % of the server's price) | 1.10 |
| PostgreSQL | On the same machine, in Docker: nothing more to pay. Hetzner sells no managed database. | 0 |
| HTTPS certificate | Let's Encrypt, through Caddy | 0 |
| The game itself | Cloudflare Pages, free plan | 0 |
| Down alert | GitHub Actions on a public repository (task 2); or Better Stack, free plan | 0 |
| **Total** | | **7.09**, about **€8.50 with VAT** (VAT is your country's) |
| Domain `brinelight.xyz` | Already bought at Vercel; renewed once a year (price in your Vercel account) | – |
| *Optional:* Storage Box BX11 | 1 TB elsewhere at Hetzner for the nightly dumps (question 5) | *about 3.20* |

**Why the CX23:**
- It is the cheapest machine with room for PostgreSQL, Node and Caddy together (4 GB of memory).
- Its 40 GB disk holds years of cities: a city is a JSON document of a few kilobytes.
- The CAX11 (ARM, same size) costs more since June 2026 (€5.99), and the server image would have to be built for ARM.
- Task 4 measures what it really holds before anyone plays on it.

**What costs more when players come,** in the order it would happen:

| When | What changes | € a month (excluding VAT, IPv4 and Backups included) |
| --- | --- | --- |
| Task 4 shows the CX23 busy (processor over 70 % at the busy hour) | One click in the console, a few minutes offline: **CX33** (4 vCPU, 8 GB, 80 GB). The data stays. | about 10.70 |
| Twice that | **CX43** (8 vCPU, 16 GB, 160 GB) | about 19.70 |
| The database alone fills a machine | PostgreSQL on its own CX23 or CX33, on a private Hetzner network, no IPv4 | about +7 to +10 |
| Several game servers | A Hetzner load balancer in front (weeks 9 to 13 decide how cities are shared out) | a few euros, price to check then |

The 20 TB of traffic a month is far beyond a game that sends small JSON documents.

---

## Task 1 · Buildings that change with every level (display only)

A player's feedback: "When you upgrade a building, it stays the same. It should change at every level, as in Whiteout Survival."

### What exists today

- **The buildings:**
  - Each building is one painted model (`client/public/buildings/*.glb`, made by image-to-3D in week 5), loaded once and drawn in one draw call.
  - The same model is used at every level. It only grows with three visual tiers (`client/src/city/tiers.ts`, week 6): 86 % of its size at levels 1 to 4, 93 % at 5 to 9, 100 % from 10.
  - The second tier adds a flag from the prototype's kit, and the third a crate, a barrel and a lantern.
  - All these details are one merged mesh, and the lanterns one InstancedMesh: two draw calls, whatever the city.
  - So levels 2, 3, 4, 6 to 9 and every level from 11 to 30 change nothing on screen.
- **The Lighthouse:** it grows with its level up to 1.25 times its size (`lighthouseScale`), and its lantern shines brighter with each tier.
- **An upgrade in progress:**
  - A building being upgraded gets a small scaffolding from the kit, at 75 % of its size, in a corner of its plot; a building not built yet gets a full one.
  - The Lighthouse gets nothing.
  - The time left and a bar show only in the queue at the top and in the building's sheet, not on the island.
  - The end of the work is celebrated (week 6).
- **What the client reads:** the level of each building (`state.buildings`) and the works in progress with their time left (`state.queue`). Both already come from the server: nothing new is needed.

### What it does

1. **The building site, while it is upgraded.**
   - Around the building, scaffolding made in code: four poles, two levels of planks and a ladder, sized to its model. A pile of planks and a pulley sit beside it.
   - A small crane arm swings slowly (±25°), with a crate going up and down. It stands still with reduced motion.
   - Above the building, under its name, a thin gold bar and the time left ("2 h 10"), in the building's label.
   - When the work ends, the site disappears, the new level's detail appears, and the existing celebration plays.
   - The Lighthouse gets the same site. A building not built yet shows the site, at full size.
2. **A small detail at every level.**
   - Each building has six kinds of small details of its own, picked from what it does (the lists below).
   - **The rule:** at every level that is not a transformation, the next kind in its list is added (after the sixth, the first again: a second barrel, then a third), at the next free place around or on the building.
   - The places are fixed per building: a ring of spots between the building and the edge of its plot, and spots on its roof, measured once from its model. Nothing is drawn at random, and a detail never moves once it is there.
   - Each detail is a few code-built shapes (boxes, cylinders, cones, a flat flag) in the colors of the art direction: 60 triangles at most.
3. **A transformation at levels 5, 10, 15, 20, 25 and 30.**
   - A larger piece, built the same way, changes the building's silhouette: an annex, a floor, a stone base, a tower or a mast, brass and lit windows, a crowning piece.
   - Each one is 300 triangles at most. The sizes of the three tiers stay as today (86 %, 93 %, 100 %); past level 10, a building grows taller with its pieces, not wider: nothing leaves its plot.
   - The flag, crate, barrel and lantern of today's tiers are replaced by the details of the lists.

**For the phone:**
- All the details and transformations of the eight buildings and the Lighthouse are one merged mesh (with vertex colors, one material), and everything that glows (lamps, lit windows, flames) a second one. Both are rebuilt only when a level changes.
- So it is the same two draw calls as today's tiers, whatever the levels. The building sites are one merged mesh, plus one InstancedMesh for the moving cranes and crates: two draw calls more, only while something is being built (today: one kit model per site).
- Estimate for the city, with the counter of the e2e (container, quality 2; to be measured in the task):

| Every building at level | Draw calls today | After | Triangles today | After (estimate) |
| --- | --- | --- | --- | --- |
| 1 (Lighthouse 4) | 16 | 16 | 29.3 k | about 29.5 k |
| 15 | 18 (as at level 10) | 18 | 33.3 k | about 42 k |
| 30 | 18 | 18 | 33.3 k | about 55 k |
| A building site at work | +1 or +2 (one kit model per site) | +2 for all the sites | | about +0.6 k per site |

- Each building stays under 3,000 triangles of details at level 30 (23 details of 60 at most, six transformations of 300 at most). The Galaxy S22 drew the city at 60 FPS with 86 draw calls and 66.7 k triangles (`docs/perf.md`).

### Level by level

Level 1 is the building as it is today. The **transformations** are in bold. For the other levels, the detail named is the one added at that level.

#### Lighthouse

- 1 · the building as it is today (its tower grows with its level, as today)
- 2 · a stone at the rock's foot
- 3 · a coil of rope on the pier
- 4 · a buoy moored at the pier
- **5 · TRANSFORMATION:** **the gallery**: a walkway ring around the lantern room, with its rail
- 6 · a small pennant on the gallery rail
- 7 · a lamp on the gallery
- 8 · a gull perch post
- 9 · a second stone at the rock's foot
- **10 · TRANSFORMATION:** **a second lamp ring** under the lantern, which glows warmer
- 11 · a second coil of rope on the pier
- 12 · a second buoy moored at the pier
- 13 · a second small pennant on the gallery rail
- 14 · a second lamp on the gallery
- **15 · TRANSFORMATION:** **a stone base**: the rock becomes a cut-stone plinth with steps to the pier
- 16 · a second gull perch post
- 17 · a third stone at the rock's foot
- 18 · a third coil of rope on the pier
- 19 · a third buoy moored at the pier
- **20 · TRANSFORMATION:** **taller**: one more stone section under the lantern, and two long banners down the tower
- 21 · a third small pennant on the gallery rail
- 22 · a third lamp on the gallery
- 23 · a third gull perch post
- 24 · a fourth stone at the rock's foot
- **25 · TRANSFORMATION:** **brass trims**: the lantern's roof and the rail turn brass, and a ring of lit windows
- 26 · a fourth coil of rope on the pier
- 27 · a fourth buoy moored at the pier
- 28 · a fourth small pennant on the gallery rail
- 29 · a fourth lamp on the gallery
- **30 · TRANSFORMATION:** **a golden crown** on the lantern, and its glow at its brightest

#### Refinery

- 1 · the building as it is today (at 86 % of its size)
- 2 · an oil barrel
- 3 · a length of pipe on the ground
- 4 · a valve wheel
- **5 · TRANSFORMATION:** **a second tank** beside the first, joined by a pipe
- 6 · a lit warning lamp
- 7 · a stack of two drums
- 8 · a coiled hose
- 9 · a second oil barrel
- **10 · TRANSFORMATION:** **a chimney** with a metal band
- 11 · a second length of pipe on the ground
- 12 · a second valve wheel
- 13 · a second lit warning lamp
- 14 · a second stack of two drums
- **15 · TRANSFORMATION:** **a stone floor** under the whole works, with a drain
- 16 · a second coiled hose
- 17 · a third oil barrel
- 18 · a third length of pipe on the ground
- 19 · a third valve wheel
- **20 · TRANSFORMATION:** **a tall flare tower** with a small flame at its top
- 21 · a third lit warning lamp
- 22 · a third stack of two drums
- 23 · a third coiled hose
- 24 · a fourth oil barrel
- **25 · TRANSFORMATION:** **brass pipes and lit gauges** on the tanks
- 26 · a fourth length of pipe on the ground
- 27 · a fourth valve wheel
- 28 · a fourth lit warning lamp
- 29 · a fourth stack of two drums
- **30 · TRANSFORMATION:** **a gantry** over the tanks, with lamps along it

#### Fishery

- 1 · the building as it is today (at 86 % of its size)
- 2 · a fish crate
- 3 · a net hung on a pole
- 4 · a red buoy
- **5 · TRANSFORMATION:** **a jetty** of planks out to the water side
- 6 · a coil of rope
- 7 · a drying rack of fish
- 8 · a lantern on a post
- 9 · a second fish crate
- **10 · TRANSFORMATION:** **a second roof**: an open shed for the catch
- 11 · a second net hung on a pole
- 12 · a second red buoy
- 13 · a second coil of rope
- 14 · a second drying rack of fish
- **15 · TRANSFORMATION:** **stone footings** under the posts
- 16 · a second lantern on a post
- 17 · a third fish crate
- 18 · a third net hung on a pole
- 19 · a third red buoy
- **20 · TRANSFORMATION:** **a smokehouse chimney**, and two pennants
- 21 · a third coil of rope
- 22 · a third drying rack of fish
- 23 · a third lantern on a post
- 24 · a fourth fish crate
- **25 · TRANSFORMATION:** **lit windows** and a brass bell
- 26 · a fourth net hung on a pole
- 27 · a fourth red buoy
- 28 · a fourth coil of rope
- 29 · a fourth drying rack of fish
- **30 · TRANSFORMATION:** **a lookout mast** with a flag and a lamp

#### Lumberyard

- 1 · the building as it is today (at 86 % of its size)
- 2 · a log
- 3 · a stack of planks
- 4 · a sawhorse
- **5 · TRANSFORMATION:** **a log pile** stacked in a frame
- 6 · an axe in a stump
- 7 · a pile of offcuts
- 8 · a rope pulley
- 9 · a second log
- **10 · TRANSFORMATION:** **a covered saw shed** with a sloped roof
- 11 · a second stack of planks
- 12 · a second sawhorse
- 13 · a second axe in a stump
- 14 · a second pile of offcuts
- **15 · TRANSFORMATION:** **stone footings** and a plank floor
- 16 · a second rope pulley
- 17 · a third log
- 18 · a third stack of planks
- 19 · a third sawhorse
- **20 · TRANSFORMATION:** **a crane arm** for the logs, with its hook
- 21 · a third axe in a stump
- 22 · a third pile of offcuts
- 23 · a third rope pulley
- 24 · a fourth log
- **25 · TRANSFORMATION:** **a water wheel** at the side, with brass hubs
- 26 · a fourth stack of planks
- 27 · a fourth sawhorse
- 28 · a fourth axe in a stump
- 29 · a fourth pile of offcuts
- **30 · TRANSFORMATION:** **a second storey** to the shed, with a flag and lamps

#### Shelters

- 1 · the building as it is today (at 86 % of its size)
- 2 · a lit window
- 3 · a flower pot
- 4 · a bench
- **5 · TRANSFORMATION:** **a second hut** beside the first
- 6 · a washing line
- 7 · a door lantern
- 8 · a water barrel
- 9 · a second lit window
- **10 · TRANSFORMATION:** **an upper floor** with a small balcony
- 11 · a second flower pot
- 12 · a second bench
- 13 · a second washing line
- 14 · a second door lantern
- **15 · TRANSFORMATION:** **stone walls** at the base
- 16 · a second water barrel
- 17 · a third lit window
- 18 · a third flower pot
- 19 · a third bench
- **20 · TRANSFORMATION:** **a bell tower** with a pennant
- 21 · a third washing line
- 22 · a third door lantern
- 23 · a third water barrel
- 24 · a fourth lit window
- **25 · TRANSFORMATION:** **lit windows all round** and brass door bands
- 26 · a fourth flower pot
- 27 · a fourth bench
- 28 · a fourth washing line
- 29 · a fourth door lantern
- **30 · TRANSFORMATION:** **a third hut and a lit square** between them

#### Barracks

- 1 · the building as it is today (at 86 % of its size)
- 2 · a weapon rack
- 3 · a training target
- 4 · a round shield
- **5 · TRANSFORMATION:** **a palisade** segment on one side
- 6 · a sandbag
- 7 · a torch
- 8 · a banner pole
- 9 · a second weapon rack
- **10 · TRANSFORMATION:** **a watch platform** on posts
- 11 · a second training target
- 12 · a second round shield
- 13 · a second sandbag
- 14 · a second torch
- **15 · TRANSFORMATION:** **stone walls** at the base
- 16 · a second banner pole
- 17 · a third weapon rack
- 18 · a third training target
- 19 · a third round shield
- **20 · TRANSFORMATION:** **a tower** with two flags
- 21 · a third sandbag
- 22 · a third torch
- 23 · a third banner pole
- 24 · a fourth weapon rack
- **25 · TRANSFORMATION:** **brass shields** on the walls and lit torches
- 26 · a fourth training target
- 27 · a fourth round shield
- 28 · a fourth sandbag
- 29 · a fourth torch
- **30 · TRANSFORMATION:** **a gate arch** with a great banner and lamps

#### Harbor

- 1 · the building as it is today (at 86 % of its size)
- 2 · a bollard
- 3 · a cargo crate
- 4 · a coil of rope
- **5 · TRANSFORMATION:** **a longer pier**, one section more
- 6 · a pair of oars
- 7 · a buoy
- 8 · an anchor
- 9 · a second bollard
- **10 · TRANSFORMATION:** **a cargo crane**
- 11 · a second cargo crate
- 12 · a second coil of rope
- 13 · a second pair of oars
- 14 · a second buoy
- **15 · TRANSFORMATION:** **a stone quay** instead of planks
- 16 · a second anchor
- 17 · a third bollard
- 18 · a third cargo crate
- 19 · a third coil of rope
- **20 · TRANSFORMATION:** **a harbor mast** with signal flags
- 21 · a third pair of oars
- 22 · a third buoy
- 23 · a third anchor
- 24 · a fourth bollard
- **25 · TRANSFORMATION:** **brass lamps** along the quay
- 26 · a fourth cargo crate
- 27 · a fourth coil of rope
- 28 · a fourth pair of oars
- 29 · a fourth buoy
- **30 · TRANSFORMATION:** **a harbor light** at the pier's end, lit

#### Observatory

- 1 · the building as it is today (at 86 % of its size)
- 2 · a brass lens on a stand
- 3 · a star pennant
- 4 · a chart table
- **5 · TRANSFORMATION:** **a dome ring**: a metal band around the dome
- 6 · a candle lantern
- 7 · a crystal
- 8 · a coil of rope
- 9 · a second brass lens on a stand
- **10 · TRANSFORMATION:** **a long telescope** out of the dome
- 11 · a second star pennant
- 12 · a second chart table
- 13 · a second candle lantern
- 14 · a second crystal
- **15 · TRANSFORMATION:** **a stone stair** up to the door
- 16 · a second coil of rope
- 17 · a third brass lens on a stand
- 18 · a third star pennant
- 19 · a third chart table
- **20 · TRANSFORMATION:** **a weather vane** and two pennants on the dome
- 21 · a third candle lantern
- 22 · a third crystal
- 23 · a third coil of rope
- 24 · a fourth brass lens on a stand
- **25 · TRANSFORMATION:** **brass dome ribs** and lit windows
- 26 · a fourth star pennant
- 27 · a fourth chart table
- 28 · a fourth candle lantern
- 29 · a fourth crystal
- **30 · TRANSFORMATION:** **a second, smaller dome** with its own telescope and a lamp

#### Infirmary

- 1 · the building as it is today (at 86 % of its size)
- 2 · an herb planter
- 3 · a water barrel
- 4 · a cot under an awning
- **5 · TRANSFORMATION:** **an awning** over the door
- 6 · a white flag with a green leaf
- 7 · a lantern
- 8 · a line of linen
- 9 · a second herb planter
- **10 · TRANSFORMATION:** **a side wing**
- 11 · a second water barrel
- 12 · a second cot under an awning
- 13 · a second white flag with a green leaf
- 14 · a second lantern
- **15 · TRANSFORMATION:** **stone walls** at the base
- 16 · a second line of linen
- 17 · a third herb planter
- 18 · a third water barrel
- 19 · a third cot under an awning
- **20 · TRANSFORMATION:** **a small tower** with a green-leaf flag
- 21 · a third white flag with a green leaf
- 22 · a third lantern
- 23 · a third line of linen
- 24 · a fourth herb planter
- **25 · TRANSFORMATION:** **lit windows** and brass door handles
- 26 · a fourth water barrel
- 27 · a fourth cot under an awning
- 28 · a fourth white flag with a green leaf
- 29 · a fourth lantern
- **30 · TRANSFORMATION:** **a glass greenhouse** at the side, lit from inside


### What it does not do

- No change to the rules, the balance, the server, or what the client sends.
- No new model, no paid asset, no Higgsfield credit, no new dependency: everything is three.js shapes in code.
- The rafts' buildings and the Lighthouses at sea stay as they are.
- No sound beyond today's celebration.

### How it is tested

- **The rule is a pure function**, `detailsAt(building, level)`, in `client/src/city/growth.ts`, tested without a browser:
  - for each building and each level from 1 to 30, the details are those of the lists above;
  - a level's details are the previous level's plus one (or plus its transformation): nothing moves or disappears;
  - nothing reaches out of the plot (`PLOT_ROOM`, with the test of week 6 against the neighbor plots and the raft slots);
  - at most 3,000 triangles per building at level 30;
  - two meshes for all the details whatever the city, and two more while building.
- **The e2e "building tiers"** captures the city with every building at level 1, 5, 10, 15, 20, 25 and 30, and one building site, at 412 and 360 px. It records the draw calls and triangles of each into `docs/perf.md`. Then you check the entry-level phone and the S22 with `?fps`.
- **The look references:**
  - None of the 52 should move: they all hide the 3D view and the labels.
  - The new captures (7 levels and the building site, at 412 and 360: 16 images) are 3D drawings. The CI's processors may draw them a little differently, as they do the captains' rows (question 2).
  - When the task is coded, you see the new captures, and any capture that moved, before any reference is made again.
- `docs/art-direction.md` (the tiers become levels and transformations) and a line in `docs/decisions.md`.

## Task 2 · Ready to rent (code, before the server exists)

What it does:

- **`/health` tells the truth.**
  - Today it answers `{"ok":true}` even when the database is down.
  - It will run a one-line query (`select 1`, with a 2-second limit) and answer `{"ok":false,"database":"down"}` with the status 503 when it fails.
  - It also says whether the last nightly backup is less than 26 hours old: `backup.sh` writes the time of its last success in a small file, which the game server reads through a read-only folder. Only a date, never the dump. A late backup gives `"backup":"late"` and `"ok":false`.
  - A single check then catches the three failures: the server down, the database down, the backups stopped.
- **A restore tested every week, on its own.**
  - A second systemd timer runs `restore.sh test` every Sunday at 04:30 UTC: the latest dump goes into a temporary database and is compared with the live one, as you do by hand today.
  - A failure makes the next `/health` say `"restore":"failed"` and `"ok":false`, so the down alert warns you.
- **The down alert, free and with no new account:**
  - A GitHub Actions workflow (`.github/workflows/watch.yml`) calls `https://api.brinelight.xyz/health` every 10 minutes and fails when the answer is not `"ok":true`. GitHub e-mails you when a scheduled run fails.
  - It is turned off while `api.brinelight.xyz` does not exist: it starts when you set the repository variable `API_URL` (task 3).
  - The limit: GitHub can delay a scheduled run by several minutes at busy times. Better Stack's free plan checks every 3 minutes, with a new account (question 6).
- **`docs/deploy.md` brought up to date:**
  - today's prices;
  - the new `/health`;
  - the weekly restore;
  - the alert, in place of UptimeRobot, whose free plan is for non-commercial use only since late 2024 (Brinelight will sell cosmetics);
  - how to go back to the previous version after an update (the backup that `update.sh` makes first, and the commit to return to).

What it does not do:
- It does not rent anything.
- It does not deploy from the CI.
- It does not copy the backups off the machine (question 5).
- It does not touch sign-in, sessions or the rules of the game.

How it is tested:
- Server tests:
  - `/health` with the database up;
  - the database stopped (PGlite closed);
  - a backup 25 hours old, then 27 hours old;
  - a failed restore.
- The CI's `deploy` job, which already starts the whole stack:
  1. a backup;
  2. `/health` says `"backup":"ok"`;
  3. the database stopped, `/health` says 503;
  4. the weekly restore unit started by hand, which must succeed.
- `shellcheck` on the scripts.
- The watch workflow is run once by hand on a fake address and must fail.

## Task 3 · Online (you, step by step; Claude Code guides and checks)

Nothing to code. Each step is in `docs/deploy.md`, with what you should see. At the end of each step, send the output it asks for: never a password, a key or the content of `.env`.

1. **Create the Hetzner account** at accounts.hetzner.com.
   - Hetzner may ask you to prove who you are (an ID or a payment): it is normal for a new account.
   - Turn on two-factor sign-in in the account settings.
2. **Pay:**
   - add a card or PayPal in **Billing**;
   - Hetzner bills by the hour, capped at the monthly price, and sends one invoice a month.
   - Create a **project** named `Brinelight` in the Cloud console.
3. **Create your SSH key** on your computer (`docs/deploy.md`, step 1). The private key never leaves your computer.
4. **Create the server** (step 3):
   - CX23, Ubuntu 24.04, Nuremberg or Falkenstein;
   - your public SSH key;
   - **Backups ticked**.
   - Send the server's IPv4 (it is not a secret).
5. **Point `api` to the server** at Vercel (step 4), then check with dnschecker.org.
6. **Prepare the server** (step 5):
   - `setup-server.sh`, then close SSH to your key only with `harden-ssh.sh`;
   - you choose the `brinelight` password and keep it in your password manager.
7. **Fill in the settings** (step 6):
   - on the server, `openssl rand -hex 32` makes the database password, and you paste it into `deploy/.env` with `nano`;
   - nobody else sees it, Claude Code included.
8. **Start** (step 7). Send the output of `docker compose ps`, and what `https://api.brinelight.xyz/health` shows.
9. **Backups** (step 8):
   - `sudo ./install-backup.sh`, which now installs the weekly restore too;
   - one backup by hand, then `sudo ./restore.sh test`. Send its last three lines.
10. **The game on `play.brinelight.xyz`** (step 9):
    - Cloudflare Pages first, then the `CNAME` at Vercel;
    - then `VITE_API_URL` for Production only.
11. **The alert:**
    - in GitHub, the repository → **Settings → Secrets and variables → Actions → Variables**: `API_URL` = `https://api.brinelight.xyz` (a variable, not a secret: the address is public);
    - test it: `docker compose stop server`, wait for GitHub's e-mail, then `docker compose start server`.
12. **The test of the week** (step 10): the same city on your phone in Phantom and on your computer.

What it does not do: no player is invited yet (task 4 comes first); no deploy key in GitHub.

How it is tested: the checklist above. Each step has its expected output, and Claude Code compares what you send with it.

## Task 4 · How many players one CX23 holds (the load test)

What it does:

- **A script, `tools/load/`, in Node with no new dependency.**
  - It plays N simulated players against a server.
  - Each one signs in with its own throwaway Ed25519 key, made with Node's `crypto`, as the e2e's test wallet does.
  - Each one then sends actions at a human rhythm: an upgrade, a fleet, a claim every 20 to 60 seconds, and a `GET /city` at each "launch".
  - It reports:
    - the answers per second;
    - the slowest 1 % (p99);
    - the refusals and errors;
    - the processor and memory of the machine (read with `docker stats` on the server).
- **Run on the real server, before it opens:**
  - 100, then 250, then 500 players for 10 minutes each;
  - then the database is put back as it was before the test with `restore.sh replace` and the backup made just before;
  - the result goes into `docs/perf.md`, with the threshold at which to move to the CX33.

What it does not do:
- No test against Cloudflare.
- No test of Solana.
- No change to the server's limits, unless a measure shows one refuses real play (then a question for you).
- The script never runs in the CI against the real server.

How it is tested:
- The script itself runs in the CI against the local stack with 20 players for 30 seconds: no error, no refusal other than the rules'.
- Its accounts are made only with keys it creates and forgets.

## Task 5 · The Mist and the Leviathan by server, not fixed UTC hours

Today the Mist comes at 04:00, 12:00 and 20:00 UTC, the Leviathan rises at 13:00 and 19:00 UTC, and the day resets at 00:00 UTC. These hours were provisional (`docs/decisions.md`).

What it does:

- **A list of servers in the rules** (`shared/src/rules/servers.ts`).
  - Each server has a name, its Mist hours, its Leviathan hours and its daily reset hour.
  - Today there is one: `s1`, with your hours (question 9).
  - The calendar is in the rules, not in a `.env`, because the client reads the same calendar to draw the countdowns.
- **The city knows its server** (`server: "s1"`).
  - City shape 10, with its migration: the cities stored before get `s1`, and `s1` keeps today's hours unless you choose others.
  - `mistAt`, `huntAt` and the daily reset read the city's server.
  - The server sets it when the city is made; the client never sends it.
- **What changes if `s1`'s hours change:**
  - A Mist or a hunt going on is never cut short: the change applies from the next one.
  - The day of the Daily Tasks changes at the next reset.

What it does not do:
- No choice of server by the player.
- No second server.
- No moving a city between servers.
- No time zone shown to the player: the countdowns already say "in 52 min".

How it is tested:
- Rules tests: two servers with different hours give their own Mists and hunts.
- `advance` in one long step equals many short ones.
- The migration test from shape 9.
- A server test: a client that sends `server` is refused.
- The e2e Mist and Leviathan scenarios still pass.

## Task 6 · The CI's actions on Node 24

`actions/checkout@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v4` run on Node 20. GitHub warns on every run, and already forces them onto Node 24.

What it does:

- Each action moves to the first major version that runs on Node 24, read in its own release notes. To be checked when the task is done:
  - `checkout@v5`;
  - `upload-artifact@v6`, because its v5 still ran on Node 20 by default;
  - `setup-node`: the first version whose release notes say Node 24.
- Each version is pinned to its full commit (the 40-character SHA), with the version as a comment, if you choose it (question 8).
- One line in `docs/decisions.md`, and the open question about Node 20 removed.

What it does not do:
- It does not change the Node of the game (22) or of the server image.
- It does not change what the jobs run.

How it is tested:
- The CI is green on the four jobs.
- The e2e artifact is still uploaded with its hidden folder `e2e/.shots/`.
- No line "Node.js 20 is deprecated" left in the logs.

## Task 7 · The other buildings and the storage (measure, then you choose)

The other buildings keep ×1.6 a level, while the storage follows the Lighthouse. Even at Lighthouse 30 with Sealed Warehouses 3, the Barracks, Harbor or Observatory cost more than the storage holds from level 21, the Fishery and Lumberyard from 23 (`docs/decisions.md`, open question of week 6). The players of the simulation are at level 14 to 18 after a year: no one meets it yet.

What it does:

- Measure three options on temporary copies of the rules, with the simulation over two years. Nothing is applied before your choice.
  - **A. The other buildings follow the Lighthouse's curve past level 15:** ×1.3 in cost and ×1.2 in time a level.
  - **B. The cost of a level never passes 80 % of the storage at that Lighthouse level:** the curve flattens only where it would block.
  - **C. Nothing changes;** the buildings stop at level 20 for now, with levels added later.
- For each option:
  - the level of each building after one and two years;
  - the Lighthouse's milestones, which must stay within 10 % of week 6 (the test of week 7);
  - the wood and time a player spends on the other buildings.
- Then the chosen option, applied as a balance change: the tests, `npm run balance`, and its line in `docs/decisions.md`. It comes with a test that every building's next level fits in the storage at every level it can reach.

What it does not do: no change to the Lighthouse, the storage or the research.

How it is tested: the measures in a table, before anything is applied. Once you have chosen, the new test, the test of the milestones, and `npm run check`.

---

## Not this week

- Deploying from the CI (question 4).
- A second region, or a test server.
- Multiplayer (weeks 9 to 13).
- The first proof on Solana, planned for week 8 in the roadmap of 17 October (question 10).
- Payments.
- The daily recruitment (week 15).

## Questions for you

1. **The buildings' lists (task 1):** do the details and transformations suit you, building by building? One line to change is enough to change the rule.
2. **The 3D captures of task 1:** compared at zero pixels like the others, if three CI runs on different processors draw them identically (I would check first)? Or compared with a small tolerance, or only shown in the CI's artifact for you to look at?
3. **The machine:** the CX23 in Germany (€7.09 a month with IPv4 and Backups, excluding VAT), after checking the price in the Hetzner console. Or do you prefer to start with the CX33 (about €10.70)?
4. **Deploying:**
   - by hand for now: one command on the server, `~/brinelight/deploy/update.sh`, after each merge of a week's pull request;
   - or from the CI, which needs an SSH key for GitHub stored in GitHub's secrets, and a server that accepts it. I propose by hand until players are there.
5. **The backups off the machine:** the nightly dumps live on the server, and Hetzner Backups copy the whole server every day, outside it. Is that enough for now, or do you want a Storage Box BX11 (about €3.20 a month, to confirm) that receives a copy of each night's dump?
6. **The alert:** GitHub Actions every 10 minutes (free, no new account, sometimes late), or Better Stack's free plan (every 3 minutes, an account to create; its terms to check for a game that sells something)?
7. **The load test:** on the real server before it opens, with the database put back afterwards (my proposal)? Or on a second CX23 rented for one hour (a few cents, then deleted)?
8. **The CI's actions:** pinned to their full commit (safer: a tag can be moved), or to their major version (simpler to read)?
9. **The hours of server `s1`:** keep today's (Mist 04:00, 12:00, 20:00; Leviathan 13:00, 19:00; reset 00:00 UTC), or choose them for your players' evenings (for example, in Paris time: Leviathan at 12:30 and 20:30, reset at 05:00)?
10. **The first Solana proof**, planned for week 8 in the roadmap: leave it for week 9, since putting the server online is the heart of this week?
11. **The other buildings:** the three options are measured first. Is there one you want to rule out before measuring?
