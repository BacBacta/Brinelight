"""
The style pass's target images (owner, after meeting 4): the city as the game's camera sees it (its layout read from
the game, assets/blender/targets/<city>.json), rendered in Blender with the corrections the owner asked for, in two
directions of light, before any of it is coded:

- one continuous island with an organic coast, a little relief, rocks, beaches and short cliffs; the grid of plots is
  no longer drawn on the ground;
- worn trails of beaten earth between the buildings instead of paths along the plots' sides;
- a varied ground (several greens, earth, sand, pebbles, flowers);
- ambient occlusion and contact shadows (here rendered; in the game they would be baked);
- dense groves near the coast and between the buildings, props grouped by the buildings (crates, barrels, fences);
- the buildings a little larger on their plots (same places);
- water turquoise along the coast and deep blue offshore, with foam and glints of sun;
- the free raft slots as their buoys and rope only;
- the survivors 1.5 times larger.

    .venv-blender/bin/python assets/blender/target.py <city> <A|B> <out.png> [samples]

A, "warm": golden late-afternoon light, soft but crisp shadows, saturated colors (never neon).
B, "bright": clear midday light, shorter shadows, pastel tones.
"""
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SPAN = 7.0  # the ground covers -SPAN..SPAN on x and z
WATER = -0.42
BUILDING_SCALE = 1.15
PEOPLE_SCALE = 1.5


def g2b(x, y, z):
    """The game's axes (y up, +z toward the camera) to Blender's."""
    return Vector((x, -z, y))


# --- Noise and shapes, on numpy arrays of the game's (x, z) ---------------------------------------------------------
def _hash(i, j, seed):
    s = np.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453
    return s - np.floor(s)


def vnoise(x, z, seed=0.0):
    xi, zi = np.floor(x), np.floor(z)
    xf, zf = x - xi, z - zi
    u, v = xf * xf * (3 - 2 * xf), zf * zf * (3 - 2 * zf)
    a, b = _hash(xi, zi, seed), _hash(xi + 1, zi, seed)
    c, d = _hash(xi, zi + 1, seed), _hash(xi + 1, zi + 1, seed)
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1


def fbm(x, z, seed=0.0, octaves=4):
    out, amp, f = 0.0, 0.5, 1.0
    for k in range(octaves):
        out = out + amp * vnoise(x * f, z * f, seed + k * 13.1)
        amp *= 0.5
        f *= 2.0
    return out


def hex_reach(x, z):
    return np.maximum(np.abs(x), np.maximum(np.abs(x / 2 + z * 0.866), np.abs(-x / 2 + z * 0.866)))


def hx(q, r):
    return 2 * (q + r / 2), 1.732 * r


PLOTS = [hx(q, r) for q in range(-2, 3) for r in range(-2, 3) if max(abs(q), abs(r), abs(q + r)) <= 2]
PIER = {(1, -3), (1, -4), (2, -4)}
RING3 = [hx(q, r) for q in range(-3, 4) for r in range(-3, 4) if max(abs(q), abs(r), abs(q + r)) == 3]


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def land_depth(x, z):
    """
    How far inside the land a point is (negative: in the sea): round, softly joined lands around the plots, a coast
    pushed in and out by noise, kept off the rafts' rooms of ring 3 (rounded too).
    """
    base = None
    for cx, cz in PLOTS:
        d = np.hypot(x - cx, z - cz) - 1.12
        base = d if base is None else smin(base, d, 0.6)
    coast = -base + 0.16 * fbm(x * 0.55, z * 0.55, 3.0) + 0.05 * fbm(x * 2.2, z * 2.2, 4.0)
    rooms = np.min([np.hypot(x - cx, z - cz) for cx, cz in RING3], axis=0) - 0.98
    # Under the buildings of the coast, the land always holds (their plots reach 1 from their centers).
    plots = np.min([hex_reach(x - cx, z - cz) for cx, cz in PLOTS], axis=0)
    coast = np.maximum(coast, 1.04 - plots)
    return np.minimum(coast, rooms)


def cliffs(x, z):
    """Where the coast is a short cliff (1) rather than a beach (0)."""
    return np.clip((fbm(x * 0.45, z * 0.45, 9.0) - 0.05) * 5, 0, 1)


def heights(x, z, flat):
    """The ground's height: gentle hills inland, flat on the buildings' plots, down to the sea by a beach or a cliff."""
    d = land_depth(x, z)
    hills = (0.05 + 0.07 * fbm(x * 0.6, z * 0.6, 1.0)) * flat
    c = cliffs(x, z)
    w_beach, w_cliff = 0.32, 0.05
    beach = np.clip(d / w_beach, 0, 1)
    beach = beach * beach * (3 - 2 * beach)
    cliff = np.clip(d / w_cliff, 0, 1)
    shore = beach * (1 - c) + cliff * c
    top = np.where(d > 0, -0.46 + (hills + 0.46) * shore, -0.46 + np.maximum(d, -0.8) * 0.9)
    return top, d, c


# --- The scene -------------------------------------------------------------------------------------------------------
_imported = {}


def model(name):
    """A model made by the scripts (assets/blender/out), imported once; linked copies share its mesh."""
    if name not in _imported:
        path = OUT / f"{name}.glb"
        if not path.exists():
            print("missing", name)
            _imported[name] = None
            return None
        bpy.ops.object.select_all(action="DESELECT")
        bpy.ops.import_scene.gltf(filepath=str(path))
        objs = [o for o in bpy.context.selected_objects if o.type == "MESH"]
        for o in bpy.context.selected_objects:
            if o.type != "MESH":
                bpy.data.objects.remove(o)
        obj = objs[0]
        if len(objs) > 1:
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.join()
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.hide_render = True
        obj.hide_viewport = True
        _imported[name] = obj
    return _imported[name]


def up_to_level(src, level):
    """A copy of a stage's model with only what shows up to `level` (serve.py: the _LEVEL attribute)."""
    attr = src.data.attributes.get("_LEVEL")
    data = src.data.copy()
    if attr is not None:
        bm = bmesh.new()
        bm.from_mesh(data)
        layer = bm.verts.layers.float.get("_LEVEL")
        if layer is not None:
            gone = [f for f in bm.faces if max(v[layer] for v in f.verts) > level + 0.5]
            bmesh.ops.delete(bm, geom=gone, context="FACES")
            bm.to_mesh(data)
        bm.free()
    return data


def place(name, x, y, z, turn=0.0, scale=(1.0, 1.0, 1.0), level=None):
    src = model(name)
    if src is None:
        return None
    data = up_to_level(src, level) if level is not None else src.data
    obj = bpy.data.objects.new(f"{name}@{x:.2f},{z:.2f}", data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = g2b(x, y, z)
    obj.rotation_euler = (0, 0, turn)
    obj.scale = (scale[0], scale[2], scale[1])
    return obj


def image(name, rgba, srgb=True):
    h, w, _ = rgba.shape
    img = bpy.data.images.new(name, w, h, alpha=True, float_buffer=not srgb)
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    # The alpha is data (the foam), never a transparency that would darken the color.
    img.alpha_mode = "CHANNEL_PACKED"
    img.pixels.foreach_set(np.ascontiguousarray(rgba[::-1], dtype=np.float32).ravel())
    img.pack()
    return img


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


# --- Trails ----------------------------------------------------------------------------------------------------------
def trails(layout):
    """Worn trails of beaten earth: from each building's door to its nearest neighbor's (a tree), and to the shore."""
    fronts = [(b["x"], b["z"] + 0.72) for b in layout["buildings"]]
    done, edges = [0], []
    while len(done) < len(fronts):
        best = min(((i, j) for i in done for j in range(len(fronts)) if j not in done), key=lambda e: math.dist(fronts[e[0]], fronts[e[1]]))
        edges.append(best)
        done.append(best[1])
    lines = []
    for k, (i, j) in enumerate(edges):
        (ax, az), (bx, bz) = fronts[i], fronts[j]
        # A gentle bend, as people walk.
        nx, nz = -(bz - az), bx - ax
        n = math.hypot(nx, nz) or 1
        bend = 0.18 * math.sin(k * 2.3 + 1)
        mx, mz = (ax + bx) / 2 + nx / n * bend, (az + bz) / 2 + nz / n * bend
        pts = []
        for t in np.linspace(0, 1, 24):
            u = 1 - t
            pts.append((u * u * ax + 2 * u * t * mx + t * t * bx, u * u * az + 2 * u * t * mz + t * t * bz))
        lines.append(pts)
    # A trail from the Lighthouse's door down to the front beach.
    lh = layout["buildings"][0]
    lines.append([(lh["x"] + 0.05 * math.sin(t * 6), lh["z"] + 0.72 + t * 3.4) for t in np.linspace(0, 1, 24)])
    return lines


def distance_to(lines, x, z):
    d = np.full(x.shape, 99.0)
    for pts in lines:
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            dx, dz = bx - ax, bz - az
            t = np.clip(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz + 1e-9), 0, 1)
            d = np.minimum(d, np.hypot(x - ax - dx * t, z - az - dz * t))
    return d


# --- The ground ------------------------------------------------------------------------------------------------------
def ground(layout, era):
    n = 281
    xs = np.linspace(-SPAN, SPAN, n)
    gx, gz = np.meshgrid(xs, xs)
    bplots = [(b["x"], b["z"]) for b in layout["buildings"]]
    near = np.min([hex_reach(gx - cx, gz - cz) for cx, cz in bplots], axis=0)
    flat = np.clip((near - 0.95) / 0.35, 0, 1)
    hy, d, c = heights(gx, gz, flat)
    bm = bmesh.new()
    verts = [[bm.verts.new(g2b(gx[i, j], hy[i, j], gz[i, j])) for j in range(n)] for i in range(n)]
    for i in range(n - 1):
        for j in range(n - 1):
            if max(hy[i, j], hy[i + 1, j + 1]) < -1.15:
                continue
            bm.faces.new((verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]))
    mesh = bpy.data.meshes.new("ground")
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new("ground", mesh)
    bpy.context.scene.collection.objects.link(obj)

    # Its colors, painted from above: greens, earth by the doors and on the trails, sand, rock, pebbles, flowers.
    res = 2048
    xs = np.linspace(-SPAN, SPAN, res)
    px, pz = np.meshgrid(xs, xs)
    near = np.min([hex_reach(px - cx, pz - cz) for cx, cz in bplots], axis=0)
    flat = np.clip((near - 0.95) / 0.35, 0, 1)
    h, dd, cc = heights(px, pz, flat)
    greens = {"wild": ("#7FA36B", "#5E8A4F", "#9BB86F", "#A9A869"), "modern": ("#86AC6E", "#5E8A4F", "#A3C178", "#9DAA6A")}[era]
    g0, g1, g2, g3 = (hexc(c) for c in greens)
    n1, n2, n3 = fbm(px * 1.7, pz * 1.7, 5.0), fbm(px * 4.0, pz * 4.0, 6.0), fbm(px * 0.7, pz * 0.7, 7.0)
    col = mix(g0[None, None], g1[None, None], 0.5 + n1)
    col = mix(col, g2[None, None], (n2 - 0.15) * 3)
    col = mix(col, g3[None, None], (n3 - 0.2) * 2.5)
    # Bare, trodden earth around each building and its door.
    earth, earth_dark = hexc("#9A7448"), hexc("#7E5E3B")
    yard = np.clip(1 - (near - 0.55) / 0.3, 0, 1) * np.clip(0.6 + n2, 0, 1)
    col = mix(col, earth[None, None], yard * 0.85)
    tr = distance_to(trails(layout), px, pz)
    width = 0.075 + 0.025 * fbm(px * 3, pz * 3, 8.0)
    worn = np.clip((width + 0.04 - tr) / 0.04, 0, 1) * np.clip(0.55 + 0.6 * vnoise(px * 18, pz * 18, 2.0), 0, 1)
    col = mix(col, earth[None, None], np.clip((width - tr) / 0.02, 0, 1))
    col = mix(col, earth_dark[None, None], np.clip((width * 0.5 - tr) / 0.03, 0, 1) * 0.35)
    col = mix(col, earth[None, None], worn * 0.6)
    # The shore: sand where it slopes gently, rock on the cliffs and under the water's edge.
    sand, rock, rock_dark = hexc("#D9C9A3"), hexc("#8E877C"), hexc("#5E5850")
    beach = np.clip((0.28 - dd) / 0.12, 0, 1) * (1 - cc)
    col = mix(col, sand[None, None], beach)
    col = mix(col, mix(rock[None, None], rock_dark[None, None], 0.5 + n2), np.clip((0.07 - dd) / 0.04, 0, 1) * cc)
    col = mix(col, mix(sand[None, None] * 0.8, rock_dark[None, None], cc), np.clip(-dd / 0.15, 0, 1))
    # Pebbles and flowers, a few pixels each.
    rng = np.random.default_rng(7)
    for count, colors, where in ((5000, ("#8E877C", "#B9B2A6", "#6F6A62"), lambda m: (tr[m] < 0.2) | (dd[m] < 0.35)), (9000, ("#FFF4DA", "#FFC83A", "#E2572F", "#F6F1E6"), lambda m: (n1[m] > 0.05) & (dd[m] > 0.3) & (tr[m] > 0.15) & (near[m] > 0.9))):
        iy, ix = rng.integers(0, res, count), rng.integers(0, res, count)
        keep = where((iy, ix))
        for k, (a, b) in enumerate(zip(iy[keep], ix[keep])):
            col[a : a + 2, b : b + 2] = hexc(colors[k % len(colors)])
    rgba = np.concatenate([col, np.ones((res, res, 1))], axis=2)
    img = image("ground", rgba)

    mat = bpy.data.materials.new("ground")
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.92
    tc, mp, tex = nt.nodes.new("ShaderNodeTexCoord"), nt.nodes.new("ShaderNodeMapping"), nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "EXTEND"
    mp.inputs["Scale"].default_value = (1 / (2 * SPAN), 1 / (2 * SPAN), 1)
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    obj.data.materials.append(mat)
    return lambda x, z: float(heights(np.array([x]), np.array([z]), np.array([np.clip((np.min([hex_reach(x - cx, z - cz) for cx, cz in bplots]) - 0.95) / 0.35, 0, 1)]))[0][0]), tr, (px, pz, dd)


# --- The water -------------------------------------------------------------------------------------------------------
def water(layout, direction):
    res, span = 1024, 14.0
    xs = np.linspace(-span, span, res)
    px, pz = np.meshgrid(xs, xs)
    d = -land_depth(px, pz)
    near_raft = np.full(px.shape, 99.0)
    for r in layout["rafts"]:
        near_raft = np.minimum(near_raft, hex_reach(px - r["x"], pz - r["z"]) - 0.8)
    d = np.minimum(d, near_raft)
    t1 = np.clip(d / (2.0 if direction == "M" else 1.2), 0, 1) ** (1.6 if direction == "M" else 1)
    t2 = np.clip((d - 1.2) / 5.0, 0, 1)
    if direction == "M":
        # B's light turquoise along the coast and the rafts; offshore deeper, never night blue.
        shallow, mid, deep = hexc("#6FE3D6"), hexc("#2DB3C9"), hexc("#1C76A8")
    else:
        shallow, mid, deep = hexc("#4FDCCB"), hexc("#1C9DC2"), hexc("#0C3D6E")
    col = mix(mix(shallow[None, None], mid[None, None], t1), deep[None, None], t2)
    if direction == "M":
        # The rafts' contact shade on the water, just off their edge.
        col = col * (1 - 0.28 * np.clip(1 - near_raft / 0.12, 0, 1) * (near_raft > 0))[..., None]
    foam = np.clip(1 - d / 0.13, 0, 1) * np.clip(0.6 + 0.8 * vnoise(px * 9, pz * 9, 4.0), 0, 1)
    foam = np.where(d < -0.05, 0, foam)
    rgba = np.concatenate([col, foam[..., None]], axis=2)
    img = image("water", rgba)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, WATER))
    obj = bpy.context.active_object
    mat = bpy.data.materials.new("water")
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.07
    tc, mp, tex = nt.nodes.new("ShaderNodeTexCoord"), nt.nodes.new("ShaderNodeMapping"), nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "EXTEND"
    mp.inputs["Scale"].default_value = (1 / (2 * span), 1 / (2 * span), 1)
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    # The foam: white and rough where the image says.
    white = nt.nodes.new("ShaderNodeMix")
    white.data_type = "RGBA"
    white.inputs["B"].default_value = (0.95, 0.97, 0.96, 1)
    nt.links.new(tex.outputs["Alpha"], white.inputs["Factor"])
    nt.links.new(tex.outputs["Color"], white.inputs["A"])
    nt.links.new(white.outputs["Result"], bsdf.inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.07
    rough.inputs["To Max"].default_value = 0.9
    nt.links.new(tex.outputs["Alpha"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    # Small ripples catch the sun.
    noise, bump = nt.nodes.new("ShaderNodeTexNoise"), nt.nodes.new("ShaderNodeBump")
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 3.0
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    obj.data.materials.append(mat)


# --- The things on it ------------------------------------------------------------------------------------------------
STAGE_ERA = {1: "wild", 5: "wild", 10: "wild", 15: "wild", 20: "modern", 25: "modern", 30: "modern"}


def buildings(layout, height_at):
    for b in layout["buildings"]:
        place(b["model"], b["x"], 0, b["z"], scale=(BUILDING_SCALE,) * 3, level=b["level"])
        if b.get("extra"):
            place(b["extra"], b["x"], 0, b["z"])
        if b["site"]:
            r = b["reach"] * BUILDING_SCALE
            k = r / 0.95
            place("site-frame", b["x"], 0, b["z"], scale=(k, max(0.6, b["height"] * BUILDING_SCALE * 0.7), k))
            place("site-mast", b["x"] + r * 0.8, 0, b["z"] + r * 0.55, scale=(0.8, 0.8, 0.8))
            place("site-arm", b["x"] + r * 0.8, 0, b["z"] + r * 0.55, turn=2.4, scale=(0.8, 0.8, 0.8))
        # Props grouped at its side: crates, barrels, a short fence.
        side = 1 if sum(map(ord, b["id"])) % 2 else -1
        r = min(b["reach"] * BUILDING_SCALE, 0.9)
        x0, z0 = b["x"] + side * (r + 0.05), b["z"] + 0.35
        kit.crate((x0, 0, z0), size=0.13, color="plank", turn=0.3)
        kit.crate((x0 + side * 0.03, 0.13, z0 - 0.02), size=0.1, color="wood", turn=0.7)
        for k in range(2):
            kit.barrel((x0 + side * 0.02, 0, z0 + 0.17 + 0.13 * k), radius=0.055, height=0.13, color="wood" if k else "brick")
        for k in range(4):
            kit.cylinder(0.012, 0.13, (x0 - side * 0.1 + side * 0.11 * k, 0.065, b["z"] + 0.62), "wood", sides=5, bevel=0)
        kit.box((0.36, 0.015, 0.012), (x0 + side * 0.06, 0.1, b["z"] + 0.62), "plank", bevel=0)
        kit.box((0.36, 0.015, 0.012), (x0 + side * 0.06, 0.05, b["z"] + 0.62), "plank", bevel=0)


def weathered(obj, k):
    """The rafts as the island: contact shadows in their corners (an occlusion term) and each raft's planks a shade apart."""
    mat = obj.data.materials[0].copy()
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    link = bsdf.inputs["Base Color"].links[0]
    ao, mul, hsv = nt.nodes.new("ShaderNodeAmbientOcclusion"), nt.nodes.new("ShaderNodeMix"), nt.nodes.new("ShaderNodeHueSaturation")
    ao.inputs["Distance"].default_value = 0.12
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 0.85
    hsv.inputs["Saturation"].default_value = 1.15
    hsv.inputs["Value"].default_value = 0.88 + 0.12 * ((k * 37) % 7) / 6
    nt.links.new(link.from_socket, hsv.inputs["Color"])
    nt.links.new(hsv.outputs["Color"], mul.inputs["A"])
    nt.links.new(ao.outputs["AO"], mul.inputs["B"])
    nt.links.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
    obj.data = obj.data.copy()
    obj.data.materials[0] = mat


def village(layout, direction):
    for k, r in enumerate(layout["rafts"]):
        raft = place(r["model"], r["x"], -0.62, r["z"])
        if direction == "M" and raft:
            weathered(raft, k)
        if r["building"]:
            place(r["building"], r["x"], -0.25, r["z"])
    for w in layout["walkways"]:
        place(w["model"], w["x"], -0.26, w["z"], turn=w["turn"], scale=(1, 1, w["length"]))
    for m in layout["moorings"]:
        place(m["model"], m["x"], 0, m["z"], turn=m["turn"])
    for f in layout["free"]:
        free_slot(f["x"], f["z"])


def free_slot(x, z):
    """A free slot: six white and red buoys and a thin pale rope lying on the water between them, nothing else."""
    corners = [(x + 0.92 * math.cos(math.radians(90 + 60 * i)), z + 0.92 * math.sin(math.radians(90 + 60 * i))) for i in range(6)]
    for cx, cz in corners:
        kit.sphere(0.045, (cx, WATER + 0.02, cz), "white", subdivisions=1, squash=0.9)
        kit.sphere(0.03, (cx, WATER + 0.06, cz), "brick", subdivisions=1, squash=0.8)
    for (ax, az), (bx, bz) in zip(corners, corners[1:] + corners[:1]):
        # Barely there: a thin rope the color of the shallows, lying on the water.
        kit.rod((ax, WATER + 0.001, az), (bx, WATER + 0.001, bz), 0.0012, "seabed", 3)


SHIRTS = ["#C9A77A", "#5E9E8C", "#B9674A", "#8E979C", "#E0B06A", "#6F8FAF", "#A7B58A", "#C8C1B4"]
PANTS = ["#4E4A45", "#5B4636", "#3E5A6E", "#6B5D4A", "#4A5A44"]
SKINS = ["#F1D2B4", "#D9A77F", "#B67F5A", "#8A5A3C", "#E8BE98"]


def survivor_tinted(k):
    """A copy of the survivor's mesh with its shirt, trousers and skin painted in (the game tints them per instance)."""
    src = model("life-survivor")
    data = src.data.copy()
    shirt, pants, skin = hexc(SHIRTS[k % len(SHIRTS)]), hexc(PANTS[k % len(PANTS)]), hexc(SKINS[(k * 3) % len(SKINS)])
    attr = data.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(data.vertices):
        x, y, z = v.co.x, v.co.z, -v.co.y
        c = np.ones(3)
        if y > 0.193:
            pass
        elif y > 0.162 and abs(x) < 0.03:
            c = skin
        elif abs(x) > 0.03 and y > 0.08:
            c = shirt if y > 0.098 else skin
        elif y < 0.09:
            c = pants if y > 0.012 else np.ones(3)
        elif z >= -0.0175:
            c = shirt
        attr.data[i].color = (*c, 1)
    mat = src.data.materials[0].copy()
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    link = bsdf.inputs["Base Color"].links[0]
    tint, mul = nt.nodes.new("ShaderNodeVertexColor"), nt.nodes.new("ShaderNodeMix")
    tint.layer_name = "tint"
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(link.from_socket, mul.inputs["A"])
    nt.links.new(tint.outputs["Color"], mul.inputs["B"])
    nt.links.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
    data.materials[0] = mat
    return data


def people(layout, height_at):
    for k, f in enumerate(layout["figures"]):
        y = f["y"] if f["y"] < -0.1 or f["y"] > 0.05 else height_at(f["x"], f["z"])
        obj = bpy.data.objects.new(f"survivor{k}", survivor_tinted(k))
        bpy.context.scene.collection.objects.link(obj)
        obj.location = g2b(f["x"], y, f["z"])
        obj.rotation_euler = (0, 0, f["turn"])
        obj.scale = (PEOPLE_SCALE,) * 3
        if f["tool"]:
            place(f"life-tool-{f['tool']}", f["x"], y, f["z"], turn=f["turn"], scale=(PEOPLE_SCALE,) * 3)
    for k, (x, y, z) in enumerate(((-2.5, 2.2, 1.0), (3.2, 2.6, -1.5), (0.8, 2.0, 3.6))):
        place("life-gull", x, y, z, turn=k * 2.0, scale=(1.4, 1.4, 1.4))


def plants(layout, height_at, trails_d, grid):
    """Dense groves near the coast and between the buildings; never on a trail, a building or the shore's edge."""
    px, pz, dd = grid
    era = STAGE_ERA[max(s for s in STAGE_ERA if s <= layout["lighthouse"])]
    trees = ["wild-tree", "wild-tree", "garden-tree"] if era == "wild" else ["modern-tree", "garden-tree", "modern-tree"]
    bushes = ["wild-bush", "wild-bush", "grass", "wild-flowers"] if era == "wild" else ["hedge", "wild-bush", "grass", "flowerbed"]
    res = px.shape[0]
    cell = 2 * SPAN / (res - 1)

    def at(x, z):
        i, j = int(round((z + SPAN) / cell)), int(round((x + SPAN) / cell))
        return dd[i, j], trails_d[i, j]

    blds = [(b["x"], b["z"], b["reach"] * BUILDING_SCALE) for b in layout["buildings"]]
    spots = [(f["x"], f["z"]) for f in layout["figures"]]

    def free(x, z, room, tall):
        d, t = at(x, z)
        if d < (0.22 if tall else 0.1) or t < 0.12:
            return False
        for bx, bz, br in blds:
            reach = float(hex_reach(np.array(x - bx), np.array(z - bz)))
            if reach < br + room:
                return False
            # Tall plants never stand just in front of a building (the camera looks from +z).
            if tall and -0.2 < z - bz < 2.0 and abs(x - bx) < 1.1:
                return False
        return all(math.dist((x, z), s) > 0.15 for s in spots)

    rng = np.random.default_rng(11)
    centers = []
    for x in np.arange(-5.6, 5.7, 0.55):
        for z in np.arange(-5.2, 5.3, 0.55):
            x1, z1 = x + rng.uniform(-0.2, 0.2), z + rng.uniform(-0.2, 0.2)
            d, _ = at(x1, z1)
            coast = 1.0 if 0.2 < d < 0.75 else 0.0
            if d > 0.15 and float(fbm(np.array(x1 * 0.8), np.array(z1 * 0.8), 21.0)) + 0.4 * coast > 0.3:
                centers.append((x1, z1))
    for cx, cz in centers:
        for k in range(int(rng.integers(3, 8))):
            a, r = rng.uniform(0, 2 * math.pi), rng.uniform(0, 0.38)
            x, z = cx + math.cos(a) * r, cz + math.sin(a) * r
            tall = k < 3
            name = trees[k % len(trees)] if tall else bushes[int(rng.integers(0, len(bushes)))]
            # Trees keep a ring of grass and earth around each building; a third of them less than before.
            if tall and rng.uniform() < 0.33:
                tall, name = False, bushes[int(rng.integers(0, len(bushes)))]
            if not free(x, z, 0.32 if tall else 0.2, tall):
                if tall:
                    name = bushes[0]
                    if not free(x, z, 0.2, False):
                        continue
                else:
                    continue
            s = rng.uniform(0.8, 1.25) * (1.15 if "tree" in name else 1.0)
            place(f"life-plant-{name}", x, height_at(x, z) - 0.01, z, turn=rng.uniform(0, 6.28), scale=(s, s, s))
    # Rocks along the shore and the cliffs.
    for k in range(260):
        x, z = rng.uniform(-6, 6), rng.uniform(-6, 6)
        d, t = at(x, z)
        if -0.12 < d < 0.12:
            s = rng.uniform(0.03, 0.09)
            kit.sphere(s, (x, height_at(x, z) + s * 0.3, z), "rock" if k % 3 else "rock_dark", subdivisions=1, squash=0.6)


def light(direction):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("world")
    scene.world = world
    bg = world.node_tree.nodes["Background"]
    bpy.ops.object.light_add(type="SUN")
    sun = bpy.context.active_object
    if direction == "M":
        # The owner's mix: A's low sun, moved to the left and a little toward the camera so the fronts are lit; golden
        # lights, bluish shadows (a cool sky fills them), A's contrast.
        el, az, color, energy, angle, sky, sky_k = 24, 202, (1.0, 0.66, 0.36), 7.0, 2.5, (0.42, 0.56, 0.88, 1), 1.0
    elif direction == "A":
        # Golden late afternoon from the back left: long soft shadows toward the camera, the sea glittering beyond.
        el, az, color, energy, angle, sky, sky_k = 27, 145, (1.0, 0.78, 0.55), 6.0, 2.5, (0.62, 0.68, 0.82, 1), 1.0
    else:
        # Clear midday from high up: short crisp shadows, pale bright sky.
        el, az, color, energy, angle, sky, sky_k = 64, 160, (1.0, 0.97, 0.93), 4.0, 1.2, (0.72, 0.84, 1.0, 1), 1.0
    e, a = math.radians(el), math.radians(az)
    # Where the light goes, in the game's axes (az: from +x toward -z), then Blender's.
    d_game = Vector((-math.cos(e) * math.cos(a), -math.sin(e), math.cos(e) * math.sin(a)))
    d = g2b(*d_game).normalized()
    sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sun.data.color = color
    sun.data.energy = energy
    sun.data.angle = math.radians(angle)
    bg.inputs["Color"].default_value = sky
    bg.inputs["Strength"].default_value = sky_k


def camera(layout, width, height):
    c = layout["camera"]
    cam_data = bpy.data.cameras.new("camera")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle = math.radians(c["fov"])
    cam = bpy.data.objects.new("camera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    pos, tgt = g2b(*c["position"]), g2b(*c["target"])
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = width, height


def main(city, direction, out, samples=64):
    layout = json.loads((HERE / "targets" / f"{city}.json").read_text())
    kit.reset(style=False)
    era = STAGE_ERA[max(s for s in STAGE_ERA if s <= layout["lighthouse"])]
    height_at, trails_d, grid = ground(layout, era)
    water(layout, direction)
    buildings(layout, height_at)
    village(layout, direction)
    people(layout, height_at)
    plants(layout, height_at, trails_d, grid)
    light(direction)
    camera(layout, 824, 1830)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    for look in (("AgX - Punchy", "AgX - Medium High Contrast") if direction in ("A", "M") else ("AgX - Base Contrast",)):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.render.filepath = str(out)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("rendered", out)


if __name__ == "__main__":
    a = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    main(a[0], a[1], a[2], int(a[3]) if len(a) > 3 else 64)
