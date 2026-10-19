"""
The Lighthouse (art direction: a white tower with red bands, a verdigris copper lantern), at its seven stages, and a
detail at every other level. It is the tallest building at every level: its top goes from 2.5 (stage 1) to 4.2
(stage 30), the others stay under it (a test checks every level). Its lantern's height goes in the manifest: the
game's beams and light go there.

From afar: its height and bands, a rock (1 to 9) then a stone plinth with a keeper's hut (10), a second gallery (15),
a brass lantern (20), a larger lantern room (25), a gold dome (30).
"""
import math

from kit import band, barrel, box, cone, crate, cylinder, drum, flag, lamp_post, lantern, prism_roof, rail_ring, ring, rod, rope_coil, sack

BASE = 0.3


def tower_height(s):
    return {1: 1.5, 5: 1.85, 10: 2.15, 15: 2.4, 20: 2.65, 25: 2.9, 30: 3.1}[s]


def tower_radius(s, t):
    """The tower's radius at `t` (0 at its foot, 1 at its top)."""
    foot = 0.46 if s < 10 else 0.5
    return foot - (foot - 0.27) * t


def lantern_y(s):
    return BASE + tower_height(s) + 0.06 + 0.17


def frame(s):
    return "navy" if s < 20 else "brass"


def base(s):
    p = []
    th = tower_height(s)
    if s < 10:
        # A rock of a few boulders, the tower on it.
        p.append(cylinder(0.72, BASE, (0, BASE / 2, 0), "rock", sides=8, bevel=0.06, top=0.66))
        for a, r, h in ((30, 0.2, 0.22), (150, 0.17, 0.18), (250, 0.22, 0.26), (320, 0.15, 0.16)):
            x, z = math.cos(math.radians(a)) * 0.64, math.sin(math.radians(a)) * 0.64
            p.append(cylinder(r, h, (x, h / 2, z), "rock_dark", sides=6, bevel=0.04, top=r * 0.6))
    else:
        # A stone plinth, its steps at the front, and the keeper's hut beside the tower.
        p.append(cylinder(0.76, BASE, (0, BASE / 2, 0), "stone", sides=8, bevel=0.04))
        p.append(cylinder(0.8, 0.05, (0, BASE - 0.02, 0), "stone_dark", sides=8, bevel=0.01))
        for i in range(2):
            p.append(box((0.34, 0.1, 0.12), (0, BASE - 0.1 - i * 0.1, 0.76 + i * 0.1), "stone", bevel=0.01))
        p.append(box((0.32, 0.3, 0.28), (0.5, BASE + 0.15, 0.3), "white", bevel=0.015))
        p.append(prism_roof(0.38, 0.34, 0.16, (0.5, BASE + 0.3, 0.3), "copper" if s >= 30 else "lighthouse_red"))
        p.append(box((0.08, 0.14, 0.02), (0.44, BASE + 0.07, 0.445), "dark", bevel=0.003))
    # The tower: bands of white and red, more of them as it grows.
    bands = {1: 4, 5: 5, 10: 6, 15: 6, 20: 7, 25: 7, 30: 8}[s]
    for i in range(bands):
        t0, t1 = i / bands, (i + 1) / bands
        h = th / bands
        p.append(cylinder(tower_radius(s, t0), h, (0, BASE + h * (i + 0.5), 0), "white" if i % 2 == 0 else "lighthouse_red", sides=14, bevel=0, top=tower_radius(s, t1)))
    # Its door and windows, at the front.
    p.append(box((0.16, 0.26, 0.03), (0, BASE + 0.13, tower_radius(s, 0.05) - 0.005), "dark", bevel=0.006))
    for t in (0.35, 0.62, 0.86):
        if t * th < 0.45:
            continue
        p.append(box((0.09, 0.13, 0.03), (0, BASE + th * t, tower_radius(s, t) - 0.01), "dark", bevel=0.004))
    top = BASE + th
    # A gallery under the lantern (from 5), a second one halfway (from 15).
    if s >= 5:
        p.append(cylinder(0.4, 0.05, (0, top + 0.025, 0), "navy", sides=12, bevel=0.01))
        p.extend(rail_ring(0.38, (0, top + 0.05, 0), color=frame(s), posts=8, height=0.12))
    if s >= 15:
        mid = BASE + th * 0.55
        r = tower_radius(s, 0.55)
        p.append(band(r + 0.06, 0.05, (0, mid, 0), "navy", sides=14))
        p.extend(rail_ring(r + 0.09, (0, mid + 0.02, 0), color=frame(s), posts=8, height=0.1))
    # The lantern room: gold glass in its frame, a verdigris cap; larger from 25, a gold dome at 30.
    lr = 0.24 if s < 25 else 0.29
    lh = 0.32 if s < 25 else 0.38
    p.append(cylinder(lr + 0.04, 0.06, (0, top + 0.03, 0), frame(s), sides=10, bevel=0.008))
    p.append(cylinder(lr, lh, (0, top + 0.06 + lh / 2, 0), "gold", sides=10, bevel=0))
    for i in range(6):
        a = math.radians(i * 60 + 30)
        p.append(rod((math.cos(a) * lr, top + 0.06, math.sin(a) * lr), (math.cos(a) * lr, top + 0.06 + lh, math.sin(a) * lr), 0.016, frame(s), 4))
    cap = "gold" if s >= 30 else "copper"
    p.append(cone(lr + 0.08, 0.3, (0, top + 0.06 + lh, 0), cap, sides=10))
    p.append(cylinder(0.035, 0.1, (0, top + 0.06 + lh + 0.33, 0), "brass", sides=6, bevel=0))
    if s >= 30:
        p.append(cylinder(0.06, 0.08, (0, top + 0.06 + lh + 0.42, 0), "gold", sides=8, bevel=0.02, top=0.02))
    return p


def meta(s):
    lh = 0.32 if s < 25 else 0.38
    return {"lantern": round(BASE + tower_height(s) + 0.06 + lh / 2, 3)}


def on_base(angle, r=0.6):
    a = math.radians(angle)
    return (math.cos(a) * r, BASE, math.sin(a) * r)


def on_tower(s, angle, t, out=0.012):
    a = math.radians(angle)
    r = tower_radius(s, t) + out
    return (math.cos(a) * r, BASE + tower_height(s) * t, math.sin(a) * r)


# A detail at every level that is not a stage: on the rock or plinth around the tower (its front half, which the
# camera sees), on the tower's wall, on the galleries and the cap.
DETAILS = {
    2: lambda s: crate(on_base(150), size=0.14),
    3: lambda s: rope_coil(on_base(120, 0.62), radius=0.07),
    4: lambda s: barrel((*on_base(40, 0.62)[:1], BASE + 0.1, on_base(40, 0.62)[2]), radius=0.075, height=0.2),
    6: lambda s: lamp_post(on_base(70, 0.62), height=0.4),
    7: lambda s: [ring(0.08, 0.025, 0.035, on_tower(s, 115, 0.22, out=0.03), "lighthouse_red", sides=8)],
    8: lambda s: [drum(on_base(170, 0.6), color="navy", radius=0.07, height=0.18)],
    9: lambda s: flag((0.42, BASE, -0.42), "cream", height=0.55),
    11: lambda s: [sack(on_base(135, 0.66), size=0.13), sack(on_base(150, 0.7), size=0.12)],
    12: lambda s: [box((0.14, 0.1, 0.02), on_tower(s, 90, 0.12, out=0.02), "brass", bevel=0.004)],
    13: lambda s: [box((0.24, 0.05, 0.08), (-0.45, BASE + 0.12, 0.55), "wood", bevel=0.006), box((0.04, 0.12, 0.08), (-0.55, BASE + 0.06, 0.55), "wood", bevel=0), box((0.04, 0.12, 0.08), (-0.35, BASE + 0.06, 0.55), "wood", bevel=0)],
    14: lambda s: [cylinder(0.05, 0.14, (0.5, BASE + 0.37, 0.3), "dark", sides=6, bevel=0)],
    16: lambda s: [rod(on_tower(s, 60, 0.75, out=0.0), (0.42, BASE + tower_height(s) * 0.62, 0.42), 0.006, "dark", 3), *[box((0.06, 0.07, 0.006), (0.15 + 0.07 * i, BASE + tower_height(s) * (0.73 - 0.03 * i), 0.15 + 0.07 * i), c, bevel=0) for i, c in enumerate(("gold", "navy", "cream"))]],
    17: lambda s: [cylinder(0.025, 0.2, (0.3, BASE + tower_height(s) + 0.17, 0.2), "brass", sides=6, bevel=0, tilt=(math.radians(70), 0), turn=0.4)],
    18: lambda s: [cylinder(0.06, 0.08, (-0.28, BASE + tower_height(s) + 0.1, 0.28), "dark", sides=6, bevel=0), cone(0.035, 0.06, (-0.28, BASE + tower_height(s) + 0.14, 0.28), "cream", sides=4)],
    19: lambda s: [box((0.03, 0.04, 0.16), (0, BASE + tower_height(s) + 0.06 + 0.32 + 0.38, 0), "dark", bevel=0), cone(0.03, 0.08, (0, BASE + tower_height(s) + 0.06 + 0.32 + 0.4, 0.09), "gold", sides=4)],
    21: lambda s: [lantern(on_tower(s, 60, 0.3, out=0.06), size=0.07)],
    22: lambda s: [drum(on_base(20, 0.68), color="copper", radius=0.06, height=0.15), drum(on_base(5, 0.68), color="copper", radius=0.06, height=0.15)],
    23: lambda s: [cylinder(0.05, 0.05, (-0.62, BASE + 0.025, -0.1), "brass", sides=8, bevel=0), cylinder(0.02, 0.3, (-0.62, BASE + 0.2, -0.1), "navy", sides=5, bevel=0), cone(0.07, 0.09, (-0.62, BASE + 0.38, -0.1), "brass", sides=8)],
    24: lambda s: [ring(0.07, 0.015, 0.02, on_tower(s, 90, 0.45, out=0.02), "gold", sides=8)],
    26: lambda s: [box((0.06, 0.06, 0.06), (0.38 * math.cos(math.radians(a)), BASE + tower_height(s) + 0.2, 0.38 * math.sin(math.radians(a))), "gold", bevel=0.01) for a in (45, 135)],
    27: lambda s: [cylinder(0.12, 0.03, (-0.52, BASE + 0.015, 0.35), "brass", sides=8, bevel=0)],
    28: lambda s: [crate((0.62, BASE, -0.05), size=0.11, color="wood")],
    29: lambda s: [band(tower_radius(s, 0.08) + 0.015, 0.04, (0, BASE + tower_height(s) * 0.08, 0), "gold", sides=14)],
}
