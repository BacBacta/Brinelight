"""
A kit of parts for Brinelight's models, made with Blender run from Python (bpy, no window): rounded boxes, cylinders,
cones and planks in the art direction's palette (docs/art-direction.md), joined into one mesh, its colors and its soft
shadows (ambient occlusion) baked into one texture, and exported as a .glb like the Meshy originals (one mesh, one
material, one JPEG texture), so assets/make-models.py serves it the same way.

Units are the game's: 1 = half a plot's width; y is up in the game (z in Blender), and the camera looks from +z in
the game (−y in Blender).
"""
import math

import bpy  # noqa: I001 (bmesh needs bpy loaded first)
import bmesh
import numpy as np

# The palette (docs/art-direction.md).
PALETTE = {
    "navy": "#163A63",
    "navy_dark": "#0C1F3A",
    "gold": "#FFC83A",
    "brass": "#E09A12",
    "cream": "#FFF4DA",
    "wood": "#8C6B4A",
    "plank": "#C9A77A",
    "copper": "#5E9E8C",
    "brick": "#E2572F",
    "stone": "#B9B2A6",
    "stone_dark": "#8E877C",
    "meadow": "#7FA36B",
    "dark": "#2A2018",
}


def srgb(hex_color):
    """A palette color as Blender's linear RGBA."""
    h = hex_color.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


_materials = {}


def reset():
    """An empty scene."""
    _materials.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            block.remove(item)


def material(name):
    """A plain material of a palette color, made once."""
    if name not in _materials:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(PALETTE[name])
        bsdf.inputs["Roughness"].default_value = 0.8
        _materials[name] = m
    return _materials[name]


def _finish(obj, color, bevel, segments):
    obj.data.materials.append(material(color))
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(40)
    return obj


def _place(obj, at, turn=0.0, tilt=(0.0, 0.0)):
    # Game (x, y, z) with y up and +z toward the camera -> Blender (x, -z, y).
    x, y, z = at
    obj.location = (x, -z, y)
    obj.rotation_euler = (tilt[0], tilt[1], turn)
    return obj


def box(size, at, color, bevel=0.02, segments=1, turn=0.0, tilt=(0.0, 0.0)):
    """A box of size (width, height, depth) in the game's axes, its center at `at`, with rounded edges."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    w, h, d = size
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    return _place(_finish(obj, color, bevel, segments), at, turn, tilt)


def cylinder(radius, height, at, color, sides=16, bevel=0.015, segments=1, turn=0.0, tilt=(0.0, 0.0), top=None):
    """An upright cylinder (or a frustum when `top` is a top radius), its center at `at`."""
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius, radius2=radius if top is None else top, depth=height)
    obj = bpy.context.active_object
    return _place(_finish(obj, color, bevel, segments), at, turn, tilt)


def cone(radius, height, at, color, sides=16, turn=0.0):
    """A cone standing on its base, its base's center at `at`."""
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius, radius2=0, depth=height)
    obj = bpy.context.active_object
    x, y, z = at
    return _place(_finish(obj, color, 0, 1), (x, y + height / 2, z), turn)


def ring(radius, thickness, height, at, color, sides=20):
    """A hoop around a vat: a short open tube."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius + thickness, depth=height, end_fill_type="NOTHING")
    obj = bpy.context.active_object
    mod = obj.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thickness
    return _place(_finish(obj, color, 0, 1), at)


def prism_roof(width, depth, height, at, color, turn=0.0):
    """A gabled roof: a triangular prism, its ridge along the width."""
    mesh = bpy.data.meshes.new("roof")
    bm = bmesh.new()
    w, d, h = width / 2, depth / 2, height
    v = [bm.verts.new(p) for p in [(-w, -d, 0), (w, -d, 0), (w, d, 0), (-w, d, 0), (-w, 0, h), (w, 0, h)]]
    for f in [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]:
        bm.faces.new([v[i] for i in f])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("roof", mesh)
    bpy.context.collection.objects.link(obj)
    return _place(_finish(obj, color, 0.012, 1), at, turn)


def hexagon(apothem, height, at, color, bevel=0.02, segments=2):
    """A hexagonal slab with its flat sides facing ±x (the plots' and the rafts' orientation), its center at `at`."""
    radius = apothem / math.cos(math.pi / 6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=radius, depth=height)
    obj = bpy.context.active_object
    # Blender's hexagon has a corner on +x; turned by 30°, its sides face ±x and a corner faces the camera.
    obj.rotation_euler = (0, 0, math.radians(30))
    bpy.ops.object.transform_apply(rotation=True)
    return _place(_finish(obj, color, bevel, segments), at)


def barrel(at, color="wood", band="navy", radius=0.11, height=0.26, tilt=(0.0, 0.0)):
    """A barrel with two hoops."""
    parts = [cylinder(radius, height, at, color, sides=10, bevel=0.02, tilt=tilt)]
    x, y, z = at
    for dy in (-height * 0.28, height * 0.28):
        parts.append(ring(radius, 0.012, 0.03, (x, y + dy, z), band, sides=10))
    return parts


def flag(at, color, height=0.7):
    """A pole and a flag facing the camera."""
    x, y, z = at
    return [
        cylinder(0.025, height, (x, y + height / 2, z), "wood", sides=8, bevel=0),
        box((0.34, 0.22, 0.02), (x + 0.18, y + height - 0.13, z), color, bevel=0.008),
        cylinder(0.04, 0.04, (x, y + height + 0.02, z), "brass", sides=8, bevel=0),
    ]


def lantern(at, size=0.1):
    """A hanging lantern: a gold glass in a navy frame."""
    x, y, z = at
    return [
        box((size, size * 1.3, size), (x, y, z), "gold", bevel=0.01),
        box((size * 1.25, size * 0.2, size * 1.25), (x, y + size * 0.75, z), "navy", bevel=0.005),
    ]


def join(parts, name):
    """All the parts as one object, their modifiers applied."""
    flat = []
    for p in parts:
        if isinstance(p, list):
            flat.extend(p)
        else:
            flat.append(p)
    bpy.ops.object.select_all(action="DESELECT")
    for p in flat:
        p.select_set(True)
        bpy.context.view_layer.objects.active = p
        for mod in list(p.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = flat[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_flat()
    return obj


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def bake_and_export(obj, path, size=1024, ao_strength=0.5, samples=48):
    """
    Bakes the model's colors and its ambient occlusion into one texture (`size` px), puts it on one material, and
    exports the model as a .glb with a JPEG texture.
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    if scene.world is None:
        scene.world = bpy.data.worlds.new("world")
    scene.world.light_settings.distance = 0.35
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # One UV map for the whole model, its islands apart.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.012)
    bpy.ops.object.mode_set(mode="OBJECT")

    def target(name):
        img = bpy.data.images.new(name, size, size)
        for mat in obj.data.materials:
            nodes = mat.node_tree.nodes
            node = nodes.get("bake") or nodes.new("ShaderNodeTexImage")
            node.name = "bake"
            node.image = img
            nodes.active = node
        return img

    color = target("color")
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 6
    bpy.ops.object.bake(type="DIFFUSE")
    ao = target("ao")
    bpy.ops.object.bake(type="AO")
    # The colors under soft shadows: occlusion darkens by `ao_strength` at most, never to black.
    c = np.array(color.pixels[:]).reshape(size, size, 4)
    a = np.array(ao.pixels[:]).reshape(size, size, 4)[:, :, :1]
    c[:, :, :3] *= (1 - ao_strength) + ao_strength * a
    final = bpy.data.images.new("texture", size, size)
    final.pixels[:] = c.ravel()
    final.file_format = "JPEG"
    # One material with the baked texture.
    mat = bpy.data.materials.new("baked")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = final
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_image_format="JPEG",
        export_jpeg_quality=90,
        export_yup=True,
        export_apply=True,
    )
    return triangles(obj)
