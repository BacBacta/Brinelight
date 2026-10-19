# Art direction

The validated art direction of Brinelight. Every asset follows this page, or it does not go in.

## Promise

**"Keep the light on."** A drowned world, warm and inhabited. The danger is the Mist, not war.

- Tone in three words: **Ghibli, tide, lantern.**
- The test for any asset: *would survivors have built this from what the sea washes up?*

## Palette

| Role | Colors | Used for |
| --- | --- | --- |
| Navy | `#0C1F3A` / `#163A63` | Night, depth, frames |
| Warm gold | `#FFC83A` / `#E09A12` | The Lighthouse's light, buttons, levels |
| Cream | `#FFF4DA` | Canvas, paper, dry sand |
| Turquoise | `#1FB5C4` | Shallow water, foam |
| Driftwood | `#8C6B4A` / `#C9A77A` | All buildings, piers, rafts |
| Verdigris copper | `#5E9E8C` | Metal details, the Lighthouse's and the Observatory's roofs |
| Brick red | `#E2572F` | Pirates, refusals, the Mist striking |
| Mist | `#8A6CFF` → `#B9B3D6` | The Mist |
| Meadow | `#7FA36B` / `#5E8A4F` | The island, moss |

- Never more than three of these colors on one building.
- No neon lawn: a muted meadow green (#7FA36B, #5E8A4F), moss on dark rock, dune grass, sand, and a few windswept pines.

## Light

Three states, with a fade between them.

- **Calm day.** A cream-to-turquoise sky and a warm, low sun with long, soft shadows. The sea is turquoise near the island and navy far away. The Lighthouse is off.
- **Mist.** A uniform grey-violet sky, with no shadows. Fog eats the sea from 20 m away, and the water turns leaden. The Lighthouse is on, its gold beam sweeping: it is the only warm point.
- **Lighthouse night.** Deep navy with stars, and a cold blue light everywhere except around the Lighthouse. A gold trail of reflection runs on black water, and the windows glow cream.

## Buildings

- Each building is recognizable by its silhouette alone, at thumbnail size.
- Three visual tiers (levels 1 to 4, 5 to 9, 10 and up): each tier grows and adds one element (week 6: a flag at the second tier; crates, a barrel and a lantern at the third). The Lighthouse grows with its level, and its lantern shines brighter with each tier.
- All stand on stilts or a rock plinth, never on grass.
- A flag or a lantern on each building.
- Up to 2 500 triangles per building, with flat colors per face.

| Building | Silhouette |
| --- | --- |
| Lighthouse | White conical tower with red bands, verdigris copper lantern |
| Refinery | Round hooped vat, short copper chimney |
| Fishery | Open hut on stilts, drying nets, upturned boat |
| Lumberyard | Lean-to, bleached driftwood logs, circular saw |
| Shelters | Cluster of huts and patched tents, washing line |
| Barracks | Low palisade, training dummy, navy banner |
| Harbor | L-shaped pier, bollards, boat, crane |
| Observatory | Round turret, verdigris dome, telescope |
| Infirmary | Low building, white cross on a cream canvas roof, awning with cots |

## Rafts

- A floating village: hexagonal decks on the grid, water between them, walkways toward the island. Three painted decks (sail, nets, planters) and a damaged one, as briefed in `docs/raft-models.md`.

## Captains

- Painted bust portraits, in three-quarter view.
- A plain background by rarity: copper for an officer, silver-blue for a commander, gold for an admiral.
- Warm lantern light from below.
- Stylized features that stay readable in a 48 px circle.
- One consistent series.

| Captain | Rarity, role | Portrait |
| --- | --- | --- |
| Tom | Officer, gathering | Sturdy, in his fifties, salt-and-pepper beard, yellow oilskin, rope and floats, a seagull |
| Sel | Officer, speed | Young, head-scarf, spyglass, chart; looks at the horizon |
| Bran | Commander, boarders | Broad, ginger beard, straps, grappling hook |
| Isa | Commander, harpooners | Slim, braid, wave tattoos, tall harpoon |
| Mira | Admiral, crossbowmen | Eye patch, amber eye, copper crossbow, navy cape |
| Nera | Admiral, defense in the Mist | Grey hood, glowing lantern, mist around her; the only one who looks at the player |

## Sea

- A depth gradient, foam at the stilts, slow waves.
- Wrecks are hulls and masts, not buildings.
- Pirate camps are rafts around a black barge with a brick-red banner.
- The Mist is a wall advancing from the horizon.

## Interface

Keep:
- the navy, gold and cream palette;
- Lilita One and Nunito;
- rounded cards with thick borders;
- short text in the second person;
- the reason for a refusal, always shown.

Add:
- one consistent set of flat, two-tone icons;
- the number that decides, on every upgrade sheet ("+12 wood/h");
- a celebration at the end of works: floating gold text and a short sound, full screen for the Lighthouse;
- ten short sounds in one family (wood and rope, not metal);
- fewer 3D labels;
- one motion at a time.

## Brinelight is not

- Generic medieval fantasy.
- Grim post-apocalypse.
- Pixel art.
- Photo-realism.
- Visual chaos.
- Anything recognizable from another game or film.

## Generated assets

Generated from this page (GPT Image and Meshy, through Higgsfield):

- on 2026-10-16: the six captain portraits, in `assets/captains/`;
- on 2026-10-16: the nine building concepts and meshes, in `assets/concepts/` and `assets/buildings/src/`;
- on 2026-10-16: seven objects, the raft, the wreck, the pirate camp, your boat, and the three buildings on rafts (Kelp Greenhouse, Smokehouse, Watchtower). Their concepts are in `assets/concepts/` and their meshes in `assets/models/src/`;
- on 2026-10-16: the icon sheet (24 icons, flat two-tone: a palette color with a night-blue outline), in `assets/icons/sheet.png`;
- on 2026-10-17: the island, a green meadow on dark rock with moss, dune grass, a sandy corner and a windswept pine, in `assets/concepts/island.png` and `assets/models/src/island.glb`. The model had two pines inside the plots; `assets/make-models.py` moves the smaller one to the rim, at the pier's gap (the only place clear of every plot and raft slot), and drops the other. It follows "No neon lawn". It replaces a first, sandy island, which looked too barren for an inhabited place.

## Made in Blender (week 8)

From 19 October the city is remade with Blender 5.2.2 run from Python (`assets/blender/`), with no window: a kit of parts in this page's palette (`kit.py`), joined into one mesh per model, its colors and soft shadows baked into one texture. With the style pass:
- each piece gets a shade of its own;
- wood and stone get a grain;
- edges catch the light;
- tops are lighter and feet darker;
- two shadows lean to blue.

- **The island**: the 19 plots' hexagons edge to edge, widened by 0.1 past the plots, so its coast follows the grid. The rafts of ring 3 float in its notches. Its cliff never comes out past the meadow above the water.
- **A building**: seven models (tiers at 1, 10, 20 and 30; transformations at 5, 15 and 25), and a detail at every other level, at the front, on the walls the camera sees, or on a roof.
  - Its tiers' materials: wood, a stone plinth at 10, brass at 20, verdigris roofs at 30.
  - Its flag in its tier's color: cream, navy, verdigris, gold. Brick red stays the pirates'.
  - It always stays under the top of the Lighthouse and inside its plot (tested at every level).
- **The building site**: a scaffolding stretched to the building, and a crane whose arm swings and whose crate goes up and down.

`assets/blender/build.py` makes them; `assets/blender/serve.py` serves them like `make-models.py` does.

`assets/make-models.py` and `assets/icons/make-icons.py` make the files the game serves.

Every asset must follow this page, or it does not go in.
