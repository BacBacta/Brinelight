"""
The island, made to the grid (owner, 19 October): its meadow is the 19 plots of rings 0 to 2, each widened a little
past its outline, so the coast follows the plots' hexagons and the rafts of ring 3 float in its notches. Its sides are
a rocky cliff that never comes out past the meadow's edge above the water (the rafts' rooms begin 0.08 beyond it), and
widen only under the water, where the sea hides them.

    .venv-blender/bin/python assets/blender/island.py <out dir>

Units are the game's: a plot is 2 wide (apothem 1), the meadow is at y = 0, the sea at rest at y = -0.42.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402,I001
import bmesh  # noqa: E402
from mathutils import Vector, noise  # noqa: E402

import kit  # noqa: E402

# How far the meadow reaches from a plot's center, flat side to flat side halved: the plot's outline reaches 1.08.
LAND = 1.1
# The cliff's foot under the sea, and how far it widens there.
WALL_FOOT = -0.62
SEABED = -1.5
SKIRT = 1.22
WATER = -0.42
# The band of dune sand along the coast.
SAND = 0.12


def plots():
    """The centers of the 19 plots, in the game's (x, z)."""
    out = []
    for q in range(-2, 3):
        for r in range(-2, 3):
            if max(abs(q), abs(r), abs(q + r)) <= 2:
                out.append((2 * (q + r / 2), 1.732 * r))
    return out


# The rows of the cliff, from the meadow's edge down to its foot, and how many pieces each edge of the coast is cut in.
ROWS = [0.0, -0.08, -0.17, -0.27, -0.36, -0.46, -0.62]
CUTS = 6


def island():
    bm = bmesh.new()
    verts = {}

    def vert(x, z, y=0.0):
        key = (round(x, 4), round(z, 4))
        if key not in verts:
            verts[key] = bm.verts.new((x, -z, y))
        return verts[key]

    # The meadow: the 19 plots' hexagons, edge to edge (one fan of triangles each), so it has no gap anywhere.
    corner = 1 / math.cos(math.pi / 6)
    for x, z in plots():
        center = bm.verts.new((x, -z, 0.0))
        ring_ = [vert(x + math.cos(math.radians(30 + 60 * k)) * corner, z + math.sin(math.radians(30 + 60 * k)) * corner) for k in range(6)]
        for k in range(6):
            f = bm.faces.new((center, ring_[k], ring_[(k + 1) % 6]))
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
    bm.normal_update()
    # The coast: the meadow's outer edge, cut in pieces, then pushed out by LAND - 1 past the plots' hexagons.
    outer = [e for e in bm.edges if len(e.link_faces) == 1]
    bmesh.ops.subdivide_edges(bm, edges=outer, cuts=CUTS - 1)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.edges.ensure_lookup_table()
    edges = [e for e in bm.edges if len(e.link_faces) == 1]
    loop = [edges[0].verts[0], edges[0].verts[1]]
    used = {edges[0]}
    while True:
        nxt = next(e for e in loop[-1].link_edges if len(e.link_faces) == 1 and e not in used)
        used.add(nxt)
        v = nxt.other_vert(loop[-1])
        if v is loop[0]:
            break
        loop.append(v)
    # Each point of the coast goes out along the mean of its two edges' outward normals (a miter).
    centroid = Vector((0, 0, 0))

    def outward(a, b):
        d = (b.co - a.co).normalized()
        n = Vector((d.y, -d.x, 0))
        mid = (a.co + b.co) / 2
        face = next(iter(bm.edges.get((a, b)).link_faces))
        inside = face.calc_center_median() - mid
        return n if n.dot(inside) < 0 else -n

    count = len(loop)
    normals = []
    for i, v in enumerate(loop):
        n1 = outward(loop[i - 1], v)
        n2 = outward(v, loop[(i + 1) % count])
        m = (n1 + n2).normalized()
        normals.append((m, 1 / max(0.5, m.dot(n1))))
    for v, (m, k) in zip(loop, normals):
        v.co += m * (LAND - 1) * k
    # A band of dune sand along the coast, inside the meadow's margin past the plots' outlines: a strip lying 6 mm over
    # the meadow (far more than the depth buffer tells apart at the city's distance, far less than the eye sees).
    lift = Vector((0, 0, 0.006))
    outer = [bm.verts.new(v.co + lift) for v in loop]
    inner = [bm.verts.new(v.co - m * SAND * k + lift) for v, (m, k) in zip(loop, normals)]
    for i in range(count):
        j = (i + 1) % count
        f = bm.faces.new((outer[i], outer[j], inner[j], inner[i]))
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
        f.material_index = 5
    # The cliff: a column of points under each point of the coast, row by row, with the rock's relief: never out past
    # the coast above the water (only inward, an overhanging lip of grass), freely under it; then the slope under the sea.
    columns = []
    for i, (v, (m, k)) in enumerate(zip(loop, normals)):
        col = [v]
        for y in ROWS[1:]:
            n = noise.noise(v.co * 3.1 + Vector((0, 0, y * 4)))
            if y > WATER:
                off = -(0.02 + 0.07 * abs(n))
            else:
                off = 0.1 * n
            col.append(bm.verts.new(v.co + m * off + Vector((0, 0, y + 0.02 * noise.noise(v.co * 5.3)))))
        foot = col[-1].co
        col.append(bm.verts.new((foot.x * SKIRT, foot.y * SKIRT, SEABED)))
        columns.append(col)
    walls = []
    for i in range(count):
        a, b = columns[i], columns[(i + 1) % count]
        for r in range(len(a) - 1):
            walls.append((bm.faces.new((a[r], b[r], b[r + 1], a[r + 1])), normals[i][0] + normals[(i + 1) % count][0]))
    bm.normal_update()
    # The walls face out to sea: the side the coast was pushed toward.
    for f, out in walls:
        if f.normal.dot(out) < 0:
            f.normal_flip()
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3], quad_method="BEAUTY")
    mesh = bpy.data.meshes.new("island")
    bm.to_mesh(mesh)
    bm.free()
    land = bpy.data.objects.new("island", mesh)
    bpy.context.collection.objects.link(land)
    bpy.context.view_layer.objects.active = land
    land.select_set(True)

    # Materials by height: the meadow, a mossy lip, the rock, the wet rock at the water, the seabed.
    names = ["meadow", "meadow_dark", "rock", "rock_dark", "seabed", "sand"]
    for n in names:
        land.data.materials.append(kit.material(n))
    for f in land.data.polygons:
        z = f.center.z
        if f.normal.z > 0.9 and z > -1e-3:
            f.material_index = 5 if f.center.z > 0.003 else 0
        elif z > -0.1:
            f.material_index = 1
        elif z > -0.36:
            f.material_index = 2
        elif z > -0.62:
            f.material_index = 3
        else:
            f.material_index = 4
    bpy.ops.object.shade_flat()
    return land


def main(out, fast=False):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    kit.reset(style=True, foot=None)
    obj = island()
    tris = kit.bake_and_export(obj, out / "island.glb", size=512 if fast else 2048, samples=8 if fast else 48)
    print(f"island {tris} triangles {(out / 'island.glb').stat().st_size / 1024:.0f} kB", flush=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets/blender/out")
