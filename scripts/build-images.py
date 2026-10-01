#!/usr/bin/env python3
"""Build the logo variants, favicon set, web manifest and OG image.

Pillow-only and deterministic on hosts with the same fonts. Source: assets-src/logo-source.jpeg.
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

# Open Graph card layout (1200x630 is the size social networks expect)
OG_SIZE = (1200, 630)
OG_LOGO_WIDTH = 840
OG_TEXT_MAX_WIDTH = 1040
OG_TEXT_GAP = 48        # vertical space between logo and tagline
OG_FONT_SIZE = 34
OG_FONT_MIN_SIZE = 16
FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/ubuntu/UbuntuSans[wdth,wght].ttf",
)


def ink_strength(px):
    """Distance of a pixel from white (0-255): how much ink it carries."""
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
            s = ink_strength((r, g, b))
            if s < BG_THRESHOLD:
                dst[x, y] = (0, 0, 0, 0)
                continue
            fg = AMBER if r > b else TEAL
            fg_strength = ink_strength(fg)
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
    if True not in inked:
        raise ValueError("split_mark: image has no ink (fully transparent), cannot find the figure")
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
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise FileNotFoundError(
        "No TrueType font found for the OG image. Install one of: " + ", ".join(FONT_CANDIDATES)
    )


def build_og(logo_full, primary_rgb):
    width, height = OG_SIZE
    og = Image.new("RGB", OG_SIZE, OFF_WHITE)
    logo = logo_full.resize(
        (OG_LOGO_WIDTH, round(logo_full.height * OG_LOGO_WIDTH / logo_full.width)), Image.LANCZOS
    )
    text = "Coach Ontológica · Salud, Bienestar y Nutrición Consciente"
    size = OG_FONT_SIZE
    font = load_font(size)
    draw = ImageDraw.Draw(og)
    while draw.textlength(text, font=font) > OG_TEXT_MAX_WIDTH and size > OG_FONT_MIN_SIZE:
        size -= 1
        font = load_font(size)
    text_w = draw.textlength(text, font=font)
    block = logo.height + OG_TEXT_GAP + size
    top = (height - block) // 2
    og.paste(logo, ((width - logo.width) // 2, top), logo)
    draw.text(((width - text_w) / 2, top + logo.height + OG_TEXT_GAP), text, font=font, fill=primary_rgb)
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

    primary_rgb, primary_hex_value = primary_hex()
    manifest = {
        "name": "Claudia Viviana Samudio",
        "short_name": "Claudia Samudio",
        "description": "Coach Ontológica. Salud, Bienestar y Nutrición Consciente.",
        "lang": "es",
        "start_url": "/",
        "display": "standalone",
        "theme_color": primary_hex_value,
        "background_color": "#ffffff",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        ],
    }
    (PUBLIC / "site.webmanifest").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    build_og(full, primary_rgb)


if __name__ == "__main__":
    main()
