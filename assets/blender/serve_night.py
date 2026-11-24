"""
Serves the portal's enemies (night_enemies.py, in assets/blender/out/) to client/public/night/, as serve.py serves the
city's models: a WebP texture of 256 px, quantized geometry. Not written in the city's manifest.

    python3 assets/blender/serve_night.py
"""
import importlib.util
from pathlib import Path

here = Path(__file__).resolve().parent
NAMES = ("night-raider", "night-beast", "night-wraith", "night-galleon", "night-kraken", "night-leviathan")

spec = importlib.util.spec_from_file_location("serve_city", here / "serve.py")
sv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sv)
sv.SERVED = here.parent.parent / "client" / "public" / "night"

for name in NAMES:
    sv.TEXTURE[name] = 256
    sv.serve(name)
    print(f"{name:<16} {(sv.SERVED / (name + '.glb')).stat().st_size:6d} bytes")
