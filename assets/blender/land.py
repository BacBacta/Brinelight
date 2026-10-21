"""
The island's land after the style pass (owner, after meeting 4): one continuous island with an organic coast, a little
relief, beaches and short cliffs, worn trails between the buildings, groves along the coast and between the buildings.
Pure numpy (no Blender): the target images (target.py) and the game's models (terrain.py) share it, so both show the
same island.

Everything is in the game's axes: x to the right, y up, z toward the camera; a plot is 2 wide (apothem 1), the meadow at
y = 0, the sea at rest at y = -0.42.
"""
import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MANIFEST = HERE.parent.parent / "client" / "src" / "scene" / "city-models.json"
# The city's sea after the style pass (owner: cliffs half as high): 0.2 higher than the first village's -0.42.
SEA = -0.22
BUILDING_SCALE = 1.15

# Where each building stands (client/src/city/plots.ts, ERA_PLOTS; client/test/life.test.ts checks they agree).
ERA_PLOTS = {
    "lighthouse": (0, 0),
    "refinery": (2, -2),
    "harbor": (0, -2),
    "shelters": (2, -1),
    "observatory": (-1, -1),
    "barracks": (-1, 0),
    "fishery": (2, 0),
    "lumberyard": (0, 1),
    "infirmary": (-1, 1),
}


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
RING3 = [hx(q, r) for q in range(-3, 4) for r in range(-3, 4) if max(abs(q), abs(r), abs(q + r)) == 3]
BUILT = {k: hx(*v) for k, v in ERA_PLOTS.items()}


def reaches():
    """Each building's widest reach on its plot at any level (city-models.json), as the game shows it (scaled)."""
    m = json.loads(MANIFEST.read_text())
    out = {}
    for b in ERA_PLOTS:
        r = [s["reach"] for k, v in m.items() if k.startswith(f"{b}-") and k.split("-")[-1].isdigit() for s in v["levels"]]
        out[b] = (max(r) if r else 0.9) * BUILDING_SCALE
    return out


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def plot_reach(x, z):
    """Hex distance to the nearest plot's center: up to 1 on a plot."""
    return np.min([hex_reach(x - cx, z - cz) for cx, cz in PLOTS], axis=0)


def land_depth(x, z):
    """
    How far inside the land a point is (negative: in the sea): round lands softly joined around the plots, a coast pushed
    in and out by noise, always holding the plots' round lands joined softly (no plot's hexagon shows in the coast, and no
    point of it between two plots: owner) and never reaching into the rooms of the rafts of ring 3.
    """
    base = None
    for cx, cz in PLOTS:
        d = np.hypot(x - cx, z - cz) - 1.12
        base = d if base is None else smin(base, d, 0.6)
    coast = -base + 0.16 * fbm(x * 0.55, z * 0.55, 3.0) + 0.05 * fbm(x * 2.2, z * 2.2, 4.0)
    coast = -smin(-coast, base, 0.12)
    # The rafts' rooms joined softly into one band: the coast follows its round edge, with no point of land between two
    # rooms (owner: no hexagon shows); every room stays clear.
    # Joined softly enough to round the coast between two rooms, and never into the island's own round shape (the
    # plots' lands joined softly, without the noise): the coast stays round where there is no plot (owner).
    band = None
    for cx, cz in RING3:
        r = np.hypot(x - cx, z - cz) - 0.98
        band = r if band is None else smin(band, r, 0.9)
    return np.minimum(coast, -smin(-band, base, 0.15))


def cliffs(x, z):
    """
    Where the coast is a low cliff (1) rather than a beach in a gentle slope (0): the two in turn all around, more
    beaches on the side the camera sees (+z).
    """
    c = np.clip((fbm(x * 0.8, z * 0.8, 9.0) + 0.05) * 4, 0, 1)
    return c * np.clip(1.1 - 0.25 * z, 0.35, 1)


def flat_weight(x, z):
    """0 on the buildings' plots and on every plot's rim (where the moorings' stakes stand), 1 in the free plots' middles and beyond."""
    built = np.min([hex_reach(x - cx, z - cz) for cx, cz in BUILT.values()], axis=0)
    rim = plot_reach(x, z)
    return np.clip((built - 0.95) / 0.35, 0, 1) * np.clip((0.95 - rim) / 0.3, 0, 1) + np.clip((rim - 1.04) / 0.1, 0, 1) * np.clip((built - 1.0) / 0.3, 0, 1)


def heights(x, z):
    """
    The ground's height: gentle hills, flat on the buildings' plots and plots' rims, down to the sea (SEA) by a beach in a
    gentle slope that goes on under the water, or by a low cliff (owner: half as high as the first island's).
    """
    d = land_depth(x, z)
    hills = (0.05 + 0.07 * fbm(x * 0.6, z * 0.6, 1.0)) * flat_weight(x, z)
    c = cliffs(x, z)
    # A beach: from the meadow down to the water's edge over 0.35; a cliff: straight down at the coast.
    beach = np.clip(d / 0.35, 0, 1)
    beach = beach * beach * (3 - 2 * beach)
    cliff = np.clip(d / 0.04, 0, 1)
    shore = beach * (1 - c) + cliff * c
    # The plots' land keeps its height to their rims; the shore drops beyond them.
    shore = np.where(plot_reach(x, z) <= 1.02, np.maximum(shore, 1.0), shore)
    edge = SEA - 0.03
    land = edge + (hills - edge) * shore
    # Under the water: the beach's sand goes on gently, the cliff's foot drops to the deep.
    floor = (SEA - 0.03 + np.maximum(d, -0.9) * 0.45) * (1 - c) + (SEA - 0.12 + np.maximum(d, -0.7) * 0.9) * c
    return np.where(d > 0, land, floor)


def trails():
    """
    Worn trails of beaten earth: from each building's door (its plot's front) to its nearest neighbor's (a tree, the
    shortest), and from the Lighthouse's door to the front beach. Polylines of the game's (x, z).
    """
    names = list(ERA_PLOTS)
    fronts = [(BUILT[n][0], BUILT[n][1] + 0.72) for n in names]
    done, edges = [0], []
    while len(done) < len(fronts):
        best = min(((i, j) for i in done for j in range(len(fronts)) if j not in done), key=lambda e: math.dist(fronts[e[0]], fronts[e[1]]))
        edges.append(best)
        done.append(best[1])
    lines = []
    for k, (i, j) in enumerate(edges):
        (ax, az), (bx, bz) = fronts[i], fronts[j]
        nx, nz = -(bz - az), bx - ax
        n = math.hypot(nx, nz) or 1
        bend = 0.18 * math.sin(k * 2.3 + 1)
        mx, mz = (ax + bx) / 2 + nx / n * bend, (az + bz) / 2 + nz / n * bend
        pts = []
        for t in np.linspace(0, 1, 24):
            u = 1 - t
            pts.append((float(u * u * ax + 2 * u * t * mx + t * t * bx), float(u * u * az + 2 * u * t * mz + t * t * bz)))
        lines.append(pts)
    lx, lz = BUILT["lighthouse"]
    lines.append([(float(lx + 0.05 * math.sin(t * 6)), float(lz + 0.72 + t * 3.4)) for t in np.linspace(0, 1, 24)])
    return lines


def distance_to(lines, x, z):
    d = np.full(np.shape(x), 99.0)
    for pts in lines:
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            dx, dz = bx - ax, bz - az
            t = np.clip(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz + 1e-9), 0, 1)
            d = np.minimum(d, np.hypot(x - ax - dx * t, z - az - dz * t))
    return d


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


# The three looks of the island, after the Lighthouse (as its plants: wild 1-9, gardens 10-24, the Modern era 25-30).
LOOKS = {
    # Fresh greens (owner, on the S22: no khaki), yellower and lighter than the first island's.
    "wild": {"greens": ("#93BE5E", "#6FA448", "#AECF6A", "#B9BE62"), "trail": ("#9A7448", "#7E5E3B")},
    "garden": {"greens": ("#96C162", "#6FA448", "#B1D16E", "#B4BC64"), "trail": ("#A5835A", "#87694A")},
    "modern": {"greens": ("#99C466", "#72A64B", "#B4D472", "#AFBC66"), "trail": ("#B9AB92", "#958A76")},
}


def colors(look, res, span):
    """The ground's colors seen from above, over -span..span: greens, earth by the doors and on the trails, sand, rock, pebbles, flowers."""
    xs = np.linspace(-span, span, res)
    px, pz = np.meshgrid(xs, xs)
    built = np.min([hex_reach(px - cx, pz - cz) for cx, cz in BUILT.values()], axis=0)
    dd = land_depth(px, pz)
    cc = cliffs(px, pz)
    g0, g1, g2, g3 = (hexc(c) for c in LOOKS[look]["greens"])
    n1, n2, n3 = fbm(px * 1.7, pz * 1.7, 5.0), fbm(px * 4.0, pz * 4.0, 6.0), fbm(px * 0.7, pz * 0.7, 7.0)
    col = mix(g0[None, None], g1[None, None], 0.5 + n1)
    col = mix(col, g2[None, None], (n2 - 0.15) * 3)
    col = mix(col, g3[None, None], (n3 - 0.2) * 2.5)
    earth, earth_dark = (hexc(c) for c in LOOKS[look]["trail"])
    yard = np.clip(1 - (built - 0.55) / 0.3, 0, 1) * np.clip(0.6 + n2, 0, 1)
    col = mix(col, earth[None, None], yard * 0.85)
    tr = distance_to(trails(), px, pz)
    width = 0.075 + 0.025 * fbm(px * 3, pz * 3, 8.0)
    worn = np.clip((width + 0.04 - tr) / 0.04, 0, 1) * np.clip(0.55 + 0.6 * vnoise(px * 18, pz * 18, 2.0), 0, 1)
    col = mix(col, earth[None, None], np.clip((width - tr) / 0.02, 0, 1))
    col = mix(col, earth_dark[None, None], np.clip((width * 0.5 - tr) / 0.03, 0, 1) * 0.35)
    col = mix(col, earth[None, None], worn * 0.6)
    sand, rock, rock_dark = hexc("#D9C9A3"), hexc("#8E877C"), hexc("#5E5850")
    beach = np.clip((0.28 - dd) / 0.12, 0, 1) * (1 - cc) * (plot_reach(px, pz) > 1.0)
    col = mix(col, sand[None, None], beach)
    col = mix(col, mix(rock[None, None], rock_dark[None, None], 0.5 + n2), np.clip((0.07 - dd) / 0.04, 0, 1) * cc)
    col = mix(col, mix(sand[None, None] * 0.8, rock_dark[None, None], cc), np.clip(-dd / 0.15, 0, 1))
    rng = np.random.default_rng(7)
    for count, cols, where in (
        (int(5000 * (res / 2048) ** 2), ("#8E877C", "#B9B2A6", "#6F6A62"), lambda m: (tr[m] < 0.2) | (dd[m] < 0.35)),
        (int(9000 * (res / 2048) ** 2), ("#FFF4DA", "#FFC83A", "#E2572F", "#F6F1E6"), lambda m: (n1[m] > 0.05) & (dd[m] > 0.3) & (tr[m] > 0.15) & (built[m] > 0.9)),
    ):
        iy, ix = rng.integers(0, res, count), rng.integers(0, res, count)
        keep = where((iy, ix))
        dot = max(1, res // 1024)
        for k, (a, b) in enumerate(zip(iy[keep], ix[keep])):
            col[a : a + dot, b : b + dot] = hexc(cols[k % len(cols)])
    return col, tr, dd


# The plants of each look: trees (tall), then the low ones.
PLANTS = {
    "wild": (("wild-tree", "wild-tree", "garden-tree"), ("wild-bush", "wild-bush", "grass", "wild-flowers")),
    "garden": (("garden-tree", "wild-tree", "garden-tree"), ("wild-bush", "hedge", "grass", "flowerbed")),
    "modern": (("modern-tree", "garden-tree", "modern-tree"), ("hedge", "wild-bush", "grass", "flowerbed")),
}


def groves(look, people=()):
    """
    Groves along the coast and between the buildings, a few trees alone: never on a trail, on the shore's edge, within
    a ring of grass and earth around each building, nor in front of one (the camera looks from +z), nor where people
    stand. A list of (plant, x, y, z, turn, scale).
    """
    trees, low = PLANTS[look]
    tr_lines = trails()
    reach = reaches()
    blds = [(BUILT[n][0], BUILT[n][1], reach[n]) for n in ERA_PLOTS]

    def free(x, z, room, tall):
        p = (np.array([x]), np.array([z]))
        d = float(land_depth(*p)[0])
        t = float(distance_to(tr_lines, *p)[0])
        if d < (0.22 if tall else 0.1) or t < 0.12:
            return False
        for bx, bz, br in blds:
            if float(hex_reach(np.array(x - bx), np.array(z - bz))) < br + room:
                return False
            if tall and -0.2 < z - bz < 2.0 and abs(x - bx) < 1.1:
                return False
        return all(math.dist((x, z), s) > 0.15 for s in people)

    rng = np.random.default_rng(11)
    out = []
    for x in np.arange(-5.6, 5.7, 0.55):
        for z in np.arange(-5.2, 5.3, 0.55):
            cx, cz = x + rng.uniform(-0.2, 0.2), z + rng.uniform(-0.2, 0.2)
            d = float(land_depth(np.array([cx]), np.array([cz]))[0])
            coast = 1.0 if 0.2 < d < 0.75 else 0.0
            if not (d > 0.15 and float(fbm(np.array(cx * 0.8), np.array(cz * 0.8), 21.0)) + 0.4 * coast > 0.3):
                continue
            for k in range(int(rng.integers(3, 8))):
                a, r = rng.uniform(0, 2 * math.pi), rng.uniform(0, 0.38)
                px, pz = cx + math.cos(a) * r, cz + math.sin(a) * r
                tall = k < 3
                name = trees[k % len(trees)] if tall else low[int(rng.integers(0, len(low)))]
                if tall and rng.uniform() < 0.33:
                    tall, name = False, low[int(rng.integers(0, len(low)))]
                if not free(px, pz, 0.32 if tall else 0.2, tall):
                    if not tall or not free(px, pz, 0.2, False):
                        continue
                    name = low[0]
                s = float(rng.uniform(0.8, 1.25) * (1.15 if "tree" in name else 1.0))
                y = float(heights(np.array([px]), np.array([pz]))[0]) - 0.01
                out.append((name, float(px), y, float(pz), float(rng.uniform(0, 6.28)), s))
    return out


def beach_spots(n=6):
    """Where the crabs scuttle: on the sand of the beaches the camera sees (+z side), in the game's (x, y, z)."""
    rng = np.random.default_rng(5)
    out = []
    while len(out) < n:
        x, z = rng.uniform(-5, 5), rng.uniform(0.5, 5.5)
        p = (np.array([x]), np.array([z]))
        d, c = float(land_depth(*p)[0]), float(cliffs(*p)[0])
        y = float(heights(*p)[0])
        apart = all(math.dist((x, z), (o[0], o[2])) > 0.6 for o in out)
        if 0.04 < d < 0.3 and c < 0.3 and float(plot_reach(*p)[0]) > 1.02 and y > SEA + 0.02 and apart:
            out.append((float(x), y, float(z)))
    return out


def coast_radii(n=72):
    """How far from the island's center its land reaches, in n directions (x = cos, z = sin): the game frames by it."""
    out = []
    rs = np.linspace(2.0, 7.0, 1001)
    for k in range(n):
        a = 2 * math.pi * k / n
        h = heights(np.cos(a) * rs, np.sin(a) * rs)
        above = np.nonzero(h >= SEA)[0]
        out.append(round(float(rs[above.max()]) if len(above) else 0.0, 3))
    return out

