"""
A kit of parts for Brinelight's models, made with Blender run from Python (bpy, no window): rounded boxes, cylinders,
cones and planks in the art direction's palette (docs/art-direction.md), joined into one mesh, its colors and its soft
shadows (ambient occlusion) baked into one texture, and exported as a .glb like the Meshy originals (one mesh, one
material, one JPEG texture), so assets/make-models.py serves it the same way.

Units are the game's: 1 = half a plot's width; y is up in the game (z in Blender), and the camera looks from +z in
the game (−y in Blender).
"""
import math
from pathlib import Path

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
    "meadow_dark": "#5E8A4F",
    "dark": "#2A2018",
    "white": "#F6F1E6",
    "lighthouse_red": "#C8361E",
    "rock": "#7D766C",
    "rock_dark": "#4E4A45",
    "sand": "#D9C9A3",
    "seabed": "#3F6F6B",
    # The eras' materials (week 8): neutral, not accent colors.
    "steel": "#8E979C",
    # The floating village's steel age (meeting 3, owner): its frame, painted light so the age reads at a glance.
    "steel_light": "#C4CCCF",
    "glass": "#A9DCD8",
    "brick": "#B9674A",
    "concrete": "#C8C1B4",
    "tin": "#9AA0A0",
    "solar": "#163A63",
    "steam": "#F4F1EA",
    # The island's ground through the eras (week 8): earth paths, cobbles, paving.
    "earth": "#9A7448",
    "cobble": "#8F8A80",
    "paving": "#E4DCCB",
}


def srgb(hex_color):
    """A palette color as Blender's linear RGBA."""
    h = hex_color.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


_materials = {}

# The style pass (owner, 19 October): each part's color varies a little, wood and stone get a grain, the edges catch
# the light, the tops are lighter and the feet darker. Off, the parts are flat colors (the first trial's look).
_style = {"on": False, "foot": (0.0, 0.3)}
# What each palette color is made of, for its grain and how much its edges catch the light.
FINISH = {
    "wood": ("wood", 0.7),
    "plank": ("wood", 0.6),
    "stone": ("stone", 0.7),
    "stone_dark": ("stone", 0.8),
    "brass": ("metal", 1.0),
    "copper": ("metal", 0.9),
    "gold": ("metal", 0.6),
    "meadow": ("grass", 0.15),
    "meadow_dark": ("grass", 0.15),
    "rock": ("rock", 0.6),
    "rock_dark": ("rock", 0.5),
    "sand": ("grass", 0.0),
    "seabed": ("stone", 0.0),
    "steel": ("metal", 0.6),
    "steel_light": ("metal", 0.7),
    "glass": ("glass", 0.8),
    "brick": ("brick", 0.3),
    "concrete": ("stone", 0.35),
    "tin": ("tin", 0.5),
    "solar": ("solar", 0.4),
    "steam": ("paint", 0.0),
    "earth": ("stone", 0.0),
    "cobble": ("cobble", 0.0),
    "paving": ("paving", 0.0),
}


def reset(style=False, foot=(0.0, 0.3)):
    """
    An empty scene; `style` turns the style pass on for the parts made after it. `foot`: the heights (game units) over
    which the foot darkens, or None (the island, whose meadow is at 0).
    """
    _materials.clear()
    _style["on"] = style
    _style["foot"] = foot
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            block.remove(item)


def material(name):
    """A plain material of a palette color, made once."""
    if name not in _materials:
        m = bpy.data.materials.new(name)
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = srgb(PALETTE[name])
        bsdf.inputs["Roughness"].default_value = 0.8
        if _style["on"]:
            _paint(m, name)
        _materials[name] = m
    return _materials[name]


def _paint(m, name):
    """
    The style pass on a material: its color times its grain, the part's own small variation (stored by `join`), a
    lighter top and a darker foot, and lighter edges. All of it lands in the baked color.
    """
    nt = m.node_tree
    n, link = nt.nodes.new, nt.links.new
    kind, edge = FINISH.get(name, ("paint", 0.5))

    def ranged(socket, a, b, c, d):
        r = n("ShaderNodeMapRange")
        r.clamp = True
        link(socket, r.inputs["Value"])
        for k, v in zip(("From Min", "From Max", "To Min", "To Max"), (a, b, c, d)):
            r.inputs[k].default_value = v
        return r.outputs["Result"]

    def times(a, b):
        m_ = n("ShaderNodeMath")
        m_.operation = "MULTIPLY"
        link(a, m_.inputs[0])
        link(b, m_.inputs[1])
        return m_.outputs["Value"]

    geo = n("ShaderNodeNewGeometry")
    coords = n("ShaderNodeTexCoord").outputs["Object"]
    # The part's own shade: each piece of wood, each hoop, a little different.
    variation = n("ShaderNodeAttribute")
    variation.attribute_name = "variation"
    f = ranged(variation.outputs["Fac"], 0, 1, 0.84, 1.1)
    # Lighter on top, darker underneath, as under a soft sky.
    up = n("ShaderNodeSeparateXYZ")
    link(geo.outputs["True Normal"], up.inputs[0])
    f = times(f, ranged(up.outputs["Z"], -1, 1, 0.86, 1.05))
    # A darker foot, where the sea and the dirt reach.
    at = n("ShaderNodeSeparateXYZ")
    link(geo.outputs["Position"], at.inputs[0])
    if _style["foot"]:
        f = times(f, ranged(at.outputs["Z"], _style["foot"][0], _style["foot"][1], 0.8, 1.0))
    if kind == "grass":
        # Patches of lighter and darker grass, and a fine grain in them.
        big = n("ShaderNodeTexNoise")
        big.inputs["Scale"].default_value = 0.9
        big.inputs["Detail"].default_value = 3
        link(coords, big.inputs["Vector"])
        f = times(f, ranged(big.outputs["Fac"], 0.35, 0.65, 0.88, 1.1))
        fine = n("ShaderNodeTexNoise")
        fine.inputs["Scale"].default_value = 18
        link(coords, fine.inputs["Vector"])
        f = times(f, ranged(fine.outputs["Fac"], 0.3, 0.7, 1.0, 1.15))
    if kind == "rock":
        # Strata: horizontal bands, broken by noise, and mottles.
        wave = n("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "Z"
        wave.inputs["Scale"].default_value = 5
        wave.inputs["Distortion"].default_value = 6
        wave.inputs["Detail"].default_value = 3
        link(coords, wave.inputs["Vector"])
        f = times(f, ranged(wave.outputs["Fac"], 0.2, 0.8, 0.84, 1.08))
    # Walls' own patterns, on (x + y, z): they run along any wall facing the camera or the side.
    if kind in ("brick", "tin", "solar", "glass", "cobble", "paving"):
        sep = n("ShaderNodeSeparateXYZ")
        link(coords, sep.inputs[0])
        across = n("ShaderNodeMath")
        across.operation = "ADD"
        link(sep.outputs["X"], across.inputs[0])
        link(sep.outputs["Y"], across.inputs[1])
        wall = n("ShaderNodeCombineXYZ")
        link(across.outputs[0], wall.inputs["X"])
        link(sep.outputs["Z"], wall.inputs["Y"])
        flat = n("ShaderNodeCombineXYZ")
        link(sep.outputs["X"], flat.inputs["X"])
        link(sep.outputs["Y"], flat.inputs["Y"])
        if kind in ("cobble", "paving"):
            # Stones laid on the ground, on (x, y): small cobbles in staggered rows, or square slabs.
            b = n("ShaderNodeTexBrick")
            b.inputs["Color1"].default_value = (1.04, 1.04, 1.04, 1)
            b.inputs["Color2"].default_value = (0.84, 0.84, 0.84, 1)
            b.inputs["Mortar"].default_value = (0.6, 0.6, 0.6, 1)
            b.inputs["Scale"].default_value = 12 if kind == "cobble" else 5
            b.inputs["Mortar Size"].default_value = 0.06 if kind == "cobble" else 0.025
            b.inputs["Brick Width"].default_value = 0.6 if kind == "cobble" else 0.5
            b.inputs["Row Height"].default_value = 0.4 if kind == "cobble" else 0.5
            b.offset = 0.5 if kind == "cobble" else 0
            link(flat.outputs[0], b.inputs["Vector"])
            bw = n("ShaderNodeRGBToBW")
            link(b.outputs["Color"], bw.inputs[0])
            f = times(f, bw.outputs[0])
        elif kind in ("brick", "solar"):
            b = n("ShaderNodeTexBrick")
            b.inputs["Color1"].default_value = (1, 1, 1, 1)
            b.inputs["Color2"].default_value = (0.86, 0.86, 0.86, 1)
            b.inputs["Mortar"].default_value = (0.62, 0.62, 0.62, 1) if kind == "brick" else (1.7, 1.7, 1.7, 1)
            b.inputs["Scale"].default_value = 9 if kind == "brick" else 16
            b.inputs["Mortar Size"].default_value = 0.025 if kind == "brick" else 0.04
            if kind == "solar":
                b.offset = 0
                b.inputs["Brick Width"].default_value = 0.5
                b.inputs["Row Height"].default_value = 0.5
            link((flat if kind == "solar" else wall).outputs[0], b.inputs["Vector"])
            bw = n("ShaderNodeRGBToBW")
            link(b.outputs["Color"], bw.inputs[0])
            f = times(f, bw.outputs[0])
        else:
            w = n("ShaderNodeTexWave")
            w.wave_type = "BANDS"
            w.bands_direction = "X"
            w.inputs["Scale"].default_value = 30 if kind == "tin" else 2.5
            w.inputs["Distortion"].default_value = 0 if kind == "tin" else 2
            link(wall.outputs[0], w.inputs["Vector"])
            f = times(f, ranged(w.outputs["Fac"], 0, 1, 0.82, 1.06) if kind == "tin" else ranged(w.outputs["Fac"], 0, 1, 0.92, 1.12))
    # The grain: long streaks in wood, mottles in stone.
    if kind in ("wood", "stone", "rock"):
        noise = n("ShaderNodeTexNoise")
        noise.inputs["Detail"].default_value = 4
        if kind == "wood":
            stretch = n("ShaderNodeMapping")
            stretch.inputs["Scale"].default_value = (3, 3, 40)
            link(coords, stretch.inputs["Vector"])
            link(stretch.outputs["Vector"], noise.inputs["Vector"])
            noise.inputs["Scale"].default_value = 4
            f = times(f, ranged(noise.outputs["Fac"], 0.3, 0.7, 0.78, 1.12))
        else:
            link(coords, noise.inputs["Vector"])
            noise.inputs["Scale"].default_value = 14 if kind == "stone" else 7
            f = times(f, ranged(noise.outputs["Fac"], 0.35, 0.65, 0.85, 1.08))
    base = n("ShaderNodeRGB")
    base.outputs[0].default_value = srgb(PALETTE[name])
    shaded = n("ShaderNodeVectorMath")
    shaded.operation = "SCALE"
    link(base.outputs[0], shaded.inputs[0])
    link(f, shaded.inputs["Scale"])
    # The edges: where the rounded normal leaves the face's, the color is lighter, as worn and lit.
    bevel = n("ShaderNodeBevel")
    bevel.inputs["Radius"].default_value = 0.025
    dot = n("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    link(bevel.outputs["Normal"], dot.inputs[0])
    link(geo.outputs["True Normal"], dot.inputs[1])
    rim = ranged(dot.outputs["Value"], 0.96, 0.75, 0, edge)
    light = n("ShaderNodeVectorMath")
    light.operation = "MULTIPLY_ADD"
    link(shaded.outputs["Vector"], light.inputs[0])
    light.inputs[1].default_value = (1.45, 1.4, 1.28)
    light.inputs[2].default_value = (0.09, 0.08, 0.05)
    mix = n("ShaderNodeMix")
    mix.data_type = "RGBA"
    link(rim, mix.inputs["Factor"])
    link(shaded.outputs["Vector"], mix.inputs[6])
    link(light.outputs["Vector"], mix.inputs[7])
    link(mix.outputs[2], nt.nodes["Principled BSDF"].inputs["Base Color"])


def _vary(obj):
    """Stores a random shade for each separate piece of the model (geometry nodes: one value per mesh island)."""
    ng = bpy.data.node_groups.new("vary", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, link = ng.nodes.new, ng.links.new
    gin, gout = n("NodeGroupInput"), n("NodeGroupOutput")
    island = n("GeometryNodeInputMeshIsland")
    rnd = n("FunctionNodeRandomValue")
    rnd.data_type = "FLOAT"
    rnd.inputs["Seed"].default_value = 7
    link(island.outputs["Island Index"], rnd.inputs["ID"])
    store = n("GeometryNodeStoreNamedAttribute")
    store.data_type = "FLOAT"
    store.domain = "FACE"
    store.inputs["Name"].default_value = "variation"
    link(gin.outputs[0], store.inputs["Geometry"])
    link(rnd.outputs["Value"], store.inputs["Value"])
    link(store.outputs["Geometry"], gout.inputs[0])
    mod = obj.modifiers.new("vary", "NODES")
    mod.node_group = ng
    bpy.ops.object.modifier_apply(modifier=mod.name)


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


def sphere(radius, at, color, subdivisions=1, squash=1.0):
    """A ball (a puff of steam, a dome, a lamp): an icosphere, `squash` its height over its width."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius)
    obj = bpy.context.active_object
    obj.scale = (1, 1, squash)
    bpy.ops.object.transform_apply(scale=True)
    return _place(_finish(obj, color, 0, 1), at)


def band(radius, height, at, color, sides=12):
    """A hoop around something round: an open band just outside it (its inside is never seen)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=height, end_fill_type="NOTHING")
    obj = bpy.context.active_object
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


def barrel(at, color="wood", hoop="navy", radius=0.11, height=0.26, tilt=(0.0, 0.0)):
    """A barrel with two hoops."""
    parts = [cylinder(radius, height, at, color, sides=10, bevel=0, tilt=tilt)]
    x, y, z = at
    for dy in (-height * 0.28, height * 0.28):
        parts.append(globals()["band"](radius + 0.008, 0.03, (x, y + dy, z), hoop, sides=10))
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


def rod(a, b, radius, color, sides=8):
    """A bar from point `a` to point `b` (game coordinates): a pipe, a beam, a rope."""
    from mathutils import Vector

    pa, pb = Vector((a[0], -a[2], a[1])), Vector((b[0], -b[2], b[1]))
    d = pb - pa
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=d.length, location=(pa + pb) / 2)
    obj = bpy.context.active_object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = d.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(rotation=True)
    return _finish(obj, color, 0, 1)


def crate(at, size=0.2, color="plank", turn=0.0):
    """A crate standing on `at` (its bottom's center), with darker edges."""
    x, y, z = at
    return [
        box((size, size, size), (x, y + size / 2, z), color, bevel=size * 0.08, turn=turn),
        box((size * 1.02, size * 0.12, size * 1.02), (x, y + size * 0.5, z), "wood", bevel=0.004, turn=turn),
    ]


def sack(at, size=0.16, color="cream"):
    """A sack slumped on the ground."""
    x, y, z = at
    return [cylinder(size * 0.5, size * 0.8, (x, y + size * 0.4, z), color, sides=6, bevel=0, top=size * 0.36)]


def ladder(foot, top, color="wood", width=0.18):
    """A ladder from `foot` to `top` (game coordinates), its rungs every 0.09."""
    import math as m

    fx, fy, fz = foot
    tx, ty, tz = top
    parts = [rod((fx - width / 2, fy, fz), (tx - width / 2, ty, tz), 0.012, color, 6), rod((fx + width / 2, fy, fz), (tx + width / 2, ty, tz), 0.012, color, 6)]
    length = m.dist(foot, top)
    for i in range(1, int(length / 0.09)):
        t = i * 0.09 / length
        p = (fx + (tx - fx) * t, fy + (ty - fy) * t, fz + (tz - fz) * t)
        parts.append(rod((p[0] - width / 2, p[1], p[2]), (p[0] + width / 2, p[1], p[2]), 0.009, color, 5))
    return parts


def wheel(at, radius=0.09, color="gold", facing="z"):
    """A valve wheel on a wall, facing the camera (+z) or the right (+x)."""
    x, y, z = at
    tilt = (math.radians(90), 0) if facing == "z" else (0, math.radians(90))
    parts = [ring(radius, 0.012, 0.025, (x, y, z), color, sides=8)]
    parts[0].rotation_euler = (tilt[0], tilt[1], 0)
    bpy.ops.object.select_all(action="DESELECT")
    parts.append(rod((x - radius, y, z), (x + radius, y, z), 0.01, color, 4) if facing == "z" else rod((x, y, z - radius), (x, y, z + radius), 0.01, color, 4))
    parts.append(rod((x, y - radius, z), (x, y + radius, z), 0.01, color, 4))
    return parts


def gauge(at, radius=0.07, facing="z"):
    """A round pressure gauge on a wall: a cream dial on a brass back, a dark needle."""
    x, y, z = at
    tilt = (math.radians(90), 0) if facing == "z" else (0, math.radians(90))
    dz, dx = (0.012, 0) if facing == "z" else (0, 0.012)
    back = cylinder(radius * 1.18, 0.016, (x, y, z), "brass", sides=8, bevel=0, tilt=tilt)
    dial = cylinder(radius, 0.01, (x + dx, y, z + dz), "cream", sides=8, bevel=0, tilt=tilt)
    if facing == "z":
        needle = box((radius * 0.9, 0.012, 0.006), (x + radius * 0.25, y + radius * 0.2, z + dz * 1.6), "dark", bevel=0, turn=0)
        needle.rotation_euler = (0, math.radians(-30), 0)
    else:
        needle = box((0.006, radius * 0.9, 0.012), (x + dx * 1.6, y + radius * 0.2, z), "dark", bevel=0)
    return [back, dial, needle]


def lamp_post(at, height=0.5, color="navy"):
    """A post with a lantern on top."""
    x, y, z = at
    return [cylinder(0.02, height, (x, y + height / 2, z), color, sides=6, bevel=0), *lantern((x, y + height + 0.05, z), size=0.08)]


def rope_coil(at, radius=0.08, color="plank"):
    """A coil of rope lying on the ground."""
    x, y, z = at
    return [ring(radius, 0.024, 0.045, (x, y + 0.022, z), color, sides=8)]


def drum(at, color="navy", radius=0.09, height=0.22):
    """A metal drum: a cylinder with two brass bands."""
    x, y, z = at
    return [cylinder(radius, height, (x, y + height / 2, z), color, sides=8, bevel=0), band(radius + 0.006, 0.025, (x, y + height * 0.62, z), "brass", sides=8)]


def rail_ring(radius, at, color="navy", posts=8, height=0.12):
    """A round railing (a gallery, a catwalk): a ring on posts."""
    x, y, z = at
    parts = [ring(radius, 0.01, 0.02, (x, y + height, z), color, sides=12)]
    for i in range(posts):
        a = 2 * math.pi * i / posts
        parts.append(rod((x + math.cos(a) * radius, y, z + math.sin(a) * radius), (x + math.cos(a) * radius, y + height, z + math.sin(a) * radius), 0.01, color, 3))
    return parts


def tag(parts, level):
    """
    The level at which these parts appear (the details of a building): stored on their vertices as `_level`, which
    serve.py reads to order the triangles so the game draws a level with one range of the mesh. Untagged parts are 0.
    """
    flat = parts if isinstance(parts, list) else [parts]
    for p in flat:
        if isinstance(p, list):
            tag(p, level)
            continue
        attr = p.data.attributes.get("_level") or p.data.attributes.new("_level", "FLOAT", "POINT")
        for d in attr.data:
            d.value = level
    return parts


def join(parts, name):
    """All the parts as one object, their modifiers applied."""
    flat = []

    def gather(ps):
        for p in ps:
            if isinstance(p, list):
                gather(p)
            else:
                flat.append(p)

    gather(parts)
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
    if _style["on"]:
        _vary(obj)
    return obj


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def bake_and_export(obj, path, size=1024, ao_strength=0.5, samples=48, meta=None):
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
    c = np.array(color.pixels[:]).reshape(size, size, 4)
    # The colors under soft shadows: occlusion darkens by `ao_strength` at most, never to black. With the style pass,
    # two of them: a short one in the creases and a wide, soft one under roofs and between the parts.
    # Their shadows lean to blue, as painted under a warm light (per channel: red, green, blue).
    shadows = [(0.12, (0.36, 0.33, 0.24)), (0.6, (0.42, 0.38, 0.26))] if _style["on"] else [(0.35, (ao_strength,) * 3)]
    for distance, strength in shadows:
        scene.world.light_settings.distance = distance
        ao = target(f"ao{distance}")
        bpy.ops.object.bake(type="AO")
        a = np.array(ao.pixels[:]).reshape(size, size, 4)[:, :, :1]
        k = np.array(strength)
        c[:, :, :3] *= (1 - k) + k * a
    final = bpy.data.images.new("texture", size, size)
    final.pixels[:] = c.ravel()
    final.file_format = "JPEG"
    # One material with the baked texture.
    mat = bpy.data.materials.new("baked")
    nodes = mat.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = final
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.material_index = 0
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_image_format="JPEG",
        export_image_quality=90,
        export_attributes=True,
        export_yup=True,
        export_apply=True,
    )
    if meta is not None:
        import json

        Path(path).with_suffix(".json").write_text(json.dumps(meta))
    return triangles(obj)
