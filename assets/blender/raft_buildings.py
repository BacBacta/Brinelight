"""
The buildings on rafts (week 8, meeting 3): the Kelp Greenhouse, the Smokehouse and the Watchtower at their levels 1 to 3
(their highest), in the floating village's three ages (raft.py: driftwood, tarred, steel, after the Lighthouse's level).
Level 2 adds a detail, level 3 is their transformation (docs/tasks/week-8.md, "The buildings of the rafts"):

- Kelp Greenhouse: kelp beds under an awning; 2, a row of kelp trays at the front; 3, a glass roof over the beds, lit
  from inside, and a water barrel;
- Smokehouse: a hut and its chimney; 2, a rack of hanging fish; 3, a taller chimney with a lit lantern, and a pile of wood;
- Watchtower: a platform on four legs; 2, a shield and a spyglass on its rail; 3, a higher platform with a flag and a
  signal lamp.
- House (step 2 of the population, owner, 25 October): on a raft, a small driftwood cabin under a roof of faded red
  sailcloth (the Smokehouse keeps its planks), its door, a window and a washing line with three clothes; only at level 1
  and of driftwood, the rafts floating only before the Lighthouse 5 (from then on the city fabric draws the
  Houses on their land, client/src/city/fabric/plan.ts).

Each stands on the middle of its raft's deck (y = 0 is the deck's top), facing the camera: the corners keep
the raft's own things, the middles of its sides its walkways, and its front corner a damaged raft's mark.
"""
import math

from kit import barrel, box, cone, cylinder, flag, lantern, prism_roof, rod, sphere
from parts import door, washing_line, window
from raft import AGES, LOOK

# A building takes its deck's middle: x within ±0.46, z from -0.47 to 0.44 (client/test/village.test.ts).
WALL = {1: "plank", 10: "wood", 20: "steel"}
ROOF = {1: "wood", 10: "dark", 20: "tin"}


def kelp_bed(x, z, age, w=0.66):
    out = [box((w, 0.1, 0.18), (x, 0.05, z), WALL[age] if age < 20 else "steel", bevel=0.008), box((w - 0.04, 0.012, 0.14), (x, 0.1, z), "seabed", bevel=0)]
    n = 6
    for k in range(n):
        out.append(box((0.024, 0.16 + 0.04 * (k % 3), 0.02), (x - w / 2 + w * (k + 0.5) / n, 0.18, z + 0.03 * (k % 2 - 0.5)), "copper" if k % 2 else "meadow_dark", bevel=0, tilt=(0.18 * ((k % 3) - 1), 0)))
    return out


def greenhouse(level, age):
    look = LOOK[age]
    p = kelp_bed(0, -0.16, age) + kelp_bed(0, 0.14, age)
    if level < 3:
        # The awning over the back bed: canvas on driftwood, tarred planks, or glass in a steel frame.
        for x in (-0.36, 0.36):
            for z in (-0.32, 0.0):
                p.append(cylinder(0.016, 0.46 if z < -0.1 else 0.36, (x, (0.46 if z < -0.1 else 0.36) / 2, z), look["post"], sides=5, bevel=0))
        roof = {1: "cream", 10: "wood", 20: "glass"}[age]
        p.append(box((0.82, 0.02, 0.42), (0, 0.42, -0.16), roof, bevel=0.006, tilt=(math.radians(14), 0)))
    else:
        # The glass roof over both beds, its frame, the light inside; the water barrel.
        p.append(box((0.84, 0.36, 0.64), (0, 0.18, -0.01), "glass", bevel=0.004))
        p.append(prism_roof(0.9, 0.7, 0.22, (0, 0.36, -0.01), "glass"))
        for x in (-0.42, 0.0, 0.42):
            p.append(prism_roof(0.03, 0.72, 0.23, (x, 0.36, -0.01), look["post"]))
            p.append(box((0.03, 0.36, 0.03), (x, 0.18, 0.31), look["post"], bevel=0))
        p.append(box((0.86, 0.03, 0.03), (0, 0.36, 0.31), look["post"], bevel=0))
        for x in (-0.2, 0.2):
            p.append(sphere(0.035, (x, 0.48, -0.01), "gold", subdivisions=1))
        p += barrel((0.3, 0.1, -0.39), radius=0.07, height=0.2, color="wood" if age < 20 else "steel", hoop=look["hoop"])
    if level >= 2:
        # A row of kelp trays along the front.
        for x in (-0.3, 0.0, 0.3):
            p.append(box((0.18, 0.05, 0.08), (x, 0.025, 0.38), look["beam"] if age > 1 else "plank", bevel=0.004))
            for k in range(3):
                p.append(box((0.02, 0.09, 0.02), (x - 0.05 + 0.05 * k, 0.09, 0.38), "copper" if k % 2 else "meadow", bevel=0))
    return p


def chimney(x, z, top, age):
    if age == 20:
        return [cylinder(0.05, top, (x, top / 2, z), "steel", sides=8, bevel=0), cylinder(0.065, 0.04, (x, top, z), "dark", sides=8, bevel=0)]
    color = "stone" if age == 1 else "brick"
    return [box((0.13, top, 0.13), (x, top / 2, z), color, bevel=0.006), box((0.16, 0.04, 0.16), (x, top, z), "stone_dark", bevel=0)]


def fish_rack(x, z, look):
    out = [cylinder(0.012, 0.3, (x + dx, 0.15, z), look["post"], sides=4, bevel=0) for dx in (-0.12, 0.12)]
    out.append(rod((x - 0.12, 0.28, z), (x + 0.12, 0.28, z), 0.007, look["post"], 4))
    for k in range(4):
        out.append(box((0.02, 0.08, 0.008), (x - 0.09 + 0.06 * k, 0.22, z), "gold" if k % 2 else "stone_dark", bevel=0))
    return out


def smokehouse(level, age):
    look = LOOK[age]
    hx, hz, w, d, h = -0.08, -0.1, 0.6, 0.46, 0.42
    p = [box((w, h, d), (hx, h / 2, hz), WALL[age], bevel=0.008)]
    p.append(prism_roof(w + 0.08, d + 0.08, 0.18, (hx, h, hz), ROOF[age]))
    p += door(hx - 0.08, 0, hz + d / 2, w=0.12, h=0.22, color="dark")
    p += window(hx + 0.13, 0.22, hz + d / 2, w=0.08, h=0.08, frame=look["post"])
    if age == 10:
        for y in (0.08, 0.28):
            p.append(box((0.05, 0.02, 0.01), (hx - 0.12, y, hz + d / 2 + 0.012), "steel", bevel=0))
    top = 1.0 if level >= 3 else 0.7
    cx, cz = hx + 0.2, hz - 0.12
    p += chimney(cx, cz, top, age)
    for i, (dy, r) in enumerate(((0.12, 0.05), (0.24, 0.065))):
        p.append(sphere(r, (cx + 0.03 * i, top + dy, cz), "steam", subdivisions=1))
    if level >= 2:
        p += fish_rack(0.3, 0.3, look)
    if level >= 3:
        # The lit lantern on the chimney, the pile of wood at the front.
        p.append(rod((cx, top - 0.1, cz), (cx - 0.16, top - 0.1, cz), 0.008, "dark", 4))
        p += lantern((cx - 0.16, top - 0.18, cz), size=0.07)
        for i, (dx, dy) in enumerate(((-0.06, 0.035), (0.06, 0.035), (0.0, 0.095))):
            p.append(cylinder(0.035, 0.3, (-0.24 + dx, dy, 0.32), "wood", sides=6, bevel=0, tilt=(0, math.radians(90))))
    return p


def watchtower(level, age):
    look = LOOK[age]
    deck = 1.0 if level >= 3 else 0.72
    s = 0.2
    p = []
    for x in (-s, s):
        for z in (-s, s):
            p.append(cylinder(0.022, deck, (x * (1 if age == 20 else 1.05), deck / 2, z), look["post"], sides=5 if age < 20 else 4, bevel=0))
    # Braces: rope, iron, or a steel lattice.
    for y0, y1 in ((0.06, deck * 0.5), (deck * 0.5, deck - 0.04)):
        for z in (-s, s):
            p.append(rod((-s, y0, z), (s, y1, z), 0.007, look["rope"] if age == 1 else "dark" if age == 10 else "steel", 3))
        for x in (-s, s):
            p.append(rod((x, y0, -s), (x, y1, s), 0.007, look["rope"] if age == 1 else "dark" if age == 10 else "steel", 3))
    p.append(box((0.56, 0.04, 0.56), (0, deck + 0.02, 0), "plank" if age < 20 else "steel", bevel=0.006))
    # The rail around the platform, a small roof over it.
    for x, z, w, d in ((0, -0.27, 0.56, 0.02), (0, 0.27, 0.56, 0.02), (-0.27, 0, 0.02, 0.56), (0.27, 0, 0.02, 0.56)):
        p.append(box((w, 0.02, d), (x, deck + 0.16, z), look["post"], bevel=0))
    for x in (-0.27, 0.27):
        for z in (-0.27, 0.27):
            p.append(box((0.025, 0.3, 0.025), (x, deck + 0.15, z), look["post"], bevel=0))
    p.append(cone(0.42, 0.18, (0, deck + 0.3, 0), ROOF[age] if age != 1 else "cream", sides=4, turn=math.radians(45)))
    # The ladder up the front.
    p.append(rod((-0.08, 0, 0.32), (-0.08, deck, 0.24), 0.01, look["post"], 4))
    p.append(rod((0.08, 0, 0.32), (0.08, deck, 0.24), 0.01, look["post"], 4))
    for k in range(1, int(deck / 0.12)):
        t = k * 0.12 / deck
        p.append(rod((-0.08, deck * t, 0.32 - 0.08 * t), (0.08, deck * t, 0.32 - 0.08 * t), 0.007, look["post"], 3))
    if level >= 2:
        # A shield on the rail, a spyglass on its rest.
        p.append(cylinder(0.08, 0.02, (0.14, deck + 0.13, 0.285), "navy", sides=10, bevel=0, tilt=(math.radians(90), 0)))
        p.append(cylinder(0.03, 0.024, (0.14, deck + 0.13, 0.295), "gold", sides=8, bevel=0, tilt=(math.radians(90), 0)))
        p.append(rod((-0.24, deck + 0.18, -0.1), (-0.12, deck + 0.22, 0.2), 0.016, "brass", 8))
    if level >= 3:
        # A flag and a signal lamp at the top.
        p.extend(flag((-0.27, deck + 0.3, -0.27), "cream" if age == 1 else "navy" if age == 10 else "copper", height=0.4))
        p.append(sphere(0.05, (0, deck + 0.5, 0), "gold", subdivisions=1))
    return p


def house(level, age):
    look = LOOK[age]
    hx, hz, w, d, h = 0.0, -0.06, 0.5, 0.4, 0.3
    p = [box((w, h, d), (hx, h / 2, hz), WALL[age], bevel=0.008)]
    # A sail's canvas for a roof, overhanging a little: never the Smokehouse's planks.
    p.append(prism_roof(w + 0.12, d + 0.12, 0.2, (hx, h, hz), "sail_red"))
    p += door(hx - 0.1, 0, hz + d / 2, w=0.11, h=0.2, color="dark")
    p += window(hx + 0.11, 0.17, hz + d / 2, w=0.08, h=0.08, frame=look["post"])
    # The washing on a line at the front corner.
    p += washing_line((0.12, 0, 0.36), (0.42, 0, 0.2), colors=("cream", "navy", "white"))
    return p


BUILD = {"greenhouse": greenhouse, "smokehouse": smokehouse, "watchtower": watchtower}
EXTRAS = {}
for _id, _make in BUILD.items():
    for _age in AGES:
        for _level in (1, 2, 3):
            EXTRAS[f"{_id}-{_level}-age{_age}"] = (lambda m, l, a: lambda: m(l, a))(_make, _level, _age)
# The House floats only before the Lighthouse 5: its cabin at level 1, of driftwood.
EXTRAS["house-1-age1"] = lambda: house(1, 1)
