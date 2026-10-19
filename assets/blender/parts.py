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


def washing_line(a, b, colors=("cream", "white", "navy")):
    """Two poles, a rope between them, cloths hanging on it."""
    (ax, ay, az), (bx, by, bz) = a, b
    h = 0.42
    out = [cylinder(0.018, h, (ax, ay + h / 2, az), "wood", sides=5, bevel=0), cylinder(0.018, h, (bx, by + h / 2, bz), "wood", sides=5, bevel=0)]
    out.append(rod((ax, ay + h - 0.02, az), (bx, by + h - 0.02, bz), 0.006, "plank", 3))
    n = len(colors)
    for i, c in enumerate(colors):
        t = (i + 1) / (n + 1)
        out.append(box((0.09, 0.12, 0.01), (ax + (bx - ax) * t, ay + h - 0.09, az + (bz - az) * t), c, bevel=0, turn=math.atan2(bz - az, bx - ax) * -1))
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
