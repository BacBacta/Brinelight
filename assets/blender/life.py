"""
The island's life (week 8, meeting 4): the survivors who walk its paths and work at its buildings, the tools they hold,
and (below) its animals and plants. Display only: nothing here changes a rule or a city's data.

One survivor for all of them (owner: one model, many instances): the game tints their shirt, trousers and skin per
instance and moves their legs, arms and head in its shader (client/src/city/life.ts), each part found by where its
vertices are in this rest pose. So the parts keep to these places (client/test/life.test.ts checks the served file):

- the legs (and boots) under HIP, within LEG_X of the middle; they turn at the hips;
- the arms (and hands) beyond ARM_X of the middle, from the hands' bottom up to the shoulders; they turn at SHOULDER;
- the head over NECK, the hat over HAT; the head turns at the neck;
- the pack on the back, behind PACK_Z; the rest is the body.

The survivor stands on y = 0, faces +z, about 0.21 tall (a door is 0.22). A tool is held in the right hand and turns
with the right arm: it is made where it would be with the arm hanging, `unposed` from where it shows at work.
"""
import math

from kit import box, cone, cylinder, rod, sphere

HIP = 0.09
SHOULDER = 0.155
NECK = 0.162
HAT = 0.193
LEG_X = 0.03
ARM_X = 0.03
PACK_Z = -0.0175
ARM = 0.039  # the arms' distance from the middle
HAND = (ARM, 0.091, 0.0)


def survivor():
    p = []
    for s in (-1, 1):
        p.append(box((0.022, 0.012, 0.032), (s * 0.016, 0.006, 0.004), "dark", bevel=0))
        p.append(box((0.02, 0.078, 0.022), (s * 0.016, 0.051, 0.0), "white", bevel=0))
        p.append(box((0.016, 0.06, 0.018), (s * ARM, 0.128, 0.0), "white", bevel=0))
        p.append(box((0.016, 0.014, 0.016), (s * ARM, 0.091, 0.0), "white", bevel=0))
    p.append(box((0.058, 0.07, 0.034), (0.0, 0.125, 0.0), "white", bevel=0))
    p.append(sphere(0.021, (0.0, 0.181, 0.002), "white", subdivisions=1))
    # A wide-brimmed hat and a pack: the survivors carry what they own.
    p.append(cylinder(0.03, 0.006, (0.0, 0.197, 0.0), "wood", sides=8, bevel=0))
    p.append(cylinder(0.019, 0.018, (0.0, 0.209, 0.0), "wood", sides=6, bevel=0))
    p.append(box((0.04, 0.045, 0.016), (0.0, 0.13, -0.026), "wood", bevel=0))
    return p


def unposed(point, angle):
    """Where a point held by the right hand is with the arm hanging, if it is at `point` with the arm turned by `angle`."""
    x, y, z = point
    dy, c, s = y - SHOULDER, math.cos(-angle), math.sin(-angle)
    return (x, SHOULDER + dy * c - z * s, dy * s + z * c)


def hammer():
    hx, hy, hz = HAND
    return [rod((hx, hy, hz + 0.006), (hx, hy - 0.05, hz + 0.02), 0.004, "wood", 4), box((0.012, 0.012, 0.03), (hx, hy - 0.052, hz + 0.022), "dark", bevel=0)]


def axe():
    hx, hy, hz = HAND
    return [rod((hx, hy + 0.01, hz + 0.004), (hx, hy - 0.07, hz + 0.02), 0.004, "wood", 4), box((0.006, 0.026, 0.03), (hx, hy - 0.064, hz + 0.036), "steel", bevel=0)]


def barrel_held():
    # Carried in both arms against the chest (the arms at -1.0).
    at = unposed((0.0, 0.11, 0.05), -1.0)
    return [cylinder(0.026, 0.05, at, "wood", sides=8, bevel=0), cylinder(0.027, 0.006, at, "navy", sides=8, bevel=0)]


def fishing_rod():
    # Held out over the water (the arms at -1.2), its line falling to the sea.
    hand = unposed((ARM, 0.132, 0.06), -1.2)
    tip = unposed((ARM, 0.3, 0.34), -1.2)
    sea = unposed((ARM, -0.3, 0.36), -1.2)
    return [rod(hand, tip, 0.003, "wood", 4), rod(tip, sea, 0.0012, "cream", 3)]


def watering_can():
    hx, hy, hz = HAND
    return [box((0.026, 0.026, 0.03), (hx, hy - 0.018, hz + 0.004), "copper", bevel=0), rod((hx, hy - 0.024, hz + 0.018), (hx, hy - 0.044, hz + 0.05), 0.003, "copper", 4)]


def spyglass():
    # Held to the eye (the right arm at -2.2).
    a, b = unposed((0.022, 0.184, 0.03), -2.2), unposed((0.022, 0.19, 0.1), -2.2)
    return [rod(a, b, 0.006, "brass", 6)]


def poker():
    hx, hy, hz = HAND
    return [rod((hx, hy, hz + 0.006), (hx, hy - 0.085, hz + 0.07), 0.0025, "dark", 4)]


TOOLS = {"hammer": hammer, "axe": axe, "barrel": barrel_held, "rod": fishing_rod, "can": watering_can, "spyglass": spyglass, "poker": poker}

EXTRAS = {"life-survivor": survivor}
for _name, _make in TOOLS.items():
    EXTRAS[f"life-tool-{_name}"] = _make


# The animals (owner: gulls over the coast that land on the roofs, a cat on the quay, hens by the shelters, crabs on the
# beach, a dolphin or fish leaping far off now and then). Each faces +z; the game's shader (client/src/city/life/
# creatures.ts) moves the parts found here: a gull's wings beyond WING_X, a cat's tail behind TAIL_Z and its head in
# front of HEAD_Z, a hen's head in front of HEAD_Z, a crab's legs beyond LEGS_X, a dolphin's or a fish's tail behind
# TAIL_Z.
WING_X = 0.014
TAIL_Z = -0.045
HEAD_Z = 0.03
LEGS_X = 0.025


def gull():
    p = [cylinder(0.012, 0.07, (0, 0.02, 0), "white", sides=6, bevel=0, tilt=(math.radians(90), 0))]
    p.append(box((0.018, 0.018, 0.02), (0, 0.03, 0.04), "white", bevel=0))
    p.append(cone(0.005, 0.016, (0, 0.03, 0.05), "gold", sides=4))
    for s in (-1, 1):
        p.append(box((0.07, 0.004, 0.03), (s * (WING_X + 0.036), 0.024, 0.0), "white", bevel=0))
        p.append(box((0.024, 0.0045, 0.022), (s * (WING_X + 0.062), 0.024, -0.004), "stone_dark", bevel=0))
    p.append(box((0.016, 0.004, 0.02), (0, 0.022, -0.042), "stone", bevel=0))
    return p


def cat():
    p = [box((0.03, 0.03, 0.06), (0, 0.03, 0), "brass", bevel=0)]
    p.append(box((0.03, 0.026, 0.024), (0, 0.06, 0.035), "brass", bevel=0))
    for s in (-1, 1):
        p.append(cone(0.007, 0.012, (s * 0.009, 0.073, 0.035), "brass", sides=3))
        p.append(box((0.008, 0.02, 0.008), (s * 0.009, 0.01, 0.022), "cream", bevel=0))
    p.append(rod((0, 0.02, -0.03), (0.012, 0.045, -0.07), 0.004, "brass", 4))
    return p


def hen():
    p = [sphere(0.022, (0, 0.035, 0), "cream", subdivisions=1, squash=0.85)]
    p.append(box((0.014, 0.018, 0.014), (0, 0.055, HEAD_Z + 0.006), "cream", bevel=0))
    p.append(box((0.004, 0.008, 0.01), (0, 0.067, HEAD_Z + 0.006), "brick", bevel=0))
    p.append(cone(0.004, 0.01, (0, 0.054, HEAD_Z + 0.016), "gold", sides=4))
    for s in (-1, 1):
        p.append(rod((s * 0.008, 0.016, 0), (s * 0.008, 0.0, 0.004), 0.002, "gold", 3))
    return p


def crab():
    p = [sphere(0.016, (0, 0.012, 0), "brick", subdivisions=1, squash=0.5)]
    for s in (-1, 1):
        p.append(box((0.01, 0.008, 0.014), (s * 0.016, 0.012, 0.02), "brick", bevel=0))
        for k in range(3):
            p.append(rod((s * 0.012, 0.01, -0.008 + 0.008 * k), (s * (LEGS_X + 0.012), 0.0, -0.012 + 0.01 * k), 0.0018, "brick", 3))
    return p


def dolphin():
    p = [cylinder(0.04, 0.34, (0, 0, 0.0), "steel", sides=8, bevel=0, top=0.02, tilt=(math.radians(-90), 0))]
    p.append(cone(0.04, 0.03, (0, 0.03, 0.02), "steel", sides=4))
    p.append(cylinder(0.014, 0.06, (0, 0, 0.2), "steel", sides=6, bevel=0, top=0.006, tilt=(math.radians(-90), 0)))
    p.append(box((0.12, 0.008, 0.03), (0, 0, -0.18), "steel", bevel=0))
    return p


def fish():
    p = [sphere(0.012, (0, 0, 0), "white", subdivisions=1, squash=1.0)]
    p[0].scale = (0.5, 2.0, 1.0)
    p.append(box((0.002, 0.014, 0.012), (0, 0, -0.026), "steel", bevel=0))
    return p


for _name, _make in {"gull": gull, "cat": cat, "hen": hen, "crab": crab, "dolphin": dolphin, "fish": fish}.items():
    EXTRAS[f"life-{_name}"] = _make


# The island's plants, in three looks that follow the Lighthouse (owner): wild at first (1–9), tended gardens next
# (10–24), vegetable plots and trees planted in rows in the Modern era (25–30). The game sways them in the wind from
# their foot (y = 0) up, and never lets them hide a building (client/test/visible.test.ts).
def wild_tree():
    p = [rod((0, 0, 0), (0.03, 0.22, 0.01), 0.02, "wood", 5), rod((0.03, 0.22, 0.01), (-0.02, 0.36, 0.0), 0.016, "wood", 5)]
    for (x, y, z, r, c) in ((-0.02, 0.4, 0.0, 0.12, "meadow_dark"), (0.08, 0.33, 0.04, 0.09, "meadow"), (-0.09, 0.3, -0.03, 0.08, "meadow_dark")):
        p.append(sphere(r, (x, y, z), c, subdivisions=1, squash=0.8))
    return p


def wild_bush():
    return [sphere(0.07, (0, 0.05, 0), "meadow_dark", subdivisions=1, squash=0.75), sphere(0.055, (0.06, 0.04, 0.02), "meadow", subdivisions=1, squash=0.75)]


def grass():
    return [cone(0.012, 0.07 + 0.015 * k, (0.015 * (k - 1), 0, 0.01 * (k % 2)), "meadow" if k % 2 else "meadow_dark", sides=3, turn=k) for k in range(3)]


def wild_flowers():
    p = [cone(0.03, 0.04, (0, 0, 0), "meadow_dark", sides=4)]
    for k, c in enumerate(("cream", "gold", "brick")):
        a = k * 2.1
        p.append(cone(0.01, 0.02, (math.cos(a) * 0.02, 0.035, math.sin(a) * 0.02), c, sides=3))
    return p


def garden_tree():
    return [cylinder(0.018, 0.24, (0, 0.12, 0), "wood", sides=5, bevel=0), sphere(0.15, (0, 0.36, 0), "meadow", subdivisions=1, squash=0.9)]


def hedge():
    return [box((0.3, 0.1, 0.09), (0, 0.05, 0), "meadow_dark", bevel=0)]


def flowerbed():
    p = [box((0.26, 0.03, 0.12), (0, 0.015, 0), "wood", bevel=0)]
    for k in range(6):
        p.append(cone(0.016, 0.04, (-0.09 + 0.036 * k, 0.03, 0.025 * (k % 2 * 2 - 1)), ("brick", "gold", "cream")[k % 3], sides=4))
    return p


def modern_tree():
    return [cylinder(0.015, 0.1, (0, 0.05, 0), "wood", sides=4, bevel=0), cone(0.09, 0.38, (0, 0.08, 0), "meadow_dark", sides=6)]


def vegetable_plot():
    p = [box((0.42, 0.03, 0.28), (0, 0.015, 0), "earth", bevel=0)]
    # Three rows: greens, tomatoes, squash (their colors, no fruit modelled: a plot is small on screen).
    for k, c in enumerate(("meadow", "brick", "meadow_dark")):
        p.append(box((0.36, 0.04, 0.045), (0, 0.045, -0.09 + 0.09 * k), c, bevel=0))
    return p


PLANTS = {
    "wild-tree": wild_tree, "wild-bush": wild_bush, "grass": grass, "wild-flowers": wild_flowers,
    "garden-tree": garden_tree, "hedge": hedge, "flowerbed": flowerbed, "modern-tree": modern_tree, "veg": vegetable_plot,
}
for _name, _make in PLANTS.items():
    EXTRAS[f"life-plant-{_name}"] = _make


# Washing drying on a line between two posts (the game flaps the cloths, below LINE_Y, in the wind).
LINE_Y = 0.2


def laundry():
    p = [cylinder(0.008, LINE_Y + 0.01, (0, (LINE_Y + 0.01) / 2, z), "wood", sides=4, bevel=0) for z in (-0.28, 0.28)]
    p.append(rod((0, LINE_Y, -0.28), (0, LINE_Y, 0.28), 0.0022, "cream", 3))
    for k, (z, w, h, c) in enumerate(((-0.19, 0.08, 0.07, "cream"), (-0.08, 0.07, 0.09, "navy"), (0.03, 0.09, 0.06, "brick"), (0.15, 0.07, 0.08, "white"))):
        p.append(box((0.004, h, w), (0, LINE_Y - h / 2 - 0.004, z), c, bevel=0))
    return p


EXTRAS["life-laundry"] = laundry
