# Brinelight: Hold the Light · on CrazyGames

Everything the developer portal (developer.crazygames.com) asks at submission, ready to paste, and what to upload. Written on 24 November 2026 from CrazyGames' requirement pages read that day (`docs/design/hold-the-light-progress.md`, task 7.1).

## The game

- **Name:** Brinelight: Hold the Light (check it is free when you type it in the portal).
- **Short description (one line):** Hold the Lighthouse through the Night: turn its beam on the boats and beasts of the Mist, then grow your island by day.
- **Description:**

  The Mist has fallen on a drowned world, and only your Lighthouse holds it back.

  Each Night, raiders, beasts and wraiths come at your island from every side. Turn the Lighthouse's beam onto them and burn them before they land: every boat that reaches the coast steals oil, and when the oil runs out, the light goes dark.

  Put troops on your rafts: crossbowmen, harpooners and boarders each beat one kind of enemy. After each wave, choose one card of three to bend the Night your way. Call on your captain's power when the sea turns against you, and face the Mist Galleon, the Kraken and the Leviathan.

  At dawn, bring back what you burned and grow your city: a stronger Lighthouse, more oil, more rafts, new cards and new captains. Thirty Nights across the sea chart, then the Endless Night and your record.

- **Controls:**
  - Mouse or finger: point at the sea to turn the beam.
  - ← → or A D (Q D on AZERTY): turn the beam.
  - 1, 2, 3: choose a card between waves.
  - Space or F: your captain's power.
  - M: sounds on or off.
  - Tap ＋ on a raft to put troops there.
- **Category / tags:** Strategy, Tower Defense, Defense, Upgrade, Mouse, Mobile. (Pick from the portal's own list.)
- **Orientation:** both (landscape on desktop; portrait and landscape on phones).
- **Languages:** English.
- **Multiplayer:** no.
- **Progress save:** on the device (localStorage, under `brinelight-portal-v1/`). Without the CrazyGames SDK in Basic Launch: answer that the Data Module is not used.
- **Ads, purchases, accounts, outside links:** none.
- **Age:** PEGI 12 compliant: stylized creatures and boats burned by light, no blood, no real-world violence.

## The files to upload

- **The game:** `npm run pack:portal` builds the portal and writes `brinelight-hold-the-light.zip` at the root of the repository (not committed): the contents of `client/dist-portal/`, `index.html` at the zip's root. 17 MB, 293 files; under 20 MB for the mobile home page.
- **Covers** (in this folder): `cover-landscape-1920x1080.png`, `cover-portrait-800x1200.png`, `cover-square-800x800.png`. Captured from the game, the title the only text, as CrazyGames asks. A first draft: the landscape one leaves a lot of empty sea, and the title touches the island; a designer's cover would help the click rate CrazyGames now measures in Basic Launch.
- **Preview videos (to record on your computer):** the container that built the game has no graphics card and draws about 6 frames a second: too few for a video.
  1. Open the branch preview's `/portal/` in Chrome, in a window of exactly 1920 × 1080 (landscape) and then 1080 × 1620 (portrait), with a city at Night 4 or later (play to it, or ask for a seeded city).
  2. Record 15 to 20 s with OBS or the system's recorder, **no sound, no mouse cursor** (OBS: untick "capture cursor"), starting on a still image of the cover's view, the beam burning boats, a card chosen, a boss if you can.
  3. No black frames, no bars, no text but what the game shows, no speeding up. Under 50 MB each, 1080p.

## Before you press Submit

- [ ] The ElevenLabs account's plan allows commercial use of the sounds and music (`docs/decisions.md`, task 6.3); if not, they are made again or replaced.
- [ ] On the S22, `?fps` during a busy late wave (task 6.6).
- [ ] Played in CrazyGames' preview tool (from the developer portal) on a computer and a phone: the game opens in Night 1, the sounds start at the first tap, nothing asks for a wallet or an account.
- [ ] Safari on a Mac or an iPhone, and a 4 GB Chromebook if you can: CrazyGames turns a game off on a browser it runs badly in.
