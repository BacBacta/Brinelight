"""
The Barracks (art direction: a low palisade, a training dummy, a navy banner) in their six eras (docs/tasks/week-8.md,
"The eras"), each a different place to train, and a detail at every other level within its era:

- Salvage (1–4): a driftwood palisade, a tarp shelter, a training dummy, the navy banner on a pole;
- Colony (5–9): a plank hall on a stone base, a palisade with a gate, a wooden lookout;
- Workshop (10–14): a brick drill hall, a crenellated brick tower, the yard in front;
- Industry (15–19): a riveted steel armory (a half barrel), a steel watchtower with a searchlight;
- Electricity (20–24): a hall of steel and glass, floodlights over the yard;
- Modern (25–30): a low concrete-and-glass base, an antenna, a landing pad (no aircraft); at 30, a gold rim to the pad.

It stands beside the Lighthouse on the left, in front of the Observatory's right side: it stays low enough to keep it in
sight (client/test/visible.test.ts). The navy banner flies in every era.
"""
import math

from kit import band, barrel, box, cone, crate, cylinder, drum, prism_roof, ring, rod, rope_coil, sack, sphere  # noqa: F401
from parts import FLOOR, door, floor, half_barrel, house, palisade, roof_slope, window
from stages import era_of


def banner(x, z, foot, height=0.9, top="brass"):
    """The navy banner on its pole: the Barracks' sign in every era."""
    return [
        cylinder(0.02, height, (x, foot + height / 2, z), "wood", sides=6, bevel=0),
        box((0.03, 0.34, 0.2), (x + 0.1, foot + height - 0.2, z), "navy", bevel=0.005),
        sphere(0.03, (x, foot + height + 0.02, z), top, subdivisions=1),
    ]


def dummy(x, z, foot):
    """A training dummy: a post, a sack for a body, a crossbar for arms."""
    return [cylinder(0.02, 0.36, (x, foot + 0.18, z), "wood", sides=5, bevel=0), sack((x, foot + 0.16, z), size=0.13, color="cream"), box((0.24, 0.025, 0.025), (x, foot + 0.3, z), "wood", bevel=0)]


def salvage(s):
    p = palisade([(-0.62, 0.2), (-0.62, -0.42), (0.0, -0.58), (0.6, -0.42), (0.6, 0.2)], h=0.34)
    p.append(roof_slope((0.6, 0.03, 0.4), (-0.22, 0.34, -0.25), "tin", -16))
    for x, z in ((-0.5, -0.42), (0.06, -0.42), (-0.5, -0.08), (0.06, -0.08)):
        p.append(cylinder(0.02, 0.34 if z < -0.2 else 0.26, (x, (0.34 if z < -0.2 else 0.26) / 2, z), "wood", sides=5, bevel=0))
    p.append(box((0.3, 0.1, 0.2), (-0.22, 0.05, -0.25), "plank", bevel=0.01))
    p += dummy(0.25, 0.1, 0)
    p += dummy(0.0, 0.25, 0)
    p += banner(0.4, -0.3, 0, height=0.95)
    return p


def colony(s):
    p, f = floor("colony")
    p += house(-0.12, -0.22, 0.7, 0.42, 0.36, "plank", "wood", foot=f, roof_h=0.2, windows=((-0.2, 0.2), (0.2, 0.2)), door_at=0.0)
    p += palisade([(-0.64, 0.3), (-0.64, -0.45)], h=0.3, foot=f) + palisade([(0.64, -0.45), (0.64, 0.3)], h=0.3, foot=f)
    # The gate at the front: two posts and a beam.
    for x in (-0.22, 0.22):
        p.append(cylinder(0.03, 0.44, (x, f + 0.22, 0.44), "wood", sides=6, bevel=0))
    p.append(box((0.52, 0.05, 0.05), (0, f + 0.42, 0.44), "wood", bevel=0))
    # The lookout at the back right: four posts, a platform, a little roof.
    lx, lz = 0.44, -0.3
    for dx in (-0.1, 0.1):
        for dz in (-0.1, 0.1):
            p.append(cylinder(0.018, 0.9, (lx + dx, f + 0.45, lz + dz), "wood", sides=5, bevel=0))
    p.append(box((0.28, 0.04, 0.28), (lx, f + 0.86, lz), "plank", bevel=0.01))
    p.append(prism_roof(0.32, 0.32, 0.14, (lx, f + 1.06, lz), "wood"))
    for dx in (-0.12, 0.12):
        p.append(cylinder(0.012, 0.2, (lx + dx, f + 0.96, lz + 0.12), "wood", sides=4, bevel=0))
    p += banner(-0.5, -0.38, f, height=0.95)
    return p


def workshop(s):
    p, f = floor("workshop")
    p += house(0.12, -0.22, 0.86, 0.44, 0.5, "brick", "stone_dark", foot=f, roof_h=0.22, windows=((-0.28, 0.32), (0.0, 0.32), (0.28, 0.32)), door_at=-0.14)
    # The crenellated brick tower at the back left.
    tx, tz = -0.5, -0.3
    p.append(box((0.3, 1.05, 0.3), (tx, f + 0.525, tz), "brick", bevel=0.01))
    for dx, dz in ((-0.11, -0.11), (0.11, -0.11), (-0.11, 0.11), (0.11, 0.11)):
        p.append(box((0.08, 0.1, 0.08), (tx + dx, f + 1.1, tz + dz), "brick", bevel=0))
    p += window(tx, f + 0.75, tz + 0.15, w=0.06, h=0.14, color="dark", frame="stone")
    p += banner(tx, tz, f + 1.05, height=0.45)
    p.append(box((1.0, 0.03, 0.03), (0, f + 0.06, 0.32), "stone", bevel=0))
    return p


def industry(s):
    p, f = floor("industry")
    # The armory: a riveted steel half barrel lying across the plot, its end walls, a door in the front one.
    ax, az, r, length = 0.12, -0.2, 0.36, 0.8
    p.append(half_barrel(r, length, (ax, f, az), "steel", sides=14))
    for k in range(5):
        p.append(half_barrel(r + 0.008, 0.022, (ax - length / 2 + length * (k + 0.5) / 5, f, az), "stone_dark", sides=14))
    # Its entrance: a small steel porch on the front, a navy door.
    p.append(box((0.24, 0.28, 0.2), (ax, f + 0.14, az + r - 0.04), "steel", bevel=0.008))
    p += door(ax, f, az + r + 0.06, w=0.16, h=0.22, color="navy")
    # The watchtower at the back left: four steel legs, braces, a cabin, a searchlight.
    tx, tz, h = -0.5, -0.32, 1.2
    for dx in (-0.12, 0.12):
        for dz in (-0.12, 0.12):
            p.append(rod((tx + dx * 1.3, f, tz + dz * 1.3), (tx + dx, f + h, tz + dz), 0.02, "steel", 4))
    for y in (0.4, 0.8):
        p.append(band(0.17, 0.02, (tx, f + y, tz), "steel", sides=4))
    p.append(box((0.3, 0.22, 0.3), (tx, f + h + 0.11, tz), "steel", bevel=0.01))
    p.append(box((0.26, 0.08, 0.01), (tx, f + h + 0.13, tz + 0.152), "glass", bevel=0))
    p.append(box((0.34, 0.04, 0.34), (tx, f + h + 0.24, tz), "navy", bevel=0.005))
    p.append(cone(0.05, 0.12, (tx + 0.18, f + h + 0.2, tz + 0.1), "gold", sides=8))
    p += banner(0.55, -0.42, f, height=0.95)
    return p


def electricity(s):
    p, f = floor("electricity")
    # The hall of steel and glass: a glass front between steel columns, a flat steel roof.
    hx, hz, w, d, h = 0.1, -0.22, 0.92, 0.46, 0.56
    p.append(box((w, h, d), (hx, f + h / 2, hz), "glass", bevel=0.004))
    for x in (-w / 2, -w / 6, w / 6, w / 2):
        p.append(box((0.04, h, 0.04), (hx + x, f + h / 2, hz + d / 2), "steel", bevel=0))
    p.append(box((w + 0.08, 0.06, d + 0.08), (hx, f + h + 0.03, hz), "steel", bevel=0.01))
    p.append(box((w, 0.12, d), (hx, f + 0.06, hz), "brick", bevel=0.005))
    p += door(hx - 0.25, f + 0.12, hz + d / 2, w=0.16, h=0.26, color="navy")
    # Floodlights over the yard on two steel masts.
    for x in (-0.58, 0.62):
        p.append(cylinder(0.022, 1.0, (x, f + 0.5, 0.3), "steel", sides=6, bevel=0))
        p.append(box((0.14, 0.08, 0.06), (x, f + 1.0, 0.27), "navy", bevel=0.005))
        p.append(box((0.12, 0.06, 0.01), (x, f + 1.0, 0.305), "gold", bevel=0))
    p += banner(-0.5, -0.34, f, height=1.0)
    return p


def modern(s):
    p, f = floor("modern")
    # The base: low, concrete, a long band of glass; an antenna; on the yard, a landing pad (never an aircraft).
    bx, bz, w, d, h = 0.0, -0.3, 1.1, 0.42, 0.44
    p.append(box((w, h, d), (bx, f + h / 2, bz), "concrete", bevel=0.012))
    p.append(box((w - 0.1, 0.16, 0.02), (bx, f + 0.26, bz + d / 2 + 0.005), "glass", bevel=0.003))
    for k in range(1, 6):
        p.append(box((0.02, 0.16, 0.025), (bx - (w - 0.1) / 2 + (w - 0.1) * k / 6 + 0.02 * (k % 2), f + 0.26, bz + d / 2 + 0.012), "steel", bevel=0))
    p += door(0.36, f, bz + d / 2, w=0.16, h=0.22, color="navy")
    p.append(box((0.09, 0.07, 0.012), (-0.4, f + 0.1, bz + d / 2 + 0.008), "steel", bevel=0.002))
    p.append(cylinder(0.016, 0.9, (-0.42, f + h + 0.45, bz), "steel", sides=5, bevel=0))
    for y in (0.3, 0.55, 0.8):
        p.append(box((0.16 - y * 0.1, 0.012, 0.012), (-0.42, f + h + y, bz), "steel", bevel=0))
    p.append(sphere(0.035, (-0.42, f + h + 0.92, bz), "gold", subdivisions=1))
    # The pad: a concrete disc, a navy ring, an H.
    px, pz = 0.22, 0.26
    p.append(cylinder(0.3, 0.03, (px, f + 0.015, pz), "concrete", sides=16, bevel=0.005))
    p.append(ring(0.24, 0.02, 0.012, (px, f + 0.032, pz), "gold" if s >= 30 else "navy", sides=16))
    for dx in (-0.06, 0.06):
        p.append(box((0.025, 0.006, 0.16), (px + dx, f + 0.034, pz), "white", bevel=0))
    p.append(box((0.12, 0.006, 0.025), (px, f + 0.034, pz), "white", bevel=0))
    p += banner(0.42, bz, f + h, height=0.5, top="gold" if s >= 30 else "brass")
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


F = {era: h for era, (h, _) in FLOOR.items()}

# A detail at every other level, within its era, at the front where nothing stands.
DETAILS = {
    # Salvage: a pile of spears, a crate, a drum.
    2: lambda s: [rod((-0.38 + 0.03 * k, 0, 0.32), (-0.32 + 0.03 * k, 0.36, 0.28), 0.01, "wood", 4) for k in range(3)],
    3: lambda s: crate((-0.45, 0, 0.0), size=0.13, turn=0.2),
    4: lambda s: drum((0.48, 0, 0.32), color="navy", radius=0.07, height=0.18),
    # Colony: a second dummy, a rack of poles, a water barrel, a bench.
    6: lambda s: dummy(-0.36, 0.22, F["colony"]),
    7: lambda s: [box((0.26, 0.03, 0.04), (0.42, F["colony"] + 0.24, 0.26), "wood", bevel=0), *[rod((0.32 + 0.07 * k, F["colony"], 0.27), (0.32 + 0.07 * k, F["colony"] + 0.34, 0.25), 0.01, "plank", 4) for k in range(3)]],
    8: lambda s: barrel((-0.55, F["colony"] + 0.1, 0.0), radius=0.07, height=0.2),
    9: lambda s: [box((0.24, 0.03, 0.07), (0.16, F["colony"] + 0.1, 0.2), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (0.06, F["colony"] + 0.05, 0.2), "wood", bevel=0), box((0.03, 0.1, 0.06), (0.26, F["colony"] + 0.05, 0.2), "wood", bevel=0)],
    # Workshop: two dummies in a row, a drum, a target on a stand, a rope coil.
    11: lambda s: dummy(-0.15, 0.38, F["workshop"]) + dummy(0.15, 0.38, F["workshop"]),
    12: lambda s: drum((0.56, F["workshop"], 0.4), color="navy", radius=0.06, height=0.16),
    13: lambda s: [cylinder(0.012, 0.3, (0.48, F["workshop"] + 0.15, 0.2), "wood", sides=4, bevel=0), cylinder(0.1, 0.02, (0.48, F["workshop"] + 0.32, 0.21), "cream", sides=12, bevel=0, tilt=(math.radians(90), 0)), cylinder(0.05, 0.022, (0.48, F["workshop"] + 0.32, 0.215), "navy", sides=10, bevel=0, tilt=(math.radians(90), 0))],
    14: lambda s: rope_coil((-0.42, F["workshop"], 0.32), radius=0.07),
    # Industry: crates of gear, a jeep-less trailer, sandbags, a signal lamp.
    16: lambda s: [crate((-0.2, F["industry"], 0.38), size=0.12, color="navy"), crate((-0.07, F["industry"], 0.4), size=0.11, color="steel")],
    17: lambda s: [box((0.24, 0.08, 0.14), (0.4, F["industry"] + 0.1, 0.38), "steel", bevel=0.008), cylinder(0.045, 0.025, (0.4, F["industry"] + 0.045, 0.46), "dark", sides=8, bevel=0, tilt=(0, math.radians(90)))],
    18: lambda s: [sack((x, F["industry"], 0.18), size=0.1, color="plank") for x in (0.5, 0.6)],
    19: lambda s: [cylinder(0.012, 0.32, (0.62, F["industry"] + 0.16, -0.05), "steel", sides=4, bevel=0), sphere(0.035, (0.62, F["industry"] + 0.34, -0.05), "gold", subdivisions=1)],
    # Electricity: lockers, a bench, a loudspeaker on a mast, a fuse box.
    21: lambda s: [box((0.24, 0.26, 0.08), (0.3, F["electricity"] + 0.13, 0.2), "steel", bevel=0.005), *[box((0.006, 0.22, 0.01), (0.22 + 0.08 * k, F["electricity"] + 0.13, 0.245), "dark", bevel=0) for k in range(3)]],
    22: lambda s: [box((0.26, 0.03, 0.08), (-0.1, F["electricity"] + 0.1, 0.42), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (-0.21, F["electricity"] + 0.05, 0.42), "steel", bevel=0), box((0.03, 0.1, 0.06), (0.01, F["electricity"] + 0.05, 0.42), "steel", bevel=0)],
    23: lambda s: [cone(0.05, 0.08, (-0.58, F["electricity"] + 0.9, 0.3), "steel", sides=8)],
    24: lambda s: [box((0.14, 0.2, 0.07), (0.42, F["electricity"] + 0.1, 0.42), "navy", bevel=0.006)],
    # Modern: a bench, planters, a flag line, a solar lamp.
    26: lambda s: [box((0.26, 0.03, 0.08), (-0.4, F["modern"] + 0.1, 0.4), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (-0.51, F["modern"] + 0.05, 0.4), "steel", bevel=0), box((0.03, 0.1, 0.06), (-0.29, F["modern"] + 0.05, 0.4), "steel", bevel=0)],
    27: lambda s: [box((0.14, 0.1, 0.14), (-0.62, F["modern"] + 0.05, 0.12), "concrete", bevel=0.01), sphere(0.06, (-0.62, F["modern"] + 0.14, 0.12), "meadow", subdivisions=1)],
    28: lambda s: [cylinder(0.012, 0.36, (0.62, F["modern"] + 0.18, -0.02), "steel", sides=4, bevel=0), box((0.12, 0.02, 0.1), (0.62, F["modern"] + 0.38, -0.02), "solar", bevel=0), sphere(0.025, (0.62, F["modern"] + 0.33, 0.0), "gold", subdivisions=1)],
    29: lambda s: [box((0.2, 0.14, 0.02), (-0.15, F["modern"] + 0.24, 0.45), "navy", bevel=0.004), cylinder(0.012, 0.18, (-0.15, F["modern"] + 0.09, 0.45), "steel", sides=4, bevel=0)],
}

