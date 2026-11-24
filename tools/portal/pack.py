"""
npm run pack:portal: the portal's build as the zip CrazyGames takes, index.html at its root
(client/dist-portal/ → brinelight-hold-the-light.zip at the repository's root, not committed).
"""
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
src = root / "client" / "dist-portal"
out = root / "brinelight-hold-the-light.zip"
assert (src / "index.html").exists(), "Build the portal first: npm run build:portal"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    files = sorted(p for p in src.rglob("*") if p.is_file())
    for p in files:
        z.write(p, p.relative_to(src).as_posix())
print(f"{out.name}: {len(files)} files, {out.stat().st_size / 1048576:.1f} MB")
