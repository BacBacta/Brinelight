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

The pier leaves the shore from a step of the quay and goes out on its piles to the first slot kept for it, where it turns
and the boat lies moored: always on the water past the shore, never on a raft's room (client/test/staged.test.ts).
"""
import math

from kit import box, cone, cylinder, flag, prism_roof, rod, rope_coil, sphere
from parts import FLOOR, WATER, boards, door, era_details, floor, house, hull, pier, roof_slope, window
from stages import era_of

# The quay: the plot's edge that faces the pier (back right), from one of its corners to the other.
QUAY = ((0.86, -0.5), (0.0, -1.0))
# The pier, from the plot's center (owner, 21 October): from a step on the shore (the coast is 1.12 from the center that
# way), straight out to the first slot kept for it (1, -3), then an arm to the left, toward the open water; the boat lies
# along the arm, on its far side, moored to two bollards. Its deck is a little under the ground, on piles in the sea.
PIER = [(0.475, -0.823), (1.0, -1.732), (0.394, -2.082)]
ARM_MID = ((PIER[1][0] + PIER[2][0]) / 2, (PIER[1][1] + PIER[2][1]) / 2)
BOLLARDS = [(PIER[1][0] + 0.06, PIER[1][1] - 0.1), (PIER[2][0] + 0.06, PIER[2][1] - 0.1)]
BOAT_TURN = math.atan2(PIER[2][1] - PIER[1][1], PIER[2][0] - PIER[1][0])
BOAT = (ARM_MID[0] + 0.5 * 0.27, ARM_MID[1] - 0.866 * 0.27)
DECK_Y = -0.07
# The city's sea after the style pass (client: cityLook.ts, SEA_RISE): the boat floats on it, under the deck.
SEA = WATER + 0.2


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


def along(d, across=0.0):
    """A point of the boat's line: `d` along it from its middle, `across` toward its port side."""
    c, s_ = math.cos(BOAT_TURN), math.sin(BOAT_TURN)
    return BOAT[0] + d * c - across * s_, BOAT[1] + d * s_ + across * c


def moorings(deck_y, rope="drift_light"):
    """Two ropes from the arm's bollards down to the boat's bow and stern."""
    out = []
    for k, d in ((0, 0.2), (1, -0.2)):
        bx, bz = BOLLARDS[k]
        x, z = along(d)
        out.append(rod((bx, deck_y + 0.05, bz), (x, SEA + 0.1, z), 0.006, rope, sides=4))
    return out


def bollards(deck_y, color):
    return [cylinder(0.03, 0.07, (x, deck_y + 0.035, z), color, sides=8, bevel=0.004) for x, z in BOLLARDS]


def landing(color, top=-0.02):
    """Where the pier leaves the shore: a step of the quay, on the land, as high as the ground."""
    (ax, az), (bx, bz) = PIER[0], PIER[1]
    turn = math.atan2(bz - az, bx - ax)
    return [box((0.3, 0.12, 0.36), (ax - math.cos(turn) * 0.05, top - 0.06, az - math.sin(turn) * 0.05), color, bevel=0.01, turn=-turn)]


def pier_model(s):
    """
    The pier and the boat of the stage's era, from the plot's center (owner, 21 October): from a step on the shore,
    straight out on its piles to the first slot kept for it, then an arm along which the era's boat lies moored.
    """
    era = era_of(s)
    deck = DECK_Y
    if era == "salvage":
        p = landing("wood") + pier(PIER, 0.22, deck, "plank", piles="wood", step=0.25, pile_r=0.03)
        p += bollards(deck, "wood")
        p += hull(0.55, 0.21, 0.15, (BOAT[0], SEA, BOAT[1]), "wood", turn=BOAT_TURN)
        return p + moorings(deck)
    if era == "colony":
        p = landing("stone") + pier(PIER, 0.24, deck, "plank", piles="wood", step=0.25, pile_r=0.035)
        p += bollards(deck, "stone_dark")
        p += hull(0.65, 0.26, 0.18, (BOAT[0], SEA, BOAT[1]), "wood", turn=BOAT_TURN)
        mx, mz = along(0.03)
        p.append(cylinder(0.014, 0.62, (mx, SEA + 0.4, mz), "wood", sides=4, bevel=0))
        sx, sz = along(-0.05, 0.0)
        p.append(box((0.26, 0.38, 0.012), (sx, SEA + 0.42, sz), "cream", bevel=0, turn=-BOAT_TURN))
        return p + moorings(deck)
    if era == "workshop":
        p = landing("stone_dark") + pier(PIER, 0.26, deck, "stone_dark", piles="stone", step=0.3, pile_r=0.045)
        p += bollards(deck, "dark")
        p += hull(0.72, 0.28, 0.2, (BOAT[0], SEA, BOAT[1]), "navy", turn=BOAT_TURN)
        wx, wz = along(-0.1)
        p.append(box((0.16, 0.15, 0.16), (wx, SEA + 0.22, wz), "plank", bevel=0.008, turn=-BOAT_TURN))
        return p + moorings(deck)
    if era == "industry":
        p = landing("stone_dark") + pier(PIER, 0.26, deck, "steel", piles="steel", step=0.3, pile_r=0.035)
        p += bollards(deck, "dark")
        p += hull(0.8, 0.28, 0.2, (BOAT[0], SEA, BOAT[1]), "navy", turn=BOAT_TURN)
        hx, hz = along(-0.08)
        p.append(box((0.28, 0.13, 0.17), (hx, SEA + 0.2, hz), "white", bevel=0.008, turn=-BOAT_TURN))
        fx, fz = along(0.03)
        p.append(cylinder(0.045, 0.2, (fx, SEA + 0.34, fz), "dark", sides=8, bevel=0))
        p.append(cylinder(0.047, 0.04, (fx, SEA + 0.39, fz), "gold", sides=8, bevel=0))
        return p + moorings(deck)
    if era == "electricity":
        p = landing("concrete") + pier(PIER, 0.26, deck, "concrete", piles="steel", step=0.3, pile_r=0.035)
        p += bollards(deck, "dark")
        for x, z in (PIER[1], ARM_MID):
            p.append(cylinder(0.012, 0.3, (x, deck + 0.15, z), "navy", sides=4, bevel=0))
            p.append(sphere(0.03, (x, deck + 0.32, z), "gold", subdivisions=1))
        p += hull(0.75, 0.26, 0.18, (BOAT[0], SEA, BOAT[1]), "white", turn=BOAT_TURN)
        cx, cz = along(-0.05)
        p.append(box((0.24, 0.12, 0.16), (cx, SEA + 0.18, cz), "navy", bevel=0.01, turn=-BOAT_TURN))
        return p + moorings(deck)
    p = landing("concrete") + pier(PIER, 0.28, deck, "concrete", piles="concrete", step=0.35, pile_r=0.045)
    p += bollards(deck, "dark")
    for x, z in (PIER[1], ARM_MID):
        p.append(cylinder(0.012, 0.3, (x, deck + 0.15, z), "steel", sides=4, bevel=0))
        p.append(sphere(0.03, (x, deck + 0.32, z), "gold", subdivisions=1))
    p += hull(0.85, 0.28, 0.2, (BOAT[0], SEA, BOAT[1]), "white", turn=BOAT_TURN)
    gx, gz = along(-0.06)
    p.append(box((0.28, 0.13, 0.18), (gx, SEA + 0.2, gz), "glass", bevel=0.01, turn=-BOAT_TURN))
    sx, sz = along(0.0, -0.145)
    p.append(box((0.78, 0.025, 0.006), (sx, SEA + 0.04, sz), "gold" if s >= 30 else "navy", bevel=0, turn=-BOAT_TURN))
    return p + moorings(deck)


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
