"""
The Shelters (art direction: a cluster of huts and patched tents, a washing line) in their six eras
(docs/tasks/week-8.md, "The eras"), each a different place to live, and a detail at every other level within its era:

- Salvage (1–4): patched tents and a driftwood hut, a washing line;
- Colony (5–9): plank cottages on a stone base, shingle roofs, the first windows, a garden fence;
- Workshop (10–14): a row of brick terraced houses, a chimney each, slate roofs;
- Industry (15–19): a three-story house with steel balconies and a water tank on its roof;
- Electricity (20–24): a house with glazed loggias, a power line on poles, a street lamp;
- Modern (25–30): a stepped block of wood and glass, gardens on its terraces, solar panels; at 30, a gold pavilion.

It stands one plot back on the right (client/src/city/plots.ts), in front of the Refinery's right side: it stays low
enough to keep the Refinery in sight (client/test/visible.test.ts).
"""
import math

from kit import barrel, box, crate, cylinder, flag, lamp_post, prism_roof, rod, rope_coil, sack, sphere
from parts import boards, door, floor, house, roof_slope, tent, washing_line, window
from stages import era_of


def salvage(s):
    p = boards(0.7, 0.5, (-0.3, 0, -0.22))
    p += tent(-0.32, -0.24, 0.62, 0.52, 0.46, "cream", foot=0.05)
    p.append(box((0.16, 0.14, 0.01), (-0.42, 0.22, 0.03), "tin", bevel=0, tilt=(math.radians(-41), 0)))
    p += tent(0.42, -0.3, 0.5, 0.46, 0.38, "tin")
    # The driftwood hut: plank walls, a tin roof sloping to the front, a patch of another color.
    p.append(box((0.42, 0.34, 0.34), (0.22, 0.17, 0.16), "plank", bevel=0.012))
    p.append(box((0.1, 0.12, 0.012), (0.33, 0.22, 0.335), "wood", bevel=0))
    p += door(0.12, 0, 0.33, w=0.12, h=0.22)
    p.append(roof_slope((0.5, 0.03, 0.42), (0.22, 0.38, 0.16), "tin", -14))
    p.append(cylinder(0.025, 0.2, (0.36, 0.48, 0.06), "dark", sides=5, bevel=0))
    p += washing_line((-0.62, 0, 0.3), (-0.12, 0, 0.42))
    p.extend(flag((0.5, 0, 0.12), "cream", height=0.5))
    return p


def colony(s):
    p, f = floor("colony")
    p += house(-0.38, -0.2, 0.5, 0.44, 0.36, "plank", "wood", foot=f, windows=((0.12, 0.2),), door_at=-0.1)
    p += house(0.34, -0.24, 0.56, 0.44, 0.42, "plank", "wood", foot=f, roof_h=0.24, windows=((-0.13, 0.24), (0.13, 0.24)), door_at=0.0)
    p.append(box((0.08, 0.24, 0.08), (0.5, f + 0.6, -0.28), "stone", bevel=0.005))
    # A garden fence along the front, a washing line between the cottages.
    for x in (-0.6, -0.4, -0.2):
        p.append(cylinder(0.015, 0.14, (x, f + 0.07, 0.4), "wood", sides=5, bevel=0))
    p.append(rod((-0.6, f + 0.11, 0.4), (-0.2, f + 0.11, 0.4), 0.01, "plank", 4))
    p += washing_line((-0.08, f, -0.05), (0.08, f, 0.2), colors=("white", "cream"))
    p.extend(flag((0.5, f, 0.15), "cream", height=0.5))
    return p


def workshop(s):
    p, f = floor("workshop")
    # Three brick houses in a row, two floors each, a slate roof and a chimney each, a door and windows.
    for i, x in enumerate((-0.44, 0.0, 0.44)):
        h = 0.7 + 0.04 * (i % 2)
        p += house(x, -0.16, 0.42, 0.5, h, "brick", "stone_dark", foot=f, roof_h=0.24, eave=0.02, windows=((-0.09, h * 0.72), (0.09, h * 0.72), (0.09, 0.2)), door_at=-0.08)
        p.append(box((0.08, 0.22, 0.08), (x + 0.12, f + h + 0.18, -0.2), "brick", bevel=0))
    p.append(box((1.32, 0.04, 0.03), (0, f + 0.42, 0.095), "stone", bevel=0))
    p.extend(flag((0.5, f, 0.3), "navy", height=0.55))
    return p


def industry(s):
    p, f = floor("industry")
    w, d, h = 0.92, 0.56, 1.1
    # A three-story house in render, a steel balcony with its rail at each floor, a water tank on legs on the roof.
    p.append(box((w, h, d), (0, f + h / 2, -0.16), "concrete", bevel=0.012))
    p.append(box((w + 0.04, 0.05, d + 0.04), (0, f + h, -0.16), "stone_dark", bevel=0.01))
    for k in range(3):
        y = f + 0.06 + k * h / 3
        for x in (-0.3, 0.0, 0.3):
            p += window(x, y + 0.2, 0.12, w=0.12, h=0.16, frame="steel")
        if k:
            p.append(box((w - 0.1, 0.03, 0.14), (0, y, 0.19), "steel", bevel=0))
            p.append(box((w - 0.1, 0.1, 0.01), (0, y + 0.06, 0.26), "steel", bevel=0))
    p += door(0, f, 0.12, w=0.16, h=0.26)
    for x in (-0.18, 0.18):
        for z in (-0.3, -0.06):
            p.append(cylinder(0.015, 0.22, (x - 0.1, f + h + 0.11, z), "steel", sides=4, bevel=0))
    p.append(cylinder(0.2, 0.3, (-0.1, f + h + 0.37, -0.18), "steel", sides=12, bevel=0))
    p.append(cylinder(0.21, 0.04, (-0.1, f + h + 0.54, -0.18), "stone_dark", sides=12, bevel=0, top=0.06))
    p.extend(flag((0.3, f + h + 0.03, -0.3), "navy", height=0.38))
    return p


def electricity(s):
    p, f = floor("electricity")
    w, d, h = 1.0, 0.52, 1.24
    p.append(box((w, h, d), (0, f + h / 2, -0.2), "white", bevel=0.012))
    p.append(box((w + 0.04, 0.05, d + 0.04), (0, f + h, -0.2), "steel", bevel=0.01))
    # Glazed loggias on the front, one a floor, steel frames; a door between them.
    for k, y in enumerate((0.14, 0.56, 0.96)):
        for x in (-0.28, 0.28):
            if k == 0 and x > 0:
                continue
            p.append(box((0.34, 0.3, 0.16), (x, f + y + 0.12, 0.13), "glass", bevel=0.004))
            p.append(box((0.36, 0.03, 0.18), (x, f + y + 0.28, 0.13), "steel", bevel=0))
    p += door(0.28, f, 0.06, w=0.16, h=0.28)
    # A power line on two poles to its roof, a street lamp.
    for x, z in ((0.72, 0.3), (-0.72, 0.3)):
        p.append(cylinder(0.02, 0.9, (x, f + 0.45, z), "wood", sides=5, bevel=0))
        p.append(box((0.16, 0.025, 0.025), (x, f + 0.84, z), "wood", bevel=0))
    p.append(rod((0.72, f + 0.84, 0.3), (-0.72, f + 0.84, 0.3), 0.005, "dark", 3))
    p.append(rod((0.72, f + 0.84, 0.3), (0.45, f + h, -0.1), 0.005, "dark", 3))
    p += lamp_post((-0.5, f, 0.42), height=0.42, color="navy")
    p.extend(flag((0.38, f + h + 0.03, -0.32), "copper", height=0.36))
    return p


def modern(s):
    p, f = floor("modern")
    # A stepped block of wood and glass: three volumes, each set back; gardens on the terraces, solar panels on top. Its
    # cladding mixes two woods, as found.
    vols = ((1.12, 0.66, 0.5, -0.12), (0.9, 0.5, 0.46, -0.2), (0.66, 0.36, 0.42, -0.27))
    y = f
    for i, (w, d, h, z) in enumerate(vols):
        p.append(box((w, h, d), (0, y + h / 2, z), "plank" if i % 2 == 0 else "wood", bevel=0.01))
        p.append(box((w - 0.12, h * 0.5, 0.02), (0, y + h * 0.55, z + d / 2 + 0.005), "glass", bevel=0.003))
        for k in range(1, 4):
            p.append(box((0.02, h * 0.5, 0.025), (-w / 2 + 0.06 + (w - 0.12) * k / 4 + 0.03 * (k % 2), y + h * 0.55, z + d / 2 + 0.012), "white", bevel=0))
        y += h
        if i + 1 < len(vols):
            # The terrace's garden: the strip between this volume's front and the next one's.
            front, back = z + d / 2, vols[i + 1][3] + vols[i + 1][1] / 2
            p.append(box((w - 0.1, 0.05, front - back - 0.02), (0, y + 0.025, (front + back) / 2), "meadow", bevel=0.01))
            for k in range(3):
                p.append(sphere(0.045, (-w / 3 + w / 3 * k, y + 0.08, (front + back) / 2), "meadow_dark", subdivisions=1))
    p += door(0, f, 0.21, w=0.18, h=0.26)
    for x in (-0.16, 0.16):
        p.append(box((0.26, 0.02, 0.24), (x, y + 0.06, -0.27), "solar", bevel=0, tilt=(math.radians(-18), 0)))
    p.append(box((0.08, 0.06, 0.012), (-0.36, f + 0.32, 0.215), "steel", bevel=0.002))
    p.extend(flag((0.26, y, -0.36), "gold", height=0.34))
    if s >= 30:
        # The era complete: a small gold pavilion on the roof garden.
        p.append(box((0.22, 0.16, 0.18), (-0.18, y + 0.08, -0.27), "glass", bevel=0.005))
        p.append(prism_roof(0.28, 0.24, 0.1, (-0.18, y + 0.16, -0.27), "gold"))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


F = {era: h for era, (h, _) in __import__("parts").FLOOR.items()}

# A detail at every other level, within its era, at the front where nothing stands.
DETAILS = {
    # Salvage: a crate, a coil of rope, a water barrel.
    2: lambda s: crate((-0.55, 0, 0.12), size=0.14, turn=0.3),
    3: lambda s: rope_coil((0.5, 0, 0.42), radius=0.07),
    4: lambda s: barrel((0.0, 0.11, 0.5), radius=0.08, height=0.22),
    # Colony: a vegetable bed, a bench, a flower box, a hen house.
    6: lambda s: [box((0.3, 0.05, 0.14), (-0.42, F["colony"] + 0.03, 0.18), "earth", bevel=0.01), *[sphere(0.035, (-0.52 + 0.1 * k, F["colony"] + 0.07, 0.18), "meadow", subdivisions=1) for k in range(3)]],
    7: lambda s: [box((0.28, 0.03, 0.08), (0.3, F["colony"] + 0.1, 0.42), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (0.18, F["colony"] + 0.05, 0.42), "wood", bevel=0), box((0.03, 0.1, 0.06), (0.42, F["colony"] + 0.05, 0.42), "wood", bevel=0)],
    8: lambda s: [box((0.18, 0.05, 0.05), (0.47, F["colony"] + 0.15, 0.01), "wood", bevel=0.004), *[sphere(0.025, (0.42 + 0.05 * k, F["colony"] + 0.19, 0.01), "gold" if k % 2 else "meadow", subdivisions=1) for k in range(3)]],
    9: lambda s: [box((0.16, 0.12, 0.12), (0.08, F["colony"] + 0.06, 0.45), "wood", bevel=0.008), prism_roof(0.2, 0.15, 0.06, (0.08, F["colony"] + 0.12, 0.45), "plank")],
    # Workshop: a coal bunker, a handcart, a street sign, bins.
    11: lambda s: [box((0.2, 0.12, 0.1), (-0.5, F["workshop"] + 0.06, 0.3), "stone_dark", bevel=0.008), sphere(0.07, (-0.5, F["workshop"] + 0.12, 0.3), "dark", subdivisions=1, squash=0.5)],
    12: lambda s: [box((0.22, 0.07, 0.14), (0.2, F["workshop"] + 0.1, 0.42), "wood", bevel=0.008), cylinder(0.05, 0.025, (0.08, F["workshop"] + 0.05, 0.42), "dark", sides=8, bevel=0, tilt=(0, math.radians(90))), rod((0.31, F["workshop"] + 0.1, 0.42), (0.42, F["workshop"] + 0.18, 0.42), 0.01, "wood", 4)],
    13: lambda s: [cylinder(0.012, 0.36, (0.62, F["workshop"] + 0.18, 0.3), "navy", sides=4, bevel=0), box((0.16, 0.06, 0.012), (0.62, F["workshop"] + 0.34, 0.31), "navy", bevel=0.003)],
    14: lambda s: [cylinder(0.05, 0.12, (-0.18 + 0.12 * k, F["workshop"] + 0.06, 0.42), "steel", sides=8, bevel=0) for k in range(2)],
    # Industry: a bicycle stand, sacks, a lamp post, a notice board.
    16: lambda s: [rod((-0.6, F["industry"] + 0.1, 0.32), (-0.36, F["industry"] + 0.1, 0.32), 0.01, "steel", 4), *[cylinder(0.06, 0.012, (-0.56 + 0.12 * k, F["industry"] + 0.06, 0.34), "dark", sides=8, bevel=0, tilt=(0, math.radians(90))) for k in range(3)]],
    17: lambda s: [sack((0.42, F["industry"], 0.38), size=0.12), sack((0.54, F["industry"], 0.42), size=0.11)],
    18: lambda s: lamp_post((0.62, F["industry"], 0.18), height=0.4, color="navy"),
    19: lambda s: [box((0.2, 0.14, 0.02), (-0.2, F["industry"] + 0.26, 0.42), "plank", bevel=0.004), cylinder(0.012, 0.2, (-0.2, F["industry"] + 0.1, 0.42), "steel", sides=4, bevel=0)],
    # Electricity: a bench, a telephone box, a flower bed, a cable reel.
    21: lambda s: [box((0.26, 0.03, 0.08), (0.12, F["electricity"] + 0.1, 0.46), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (0.01, F["electricity"] + 0.05, 0.46), "steel", bevel=0), box((0.03, 0.1, 0.06), (0.23, F["electricity"] + 0.05, 0.46), "steel", bevel=0)],
    22: lambda s: [box((0.12, 0.3, 0.12), (0.55, F["electricity"] + 0.15, 0.06), "navy", bevel=0.01), box((0.08, 0.16, 0.012), (0.55, F["electricity"] + 0.18, 0.125), "glass", bevel=0)],
    23: lambda s: [box((0.3, 0.06, 0.12), (-0.28, F["electricity"] + 0.03, 0.42), "stone", bevel=0.01), *[sphere(0.035, (-0.38 + 0.1 * k, F["electricity"] + 0.08, 0.42), "gold" if k == 1 else "meadow", subdivisions=1) for k in range(3)]],
    24: lambda s: [cylinder(0.09, 0.05, (0.36, F["electricity"] + 0.09, 0.38), "wood", sides=10, bevel=0, tilt=(math.radians(90), 0))],
    # Modern: bicycles, a planter, a bench, a mailbox wall.
    26: lambda s: [cylinder(0.06, 0.012, (-0.5 + 0.13 * k, F["modern"] + 0.06, 0.42), "dark", sides=8, bevel=0, tilt=(0, math.radians(90))) for k in range(2)] + [rod((-0.5, F["modern"] + 0.1, 0.42), (-0.37, F["modern"] + 0.1, 0.42), 0.01, "gold", 4)],
    27: lambda s: [box((0.24, 0.1, 0.1), (0.42, F["modern"] + 0.05, 0.4), "concrete", bevel=0.01), sphere(0.06, (0.42, F["modern"] + 0.14, 0.4), "meadow", subdivisions=1)],
    28: lambda s: [box((0.24, 0.03, 0.08), (0.08, F["modern"] + 0.1, 0.47), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (-0.03, F["modern"] + 0.05, 0.47), "steel", bevel=0), box((0.03, 0.1, 0.06), (0.19, F["modern"] + 0.05, 0.47), "steel", bevel=0)],
    29: lambda s: [box((0.2, 0.14, 0.04), (-0.62, F["modern"] + 0.16, 0.18), "navy", bevel=0.004), *[box((0.05, 0.03, 0.01), (-0.67 + 0.1 * (k % 2), F["modern"] + 0.12 + 0.05 * (k // 2), 0.205), "gold", bevel=0) for k in range(4)]],
}
