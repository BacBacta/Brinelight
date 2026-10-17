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
- Three visual tiers (levels 1 to 3, 4 to 7, 8 and up): each tier grows and adds one element.
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
- on 2026-10-17: the island, a green meadow on dark rock with moss, dune grass, a sandy corner and a windswept pine, in `assets/concepts/island.png` and `assets/models/src/island.glb` (the model's second pine is removed by `assets/make-models.py`: it stood where rafts moor). It follows "No neon lawn". It replaces a first, sandy island, which looked too barren for an inhabited place.

`assets/make-models.py` and `assets/icons/make-icons.py` make the files the game serves.

Every asset must follow this page, or it does not go in.
