"""
The ground of the whole land (owner, step 2 of the land won on the sea), in each of its three looks: the island's
greens, earth and trails over every slot too, its own occlusion baked from above on the land with every slot won, and
no shore (the game paints the shore from the coast of the slots taken, client/src/city/land/). One flat model each
(land-wild, land-garden, land-modern: a square of -SPAN..SPAN with this texture), served by serve.py.

    .venv-blender/bin/python assets/blender/land_texture.py [wild|garden|modern ...] [--fast]
    python3 assets/blender/serve.py land-wild land-garden land-modern
"""
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
import land  # noqa: E402
import reclaim  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SPAN = 10.5  # client/src/city/land/mesh.ts, SPAN
STEP = 0.05


def inland_colors(look, res, span):
    """land.colors without its shore: greens, earth by the doors and on the trails, pebbles on the trails, flowers."""
    xs = np.linspace(-span, span, res)
    px, pz = np.meshgrid(xs, xs)
    built = np.min([land.hex_reach(px - cx, pz - cz) for cx, cz in land.BUILT.values()], axis=0)
    g0, g1, g2, g3 = (land.hexc(c) for c in land.LOOKS[look]["greens"])
    n1, n2, n3 = land.fbm(px * 1.7, pz * 1.7, 5.0), land.fbm(px * 4.0, pz * 4.0, 6.0), land.fbm(px * 0.7, pz * 0.7, 7.0)
    col = land.mix(g0[None, None], g1[None, None], 0.5 + n1)
    col = land.mix(col, g2[None, None], (n2 - 0.15) * 3)
    col = land.mix(col, g3[None, None], (n3 - 0.2) * 2.5)
    earth, earth_dark = (land.hexc(c) for c in land.LOOKS[look]["trail"])
    yard = np.clip(1 - (built - 0.55) / 0.3, 0, 1) * np.clip(0.6 + n2, 0, 1)
    col = land.mix(col, earth[None, None], yard * 0.85)
    tr = land.distance_to(land.trails(), px, pz)
    width = 0.075 + 0.025 * land.fbm(px * 3, pz * 3, 8.0)
    worn = np.clip((width + 0.04 - tr) / 0.04, 0, 1) * np.clip(0.55 + 0.6 * land.vnoise(px * 18, pz * 18, 2.0), 0, 1)
    col = land.mix(col, earth[None, None], np.clip((width - tr) / 0.02, 0, 1))
    col = land.mix(col, earth_dark[None, None], np.clip((width * 0.5 - tr) / 0.03, 0, 1) * 0.35)
    col = land.mix(col, earth[None, None], worn * 0.6)
    rng = np.random.default_rng(7)
    for count, cols, where in (
        (int(5000 * (res / 2048) ** 2 * (span / 6.4) ** 2), ("#8E877C", "#B9B2A6", "#6F6A62"), lambda m: tr[m] < 0.2),
        (int(9000 * (res / 2048) ** 2 * (span / 6.4) ** 2), ("#FFF4DA", "#FFC83A", "#E2572F", "#F6F1E6"), lambda m: (n1[m] > 0.05) & (tr[m] > 0.15) & (built[m] > 0.9)),
    ):
        iy, ix = rng.integers(0, res, count), rng.integers(0, res, count)
        keep = where((iy, ix))
        dot = max(1, res // 1024)
        for k, (a, b) in enumerate(zip(iy[keep], ix[keep])):
            col[a : a + dot, b : b + dot] = land.hexc(cols[k % len(cols)])
    return col


def bake(look, fast):
    kit.reset(style=False)
    # The land with every slot won: its hills' occlusion, as the island's was baked.
    every = reclaim.Land({"slots": [dict(s) for s in reclaim.ALL_SLOTS], "filling": None})
    xs = np.arange(-SPAN, SPAN + 1e-6, STEP if not fast else 0.15)
    gx, gz = np.meshgrid(xs, xs)
    hy = every.heights(gx, gz)
    n = len(xs)
    verts = np.stack([gx.ravel(), -gz.ravel(), hy.ravel()], axis=1)
    idx = np.arange(n * n).reshape(n, n)
    faces = np.stack([idx[:-1, :-1], idx[1:, :-1], idx[1:, 1:], idx[:-1, 1:]], axis=-1).reshape(-1, 4)
    mesh = bpy.data.meshes.new("whole")
    mesh.from_pydata(verts.tolist(), [], faces.tolist())
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new("whole", mesh)
    bpy.context.scene.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        co = mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = ((co.x + SPAN) / (2 * SPAN), (co.y + SPAN) / (2 * SPAN))
    size = 384 if fast else 1536
    col = inland_colors(look, size, SPAN)
    rgba = np.concatenate([col[::-1], np.ones((size, size, 1))], axis=2)
    mat = bpy.data.materials.new("ground")
    nt = mat.node_tree
    mesh.materials.append(mat)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4 if fast else 32
    scene.world = bpy.data.worlds.new("world")
    scene.world.light_settings.distance = 0.6
    ao = bpy.data.images.new("ao", size, size)
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = ao
    nt.nodes.active = node
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    scene.render.bake.margin = 4
    bpy.ops.object.bake(type="AO")
    a = np.array(ao.pixels[:]).reshape(size, size, 4)[:, :, :1]
    c = rgba.copy()
    c[:, :, :3] *= 0.62 + 0.38 * a
    final = bpy.data.images.new("texture", size, size)
    final.pixels.foreach_set(np.ascontiguousarray(c, dtype=np.float32).ravel())
    final.file_format = "JPEG"

    # What is served: a flat square with that texture (the game builds the land's shape itself).
    bpy.ops.mesh.primitive_plane_add(size=2 * SPAN, location=(0, 0, 0))
    plane = bpy.context.active_object
    plane.name = f"land-{look}"
    puv = plane.data.uv_layers.active
    for loop in plane.data.loops:
        co = plane.data.vertices[loop.vertex_index].co
        puv.data[loop.index].uv = ((co.x + SPAN) / (2 * SPAN), (co.y + SPAN) / (2 * SPAN))
    pm = bpy.data.materials.new(f"land-{look}")
    tex = pm.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = final
    pm.node_tree.links.new(tex.outputs["Color"], pm.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    pm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
    plane.data.materials.append(pm)
    bpy.ops.object.select_all(action="DESELECT")
    plane.select_set(True)
    bpy.context.view_layer.objects.active = plane
    path = OUT / f"land-{look}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_image_format="JPEG", export_image_quality=92, export_yup=True, export_apply=True)
    print(f"land-{look} {size} px", flush=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    fast = "--fast" in args
    for look in [a for a in args if not a.startswith("--")] or list(land.LOOKS):
        bake(look, fast)
