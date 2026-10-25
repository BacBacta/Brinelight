"""
Pieces the buildings share across the eras (week 8): an era's floor, a house with its windows and door at the front, a
tent, a washing line, a palisade, a single-slope roof. The camera looks from the front (+z): doors and windows go
there. Game units: a plot is 2 wide, everything stays within 0.93 of its center (hex distance).
"""
import math

import bmesh
import bpy

import kit
from kit import box, cylinder, prism_roof, rod

# Each era's floor: its height and what it is made of.
FLOOR = {"salvage": (0.0, None), "colony": (0.16, "stone"), "workshop": (0.14, "stone_dark"), "industry": (0.1, "concrete"), "electricity": (0.1, "concrete"), "modern": (0.08, "concrete")}


def floor(era, width=1.4, depth=1.2):
    """The era's floor under a building; Salvage has none (its huts stand on the meadow or on boards)."""
    h, color = FLOOR[era]
    return ([box((width, h, depth), (0, h / 2, 0), color, bevel=0.02)], h) if color else ([], 0.0)


def boards(width, depth, at, colors=("plank", "wood"), count=3):
    """A deck of mismatched driftwood boards, lying side by side front to back."""
    x, y, z = at
    out = []
    for i in range(count):
        dz = -depth / 2 + depth * (i + 0.5) / count
        out.append(box((width * (1 - 0.05 * (i % 2)), 0.05, depth / count * 0.95), (x + 0.02 * (i % 2), y + 0.025, z + dz), colors[i % len(colors)], bevel=0.01, turn=0.03 * (1 if i % 2 else -1)))
    return out


def window(x, y, z, w=0.12, h=0.14, color="glass", frame="wood"):
    """A window on a front wall (its face at z): glass in a frame."""
    return [box((w + 0.03, h + 0.03, 0.015), (x, y, z + 0.004), frame, bevel=0), box((w, h, 0.02), (x, y, z + 0.008), color, bevel=0.003)]


def door(x, y, z, w=0.14, h=0.24, color="dark"):
    """A door on a front wall, its foot at y."""
    return [box((w, h, 0.02), (x, y + h / 2, z + 0.006), color, bevel=0.004)]


def house(x, z, w, d, h, wall, roof, foot=0.0, roof_h=0.22, windows=(), door_at=None, eave=0.05):
    """
    A house: walls `wall`, a gabled roof `roof` (its ridge across the front), windows at (dx, dy) on the front wall and a
    door at dx. Returns the parts and the height of its eaves.
    """
    out = [box((w, h, d), (x, foot + h / 2, z), wall, bevel=0.01)]
    out.append(prism_roof(w + eave * 2, d + eave * 2, roof_h, (x, foot + h, z), roof))
    for dx, dy in windows:
        out += window(x + dx, foot + dy, z + d / 2)
    if door_at is not None:
        out += door(x + door_at, foot, z + d / 2)
    return out


def tent(x, z, w, d, h, color, foot=0.0, turn=0.0):
    """A ridge tent of canvas or tarpaulin, its ridge across the front."""
    return [prism_roof(w, d, h, (x, foot, z), color, turn=turn)]


def washing_line(a, b, colors=("cream", "white", "navy"), cloth=(0.09, 0.12)):
    """Two poles, a rope between them, cloths hanging on it (`cloth`: their width and height)."""
    (ax, ay, az), (bx, by, bz) = a, b
    h = 0.42
    out = [cylinder(0.018, h, (ax, ay + h / 2, az), "wood", sides=5, bevel=0), cylinder(0.018, h, (bx, by + h / 2, bz), "wood", sides=5, bevel=0)]
    out.append(rod((ax, ay + h - 0.02, az), (bx, by + h - 0.02, bz), 0.006, "plank", 3))
    n = len(colors)
    for i, c in enumerate(colors):
        t = (i + 1) / (n + 1)
        out.append(box((cloth[0], cloth[1], 0.01), (ax + (bx - ax) * t, ay + h - 0.03 - cloth[1] / 2, az + (bz - az) * t), c, bevel=0, turn=math.atan2(bz - az, bx - ax) * -1))
    return out


def palisade(points, h=0.32, color="wood", foot=0.0):
    """Sharpened posts along a line of points, one at each and between them."""
    out = []
    for (ax, az), (bx, bz) in zip(points, points[1:]):
        length = math.hypot(bx - ax, bz - az)
        n = max(2, round(length / 0.09))
        for i in range(n):
            t = i / n
            x, z = ax + (bx - ax) * t, az + (bz - az) * t
            hh = h * (0.9 + 0.1 * ((i * 7) % 3))
            out.append(cylinder(0.035, hh, (x, foot + hh / 2, z), color, sides=5, bevel=0, top=0.012))
    return out


def half_barrel(radius, length, at, color, sides=12):
    """A half cylinder lying across the plot (along x), its flat side on the ground at `at`: a Quonset hut, a rib."""
    x, y, z = at
    bm = bmesh.new()
    ends = []
    for side in (-1, 1):
        ring = []
        for k in range(sides + 1):
            a = math.pi * k / sides
            # Game (x, y, z) -> Blender (x, -z, y).
            ring.append(bm.verts.new((x + side * length / 2, -(z + math.cos(a) * radius), y + math.sin(a) * radius)))
        ends.append(ring)
    for k in range(sides):
        bm.faces.new((ends[0][k], ends[0][k + 1], ends[1][k + 1], ends[1][k]))
    for ring in ends:
        bm.faces.new(ring)
    bm.normal_update()
    me = bpy.data.meshes.new("half_barrel")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("half_barrel", me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(kit.material(color))
    return obj


def roof_slope(size, at, color, tilt_deg):
    """A single-slope roof: a thin box tilted toward the camera."""
    return box(size, at, color, bevel=0.01, tilt=(math.radians(tilt_deg), 0))


def cross(x, y, z, size=0.16, ground="navy"):
    """The Infirmary's sign: a white cross on a square (never on red: that emblem is protected)."""
    return [box((size, size, 0.015), (x, y, z), ground, bevel=0.004), box((size * 0.62, size * 0.2, 0.02), (x, y, z + 0.004), "white", bevel=0), box((size * 0.2, size * 0.62, 0.02), (x, y, z + 0.004), "white", bevel=0)]


# The sea at rest (the game's water level): boats float on it, piers stand over it.
WATER = -0.42


def hull(length, width, depth, at, color, turn=0.0, deck="plank"):
    """
    A boat's hull, its bow toward +x before `turn` (radians): a deck outline with a pointed bow, its sides narrowing to
    the keel; `at` is its middle at the waterline, so a third of it lies under the water.
    """
    x, y, z = at
    bm = bmesh.new()
    half_l, half_w = length / 2, width / 2
    # The deck's outline, from the stern round to the bow: (along, across).
    outline = [(-half_l, -half_w * 0.8), (half_l * 0.45, -half_w), (half_l, 0.0), (half_l * 0.45, half_w), (-half_l, half_w * 0.8)]
    c, s = math.cos(turn), math.sin(turn)

    def place(a, b, h):
        gx, gz = x + a * c - b * s, z + a * s + b * c
        return bm.verts.new((gx, -gz, y + h))

    top = [place(a, b, depth * 0.66) for a, b in outline]
    bottom = [place(a * 0.85, b * 0.35, -depth * 0.34) for a, b in outline]
    n = len(outline)
    for k in range(n):
        bm.faces.new((top[k], top[(k + 1) % n], bottom[(k + 1) % n], bottom[k]))
    bm.faces.new(list(reversed(bottom)))
    deck_face = bm.faces.new(top)
    bm.normal_update()
    for f in bm.faces:
        cen = f.calc_center_median()
        if f is deck_face:
            if f.normal.z < 0:
                f.normal_flip()
        elif (f.normal.x * (cen.x - x) + f.normal.y * (cen.y + z)) < 0 and f.normal.z > -0.9:
            f.normal_flip()
    me = bpy.data.meshes.new("hull")
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("hull", me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(kit.material(color))
    return [obj, box((length * 0.6, 0.01, width * 0.6), (x - math.cos(turn) * length * 0.05, y + depth * 0.66 + 0.004, z - math.sin(turn) * length * 0.05), deck, bevel=0, turn=-turn)]


def pier(points, width, deck_y, color, piles="wood", step=0.28, pile_r=0.03):
    """A pier along a line of (x, z) points: its deck at `deck_y`, piles down into the sea at every `step`."""
    out = []
    for i, ((ax, az), (bx, bz)) in enumerate(zip(points, points[1:])):
        length = math.hypot(bx - ax, bz - az)
        turn = math.atan2(bz - az, bx - ax)
        # Each length a few millimeters over the last, so where they overlap at a turn one deck lies on the other.
        out.append(box((length + width, 0.05, width), ((ax + bx) / 2, deck_y + 0.006 * i, (az + bz) / 2), color, bevel=0.008, turn=-turn))
        n = max(1, round(length / step))
        for i in range(n + 1):
            t = i / n
            px, pz = ax + (bx - ax) * t, az + (bz - az) * t
            for side in (-1, 1):
                ox, oz = -math.sin(turn) * width * 0.42 * side, math.cos(turn) * width * 0.42 * side
                out.append(cylinder(pile_r, deck_y - (WATER - 0.2), (px + ox, (deck_y + WATER - 0.2) / 2, pz + oz), piles, sides=6, bevel=0))
    return out


def bench(x, z, foot, seat="plank", legs="wood"):
    return [box((0.24, 0.03, 0.08), (x, foot + 0.1, z), seat, bevel=0.004), box((0.03, 0.1, 0.06), (x - 0.1, foot + 0.05, z), legs, bevel=0), box((0.03, 0.1, 0.06), (x + 0.1, foot + 0.05, z), legs, bevel=0)]


def planter(x, z, foot, flower="gold"):
    return [box((0.22, 0.07, 0.1), (x, foot + 0.035, z), "stone", bevel=0.008), *[kit.sphere(0.032, (x - 0.07 + 0.07 * k, foot + 0.09, z), flower if k == 1 else "meadow", subdivisions=1) for k in range(3)]]


# Each era's small things, one a level: what a building of that era gathers at its front, as found or as made.
def _props(era, x, z, foot, k):
    from kit import barrel, crate, drum, lamp_post, rope_coil, sack

    if era == "salvage":
        return [crate((x, foot, z), size=0.13, turn=0.3), rope_coil((x, foot, z), radius=0.07), barrel((x, foot + 0.1, z), radius=0.07, height=0.2)][k % 3]
    if era == "colony":
        return [[box((0.26, 0.05, 0.09), (x, foot + 0.025 + 0.05 * i, z), "wood", bevel=0.008, turn=0.06 * i) for i in range(3)], barrel((x, foot + 0.1, z), radius=0.07, height=0.2), bench(x, z, foot), planter(x, z, foot)][k % 4]
    if era == "workshop":
        return [[sack((x, foot, z), size=0.12), sack((x + 0.1, foot, z + 0.04), size=0.11)], [box((0.22, 0.07, 0.14), (x, foot + 0.1, z), "wood", bevel=0.008), cylinder(0.05, 0.025, (x - 0.12, foot + 0.05, z), "dark", sides=8, bevel=0, tilt=(0, math.radians(90)))], drum((x, foot, z), color="copper", radius=0.06, height=0.16), lamp_post((x, foot, z), height=0.4)][k % 4]
    if era == "industry":
        return [[drum((x, foot, z), color="navy", radius=0.06, height=0.16), drum((x + 0.13, foot, z), color="steel", radius=0.06, height=0.16)], crate((x, foot, z), size=0.13, color="navy"), [sack((x, foot, z), size=0.11, color="plank"), sack((x + 0.1, foot, z), size=0.1, color="plank")], lamp_post((x, foot, z), height=0.42, color="navy")][k % 4]
    if era == "electricity":
        return [cylinder(0.09, 0.05, (x, foot + 0.09, z), "wood", sides=10, bevel=0, tilt=(math.radians(90), 0)), [box((0.14, 0.2, 0.07), (x, foot + 0.1, z), "navy", bevel=0.006)], bench(x, z, foot, legs="steel"), [cylinder(0.016, 0.42, (x, foot + 0.21, z), "navy", sides=6, bevel=0), kit.sphere(0.035, (x, foot + 0.45, z), "gold", subdivisions=1)]][k % 4]
    return [planter(x, z, foot), bench(x, z, foot, legs="steel"), [cylinder(0.05, 0.012, (x + 0.12 * i, foot + 0.05, z), "dark", sides=8, bevel=0, tilt=(0, math.radians(90))) for i in range(2)], [box((0.18, 0.12, 0.02), (x, foot + 0.22, z), "navy", bevel=0.004), cylinder(0.012, 0.16, (x, foot + 0.08, z), "steel", sides=4, bevel=0)]][k % 4]


def _listed(parts):
    return parts if isinstance(parts, list) else [parts]


def era_details(spots, own=None):
    """
    A detail at every level that is not a stage: each era's small things at its `spots` (the free places at the front of
    each era's building, (x, z), one per level of the era), unless the building gives its own for a level (`own`).
    """
    from stages import STAGES, era_of

    floors = {era: h for era, (h, _) in FLOOR.items()}
    out = {}
    for i, s in enumerate(STAGES[:-1]):
        nxt = STAGES[i + 1]
        era = era_of(s)
        for k, level in enumerate(range(s + 1, nxt)):
            if own and level in own:
                out[level] = own[level]
                continue
            x, z = spots[era][k]
            out[level] = (lambda era, x, z, k: lambda stage: _listed(_props(era, x, z, floors[era], k)))(era, x, z, k)
    return out
