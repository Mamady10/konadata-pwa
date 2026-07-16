#!/usr/bin/env python3
"""Variante B — Pont caisson en béton précontraint (modèle type mémoire)."""

from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Polygon, Circle, FancyArrowPatch
import numpy as np
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from PIL import Image as PILImage

OUT = Path("/workspace/exports/conceptions-variantes")
OUT.mkdir(parents=True, exist_ok=True)

L_SPAN = 15.70
N_SPANS = 4
L_TOTAL = L_SPAN * N_SPANS
NPHE, NPBE, AFF = 4.00, 1.00, 5.00
H_CULEE = 5.00
W_CHAUSSEE, W_TROTTOIR = 6.00, 1.00
W_TOTAL = W_CHAUSSEE + 2 * W_TROTTOIR

NAVY = "#0A2540"
GREEN = "#2F6B4F"
CONCRETE = "#C9D1D8"
BOX = "#A8B4BE"
BOX_DARK = "#8E9AA5"
WATER = "#7EB8DA"
SOIL = "#8B6914"
ACCENT = "#C45C26"
STEEL = "#4A5568"
STEEL_FILL = "#6B7C8F"


def set_style(ax):
    ax.set_aspect("equal")
    ax.axis("off")


def ground_profile(x):
    mid = L_TOTAL / 2
    depth = 3.2 * np.exp(-((x - mid) / 14) ** 2)
    return -depth


def draw_terrain(ax):
    xs = np.linspace(-4, L_TOTAL + 4, 250)
    ys = np.array([ground_profile(x) for x in xs])
    ax.fill_between(xs, ys, -6.2, color=SOIL, alpha=0.55, zorder=1)
    ax.plot(xs, ys, color="#5C4033", lw=1.6, zorder=2)


def draw_water(ax):
    ax.axhline(NPBE, color="#3A8FBF", ls="--", lw=1.0, alpha=0.75, zorder=3)
    ax.axhline(NPHE, color="#1E5F8A", ls="--", lw=1.2, alpha=0.8, zorder=3)
    mid = L_TOTAL / 2
    ax.fill_between([mid - 10, mid + 10], [ground_profile(mid) - 0.3] * 2,
                     [NPBE, NPBE], color=WATER, alpha=0.45, zorder=2)
    ax.text(L_TOTAL + 0.8, NPHE + 0.12, f"NPHE = {NPHE:.2f} m",
            fontsize=8, color="#1E5F8A")
    ax.text(L_TOTAL + 0.8, NPBE + 0.12, f"NPBE = {NPBE:.2f} m",
            fontsize=8, color="#3A8FBF")
    ax.axhline(-AFF, color=ACCENT, ls=":", lw=1.2, zorder=3)
    ax.text(L_TOTAL + 0.8, -AFF + 0.2, f"Affouillement = {AFF:.2f} m",
            fontsize=8, color=ACCENT)


def dim_h(ax, x0, x1, y, label, color=GREEN, dy=0.3):
    ax.annotate("", xy=(x1, y), xytext=(x0, y),
                arrowprops=dict(arrowstyle="<->", color=color, lw=1.1))
    ax.text((x0 + x1) / 2, y + dy, label, ha="center", fontsize=8,
            color=color, fontweight="bold")


def dim_v(ax, x, y0, y1, label, color=GREEN, dx=0.35):
    ax.annotate("", xy=(x, y1), xytext=(x, y0),
                arrowprops=dict(arrowstyle="<->", color=color, lw=1.1))
    ax.text(x + dx, (y0 + y1) / 2, label, ha="left", va="center",
            fontsize=8, color=color, fontweight="bold", rotation=90)


def pier_positions():
    return 0.0, L_TOTAL, [L_SPAN * i for i in range(1, N_SPANS)]


def oval_pier(ax, cx, y0, y1, w=1.5, color=CONCRETE, edge=GREEN):
    """Pile massive à section ovale / oblongue (style photo mémoire)."""
    h = y1 - y0
    # Corps oblong
    ax.add_patch(FancyBboxPatch((cx - w / 2, y0), w, h,
                                boxstyle="round,pad=0,rounding_size=0.35",
                                facecolor=color, edgecolor=edge, lw=1.5, zorder=5))
    # Ombre légère côté
    ax.add_patch(FancyBboxPatch((cx + w / 2 - 0.18, y0), 0.18, h,
                                boxstyle="round,pad=0,rounding_size=0.1",
                                facecolor=BOX_DARK, edgecolor="none", alpha=0.35, zorder=6))


def fig_pc_longitudinal():
    fig, ax = plt.subplots(figsize=(16, 7.2), dpi=220)
    fig.patch.set_facecolor("#F4F7F5")
    ax.set_facecolor("#F4F7F5")
    set_style(ax)

    abut_l, abut_r, piers = pier_positions()
    # Caisson : hauteur variable légère (plus haute sur piles)
    h_mid = 1.35   # hauteur caisson en travée
    h_app = 1.70   # hauteur caisson sur appui
    deck_top = 7.0
    slab = 0.22

    draw_terrain(ax)
    draw_water(ax)

    # Culées massives
    for x, side in [(abut_l, "L"), (abut_r, "R")]:
        w = 1.5
        h = H_CULEE + 0.8
        fx = x - w if side == "L" else x
        ax.add_patch(FancyBboxPatch((fx, deck_top - h), w, h,
                                    boxstyle="square,pad=0", facecolor=CONCRETE,
                                    edgecolor=GREEN, lw=1.5, zorder=5))
        ax.add_patch(FancyBboxPatch((fx - 0.9 if side == "L" else fx - 0.7,
                                     deck_top - h - 1.1), w + 1.6, 1.1,
                                    boxstyle="square,pad=0", facecolor=BOX,
                                    edgecolor=GREEN, lw=1.2, zorder=4))
        ax.text(x + (-1.0 if side == "L" else 0.4), deck_top - h / 2,
                f"Culée\nH={H_CULEE:.0f} m", fontsize=7.5, color=GREEN,
                ha="center", fontweight="bold", zorder=7)

    # Piles ovales massives + semelles
    for i, px in enumerate(piers):
        g = ground_profile(px)
        depth = 2.4 if i == 1 else 1.7
        foot_y = g - depth
        ax.add_patch(FancyBboxPatch((px - 1.7, foot_y), 3.4, 1.0,
                                    boxstyle="square,pad=0", facecolor=BOX,
                                    edgecolor=GREEN, lw=1.2, zorder=4))
        pier_top = deck_top - h_app - 0.15
        oval_pier(ax, px, foot_y + 1.0, pier_top, w=1.55)
        # Chevêtre / tête de pile
        ax.add_patch(FancyBboxPatch((px - 1.8, pier_top), 3.6, 0.45,
                                    boxstyle="round,pad=0,rounding_size=0.08",
                                    facecolor=BOX_DARK, edgecolor=GREEN, lw=1.2, zorder=6))
        ax.text(px, foot_y - 0.35, "Semelle", fontsize=6.5, ha="center", color=GREEN)

    # --- Caisson précontraint : extrados droit, intrados légèrement variable ---
    # Extrados (dessus)
    xs = np.linspace(0, L_TOTAL, 400)
    # Hauteur caisson : max près des piles, min en milieu de travée
    def h_box(x):
        # distance relative à l'appui le plus proche
        supports = [0] + piers + [L_TOTAL]
        d = min(abs(x - s) for s in supports)
        # interpolate: d=0 -> h_app, d=L_SPAN/2 -> h_mid
        t = min(d / (L_SPAN / 2), 1.0)
        # smooth
        t = 0.5 - 0.5 * np.cos(np.pi * t)
        return h_app + (h_mid - h_app) * t

    top = np.full_like(xs, deck_top)
    bot = np.array([deck_top - h_box(x) for x in xs])

    # Corps du caisson (vue longitudinale = âme / face)
    verts = list(zip(xs, top)) + list(zip(xs[::-1], bot[::-1]))
    ax.add_patch(Polygon(verts, closed=True, facecolor=BOX, edgecolor=GREEN,
                         lw=1.6, zorder=8))
    # bande sombre bas du caisson (effet volume)
    bot2 = bot + 0.18
    verts2 = list(zip(xs, bot)) + list(zip(xs[::-1], bot2[::-1]))
    ax.add_patch(Polygon(verts2, closed=True, facecolor=BOX_DARK, edgecolor="none",
                         alpha=0.55, zorder=9))

    # Hourdis / chaussée
    ax.add_patch(Rectangle((-0.2, deck_top), L_TOTAL + 0.4, slab,
                           facecolor="#D6DDE4", edgecolor=GREEN, lw=1.4, zorder=10))

    # Câbles de précontrainte (paraboles / câbles de continuité)
    for i in range(N_SPANS):
        x0, x1 = i * L_SPAN, (i + 1) * L_SPAN
        xc = np.linspace(x0 + 0.4, x1 - 0.4, 50)
        # câble inférieur en travée
        mid = (x0 + x1) / 2
        y_c = np.array([deck_top - h_box(x) + 0.25 + 0.35 * ((x - mid) / (L_SPAN / 2)) ** 2
                        for x in xc])
        ax.plot(xc, y_c, color=ACCENT, lw=1.7, zorder=11)
    # câbles sur appuis (haute)
    for px in piers:
        ax.plot([px - 3.5, px, px + 3.5],
                [deck_top - 0.35, deck_top - 0.22, deck_top - 0.35],
                color=ACCENT, lw=1.7, zorder=11)
    ax.text(L_TOTAL * 0.62, deck_top - 0.55, "Câbles de précontrainte",
            fontsize=8, color=ACCENT, fontweight="bold", zorder=12)

    # Garde-corps
    for x in np.linspace(0, L_TOTAL, 28):
        ax.plot([x, x], [deck_top + slab, deck_top + slab + 0.95],
                color=GREEN, lw=0.7, zorder=12)
    ax.plot([0, L_TOTAL], [deck_top + slab + 0.95] * 2, color=GREEN, lw=1.2, zorder=12)

    # Dalles de transition
    ax.add_patch(Rectangle((-3.2, deck_top), 3.0, slab * 0.9,
                           facecolor="#C8D0D8", edgecolor=GREEN, lw=1.0, zorder=9))
    ax.add_patch(Rectangle((L_TOTAL + 0.2, deck_top), 3.0, slab * 0.9,
                           facecolor="#C8D0D8", edgecolor=GREEN, lw=1.0, zorder=9))

    # Annotations
    ax.text(L_TOTAL / 2, deck_top + 0.05, "Tablier caisson en béton précontraint",
            fontsize=9, ha="center", color=NAVY, fontweight="bold", zorder=13)
    ax.text(L_SPAN * 0.5, deck_top - h_mid / 2 - 0.15,
            "Caisson\n(h variable)", fontsize=8, ha="center", va="center",
            color=GREEN, fontweight="bold", zorder=13)

    for i in range(N_SPANS):
        dim_h(ax, i * L_SPAN, (i + 1) * L_SPAN, deck_top + slab + 1.55,
              f"{L_SPAN:.2f} m")
    dim_h(ax, 0, L_TOTAL, deck_top + slab + 2.3,
          f"L totale = {L_TOTAL:.2f} m", color=ACCENT)

    ax.set_xlim(-6, L_TOTAL + 7.5)
    ax.set_ylim(-6.8, deck_top + slab + 3.1)
    ax.set_title("VARIANTE B — Pont caisson en béton précontraint\n"
                 "Profil longitudinal  |  Portée 4 × 15,70 m = 62,80 m  |  Modèle type caisson",
                 fontsize=13, fontweight="bold", color=GREEN, pad=12)
    ax.text(0.01, 0.015,
            "Mémoire d'ingénieurs | Ponts et chaussées | Mamady KABA & T.I.H. Diallo | Enc. F.B. Keita",
            transform=ax.transAxes, fontsize=7.5, color="#555")
    fig.tight_layout()
    path = OUT / "05_precontraint_profil_longitudinal.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_pc_plan():
    fig, ax = plt.subplots(figsize=(16, 5.6), dpi=220)
    fig.patch.set_facecolor("#F4F7F5")
    ax.set_facecolor("#F4F7F5")
    set_style(ax)

    W = W_TOTAL
    # Tablier
    ax.add_patch(FancyBboxPatch((0, 0), L_TOTAL, W, boxstyle="square,pad=0",
                                facecolor="#D5E0D8", edgecolor=GREEN, lw=1.6, zorder=3))
    ax.add_patch(Rectangle((0, W_TROTTOIR), L_TOTAL, W_CHAUSSEE,
                           facecolor="#6E7680", edgecolor="none", zorder=4, alpha=0.5))
    for x in np.arange(1, L_TOTAL, 2.0):
        ax.plot([x, x + 1], [W / 2, W / 2], color="white", lw=1.4, zorder=5, ls="--")

    # Emprise caisson (plus étroite en fond) — lignes d'âme
    box_bot = 3.2  # largeur de la semelle inférieure du caisson
    y_l = (W - box_bot) / 2
    y_r = y_l + box_bot
    ax.plot([0.5, L_TOTAL - 0.5], [y_l, y_l], color=GREEN, lw=1.6, ls="-", zorder=6)
    ax.plot([0.5, L_TOTAL - 0.5], [y_r, y_r], color=GREEN, lw=1.6, ls="-", zorder=6)
    ax.text(L_TOTAL / 2, W / 2 - 1.35, "Emprise caisson (semelle inférieure)",
            fontsize=8, ha="center", color=GREEN, fontweight="bold", zorder=7)

    # Piles ovales
    _, _, piers = pier_positions()
    ax.add_patch(Rectangle((-0.9, -1.3), 1.8, W + 2.6,
                           facecolor=CONCRETE, edgecolor=GREEN, lw=1.2, zorder=2))
    ax.add_patch(Rectangle((L_TOTAL - 0.9, -1.3), 1.8, W + 2.6,
                           facecolor=CONCRETE, edgecolor=GREEN, lw=1.2, zorder=2))
    for px in piers:
        ax.add_patch(FancyBboxPatch((px - 0.85, W / 2 - 1.4), 1.7, 2.8,
                                    boxstyle="round,pad=0,rounding_size=0.7",
                                    facecolor=CONCRETE, edgecolor=GREEN, lw=1.3, zorder=7))
        ax.text(px, W + 1.05, "Pile ovale", fontsize=8, ha="center",
                color=GREEN, fontweight="bold")

    ax.text(L_TOTAL / 2, W_TROTTOIR / 2, "Trottoir 1,00 m", fontsize=8, ha="center", color=GREEN)
    ax.text(L_TOTAL / 2, W - W_TROTTOIR / 2, "Trottoir 1,00 m", fontsize=8, ha="center", color=GREEN)
    ax.text(L_TOTAL / 2, W / 2 + 0.95, "Chaussée 6,00 m (2 voies)", fontsize=9,
            ha="center", color="white", fontweight="bold", zorder=8)

    dim_h(ax, 0, L_TOTAL, W + 2.1, f"{L_TOTAL:.2f} m")
    for i in range(N_SPANS):
        dim_h(ax, i * L_SPAN, (i + 1) * L_SPAN, -1.9, f"{L_SPAN:.2f} m")
    dim_v(ax, L_TOTAL + 3.0, 0, W, f"{W:.2f} m")

    ax.set_xlim(-4.5, L_TOTAL + 5)
    ax.set_ylim(-3.3, W + 3.1)
    ax.set_title("VARIANTE B — Vue en plan  |  Caisson précontraint  |  Largeur utile 8,00 m",
                 fontsize=13, fontweight="bold", color=GREEN, pad=10)
    fig.tight_layout()
    path = OUT / "06_precontraint_vue_en_plan.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_pc_coupe():
    """Coupe transversale caisson trapézoïdal (comme photo mémoire)."""
    fig, ax = plt.subplots(figsize=(12, 8), dpi=220)
    fig.patch.set_facecolor("#F4F7F5")
    ax.set_facecolor("#F4F7F5")
    set_style(ax)

    half = W_TOTAL / 2  # 4.0
    # Dimensions caisson
    top_w = W_TOTAL + 0.3          # hourdis débordant
    bottom_w = 3.40                # fond de caisson
    h_box = 1.55
    web_outer = 0.30
    bottom_t = 0.22
    top_t = 0.25

    # Hourdis / dalle supérieure
    ax.add_patch(Rectangle((-half - 0.15, 0), W_TOTAL + 0.3, top_t,
                           facecolor="#D6DDE4", edgecolor=GREEN, lw=1.5, zorder=6))
    # Trottoirs surélevés
    for sgn in [-1, 1]:
        x0 = -half if sgn < 0 else half - W_TROTTOIR
        ax.add_patch(Rectangle((x0, top_t), W_TROTTOIR, 0.12,
                               facecolor="#C5CED6", edgecolor=GREEN, lw=1.0, zorder=7))

    # Forme trapézoïdale extérieure du caisson
    bt = bottom_w / 2
    # Extrados sous dalle = 0, intrados = -h_box
    # Âmes inclinées
    outer = [
        (-half - 0.05, 0),
        (half + 0.05, 0),
        (bt, -h_box),
        (-bt, -h_box),
    ]
    ax.add_patch(Polygon(outer, closed=True, facecolor=BOX, edgecolor=GREEN,
                         lw=1.8, zorder=4))

    # Vide intérieur du caisson (trapeze intérieur)
    inset = 0.28
    bt_i = bt - inset
    inner = [
        (-half + 0.55, -top_t - 0.02),
        (half - 0.55, -top_t - 0.02),
        (bt_i, -h_box + bottom_t),
        (-bt_i, -h_box + bottom_t),
    ]
    ax.add_patch(Polygon(inner, closed=True, facecolor="#F4F7F5", edgecolor=GREEN,
                         lw=1.3, zorder=5))

    # Âmes marquées
    ax.text(0, -h_box / 2 - 0.05, "Vide du caisson", fontsize=9, ha="center",
            color=GREEN, fontweight="bold", zorder=8)
    ax.text(-half + 0.35, -h_box / 2, "Âme", fontsize=8, ha="center",
            color=GREEN, rotation=70, fontweight="bold", zorder=8)
    ax.text(half - 0.35, -h_box / 2, "Âme", fontsize=8, ha="center",
            color=GREEN, rotation=-70, fontweight="bold", zorder=8)

    # Câbles de précontrainte dans semelle inférieure et âmes
    for x in np.linspace(-bt + 0.25, bt - 0.25, 7):
        ax.add_patch(Circle((x, -h_box + 0.12), 0.045, facecolor=ACCENT,
                            edgecolor="#8B3010", lw=0.6, zorder=9))
    # câbles hauts (continuité)
    for x in np.linspace(-2.2, 2.2, 5):
        ax.add_patch(Circle((x, -0.12), 0.04, facecolor=ACCENT,
                            edgecolor="#8B3010", lw=0.6, zorder=9))

    # Garde-corps
    for sgn in [-1, 1]:
        x = sgn * half
        ax.plot([x, x], [top_t + 0.12, top_t + 1.15], color=GREEN, lw=1.6, zorder=10)
        ax.plot([x - 0.12 * sgn, x], [top_t + 1.15] * 2, color=GREEN, lw=1.4, zorder=10)

    # Cotes
    dim_h(ax, -half, half, top_t + 1.55, f"Largeur totale = {W_TOTAL:.2f} m")
    dim_h(ax, -W_CHAUSSEE / 2, W_CHAUSSEE / 2, -h_box - 0.55,
          f"Chaussée = {W_CHAUSSEE:.2f} m")
    dim_h(ax, -bt, bt, -h_box - 1.05, f"Fond caisson ≈ {bottom_w:.2f} m", color=ACCENT)
    dim_v(ax, half + 1.0, -h_box, 0, f"h caisson ≈ {h_box:.2f} m")
    dim_v(ax, half + 1.85, 0, top_t, f"e hourdis = {int(top_t*100)} cm")

    ax.add_patch(FancyBboxPatch((-half - 0.2, -h_box - 2.35), W_TOTAL + 0.4, 1.05,
                                boxstyle="round,pad=0.05", facecolor="white",
                                edgecolor=GREEN, lw=1.0, zorder=3))
    ax.text(0, -h_box - 1.65,
            "Caisson trapézoïdal précontraint  •  Câbles (cercles)  •  Âmes inclinées  •  Vide intérieur",
            fontsize=9, ha="center", color=GREEN, fontweight="bold")
    ax.text(0, -h_box - 2.05,
            "Modèle conforme au type d'ouvrage du mémoire (pont caisson béton précontraint)",
            fontsize=8, ha="center", color="#444")

    ax.set_xlim(-half - 2.6, half + 3.3)
    ax.set_ylim(-h_box - 2.7, top_t + 2.0)
    ax.set_title("VARIANTE B — Coupe transversale du caisson précontraint\n"
                 "(section trapézoïdale type béton précontraint)",
                 fontsize=12, fontweight="bold", color=GREEN, pad=10)
    fig.tight_layout()
    path = OUT / "07_precontraint_coupe_transversale.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_pc_detail():
    fig, ax = plt.subplots(figsize=(11, 7.2), dpi=220)
    fig.patch.set_facecolor("#F4F7F5")
    ax.set_facecolor("#F4F7F5")
    set_style(ax)

    # Demi-coupe détaillée du caisson + appui sur pile
    half_top = 3.2
    bt = 1.7
    h = 1.7

    # Caisson (moitié droite stylisée, centrée)
    outer = [(-2.8, 0), (2.8, 0), (1.5, -h), (-1.5, -h)]
    ax.add_patch(Polygon(outer, closed=True, facecolor=BOX, edgecolor=GREEN, lw=1.8, zorder=4))
    inner = [(-2.1, -0.28), (2.1, -0.28), (1.15, -h + 0.28), (-1.15, -h + 0.28)]
    ax.add_patch(Polygon(inner, closed=True, facecolor="#F4F7F5", edgecolor=GREEN, lw=1.3, zorder=5))

    # Hourdis
    ax.add_patch(Rectangle((-3.0, 0), 6.0, 0.28, facecolor="#D6DDE4", edgecolor=GREEN, lw=1.4, zorder=6))
    ax.text(0, 0.45, "Hourdis supérieur du caisson", fontsize=10, ha="center",
            color=NAVY, fontweight="bold")

    # Câbles
    for x in np.linspace(-1.2, 1.2, 6):
        ax.add_patch(Circle((x, -h + 0.14), 0.06, facecolor=ACCENT, edgecolor="#8B3010", zorder=7))
    for x in [-1.5, -0.5, 0.5, 1.5]:
        ax.add_patch(Circle((x, -0.14), 0.05, facecolor=ACCENT, edgecolor="#8B3010", zorder=7))

    ax.annotate("Torons de précontrainte\n(semelle inférieure)",
                xy=(0.8, -h + 0.14), xytext=(2.6, -0.6),
                fontsize=9, color=ACCENT, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=ACCENT, lw=1.3))
    ax.annotate("Âme inclinée", xy=(2.0, -h / 2), xytext=(3.0, -1.2),
                fontsize=9, color=GREEN,
                arrowprops=dict(arrowstyle="->", color=GREEN))
    ax.text(0, -h / 2 - 0.05, "Vide", fontsize=10, ha="center", color=GREEN, fontweight="bold")

    # Appui + tête de pile ovale
    ax.add_patch(Rectangle((-0.55, -h - 0.35), 1.1, 0.28, facecolor="#333", edgecolor="#111", lw=1.0, zorder=8))
    ax.text(0, -h - 0.21, "Appui", fontsize=8, ha="center", va="center", color="white", fontweight="bold", zorder=9)
    ax.add_patch(FancyBboxPatch((-1.5, -h - 1.7), 3.0, 1.25,
                                boxstyle="round,pad=0,rounding_size=0.45",
                                facecolor=CONCRETE, edgecolor=GREEN, lw=1.5, zorder=7))
    ax.text(0, -h - 1.05, "Tête de pile\n(section ovale)", fontsize=9, ha="center",
            color=GREEN, fontweight="bold", zorder=9)

    ax.set_xlim(-3.6, 4.6)
    ax.set_ylim(-h - 2.1, 1.0)
    ax.set_title("VARIANTE B — Détail du caisson précontraint\n"
                 "et appui sur pile (modèle type mémoire)",
                 fontsize=12, fontweight="bold", color=GREEN, pad=10)
    fig.tight_layout()
    path = OUT / "08_precontraint_detail_poutre.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_comparatif():
    fig, axes = plt.subplots(1, 2, figsize=(16, 7.2), dpi=220)
    fig.patch.set_facecolor("#FAFAF7")

    # A mixte
    ax = axes[0]
    ax.set_facecolor("#FAFAF7")
    set_style(ax)
    half = 4.0
    ax.add_patch(Rectangle((-half, 0), 8, 0.22, facecolor="#D6DDE4", edgecolor=NAVY, lw=1.4))
    for xc in np.linspace(-3, 3, 5):
        ax.add_patch(Rectangle((xc - 0.18, -0.05), 0.36, 0.05, facecolor=STEEL, zorder=5))
        ax.add_patch(Rectangle((xc - 0.015, -0.85), 0.03, 0.80, facecolor=STEEL_FILL, zorder=5))
        ax.add_patch(Rectangle((xc - 0.18, -0.90), 0.36, 0.05, facecolor=STEEL, zorder=5))
    points = [
        "• Dalle BA + poutres acier I",
        "• Connexion par goujons",
        "• Tablier léger",
        "• Montage métallique rapide",
        f"• L = {L_TOTAL:.2f} m (4×{L_SPAN:.2f})",
    ]
    ax.set_title("A — Tablier mixte", fontsize=12, fontweight="bold", color=NAVY, pad=8)
    ax.text(0, -1.35, "\n".join(points), fontsize=8.5, ha="center", va="top", color="#333",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor=NAVY, lw=1.0))
    ax.set_xlim(-5, 5)
    ax.set_ylim(-3.6, 0.8)

    # B caisson
    ax = axes[1]
    ax.set_facecolor("#FAFAF7")
    set_style(ax)
    outer = [(-4.0, 0), (4.0, 0), (1.7, -1.55), (-1.7, -1.55)]
    ax.add_patch(Polygon(outer, closed=True, facecolor=BOX, edgecolor=GREEN, lw=1.6))
    inner = [(-3.1, -0.25), (3.1, -0.25), (1.3, -1.30), (-1.3, -1.30)]
    ax.add_patch(Polygon(inner, closed=True, facecolor="#FAFAF7", edgecolor=GREEN, lw=1.2))
    ax.add_patch(Rectangle((-4.0, 0), 8, 0.20, facecolor="#D6DDE4", edgecolor=GREEN, lw=1.2))
    for x in np.linspace(-1.3, 1.3, 5):
        ax.add_patch(Circle((x, -1.42), 0.05, facecolor=ACCENT, zorder=6))
    points = [
        "• Caisson trapézoïdal précontraint",
        "• Torons dans semelle / âmes",
        "• Piles ovales massives",
        "• Grande rigidité & durabilité",
        f"• L = {L_TOTAL:.2f} m (4×{L_SPAN:.2f})",
    ]
    ax.set_title("B — Caisson béton précontraint", fontsize=12, fontweight="bold", color=GREEN, pad=8)
    ax.text(0, -1.95, "\n".join(points), fontsize=8.5, ha="center", va="top", color="#333",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor=GREEN, lw=1.0))
    ax.set_xlim(-5, 5)
    ax.set_ylim(-4.2, 0.8)

    fig.suptitle("COMPARAISON ARCHITECTURALE DES DEUX VARIANTES\n"
                 f"Pont — Portée totale {L_TOTAL:.2f} m  |  Largeur {W_TOTAL:.2f} m",
                 fontsize=14, fontweight="bold", color=NAVY, y=0.98)
    fig.tight_layout(rect=[0, 0, 1, 0.92])
    path = OUT / "09_comparatif_variantes.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def refresh_pptx_pdf():
    paths = [
        OUT / "01_mixte_profil_longitudinal.png",
        OUT / "02_mixte_vue_en_plan.png",
        OUT / "03_mixte_coupe_transversale.png",
        OUT / "04_mixte_detail_connexion.png",
        OUT / "05_precontraint_profil_longitudinal.png",
        OUT / "06_precontraint_vue_en_plan.png",
        OUT / "07_precontraint_coupe_transversale.png",
        OUT / "08_precontraint_detail_poutre.png",
        OUT / "09_comparatif_variantes.png",
        OUT / "10_mixte_perspective_architecturale.png",
        OUT / "11_precontraint_perspective_architecturale.png",
    ]
    images = [PILImage.open(p).convert("RGB") for p in paths if p.exists()]
    pdf = Path("/workspace/exports/Conceptions_Architecturales_Variantes_Pont.pdf")
    images[0].save(pdf, save_all=True, append_images=images[1:], resolution=220)

    # Rebuild simple PPTX with all plates
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    NAVY_C = RGBColor(10, 37, 64)
    GREEN_C = RGBColor(47, 107, 79)
    WHITE = RGBColor(255, 255, 255)
    ACC = RGBColor(196, 92, 38)

    def slide(title, img, color):
        s = prs.slides.add_slide(prs.slide_layouts[6])
        bar = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(0), Inches(0),
                                 prs.slide_width, Inches(0.75))
        bar.fill.solid(); bar.fill.fore_color.rgb = color; bar.line.fill.background()
        tf = s.shapes.add_textbox(Inches(0.4), Inches(0.15), Inches(12.5), Inches(0.5)).text_frame
        p = tf.paragraphs[0]; p.text = title; p.font.size = Pt(18); p.font.bold = True; p.font.color.rgb = WHITE
        s.shapes.add_picture(str(img), Inches(0.35), Inches(0.95), width=Inches(12.6))

    titles = [
        ("VARIANTE A — Profil longitudinal (tablier mixte)", paths[0], NAVY_C),
        ("VARIANTE A — Vue en plan", paths[1], NAVY_C),
        ("VARIANTE A — Coupe transversale", paths[2], NAVY_C),
        ("VARIANTE A — Détail connexion mixte", paths[3], NAVY_C),
        ("VARIANTE B — Profil longitudinal (caisson précontraint)", paths[4], GREEN_C),
        ("VARIANTE B — Vue en plan (caisson)", paths[5], GREEN_C),
        ("VARIANTE B — Coupe transversale caisson trapézoïdal", paths[6], GREEN_C),
        ("VARIANTE B — Détail caisson / pile ovale", paths[7], GREEN_C),
        ("COMPARAISON DES DEUX VARIANTES", paths[8], ACC),
        ("VARIANTE A — Perspective architecturale", paths[9], NAVY_C),
        ("VARIANTE B — Perspective architecturale (caisson)", paths[10], GREEN_C),
    ]
    for t, pth, c in titles:
        if pth.exists():
            slide(t, pth, c)

    pptx = Path("/workspace/exports/Conceptions_Architecturales_Variantes_Pont.pptx")
    prs.save(pptx)
    return pptx, pdf


if __name__ == "__main__":
    print("Caisson précontraint...")
    print(fig_pc_longitudinal())
    print(fig_pc_plan())
    print(fig_pc_coupe())
    print(fig_pc_detail())
    print(fig_comparatif())
    print(refresh_pptx_pdf())
