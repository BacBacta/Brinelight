"""
Makes the captains' portraits the game serves, from the originals in this folder (1024 × 1024 PNG).

    python3 assets/captains/make-portraits.py

For each captain: client/public/captains/<id>-96.webp (lists) and <id>-512.webp (the sheet), WebP quality 82.
The originals stay here, out of the client build. Needs Pillow; nothing is added to the game's dependencies.
"""
from pathlib import Path

from PIL import Image

IDS = ["tom", "sel", "bran", "isa", "mira", "nera"]
SIZES = [96, 512]
QUALITY = 82

here = Path(__file__).resolve().parent
out = here.parent.parent / "client" / "public" / "captains"
out.mkdir(parents=True, exist_ok=True)

for cid in IDS:
    source = Image.open(here / f"{cid}.png").convert("RGB")
    if source.size != (1024, 1024):
        raise SystemExit(f"{cid}.png is {source.size[0]} × {source.size[1]}, not 1024 × 1024")
    for size in SIZES:
        path = out / f"{cid}-{size}.webp"
        source.resize((size, size), Image.LANCZOS).save(path, "WEBP", quality=QUALITY, method=6)
        print(f"{path.relative_to(here.parent.parent)}  {path.stat().st_size // 1024} kB")
