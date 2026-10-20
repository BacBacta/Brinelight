"""
The island after the style pass (owner, after meeting 4), for the game: its land in each of its three looks
(terrain-wild, terrain-garden, terrain-modern: one mesh, its colors and its own ambient occlusion baked from above),
and its groves in each look merged into one model (groves-<look>: one draw call), from land.py. Also writes where the
groves stand, the trails and the beaches in client/src/city/life/land.json, which the game's life reads.

    .venv-blender/bin/python assets/blender/terrain.py [wild|garden|modern ...] [--fast] [--terrain-only]
    python3 assets/blender/serve.py terrain-wild groves-wild ...
"""
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
import land  # noqa: E402
import life  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
JSON = HERE.parent.parent / "client" / "src" / "city" / "life" / "land.json"
SPAN = 6.4  # the land and its underwater skirt fit in -SPAN..SPAN
STEP = 0.05
TRIANGLES = 3600


def g2b(x, y, z):
    return (x, -z, y)


def terrain(look, fast):
    kit.reset(style=False)
    xs = np.arange(-SPAN, SPAN + 1e-6, STEP)
    gx, gz = np.meshgrid(xs, xs)
    hy = land.heights(gx, gz)
    n = len(xs)
    bm = bmesh.new()
    verts = [[bm.verts.new(g2b(gx[i, j], hy[i, j], gz[i, j])) for j in range(n)] for i in range(n)]
    for i in range(n - 1):
        for j in range(n - 1):
            # The sea floor far from the coast is never seen: left out.
            if max(hy[i, j], hy[i + 1, j], hy[i, j + 1], hy[i + 1, j + 1]) < -1.05:
                continue
            # Counter-clockwise seen from above: the land faces the sky (its normals up).
            bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]))
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    mesh = bpy.data.meshes.new(f"terrain-{look}")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(f"terrain-{look}", mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    # Fewer triangles where the land is flat; the coast and the cliffs keep theirs.
    dec = obj.modifiers.new("fewer", "DECIMATE")
    dec.ratio = TRIANGLES / (len(mesh.polygons) * 2)
    bpy.ops.object.modifier_apply(modifier="fewer")
    for p in mesh.polygons:
        p.use_smooth = True
    # Seen from above: its texture is a map of the island (u along x, v along -z).
    uv = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        co = mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = ((co.x + SPAN) / (2 * SPAN), (co.y + SPAN) / (2 * SPAN))

    size = 256 if fast else 1024
    col, _, _ = land.colors(look, size, SPAN)
    # Rows from -z (top of the image) to +z: Blender's images start at the bottom (+z here is -y).
    rgba = np.concatenate([col[::-1], np.ones((size, size, 1))], axis=2)
    img = bpy.data.images.new("colors", size, size)
    img.pixels.foreach_set(np.ascontiguousarray(rgba, dtype=np.float32).ravel())
    mat = bpy.data.materials.new("ground")
    nt = mat.node_tree
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    mesh.materials.append(mat)

    # Its own occlusion (the hills, the foot of the cliffs), baked into the same map: the buildings cast theirs in the game.
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4 if fast else 32
    scene.world = bpy.data.worlds.new("world")
    scene.world.light_settings.distance = 0.6
    ao = bpy.data.images.new("ao", size, size)
    bake = nt.nodes.new("ShaderNodeTexImage")
    bake.image = ao
    nt.nodes.active = bake
    scene.render.bake.margin = 4
    bpy.ops.object.bake(type="AO")
    a = np.array(ao.pixels[:]).reshape(size, size, 4)[:, :, :1]
    c = rgba.copy()
    c[:, :, :3] *= 0.62 + 0.38 * a
    final = bpy.data.images.new("texture", size, size)
    final.pixels.foreach_set(np.ascontiguousarray(c, dtype=np.float32).ravel())
    final.file_format = "JPEG"
    tex.image = final
    nt.nodes.remove(bake)
    nt.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
    path = OUT / f"terrain-{look}.glb"
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_image_format="JPEG", export_image_quality=92, export_yup=True, export_apply=True)
    print(f"terrain-{look} {kit.triangles(obj)} triangles", flush=True)


MAKERS = {name: make for name, make in life.PLANTS.items()}


def groves(look, plants, fast):
    kit.reset(style=True)
    parts = []
    for k, (name, x, y, z, turn, scale) in enumerate(plants):
        obj = kit.join(list(MAKERS[name]()), f"{name}{k}")
        obj.location = g2b(x, y, z)
        obj.rotation_euler = (0, 0, turn)
        obj.scale = (scale, scale, scale)
        parts.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = f"groves-{look}"
    tris = kit.bake_and_export(obj, OUT / f"groves-{look}.glb", size=256 if fast else 1024, samples=4 if fast else 32)
    print(f"groves-{look} {tris} triangles, {len(plants)} plants", flush=True)


def main(args):
    fast = "--fast" in args
    looks = [a for a in args if not a.startswith("--")] or list(land.LOOKS)
    data = json.loads(JSON.read_text()) if JSON.exists() else {}
    data["plots"] = land.ERA_PLOTS
    # The trails, with the ground's height along them (the passers-by walk them).
    data["trails"] = [[[round(x, 3), round(float(land.heights(np.array([x]), np.array([z]))[0]) + 0.005, 3), round(z, 3)] for x, z in line] for line in land.trails()]
    data["beach"] = [[round(c, 3) for c in p] for p in land.beach_spots()]
    data.setdefault("groves", {})
    for look in looks:
        plants = land.groves(look)
        data["groves"][look] = [[name, round(x, 3), round(y, 3), round(z, 3), round(t, 3), round(s, 3)] for name, x, y, z, t, s in plants]
        terrain(look, fast)
        if "--terrain-only" not in args:
            groves(look, plants, fast)
    JSON.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print("wrote", JSON)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:])
