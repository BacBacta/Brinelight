"""
The land won on the sea (owner, after the S22's worst case): from the Lighthouse 5, every raft slot taken is land, welded
to the island. Pure numpy, from land.py's island: one signed field for the island and every slot taken, so that the coast
stays one smooth line whatever slots are taken (with holes too), and the same field gives the heights, the colors and
where the dike runs. The game will compute the same field (see the owner's step 1 report).

    depth(x, z) > 0 on land, < 0 in the sea, in the game's units (a plot's apothem is 1).

A slot's land is the island's own shape: a round land 1.12 around its center, softly joined to its neighbors (smooth union, k = 0.9)
and to the island (k = 0.3); a free slot keeps its water (a round room of 0.98 carved, k =
0.12); a flooded slot (a raft under 60) keeps its land's outline but its ground lies under the water, its dike broken
on the sea's side; a slot being filled is a low landfill just above the water.
"""
import math

import numpy as np

import land

SEA = land.SEA
LAND = 1.12  # a slot's land around its center, as a plot's
ROOM = 0.98  # a free slot's water, as the rafts' rooms
JOIN = 0.9  # the soft join between neighbors: a smooth dike, gently waved
CARVE = 0.12
ROOM_JOIN = 0.9  # the free slots' waters joined softly into one round band: no point of land between two
HOLD_EDGE = 0.15  # the soft edge where that band meets the island's round shape and the slots taken


def island_shape(x, z):
    """The island's own round shape: the plots' lands joined softly, without the noise (negative inside)."""
    base = None
    for cx, cz in land.PLOTS:
        d = np.hypot(x - cx, z - cz) - 1.12
        base = d if base is None else land.smin(base, d, 0.6)
    return base


def island_depth(x, z):
    """The island's own land (land.land_depth) without the rafts' rooms: those are carved only where a slot is free."""
    base = island_shape(x, z)
    coast = -base + 0.16 * land.fbm(x * 0.55, z * 0.55, 3.0) + 0.05 * land.fbm(x * 2.2, z * 2.2, 4.0)
    return -land.smin(-coast, base, 0.12)


def slots_depth(x, z, slots):
    """The slots' land: round lands joined softly, a man-made edge (no noise: the dike holds it)."""
    if not slots:
        return np.full(np.shape(x), -99.0)
    base = None
    for s in slots:
        d = np.hypot(x - s["x"], z - s["z"]) - LAND
        base = d if base is None else land.smin(base, d, JOIN)
    return -base


class Land:
    """The land of one city: the island, the slots taken (land or flooded), the one being filled, the free ones."""

    def __init__(self, layout):
        self.slots = [s for s in layout["slots"]]
        self.flooded = [s for s in self.slots if s.get("flooded")]
        self.filling = layout.get("filling")
        won = self.slots + ([self.filling] if self.filling else [])
        self.won = won
        taken = {s["key"] for s in won}
        # Every slot not taken keeps its water, buoys or not.
        self.free = [s for s in ALL_SLOTS if s["key"] not in taken]

    def parts(self, x, z):
        """The island's field, the slots' field, and the whole land's (the free slots carved out)."""
        isl = island_depth(x, z)
        won = slots_depth(x, z, self.won)
        whole = -land.smin(-isl, -won, 0.3)
        if self.free:
            # The free slots' waters joined softly into one band, which never reaches into the island's own round shape
            # (the plots' lands joined softly, without the noise) nor into the slots taken: the coast stays round.
            band = None
            for s in self.free:
                r = np.hypot(x - s["x"], z - s["z"]) - ROOM
                band = r if band is None else land.smin(band, r, ROOM_JOIN)
            sea = -land.smin(-band, -np.maximum(-island_shape(x, z), won), HOLD_EDGE)
            whole = land.smin(whole, sea, CARVE)
        return isl, won, whole

    def depth(self, x, z):
        return self.parts(x, z)[2]

    def won_coast(self, x, z):
        """1 where the coast is the slots' (the dike runs there), 0 where it is the island's own (beach or cliff)."""
        isl, won, _ = self.parts(x, z)
        return np.clip((won - isl) / 0.15 + 0.5, 0, 1)

    def near(self, x, z, slots):
        """Hex distance to the nearest of these slots' centers (99 without any)."""
        if not slots:
            return np.full(np.shape(x), 99.0)
        return np.min([land.hex_reach(x - s["x"], z - s["z"]) for s in slots], axis=0)

    def breach(self, x, z):
        """1 in the flooded slots' breach: the side of their dike that faces the sea (away from the island's center)."""
        out = np.zeros(np.shape(x))
        for s in self.flooded:
            a0 = math.atan2(s["z"], s["x"])
            a = np.arctan2(z - s["z"], x - s["x"])
            da = np.abs((a - a0 + math.pi) % (2 * math.pi) - math.pi)
            r = np.hypot(x - s["x"], z - s["z"])
            out = np.maximum(out, np.clip((0.45 - da) / 0.15, 0, 1) * np.clip((r - 0.55) / 0.2, 0, 1) * np.clip((1.45 - r) / 0.15, 0, 1))
        return out

    def heights(self, x, z):
        """
        The ground: the island's (land.heights: hills, beaches, low cliffs) and on the slots' land a flat meadow at the
        plots' height, ending straight at the dike; the flooded slots' ground under the water, the landfill just above.
        """
        isl, won, d = self.parts(x, z)
        mine = self.won_coast(x, z)
        hills = (0.05 + 0.07 * land.fbm(x * 0.6, z * 0.6, 1.0)) * land.flat_weight(x, z)
        # The slots' land: nearly flat, a little lower than the meadow toward its dike.
        flat_won = 0.015 * land.fbm(x * 1.3, z * 1.3, 12.0)
        hills = hills * (1 - mine) + flat_won * mine
        c = land.cliffs(x, z) * (1 - mine) + mine
        beach = np.clip(d / 0.35, 0, 1)
        beach = beach * beach * (3 - 2 * beach)
        cliff = np.clip(d / 0.04, 0, 1)
        shore = beach * (1 - c) + cliff * c
        shore = np.where(land.plot_reach(x, z) <= 1.02, np.maximum(shore, 1.0), shore)
        edge = SEA - 0.03
        ground = edge + (hills - edge) * shore
        floor = (SEA - 0.03 + np.maximum(d, -0.9) * 0.45) * (1 - c) + (SEA - 0.12 + np.maximum(d, -0.7) * 0.9) * c
        h = np.where(d > 0, ground, floor)
        # Flooded: the ground sinks under the water inside its outline, its rim kept but broken toward the sea.
        if self.flooded:
            fl = np.min([np.hypot(x - s["x"], z - s["z"]) for s in self.flooded], axis=0)
            sink = np.clip((0.9 - fl) / 0.2, 0, 1)
            sink = np.maximum(sink, self.breach(x, z) * (fl < 1.3))
            h = h * (1 - sink) + (SEA - 0.07 + 0.02 * land.fbm(x * 3, z * 3, 14.0)) * sink
        # Being filled: a landfill just above the water, in low heaps.
        if self.filling:
            f = self.near(x, z, [self.filling])
            fill = np.clip((1.05 - f) / 0.15, 0, 1)
            heaps = SEA + 0.03 + 0.05 * np.clip(land.fbm(x * 2.2, z * 2.2, 15.0) + 0.2, 0, 1)
            h = h * (1 - fill) + np.minimum(h, heaps) * fill
        return h


def _slots():
    out = []
    for ring in (3, 4):
        for q in range(-ring, ring + 1):
            for r in range(-ring, ring + 1):
                if max(abs(q), abs(r), abs(q + r)) != ring or (q, r) in ((1, -3), (1, -4), (2, -4)):
                    continue
                x, z = land.hx(q, r)
                out.append({"key": f"{q},{r}", "x": x, "z": z, "ring": ring})
    return out


# The 39 raft slots (shared/src/rules/rafts.ts, RAFT_SLOTS: rings 3 and 4, the pier's three left out).
ALL_SLOTS = _slots()
assert len(ALL_SLOTS) == 39
