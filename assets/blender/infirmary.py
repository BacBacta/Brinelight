"""
The Infirmary (art direction: a low building, a white cross, an awning over cots) in its six eras (docs/tasks/week-8.md,
"The eras"), each a different place to heal, and a detail at every other level within its era:

- Salvage (1–4): a canvas tent with its cross, cots under an awning;
- Colony (5–9): a plank cabin, a canvas awning over cots, a water barrel;
- Workshop (10–14): a brick infirmary with tall windows and a chimney;
- Industry (15–19): a two-story hall with a steel balcony, a water tank on legs;
- Electricity (20–24): a ward under a glass roof, electric lamps, a generator hut;
- Modern (25–30): a clean white clinic, wide windows, solar panels, an antenna with its light; at 30, a gold rim.

Its cross is white on navy in every era, never on red (that emblem is protected). It stands in the front row, on the
left: it stays low, so the Barracks and the Lighthouse behind it stay in sight (client/test/visible.test.ts).
"""
import math

from kit import barrel, box, crate, cylinder, flag, lamp_post, prism_roof, rod, sack, sphere
from parts import FLOOR, boards, cross, door, floor, house, roof_slope, window
from stages import era_of


def cot(x, z, foot, turn=0.0):
    """A cot: a cream mattress on a light frame."""
    return [box((0.24, 0.03, 0.1), (x, foot + 0.09, z), "cream", bevel=0.008, turn=turn), *[box((0.02, 0.08, 0.02), (x + dx, foot + 0.04, z), "wood", bevel=0, turn=turn) for dx in (-0.1, 0.1)]]


def awning(x, z, w, d, h, foot, color="cream"):
    """An awning on four poles, sloping to the front."""
    out = [roof_slope((w, 0.02, d), (x, foot + h, z), color, -10)]
    for dx in (-w / 2 + 0.03, w / 2 - 0.03):
        for dz in (-d / 2 + 0.03, d / 2 - 0.03):
            out.append(cylinder(0.014, h, (x + dx, foot + h / 2, z + dz), "wood", sides=5, bevel=0))
    return out


def salvage(s):
    p = boards(0.9, 0.44, (-0.12, 0, -0.26))
    p.append(prism_roof(0.7, 0.5, 0.42, (-0.12, 0.05, -0.26), "cream"))
    p += cross(-0.12, 0.24, 0.02, size=0.13)
    p += awning(0.38, 0.2, 0.5, 0.36, 0.3, 0)
    p += cot(0.38, 0.14, 0) + cot(0.38, 0.3, 0)
    return p


def colony(s):
    p, f = floor("colony")
    p += house(-0.18, -0.24, 0.72, 0.42, 0.36, "plank", "wood", foot=f, roof_h=0.2, windows=((-0.22, 0.2), (0.22, 0.2)), door_at=0.0)
    p += cross(-0.18, f + 0.47, -0.02, size=0.13)
    p += awning(0.36, 0.22, 0.5, 0.34, 0.3, f)
    p += cot(0.36, 0.16, f) + cot(0.36, 0.32, f)
    p.append(barrel((-0.56, f + 0.1, 0.12), radius=0.07, height=0.2))
    return p


def workshop(s):
    p, f = floor("workshop")
    w, d, h = 0.96, 0.46, 0.56
    p += house(0.0, -0.22, w, d, h, "brick", "stone_dark", foot=f, roof_h=0.24, eave=0.03, door_at=0.0)
    # Tall windows, a white cross over the door, a brick chimney.
    for x in (-0.34, -0.17, 0.17, 0.34):
        p += window(x, f + 0.28, 0.01, w=0.08, h=0.3, frame="stone")
    p += cross(0.0, f + 0.42, 0.02, size=0.13)
    p.append(box((0.08, 0.26, 0.08), (0.32, f + h + 0.2, -0.3), "brick", bevel=0))
    p.extend(flag((0.5, f, 0.24), "navy", height=0.5))
    return p


def industry(s):
    p, f = floor("industry")
    w, d, h = 0.86, 0.46, 0.8
    p.append(box((w, h, d), (-0.08, f + h / 2, -0.24), "white", bevel=0.012))
    p.append(box((w + 0.04, 0.05, d + 0.04), (-0.08, f + h, -0.24), "stone_dark", bevel=0.01))
    for y in (0.22, 0.6):
        for x in (-0.38, -0.2, 0.04, 0.22):
            p += window(x, f + y, -0.01, w=0.12, h=0.18, frame="steel")
    # The steel balcony on the upper floor, the door, the cross.
    p.append(box((w - 0.12, 0.03, 0.14), (-0.08, f + 0.42, 0.05), "steel", bevel=0))
    p.append(box((w - 0.12, 0.1, 0.01), (-0.08, f + 0.48, 0.12), "steel", bevel=0))
    p += door(-0.08, f, -0.01, w=0.16, h=0.26)
    p += cross(-0.08, f + 0.7, 0.0, size=0.13)
    # The water tank on four legs at the right.
    tx, tz = 0.56, -0.3
    for dx in (-0.08, 0.08):
        for dz in (-0.08, 0.08):
            p.append(cylinder(0.014, 0.5, (tx + dx, f + 0.25, tz + dz), "steel", sides=4, bevel=0))
    p.append(cylinder(0.14, 0.24, (tx, f + 0.62, tz), "steel", sides=12, bevel=0))
    p.append(cylinder(0.15, 0.03, (tx, f + 0.75, tz), "stone_dark", sides=12, bevel=0, top=0.04))
    return p


def electricity(s):
    p, f = floor("electricity")
    # The ward: a low brick wall, glass walls, a glass roof on steel ribs; the cross on its gable.
    hx, hz, w, d = -0.06, -0.22, 0.92, 0.5
    p.append(box((w, 0.18, d), (hx, f + 0.09, hz), "brick", bevel=0.008))
    p.append(box((w - 0.04, 0.3, d - 0.04), (hx, f + 0.33, hz), "glass", bevel=0.004))
    for x in (-w / 2, 0, w / 2):
        p.append(box((0.035, 0.5, 0.035), (hx + x, f + 0.25, hz + d / 2), "steel", bevel=0))
    p.append(prism_roof(w + 0.06, d + 0.06, 0.26, (hx, f + 0.48, hz), "glass"))
    for x in (-w / 2, -w / 4, 0, w / 4, w / 2):
        p.append(prism_roof(0.03, d + 0.08, 0.27, (hx + x, f + 0.48, hz), "steel"))
    p += door(hx, f + 0.18, hz + d / 2, w=0.16, h=0.26)
    p += cross(hx + 0.28, f + 0.12, hz + d / 2 + 0.01, size=0.12)
    # The generator hut at the right, its cable, electric lamps at the door.
    p.append(box((0.26, 0.22, 0.24), (0.6, f + 0.11, -0.26), "steel", bevel=0.01))
    p.append(box((0.3, 0.02, 0.28), (0.6, f + 0.23, -0.26), "tin", bevel=0.004))
    p.append(rod((0.5, f + 0.2, -0.2), (hx + w / 2, f + 0.4, hz), 0.006, "dark", 3))
    for x in (hx - 0.14, hx + 0.14):
        p.append(sphere(0.03, (x, f + 0.5, hz + d / 2 + 0.03), "gold", subdivisions=1))
    return p


def modern(s):
    p, f = floor("modern")
    # The clinic: white, a wide band of windows, a flat roof with solar panels, the cross by its door, an antenna.
    cx, cz, w, d, h = -0.04, -0.22, 1.04, 0.5, 0.5
    p.append(box((w, h, d), (cx, f + h / 2, cz), "white", bevel=0.012))
    p.append(box((w + 0.04, 0.04, d + 0.04), (cx, f + h, cz), "concrete", bevel=0.008))
    if s >= 30:
        # The era complete: a gold rim along the roof's front edge.
        p.append(box((w + 0.06, 0.05, 0.03), (cx, f + h + 0.005, cz + d / 2 + 0.02), "gold", bevel=0.006))
    p.append(box((w - 0.12, 0.18, 0.02), (cx, f + 0.3, cz + d / 2 + 0.005), "glass", bevel=0.003))
    for k, x in enumerate((-0.3, -0.06, 0.16, 0.36)):
        p.append(box((0.02, 0.18, 0.025), (cx + x, f + 0.3, cz + d / 2 + 0.012), "white", bevel=0))
    p += door(cx - 0.3, f, cz + d / 2, w=0.18, h=0.22)
    p += cross(cx + 0.36, f + 0.12, cz + d / 2 + 0.012, size=0.12)
    for x, ww in ((-0.26, 0.3), (0.12, 0.26)):
        p.append(box((ww, 0.02, 0.3), (cx + x, f + h + 0.08, cz), "solar", bevel=0, tilt=(math.radians(-16), 0)))
    p.append(cylinder(0.014, 0.5, (cx + 0.42, f + h + 0.25, cz - 0.12), "steel", sides=5, bevel=0))
    p.append(sphere(0.032, (cx + 0.42, f + h + 0.52, cz - 0.12), "gold", subdivisions=1))
    # A pane replaced by a steel plate, bolted: still mended by hand.
    p.append(box((0.1, 0.12, 0.012), (cx - 0.18, f + 0.3, cz + d / 2 + 0.02), "steel", bevel=0.002))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


F = {era: h for era, (h, _) in FLOOR.items()}

# A detail at every other level, within its era, at the front where nothing stands.
DETAILS = {
    # Salvage: a crate of bandages, a water barrel, a third cot.
    2: lambda s: crate((-0.5, 0, 0.18), size=0.13, color="cream"),
    3: lambda s: barrel((-0.25, 0.11, 0.3), radius=0.07, height=0.2),
    4: lambda s: cot(0.0, 0.42, 0, turn=0.2),
    # Colony: a herb bed, a bench, a basin on a stand, a sack of linen.
    6: lambda s: [box((0.26, 0.05, 0.12), (-0.3, F["colony"] + 0.03, 0.34), "earth", bevel=0.01), *[sphere(0.03, (-0.38 + 0.08 * k, F["colony"] + 0.07, 0.34), "meadow", subdivisions=1) for k in range(3)]],
    7: lambda s: [box((0.24, 0.03, 0.07), (0.0, F["colony"] + 0.1, 0.42), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (-0.1, F["colony"] + 0.05, 0.42), "wood", bevel=0), box((0.03, 0.1, 0.06), (0.1, F["colony"] + 0.05, 0.42), "wood", bevel=0)],
    8: lambda s: [cylinder(0.012, 0.18, (-0.56, F["colony"] + 0.09, 0.34), "wood", sides=4, bevel=0), cylinder(0.06, 0.03, (-0.56, F["colony"] + 0.19, 0.34), "steel", sides=10, bevel=0)],
    9: lambda s: sack((0.62, F["colony"], 0.0), size=0.12, color="white"),
    # Workshop: a stretcher, a lamp post, a bench, a cart of linen.
    11: lambda s: [box((0.3, 0.03, 0.1), (-0.3, F["workshop"] + 0.06, 0.34), "cream", bevel=0.008), rod((-0.47, F["workshop"] + 0.06, 0.3), (-0.13, F["workshop"] + 0.06, 0.3), 0.008, "wood", 4), rod((-0.47, F["workshop"] + 0.06, 0.38), (-0.13, F["workshop"] + 0.06, 0.38), 0.008, "wood", 4)],
    12: lambda s: lamp_post((-0.6, F["workshop"], 0.2), height=0.42),
    13: lambda s: [box((0.24, 0.03, 0.07), (0.24, F["workshop"] + 0.1, 0.42), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (0.14, F["workshop"] + 0.05, 0.42), "wood", bevel=0), box((0.03, 0.1, 0.06), (0.34, F["workshop"] + 0.05, 0.42), "wood", bevel=0)],
    14: lambda s: [box((0.16, 0.1, 0.12), (0.06, F["workshop"] + 0.1, 0.36), "white", bevel=0.008), cylinder(0.035, 0.02, (0.06, F["workshop"] + 0.035, 0.42), "dark", sides=8, bevel=0, tilt=(0, math.radians(90)))],
    # Industry: oxygen bottles, a wheelchair, a bench, a first-aid box.
    16: lambda s: [cylinder(0.03, 0.22, (0.38 + 0.07 * k, F["industry"] + 0.11, 0.38), "copper" if k % 2 else "white", sides=8, bevel=0) for k in range(3)],
    17: lambda s: [box((0.12, 0.08, 0.1), (-0.48, F["industry"] + 0.12, 0.36), "navy", bevel=0.006), cylinder(0.06, 0.012, (-0.55, F["industry"] + 0.06, 0.36), "dark", sides=10, bevel=0, tilt=(0, math.radians(90))), cylinder(0.06, 0.012, (-0.41, F["industry"] + 0.06, 0.36), "dark", sides=10, bevel=0, tilt=(0, math.radians(90)))],
    18: lambda s: [box((0.24, 0.03, 0.07), (-0.08, F["industry"] + 0.1, 0.44), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (-0.18, F["industry"] + 0.05, 0.44), "steel", bevel=0), box((0.03, 0.1, 0.06), (0.02, F["industry"] + 0.05, 0.44), "steel", bevel=0)],
    19: lambda s: [box((0.12, 0.1, 0.06), (0.2, F["industry"] + 0.3, 0.02), "white", bevel=0.006), *cross(0.2, F["industry"] + 0.3, 0.055, size=0.07)],
    # Electricity: a bench, an ambulance cart, a lamp post, a planter.
    21: lambda s: [box((0.24, 0.03, 0.07), (-0.36, F["electricity"] + 0.1, 0.4), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (-0.46, F["electricity"] + 0.05, 0.4), "steel", bevel=0), box((0.03, 0.1, 0.06), (-0.26, F["electricity"] + 0.05, 0.4), "steel", bevel=0)],
    22: lambda s: [box((0.24, 0.12, 0.14), (0.3, F["electricity"] + 0.1, 0.4), "white", bevel=0.01), *cross(0.3, F["electricity"] + 0.12, 0.475, size=0.07), cylinder(0.04, 0.02, (0.22, F["electricity"] + 0.04, 0.48), "dark", sides=8, bevel=0, tilt=(0, math.radians(90)))],
    23: lambda s: lamp_post((0.62, F["electricity"], 0.2), height=0.42),
    24: lambda s: [box((0.22, 0.08, 0.1), (0.0, F["electricity"] + 0.04, 0.44), "stone", bevel=0.01), *[sphere(0.03, (-0.07 + 0.07 * k, F["electricity"] + 0.1, 0.44), "gold" if k == 1 else "meadow", subdivisions=1) for k in range(3)]],
    # Modern: a bench, a planter with a tree, a sign, a wheelchair ramp rail.
    26: lambda s: [box((0.24, 0.03, 0.07), (0.3, F["modern"] + 0.1, 0.42), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (0.2, F["modern"] + 0.05, 0.42), "steel", bevel=0), box((0.03, 0.1, 0.06), (0.4, F["modern"] + 0.05, 0.42), "steel", bevel=0)],
    27: lambda s: [box((0.16, 0.1, 0.16), (-0.55, F["modern"] + 0.05, 0.3), "concrete", bevel=0.01), cylinder(0.015, 0.2, (-0.55, F["modern"] + 0.2, 0.3), "wood", sides=4, bevel=0), sphere(0.08, (-0.55, F["modern"] + 0.34, 0.3), "meadow", subdivisions=1)],
    28: lambda s: [box((0.18, 0.12, 0.02), (0.0, F["modern"] + 0.22, 0.46), "navy", bevel=0.004), *cross(0.0, F["modern"] + 0.22, 0.475, size=0.08), cylinder(0.012, 0.16, (0.0, F["modern"] + 0.08, 0.46), "steel", sides=4, bevel=0)],
    29: lambda s: [rod((-0.5, F["modern"] + 0.12, 0.08), (-0.2, F["modern"] + 0.12, 0.08), 0.01, "steel", 4), *[cylinder(0.01, 0.12, (-0.5 + 0.15 * k, F["modern"] + 0.06, 0.08), "steel", sides=4, bevel=0) for k in range(3)]],
}
