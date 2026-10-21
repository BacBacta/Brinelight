"""
The city fabric's target images (owner, 21 October), step 1: what grows between the buildings as the city grows, in
the game's framing on the S22 (fabric-layouts.mts). Display only: nothing here is a rule, a value or the city's data.

- houses, as many as the Shelters give room for survivors (two per house), on the free plots of the island first, then
  on the land won; their style by era: tents and huts (salvage), wooden houses (colony), brick (workshop), rows of
  houses and workshops (industry), lit windows and power poles (electricity), solar roofs and small apartment blocks
  (modern);
- streets: dirt paths, then cobbles, then paved streets with lamps; a square around the Lighthouse that grows;
- one equipment per era: a well and rain barrels, a windmill, chimneys and carts, a water tower, wind turbines, solar
  panels;
- fields and gardens on the land won (vegetable gardens, orchards, kelp racks), then parks; street trees;
- the port: more quays and boats with the eras;
- `mist`: the Mist's light, the windows lit (more of them with the eras), the lamps on.

Each kind is one model, copied where it stands (instanced): its triangles and its copies are written beside the image
(<out>.budget.json). With `count`, nothing is rendered: only the budget (the worst city).

    .venv-blender/bin/python assets/blender/fabric_target.py <city> <out.png> [day|mist|count] [samples] [pixels]
"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
import land  # noqa: E402
import land_target as LT  # noqa: E402
import reclaim  # noqa: E402
import target  # noqa: E402

HERE = Path(__file__).resolve().parent
SEA = reclaim.SEA
# Two survivors to a house; a row of houses holds three houses' worth, an apartment block six.
PER_HOUSE = 2
# The share of windows lit in the Mist, by era: a few lanterns in the tents, nearly every window in the Modern era.
LIT = [0.2, 0.3, 0.45, 0.6, 0.85, 0.95]
# The square around the Lighthouse, by era: its reach (hex distance from the Lighthouse's center) and its ground.
SQUARE = [(0.0, None), (0.92, "earth"), (1.0, "cobble"), (1.06, "cobble"), (1.12, "paving"), (1.18, "paving")]
# The streets' ground by era (the trails between the buildings): dirt, then cobbles, then paving.
STREET = ["earth", "earth", "cobble", "cobble", "paving", "paving"]

MODE = {"night": False}
TEMPLATES = {}
COUNTS = {}
# What the fabric takes the place of: the groves on the plots with houses or fields, the game's plants on the land won.
REMOVED = {}
# The game's plants on a plot won (client/src/city/land/index.ts, PLANTS and plantsOf): 6 to 11, trees 45 %.
WON_PLANTS = {"wild": ("wild-tree", "wild-bush", "wild-flowers"), "garden": ("garden-tree", "hedge", "flowerbed"), "modern": ("modern-tree", "hedge", "flowerbed")}


def template(name, make):
    """A model made once, kept out of the render, its copies linked where they stand (land_target.link)."""
    if name not in TEMPLATES:
        obj = LT.template(make)
        obj.name = name
        TEMPLATES[name] = obj
    return TEMPLATES[name]


def put(name, make, at, turn=0.0, scale=1.0):
    COUNTS[name] = COUNTS.get(name, 0) + 1
    return LT.link(template(name, make), name, at, turn=turn, scale=scale)


def window(lit):
    """A window's color: glass by day; in the Mist, gold (glowing) when lit, dark otherwise."""
    if not MODE["night"]:
        return "glass"
    return "gold" if lit else "navy_dark"


# --- The houses ------------------------------------------------------------------------------------------------------
def windows_on(w, h, d, y0, lit, n=2, sides=True):
    """Windows on the front (+z) and, with `sides`, on the right side (+x) of a box of w × h × d standing at y0."""
    parts = []
    for i in range(n):
        x = -w / 2 + w * (i + 0.5) / n
        parts.append(kit.box((w * 0.18, h * 0.3, 0.012), (x, y0 + h * 0.55, d / 2 + 0.004), window(lit), bevel=0))
    if sides:
        parts.append(kit.box((0.012, h * 0.3, d * 0.22), (w / 2 + 0.004, y0 + h * 0.55, 0), window(lit), bevel=0))
    return parts


def tent(lit):
    parts = [kit.prism_roof(0.3, 0.26, 0.2, (0, 0, 0), "cream"), kit.box((0.07, 0.11, 0.01), (0, 0.055, 0.132), "dark", bevel=0)]
    parts[0].modifiers.clear()
    if lit:
        parts.append(kit.box((0.04, 0.05, 0.04), (0.11, 0.025, 0.17), "gold", bevel=0))
    return parts


def hut(lit):
    w, h, d = 0.3, 0.17, 0.26
    parts = [kit.box((w, h, d), (0, h / 2, 0), "drift", bevel=0), kit.prism_roof(w + 0.06, d + 0.06, 0.12, (0, h, 0), "tin")]
    parts[1].modifiers.clear()
    parts.append(kit.box((0.07, 0.11, 0.01), (-0.06, 0.055, d / 2 + 0.004), "dark", bevel=0))
    parts.append(kit.box((0.06, 0.05, 0.012), (0.07, 0.1, d / 2 + 0.004), window(lit), bevel=0))
    return parts


def gabled(wall, roof, w, h, d, lit, chimney=None, door="wood"):
    parts = [kit.box((w, h, d), (0, h / 2, 0), wall, bevel=0), kit.prism_roof(w + 0.05, d + 0.06, h * 0.55, (0, h, 0), roof)]
    parts[1].modifiers.clear()
    parts.append(kit.box((0.07, 0.13, 0.012), (-w * 0.2, 0.065, d / 2 + 0.004), door, bevel=0))
    parts += windows_on(w, h, d, 0, lit, n=1)
    parts[-2].location.x = w * 0.2
    if chimney:
        parts.append(kit.box((0.05, 0.14, 0.05), (w * 0.28, h + h * 0.4, -d * 0.15), chimney, bevel=0))
    return parts


def wooden(lit):
    return gabled("plank", "plank_red", 0.34, 0.22, 0.28, lit, chimney="stone_dark")


def brick(lit):
    return gabled("brick", "stone_dark", 0.36, 0.27, 0.3, lit, chimney="brick", door="navy")


def row(lit):
    """Three brick houses side by side under their own roofs: three houses' worth."""
    parts = []
    for k in range(3):
        x = (k - 1) * 0.32
        p = gabled("brick" if k != 1 else "plank_red", "stone_dark", 0.32, 0.28, 0.3, lit and k != 2, chimney="brick" if k == 0 else None, door="navy")
        for o in p:
            o.location.x += x
        parts += p
    return parts


def workshop(lit):
    """A workshop: a long hall of brick, a saw-tooth roof of glass, a tall chimney."""
    w, h, d = 0.62, 0.3, 0.42
    parts = [kit.box((w, h, d), (0, h / 2, 0), "brick", bevel=0)]
    for k in range(3):
        r = kit.prism_roof(w / 3, d, 0.12, ((k - 1) * w / 3, h, 0), "glass" if not MODE["night"] else window(lit), turn=math.pi / 2)
        r.modifiers.clear()
        parts.append(r)
    parts.append(kit.cylinder(0.04, 0.55, (w / 2 - 0.06, h + 0.2, -d / 2 + 0.06), "brick", sides=6, bevel=0))
    parts.append(kit.box((0.16, 0.18, 0.012), (0, 0.09, d / 2 + 0.004), "wood", bevel=0))
    parts += windows_on(w, h, d, 0, lit, n=3, sides=False)
    return parts


def lit_house(lit):
    """The electricity era's house: plastered, a porch lamp."""
    p = gabled("concrete", "stone_dark", 0.36, 0.28, 0.3, lit, chimney="brick", door="navy")
    p.append(kit.box((0.03, 0.03, 0.03), (-0.13, 0.17, 0.17), "gold" if MODE["night"] else "brass", bevel=0))
    return p


def solar_house(lit):
    """The Modern era's house: white walls, a flat roof covered in solar panels, the survivors' patches."""
    w, h, d = 0.36, 0.26, 0.3
    parts = [kit.box((w, h, d), (0, h / 2, 0), "white", bevel=0), kit.box((w + 0.04, 0.025, d + 0.04), (0, h + 0.012, 0), "concrete", bevel=0)]
    parts.append(kit.box((w * 0.8, 0.02, d * 0.7), (0, h + 0.05, 0), "solar", bevel=0, tilt=(0.25, 0)))
    parts.append(kit.box((0.07, 0.13, 0.012), (-w * 0.25, 0.065, d / 2 + 0.004), "navy", bevel=0))
    parts.append(kit.box((0.1, 0.07, 0.012), (w * 0.15, h * 0.6, d / 2 + 0.004), window(lit), bevel=0))
    parts.append(kit.box((0.012, 0.07, 0.1), (w / 2 + 0.004, h * 0.6, 0), window(lit), bevel=0))
    # A repaired patch: a plank over the wall (the survivors' touch).
    parts.append(kit.box((0.09, 0.05, 0.008), (w * 0.3, 0.06, d / 2 + 0.006), "plank_grey", bevel=0, turn=0, tilt=(0, 0.2)))
    return parts


def apartments(lit):
    """A small apartment block: three floors, a solar roof, a stair tower; six houses' worth."""
    w, h, d = 0.5, 0.62, 0.36
    parts = [kit.box((w, h, d), (0, h / 2, 0), "concrete", bevel=0), kit.box((0.14, h + 0.08, 0.14), (-w / 2 + 0.07, (h + 0.08) / 2, -d / 2 + 0.07), "white", bevel=0)]
    rng = np.random.default_rng(int(lit))
    for f in range(3):
        y = 0.12 + f * 0.19
        for i in range(3):
            on = lit and rng.uniform() < 0.8
            parts.append(kit.box((0.09, 0.08, 0.012), (-w / 2 + w * (i + 0.5) / 3, y, d / 2 + 0.004), window(on), bevel=0))
        parts.append(kit.box((0.012, 0.08, 0.09), (w / 2 + 0.004, y, 0.05), window(lit and f != 1), bevel=0))
    parts.append(kit.box((w * 0.85, 0.02, d * 0.75), (0.02, h + 0.04, 0.02), "solar", bevel=0, tilt=(0.2, 0)))
    return parts


# What each era builds, smallest first: (model, houses' worth, height).
STYLES = {
    0: [("tent", tent, 1), ("hut", hut, 1)],
    1: [("wooden", wooden, 1)],
    2: [("brick", brick, 1)],
    3: [("brick", brick, 1), ("row", row, 3)],
    4: [("lit-house", lit_house, 1), ("row", row, 3)],
    5: [("solar-house", solar_house, 1), ("apartments", apartments, 6)],
}
# The last era's style on the outskirts (a fifth of the houses): the city is built over time.
OLDER = {1: ("hut", hut), 2: ("wooden", wooden), 3: ("wooden", wooden), 4: ("brick", brick), 5: ("lit-house", lit_house)}


# --- Where the houses go ---------------------------------------------------------------------------------------------
def quarters(layout):
    """The plots a house may stand on: the island's free plots (nearest the Lighthouse first), then the land won free of a building."""
    built = [(b["x"], b["z"]) for b in layout["buildings"]]
    harbor = land.BUILT["harbor"]
    built.append(harbor)
    out = []
    for x, z in sorted(land.PLOTS, key=lambda p: (round(math.hypot(*p), 1), -p[1], p[0])):
        if any(math.dist((x, z), b) < 0.1 for b in built):
            continue
        out.append({"x": x, "z": z, "won": False})
    for s in sorted(layout["slots"], key=lambda s: (math.hypot(s["x"], s["z"]), -s["z"])):
        if not s["building"] and not s["flooded"]:
            out.append({"x": s["x"], "z": s["z"], "won": True, "key": s["key"]})
    return out


def lots(q, era):
    """Six lots around a plot's middle, facing out to its streets; the middle stays a small yard (or an equipment)."""
    out = []
    for k in range(6):
        a = math.radians(30 + 60 * k)
        x, z = q["x"] + math.cos(a) * 0.56, q["z"] + math.sin(a) * 0.56
        # Facing the camera's side as much as their street allows.
        out.append({"x": x, "z": z, "turn": -a + math.pi / 2 if era >= 3 else 0.35 * math.sin(k * 1.7), "plot": q})
    return out


def houses(layout, height_at):
    """The houses the room for survivors asks for, nearest the Lighthouse first; what they leave of the plots."""
    era = layout["era"]
    need = math.ceil(layout["room"] / PER_HOUSE)
    styles = STYLES[era]
    plots = quarters(layout)
    rng = np.random.default_rng(31)
    placed, used = [], set()
    lit_rng = np.random.default_rng(5)
    # The big ones first (rows, apartment blocks): a third of the houses' worth, on whole plots of their own, at the back.
    big = [s for s in styles if s[2] > 1]
    small = [s for s in styles if s[2] == 1]
    left = need
    if big:
        name, make, worth = big[0]
        n_big = max(1, round(need / 3 / worth))
        backs = sorted([p for p in plots if not p["won"]], key=lambda p: p["z"])
        for p in backs[:n_big]:
            used.add(id(p))
            for k, a in enumerate((0.0, math.pi) if worth == 3 else (0.0,)):
                dz = -0.3 if k == 0 else 0.35
                at = (p["x"], height_at(p["x"], p["z"] + dz), p["z"] + dz)
                lit = lit_rng.uniform() < LIT[era]
                put(f"{name}{'-lit' if lit and MODE['night'] else ''}", lambda make=make, lit=lit: make(lit), at)
                placed.append((at[0], at[2], name))
                left -= worth
                if left <= 0:
                    break
            if left <= 0:
                break
    n = max(0, left)
    candidates = [lot for p in plots if id(p) not in used for lot in lots(p, era)]
    for i, lot in enumerate(candidates[:n]):
        outskirts = i >= n * 0.8 and era in OLDER
        name, make = OLDER[era] if outskirts else small[i % len(small)][:2]
        lit = lit_rng.uniform() < LIT[era]
        at = (lot["x"], height_at(lot["x"], lot["z"]), lot["z"])
        put(f"{name}{'-lit' if lit and MODE['night'] else ''}", lambda make=make, lit=lit: make(lit), at, turn=lot["turn"])
        placed.append((lot["x"], lot["z"], name))
        used.add(id(lot["plot"]))
    taken = [p for p in plots if id(p) in used]
    rest = [p for p in plots if id(p) not in used]
    return placed, taken, rest


# --- Streets, the square, fields: painted on the ground --------------------------------------------------------------
def street_lines(layout, taken):
    """The trails between the buildings, and a street through each plot with houses, to the nearest trail's end."""
    lines = land.trails() + LT.extra_trails(layout)
    for q in taken:
        lines.append([(q["x"] - 0.75, q["z"] + 0.05), (q["x"], q["z"] - 0.05), (q["x"] + 0.75, q["z"] + 0.05)])
        # To the Lighthouse's square, straight.
        d = math.hypot(q["x"], q["z"]) or 1
        lines.append([(q["x"] - q["x"] / d * 0.2, q["z"] - q["z"] / d * 0.2), (q["x"] - q["x"] / d * (d - 1.0), q["z"] - q["z"] / d * (d - 1.0))])
    return lines


def overlay(col, layout, taken, fields, res):
    """The square, the streets in the era's ground, and the fields, over the ground's colors (land_target.colors)."""
    era = layout["era"]
    span = LT.SPAN
    xs = np.linspace(-span, span, res)
    px, pz = np.meshgrid(xs, xs)
    n2 = land.fbm(px * 4.0, pz * 4.0, 6.0)
    ground = {"earth": land.hexc(land.LOOKS[layout["look"]]["trail"][0]), "cobble": land.hexc("#9C968B"), "paving": land.hexc("#DDD5C4")}
    # The streets: wider and of the era's ground.
    lines = street_lines(layout, taken)
    tr = land.distance_to(lines, px, pz)
    width = 0.09 + 0.02 * era
    g = ground[STREET[era]]
    col = land.mix(col, g[None, None], np.clip((width - tr) / 0.02, 0, 1) * (0.85 if era < 2 else 1.0))
    if era >= 2:
        # Cobbles: a darker joint pattern; paving: a pale curb.
        joints = (np.sin(px * 90) * np.sin(pz * 90) > 0.6) & (tr < width) if era < 4 else (np.abs(tr - width + 0.012) < 0.008)
        col = np.where(joints[..., None], col * 0.82, col)
    # The square around the Lighthouse.
    reach, kind = SQUARE[era]
    if kind:
        h = land.hex_reach(px, pz)
        ring = np.clip((reach - h) / 0.03, 0, 1) * np.clip((h - 0.6) / 0.05, 0, 1)
        col = land.mix(col, ground[kind][None, None] * (0.95 + 0.05 * n2[..., None]), ring)
        if kind == "cobble":
            col = np.where(((np.sin(px * 80) * np.sin(pz * 80) > 0.55) & (ring > 0.5))[..., None], col * 0.84, col)
        if kind == "paving":
            col = np.where(((np.abs((px * 6) % 1 - 0.5) < 0.03) | (np.abs((pz * 6) % 1 - 0.5) < 0.03))[..., None] & (ring > 0.5)[..., None], col * 0.9, col)
    # The plots with houses: yards of trodden earth around the lots.
    for q in taken:
        hq = land.hex_reach(px - q["x"], pz - q["z"])
        col = land.mix(col, ground["earth"][None, None] * 1.05, np.clip((0.82 - hq) / 0.1, 0, 1) * 0.35 * (0.6 + n2))
    # The fields.
    for f in fields:
        # Round, its edge a little uneven: no hexagon shows (owner).
        hq = np.hypot(px - f["x"], pz - f["z"]) + 0.06 * land.fbm(px * 3.0, pz * 3.0, 17.0)
        inside = np.clip((0.8 - hq) / 0.06, 0, 1)
        if f["kind"] == "garden":
            rows = (np.sin((px - f["x"]) * 38) > 0)[..., None]
            c = np.where(rows, land.hexc("#6E8E3E")[None, None], land.hexc("#8A6A44")[None, None])
        elif f["kind"] == "orchard":
            c = land.mix(land.hexc("#8DB65A")[None, None], land.hexc("#79A24C")[None, None], 0.5 + n2)
        elif f["kind"] == "kelp":
            rows = (np.sin((pz - f["z"]) * 30) > 0.3)[..., None]
            c = np.where(rows, land.hexc("#9C8C74")[None, None], land.hexc("#B7A88C")[None, None])
        else:  # a park: a light lawn, a round path
            r = np.hypot(px - f["x"], pz - f["z"])
            c = land.mix(land.hexc("#A6D06E")[None, None], land.hexc("#DDD5C4")[None, None], np.clip((0.045 - np.abs(r - 0.45)) / 0.015, 0, 1))
        col = land.mix(col, c, inside)
    return col


def plan_fields(layout, rest):
    """The land won free of houses: a garden, an orchard, kelp racks or a park, by era (none before the land)."""
    era = layout["era"]
    kinds = {1: ["garden"], 2: ["garden", "orchard"], 3: ["garden", "orchard", "kelp"], 4: ["garden", "kelp", "orchard", "park"], 5: ["park", "garden", "orchard", "kelp"]}.get(era, [])
    out = []
    for k, p in enumerate([p for p in rest if p["won"]]):
        if kinds:
            out.append({"x": p["x"], "z": p["z"], "kind": kinds[k % len(kinds)]})
    return out


# --- What stands on the fields ---------------------------------------------------------------------------------------
def field_props(fields, height_at):
    for f in fields:
        x0, z0 = f["x"], f["z"]
        if f["kind"] == "orchard":
            # Seven trees in rows: a hexagon and its middle (the rows are painted on the ground).
            for k in range(7):
                a, r = k * math.pi / 3, 0.0 if k == 6 else 0.5
                x, z = x0 + math.cos(a) * r, z0 + math.sin(a) * r
                target.place("life-plant-garden-tree", x, height_at(x, z) - 0.01, z, turn=k * 1.3, scale=(0.85, 0.85, 0.85))
                COUNTS["orchard tree"] = COUNTS.get("orchard tree", 0) + 1
        elif f["kind"] == "kelp":
            for j in (-1, 0, 1):
                z = z0 + j * 0.3
                put("kelp-rack", kelp_rack, (x0, height_at(x0, z), z))
        elif f["kind"] == "garden":
            for i in (-1, 1):
                put("scarecrow" if i < 0 else "barrel", scarecrow if i < 0 else (lambda: kit.cylinder(0.06, 0.18, (0, 0.09, 0), "wood", sides=6, bevel=0)), (x0 + i * 0.5, height_at(x0 + i * 0.5, z0), z0 - 0.4))
        else:
            for k in range(5):
                a = k * 1.256
                x, z = x0 + math.cos(a) * 0.62, z0 + math.sin(a) * 0.62
                target.place("life-plant-modern-tree", x, height_at(x, z) - 0.01, z, turn=a, scale=(0.9, 0.9, 0.9))
                COUNTS["park tree"] = COUNTS.get("park tree", 0) + 1
            put("bench", bench, (x0, height_at(x0, z0 + 0.3), z0 + 0.3))


def kelp_rack():
    """A rack of kelp drying: two posts, a bar, the kelp hanging as one dark band."""
    parts = [kit.box((1.0, 0.012, 0.012), (0, 0.16, 0), "drift", bevel=0)]
    for x in (-0.48, 0.48):
        parts.append(kit.box((0.02, 0.17, 0.02), (x, 0.085, 0), "drift", bevel=0))
    parts.append(kit.box((0.9, 0.1, 0.01), (0, 0.105, 0.0), "net", bevel=0))
    return parts


def scarecrow():
    return [kit.box((0.015, 0.22, 0.015), (0, 0.11, 0), "wood", bevel=0), kit.box((0.16, 0.015, 0.015), (0, 0.17, 0), "wood", bevel=0), kit.box((0.06, 0.06, 0.06), (0, 0.24, 0), "plank", bevel=0)]


def bench():
    return [kit.box((0.22, 0.02, 0.06), (0, 0.06, 0), "wood", bevel=0), kit.box((0.22, 0.05, 0.015), (0, 0.09, -0.03), "wood", bevel=0), kit.box((0.02, 0.06, 0.05), (-0.09, 0.03, 0), "navy", bevel=0), kit.box((0.02, 0.06, 0.05), (0.09, 0.03, 0), "navy", bevel=0)]


# --- Equipment, one per era, kept as the city grows ------------------------------------------------------------------
def well():
    parts = [kit.cylinder(0.09, 0.1, (0, 0.05, 0), "stone", sides=8, bevel=0)]
    for x in (-0.08, 0.08):
        parts.append(kit.box((0.015, 0.2, 0.015), (x, 0.15, 0), "wood", bevel=0))
    parts.append(kit.prism_roof(0.22, 0.14, 0.07, (0, 0.24, 0), "plank_red"))
    parts[-1].modifiers.clear()
    for k, (dx, dz) in enumerate(((0.2, 0.08), (0.24, -0.06), (-0.2, 0.1))):
        parts.append(kit.cylinder(0.055, 0.16, (dx, 0.08, dz), "wood", sides=6, bevel=0))
    return parts


def windmill():
    parts = [kit.cylinder(0.14, 0.7, (0, 0.35, 0), "white", sides=8, bevel=0, top=0.09), kit.cone(0.12, 0.16, (0, 0.7, 0), "plank_red", sides=8)]
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        parts.append(kit.box((0.06, 0.38, 0.01), (math.sin(a) * 0.2, 0.62 + math.cos(a) * 0.2, 0.13), "plank", bevel=0, tilt=(0, -a)))
    return parts


def chimneys():
    """The workshop era's equipment: a forge with two tall chimneys, two handcarts at its door."""
    parts = [kit.box((0.44, 0.24, 0.3), (0, 0.12, 0), "brick", bevel=0), kit.prism_roof(0.48, 0.34, 0.1, (0, 0.24, 0), "stone_dark")]
    parts[-1].modifiers.clear()
    for x in (-0.12, 0.14):
        parts.append(kit.cylinder(0.045, 0.75, (x, 0.42, -0.06), "brick", sides=6, bevel=0))
        parts.append(kit.cylinder(0.055, 0.04, (x, 0.8, -0.06), "dark", sides=6, bevel=0))
    for k, x in enumerate((-0.3, 0.32)):
        parts.append(kit.box((0.16, 0.06, 0.1), (x, 0.09, 0.26), "wood", bevel=0, turn=0.3 * (k * 2 - 1)))
        parts.append(kit.cylinder(0.05, 0.015, (x, 0.05, 0.32), "dark", sides=8, bevel=0, tilt=(math.pi / 2, 0)))
    return parts


def water_tower():
    parts = [kit.cylinder(0.17, 0.24, (0, 0.88, 0), "steel", sides=10, bevel=0), kit.cone(0.19, 0.1, (0, 1.0, 0), "navy", sides=10)]
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        parts.append(kit.rod((math.cos(a) * 0.2, 0, math.sin(a) * 0.2), (math.cos(a) * 0.12, 0.78, math.sin(a) * 0.12), 0.012, "navy", 4))
    return parts


def turbine():
    parts = [kit.cylinder(0.035, 1.3, (0, 0.65, 0), "white", sides=6, bevel=0, top=0.02), kit.box((0.05, 0.05, 0.1), (0, 1.3, 0.02), "white", bevel=0)]
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.3
        parts.append(kit.box((0.035, 0.42, 0.008), (math.sin(a) * 0.21, 1.3 + math.cos(a) * 0.21, 0.08), "white", bevel=0, tilt=(0, -a)))
    return parts


def solar_field():
    """Solar panels on their frames, two rows of two, in a plot's yard."""
    parts = []
    for i in range(2):
        for j in range(2):
            parts.append(kit.box((0.26, 0.015, 0.14), (-0.15 + i * 0.3, 0.08, -0.12 + j * 0.24), "solar", bevel=0, tilt=(0.45, 0)))
            parts.append(kit.box((0.02, 0.08, 0.02), (-0.15 + i * 0.3, 0.04, -0.12 + j * 0.24), "steel", bevel=0))
    return parts


def equipment(layout, height_at):
    """
    One piece per era, kept as the city grows, in the middle of the island's free plots (the houses stand around it):
    the low ones in front, the tall ones at the back, the forge on a side; the wind turbines on the far coast.
    """
    era = layout["era"]
    island = [p for p in quarters(layout) if not p["won"]]
    used = set()

    def take(order):
        for p in sorted(island, key=order):
            k = (round(p["x"], 2), round(p["z"], 2))
            if k not in used:
                used.add(k)
                return p["x"], p["z"]
        return None

    pieces = [
        ("well", well, lambda p: (-p["z"], abs(p["x"])), 0),
        ("windmill", windmill, lambda p: (p["z"], abs(p["x"])), 1),
        ("chimneys", chimneys, lambda p: (-abs(p["x"]), p["z"]), 2),
        ("water-tower", water_tower, lambda p: (p["z"], -abs(p["x"])), 3),
        ("solar-field", solar_field, lambda p: (-p["z"], -abs(p["x"])), 5),
    ]
    for name, make, order, since in pieces:
        at = take(order)
        if era >= since and at is not None:
            put(name, make, (at[0], height_at(*at), at[1]))
    if era >= 4:
        # Wind turbines on the far coast, behind the city.
        radii = land.coast_radii(72)
        for k, a in enumerate((-2.2, -1.75, -1.3)):
            r = float(radii[int(round((a % (2 * math.pi)) / (2 * math.pi) * 72)) % 72]) - 0.45
            x, z = math.cos(a) * r, math.sin(a) * r
            put("turbine", turbine, (x, height_at(x, z), z), turn=0.4)


# --- The streets' furniture ------------------------------------------------------------------------------------------
def along(lines, step):
    """Points every `step` along the lines, with their direction."""
    out = []
    for pts in lines:
        acc = step / 2
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            seg = math.hypot(bx - ax, bz - az)
            while acc < seg:
                t = acc / seg
                out.append((ax + (bx - ax) * t, az + (bz - az) * t, math.atan2(bz - az, bx - ax)))
                acc += step
            acc -= seg
    return out


def lamp():
    """A street lamp, light: a square post and a lantern (no frame)."""
    return [kit.box((0.02, 0.32, 0.02), (0, 0.16, 0), "navy", bevel=0), kit.box((0.06, 0.07, 0.06), (0, 0.355, 0), "gold", bevel=0)]


def pole():
    return [kit.box((0.02, 0.5, 0.02), (0, 0.25, 0), "wood", bevel=0), kit.box((0.14, 0.015, 0.015), (0, 0.46, 0), "wood", bevel=0)]


def street_furniture(layout, taken, height_at, L):
    era = layout["era"]
    lines = street_lines(layout, taken)
    built = [(b["x"], b["z"], b["reach"] * b["scale"]) for b in layout["buildings"]]

    def clear(x, z, room=0.12):
        if float(L.depth(np.array([x]), np.array([z]))[0]) < 0.15:
            return False
        return all(float(land.hex_reach(np.array(x - bx), np.array(z - bz))) > br + room for bx, bz, br in built)

    if era >= 2:
        for x, z, a in along(lines, 0.9 if era < 4 else 0.7):
            ox, oz = x - math.sin(a) * 0.14, z + math.cos(a) * 0.14
            if clear(ox, oz):
                put("lamp", lamp, (ox, height_at(ox, oz), oz))
    if era >= 4:
        poles = []
        for x, z, a in along(lines[: len(land.trails())], 0.8):
            ox, oz = x + math.sin(a) * 0.16, z - math.cos(a) * 0.16
            if clear(ox, oz):
                put("pole", pole, (ox, height_at(ox, oz), oz), turn=-a)
                poles.append((ox, height_at(ox, oz) + 0.46, oz))
        for p, q in zip(poles, poles[1:]):
            if math.dist(p, q) < 1.0:
                kit.rod(p, q, 0.003, "dark", 3)
                COUNTS["wire"] = COUNTS.get("wire", 0) + 1
    if era >= 4:
        for x, z, a in along(lines, 0.55):
            ox, oz = x + math.sin(a) * 0.2, z - math.cos(a) * 0.2
            if clear(ox, oz, 0.2):
                target.place("life-plant-modern-tree" if era == 5 else "life-plant-garden-tree", ox, height_at(ox, oz) - 0.01, oz, turn=x * 3, scale=(0.7, 0.7, 0.7))
                COUNTS["street tree"] = COUNTS.get("street tree", 0) + 1


# --- The port --------------------------------------------------------------------------------------------------------
def boat(motor):
    parts = [kit.box((0.36, 0.08, 0.12), (0, 0.04, 0), "white" if motor else "wood", bevel=0), kit.prism_roof(0.12, 0.12, 0.08, (0.18, 0.0, 0), "white" if motor else "wood", turn=math.pi / 2)]
    parts[-1].modifiers.clear()
    if motor:
        parts.append(kit.box((0.12, 0.08, 0.09), (-0.04, 0.12, 0), "navy", bevel=0))
    else:
        parts.append(kit.box((0.012, 0.36, 0.012), (0.02, 0.24, 0), "wood", bevel=0))
        parts.append(kit.prism_roof(0.012, 0.18, 0.28, (0.02, 0.08, 0.0), "cream", turn=math.pi / 2))
        parts[-1].modifiers.clear()
    return parts


def quay():
    return [kit.box((0.3, 0.3, 0.16), (0, -0.13, 0), "stone", bevel=0), kit.box((0.31, 0.02, 0.17), (0, 0.025, 0), "concrete", bevel=0)]


def jetty():
    return [kit.box((0.3, 0.02, 0.12), (0, 0.0, 0), "plank", bevel=0), kit.box((0.03, 0.2, 0.03), (0.13, -0.08, 0.05), "wood", bevel=0)]


def port(layout, L, height_at):
    """Along the island's coast on either side of the Harbor: a jetty, then quays, and boats moored, more with the eras."""
    era = layout["era"]
    hx, hz = land.BUILT["harbor"]
    step = 0.02
    xs = np.arange(-7, 7, step)
    gx, gz = np.meshgrid(xs, xs)
    d = L.depth(gx, gz)
    gz_d, gx_d = np.gradient(d, step)
    on = (np.abs(d) < step * 0.75) & (np.hypot(gx - hx, gz - hz) < 2.4) & (np.hypot(gx - hx, gz - hz) > 0.9)
    iy, ix = np.nonzero(on)
    pts = []
    for k in np.argsort(np.arctan2(gz[iy, ix] - hz, gx[iy, ix] - hx)):
        x, z = float(gx[iy[k], ix[k]]), float(gz[iy[k], ix[k]])
        if pts and math.dist((x, z), pts[-1][:2]) < 0.3:
            continue
        nx, nz = -float(gx_d[iy[k], ix[k]]), -float(gz_d[iy[k], ix[k]])
        n = math.hypot(nx, nz) or 1
        pts.append((x, z, nx / n, nz / n))
    quays = min(len(pts), [0, 2, 4, 6, 8, 10][era])
    boats = [1, 2, 3, 4, 5, 6][era]
    # The quays nearest the Harbor first, then outward.
    near = sorted(pts, key=lambda p: math.dist(p[:2], (hx, hz)))
    for k, (x, z, nx, nz) in enumerate(near[:quays]):
        turn = -(math.atan2(nz, nx) + math.pi / 2)
        put("quay" if era >= 2 else "jetty", quay if era >= 2 else jetty, (x + nx * 0.05, 0.0 if era >= 2 else SEA + 0.12, z + nz * 0.05), turn=turn)
    for k, (x, z, nx, nz) in enumerate(near[:boats]):
        turn = -(math.atan2(nz, nx) + math.pi / 2)
        motor = era >= 3 and k % 3 != 2
        put("motor-boat" if motor else "sail-boat", (lambda m=motor: boat(m)), (x + nx * 0.3, SEA, z + nz * 0.3), turn=turn)


# --- The groves, away from the houses and fields ---------------------------------------------------------------------
def plants(L, layout, look, height_at, taken, fields, place=True):
    keep_out = [(q["x"], q["z"], 0.95) for q in taken] + [(f["x"], f["z"], 0.95) for f in fields]
    era = layout["era"]
    manifest = json.loads(land.MANIFEST.read_text())
    gone = lambda name: REMOVED.__setitem__("groves", REMOVED.get("groves", 0) + manifest[f"life-plant-{name}"]["triangles"])  # noqa: E731
    for k, (name, x, y, z, turn, s) in enumerate(land.groves(look)):
        if any(float(land.hex_reach(np.array(x - qx), np.array(z - qz))) < r for qx, qz, r in keep_out):
            gone(name)
            continue
        # The city thins the wild groves as it grows: a park and street trees take their place.
        if era >= 3 and "tree" not in name and k % 3 == 0:
            gone(name)
            continue
        if place:
            target.place(f"life-plant-{name}", x, y, z, turn=turn, scale=(s, s, s))
    # The game's plants on each plot won that a field or houses now cover (8.5 on average, 45 % trees).
    tree, low, cover = (manifest[f"life-plant-{n}"]["triangles"] for n in WON_PLANTS[look])
    covered = [p for p in taken if p["won"]] + [f for f in fields]
    REMOVED["plants on the land won"] = round(len(covered) * 8.5 * (0.45 * tree + 0.3 * low + 0.25 * cover))


# --- Light --------------------------------------------------------------------------------------------------------------
def mist_light():
    """The Mist: a grey-violet sky, a faint cold sun, a haze over the sea; the lit windows and lamps glow (gold)."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("world")
    scene.world = world
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.36, 0.35, 0.48, 1)
    bg.inputs["Strength"].default_value = 0.55
    bpy.ops.object.light_add(type="SUN")
    sun = bpy.context.active_object
    sun.data.energy = 0.7
    sun.data.color = (0.72, 0.72, 0.9)
    sun.rotation_euler = (math.radians(50), 0, math.radians(200))
    gold = kit.material("gold")
    bsdf = gold.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = kit.srgb("#FFC86A")
    bsdf.inputs["Emission Strength"].default_value = 9.0


def triangles_of(name):
    obj = TEMPLATES.get(name)
    return kit.triangles(obj) if obj is not None else 0


def budget(out):
    """The fabric's triangles and copies, by model: what the game's instanced meshes would draw."""
    rows = []
    for name, n in sorted(COUNTS.items()):
        t = triangles_of(name)
        rows.append({"model": name, "copies": n, "triangles": t, "total": t * n})
    plants = {"orchard tree": "life-plant-garden-tree", "park tree": "life-plant-modern-tree", "street tree": "life-plant-modern-tree"}
    manifest = json.loads(land.MANIFEST.read_text())
    for row in rows:
        if row["model"] in plants:
            row["triangles"] = manifest[plants[row["model"]]]["triangles"]
            row["total"] = row["triangles"] * row["copies"]
        if row["model"] == "wire":
            row["triangles"] = 6
            row["total"] = 6 * row["copies"]
    total = sum(r["total"] for r in rows)
    removed = sum(REMOVED.values())
    Path(str(out) + ".budget.json").write_text(json.dumps({"rows": rows, "triangles": total, "removed": REMOVED, "net": total - removed}, indent=1))
    print("budget", total, "removed", removed, "net", total - removed, [(r["model"], r["copies"], r["triangles"]) for r in rows])


def main(city, out, mode="day", samples=32, pixels=LT.PIXELS):
    layout = json.loads((HERE / "targets" / f"{city}.json").read_text())
    MODE["night"] = mode == "mist"
    kit.reset(style=False)
    L = reclaim.Land(layout)
    look = layout["look"]
    # Where the houses go, before the ground is painted (their yards and streets are on it).
    flat = lambda x, z: float(L.heights(np.array([x]), np.array([z]))[0])  # noqa: E731
    placed, taken, rest = houses(layout, flat)
    fields = plan_fields(layout, rest)
    original = LT.colors
    LT.colors = lambda L_, layout_, look_, res: overlay(original(L_, layout_, look_, res), layout_, taken, fields, res)
    height_at = LT.ground(L, layout, look) if mode != "count" else flat
    LT.colors = original
    if mode != "count":
        LT.water(L)
        LT.dike(L, look)
        LT.buildings(layout, height_at)
    plants(L, layout, look, height_at, taken, fields, place=mode != "count")
    field_props(fields, height_at)
    equipment(layout, height_at)
    street_furniture(layout, taken, height_at, L)
    port(layout, L, height_at)
    budget(out)
    if mode == "count":
        return
    if MODE["night"]:
        mist_light()
    else:
        target.light("M")
    w, h = round(layout["camera"]["width"] * pixels), round(layout["camera"]["height"] * pixels)
    target.camera(layout, w, h)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    for lk in ("AgX - Punchy", "AgX - Medium High Contrast"):
        try:
            scene.view_settings.look = lk
            break
        except TypeError:
            continue
    scene.render.filepath = str(out)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    if MODE["night"]:
        haze(out)
    print("rendered", out)


def haze(path):
    """The Mist's haze, over the image: grey-violet, thicker toward the horizon (the top), the lights kept bright."""
    img = bpy.data.images.load(str(path))
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    rows = np.linspace(0, 1, h)[:, None, None]  # 0 at the bottom (Blender's rows go up)
    amount = 0.18 + 0.32 * rows
    glow = np.clip((px[..., :3].max(axis=2, keepdims=True) - 0.55) / 0.3, 0, 1)
    fog = np.array([0.55, 0.53, 0.66], dtype=np.float32)
    px[..., :3] = px[..., :3] * (1 - amount * (1 - glow)) + fog * amount * (1 - glow)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = str(path)
    img.file_format = "PNG"
    img.save()


if __name__ == "__main__":
    a = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    main(a[0], a[1], a[2] if len(a) > 2 else "day", int(a[3]) if len(a) > 3 else 32, float(a[4]) if len(a) > 4 else LT.PIXELS)
