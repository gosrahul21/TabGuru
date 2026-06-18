#!/usr/bin/env python3
"""
Generate TabGuru branded icons with purple gradient background + rounded corners.
Logo figure is tinted pure white.
Outputs: icon16.png, icon32.png, icon48.png, icon128.png  (and a 512px master)
"""
from PIL import Image, ImageDraw
import math, os

SRC = os.path.join(os.path.dirname(__file__), "../public/icons/image-removebg-preview.png")
OUT_DIR = os.path.join(os.path.dirname(__file__), "../public/icons")

# Gradient colours matching the screenshot: top-left violet → bottom-right blue
TOP_LEFT     = (108,  65, 198)   # #6C41C6  deep violet
BOTTOM_RIGHT = ( 72, 100, 235)   # #4864EB  royal blue

SIZES = [16, 32, 48, 128, 512]


def make_gradient(size: int) -> Image.Image:
    """Render a diagonal linear gradient on an RGBA canvas."""
    img = Image.new("RGBA", (size, size))
    px = img.load()
    d = math.sqrt(2) * size  # diagonal length
    for y in range(size):
        for x in range(size):
            t = (x + y) / (size + size - 2)   # 0 → 1 along top-left→bottom-right
            r = int(TOP_LEFT[0] + t * (BOTTOM_RIGHT[0] - TOP_LEFT[0]))
            g = int(TOP_LEFT[1] + t * (BOTTOM_RIGHT[1] - TOP_LEFT[1]))
            b = int(TOP_LEFT[2] + t * (BOTTOM_RIGHT[2] - TOP_LEFT[2]))
            px[x, y] = (r, g, b, 255)
    return img


def rounded_mask(size: int, radius_frac: float = 0.22) -> Image.Image:
    """Create a white rounded-rectangle mask."""
    radius = int(size * radius_frac)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def tint_white(img: Image.Image) -> Image.Image:
    """Replace all coloured pixels with white, preserving the alpha channel."""
    img = img.convert("RGBA")
    _, _, _, a = img.split()
    white = Image.new("RGBA", img.size, (255, 255, 255, 255))
    white.putalpha(a)
    return white


def generate(size: int) -> Image.Image:
    grad   = make_gradient(size)
    mask   = rounded_mask(size)

    # Apply rounded corners to gradient
    grad.putalpha(mask)

    # Load, tint white & resize the logo, leaving ~12% padding on each side
    logo = Image.open(SRC).convert("RGBA")
    logo = tint_white(logo)
    pad  = int(size * 0.12)
    logo_size = size - pad * 2
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)

    # Composite logo centred on gradient
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(grad, (0, 0), grad)
    canvas.paste(logo, (pad, pad), logo)
    return canvas


os.makedirs(OUT_DIR, exist_ok=True)

name_map = {16: "icon16", 32: "icon32", 48: "icon48", 128: "icon128", 512: "icon512"}
for s in SIZES:
    img = generate(s)
    path = os.path.join(OUT_DIR, f"{name_map[s]}.png")
    img.save(path, "PNG")
    print(f"  ✓ {path}  ({s}×{s})")

# Also write a favicon.png (512 px) to public/
favicon_path = os.path.join(OUT_DIR, "../favicon.png")
generate(512).save(favicon_path, "PNG")
print(f"  ✓ {favicon_path}  (512×512)")

print("\nDone!")
