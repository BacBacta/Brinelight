"""
The land's target images (owner, after the S22's worst case): from the Lighthouse 5 the rafts are land won on the sea,
welded to the island (reclaim.py), seen by the game's camera on the S22 (384 × 699 px, land-layouts.mts). Nothing in
the game changes.

- the same ground as the island's (its greens, its trails, its look of the era), on the island and on the land won;
- only the land won's outer edge changes with the eras: a low dike of stakes and stones (wild), the same with a band
  of wattle (gardens), stone quays with a few lamps (Modern era);
- a free slot stays water, its buoys only where a raft can be moored;
- a flooded slot (a raft under 60): its ground under the water, its dike broken on the sea's side, the "!" mark;
- the slot being filled by the shipyard: stakes around it, low heaps of earth, a wheelbarrow and planks;
- the buildings on rafts stand where they stood, on the land.

    .venv-blender/bin/python assets/blender/land_target.py <city> <out.png> [samples]
"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
import land  # noqa: E402
import reclaim  # noqa: E402
import target  # noqa: E402

HERE = Path(__file__).resolve().parent
SPAN = 10.5
SEA = reclaim.SEA
PIXELS = 2.81  # the S22's pixel ratio


def g2b(x, y, z):
    return Vector((x, -z, y))


def link(src, name, at, turn=0.0, scale=1.0):
    """A copy of a template object (its mesh shared), at the game's (x, y, z)."""
    obj = bpy.data.objects.new(name, src.data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = g2b(*at)
    obj.rotation_euler = (0, 0, turn)
    obj.scale = (scale, scale, scale) if isinstance(scale, float) else scale
    return obj


def template(make):
    """An object made by kit, kept out of the render: copies of it are linked where they stand."""
    parts = make()
    parts = parts if isinstance(parts, list) else [parts]
    obj = kit.join(parts, "template") if len(parts) > 1 else parts[0]
    obj.hide_render = True
    obj.hide_viewport = True
    return obj


# --- The ground ------------------------------------------------------------------------------------------------------
def extra_trails(layout):
    """From each building on land won to the island's nearest door: the trails go on onto the new land."""
    fronts = [(b["x"], b["z"] + 0.72) for b in layout["buildings"]]
    out = []
    for s in layout["slots"]:
        if not s["building"] or s["flooded"]:
            continue
        a = (s["x"], s["z"] + 0.45)
        b = min(fronts, key=lambda f: math.dist(f, a))
        mx, mz = (a[0] + b[0]) / 2 + 0.25, (a[1] + b[1]) / 2 - 0.1
        out.append([(float((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0]), float((1 - t) ** 2 * a[1] + 2 * (1 - t) * t * mz + t * t * b[1])) for t in np.linspace(0, 1, 24)])
    return out


def colors(L, layout, look, res):
    """The ground seen from above: land.colors' greens, earth and trails over the whole land, its shore from the land won's field."""
    xs = np.linspace(-SPAN, SPAN, res)
    px, pz = np.meshgrid(xs, xs)
    isl, won, dd = L.parts(px, pz)
    mine = L.won_coast(px, pz)
    cc = land.cliffs(px, pz) * (1 - mine)
    spots = [(b["x"], b["z"]) for b in layout["buildings"]] + [(s["x"], s["z"]) for s in layout["slots"] if s["building"]]
    built = np.min([land.hex_reach(px - cx, pz - cz) for cx, cz in spots], axis=0)
    small = np.min([land.hex_reach(px - s["x"], pz - s["z"]) + 0.35 for s in layout["slots"] if s["building"]] or [np.full(px.shape, 99.0)], axis=0)
    built = np.minimum(np.where(small < built, small, built), built)
    g0, g1, g2, g3 = (land.hexc(c) for c in land.LOOKS[look]["greens"])
    n1, n2, n3 = land.fbm(px * 1.7, pz * 1.7, 5.0), land.fbm(px * 4.0, pz * 4.0, 6.0), land.fbm(px * 0.7, pz * 0.7, 7.0)
    col = land.mix(g0[None, None], g1[None, None], 0.5 + n1)
    col = land.mix(col, g2[None, None], (n2 - 0.15) * 3)
    col = land.mix(col, g3[None, None], (n3 - 0.2) * 2.5)
    earth, earth_dark = (land.hexc(c) for c in land.LOOKS[look]["trail"])
    yard = np.clip(1 - (built - 0.55) / 0.3, 0, 1) * np.clip(0.6 + n2, 0, 1)
    col = land.mix(col, earth[None, None], yard * 0.85)
    tr = land.distance_to(land.trails() + extra_trails(layout), px, pz)
    width = 0.075 + 0.025 * land.fbm(px * 3, pz * 3, 8.0)
    worn = np.clip((width + 0.04 - tr) / 0.04, 0, 1) * np.clip(0.55 + 0.6 * land.vnoise(px * 18, pz * 18, 2.0), 0, 1)
    col = land.mix(col, earth[None, None], np.clip((width - tr) / 0.02, 0, 1))
    col = land.mix(col, earth_dark[None, None], np.clip((width * 0.5 - tr) / 0.03, 0, 1) * 0.35)
    col = land.mix(col, earth[None, None], worn * 0.6)
    sand, rock, rock_dark = land.hexc("#D9C9A3"), land.hexc("#8E877C"), land.hexc("#5E5850")
    # The island's own shore: sand on its beaches, rock on its low cliffs.
    beach = np.clip((0.28 - dd) / 0.12, 0, 1) * (1 - cc) * (land.plot_reach(px, pz) > 1.0) * (1 - mine)
    col = land.mix(col, sand[None, None], beach)
    col = land.mix(col, land.mix(rock[None, None], rock_dark[None, None], 0.5 + n2), np.clip((0.07 - dd) / 0.04, 0, 1) * cc)
    # Behind the land won's dike: a strip of trodden earth and gravel.
    quay = {"wild": "#9A8466", "garden": "#A08B6C", "modern": "#B7AE9C"}[look]
    col = land.mix(col, land.hexc(quay)[None, None], np.clip((0.16 - dd) / 0.08, 0, 1) * mine * (1 - L.breach(px, pz)))
    col = land.mix(col, land.mix(sand[None, None] * 0.8, rock_dark[None, None], np.maximum(cc, mine)), np.clip(-dd / 0.15, 0, 1))
    # The flooded slots: mud and drowned grass under the water.
    if L.flooded:
        fl = np.min([np.hypot(px - s["x"], pz - s["z"]) for s in L.flooded], axis=0)
        mud = land.mix(land.hexc("#6E6248")[None, None], land.hexc("#7C8A55")[None, None], 0.5 + n2)
        col = land.mix(col, mud, np.clip((1.0 - fl) / 0.15, 0, 1))
    # The landfill: fresh earth, darker where wet.
    if L.filling:
        f = land.hex_reach(px - L.filling["x"], pz - L.filling["z"])
        fresh = land.mix(land.hexc("#8C6A45")[None, None], land.hexc("#6A5238")[None, None], 0.5 + n1)
        col = land.mix(col, fresh, np.clip((1.08 - f) / 0.12, 0, 1))
    # Pebbles and flowers, as on the island.
    rng = np.random.default_rng(7)
    for count, cols, where in (
        (int(5000 * (res / 2048) ** 2), ("#8E877C", "#B9B2A6", "#6F6A62"), lambda m: (tr[m] < 0.2) | (dd[m] < 0.35)),
        (int(9000 * (res / 2048) ** 2), ("#FFF4DA", "#FFC83A", "#E2572F", "#F6F1E6"), lambda m: (n1[m] > 0.05) & (dd[m] > 0.3) & (tr[m] > 0.15) & (built[m] > 0.9)),
    ):
        iy, ix = rng.integers(0, res, count), rng.integers(0, res, count)
        keep = where((iy, ix))
        for k, (a, b) in enumerate(zip(iy[keep], ix[keep])):
            col[a : a + 2, b : b + 2] = land.hexc(cols[k % len(cols)])
    return col


def ground(L, layout, look):
    step = 0.05
    xs = np.arange(-SPAN, SPAN + 1e-6, step)
    gx, gz = np.meshgrid(xs, xs)
    hy = L.heights(gx, gz)
    n = len(xs)
    verts = np.stack([gx.ravel(), -gz.ravel(), hy.ravel()], axis=1)
    idx = np.arange(n * n).reshape(n, n)
    a, b, c, d = idx[:-1, :-1], idx[1:, :-1], idx[1:, 1:], idx[:-1, 1:]
    deep = np.maximum.reduce([hy[:-1, :-1], hy[1:, :-1], hy[1:, 1:], hy[:-1, 1:]]) < -1.05
    faces = np.stack([a, b, c, d], axis=-1)[~deep].reshape(-1, 4)
    mesh = bpy.data.meshes.new("ground")
    mesh.from_pydata(verts.tolist(), [], faces.tolist())
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new("ground", mesh)
    bpy.context.scene.collection.objects.link(obj)
    res = 2048
    col = colors(L, layout, look, res)
    rgba = np.concatenate([col, np.ones((res, res, 1))], axis=2)
    img = target.image("ground", rgba)
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
    return lambda x, z: float(L.heights(np.array([x]), np.array([z]))[0])


# --- The water -------------------------------------------------------------------------------------------------------
def water(L):
    res, span = 2048, 40.0
    xs = np.linspace(-span, span, res)
    px, pz = np.meshgrid(xs, xs)
    d = -L.depth(px, pz)
    t1 = np.clip(d / 2.0, 0, 1) ** 1.6
    t2 = np.clip((d - 1.2) / 5.0, 0, 1)
    shallow, mid, deep = land.hexc("#6FE3D6"), land.hexc("#2DB3C9"), land.hexc("#1C76A8")
    col = land.mix(land.mix(shallow[None, None], mid[None, None], t1), deep[None, None], t2)
    foam = np.clip(1 - np.abs(d) / 0.13, 0, 1) * np.clip(0.6 + 0.8 * land.vnoise(px * 9, pz * 9, 4.0), 0, 1)
    foam = np.where(d < -0.05, 0, foam)
    # The flooded slots: still, murky water, a ripple of foam at the breach.
    if L.flooded:
        fl = np.min([np.hypot(px - s["x"], pz - s["z"]) for s in L.flooded], axis=0)
        inside = np.clip((0.95 - fl) / 0.2, 0, 1)
        col = land.mix(col, land.hexc("#6FA79A")[None, None], inside * 0.8)
        foam = np.maximum(foam * (1 - inside), L.breach(px, pz) * 0.5 * np.clip(0.4 + land.vnoise(px * 14, pz * 14, 5.0), 0, 1))
    rgba = np.concatenate([col, foam[..., None]], axis=2)
    img = target.image("water", rgba)
    # The sea floor beyond the island's skirt, so the water looks the same everywhere.
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -1.1))
    floor = bpy.context.active_object
    floor.data.materials.append(kit.material("seabed"))
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, SEA))
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
    white = nt.nodes.new("ShaderNodeMix")
    white.data_type = "RGBA"
    white.inputs["B"].default_value = (0.95, 0.97, 0.96, 1)
    nt.links.new(tex.outputs["Alpha"], white.inputs["Factor"])
    nt.links.new(tex.outputs["Color"], white.inputs["A"])
    nt.links.new(white.outputs["Result"], bsdf.inputs["Base Color"])
    # A little see-through near the land: the shallows show the sand and the drowned slot's mud.
    bsdf.inputs["Transmission Weight"].default_value = 0.25
    bsdf.inputs["IOR"].default_value = 1.2
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.07
    rough.inputs["To Max"].default_value = 0.9
    nt.links.new(tex.outputs["Alpha"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    noise, bump = nt.nodes.new("ShaderNodeTexNoise"), nt.nodes.new("ShaderNodeBump")
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 3.0
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    obj.data.materials.append(mat)


# --- The dike ---------------------------------------------------------------------------------------------------------
def coast_points(L, spacing):
    """Points along the land won's coast, `spacing` apart, with the way out to sea (the field's falling side)."""
    step = 0.02
    xs = np.arange(-SPAN, SPAN, step)
    gx, gz = np.meshgrid(xs, xs)
    d = L.depth(gx, gz)
    mine = L.won_coast(gx, gz)
    br = L.breach(gx, gz)
    gz_d, gx_d = np.gradient(d, step)
    on = (np.abs(d) < step * 0.75) & (mine > 0.5) & (br < 0.3)
    if L.filling:
        on &= land.hex_reach(gx - L.filling["x"], gz - L.filling["z"]) > 1.15
    iy, ix = np.nonzero(on)
    order = np.lexsort((gx[iy, ix], gz[iy, ix]))
    kept = []
    cell = {}
    for k in order:
        x, z = float(gx[iy[k], ix[k]]), float(gz[iy[k], ix[k]])
        key = (int(x // spacing), int(z // spacing))
        near = [p for dx in (-1, 0, 1) for dz in (-1, 0, 1) for p in cell.get((key[0] + dx, key[1] + dz), [])]
        if any((x - p[0]) ** 2 + (z - p[1]) ** 2 < spacing * spacing for p in near):
            continue
        nx, nz = -float(gx_d[iy[k], ix[k]]), -float(gz_d[iy[k], ix[k]])
        n = math.hypot(nx, nz) or 1.0
        p = (x, z, nx / n, nz / n)
        cell.setdefault(key, []).append(p)
        kept.append(p)
    return kept


def dike(L, look):
    """The land won's edge: stakes and stones (wild), with a band of wattle (gardens), stone quays and lamps (Modern)."""
    rng = np.random.default_rng(3)
    if look == "modern":
        block = template(lambda: [kit.box((0.2, 0.3, 0.12), (0, -0.15, 0), "stone", bevel=0.012), kit.box((0.21, 0.035, 0.15), (0, 0.0, -0.01), "concrete", bevel=0.01)])
        lamp = template(lambda: [kit.cylinder(0.014, 0.42, (0, 0.21, 0), "navy", sides=8, bevel=0), kit.lantern((0, 0.45, 0), size=0.07)])
        pts = coast_points(L, 0.19)
        for k, (x, z, nx, nz) in enumerate(pts):
            turn = math.atan2(nz, nx) + math.pi / 2
            link(block, f"quay{k}", (x - nx * 0.04, 0.0, z - nz * 0.04), turn=-turn)
        for k, (x, z, nx, nz) in enumerate(coast_points(L, 1.7)):
            link(lamp, f"lamp{k}", (x - nx * 0.14, 0.0, z - nz * 0.14))
        return
    stake = template(lambda: kit.cylinder(0.02, 0.36, (0, -0.15, 0), "drift", sides=6, bevel=0))
    stones = [template(lambda c=c: kit.sphere(0.05, (0, 0, 0), c, subdivisions=1, squash=0.55)) for c in ("rock", "rock_dark", "stone_dark")]
    band = template(lambda: kit.box((0.15, 0.06, 0.018), (0, -0.04, 0), "drift_light", bevel=0.004)) if look == "garden" else None
    spacing = 0.11 if look == "wild" else 0.1
    for k, (x, z, nx, nz) in enumerate(coast_points(L, spacing)):
        lean = rng.uniform(-0.08, 0.08)
        top = rng.uniform(-0.02, 0.03)
        o = link(stake, f"stake{k}", (x + nx * 0.02, top, z + nz * 0.02), turn=rng.uniform(0, 6.28))
        o.rotation_euler = (lean, rng.uniform(-0.06, 0.06), o.rotation_euler[2])
        if band is not None:
            turn = math.atan2(nz, nx) + math.pi / 2
            link(band, f"band{k}", (x + nx * 0.035, 0.0, z + nz * 0.035), turn=-turn)
        for j in range(2 if look == "wild" else 3):
            s = rng.uniform(0.6, 1.4)
            out = rng.uniform(0.04, 0.14)
            link(stones[int(rng.integers(0, 3))], f"stone{k}-{j}", (x + nx * out + rng.uniform(-0.05, 0.05), SEA + rng.uniform(-0.02, 0.03), z + nz * out + rng.uniform(-0.05, 0.05)), turn=rng.uniform(0, 6.28), scale=(s, s * 1.2, s))


def breach(L, look):
    """The flooded slot's broken dike: a few stakes left leaning or fallen, stones scattered in the gap."""
    rng = np.random.default_rng(9)
    for k, s in enumerate(L.flooded):
        a0 = math.atan2(s["z"], s["x"])
        for j in range(7):
            a = a0 + rng.uniform(-0.5, 0.5)
            r = rng.uniform(0.9, 1.15)
            x, z = s["x"] + math.cos(a) * r, s["z"] + math.sin(a) * r
            if look == "modern":
                kit.box((0.2, 0.12, 0.12), (x, SEA - 0.02, z), "stone", bevel=0.012, turn=rng.uniform(0, 3), tilt=(rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4)))
            else:
                kit.cylinder(0.02, 0.3, (x, SEA + 0.03, z), "drift", sides=6, bevel=0, turn=rng.uniform(0, 6), tilt=(rng.uniform(0.6, 1.3), 0))
            kit.sphere(0.05, (x + rng.uniform(-0.1, 0.1), SEA - 0.01, z + rng.uniform(-0.1, 0.1)), "rock", subdivisions=1, squash=0.55)
        # A few drowned tufts stick out of the water.
        for j in range(10):
            a, r = rng.uniform(0, 6.28), rng.uniform(0, 0.7)
            kit.cone(0.03, 0.08, (s["x"] + math.cos(a) * r, SEA + 0.02, s["z"] + math.sin(a) * r), "meadow_dark", sides=5)


def landfill(L, height_at):
    """The shipyard at work: stakes around the slot, low heaps of earth, a wheelbarrow, planks and a shovel."""
    f = L.filling
    if not f:
        return
    rng = np.random.default_rng(4)
    for k in range(30):
        a = 2 * math.pi * k / 30
        x, z = f["x"] + math.cos(a) * 1.08, f["z"] + math.sin(a) * 1.08
        if float(L.won_coast(np.array([x]), np.array([z]))[0]) < 0.5 and float(land.hex_reach(np.array(x), np.array(z))) < 5:
            continue
        kit.cylinder(0.022, 0.42, (x, SEA + 0.1, z), "drift", sides=6, bevel=0, tilt=(rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08)))
    for k in range(5):
        a, r = rng.uniform(0, 6.28), rng.uniform(0.1, 0.6)
        x, z = f["x"] + math.cos(a) * r, f["z"] + math.sin(a) * r
        kit.cone(rng.uniform(0.18, 0.3), rng.uniform(0.08, 0.14), (x, height_at(x, z) + 0.04, z), "earth", sides=10)
    x, z = f["x"] - 0.35, f["z"] + 0.25
    y = height_at(x, z)
    # The wheelbarrow: a tray, a wheel in front, two handles.
    kit.box((0.2, 0.07, 0.14), (x, y + 0.11, z), "wood", bevel=0.01, turn=0.4)
    kit.box((0.16, 0.04, 0.1), (x, y + 0.15, z), "earth", bevel=0.01, turn=0.4)
    kit.wheel((x + 0.12 * math.cos(0.4), y + 0.06, z - 0.12 * math.sin(0.4)), radius=0.055, color="dark", facing="x")
    for side in (-1, 1):
        kit.rod((x - 0.05, y + 0.1, z + side * 0.06), (x - 0.2, y + 0.13, z + side * 0.07 + 0.08), 0.008, "wood", 5)
    for k in range(3):
        kit.box((0.5, 0.015, 0.07), (f["x"] + 0.2 + k * 0.02, height_at(f["x"] + 0.2, f["z"] - 0.4) + 0.03 + k * 0.016, f["z"] - 0.4 + k * 0.08), "plank", bevel=0.004, turn=0.2 * k)
    kit.rod((f["x"] + 0.4, height_at(f["x"] + 0.4, f["z"]) + 0.02, f["z"]), (f["x"] + 0.5, height_at(f["x"] + 0.4, f["z"]) + 0.3, f["z"] - 0.05), 0.008, "wood", 5)


# --- Buoys, buildings, plants ----------------------------------------------------------------------------------------
def buoys(layout):
    for f in layout["free"]:
        x, z = f["x"], f["z"]
        corners = [(x + 0.92 * math.cos(math.radians(90 + 60 * i)), z + 0.92 * math.sin(math.radians(90 + 60 * i))) for i in range(6)]
        for cx, cz in corners:
            kit.sphere(0.045, (cx, SEA + 0.02, cz), "white", subdivisions=1, squash=0.9)
            kit.sphere(0.03, (cx, SEA + 0.06, cz), "brick", subdivisions=1, squash=0.8)
        for (ax, az), (bx, bz) in zip(corners, corners[1:] + corners[:1]):
            kit.rod((ax, SEA + 0.001, az), (bx, SEA + 0.001, bz), 0.0012, "seabed", 3)


def buildings(layout, height_at):
    for b in layout["buildings"]:
        target.place(b["model"], b["x"], 0, b["z"], scale=(b["scale"],) * 3, level=b["level"])
        if b.get("extra"):
            target.place(b["extra"], b["x"], 0, b["z"])
    for s in layout["slots"]:
        if s["building"] and not s["flooded"]:
            target.place(s["building"], s["x"], height_at(s["x"], s["z"]) - 0.005, s["z"])


def plants(L, layout, look, height_at):
    """The island's groves (land.groves, as in the game) and a few plants on each slot won: never on its building's room, a trail or the dike."""
    for k, (name, x, y, z, turn, s) in enumerate(land.groves(look)):
        target.place(f"life-plant-{name}", x, y, z, turn=turn, scale=(s, s, s))
    trees, low = land.PLANTS[look]
    rng = np.random.default_rng(12)
    lines = land.trails() + extra_trails(layout)
    for s in layout["slots"]:
        if s["flooded"]:
            continue
        for k in range(int(rng.integers(4, 9))):
            a, r = rng.uniform(0, 6.28), rng.uniform(0.15, 0.85)
            x, z = s["x"] + math.cos(a) * r, s["z"] + math.sin(a) * r
            p = (np.array([x]), np.array([z]))
            if float(L.depth(*p)[0]) < 0.2 or float(land.distance_to(lines, *p)[0]) < 0.12:
                continue
            if s["building"] and r < 0.62:
                continue
            tall = rng.uniform() < 0.3 and not s["building"]
            name = trees[k % len(trees)] if tall else low[int(rng.integers(0, len(low)))]
            sc = float(rng.uniform(0.8, 1.2))
            target.place(f"life-plant-{name}", x, height_at(x, z) - 0.01, z, turn=rng.uniform(0, 6.28), scale=(sc, sc, sc))


def marks(layout, out):
    """Where the flooded slots' "!" mark goes on the image (the game draws it over the slot)."""
    scene = bpy.context.scene
    cam = scene.camera
    pts = []
    for s in layout["slots"]:
        if s["flooded"]:
            v = world_to_camera_view(scene, cam, g2b(s["x"], 0.45, s["z"]))
            pts.append([v.x * scene.render.resolution_x, (1 - v.y) * scene.render.resolution_y])
    Path(str(out) + ".marks.json").write_text(json.dumps(pts))


def main(city, out, samples=48):
    layout = json.loads((HERE / "targets" / f"{city}.json").read_text())
    kit.reset(style=False)
    L = reclaim.Land(layout)
    look = layout["look"]
    height_at = ground(L, layout, look)
    water(L)
    dike(L, look)
    breach(L, look)
    landfill(L, height_at)
    buoys(layout)
    buildings(layout, height_at)
    plants(L, layout, look, height_at)
    for k, (x, y, z) in enumerate(((-2.5, 2.2, 1.0), (3.2, 2.6, -1.5), (0.8, 2.0, 3.6))):
        target.place("life-gull", x, y, z, turn=k * 2.0, scale=(1.4, 1.4, 1.4))
    target.light("M")
    w, h = round(layout["camera"]["width"] * PIXELS), round(layout["camera"]["height"] * PIXELS)
    target.camera(layout, w, h)
    marks(layout, out)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    for lk in ("AgX - Punchy", "AgX - Medium High Contrast"):
        try:
            scene.view_settings.look = lk
            break
        except TypeError:
            continue
    scene.render.filepath = str(out)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("rendered", out)


if __name__ == "__main__":
    a = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    main(a[0], a[1], int(a[2]) if len(a) > 2 else 48)
