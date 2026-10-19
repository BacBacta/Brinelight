"""
The island's ground in the Lighthouse's six eras (docs/tasks/week-8.md, "The eras": the island follows the Lighthouse's
era, the city's): what lies on the meadow between the plots and along the coast, one model a era, laid over the island
(island.py) without touching it:

- Salvage (1–4): earth paths between the plots, driftwood stakes along the coast;
- Colony (5–9): earth paths edged with stones, small wooden fences on the coast;
- Workshop (10–14): cobbled paths, the fences;
- Industry (15–19): paved paths, iron bollards along the coast;
- Electricity (20–24): paved paths, lamp posts at the crossings, the bollards;
- Modern (25–30): paved walks, white lamp posts with a warm light, concrete quays all along the coast.

The paths run along the plots' shared edges, between their outlines (the game draws a plot's outline 0.85 to 0.94 from
its center, a building reaches 0.95 at most): nothing stands where a building does. Nothing reaches past the meadow's
edge (0.1 past the plots), where the rafts' rooms begin.

    .venv-blender/bin/python assets/blender/build.py ground [--fast]
"""
import math
from pathlib import Path

import bmesh
import bpy

import kit
from kit import cylinder, rod, sphere

ERAS = [1, 5, 10, 15, 20, 25]
CORNER = 1 / math.cos(math.pi / 6)
# How far the meadow reaches past the plots' edges (island.py's LAND - 1).
EDGE = 0.1
# Just over the meadow (0) and the dune sand (0.006).
LIFT = 0.01


def plots():
    out = []
    for q in range(-2, 3):
        for r in range(-2, 3):
            if max(abs(q), abs(r), abs(q + r)) <= 2:
                out.append((2 * (q + r / 2), 1.732 * r))
    return out


def key(x, z):
    return (round(x, 3), round(z, 3))


def network():
    """The plots' corners and edges: each edge with the plots it borders (two inside the island, one on its coast)."""
    edges = {}
    points = {}
    for cx, cz in plots():
        corners = []
        for k in range(6):
            a = math.radians(30 + 60 * k)
            x, z = cx + math.cos(a) * CORNER, cz + math.sin(a) * CORNER
            points[key(x, z)] = (x, z)
            corners.append(key(x, z))
        for k in range(6):
            e = tuple(sorted((corners[k], corners[(k + 1) % 6])))
            edges.setdefault(e, []).append((cx, cz))
    inner = [e for e, owners in edges.items() if len(owners) == 2]
    coast = [(e, owners[0]) for e, owners in edges.items() if len(owners) == 1]
    return points, inner, coast


def mesh_object(name, faces, color):
    """
    An object of flat faces in a palette color: each a list of game (x, y, z) points, lying flat (facing up), or with
    the game (x, z) way it must face, for an upright one.
    """
    bm = bmesh.new()
    for f in faces:
        points, facing = (f, None) if isinstance(f[0][0], (int, float)) else f
        face = bm.faces.new([bm.verts.new((x, -z, y)) for x, y, z in points])
        face.normal_update()
        if facing is None and face.normal.z < 0:
            face.normal_flip()
        elif facing is not None and face.normal.x * facing[0] - face.normal.y * facing[1] < 0:
            face.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(kit.material(color))
    return obj


def paths(width, color, curbs=None, reach=None):
    """
    The paths along the plots' shared edges, joined at the crossings; with curbs (a color), stones on their sides. With
    `reach`, only those whose middle lies within it of the island's center: the first eras' paths stay near the
    Lighthouse, the later ones cover the island.
    """
    points, inner, _ = network()
    if reach is not None:
        inner = [(a, b) for a, b in inner if math.hypot((points[a][0] + points[b][0]) / 2, (points[a][1] + points[b][1]) / 2) <= reach]
    degree = {}
    for a, b in inner:
        degree[a] = degree.get(a, 0) + 1
        degree[b] = degree.get(b, 0) + 1
    # At a crossing of three paths, each ends short of it so they meet edge to edge around a small hexagon.
    trim = width / (2 * math.tan(math.radians(60)))
    faces, ends, parts = [], {}, []
    for a, b in inner:
        (ax, az), (bx, bz) = points[a], points[b]
        dx, dz = bx - ax, bz - az
        length = math.hypot(dx, dz)
        dx, dz = dx / length, dz / length
        nx, nz = -dz * width / 2, dx * width / 2
        # A path that reaches the coast goes on to the meadow's edge.
        ta = trim if degree[a] > 1 else -EDGE * 0.6
        tb = trim if degree[b] > 1 else -EDGE * 0.6
        p0 = (ax + dx * ta, az + dz * ta)
        p1 = (bx - dx * tb, bz - dz * tb)
        quad = [(p0[0] + nx, p0[1] + nz), (p1[0] + nx, p1[1] + nz), (p1[0] - nx, p1[1] - nz), (p0[0] - nx, p0[1] - nz)]
        faces.append([(x, LIFT, z) for x, z in quad])
        ends.setdefault(a, []).extend([quad[0], quad[3]])
        ends.setdefault(b, []).extend([quad[1], quad[2]])
        if curbs:
            for side in (1, -1):
                c0 = (p0[0] + nx * side * 1.15, p0[1] + nz * side * 1.15)
                c1 = (p1[0] + nx * side * 1.15, p1[1] + nz * side * 1.15)
                parts.append(rod((c0[0], LIFT + 0.004, c0[1]), (c1[0], LIFT + 0.004, c1[1]), 0.012, curbs, 4))
    for v, corners in ends.items():
        if degree[v] < 2:
            continue
        cx, cz = points[v]
        ring = sorted(set((round(x, 5), round(z, 5)) for x, z in corners), key=lambda p: math.atan2(p[1] - cz, p[0] - cx))
        faces.append([(x, LIFT, z) for x, z in ring])
    parts.append(mesh_object("paths", faces, color))
    return parts


def coast_points():
    """Each corner on the coast, and its way out to sea: the mean of its two coast edges' outward normals."""
    points, _, coast = network()
    normals = {}
    for (a, b), (cx, cz) in coast:
        (ax, az), (bx, bz) = points[a], points[b]
        mx, mz = (ax + bx) / 2 - cx, (az + bz) / 2 - cz
        n = math.hypot(mx, mz)
        for v in (a, b):
            normals.setdefault(v, []).append((mx / n, mz / n))
    out = {}
    for v, ns in normals.items():
        sx, sz = sum(n[0] for n in ns), sum(n[1] for n in ns)
        length = math.hypot(sx, sz)
        mx, mz = sx / length, sz / length
        # How far along the mean the meadow's edge lies (a miter, as island.py pushes the coast).
        k = 1 / max(0.5, mx * ns[0][0] + mz * ns[0][1])
        out[v] = (points[v], (mx, mz), k)
    return out, coast, points


def along_coast(offset):
    """Points on the coast at `offset` out past the plots' edges (a fraction of the meadow's margin): each corner's."""
    corners, _, _ = coast_points()
    return [(x + mx * offset * k, z + mz * offset * k) for (x, z), (mx, mz), k in corners.values()]


def stakes():
    """Driftwood stakes at the coast's corners, leaning a little along it, never out over the water."""
    corners, _, _ = coast_points()
    parts = []
    for i, ((x, z), (mx, mz), k) in enumerate(corners.values()):
        x, z = x + mx * EDGE * 0.3 * k, z + mz * EDGE * 0.3 * k
        lean = 0.06 if i % 2 else -0.05
        parts.append(rod((x, 0, z), (x - mz * lean, 0.24 + 0.04 * (i % 3), z + mx * lean), 0.02, "wood", 5))
    return parts


def fences():
    """A short wooden fence along each coast edge: two posts and a rail."""
    corners, coast, points = coast_points()
    parts = []
    for (a, b), _ in coast:
        (pa, ma, ka), (pb, mb, kb) = corners[a], corners[b]
        ax, az = pa[0] + ma[0] * EDGE * 0.5 * ka, pa[1] + ma[1] * EDGE * 0.5 * ka
        bx, bz = pb[0] + mb[0] * EDGE * 0.5 * kb, pb[1] + mb[1] * EDGE * 0.5 * kb
        # The middle third of the edge: the fences leave gaps at the corners, as fields' fences do.
        p0 = (ax + (bx - ax) * 0.3, az + (bz - az) * 0.3)
        p1 = (ax + (bx - ax) * 0.7, az + (bz - az) * 0.7)
        for x, z in (p0, p1):
            parts.append(cylinder(0.018, 0.16, (x, 0.08, z), "wood", sides=5, bevel=0))
        parts.append(rod((p0[0], 0.12, p0[1]), (p1[0], 0.12, p1[1]), 0.012, "plank", 4))
    return parts


def bollards(color="navy_dark"):
    return [cylinder(0.03, 0.09, (x, 0.045, z), color, sides=8, bevel=0, top=0.024) for x, z in along_coast(EDGE * 0.5)]


def crossings(limit):
    """The paths' crossings within `limit` of the island's center, where lamp posts stand."""
    points, inner, _ = network()
    degree = {}
    for a, b in inner:
        degree[a] = degree.get(a, 0) + 1
        degree[b] = degree.get(b, 0) + 1
    return [points[v] for v, d in degree.items() if d == 3 and math.hypot(*points[v]) <= limit]


def quays():
    """Concrete quays along the whole coast: a walk over the meadow's margin, a low curb at its edge."""
    corners, coast, points = coast_points()
    walk, curb = [], []
    for (a, b), _ in coast:
        (pa, ma, ka), (pb, mb, kb) = corners[a], corners[b]

        def at(p, m, k, t):
            return (p[0] + m[0] * EDGE * t * k, p[1] + m[1] * EDGE * t * k)

        a0, b0, a1, b1, a2, b2 = at(pa, ma, ka, -0.2), at(pb, mb, kb, -0.2), at(pa, ma, ka, 0.82), at(pb, mb, kb, 0.82), at(pa, ma, ka, 1.0), at(pb, mb, kb, 1.0)
        walk.append([(a0[0], LIFT + 0.004, a0[1]), (b0[0], LIFT + 0.004, b0[1]), (b1[0], LIFT + 0.004, b1[1]), (a1[0], LIFT + 0.004, a1[1])])
        top = 0.05
        curb.append([(a1[0], top, a1[1]), (b1[0], top, b1[1]), (b2[0], top, b2[1]), (a2[0], top, a2[1])])
        out = ((ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2)
        curb.append(([(a1[0], LIFT, a1[1]), (b1[0], LIFT, b1[1]), (b1[0], top, b1[1]), (a1[0], top, a1[1])], (-out[0], -out[1])))
        curb.append(([(a2[0], top, a2[1]), (b2[0], top, b2[1]), (b2[0], -0.12, b2[1]), (a2[0], -0.12, a2[1])], out))
    return [mesh_object("quay", walk, "concrete"), mesh_object("curb", curb, "concrete")]


def era(first):
    if first == 1:
        return [*paths(0.12, "earth", reach=1.8), *stakes()]
    if first == 5:
        return [*paths(0.12, "earth", curbs="stone", reach=3.0), *fences()]
    if first == 10:
        return [*paths(0.13, "cobble", curbs="stone_dark"), *fences()]
    if first == 15:
        return [*paths(0.13, "paving", curbs="stone"), *bollards()]
    if first == 20:
        return [*paths(0.13, "paving", curbs="stone"), *bollards(), *lamps("navy", 0.42)]
    return [*paths(0.13, "paving", curbs="concrete"), *quays(), *lamps("white", 0.46)]


def lamps(color, height):
    """A lamp post at each crossing near the middle: a slim post, a cap, a warm globe."""
    out = []
    for x, z in crossings(3.2):
        out += [cylinder(0.016, height, (x, height / 2, z), color, sides=6, bevel=0), sphere(0.034, (x, height + 0.03, z), "gold", subdivisions=1), cylinder(0.03, 0.02, (x, height + 0.07, z), color, sides=6, bevel=0)]
    return out


def build(out, fast=False, only=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for first in only or ERAS:
        kit.reset(style=True, foot=None)
        obj = kit.join(era(first), f"ground-{first}")
        path = out / f"ground-{first}.glb"
        tris = kit.bake_and_export(obj, path, size=256 if fast else 2048, samples=4 if fast else 32)
        print(f"ground-{first:<3} {tris:5d} triangles  {path.stat().st_size / 1024:6.0f} kB", flush=True)

