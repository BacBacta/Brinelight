"""
The floating village (week 8, meeting 3): the rafts, their walkways, the raft the shipyard builds and the free slot, in
the Lighthouse's age. The village was always built by hand from what the sea brings, so it ages in three steps, not six:

- Driftwood (Lighthouse 1–9): mismatched driftwood planks on barrel floats, rope lashings, a cream sail;
- Tarred (10–19): tarred planks on drums, iron corner plates, a lantern;
- Steel (20–30): planks on a steel frame and steel pontoons, a lamp on a post and a small solar panel.

Each age has three decks that tell neighbors apart at a glance (A: a short mast and its furled sail; B: nets drying on two
poles and a crate; C: planters of kelp and herbs, two lanterns), a damaged deck (planks torn up and a dark hole at its
front corner, a float gone), the raft the shipyard builds (half its deck laid, scaffolding, a stack of planks) and a
walkway. The free slot's buoys are the same in every age.

The rafts are drawn in the game's units: a slot's hexagon has its flat sides at 1 from its center (±x), its corners
toward the camera and away (±z); a raft fills its room, the hexagon shrunk to 0.82 (client/src/scene/coast.ts,
RAFT_FILL). Their floats' bottom is at y = 0, the sea at 0.2 and the deck's top at DECK. Only the corners carry things:
the middles of the six sides are where the walkways land, and the deck's middle is where a building stands.
"""
import math

from kit import box, cone, crate, cylinder, rod, rope_coil, sphere

A = 0.8  # the deck's flat-to-center distance (inside the room's 0.82)
R = A / math.cos(math.pi / 6)  # its center-to-corner distance
DECK = 0.37
SEA = 0.2

AGES = (1, 10, 20)
LOOK = {
    1: {"planks": ("plank", "wood", "plank", "sand"), "beam": "wood", "float": "wood", "hoop": "navy", "rim": "wood", "post": "wood", "rope": "plank"},
    10: {"planks": ("wood", "plank", "wood", "wood"), "beam": "dark", "float": "navy", "hoop": "steel", "rim": "dark", "post": "wood", "rope": "plank"},
    20: {"planks": ("plank", "wood", "plank", "wood"), "beam": "steel", "float": "steel", "hoop": "steel", "rim": "steel", "post": "steel", "rope": "navy"},
}
# The corners that carry things: the back one, and the two beside it (the front is where the camera looks).
BACK = (0.0, -0.66)
BACK_LEFT = (-0.56, -0.33)
BACK_RIGHT = (0.56, -0.33)


def half_width(z):
    """How far the deck reaches toward ±x at z."""
    return A if abs(z) <= R / 2 else A * (R - abs(z)) / (R / 2)


def plank_rows():
    rows, z, k = [], -R + 0.08, 0
    while z < R - 0.07:
        w = (0.1, 0.13, 0.09, 0.12)[k % 4]
        rows.append((z + w / 2, w * 0.92, k))
        z += w
        k += 1
    return rows


def floats(age, skip_front=False):
    look = LOOK[age]
    out = []
    if age == 20:
        # Steel pontoons across the raft, capped.
        for z, length in ((-0.42, 0.9), (0.0, 1.3), (0.42, 0.9)):
            if skip_front and z > 0.3:
                continue
            out.append(cylinder(0.12, length, (0, 0.13, z), "steel", sides=10, bevel=0, tilt=(0, math.radians(90))))
            for s in (-1, 1):
                out.append(cylinder(0.12, 0.08, (s * (length / 2 + 0.04), 0.13, z), "steel", sides=10, bevel=0, top=0.06, tilt=(0, math.radians(90 * s))))
        return out
    for z, xs in ((-0.44, (-0.24, 0.24)), (0.0, (-0.48, 0.0, 0.48)), (0.44, (-0.24, 0.24))):
        for x in xs:
            if skip_front and z > 0.3 and x > 0:
                continue
            out.append(cylinder(0.13, 0.34, (x, 0.14, z), look["float"], sides=8, bevel=0, tilt=(0, math.radians(90))))
            out.append(cylinder(0.136, 0.03, (x, 0.14, z), look["hoop"], sides=8, bevel=0, tilt=(0, math.radians(90))))
    return out


def deck(age, keep=lambda z, x0, x1: [(x0, x1)]):
    """The beams along z under the planks, and the planks across, each as long as the deck at its z (`keep` may cut it)."""
    look = LOOK[age]
    out = []
    for x in (-0.44, 0.0, 0.44):
        out.append(box((0.08, 0.05, 2 * (R - abs(x) * math.tan(math.pi / 6)) - 0.16), (x, 0.29, 0), look["beam"], bevel=0))
    for z, w, k in plank_rows():
        h = half_width(abs(z) + w / 2) - 0.03
        # Driftwood planks of uneven lengths; laid planks are cut square.
        h0, h1 = (-h + 0.04 * (k % 3), h - 0.03 * ((k + 1) % 2)) if age == 1 else (-h, h)
        for x0, x1 in keep(z, h0, h1):
            turn = (0.014, -0.01, 0.0, 0.018)[k % 4] if age == 1 else 0.0
            out.append(box((x1 - x0, 0.05, w), ((x0 + x1) / 2, DECK - 0.025 - 0.006 * (k % 2), z), look["planks"][k % 4], bevel=0, turn=turn))
    # The rim along the six sides.
    corners = [(R * math.cos(math.radians(90 + 60 * i)), R * math.sin(math.radians(90 + 60 * i))) for i in range(6)]
    for (ax, az), (bx, bz) in zip(corners, corners[1:] + corners[:1]):
        out.append(rod((ax * 0.97, DECK - 0.01, az * 0.97), (bx * 0.97, DECK - 0.01, bz * 0.97), 0.02, look["rim"], 4))
    if age == 10:
        # Iron plates at the corners the camera sees.
        for ax, az in [c for c in corners if c[1] > -0.1]:
            out.append(box((0.1, 0.012, 0.1), (ax * 0.86, DECK + 0.004, az * 0.86), "steel", bevel=0, turn=math.atan2(az, ax)))
    return out


def lamp(x, z, age, h=0.42):
    """A lamp on a post: a lantern on wood, a lamp on steel."""
    if age == 20:
        return [cylinder(0.014, h, (x, DECK + h / 2, z), "steel", sides=5, bevel=0), sphere(0.035, (x, DECK + h + 0.02, z), "gold", subdivisions=1)]
    return [cylinder(0.016, h, (x, DECK + h / 2, z), "wood", sides=5, bevel=0), box((0.07, 0.09, 0.07), (x, DECK + h - 0.02, z), "gold", bevel=0), box((0.09, 0.016, 0.09), (x, DECK + h + 0.035, z), "navy", bevel=0)]


def variant_a(age):
    # A short mast at the back corner, its boom and its furled sail.
    look = LOOK[age]
    x, z = BACK
    p = [cylinder(0.024, 0.78, (x, DECK + 0.39, z), look["post"], sides=6, bevel=0)]
    p.append(rod((x - 0.34, DECK + 0.3, z + 0.08), (x + 0.34, DECK + 0.3, z + 0.08), 0.014, look["post"], 5))
    p.append(cylinder(0.045, 0.6, (x, DECK + 0.34, z + 0.08), "cream", sides=8, bevel=0, tilt=(0, math.radians(90))))
    for dx in (-0.18, 0.0, 0.18):
        p.append(cylinder(0.05, 0.016, (x + dx, DECK + 0.34, z + 0.08), look["rope"], sides=8, bevel=0, tilt=(0, math.radians(90))))
    p.append(rod((x, DECK + 0.76, z), (x + 0.34, DECK + 0.32, z + 0.08), 0.004, look["rope"], 3))
    p.append(cone(0.03, 0.06, (x, DECK + 0.78, z), "gold" if age == 20 else look["post"], sides=6))
    p += [rope_coil((BACK_RIGHT[0], DECK, BACK_RIGHT[1]), radius=0.07, color=look["rope"])]
    if age >= 10:
        p += lamp(*BACK_LEFT, age)
    return p


def variant_b(age):
    # Nets drying on two poles at the back, a crate in the corner.
    look = LOOK[age]
    p = []
    a, b = BACK_LEFT, BACK
    for x, z in (a, b):
        p.append(cylinder(0.018, 0.5, (x, DECK + 0.25, z), look["post"], sides=5, bevel=0))
    p.append(rod((a[0], DECK + 0.47, a[1]), (b[0], DECK + 0.47, b[1]), 0.006, look["rope"], 3))
    turn = math.atan2(b[1] - a[1], b[0] - a[0])
    length = math.hypot(b[0] - a[0], b[1] - a[1])
    p.append(box((length * 0.9, 0.3, 0.012), ((a[0] + b[0]) / 2, DECK + 0.3, (a[1] + b[1]) / 2), "navy", bevel=0, turn=-turn))
    for t in (0.2, 0.4, 0.6, 0.8):
        p.append(sphere(0.022, (a[0] + (b[0] - a[0]) * t, DECK + 0.46, a[1] + (b[1] - a[1]) * t), "gold" if age == 1 else "cream", subdivisions=1))
    p += crate((BACK_RIGHT[0], DECK, BACK_RIGHT[1]), size=0.15, color="plank" if age < 20 else "navy", turn=0.3)
    if age >= 10:
        p += lamp(BACK_RIGHT[0] - 0.05, BACK_RIGHT[1] - 0.14, age, h=0.36)
    return p


def planter(x, z, age):
    out = [box((0.24, 0.1, 0.16), (x, DECK + 0.05, z), "wood" if age < 20 else "steel", bevel=0)]
    for k in range(3):
        out.append(box((0.024, 0.16 + 0.03 * (k % 2), 0.024), (x - 0.07 + 0.07 * k, DECK + 0.16, z), "copper" if k % 2 else "meadow_dark", bevel=0, tilt=(0.15 * (k - 1), 0)))
    return out


def variant_c(age):
    # Planters of kelp and herbs at the back corners, two lanterns.
    p = planter(*BACK_LEFT, age) + planter(*BACK_RIGHT, age)
    p += planter(BACK[0], BACK[1] + 0.02, age)
    p += lamp(BACK[0] - 0.2, BACK[1] + 0.06, age, h=0.4) + lamp(BACK[0] + 0.2, BACK[1] + 0.06, age, h=0.4)
    if age == 20:
        p.append(box((0.22, 0.015, 0.16), (BACK_LEFT[0] + 0.02, DECK + 0.32, BACK_LEFT[1] - 0.02), "solar", bevel=0, tilt=(math.radians(-20), 0)))
        p.append(box((0.016, 0.22, 0.016), (BACK_LEFT[0] + 0.02, DECK + 0.2, BACK_LEFT[1] - 0.08), "steel", bevel=0))
    return p


def raft(age, variant):
    return floats(age) + deck(age) + {"a": variant_a, "b": variant_b, "c": variant_c}[variant](age)


# The damage at the front corner, kept free of everything a raft carries.
HOLE = (0.0, 0.62)


def damaged(age):
    hx, hz = HOLE

    def keep(z, x0, x1):
        # The planks over the hole are torn out.
        if z > hz - 0.16:
            return [(x0, x1)] if x1 < hx - 0.26 or x0 > hx + 0.26 else [s for s in ((x0, hx - 0.26), (hx + 0.26, x1)) if s[1] - s[0] > 0.06]
        return [(x0, x1)]

    p = floats(age, skip_front=True) + deck(age, keep)
    p.append(box((0.5, 0.03, 0.3), (hx, DECK - 0.16, hz), "dark", bevel=0))
    # Two broken planks standing up at the hole's edge, a third adrift.
    p.append(box((0.4, 0.04, 0.1), (hx - 0.16, DECK + 0.1, hz - 0.1), LOOK[age]["planks"][0], bevel=0.005, tilt=(0, math.radians(-38)), turn=0.3))
    p.append(box((0.34, 0.04, 0.09), (hx + 0.16, DECK + 0.08, hz - 0.08), LOOK[age]["planks"][1], bevel=0.005, tilt=(0, math.radians(32)), turn=-0.35))
    p.append(box((0.36, 0.03, 0.09), (hx + 0.08, SEA + 0.01, hz + 0.14), LOOK[age]["planks"][2], bevel=0, turn=0.5))
    return p


def yard(age):
    """The raft the shipyard builds: its floats and beams, the back half of its deck, scaffolding, the planks to lay."""
    look = LOOK[age]
    p = floats(age) + deck(age, lambda z, x0, x1: [(x0, x1)] if z < 0.02 else [])
    for x, z in ((-0.5, -0.3), (0.5, -0.3), (-0.5, 0.3), (0.5, 0.3)):
        p.append(cylinder(0.02, 0.72, (x, DECK + 0.32, z), look["post"], sides=5, bevel=0))
    for z in (-0.3, 0.3):
        p.append(rod((-0.5, DECK + 0.62, z), (0.5, DECK + 0.62, z), 0.014, look["post"], 5))
    for x in (-0.5, 0.5):
        p.append(rod((x, DECK + 0.62, -0.3), (x, DECK + 0.62, 0.3), 0.014, look["post"], 5))
    p.append(rod((-0.5, DECK + 0.05, 0.3), (0.5, DECK + 0.6, 0.3), 0.01, look["rope"], 4))
    # The stack of new planks and a coil of rope on what is laid.
    for i in range(4):
        p.append(box((0.5, 0.035, 0.09), (-0.12, DECK + 0.02 + 0.036 * i, -0.36 + 0.004 * i), look["planks"][i % 4], bevel=0.004, turn=0.04 * (i % 2)))
    p.append(rope_coil((0.38, DECK, -0.44), radius=0.06, color=look["rope"]))
    return p


def walkway(age):
    """A walkway of length 1 along z, its middle at the origin, its deck's top at y = 0: the game stretches it."""
    look = LOOK[age]
    p = []
    for k in range(8):
        z = -0.44 + k * (0.88 / 7)
        p.append(box((0.28, 0.03, 0.07), (0.006 * (k % 2) if age == 1 else 0, -0.015, z), look["planks"][k % 4] if age < 20 else "steel", bevel=0))
    for x in (-0.15, 0.15):
        p.append(box((0.02, 0.02, 1.0), (x, 0.12, 0), look["rope"] if age < 20 else "navy", bevel=0))
        for z in (-0.47, 0.47):
            p.append(box((0.03, 0.15, 0.03), (x, 0.06, z), look["post"], bevel=0))
    return p


def free():
    """The free slot: buoys at the room's corners, a rope between them on the water (y = 0 is the sea)."""
    p = []
    corners = [(R * math.cos(math.radians(90 + 60 * i)), R * math.sin(math.radians(90 + 60 * i))) for i in range(6)]
    for x, z in corners:
        p.append(cylinder(0.05, 0.1, (x * 0.96, 0.02, z * 0.96), "white", sides=8, bevel=0))
        p.append(cone(0.05, 0.08, (x * 0.96, 0.07, z * 0.96), "navy", sides=8))
    for (ax, az), (bx, bz) in zip(corners, corners[1:] + corners[:1]):
        p.append(rod((ax * 0.96, 0.03, az * 0.96), (bx * 0.96, 0.03, bz * 0.96), 0.008, "plank", 4))
    return p


EXTRAS = {"raft-free": free}
for _age in AGES:
    for _v in "abc":
        EXTRAS[f"raft-{_v}-age{_age}"] = (lambda a, v: lambda: raft(a, v))(_age, _v)
    EXTRAS[f"raft-damaged-age{_age}"] = (lambda a: lambda: damaged(a))(_age)
    EXTRAS[f"raft-yard-age{_age}"] = (lambda a: lambda: yard(a))(_age)
    EXTRAS[f"raft-walk-age{_age}"] = (lambda a: lambda: walkway(a))(_age)
