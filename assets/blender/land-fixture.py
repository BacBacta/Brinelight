"""
Points of the land's field computed by reclaim.py, for client/test/landField.test.ts: the game's port must give the same
depth, height and dike at each (the land of the target images: land5, land15, land30).

    python3 assets/blender/land-fixture.py
"""
import json
from pathlib import Path

import numpy as np

import reclaim

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "client" / "test" / "fixtures" / "land.json"
rng = np.random.default_rng(1)
cases = []
for name in ("land5", "land15", "land30"):
    layout = json.loads((HERE / "targets" / f"{name}.json").read_text())
    L = reclaim.Land(layout)
    xs, zs = np.round(rng.uniform(-9.5, 9.5, 400), 6), np.round(rng.uniform(-9.5, 9.5, 400), 6)
    cases.append({
        "won": [{"x": s["x"], "z": s["z"]} for s in L.won],
        "flooded": [{"x": s["x"], "z": s["z"]} for s in L.flooded],
        "filling": {"x": L.filling["x"], "z": L.filling["z"]} if L.filling else None,
        "free": [{"x": s["x"], "z": s["z"]} for s in L.free],
        "points": [[round(float(x), 6), round(float(z), 6)] for x, z in zip(xs, zs)],
        "depth": [round(float(v), 9) for v in L.depth(xs, zs)],
        "mine": [round(float(v), 9) for v in L.won_coast(xs, zs)],
        "y": [round(float(v), 9) for v in L.heights(xs, zs)],
    })
OUT.write_text(json.dumps(cases, separators=(",", ":")) + "\n")
print("wrote", OUT, sum(len(c["points"]) for c in cases), "points")
