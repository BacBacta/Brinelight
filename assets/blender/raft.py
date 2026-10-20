"""
The floating village (week 8, meeting 3): the rafts, their walkways, the raft the shipyard builds and the free slot, in
the Lighthouse's age. The village was always built by hand from what the sea brings, so it ages in three steps, not six:

- Driftwood (Lighthouse 1–9): mismatched driftwood planks on barrel floats, rope lashings, a cream sail;
- Tarred (10–19): tarred planks on drums, iron corner plates, a lantern;
- Steel (20–30): planks in a frame of light steel, steel pontoons, a lamp on a post that the game lights, a small solar
  panel. The age reads by its colors and its light, not its shapes (owner, meeting 3): the deck stays of planks.

Each age has three decks that tell neighbors apart at a glance (A: a short mast and its furled sail; B: nets drying on two
poles and a crate; C: planters of kelp and herbs, two lanterns), a damaged deck (planks torn up and a dark hole at its
front corner, a float gone), the raft the shipyard builds (half its deck laid, scaffolding, a stack of planks) and a
walkway, and the mooring of a raft of ring 3, too close to the shore for a walkway: a rope to a stake on the beach. The
free slot's buoys are the same in every age.

The rafts are drawn in the game's units: a slot's hexagon has its flat sides at 1 from its center (±x), its corners
toward the camera and away (±z); a raft fills its room, the hexagon shrunk to 0.82 (client/src/scene/coast.ts,
RAFT_FILL). Their floats' bottom is at y = 0, the sea at 0.2 and the deck's top at DECK. Only the corners carry things:
the middles of the six sides are where the walkways land, and the deck's middle is where a building stands.
"""
import math

from kit import band, box, cone, crate, cylinder, ring, rod, rope_coil, sphere

A = 0.8  # the deck's flat-to-center distance (inside the room's 0.82)
R = A / math.cos(math.pi / 6)  # its center-to-corner distance
DECK = 0.37
SEA = 0.2

AGES = (1, 10, 20)
LOOK = {
    1: {"planks": ("drift_light", "drift", "drift_grey", "sand", "drift", "drift_light", "drift_grey"), "beam": "wood", "float": "wood", "hoop": "navy", "rim": "wood", "post": "wood", "rope": "plank"},
    10: {"planks": ("drift", "tar_light", "drift_grey", "drift", "drift_light", "tar_light", "drift"), "beam": "dark", "float": "navy", "hoop": "steel", "rim": "dark", "post": "wood", "rope": "plank"},
    20: {"planks": ("drift_light", "drift", "drift_grey", "drift_light", "drift", "drift_grey", "drift_light"), "beam": "steel", "float": "steel", "hoop": "steel", "rim": "steel", "post": "steel", "rope": "navy"},
}
# Making the light version of a deck, shown in the normal view (meeting 4, owner): fewer sides, no hoops, no beams under
# the planks, the same look from afar. The full deck shows in the close view.
_LITE = [False]


def lite():
    return _LITE[0]


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
            n = 6 if lite() else 10
            out.append(cylinder(0.12, length, (0, 0.13, z), "steel", sides=n, bevel=0, tilt=(0, math.radians(90))))
            for s in (-1, 1):
                out.append(cylinder(0.12, 0.08, (s * (length / 2 + 0.04), 0.13, z), "steel", sides=n, bevel=0, top=0.06, tilt=(0, math.radians(90 * s))))
        return out
    for z, xs in ((-0.44, (-0.24, 0.24)), (0.0, (-0.48, 0.0, 0.48)), (0.44, (-0.24, 0.24))):
        for x in xs:
            if skip_front and z > 0.3 and x > 0:
                continue
            out.append(cylinder(0.13, 0.34, (x, 0.14, z), look["float"], sides=6 if lite() else 8, bevel=0, tilt=(0, math.radians(90))))
            if not lite():
                out.append(cylinder(0.136, 0.03, (x, 0.14, z), look["hoop"], sides=8, bevel=0, tilt=(0, math.radians(90))))
    return out


def deck(age, keep=lambda z, x0, x1: [(x0, x1)]):
    """The beams along z under the planks, and the planks across, each as long as the deck at its z (`keep` may cut it)."""
    look = LOOK[age]
    out = []
    for x in () if lite() else (-0.44, 0.0, 0.44):
        out.append(box((0.08, 0.05, 2 * (R - abs(x) * math.tan(math.pi / 6)) - 0.16), (x, 0.29, 0), look["beam"], bevel=0))
    for z, w, k in plank_rows():
        h = half_width(abs(z) + w / 2) - 0.03
        # Driftwood planks of uneven lengths; laid planks are cut square.
        h0, h1 = (-h + 0.04 * (k % 3), h - 0.03 * ((k + 1) % 2)) if age == 1 else (-h, h)
        for x0, x1 in keep(z, h0, h1):
            turn = (0.014, -0.01, 0.0, 0.018)[k % 4] if age == 1 else 0.0
            # Planks of varied tones, in no repeating order (the style pass).
            tone = look["planks"][(k * 5 + 2 * (k // 3)) % len(look["planks"])]
            out.append(box((x1 - x0, 0.05, w), ((x0 + x1) / 2, DECK - 0.025 - 0.006 * (k % 2), z), tone, bevel=0, turn=turn))
    # The rim along the six sides: a light steel frame flush with the planks in the steel age, a rail before.
    corners = [(R * math.cos(math.radians(90 + 60 * i)), R * math.sin(math.radians(90 + 60 * i))) for i in range(6)]
    if age == 20:
        for i in range(6):
            a = math.radians(60 * i)
            out.append(box((0.07, 0.05, R), (0.765 * math.cos(a), DECK - 0.013, 0.765 * math.sin(a)), "steel_light", bevel=0, turn=-a))
    else:
        for (ax, az), (bx, bz) in zip(corners, corners[1:] + corners[:1]):
            out.append(rod((ax * 0.97, DECK - 0.01, az * 0.97), (bx * 0.97, DECK - 0.01, bz * 0.97), 0.02, look["rim"], 4))
    if age == 10:
        # Iron plates at the corners the camera sees.
        for ax, az in [c for c in corners if c[1] > -0.1]:
            out.append(box((0.1, 0.012, 0.1), (ax * 0.86, DECK + 0.004, az * 0.86), "steel", bevel=0, turn=math.atan2(az, ax)))
    return out


# The lamps of the model being made, where the game lights them (extra_meta).
_lamps = []


def lamp(x, z, age, h=0.42):
    """A lamp on a post: a lantern on wood; on steel, a lamp under a cap, which the game lights."""
    if age == 20:
        _lamps.append([round(x, 3), round(DECK + h + 0.02, 3), round(z, 3)])
        return [
            cylinder(0.014, h, (x, DECK + h / 2, z), "steel_light", sides=4 if lite() else 5, bevel=0),
            sphere(0.045, (x, DECK + h + 0.02, z), "gold", subdivisions=1),
            cylinder(0.06, 0.016, (x, DECK + h + 0.072, z), "steel_light", sides=4 if lite() else 6, bevel=0, top=0.03),
        ]
    return [cylinder(0.016, h, (x, DECK + h / 2, z), "wood", sides=5, bevel=0), box((0.07, 0.09, 0.07), (x, DECK + h - 0.02, z), "gold", bevel=0), box((0.09, 0.016, 0.09), (x, DECK + h + 0.035, z), "navy", bevel=0)]


def variant_a(age):
    # A short mast at the back corner, its sail open to the wind (it reads from the normal view), a coil of rope.
    look = LOOK[age]
    x, z = BACK
    p = [cylinder(0.024, 0.86, (x, DECK + 0.43, z), look["post"], sides=6, bevel=0)]
    p.append(rod((x - 0.26, DECK + 0.22, z + 0.06), (x + 0.26, DECK + 0.22, z + 0.06), 0.014, look["post"], 5))
    # The sail: a cream square between the boom and the mast's top, a little bellied (two panels).
    for side in (-1, 1):
        p.append(box((0.25, 0.56, 0.012), (x + side * 0.125, DECK + 0.52, z + 0.07 + 0.012), "cream", bevel=0, turn=side * 0.12))
    p.append(cone(0.03, 0.06, (x, DECK + 0.86, z), "gold" if age == 20 else look["post"], sides=6))
    p += [rope_coil((BACK_RIGHT[0], DECK, BACK_RIGHT[1]), radius=0.07, color=look["rope"], sides=5 if lite() else 8)]
    if age >= 10:
        p += lamp(*BACK_LEFT, age)
    return p


def variant_b(age):
    # Nets drying on three poles across the back, a crate in the corner.
    look = LOOK[age]
    p = []
    poles = (BACK_LEFT, BACK, BACK_RIGHT)
    for x, z in poles:
        p.append(cylinder(0.018, 0.5, (x, DECK + 0.25, z), look["post"], sides=4 if lite() else 5, bevel=0))
    for a, b in zip(poles, poles[1:]):
        turn = math.atan2(b[1] - a[1], b[0] - a[0])
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        p.append(rod((a[0], DECK + 0.47, a[1]), (b[0], DECK + 0.47, b[1]), 0.006, look["rope"], 3))
        p.append(box((length * 0.92, 0.34, 0.014), ((a[0] + b[0]) / 2, DECK + 0.29, (a[1] + b[1]) / 2), "net", bevel=0, turn=-turn))
        p.append(sphere(0.024, ((a[0] + b[0]) / 2, DECK + 0.46, (a[1] + b[1]) / 2), "gold" if age == 1 else "cream", subdivisions=1))
    # Beside the deck's middle (a building's), clear of the walkways' landings.
    if lite():
        p.append(box((0.15, 0.15, 0.15), (0.52, DECK + 0.075, -0.17), "drift", bevel=0, turn=0.3))
    else:
        p += crate((0.52, DECK, -0.17), size=0.15, color="drift" if age < 20 else "navy", turn=0.3)
    if age >= 10:
        p += lamp(-0.56, -0.17, age, h=0.36)
    return p


def planter(x, z, age, tall=False, size=(0.26, 0.18)):
    """A box of earth with kelp and herbs: green tufts that read from the normal view."""
    w, d = size
    out = [box((w, 0.1, d), (x, DECK + 0.05, z), "wood" if age < 20 else "steel", bevel=0)]
    step = w * 0.3
    for k in (0, 2) if lite() else range(3):
        out.append(cone(min(0.07, w * 0.27) if k != 1 else min(0.06, w * 0.23), 0.2 + (0.12 if tall else 0) + 0.04 * (k % 2), (x - step + step * k, DECK + 0.1, z), "leaf" if k != 1 else "meadow_dark", sides=5))
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


def variant_d(age):
    # A deck garden (owner, after the style pass): planters across the back, a small tree in a tub and a water barrel
    # at the back corners; the deck's middle stays free for a building.
    # Small planters, behind the middle and clear of the back walkways' landings.
    small = (0.18, 0.14)
    p = planter(-0.17, -0.5, age, size=small) + planter(0.0, -0.68, age, tall=True, size=small) + planter(0.17, -0.5, age, size=small)
    tx, tz = BACK_LEFT
    p.append(cylinder(0.09, 0.12, (tx, DECK + 0.06, tz), "wood" if age < 20 else "steel", sides=6, bevel=0))
    p.append(cylinder(0.018, 0.22, (tx, DECK + 0.23, tz), "wood", sides=4, bevel=0))
    p.append(sphere(0.13, (tx, DECK + 0.42, tz), "leaf", subdivisions=1, squash=0.85))
    p.append(cylinder(0.08, 0.18, (BACK_RIGHT[0], DECK + 0.09, BACK_RIGHT[1]), "tar_light" if age < 20 else "steel", sides=6 if lite() else 8, bevel=0))
    if age >= 10:
        p += lamp(0.6, -0.14, age, h=0.36)
    return p


def raft(age, variant):
    return floats(age) + deck(age) + {"a": variant_a, "b": variant_b, "c": variant_c, "d": variant_d}[variant](age)


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
    p.append(box((0.4, 0.04, 0.1), (hx - 0.16, DECK + 0.1, hz - 0.07), LOOK[age]["planks"][0], bevel=0.005, tilt=(0, math.radians(-38)), turn=0.12))
    p.append(box((0.34, 0.04, 0.09), (hx + 0.16, DECK + 0.08, hz - 0.06), LOOK[age]["planks"][1], bevel=0.005, tilt=(0, math.radians(32)), turn=-0.14))
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
    """
    A walkway of length 1 along z, its middle at the origin, its deck's top at y = 0: the game stretches it. Light (the
    style pass's budget): six planks, two rope rails on four thin posts.
    """
    look = LOOK[age]
    p = []
    for k in range(6):
        z = -0.43 + k * (0.86 / 5)
        p.append(box((0.28, 0.03, 0.1), (0.006 * (k % 2) if age == 1 else 0, -0.015, z), look["planks"][k % len(look["planks"])] if age < 20 else "steel", bevel=0))
    for x in (-0.15, 0.15):
        p.append(box((0.02, 0.02, 1.0), (x, 0.12, 0), look["rope"] if age < 20 else "navy", bevel=0))
        for z in (-0.47, 0.47):
            p.append(cylinder(0.016, 0.15, (x, 0.06, z), look["post"], sides=3, bevel=0))
    return p


# A raft of ring 3 lies 0.08 off the shore across its side facing the island (island.py: LAND; client/src/scene/coast.ts:
# RAFT_FILL): its mooring's stake stands on the beach MOOR_STAKE from the raft's center, its rope ends on the deck's rim.
MOOR_STAKE = 1.0
# The city's sea stands this much higher with the island after the style pass (client: cityLook.ts, SEA_RISE), the
# rafts with it: their bottom 0.42 under the meadow, not 0.62.
SEA_RISE = 0.2


def mooring(age):
    """A stake on the beach at the origin (y = 0 the meadow) and its rope down to a raft's deck rim, toward +z."""
    look = LOOK[age]
    end_z, end_y = MOOR_STAKE - A + 0.03, -(0.62 - SEA_RISE - DECK) + 0.02
    if age == 20:
        # A bollard of light steel.
        p = [cylinder(0.05, 0.16, (0, 0.08, 0), "steel_light", sides=6, bevel=0), cylinder(0.065, 0.025, (0, 0.17, 0), "steel_light", sides=6, bevel=0)]
        top = 0.12
    else:
        p = [cylinder(0.04, 0.26, (0, 0.13, 0), look["post"] if age == 1 else "dark", sides=6, bevel=0, top=0.034)]
        if age == 10:
            p.append(band(0.042, 0.03, (0, 0.2, 0), "steel", sides=6))
        top = 0.16
    p.append(ring(0.04 if age < 20 else 0.05, 0.014, 0.03, (0, top, 0), look["rope"], sides=5))
    # The rope sags a little between the stake and the cleat on the rim.
    a, b = (0.0, top, 0.03), (0.0, end_y + 0.02, end_z)
    mid = (0.0, (a[1] + b[1]) / 2 - 0.03, (a[2] + b[2]) / 2 + 0.02)
    p.append(rod(a, mid, 0.011, look["rope"], 4))
    p.append(rod(mid, b, 0.011, look["rope"], 4))
    p.append(box((0.08, 0.025, 0.03), (0.0, end_y, end_z), "steel_light" if age == 20 else "dark", bevel=0))
    return p


def free():
    """
    The free slot: small buoys at the room's corners, a thin rope between them just under the water (y = 0 is the
    sea), the color of the shallows' floor: from the city's height, no grid reads on the water (style pass, owner).
    """
    p = []
    corners = [(R * math.cos(math.radians(90 + 60 * i)), R * math.sin(math.radians(90 + 60 * i))) for i in range(6)]
    for x, z in corners:
        p.append(cylinder(0.036, 0.08, (x * 0.96, 0.02, z * 0.96), "white", sides=6, bevel=0))
        p.append(cone(0.036, 0.06, (x * 0.96, 0.06, z * 0.96), "navy", sides=6))
    for (ax, az), (bx, bz) in zip(corners, corners[1:] + corners[:1]):
        p.append(rod((ax * 0.96, 0.0, az * 0.96), (bx * 0.96, 0.0, bz * 0.96), 0.003, "seabed", 3))
    return p


EXTRAS = {"raft-free": free}
for _age in AGES:
    for _v in "abcd":
        EXTRAS[f"raft-{_v}-age{_age}"] = (lambda a, v: lambda: raft(a, v))(_age, _v)
    EXTRAS[f"raft-damaged-age{_age}"] = (lambda a: lambda: damaged(a))(_age)
    for _v in ("a", "b", "c", "d", "damaged"):
        EXTRAS[f"raft-{_v}-age{_age}-lite"] = (lambda a, v: lambda: _lite_of(a, v))(_age, _v)
    EXTRAS[f"raft-yard-age{_age}"] = (lambda a: lambda: yard(a))(_age)
    EXTRAS[f"raft-walk-age{_age}"] = (lambda a: lambda: walkway(a))(_age)
    EXTRAS[f"raft-moor-age{_age}"] = (lambda a: lambda: mooring(a))(_age)


def _lite_of(age, variant):
    _LITE[0] = True
    try:
        return damaged(age) if variant == "damaged" else raft(age, variant)
    finally:
        _LITE[0] = False


def extra_meta(name):
    """The sidecar of a model just made: where its lamps are lit, if it has any."""
    lamps = list(_lamps)
    _lamps.clear()
    return {"lamps": lamps} if lamps else None
