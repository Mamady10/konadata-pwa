#!/usr/bin/env python3
"""Compose PREMCO project posters from site photos (template adaptation)."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math

ASSETS = Path("/opt/cursor/artifacts/assets")
OUT = Path("/workspace/exports/premco")
ART = Path("/opt/cursor/artifacts/premco")
OUT.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GOLD = (212, 160, 58)
ORANGE = (230, 126, 34)
DARK = (18, 18, 18)
CARD = (22, 22, 22, 210)


def font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf" if bold else "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def load(name, size=None):
    im = Image.open(ASSETS / name).convert("RGBA")
    if size:
        im = im.resize(size, Image.Resampling.LANCZOS)
    return im


def cover_crop(im, w, h):
    im = im.convert("RGB")
    iw, ih = im.size
    scale = max(w / iw, h / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return im.crop((left, top, left + w, top + h))


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_icon_pin(draw, x, y, s=28, color=ORANGE):
    # simple location pin
    draw.ellipse((x, y, x + s, y + s * 0.75), fill=color)
    draw.polygon([(x + s * 0.15, y + s * 0.55), (x + s / 2, y + s * 1.15), (x + s * 0.85, y + s * 0.55)], fill=color)
    draw.ellipse((x + s * 0.32, y + s * 0.18, x + s * 0.68, y + s * 0.5), fill=BLACK)


def draw_icon_helmet(draw, x, y, s=28, color=ORANGE):
    draw.ellipse((x, y + s * 0.15, x + s, y + s * 0.75), fill=color)
    draw.rectangle((x + s * 0.1, y + s * 0.55, x + s * 0.9, y + s * 0.72), fill=color)
    draw.ellipse((x + s * 0.2, y, x + s * 0.8, y + s * 0.45), fill=color)


def draw_icon_award(draw, x, y, s=36, color=ORANGE):
    draw.ellipse((x + 4, y, x + s - 4, y + s - 10), outline=color, width=3)
    draw.polygon([(x + s / 2, y + s - 12), (x + 8, y + s), (x + s / 2, y + s - 22), (x + s - 8, y + s)], fill=color)


def draw_icon_gear(draw, x, y, s=36, color=ORANGE):
    draw.ellipse((x + 6, y + 6, x + s - 6, y + s - 6), outline=color, width=3)
    draw.ellipse((x + 14, y + 14, x + s - 14, y + s - 14), fill=color)


def make_logo_badge(w=320, h=120):
    """Compact logo badge from generated logo, cropped/resized."""
    logo = Image.open(ASSETS / "premco_logo_clean.png").convert("RGBA")
    # crop center logo area
    lw, lh = logo.size
    # keep full and fit
    logo = logo.resize((w, int(w * lh / lw)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = max(0, (h - logo.height) // 2)
    canvas.paste(logo, (0, y), logo)
    return canvas


def poster_single():
    """Model 1: single hero photo + left info card."""
    W, H = 1600, 2000
    canvas = Image.new("RGB", (W, H), BLACK)
    draw = ImageDraw.Draw(canvas)

    # Header
    logo = make_logo_badge(360, 130)
    canvas.paste(logo, (40, 30), logo)

    title1 = "PROJET DE CONSTRUCTION D'UN"
    title2 = "ÉTABLISSEMENT PRIVÉ"
    draw.text((W // 2, 55), title1, font=font(34, True), fill=WHITE, anchor="ma")
    draw.text((W // 2, 100), title2, font=font(42, True), fill=GOLD, anchor="ma")

    # gold banner
    banner_y = 155
    draw.polygon([(380, banner_y), (1220, banner_y), (1185, banner_y + 48), (415, banner_y + 48)], fill=GOLD)
    draw.text((W // 2, banner_y + 24), "SUIVI & PILOTAGE DES TRAVAUX PAR PREMCO",
              font=font(22, True), fill=BLACK, anchor="mm")

    # Hero photo
    photo = cover_crop(Image.open(ASSETS / "chantier_ferraillage_source.jpg"), 1520, 1180)
    canvas.paste(photo, (40, 230))

    # Left info card overlay
    card = Image.new("RGBA", (520, 420), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    rounded_rect(cd, (0, 0, 519, 419), 28, (15, 15, 15, 215), outline=GOLD, width=2)
    cd.text((40, 35), "LOCALISATION", font=font(18, True), fill=GOLD)
    cd.text((40, 70), "Guinée, Conakry", font=font(28, True), fill=WHITE)
    cd.text((40, 140), "DATE", font=font(18, True), fill=GOLD)
    cd.text((40, 175), "26 Juillet 2026", font=font(28, True), fill=WHITE)
    cd.text((40, 245), "PHASE DES TRAVAUX", font=font(18, True), fill=GOLD)
    cd.text((40, 280), "Fondations / Ferraillage", font=font(26, True), fill=WHITE)
    cd.text((40, 340), "AVANCEMENT", font=font(18, True), fill=GOLD)
    cd.text((40, 375), "10%", font=font(34, True), fill=GOLD)
    canvas.paste(card, (70, 280), card)

    # Footer block
    fy = 1450
    draw.rectangle((0, fy, W, H), fill=BLACK)
    logo2 = make_logo_badge(420, 150)
    canvas.paste(logo2, (40, fy + 40), logo2)

    draw.text((500, fy + 50), "PREMCO CONSTRUCTION & RENOVATION", font=font(26, True), fill=GOLD)
    draw.text((500, fy + 95), "Études techniques  •  Bâtiment  •  Génie civil", font=font(18), fill=WHITE)
    draw.text((500, fy + 125), "Management de projet  •  Suivi & Contrôle", font=font(18), fill=WHITE)

    draw.text((500, fy + 175), "CONTACTEZ-NOUS", font=font(18, True), fill=GOLD)
    draw.text((500, fy + 210), "627 71 77 85 / 628 36 04 35 / 625 63 26 26", font=font(18), fill=WHITE)
    draw.text((500, fy + 240), "premcoservice@gmail.com  •  Guinée, Conakry", font=font(17), fill=WHITE)

    # Values circles
    for i, (label, iconer) in enumerate([
        ("QUALITÉ", draw_icon_award),
        ("SÉCURITÉ", draw_icon_helmet),
        ("ENGAGEMENT", draw_icon_gear),
    ]):
        cx = 1280 + i * 95
        cy = fy + 120
        draw.ellipse((cx - 34, cy - 34, cx + 34, cy + 34), outline=GOLD, width=3)
        iconer(draw, cx - 16, cy - 16, 32, GOLD)
        draw.text((cx, cy + 50), label, font=font(12, True), fill=WHITE, anchor="ma")

    # Bottom slogan bar
    draw.rectangle((0, H - 70, W, H), fill=GOLD)
    draw.text((W // 2, H - 35),
              "PREMCO, VOTRE PARTENAIRE DE CONFIANCE POUR DES OUVRAGES DURABLES ET DE QUALITÉ",
              font=font(16, True), fill=BLACK, anchor="mm")

    path = OUT / "PREMCO_Affiche_Suivi_Chantier_01.jpg"
    canvas.convert("RGB").save(path, quality=92, optimize=True)
    return path


def poster_collage():
    """Model 2: header + 5-photo grid + footer."""
    W, H = 1800, 2200
    canvas = Image.new("RGB", (W, H), BLACK)
    draw = ImageDraw.Draw(canvas)

    # Header left logo
    logo = make_logo_badge(380, 140)
    canvas.paste(logo, (30, 25), logo)

    # Title center
    draw.text((W // 2 + 40, 45), "PROJET DE CONSTRUCTION D'UN", font=font(30, True), fill=WHITE, anchor="ma")
    draw.text((W // 2 + 40, 90), "ÉTABLISSEMENT PRIVÉ", font=font(40, True), fill=ORANGE, anchor="ma")
    # ribbon
    draw.polygon([(520, 140), (1280, 140), (1250, 185), (550, 185)], fill=WHITE)
    draw.text((W // 2 + 40, 162), "SUIVI & PILOTAGE DES TRAVAUX PAR PREMCO",
              font=font(18, True), fill=BLACK, anchor="mm")

    # Right meta
    draw_icon_pin(draw, 1480, 40, 34, ORANGE)
    draw.text((1530, 40), "LOCALISATION", font=font(14, True), fill=ORANGE)
    draw.text((1530, 65), "Guinée, Conakry", font=font(18, True), fill=WHITE)
    draw_icon_helmet(draw, 1480, 110, 34, ORANGE)
    draw.text((1530, 110), "PHASE DES TRAVAUX", font=font(14, True), fill=ORANGE)
    draw.text((1530, 135), "Fondations", font=font(18, True), fill=WHITE)

    # Photo grid: top 3, bottom 2 (as model)
    photos = [
        ASSETS / "chantier_mesure_source.jpg",
        ASSETS / "chantier_equipe_source.jpg",
        ASSETS / "chantier_ferraillage_source.jpg",
        ASSETS / "chantier_terrassement_source.jpg",
        ASSETS / "chantier_ferraillage_source.jpg",
    ]
    # Generate a 5th variant crop from ferraillage if needed - use terrassement + equipe differently
    gap = 16
    top_y = 220
    top_h = 520
    cell_w = (W - 60 - 2 * gap) // 3
    for i, p in enumerate(photos[:3]):
        x = 30 + i * (cell_w + gap)
        im = cover_crop(Image.open(p), cell_w, top_h)
        canvas.paste(im, (x, top_y))

    bot_y = top_y + top_h + gap
    bot_h = 480
    cell_w2 = (W - 60 - gap) // 2
    for i, p in enumerate([photos[3], ASSETS / "chantier_manutention_source.jpg"]):
        x = 30 + i * (cell_w2 + gap)
        im = cover_crop(Image.open(p), cell_w2, bot_h)
        canvas.paste(im, (x, bot_y))

    # Footer
    fy = bot_y + bot_h + 30
    logo2 = make_logo_badge(400, 145)
    canvas.paste(logo2, (30, fy), logo2)

    draw.text((460, fy + 20), "Études techniques  •  Bâtiment  •  Génie civil", font=font(18), fill=WHITE)
    draw.text((460, fy + 55), "Management de projet  •  Suivi & Contrôle", font=font(18), fill=WHITE)

    draw.text((460, fy + 110), "CONTACTEZ-NOUS", font=font(18, True), fill=ORANGE)
    draw.text((460, fy + 145), "627 71 77 85 / 628 36 04 35 / 625 63 26 26", font=font(17), fill=WHITE)
    draw.text((460, fy + 175), "premcoservice@gmail.com", font=font(17), fill=WHITE)
    draw.text((460, fy + 205), "Guinée, Conakry", font=font(17), fill=WHITE)

    # right values
    for i, (lab, iconer) in enumerate([
        ("QUALITÉ", draw_icon_award),
        ("SÉCURITÉ", draw_icon_helmet),
        ("ENGAGEMENT", draw_icon_gear),
    ]):
        cx = 1350 + i * 130
        cy = fy + 100
        draw.ellipse((cx - 40, cy - 40, cx + 40, cy + 40), outline=ORANGE, width=3)
        iconer(draw, cx - 18, cy - 18, 36, ORANGE)
        draw.text((cx, cy + 55), lab, font=font(14, True), fill=WHITE, anchor="ma")

    # slogan bar
    draw.rectangle((0, H - 60, W, H), fill=ORANGE)
    draw.text((W // 2, H - 30),
              "PREMCO, VOTRE PARTENAIRE DE CONFIANCE POUR DES OUVRAGES DURABLES ET DE QUALITÉ",
              font=font(17, True), fill=BLACK, anchor="mm")

    path = OUT / "PREMCO_Affiche_Collage_Chantier_02.jpg"
    canvas.convert("RGB").save(path, quality=92, optimize=True)
    return path


def poster_story_vertical():
    """Story/IG friendly vertical from the sent rebar image style."""
    W, H = 1080, 1920
    canvas = Image.new("RGB", (W, H), BLACK)
    draw = ImageDraw.Draw(canvas)

    logo = make_logo_badge(300, 110)
    canvas.paste(logo, (30, 25), logo)
    draw.text((W - 30, 45), "SUIVI CHANTIER", font=font(22, True), fill=GOLD, anchor="ra")
    draw.text((W - 30, 80), "Fondations • 10%", font=font(18), fill=WHITE, anchor="ra")

    photo = cover_crop(Image.open(ASSETS / "chantier_ferraillage_source.jpg"), W - 60, 1200)
    canvas.paste(photo, (30, 150))

    draw.text((40, 1400), "PROJET", font=font(18, True), fill=GOLD)
    draw.text((40, 1440), "Construction d'un\nétablissement privé", font=font(36, True), fill=WHITE)
    draw.text((40, 1560), "Localisation : Guinée, Conakry", font=font(20), fill=WHITE)
    draw.text((40, 1600), "Phase : Fondations / Ferraillage", font=font(20), fill=WHITE)

    draw.text((40, 1680), "627 71 77 85 / 628 36 04 35", font=font(18), fill=GOLD)
    draw.text((40, 1715), "premcoservice@gmail.com", font=font(18), fill=WHITE)

    draw.rectangle((0, H - 70, W, H), fill=GOLD)
    draw.text((W // 2, H - 35), "PREMCO — OUVRAGES DURABLES ET DE QUALITÉ",
              font=font(18, True), fill=BLACK, anchor="mm")

    path = OUT / "PREMCO_Story_Ferraillage_03.jpg"
    canvas.convert("RGB").save(path, quality=92, optimize=True)
    return path


def main():
    p1 = poster_single()
    print(p1)
    p2 = poster_collage()
    print(p2)
    p3 = poster_story_vertical()
    print(p3)
    for p in [p1, p2, p3]:
        (ART / p.name).write_bytes(p.read_bytes())
        # also light copy for chat
        im = Image.open(p).convert("RGB")
        im.thumbnail((1200, 1600))
        light = ART / f"CHAT_{p.name}"
        im.save(light, quality=85, optimize=True)
        print(light, light.stat().st_size)


if __name__ == "__main__":
    main()
