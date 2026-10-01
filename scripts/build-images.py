#!/usr/bin/env python3
"""Build the logo variants, favicon set, web manifest and OG image.

Idempotent and Pillow-only. Source: assets-src/logo-source.jpeg.
Run from the repo root: python3 scripts/build-images.py
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "logo-source.jpeg"
PUBLIC = ROOT / "public"
IMAGES = PUBLIC / "assets" / "images"

TEAL = (0, 169, 157)    # logo script
AMBER = (251, 176, 59)  # logo figure
WHITE = (255, 255, 255)
OFF_WHITE = (252, 249, 243)
BG_THRESHOLD = 12       # ink strength (0-255) below which a pixel is background
LOGO_HEIGHT = 160       # retina-friendly for a ~56-64px header


def ink_strength(px):
    return 255 - min(px)


def to_transparent(img):
    """White background -> soft alpha; ink recolored to the exact brand colors.

    Anti-aliased edge pixels are blends of ink and white, so the ink amount
    (distance from white) is the alpha, normalized by the ink's own strength.
    """
    rgb = img.convert("RGB")
    out = Image.new("RGBA", rgb.size)
    src, dst = rgb.load(), out.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = src[x, y]
            s = 255 - min(r, g, b)
            if s < BG_THRESHOLD:
                dst[x, y] = (0, 0, 0, 0)
                continue
            fg = AMBER if r > b else TEAL
            fg_strength = 255 - min(fg)
            alpha = min(1.0, s / fg_strength)
            dst[x, y] = (*fg, round(alpha * 255))
    return out


def trim(img, pad=0):
    box = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    img = img.crop(box)
    if pad:
        canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
        canvas.paste(img, (pad, pad))
        img = canvas
    return img


def to_height(img, height):
    width = round(img.width * height / img.height)
    return img.resize((width, height), Image.LANCZOS)


def whiten(img):
    out = Image.new("RGBA", img.size, WHITE + (0,))
    out.putalpha(img.getchannel("A"))
    return out


def split_mark(logo):
    """Return the figure above the script: the first empty row band after the top ink."""
    alpha = logo.getchannel("A").point(lambda a: 255 if a > 8 else 0)
    inked = [alpha.crop((0, y, logo.width, y + 1)).getbbox() is not None for y in range(logo.height)]
    top = inked.index(True)
    gap = next((y for y in range(top, logo.height) if not inked[y]), None)
    if gap is None:
        return None
    return trim(logo.crop((0, 0, logo.width, gap)))


def on_square(img, size, bg=None, fill=0.7):
    """Center img on a size x size canvas covering `fill` of the side."""
    scale = size * fill / max(img.size)
    resized = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (bg + (255,)) if bg else (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def primary_hex():
    css = (ROOT / "src" / "css" / "variables.css").read_text()
    r, g, b = map(int, re.search(r"--color-primary-600:\s*(\d+)\s+(\d+)\s+(\d+)", css).groups())
    return (r, g, b), "#{:02x}{:02x}{:02x}".format(r, g, b)


def load_font(size):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/ubuntu/UbuntuSans[wdth,wght].ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def build_og(logo_full, teal_dark):
    og = Image.new("RGB", (1200, 630), OFF_WHITE)
    logo = logo_full.resize((840, round(logo_full.height * 840 / logo_full.width)), Image.LANCZOS)
    text = "Coach Ontológica · Salud, Bienestar y Nutrición Consciente"
    size = 34
    font = load_font(size)
    draw = ImageDraw.Draw(og)
    while draw.textlength(text, font=font) > 1040 and size > 16:
        size -= 1
        font = load_font(size)
    text_w = draw.textlength(text, font=font)
    block = logo.height + 48 + size
    top = (630 - block) // 2
    og.paste(logo, ((1200 - logo.width) // 2, top), logo)
    draw.text(((1200 - text_w) / 2, top + logo.height + 48), text, font=font, fill=teal_dark)
    og.save(PUBLIC / "og-image.jpg", "JPEG", quality=88, optimize=True, progressive=True)


def main():
    IMAGES.mkdir(parents=True, exist_ok=True)
    full = trim(to_transparent(Image.open(SRC)))

    logo = to_height(full, LOGO_HEIGHT)
    logo.save(IMAGES / "logo.png", optimize=True)
    whiten(logo).save(IMAGES / "logo-white.png", optimize=True)

    mark = split_mark(full) or full
    mark_small = to_height(mark, 256)
    mark_small.save(IMAGES / "logo-mark.png", optimize=True)

    # Favicon set (mark only)
    on_square(mark, 256, fill=0.86).save(
        PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )
    on_square(mark, 32, fill=0.9).save(PUBLIC / "favicon-32.png", optimize=True)
    on_square(mark, 180, bg=WHITE, fill=0.62).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    on_square(mark, 192, bg=WHITE, fill=0.62).convert("RGB").save(PUBLIC / "icon-192.png", optimize=True)
    on_square(mark, 512, bg=WHITE, fill=0.62).convert("RGB").save(PUBLIC / "icon-512.png", optimize=True)

    teal_rgb, teal_hex = primary_hex()
    manifest = {
        "name": "Claudia Viviana Samudio",
        "short_name": "Claudia Samudio",
        "description": "Coach Ontológica. Salud, Bienestar y Nutrición Consciente.",
        "lang": "es",
        "start_url": "/",
        "display": "standalone",
        "theme_color": teal_hex,
        "background_color": "#ffffff",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        ],
    }
    (PUBLIC / "site.webmanifest").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    build_og(full, teal_rgb)


if __name__ == "__main__":
    main()
