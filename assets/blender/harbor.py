"""
The Harbor (art direction: an L-shaped pier, bollards, a boat, a crane) in its six eras (docs/tasks/week-8.md, "The
eras"), and a detail at every other level within its era. It stands on the coast at the back left (client/src/city/
plots.ts), by the slots the rules keep for its pier (PIER_SLOTS): on its plot, its office and its crane at the quay that
faces the pier; on the water, its pier and its boat, a model of their own for each era (harbor-pier), which the game
lays from the plot's center:

- Salvage (1–4): a driftwood shack, a rope bollard; a pier of planks on barrels, a rowboat;
- Colony (5–9): a plank office, a wooden crane; a plank pier on stone piles, a small sailing boat;
- Workshop (10–14): a brick office, a stone quay, a hand crane; a stone pier, a fishing boat with its wheelhouse;
- Industry (15–19): a steel shed, a steam crane; a steel pier, a small steamboat with its funnel;
- Electricity (20–24): an office with big windows, an electric crane; lamps along the pier, a motor launch;
- Modern (25–30): a concrete quay, a gantry crane, an office with a radar mast; a modern boat; at 30, gold on the boat.

The pier goes from the coast to the first slot kept for it, on into the third, where it turns and the boat lies: always
on the water, never on a raft's room (client/test/staged.test.ts).
"""
import math

from kit import box, cone, cylinder, flag, prism_roof, rod, rope_coil, sphere
from parts import FLOOR, WATER, boards, door, era_details, floor, house, hull, pier, roof_slope, window
from stages import era_of

# The quay: the plot's edge that faces the pier (back right), from one of its corners to the other.
QUAY = ((0.86, -0.5), (0.0, -1.0))
# The pier, from the plot's center: from its coast to the first slot kept for it (1, -3), straight on into the third
# (2, -4), then a short arm across it, an L; the boat lies along the arm. The second slot (1, -4) stays open water.
PIER = [(0.5, -0.86), (1.0, -1.732), (2.0, -3.464), (2.55, -3.464)]
BOAT = (2.32, -3.12)


def quay(color, foot):
    """A strip along the quay edge, inside the plot."""
    (ax, az), (bx, bz) = QUAY
    turn = math.atan2(bz - az, bx - ax)
    return [box((math.hypot(bx - ax, bz - az) * 0.92, 0.06, 0.14), ((ax + bx) / 2 * 0.9, foot + 0.03, (az + bz) / 2 * 0.9), color, bevel=0.008, turn=-turn)]


# Where the cranes stand, and how far their arms reach toward the pier: inside the plot (its edge toward the pier is 1
# from its center, a building keeps within 0.95).
CRANE = (0.1, -0.35)
REACH = 0.5


def jib_crane(x, z, foot, height, color, arm=REACH, toward=(0.5, -0.86)):
    """A crane: a mast, an arm reaching toward the pier, a hook on its rope."""
    tx, tz = x + toward[0] * arm, z + toward[1] * arm
    return [
        cylinder(0.035, height, (x, foot + height / 2, z), color, sides=6, bevel=0),
        rod((x, foot + height * 0.55, z), (tx, foot + height, tz), 0.022, color, 5),
        rod((x, foot + height, z), (tx, foot + height, tz), 0.012, "dark", 3),
        rod((tx, foot + height, tz), (tx, foot + height * 0.5, tz), 0.005, "dark", 3),
        box((0.06, 0.04, 0.06), (tx, foot + height * 0.5, tz), "dark", bevel=0),
    ]


def salvage(s):
    p = boards(0.6, 0.42, (-0.3, 0, -0.05))
    p.append(box((0.46, 0.34, 0.34), (-0.3, 0.2, -0.08), "plank", bevel=0.012))
    p.append(roof_slope((0.56, 0.03, 0.44), (-0.3, 0.4, -0.08), "tin", -12))
    p += door(-0.38, 0.05, 0.09, w=0.12, h=0.22)
    p.append(box((0.1, 0.12, 0.012), (-0.18, 0.24, 0.095), "wood", bevel=0))
    # A rope bollard (a stump with its rope) and nets drying at the quay.
    p.append(cylinder(0.06, 0.16, (0.48, 0.08, -0.48), "wood", sides=7, bevel=0))
    p += rope_coil((0.48, 0.16, -0.48), radius=0.06)
    for x in (0.1, 0.4):
        p.append(cylinder(0.015, 0.36, (x, 0.18, -0.68), "wood", sides=5, bevel=0))
    p.append(box((0.3, 0.2, 0.01), (0.25, 0.24, -0.68), "cream", bevel=0, turn=0))
    p.extend(flag((0.4, 0, 0.3), "cream", height=0.5))
    return p


def colony(s):
    p, f = floor("colony")
    p += house(-0.28, 0.0, 0.56, 0.42, 0.38, "plank", "wood", foot=f, windows=((0.14, 0.22),), door_at=-0.12)
    p += quay("stone", f)
    p += jib_crane(*CRANE, f, 0.8, "wood")
    p.extend(flag((0.3, f, 0.36), "cream", height=0.5))
    return p


def workshop(s):
    p, f = floor("workshop")
    p += house(-0.26, 0.02, 0.6, 0.44, 0.62, "brick", "stone_dark", foot=f, roof_h=0.22, windows=((-0.14, 0.45), (0.14, 0.45), (0.14, 0.16)), door_at=-0.14)
    p += quay("stone", f)
    for t in (0.2, 0.5, 0.8):
        (ax, az), (bx, bz) = QUAY
        p.append(cylinder(0.035, 0.08, ((ax + (bx - ax) * t) * 0.9, f + 0.1, (az + (bz - az) * t) * 0.9), "dark", sides=8, bevel=0, top=0.03))
    p += jib_crane(*CRANE, f, 0.9, "steel")
    p.append(cylinder(0.08, 0.06, (CRANE[0], f + 0.25, CRANE[1]), "wood", sides=8, bevel=0, tilt=(math.radians(90), 0)))
    p.extend(flag((-0.26, f + 0.84, 0.0), "navy", height=0.4))
    return p


def industry(s):
    p, f = floor("industry")
    p.append(box((0.62, 0.5, 0.44), (-0.26, f + 0.25, 0.02), "steel", bevel=0.01))
    p.append(roof_slope((0.68, 0.03, 0.5), (-0.26, f + 0.52, 0.02), "tin", -8))
    for x in (-0.42, -0.1):
        p += window(x, f + 0.32, 0.24, w=0.12, h=0.12, frame="steel")
    p += door(-0.26, f, 0.24, w=0.16, h=0.26, color="navy")
    p += quay("concrete", f)
    # The steam crane: a steel tower on the quay, its cabin, its boom toward the pier, its chimney and its steam.
    cx, cz = CRANE
    ex, ez = cx + 0.5 * REACH, cz - 0.866 * REACH
    p.append(box((0.16, 0.9, 0.16), (cx, f + 0.45, cz), "steel", bevel=0.005))
    p.append(box((0.26, 0.2, 0.22), (cx, f + 1.0, cz), "navy", bevel=0.008))
    p.append(rod((cx, f + 1.0, cz), (ex, f + 1.5, ez), 0.025, "steel", 5))
    p.append(rod((ex, f + 1.5, ez), (ex, f + 0.9, ez), 0.005, "dark", 3))
    p.append(cylinder(0.03, 0.2, (cx - 0.08, f + 1.2, cz + 0.06), "dark", sides=6, bevel=0))
    for i, (dy, r) in enumerate(((1.36, 0.06), (1.48, 0.08))):
        p.append(sphere(r, (cx - 0.08 + 0.03 * i, f + dy, cz + 0.06), "steam", subdivisions=1))
    p.extend(flag((-0.26, f + 0.52, -0.12), "navy", height=0.4))
    return p


def electricity(s):
    p, f = floor("electricity")
    p.append(box((0.6, 0.46, 0.42), (-0.28, f + 0.23, 0.02), "white", bevel=0.01))
    p.append(box((0.52, 0.2, 0.02), (-0.28, f + 0.28, 0.235), "glass", bevel=0.003))
    p.append(box((0.66, 0.04, 0.48), (-0.28, f + 0.48, 0.02), "steel", bevel=0.006))
    p += door(-0.08, f, 0.23, w=0.14, h=0.24, color="navy")
    p += quay("concrete", f)
    # The electric crane: a steel lattice mast, a long arm, its lamp; its cable to the office.
    cx, cz = CRANE
    ex, ez = cx + 0.5 * REACH, cz - 0.866 * REACH
    for dx in (-0.06, 0.06):
        for dz in (-0.06, 0.06):
            p.append(cylinder(0.012, 1.3, (cx + dx, f + 0.65, cz + dz), "steel", sides=4, bevel=0))
    for y in (0.35, 0.7, 1.05):
        p.append(box((0.15, 0.015, 0.15), (cx, f + y, cz), "steel", bevel=0))
    p.append(box((0.18, 0.14, 0.16), (cx, f + 1.36, cz), "navy", bevel=0.006))
    p.append(rod((cx, f + 1.44, cz), (ex, f + 1.44, ez), 0.022, "steel", 4))
    p.append(sphere(0.035, (ex, f + 1.4, ez), "gold", subdivisions=1))
    p.append(rod((cx, f + 0.6, cz), (-0.0, f + 0.46, -0.1), 0.005, "dark", 3))
    p.extend(flag((-0.5, f + 0.5, -0.1), "copper", height=0.36))
    return p


def modern(s):
    p, f = floor("modern")
    p += quay("concrete", f)
    # The office: white, wide windows, a radar mast on its roof.
    p.append(box((0.56, 0.42, 0.42), (-0.3, f + 0.21, 0.04), "white", bevel=0.01))
    p.append(box((0.48, 0.16, 0.02), (-0.3, f + 0.26, 0.255), "glass", bevel=0.003))
    p += door(-0.12, f, 0.25, w=0.14, h=0.22, color="navy")
    p.append(cylinder(0.015, 0.4, (-0.44, f + 0.62, -0.06), "steel", sides=5, bevel=0))
    p.append(box((0.28, 0.04, 0.05), (-0.44, f + 0.84, -0.06), "white", bevel=0.006, turn=0.4))
    # The gantry crane over the quay: two portal legs, a girder reaching out to the pier, a trolley.
    for lx, lz in ((0.02, -0.16), (0.3, -0.6)):
        for k in (-0.08, 0.08):
            p.append(cylinder(0.025, 1.35, (lx + k, f + 0.675, lz), "gold" if s >= 30 else "steel", sides=6, bevel=0))
        p.append(box((0.24, 0.04, 0.04), (lx, f + 1.32, lz), "steel", bevel=0))
    p.append(rod((-0.06, f + 1.36, -0.02), (0.44, f + 1.36, -0.8), 0.035, "white", 6))
    p.append(box((0.1, 0.08, 0.1), (0.3, f + 1.28, -0.58), "navy", bevel=0.006))
    p.extend(flag((-0.56, f + 0.42, -0.12), "gold", height=0.34))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


def pier_model(s):
    """The pier and the boat of the stage's era, from the plot's center, on the water."""
    era = era_of(s)
    if era == "salvage":
        p = []
        for (ax, az), (bx, bz) in zip(PIER[:3], PIER[1:3]):
            for t in (0.25, 0.75):
                p.append(cylinder(0.07, 0.16, (ax + (bx - ax) * t, WATER + 0.06, az + (bz - az) * t), "navy" if t < 0.5 else "steel", sides=8, bevel=0, tilt=(math.radians(90), 0)))
        p += pier(PIER[:3], 0.18, WATER + 0.17, "plank", piles="wood", step=0.6, pile_r=0.02)
        p += hull(0.42, 0.16, 0.12, (BOAT[0], WATER, BOAT[1]), "wood", turn=0.1)
        return p
    if era == "colony":
        p = pier(PIER[:3], 0.2, WATER + 0.2, "plank", piles="stone", step=0.45)
        p += hull(0.5, 0.2, 0.14, (BOAT[0], WATER, BOAT[1]), "wood", turn=0.1)
        p.append(cylinder(0.012, 0.5, (BOAT[0] + 0.02, WATER + 0.33, BOAT[1]), "wood", sides=4, bevel=0))
        p.append(box((0.01, 0.3, 0.2), (BOAT[0] + 0.03, WATER + 0.36, BOAT[1] + 0.09), "cream", bevel=0, turn=0.1))
        return p
    if era == "workshop":
        p = pier(PIER, 0.24, WATER + 0.22, "stone_dark", piles="stone", step=0.4, pile_r=0.04)
        p += hull(0.56, 0.22, 0.16, (BOAT[0], WATER, BOAT[1]), "navy", turn=0.1)
        p.append(box((0.12, 0.12, 0.12), (BOAT[0] - 0.08, WATER + 0.17, BOAT[1]), "plank", bevel=0.008))
        return p
    if era == "industry":
        p = pier(PIER, 0.24, WATER + 0.22, "steel", piles="steel", step=0.4)
        p += hull(0.62, 0.22, 0.16, (BOAT[0], WATER, BOAT[1]), "navy", turn=0.1)
        p.append(box((0.22, 0.1, 0.13), (BOAT[0] - 0.06, WATER + 0.16, BOAT[1]), "white", bevel=0.008))
        p.append(cylinder(0.035, 0.16, (BOAT[0] + 0.02, WATER + 0.27, BOAT[1]), "dark", sides=8, bevel=0))
        p.append(cylinder(0.037, 0.03, (BOAT[0] + 0.02, WATER + 0.31, BOAT[1]), "gold", sides=8, bevel=0))
        return p
    if era == "electricity":
        p = pier(PIER, 0.24, WATER + 0.22, "concrete", piles="steel", step=0.4)
        for (x, z) in PIER[1:]:
            p.append(cylinder(0.012, 0.3, (x + 0.08, WATER + 0.37, z + 0.06), "navy", sides=4, bevel=0))
            p.append(sphere(0.03, (x + 0.08, WATER + 0.53, z + 0.06), "gold", subdivisions=1))
        p += hull(0.58, 0.2, 0.14, (BOAT[0], WATER, BOAT[1]), "white", turn=0.1)
        p.append(box((0.18, 0.09, 0.12), (BOAT[0] - 0.04, WATER + 0.14, BOAT[1]), "navy", bevel=0.01))
        return p
    p = pier(PIER, 0.26, WATER + 0.24, "concrete", piles="concrete", step=0.5, pile_r=0.04)
    for (x, z) in PIER[1:]:
        p.append(cylinder(0.025, 0.07, (x + 0.1, WATER + 0.3, z + 0.08), "dark", sides=6, bevel=0))
    p += hull(0.66, 0.22, 0.16, (BOAT[0], WATER, BOAT[1]), "white", turn=0.1)
    p.append(box((0.22, 0.1, 0.14), (BOAT[0] - 0.05, WATER + 0.16, BOAT[1]), "glass", bevel=0.01))
    p.append(box((0.6, 0.02, 0.005), (BOAT[0], WATER + 0.03, BOAT[1] + 0.105), "gold" if s >= 30 else "navy", bevel=0, turn=-0.1))
    return p


# Models laid with each stage's (the game puts them at the plot's center).
STAGE_EXTRAS = {"harbor-pier": pier_model}

DETAILS = era_details(
    {
        "salvage": [(0.1, 0.4), (-0.55, 0.3), (0.3, 0.1)],
        "colony": [(0.1, 0.42), (0.45, 0.15), (-0.5, 0.36), (-0.1, 0.42)],
        "workshop": [(0.18, 0.4), (-0.5, 0.42), (0.5, 0.25), (-0.15, 0.45)],
        "industry": [(0.15, 0.42), (-0.55, 0.42), (0.45, 0.2), (0.6, -0.05)],
        "electricity": [(0.2, 0.4), (-0.55, 0.42), (0.35, 0.2), (0.62, 0.0)],
        "modern": [(0.25, 0.4), (-0.5, 0.42), (0.0, 0.48), (0.58, 0.12)],
    }
)

_ = cone, prism_roof
