# The raft models: the brief

The floating village (owner's choice, 19 October): the rafts become painted models, made like the island and the buildings of week 5. The owner generates them; the code is ready for them (`client/src/city/rafts.ts`). This page says how the existing models were made, then what the raft models must be.

## How the island and the buildings were made

- **Pipeline:**
  1. A concept image from `docs/art-direction.md` (GPT Image, through Higgsfield), kept in `assets/concepts/<name>.png`.
  2. Image to 3D with Meshy (through Higgsfield): one mesh, one material, one 2048 px JPEG texture. The original stays in `assets/buildings/src/` or `assets/models/src/` (3 to 4 MB each), out of the client build.
  3. `python3 assets/make-models.py` makes the served file in `client/public/buildings/` or `client/public/models/`: the texture as a 512 px WebP (1,024 for the island), quality 82, and the geometry quantized (positions on 16 bits, normals on 8, texture coordinates on 16, welded vertices, 16-bit indices).
- **What is served today:**

| Model | Triangles | File | Texture |
| --- | --- | --- | --- |
| The nine buildings | 2,257 to 2,511 each | 135 to 165 kB | 512 px WebP, 41 to 65 kB |
| The island | 2,517 | 222 kB | 1,024 px WebP, 151 kB |
| The raft (today) | 1,384 | 100 kB | 512 px WebP, 47 kB |
| The three buildings on rafts | 2,309 to 2,498 | 145 to 160 kB | 512 px WebP |

- **The style** (`docs/art-direction.md`): "Ghibli, tide, lantern"; *would survivors have built this from what the sea washes up?* Driftwood (`#8C6B4A` / `#C9A77A`) for every pier and raft, never more than three palette colors on one model, no neon, no brick red (it belongs to the pirates), no text, no generic medieval fantasy.

## What the code already does (with today's raft until the new ones come)

- Each raft stands on its slot of the hex grid, never turned: no raft overlaps another.
- Its room is the slot's hexagon shrunk to 82 % (`RAFT_FILL`): the code scales any model to touch that hexagon and never pass it. Two rafts side by side have 0.36 of water between them (a slot is 2 wide).
- The model of each slot is chosen by a fixed rule, `(q − r) mod 3`: two rafts side by side never show the same model. One InstancedMesh per model: three models cost three draw calls, whatever the number of rafts.
- Walkways: one per raft, toward the island (a raft of ring 3 to the shore, a raft of ring 4 to a raft of ring 3 beside it). One InstancedMesh for all of them; today a plank bridge built in code.
- A damaged raft (under 60 sturdiness) is drawn darker today; the shipyard shows its scaffolding on the slot it works on.

## What to make

### How many

| File | What | Why |
| --- | --- | --- |
| `raft-a.glb` | Deck with a short mast and a furled cream sail at its back | Variant A |
| `raft-b.glb` | Deck with drying fishing nets on two poles at its back, and a crate | Variant B |
| `raft-c.glb` | Deck with planters (kelp, herbs) and two lanterns at its back | Variant C |
| `raft-damaged.glb` | Variant-neutral deck: broken planks standing up, a dark hole in the front edge, one float gone so it lists a little | Recommended. A darker tint does not read at the city's distance; a model of its own does. One is enough for the three variants. |
| `walkway.glb` | A short plank bridge | Optional: the code-built one works; a painted one matches the rafts. |

### Shape, size and orientation (the same for the four rafts)

- **A regular hexagon seen from above**, filling its footprint: nothing sticks out past the hexagon (masts, nets and sails stay inside it from above). The code scales the model so that its hexagon fits the room: the absolute size in the file does not matter, the proportions do.
- **Orientation in the file:** two flat sides facing left and right (±X), and a corner facing the camera (+Z) and one facing away (−Z): the hexagons of the city's grid. Up is +Y.
- **Heights, as a share of the hexagon's flat-to-flat width W:**
  - the bottom of the floats at y = 0;
  - the deck's top at about 0.3 W (the floats half under the water line, which sits at about 0.12 W); the code measures the deck at the model's middle and stands the building there;
  - nothing taller than 0.9 W (a mast), so a raft never looks bigger than a building of the island.
- **The middle stays free:** a building stands on the deck's center (it takes up to 67 % of W). Masts, nets, planters and lanterns go along the back edges (−Z side), which also keeps the front, where the camera looks, clear.
- **The middles of the six sides stay free of rails:** that is where the walkways land (they reach 7 % of W onto the deck).
- **The damaged raft:** its damage is on its front corner (+Z), the side the camera sees, so nothing standing on it hides the mark.

### Budget

- **At most 1,000 triangles per raft model.** 39 rafts then cost at most 39 k triangles (today's raft costs 1,384, so 54 k for 39). The city at its most stays near what the S22 drew at 60 FPS (66.7 k triangles, `docs/perf.md`), with the island, the buildings and the buildings on rafts.
- **The walkway: at most 150 triangles.** It is stretched along its length (from 0.05 to 0.4 of W): planks laid across it, rope rails, posts only at its two ends, so it can stretch without looking wrong.
- One mesh, one material, one texture (Meshy's 2048 px JPEG; `make-models.py` serves it at 512 px).

### Look

- Driftwood planks of mixed widths, lashed with rope, on barrel floats; the accents in at most two palette colors (verdigris copper, cream canvas, gold lantern light). Weathered, inhabited, warm.
- The three variants clearly different from above at a glance (sail, nets, green planters), with the same deck, the same floats and the same wood, so they read as one village.
- Prompt to start from, the same for the three, only the last part changing: *"A single hexagonal floating platform for a cozy drowned-world city builder, seen from a 3/4 top view, weathered driftwood planks lashed with rope on barrel floats, flat sides left and right, a free square of deck in the middle; at its back edge: [a short mast with a furled cream sail / drying fishing nets on two poles and a crate / wooden planters with kelp and two hanging lanterns]. Ghibli-like, warm afternoon light, muted palette, plain background, no text."*

### Once made

1. Put the concepts in `assets/concepts/`, the Meshy originals in `assets/models/src/`.
2. Add the names to `OTHERS` in `assets/make-models.py`, run it, and add them to `MODEL_IDS` (`client/src/scene/models.ts`).
3. The city takes the three variants (and the damaged one, the walkway) in place of today's raft. The tests check each one: one mesh, at most its triangles, it fits its room, and its middle is free for a building.

## The island's coast (for later)

The island's model is round; the grid is made of hexagons. Today the code moves the island's rim in or out, direction by direction, so that the rafts of ring 3 float clear of it (`client/src/scene/coast.ts`). Where a plot of the rim needs the land, the plot wins: the side of a raft toward the island may then lie on the beach (at most a quarter of its room, tested). A new island model whose shore follows the outer edge of the plots of rings 0 to 2, 0.35 past the rooms of the rim plots, would remove that: the same pipeline, if the owner wants it.
