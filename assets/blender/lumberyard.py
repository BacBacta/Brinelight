"""
The Lumberyard (art direction: a lean-to, bleached driftwood logs, a circular saw) in its six eras (docs/tasks/week-8.md,
"The eras"), and a detail at every other level within its era. It stands in the front row on the right
(client/src/city/plots.ts): it stays low, the Lighthouse behind it.

- Salvage (1–4): a lean-to, piles of bleached driftwood, a hand saw on trestles;
- Colony (5–9): a plank shed on stone, stacked boards, a pit saw;
- Workshop (10–14): a brick sawmill, its treadwheel, a log slide;
- Industry (15–19): a steam sawmill, a big circular saw, a steel log crane;
- Electricity (20–24): a saw hall under a glass roof, a log conveyor, overhead cables;
- Modern (25–30): a timber-and-glass workshop, a robot saw arm, drying sheds under solar panels; at 30, a gold arm.
"""
import math

from kit import box, cylinder, flag, prism_roof, ring, rod, sphere
from parts import FLOOR, door, era_details, floor, house, roof_slope, window
from stages import era_of


def log(x, z, foot, length=0.5, r=0.05, color="plank", turn=0.0):
    """A log lying across the plot (along x, turned by `turn` radians)."""
    obj = cylinder(r, length, (x, foot + r, z), color, sides=8, bevel=0, tilt=(0, math.radians(90)))
    obj.rotation_euler = (0, math.radians(90), turn)
    return obj


def log_pile(x, z, foot, rows=3, color="plank", length=0.5):
    out = []
    for row in range(rows):
        for k in range(rows - row):
            out.append(log(x - 0.05 * (rows - row - 1) + 0.1 * k, z, foot + row * 0.085, length=length, color=color, turn=math.radians(90)))
    return out


def salvage(s):
    p = []
    # The lean-to: two tall posts at the back, two short at the front, a roof of planks.
    for x in (-0.55, -0.05):
        p.append(cylinder(0.025, 0.5, (x, 0.25, -0.4), "wood", sides=5, bevel=0))
        p.append(cylinder(0.025, 0.32, (x, 0.16, -0.05), "wood", sides=5, bevel=0))
    p.append(roof_slope((0.64, 0.03, 0.46), (-0.3, 0.44, -0.22), "plank", -20))
    p += log_pile(-0.3, -0.22, 0, rows=2, color="cream", length=0.4)
    p += log_pile(0.4, -0.3, 0, rows=3, color="cream", length=0.46)
    # The hand saw on trestles: two crossed trestles, a log on them, the blade.
    for x in (0.0, 0.3):
        p.append(rod((x, 0.0, 0.16), (x, 0.2, 0.26), 0.012, "wood", 4))
        p.append(rod((x, 0.0, 0.36), (x, 0.2, 0.26), 0.012, "wood", 4))
    p.append(log(0.15, 0.26, 0.17, length=0.46, color="cream"))
    p.append(box((0.02, 0.1, 0.16), (0.15, 0.3, 0.26), "steel", bevel=0, tilt=(math.radians(-20), 0)))
    p.extend(flag((0.55, 0, 0.1), "cream", height=0.46))
    return p


def colony(s):
    p, f = floor("colony")
    p += house(-0.32, -0.24, 0.56, 0.42, 0.36, "plank", "wood", foot=f, windows=((0.14, 0.2),), door_at=-0.1)
    # Stacked boards, the pit saw: a frame over a log, the long saw.
    for k in range(4):
        p.append(box((0.4, 0.035, 0.2), (0.38, f + 0.02 + 0.04 * k, -0.3), "plank" if k % 2 else "wood", bevel=0.004, turn=0.03 * k))
    for x in (0.08, 0.5):
        p.append(cylinder(0.02, 0.36, (x, f + 0.18, 0.18), "wood", sides=5, bevel=0))
    p.append(box((0.48, 0.035, 0.04), (0.29, f + 0.35, 0.18), "wood", bevel=0))
    p.append(log(0.29, 0.18, f + 0.28, length=0.5, color="wood"))
    p.append(box((0.02, 0.3, 0.012), (0.29, f + 0.3, 0.18), "steel", bevel=0))
    p.extend(flag((-0.55, f, 0.15), "cream", height=0.5))
    return p


def workshop(s):
    p, f = floor("workshop")
    p += house(-0.3, -0.22, 0.6, 0.44, 0.5, "brick", "stone_dark", foot=f, roof_h=0.22, windows=((-0.14, 0.3), (0.14, 0.3)), door_at=0.0)
    # The treadwheel on the sawmill's side, its spokes; the log slide down to the yard.
    wx, wz, r = 0.3, -0.36, 0.28
    p.append(ring(r, 0.04, 0.08, (wx, f + r + 0.02, wz), "wood", sides=16))
    p[-1].rotation_euler = (math.radians(90), 0, 0)
    for k in range(4):
        a = math.radians(45 * k)
        p.append(rod((wx + math.cos(a) * r, f + r + 0.02 + math.sin(a) * r, wz + 0.02), (wx - math.cos(a) * r, f + r + 0.02 - math.sin(a) * r, wz + 0.02), 0.012, "plank", 4))
    p.append(box((0.16, 0.03, 0.62), (0.52, f + 0.16, -0.06), "plank", bevel=0.004, tilt=(math.radians(-22), 0)))
    p += log_pile(0.52, 0.32, f, rows=2, color="wood", length=0.3)
    p.extend(flag((-0.56, f + 0.72, -0.3), "navy", height=0.36))
    return p


def industry(s):
    p, f = floor("industry")
    p.append(box((0.66, 0.46, 0.46), (-0.26, f + 0.23, -0.24), "steel", bevel=0.01))
    p.append(roof_slope((0.72, 0.03, 0.52), (-0.26, f + 0.48, -0.24), "tin", -10))
    p += door(-0.26, f, -0.01, w=0.18, h=0.28, color="navy")
    p.append(cylinder(0.05, 0.5, (-0.48, f + 0.75, -0.36), "brick", sides=8, bevel=0))
    for i, (dy, r) in enumerate(((1.06, 0.06), (1.18, 0.08))):
        p.append(sphere(r, (-0.48 + 0.03 * i, f + dy, -0.36), "steam", subdivisions=1))
    # The big circular saw on its table, at the front right; the steel log crane over the logs.
    p.append(box((0.4, 0.14, 0.2), (0.3, f + 0.07, 0.22), "steel", bevel=0.006))
    p.append(cylinder(0.12, 0.012, (0.3, f + 0.16, 0.22), "steel", sides=16, bevel=0, tilt=(math.radians(90), 0)))
    p.append(log(0.3, 0.22, f + 0.14, length=0.4, color="wood"))
    for x in (0.18, 0.62):
        p.append(cylinder(0.02, 0.72, (x, f + 0.36, -0.36), "navy", sides=5, bevel=0))
    p.append(box((0.5, 0.04, 0.04), (0.4, f + 0.72, -0.36), "navy", bevel=0))
    p.append(rod((0.45, f + 0.7, -0.36), (0.45, f + 0.4, -0.36), 0.005, "dark", 3))
    p += log_pile(0.42, -0.36, f, rows=2, color="wood", length=0.32)
    return p


def electricity(s):
    p, f = floor("electricity")
    hx, hz, w, d = -0.2, -0.24, 0.7, 0.44
    p.append(box((w, 0.2, d), (hx, f + 0.1, hz), "brick", bevel=0.008))
    p.append(box((w - 0.04, 0.24, d - 0.04), (hx, f + 0.32, hz), "glass", bevel=0.004))
    p.append(prism_roof(w + 0.06, d + 0.06, 0.22, (hx, f + 0.44, hz), "glass"))
    for x in (-w / 2, 0, w / 2):
        p.append(prism_roof(0.03, d + 0.08, 0.23, (hx + x, f + 0.44, hz), "steel"))
    p += door(hx + 0.18, f + 0.2, hz + d / 2, w=0.14, h=0.2)
    # The log conveyor into the hall, its logs; overhead cables on two poles.
    p.append(box((0.5, 0.06, 0.14), (0.38, f + 0.12, 0.12), "dark", bevel=0.005))
    for x in (0.26, 0.5):
        p.append(log(x, 0.12, f + 0.15, length=0.12, color="wood", turn=math.radians(90)))
    for x, z in ((0.62, -0.32), (0.62, 0.36)):
        p.append(cylinder(0.018, 0.8, (x, f + 0.4, z), "wood", sides=5, bevel=0))
        p.append(box((0.14, 0.02, 0.02), (x, f + 0.76, z), "wood", bevel=0))
    p.append(rod((0.62, f + 0.76, -0.32), (0.62, f + 0.76, 0.36), 0.005, "dark", 3))
    p.append(rod((0.62, f + 0.76, -0.32), (hx + w / 2, f + 0.5, hz), 0.005, "dark", 3))
    p.extend(flag((-0.5, f + 0.44, -0.4), "copper", height=0.32))
    return p


def modern(s):
    p, f = floor("modern")
    # The workshop of timber and glass, a flat white roof.
    wx, wz, w, d = -0.26, -0.24, 0.64, 0.42
    p.append(box((w, 0.4, d), (wx, f + 0.2, wz), "wood", bevel=0.01))
    p.append(box((w - 0.12, 0.24, 0.02), (wx, f + 0.22, wz + d / 2 + 0.005), "glass", bevel=0.003))
    p.append(box((w + 0.06, 0.04, d + 0.06), (wx, f + 0.42, wz), "white", bevel=0.008))
    p += door(wx + 0.22, f, wz + d / 2, w=0.12, h=0.22, color="navy")
    # The robot saw arm on its base, at the front right.
    arm = "gold" if s >= 30 else "steel"
    bx, bz = 0.28, 0.22
    p.append(cylinder(0.08, 0.08, (bx, f + 0.04, bz), "navy", sides=10, bevel=0.01))
    p.append(rod((bx, f + 0.08, bz), (bx + 0.08, f + 0.36, bz - 0.04), 0.03, arm, 6))
    p.append(rod((bx + 0.08, f + 0.36, bz - 0.04), (bx + 0.3, f + 0.24, bz - 0.04), 0.025, arm, 6))
    p.append(cylinder(0.07, 0.01, (bx + 0.32, f + 0.2, bz - 0.04), "steel", sides=12, bevel=0, tilt=(math.radians(90), 0)))
    # The drying sheds: an open roof of solar panels on posts over stacked boards.
    for x in (0.18, 0.56):
        for z in (-0.44, -0.12):
            p.append(cylinder(0.014, 0.42, (x, f + 0.21, z), "steel", sides=4, bevel=0))
    p.append(box((0.48, 0.02, 0.4), (0.37, f + 0.44, -0.28), "solar", bevel=0, tilt=(math.radians(-10), 0)))
    for k in range(3):
        p.append(box((0.32, 0.035, 0.24), (0.37, f + 0.02 + 0.04 * k, -0.28), "plank", bevel=0.004, turn=0.02 * k))
    p.extend(flag((-0.52, f + 0.44, -0.4), "gold", height=0.3))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


F = {era: h for era, (h, _) in FLOOR.items()}

DETAILS = era_details(
    {
        "salvage": [(-0.55, 0.3), (0.55, 0.42), (-0.25, 0.42)],
        "colony": [(-0.5, 0.4), (-0.2, 0.42), (0.55, 0.42), (0.0, 0.42)],
        "workshop": [(-0.55, 0.38), (-0.2, 0.42), (0.15, 0.42), (0.6, 0.0)],
        "industry": [(-0.55, 0.38), (-0.2, 0.42), (0.0, 0.25), (0.62, 0.0)],
        "electricity": [(-0.55, 0.38), (-0.2, 0.42), (0.0, 0.3), (0.62, 0.0)],
        "modern": [(-0.55, 0.38), (-0.2, 0.42), (0.0, 0.42), (0.62, 0.38)],
    },
    # Its own: a stump with its axe, a sawhorse, a stack of planks.
    own={
        3: lambda s: [cylinder(0.07, 0.1, (0.55, 0.05, 0.42), "wood", sides=8, bevel=0), rod((0.55, 0.1, 0.42), (0.6, 0.24, 0.4), 0.008, "wood", 4), box((0.06, 0.04, 0.01), (0.6, 0.24, 0.4), "steel", bevel=0)],
        8: lambda s: [box((0.3, 0.035, 0.16), (0.55, F["colony"] + 0.02 + 0.04 * k, 0.42), "plank", bevel=0.004, turn=0.04 * k) for k in range(3)],
    },
)

_ = window
