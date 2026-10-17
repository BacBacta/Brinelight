"""
Cuts the icon sheet (sheet.png: 24 icons on a transparent background, 6 columns × 4 rows) into the game's icons.

    python3 assets/icons/make-icons.py

Each icon is cropped to its content, centered in a square and saved as client/public/icons/<name>-48.webp and
<name>-96.webp, with its transparent background. The sheet's icons are gold with a night-blue outline; the icons in
COLORS get their gold part changed to another palette color, keeping the outline and every shade of the gold.
Needs Pillow only.
"""
from pathlib import Path

from PIL import Image

# Gold parts recolored with a palette color (docs/art-direction.md). The other icons stay gold.
COLORS = {
    "fish": "#1FB5C4",
    "wood": "#C9A77A",
    "oil": "#FFC83A",
    "rope": "#E0C9A0",
    "pearl": "#FFF4DA",
    "survivor": "#FFF4DA",
    "mist": "#8A6CFF",
}

# Reading order, row by row.
NAMES = [
    ["fish", "wood", "oil", "rope", "pearl", "survivor"],
    ["boarders", "harpooners", "crossbowmen", "veteran", "wounded", "power"],
    ["lighthouse", "city", "sea", "captains", "alliance", "shop"],
    ["hammer", "research", "sail", "time", "mist", "morale"],
]
SIZES = [48, 96]
QUALITY = 90
# Room kept around the icon inside its square, as a share of its side.
MARGIN = 0.04
# The sheet's two colors: its gold, and the outline's night blue.
GOLD = (250, 182, 36)
NAVY = (2, 16, 40)

here = Path(__file__).resolve().parent
out = here.parent.parent / "client" / "public" / "icons"
out.mkdir(parents=True, exist_ok=True)


def hex_rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


def bands(profile):
    """The runs of the profile with content: one per row or column of icons."""
    runs, start = [], None
    for i, v in enumerate(profile + [0]):
        if v and start is None:
            start = i
        if not v and start is not None:
            runs.append((start, i))
            start = None
    return runs


def recolor(icon, target):
    """Moves each pixel along the navy-to-gold line toward navy-to-target: the outline stays, and so do the shades."""
    if target == GOLD:
        return icon
    axis = [g - n for g, n in zip(GOLD, NAVY)]
    norm = sum(a * a for a in axis)
    shift = [t - g for t, g in zip(target, GOLD)]
    px = icon.load()
    for y in range(icon.height):
        for x in range(icon.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # How far the pixel is from the outline toward the gold, 0 to 1.
            t = sum((c - n) * d for c, n, d in zip((r, g, b), NAVY, axis)) / norm
            t = max(0.0, min(1.0, t))
            px[x, y] = tuple(max(0, min(255, round(c + t * s))) for c, s in zip((r, g, b), shift)) + (a,)
    return icon


sheet = Image.open(here / "sheet.png").convert("RGBA")
alpha = sheet.getchannel("A")
w, h = sheet.size
cols = bands([int(any(alpha.getpixel((x, y)) > 16 for y in range(0, h, 2))) for x in range(w)])
rows = bands([int(any(alpha.getpixel((x, y)) > 16 for x in range(0, w, 2))) for y in range(h)])
assert len(cols) == 6 and len(rows) == 4, f"expected a 6 × 4 grid, found {len(cols)} × {len(rows)}"

for r, (y0, y1) in enumerate(rows):
    for c, (x0, x1) in enumerate(cols):
        name = NAMES[r][c]
        cell = sheet.crop((x0, y0, x1, y1))
        cell = cell.crop(cell.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
        cell = recolor(cell, hex_rgb(COLORS.get(name, "#%02X%02X%02X" % GOLD)))
        side = round(max(cell.size) * (1 + 2 * MARGIN))
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(cell, ((side - cell.width) // 2, (side - cell.height) // 2))
        for size in SIZES:
            # Resized with premultiplied alpha, so the edges keep no dark fringe.
            small = square.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")
            small.save(out / f"{name}-{size}.webp", "WEBP", quality=QUALITY, method=6)
        print(f"{name:<12} {cell.width}×{cell.height} px in the sheet")
