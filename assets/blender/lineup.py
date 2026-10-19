"""
A row of served models side by side, for the owner's meetings: each model on its own hexagonal plot of meadow, seen
from the game's camera angle (46° down, from the front), in the afternoon sun.

    .venv-blender/bin/python assets/blender/lineup.py <out.png> refinery-1 refinery-5 ... [--width 2600]

Reads client/public/city/<name>.glb (what the game draws, its baked style pass included).
"""
import math
import sys
from pathlib import Path

import bpy

CITY = Path(__file__).resolve().parents[2] / "client" / "public" / "city"
# Plot to plot, in the game's units (a plot is 2 wide).
GAP = 2.4


def plot(x):
    """A hexagonal plot of meadow under a model, pointy side to the camera like the game's."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1 / math.cos(math.pi / 6), depth=0.04, location=(x, 0, -0.02))
    obj = bpy.context.active_object
    obj.rotation_euler = (0, 0, math.radians(30))
    mat = bpy.data.materials.new("meadow")
    mat.diffuse_color = (0.36, 0.5, 0.2, 1)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.36, 0.5, 0.2, 1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1
    obj.data.materials.append(mat)


def main(out, names, width):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tops = []
    for i, name in enumerate(names):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(CITY / f"{name}.glb"))
        new = [o for o in bpy.data.objects if o not in before and o.parent is None]
        for o in new:
            o.location.x += i * GAP
        tops.append(max((o.matrix_world @ v.co).z for o in bpy.data.objects if o not in before and o.type == "MESH" for v in o.data.vertices))
        plot(i * GAP)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 32
    sc.cycles.device = "CPU"
    world = bpy.data.worlds.new("sky")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.24, 0.55, 0.55, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    sun.data.energy = 2.6
    # An orthographic camera over the row, at the game's angle.
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    span = (len(names) - 1) * GAP + 2.4
    tilt = math.radians(46)
    top = max(tops)
    # What the row fills on screen: its width, and its height seen at 46° (ground depth + the tallest model).
    seen = 2 * math.sin(tilt) + top * math.cos(tilt) + 0.3
    cam.data.ortho_scale = span
    mid = ((len(names) - 1) * GAP / 2, 0, top / 2)
    d = 20
    cam.location = (mid[0], -d * math.cos(tilt), mid[2] + d * math.sin(tilt))
    cam.rotation_euler = (math.radians(90) - tilt, 0, 0)
    sc.render.resolution_x = width
    sc.render.resolution_y = round(width * seen / span)
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.render.filepath = str(Path(out).resolve())
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    width = int(args[args.index("--width") + 1]) if "--width" in args else 2600
    rest = [a for i, a in enumerate(args) if a != "--width" and (i == 0 or args[i - 1] != "--width")]
    main(rest[0], rest[1:], width)
