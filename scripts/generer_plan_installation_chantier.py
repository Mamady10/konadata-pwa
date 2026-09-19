#!/usr/bin/env python3
"""Plan d'installation de chantier — Pont Kiridi (Kipé–Nongo, Conakry)."""

from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import (
    FancyBboxPatch, Rectangle, Polygon, Circle, FancyArrowPatch, Arc, Wedge
)
from matplotlib.lines import Line2D
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN
from PIL import Image as PILImage

OUT = Path("/workspace/exports/plan-installation-chantier")
OUT.mkdir(parents=True, exist_ok=True)
ART = Path("/opt/cursor/artifacts/plan-installation-chantier")
ART.mkdir(parents=True, exist_ok=True)

# --- Géométrie projet ---
L_BRIDGE = 62.80
W_DECK = 8.00
LAT, LON = 9.61156, -13.63647  # ~ 9°36'41.6"N , 13°38'11.3"O

# Palette
NAVY = "#0A2540"
ORANGE = "#C45C26"
GREEN = "#2F6B4F"
WATER = "#6BA8C9"
ROAD = "#5A6169"
BUILD = "#C4B6A6"
BUILD_EDGE = "#7A6A58"
FENCE = "#B03A2E"
BG = "#F7F4EF"
ZONE_BV = "#F5D76E"
ZONE_STOCK = "#AED6F1"
ZONE_PREF = "#ABEBC6"
ZONE_TRAV = "#F5B7B1"
ZONE_ENG = "#D7BDE2"
ZONE_DEV = "#F9E79F"
SOIL = "#D5C4A1"


def style(ax):
    ax.set_aspect("equal")
    ax.axis("off")


def house(ax, x, y, w=6.5, h=5.0, rot=0, color=BUILD):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="square,pad=0",
                                facecolor=color, edgecolor=BUILD_EDGE, lw=0.8, zorder=2))
    # toiture simple
    ax.plot([x, x + w / 2, x + w], [y + h, y + h + 1.6, y + h],
            color="#8B4513", lw=1.0, zorder=3)


def draw_urban_fabric(ax):
    """Constructions existantes Kipé (ouest/sud) et Nongo (est/nord)."""
    rng = np.random.default_rng(42)

    # --- Côté Kipé (gauche / Ouest, y < 0 côté sud) ---
    for i, (x, y) in enumerate([
        (-55, -48), (-45, -50), (-35, -46), (-25, -52), (-15, -48),
        (-52, -38), (-42, -36), (-32, -40), (-22, -35),
        (-58, -28), (-48, -26), (-38, -30),
        (-60, 18), (-50, 22), (-40, 16), (-55, 30), (-45, 34),
        (-30, 20), (-22, 26),
    ]):
        house(ax, x + rng.uniform(-1, 1), y + rng.uniform(-1, 1),
              w=rng.uniform(5.5, 8), h=rng.uniform(4.5, 6.5))

    # --- Côté Nongo (droite / Est) ---
    for i, (x, y) in enumerate([
        (80, -48), (90, -50), (100, -45), (110, -52), (120, -47),
        (85, -36), (95, -34), (105, -38), (115, -32),
        (82, 18), (92, 22), (102, 16), (112, 24), (122, 20),
        (88, 32), (98, 36), (108, 30),
        (125, -28), (130, -20), (128, 10),
    ]):
        house(ax, x + rng.uniform(-1, 1), y + rng.uniform(-1, 1),
              w=rng.uniform(5.5, 8), h=rng.uniform(4.5, 6.5), color="#BFAF9A")

    # Labels quartiers
    ax.text(-48, 42, "QUARTIER KIPÉ", fontsize=11, fontweight="bold",
            color=NAVY, ha="center", zorder=20)
    ax.text(110, 42, "QUARTIER NONGO", fontsize=11, fontweight="bold",
            color=NAVY, ha="center", zorder=20)


def draw_watercourse(ax):
    """Cours d'eau / lit de la rivière sous le pont Kiridi."""
    # lit principal transversal (axe Y) — en réalité le pont est E-O, rivière N-S
    # On place la rivière le long de Y, pont le long de X
    xs = np.array([-8, 70])
    # berges sinueuses
    y_left = -14
    y_right = 14
    # eau
    ax.add_patch(Polygon([
        (-12, y_left), (74, y_left - 1), (74, y_right + 1), (-12, y_right),
    ], closed=True, facecolor=WATER, edgecolor="#3A7A9A", lw=1.2, alpha=0.55, zorder=1))
    # hachures eau
    for x in np.arange(-8, 72, 4):
        ax.plot([x, x + 2], [0, 2], color="#3A7A9A", lw=0.5, alpha=0.35, zorder=1)
    ax.text(30, 0, "COURS D'EAU\n(Pont Kiridi)", fontsize=8, ha="center", va="center",
            color="#1E4F6A", fontweight="bold", zorder=15,
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white", alpha=0.7, lw=0))


def draw_existing_road(ax):
    """Route existante Kipé ↔ Nongo traversant le pont."""
    # chaussée principale axe X
    ax.add_patch(Rectangle((-70, -5), 210, 10, facecolor=ROAD, edgecolor="none",
                           alpha=0.55, zorder=2))
    # marquage
    for x in np.arange(-68, 138, 6):
        ax.plot([x, x + 3], [0, 0], color="white", lw=1.2, ls="--", zorder=3)
    ax.text(-62, 7.5, "Route Kipé → Nongo (existante)", fontsize=8,
            color="white", fontweight="bold", zorder=4)


def draw_bridge(ax):
    """Emprise du futur pont (et ouvrage existant à démolir)."""
    # ouvrage existant à démolir (en pointillés)
    ax.add_patch(FancyBboxPatch((-2, -5.5), L_BRIDGE + 4, 11,
                                boxstyle="square,pad=0", fill=False,
                                edgecolor=ORANGE, lw=1.5, ls="--", zorder=6))
    ax.text(L_BRIDGE / 2, -8.5, "Ouvrage existant à démolir / emprise nouveau pont\n"
            f"L = {L_BRIDGE:.2f} m  |  largeur utile = {W_DECK:.2f} m",
            fontsize=7.5, ha="center", color=ORANGE, fontweight="bold", zorder=7)

    # Nouveau tablier schématique
    ax.add_patch(Rectangle((0, -4), L_BRIDGE, 8, facecolor="#9AA7B5",
                           edgecolor=NAVY, lw=1.6, alpha=0.75, zorder=5))
    # piles
    for px in [15.7, 31.4, 47.1]:
        ax.add_patch(Circle((px, 0), 1.2, facecolor="#B8C4CE", edgecolor=NAVY, lw=1.0, zorder=6))
    ax.text(L_BRIDGE / 2, 0, "PONT KIRIDI\n(projet BA)", fontsize=8, ha="center",
            va="center", color=NAVY, fontweight="bold", zorder=8)


def zone(ax, x, y, w, h, color, label, sub="", edge="#333"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.15,rounding_size=0.8",
                                facecolor=color, edgecolor=edge, lw=1.4, alpha=0.85, zorder=8))
    ax.text(x + w / 2, y + h / 2 + (0.6 if sub else 0), label, fontsize=8,
            ha="center", va="center", fontweight="bold", color=NAVY, zorder=9)
    if sub:
        ax.text(x + w / 2, y + h / 2 - 1.2, sub, fontsize=6.5,
                ha="center", va="center", color="#444", zorder=9)


def draw_site_installation(ax):
    """Zones d'installation de chantier intégrées au site."""

    # Clôture de chantier (polygone englobant)
    fence_pts = [
        (-35, -42), (78, -42), (78, -16), (95, -16), (95, 28),
        (78, 28), (78, 38), (-20, 38), (-20, 28), (-35, 28),
    ]
    ax.add_patch(Polygon(fence_pts, closed=True, fill=False, edgecolor=FENCE,
                         lw=2.2, ls="-", zorder=12))
    # poteaux clôture
    for i in range(len(fence_pts)):
        x, y = fence_pts[i]
        ax.plot(x, y, "o", color=FENCE, ms=3, zorder=13)
    ax.text(-32, 35, "Clôture de chantier\n(grillage + panneaux)", fontsize=7,
            color=FENCE, fontweight="bold", zorder=14)

    # Portails
    ax.add_patch(Rectangle((-36, -6), 2.5, 12, facecolor="#E74C3C", edgecolor=FENCE, lw=1.2, zorder=14))
    ax.text(-42, 0, "PORTAIL\nPRINCIPAL\n(accès Kipé)", fontsize=6.5, ha="center",
            va="center", color=FENCE, fontweight="bold", zorder=14)
    ax.add_patch(Rectangle((76.5, -6), 2.5, 12, facecolor="#E74C3C", edgecolor=FENCE, lw=1.2, zorder=14))
    ax.text(88, 0, "PORTAIL\nSECONDAIRE\n(accès Nongo)", fontsize=6.5, ha="center",
            va="center", color=FENCE, fontweight="bold", zorder=14)

    # Base vie — côté Kipé, hors lit, sur parcelle libre
    zone(ax, -33, 18, 22, 16, ZONE_BV, "BASE VIE",
         "bureaux • vestiaires • infirmerie\nréfectoire • WC • parking VL")

    # Stockage matériaux — rive Kipé sud
    zone(ax, -33, -40, 28, 14, ZONE_STOCK, "ZONE STOCKAGE",
         "ciment • aciers HA • coffrages\nagrégats • sable • eau")

    # Préfabrication poutres — rive Nongo sud (espace plus libre)
    zone(ax, 72, -40, 22, 20, ZONE_PREF, "PRÉFABRICATION",
         "aires poutres BA\nferraillage • bétonnage\nmâturation")

    # Parc engins
    zone(ax, 72, 12, 20, 14, ZONE_ENG, "PARC ENGINS",
         "pelle • camions • grue\ncompacteur • bétonnière")

    # Zone travaux / fondations (dans emprise)
    zone(ax, 8, 16, 28, 10, ZONE_TRAV, "ZONE TRAVAUX",
         "fouilles • pieux/semelles • piles/culées")

    # Aire de grutage / levage poutres
    ax.add_patch(Circle((15.7, -18), 8, facecolor="#FADBD8", edgecolor=ORANGE,
                        lw=1.5, ls="--", alpha=0.7, zorder=7))
    ax.add_patch(Circle((47.1, -18), 8, facecolor="#FADBD8", edgecolor=ORANGE,
                        lw=1.5, ls="--", alpha=0.7, zorder=7))
    ax.plot(15.7, -18, "^", color=ORANGE, ms=12, zorder=10)
    ax.plot(47.1, -18, "^", color=ORANGE, ms=12, zorder=10)
    ax.text(15.7, -28, "Poste grue G1", fontsize=7, ha="center", color=ORANGE, fontweight="bold")
    ax.text(47.1, -28, "Poste grue G2", fontsize=7, ha="center", color=ORANGE, fontweight="bold")

    # Rayons d'action grue (schématiques)
    ax.add_patch(Wedge((15.7, -18), 22, 20, 160, width=0.01, facecolor="none",
                       edgecolor=ORANGE, lw=0.8, ls=":", alpha=0.6, zorder=7))
    ax.add_patch(Wedge((47.1, -18), 22, 20, 160, width=0.01, facecolor="none",
                       edgecolor=ORANGE, lw=0.8, ls=":", alpha=0.6, zorder=7))


def draw_temporary_detour(ax):
    """Déviation provisoire pour habitants (contournement sud)."""
    # itinéraire déviation
    xs = [-55, -40, -20, 10, 40, 70, 95, 120]
    ys = [-8, -55, -58, -58, -58, -55, -10, -5]
    ax.plot(xs, ys, color="#1A5276", lw=3.5, solid_capstyle="round", zorder=11)
    ax.plot(xs, ys, color="#5DADE2", lw=2.0, ls="--", solid_capstyle="round", zorder=12)
    # flèches sens
    for i in range(len(xs) - 1):
        ax.annotate("", xy=(xs[i + 1], ys[i + 1]), xytext=(xs[i], ys[i]),
                    arrowprops=dict(arrowstyle="->", color="#1A5276", lw=1.5),
                    zorder=13)
    ax.text(30, -62, "DÉVIATION PROVISOIRE PIÉTONS / 2-ROUES\n(maintien accès habitants Kipé ↔ Nongo)",
            fontsize=8, ha="center", color="#1A5276", fontweight="bold", zorder=14,
            bbox=dict(boxstyle="round,pad=0.3", facecolor=ZONE_DEV, edgecolor="#1A5276", lw=1))


def draw_north_and_coords(ax):
    # Flèche Nord
    ax.annotate("N", xy=(-62, 48), xytext=(-62, 38),
                fontsize=14, fontweight="bold", ha="center", color=NAVY,
                arrowprops=dict(arrowstyle="->", color=NAVY, lw=2.0))
    # Coordonnées
    ax.text(125, 48,
            f"LOCALISATION\nPont Kiridi — Conakry (Ratoma)\n"
            f"Entre Kipé et Nongo\n"
            f"Lat. {LAT:.5f}° N\nLon. {abs(LON):.5f}° O\n"
            f"≈ 9°36'41.6\" N / 13°38'11.3\" O\nAlt. ≈ 3 m",
            fontsize=7.5, ha="left", va="top", color=NAVY,
            bbox=dict(boxstyle="round,pad=0.4", facecolor="white",
                      edgecolor=NAVY, lw=1.2), zorder=20)


def draw_legend(ax):
    items = [
        (ZONE_BV, "Base vie"),
        (ZONE_STOCK, "Stockage matériaux"),
        (ZONE_PREF, "Préfabrication poutres"),
        (ZONE_ENG, "Parc engins"),
        (ZONE_TRAV, "Zone travaux"),
        (WATER, "Cours d'eau"),
        (BUILD, "Constructions existantes"),
        (FENCE, "Clôture / portails"),
    ]
    x0, y0 = -68, -68
    ax.text(x0, y0 + 4, "LÉGENDE", fontsize=9, fontweight="bold", color=NAVY)
    for i, (c, lab) in enumerate(items):
        yy = y0 - i * 3.2
        ax.add_patch(Rectangle((x0, yy - 1), 3.5, 2.2, facecolor=c, edgecolor="#333", lw=0.8))
        ax.text(x0 + 4.5, yy, lab, fontsize=7.5, va="center", color="#222")


def fig_plan_principal():
    fig, ax = plt.subplots(figsize=(18, 13), dpi=220)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    style(ax)

    draw_urban_fabric(ax)
    draw_watercourse(ax)
    draw_existing_road(ax)
    draw_bridge(ax)
    draw_site_installation(ax)
    draw_temporary_detour(ax)
    draw_north_and_coords(ax)
    draw_legend(ax)

    # Échelle graphique
    ax.plot([100, 120], [-68, -68], color=NAVY, lw=3)
    ax.plot([100, 100], [-69, -67], color=NAVY, lw=2)
    ax.plot([120, 120], [-69, -67], color=NAVY, lw=2)
    ax.text(110, -70.5, "20 m", fontsize=8, ha="center", color=NAVY, fontweight="bold")
    ax.text(110, -66, "ÉCHELLE APPROX.", fontsize=7, ha="center", color=NAVY)

    ax.set_xlim(-72, 145)
    ax.set_ylim(-78, 55)
    ax.set_title(
        "PLAN D'INSTALLATION DE CHANTIER — PONT KIRIDI\n"
        "Construction d'un pont en béton armé  |  Kipé – Nongo, Conakry (Guinée)\n"
        "Mémoire d'ingénieurs — Ponts et chaussées  |  Mamady KABA & T.I.H. Diallo  |  Enc. F.B. Keita",
        fontsize=13, fontweight="bold", color=NAVY, pad=14
    )

    # Cartouche bas
    ax.text(0.5, 0.012,
            "Notes : emprises adaptées au tissu urbain dense • maintien d'une déviation provisoire • "
            "zones hors lit majeur autant que possible • rayons de grue schématiques • "
            "implantation à valider par levé topographique de détail",
            transform=fig.transFigure, fontsize=7.5, ha="center", color="#555")

    fig.tight_layout(rect=[0, 0.03, 1, 1])
    path = OUT / "01_plan_installation_chantier_Kiridi.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_organisation():
    """Schéma organisationnel + moyens."""
    fig, axes = plt.subplots(1, 2, figsize=(16, 8), dpi=220)
    fig.patch.set_facecolor(BG)

    # --- Org hiérarchique ---
    ax = axes[0]
    ax.set_facecolor(BG)
    style(ax)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 12)

    def box(x, y, w, h, text, color):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1,rounding_size=0.3",
                                    facecolor=color, edgecolor=NAVY, lw=1.3))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=8,
                fontweight="bold", color=NAVY)

    box(3, 10.2, 4, 1.2, "Conducteur des travaux", ZONE_BV)
    box(3, 8.2, 4, 1.0, "Chef de chantier", ZONE_STOCK)
    box(0.5, 6.0, 2.8, 1.2, "Ingénieur\nméthodes", ZONE_PREF)
    box(3.6, 6.0, 2.8, 1.2, "Topographe\n/ contrôle", ZONE_ENG)
    box(6.7, 6.0, 2.8, 1.2, "HSE / QSE", ZONE_TRAV)
    box(0.3, 3.5, 2.2, 1.4, "Maçons\nCoffreurs", "#E8DAEF")
    box(2.8, 3.5, 2.2, 1.4, "Ferrailleurs", "#E8DAEF")
    box(5.3, 3.5, 2.2, 1.4, "Opérateurs\nd'engins", "#E8DAEF")
    box(7.8, 3.5, 2.0, 1.4, "Manœuvres", "#E8DAEF")

    for x1, y1, x2, y2 in [
        (5, 10.2, 5, 9.2), (5, 8.2, 5, 7.2),
        (5, 7.2, 1.9, 7.2), (5, 7.2, 5, 7.2), (5, 7.2, 8.1, 7.2),
        (1.9, 7.2, 1.9, 7.2), (1.9, 7.2, 1.9, 6.0),
        (5, 7.2, 5, 6.0), (8.1, 7.2, 8.1, 6.0),
        (5, 6.0, 5, 5.0), (5, 4.9, 1.4, 4.9), (5, 4.9, 8.8, 4.9),
        (1.4, 4.9, 1.4, 4.9), (1.4, 4.9, 1.4, 4.9),
    ]:
        ax.plot([x1, x2], [y1, y2], color=NAVY, lw=1.0)

    ax.plot([5, 5], [8.2, 7.2], color=NAVY, lw=1.0)
    ax.plot([1.9, 8.1], [7.2, 7.2], color=NAVY, lw=1.0)
    ax.plot([1.9, 1.9], [7.2, 7.2], color=NAVY, lw=1.0)
    ax.plot([1.4, 3.9, 6.4, 8.8], [4.9, 4.9, 4.9, 4.9], color=NAVY, lw=1.0)
    ax.plot([5, 5], [6.0, 4.9], color=NAVY, lw=1.0)
    for xx in [1.4, 3.9, 6.4, 8.8]:
        ax.plot([xx, xx], [4.9, 4.9], color=NAVY, lw=1.0)
        ax.plot([xx, xx], [4.9, 4.9], color=NAVY)

    ax.text(5, 1.8, "Organisation hiérarchique du chantier\nPont Kiridi — Kipé / Nongo",
            fontsize=10, ha="center", fontweight="bold", color=NAVY)
    ax.text(5, 0.6, "Objectif : Qualité – Coût – Délai – Sécurité",
            fontsize=8, ha="center", color="#555")
    ax.set_title("1. ORGANISATION DU CHANTIER", fontsize=12, fontweight="bold", color=NAVY)

    # --- Moyens matériels ---
    ax = axes[1]
    ax.set_facecolor(BG)
    style(ax)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 12)

    moyens = [
        ("Pelle hydraulique", "Fouilles, terrassements"),
        ("Camions bennes", "Évacuation déblais / apports"),
        ("Grue mobile (G1, G2)", "Pose poutres, levage"),
        ("Bétonnière / centrale", "Béton BA"),
        ("Coffrage bois/métallique", "Culées, piles, hourdis"),
        ("Vibrateurs béton", "Mise en place béton"),
        ("Compacteur", "Remblais d'accès"),
        ("Niveaux topographiques", "Implantation / contrôles"),
        ("Groupes électrogènes", "Alimentation chantier"),
        ("Pompes / batardeaux", "Travaux en lit (si besoin)"),
    ]
    ax.text(5, 11.3, "MOYENS MATÉRIELS PRINCIPAUX", fontsize=11,
            ha="center", fontweight="bold", color=NAVY)
    for i, (m, u) in enumerate(moyens):
        y = 10.3 - i * 0.9
        ax.add_patch(FancyBboxPatch((0.5, y - 0.35), 9, 0.75,
                                    boxstyle="round,pad=0.05,rounding_size=0.2",
                                    facecolor="white", edgecolor=GREEN, lw=1.0))
        ax.text(0.8, y, f"• {m}", fontsize=9, va="center", color=NAVY, fontweight="bold")
        ax.text(9.2, y, u, fontsize=8, va="center", ha="right", color="#555")

    ax.set_title("2. MOYENS MATÉRIELS", fontsize=12, fontweight="bold", color=NAVY)
    fig.suptitle("ORGANISATION & MOYENS — Installation de chantier Pont Kiridi",
                 fontsize=13, fontweight="bold", color=NAVY, y=0.98)
    fig.tight_layout(rect=[0, 0, 1, 0.95])
    path = OUT / "02_organisation_moyens.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_phasage():
    fig, ax = plt.subplots(figsize=(16, 8), dpi=220)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    style(ax)
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)

    phases = [
        ("1", "Installation\nde chantier", "20 j", "Base vie, clôture,\nportails, réseaux", ZONE_BV),
        ("2", "Accès provisoire\n& déviation", "15 j", "Maintien circulation\nhabitants", ZONE_DEV),
        ("3", "Démolition\nouvrage existant", "45 j", "Démolition mécanique\névacuation déblais", ZONE_TRAV),
        ("4", "Terrassement\n& fondations", "45 j", "Fouilles, pieux,\nsemelles", ZONE_STOCK),
        ("5", "Infrastructures\n(culées/piles)", "95 j", "Élévation appuis\nremblais", ZONE_PREF),
        ("6", "Superstructure\n& finitions", "—", "Poutres, hourdis,\néquipements, réception", ZONE_ENG),
    ]

    ax.text(7, 9.3, "PHASAGE D'INSTALLATION ET D'EXÉCUTION — PONT KIRIDI",
            fontsize=13, ha="center", fontweight="bold", color=NAVY)
    ax.text(7, 8.6, "Durée globale estimée du projet : 311 jours (01/07/2026 → 08/09/2027)",
            fontsize=9, ha="center", color="#555")

    for i, (n, title, dur, detail, col) in enumerate(phases):
        x = 0.4 + i * 2.25
        ax.add_patch(FancyBboxPatch((x, 3.2), 2.05, 4.6,
                                    boxstyle="round,pad=0.1,rounding_size=0.3",
                                    facecolor=col, edgecolor=NAVY, lw=1.4))
        ax.add_patch(Circle((x + 1.02, 7.2), 0.35, facecolor=NAVY, zorder=5))
        ax.text(x + 1.02, 7.2, n, color="white", ha="center", va="center",
                fontsize=11, fontweight="bold", zorder=6)
        ax.text(x + 1.02, 6.3, title, ha="center", va="center", fontsize=8,
                fontweight="bold", color=NAVY)
        ax.text(x + 1.02, 5.2, dur, ha="center", fontsize=10, fontweight="bold", color=ORANGE)
        ax.text(x + 1.02, 4.1, detail, ha="center", va="center", fontsize=7, color="#333")
        if i < len(phases) - 1:
            ax.annotate("", xy=(x + 2.2, 5.5), xytext=(x + 2.05, 5.5),
                        arrowprops=dict(arrowstyle="->", color=NAVY, lw=1.8))

    ax.text(7, 1.8,
            "Contraintes site Kiridi : tissu urbain dense (Kipé/Nongo) • cours d'eau • "
            "continuité d'accès riverains • gestion affouillement / niveaux d'eau (NPBE 1 m / NPHE 4 m)",
            fontsize=8, ha="center", color="#444",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor=NAVY, lw=1))
    ax.text(7, 0.7,
            "Mamady KABA & Thierno Ibrahima Hassanatou Diallo  |  Encadré par Monsieur Fodé Bangaly Keita",
            fontsize=8, ha="center", color="#666")

    path = OUT / "03_phasage_installation.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_localisation():
    """Carte de situation simplifiée Conakry / Ratoma / Kipé-Nongo."""
    fig, ax = plt.subplots(figsize=(12, 9), dpi=220)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor("#E8F4FA")
    style(ax)

    # Côte / Atlantique
    ax.add_patch(Polygon([(-2, -1), (3, -1), (3, 8), (-2, 8)], closed=True,
                         facecolor="#A9CCE3", edgecolor="none"))
    ax.text(0.3, 6.5, "OCÉAN\nATLANTIQUE", fontsize=9, ha="center", color="#1A5276",
            fontweight="bold", alpha=0.7)

    # Conakry peninsula shape rough
    peninsula = [
        (1.5, 0.5), (2.2, 1.5), (2.5, 3.0), (2.8, 4.5), (3.2, 5.8),
        (4.0, 6.5), (5.5, 6.8), (7.0, 6.2), (8.0, 5.0), (8.5, 3.5),
        (8.2, 2.0), (7.0, 1.0), (5.0, 0.6), (3.0, 0.4),
    ]
    ax.add_patch(Polygon(peninsula, closed=True, facecolor="#D5F5E3",
                         edgecolor=GREEN, lw=1.5, alpha=0.9))

    # Communes approximatives
    ax.add_patch(FancyBboxPatch((3.2, 4.8), 3.5, 1.6, boxstyle="round,pad=0.05",
                                facecolor="#FCF3CF", edgecolor=ORANGE, lw=1.5, alpha=0.85))
    ax.text(4.95, 5.9, "COMMUNE DE RATOMA", fontsize=9, ha="center",
            fontweight="bold", color=ORANGE)
    ax.text(4.95, 5.35, "Kipé  •  Nongo  •  Kaporo…", fontsize=8, ha="center", color="#555")

    # Point Kiridi
    ax.plot(5.2, 5.55, "o", color=FENCE, ms=14, zorder=10)
    ax.plot(5.2, 5.55, "o", color="white", ms=6, zorder=11)
    ax.annotate("★ PONT KIRIDI\n(site du projet)\n9°36'41.6\"N\n13°38'11.3\"O",
                xy=(5.2, 5.55), xytext=(6.8, 3.5),
                fontsize=9, color=FENCE, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=FENCE, lw=1.8),
                bbox=dict(boxstyle="round,pad=0.35", facecolor="white",
                          edgecolor=FENCE, lw=1.3))

    # Labels
    ax.text(4.0, 2.2, "CONAKRY", fontsize=16, fontweight="bold", color=NAVY, ha="center")
    ax.text(4.0, 1.6, "Guinée", fontsize=11, color="#555", ha="center")
    ax.text(3.5, 4.2, "Dixinn", fontsize=8, color="#666")
    ax.text(6.5, 4.3, "Matoto →", fontsize=8, color="#666")

    # Flèche Nord
    ax.annotate("N", xy=(1.0, 7.5), xytext=(1.0, 6.6),
                fontsize=12, fontweight="bold", ha="center", color=NAVY,
                arrowprops=dict(arrowstyle="->", color=NAVY, lw=2))

    ax.set_xlim(-0.5, 10)
    ax.set_ylim(0, 8)
    ax.set_title("CARTE DE LOCALISATION DU SITE\n"
                 "Pont Kiridi — entre Kipé et Nongo (Commune de Ratoma, Conakry)",
                 fontsize=12, fontweight="bold", color=NAVY, pad=10)
    ax.text(5, 0.25,
            "Source localisation : données projet / Google Earth (~9.6116°N, 13.6365°O)  |  "
            "Mémoire Ponts et Chaussées",
            fontsize=7.5, ha="center", color="#666")

    path = OUT / "04_localisation_Pont_Kiridi.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def fig_coupes_principes():
    """Profil schématique d'implantation rive Kipé / rive Nongo."""
    fig, ax = plt.subplots(figsize=(16, 7), dpi=220)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    style(ax)

    # Terrain
    xs = np.linspace(0, 100, 200)
    ys = 3 + 1.2 * np.exp(-((xs - 20) / 8) ** 2) - 2.8 * np.exp(-((xs - 50) / 12) ** 2) + \
         1.0 * np.exp(-((xs - 80) / 9) ** 2)
    ax.fill_between(xs, ys, -3, color=SOIL, alpha=0.7)
    ax.plot(xs, ys, color="#5C4033", lw=1.5)

    # Eau
    ax.axhline(1.0, color="#3A8FBF", ls="--", lw=1)
    ax.axhline(4.0, color="#1E5F8A", ls="--", lw=1)
    ax.fill_between([38, 62], [-1, -1], [1, 1], color=WATER, alpha=0.5)
    ax.text(2, 4.15, "NPHE = 4,00 m", fontsize=8, color="#1E5F8A")
    ax.text(2, 1.15, "NPBE = 1,00 m", fontsize=8, color="#3A8FBF")

    # Pont
    ax.add_patch(Rectangle((35, 5.5), 30, 0.6, facecolor="#9AA7B5", edgecolor=NAVY, lw=1.3))
    for px, h0 in [(42, -0.5), (50, -1.5), (58, -0.3)]:
        ax.add_patch(Rectangle((px - 0.5, h0), 1.0, 5.5 - h0, facecolor="#C9D1D8",
                               edgecolor=NAVY, lw=1.1))

    # Zones rive
    ax.add_patch(FancyBboxPatch((5, 6.5), 18, 3.2, boxstyle="round,pad=0.1",
                                facecolor=ZONE_BV, edgecolor=NAVY, lw=1.2))
    ax.text(14, 8.1, "RIVE KIPÉ\nBase vie + Stockage", ha="center", fontsize=8,
            fontweight="bold", color=NAVY)

    ax.add_patch(FancyBboxPatch((75, 6.5), 20, 3.2, boxstyle="round,pad=0.1",
                                facecolor=ZONE_PREF, edgecolor=GREEN, lw=1.2))
    ax.text(85, 8.1, "RIVE NONGO\nPréfab. + Parc engins", ha="center", fontsize=8,
            fontweight="bold", color=GREEN)

    ax.annotate("", xy=(35, 7.5), xytext=(23, 7.5),
                arrowprops=dict(arrowstyle="->", color=ORANGE, lw=1.5))
    ax.annotate("", xy=(65, 7.5), xytext=(75, 7.5),
                arrowprops=dict(arrowstyle="->", color=ORANGE, lw=1.5))
    ax.text(50, 9.5, "Principe d'implantation : zones hors lit + accès bilatéral Kipé/Nongo",
            fontsize=9, ha="center", color=ORANGE, fontweight="bold")

    ax.text(14, 4.5, "Maisons\nexistantes", fontsize=7, ha="center", color=BUILD_EDGE)
    ax.text(88, 4.5, "Maisons\nexistantes", fontsize=7, ha="center", color=BUILD_EDGE)
    for x, y in [(8, 4.2), (13, 4.4), (18, 4.1), (78, 4.3), (84, 4.5), (91, 4.2)]:
        ax.add_patch(Rectangle((x, y), 3.0, 2.3, facecolor=BUILD, edgecolor=BUILD_EDGE, lw=0.8, zorder=5))

    ax.set_xlim(0, 100)
    ax.set_ylim(-3, 11)
    ax.set_title("PRINCIPE D'IMPLANTATION DES ZONES DE CHANTIER\n"
                 "Coupe schématique rive Kipé — cours d'eau — rive Nongo (Pont Kiridi)",
                 fontsize=12, fontweight="bold", color=NAVY, pad=10)
    path = OUT / "05_principe_implantation_rives.png"
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return path


def build_pptx(paths):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    NAVY_C = RGBColor(10, 37, 64)
    WHITE = RGBColor(255, 255, 255)
    MUTED = RGBColor(80, 80, 80)
    OR = RGBColor(196, 92, 38)

    def header(slide, title):
        bar = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(0), Inches(0),
                                     prs.slide_width, Inches(0.7))
        bar.fill.solid(); bar.fill.fore_color.rgb = NAVY_C; bar.line.fill.background()
        tf = slide.shapes.add_textbox(Inches(0.35), Inches(0.15), Inches(12.6), Inches(0.45)).text_frame
        p = tf.paragraphs[0]; p.text = title; p.font.size = Pt(16); p.font.bold = True; p.font.color.rgb = WHITE

    # Cover
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(0), Inches(0),
                            prs.slide_width, prs.slide_height)
    bg.fill.solid(); bg.fill.fore_color.rgb = RGBColor(247, 244, 239); bg.line.fill.background()
    header(s, "PLAN D'INSTALLATION DE CHANTIER — PONT KIRIDI")
    box = s.shapes.add_textbox(Inches(0.8), Inches(1.3), Inches(11.8), Inches(5.5)).text_frame
    lines = [
        ("Construction d'un pont en béton armé", 28, True, NAVY_C),
        ("Site : Pont Kiridi — entre Kipé et Nongo, Conakry (Guinée)", 18, False, OR),
        ("Coordonnées : ≈ 9°36'41.6\" N / 13°38'11.3\" O  |  Alt. ≈ 3 m", 15, False, MUTED),
        ("", 12, False, MUTED),
        ("Contenu du dossier :", 16, True, NAVY_C),
        ("• Localisation du site dans la commune de Ratoma", 15, False, MUTED),
        ("• Plan d'installation intégré au tissu urbain existant", 15, False, MUTED),
        ("• Organisation hiérarchique et moyens matériels", 15, False, MUTED),
        ("• Phasage d'installation et d'exécution", 15, False, MUTED),
        ("• Principe d'implantation rive Kipé / rive Nongo", 15, False, MUTED),
        ("", 12, False, MUTED),
        ("Réalisé par : Mamady KABA & Thierno Ibrahima Hassanatou Diallo", 14, False, MUTED),
        ("Encadré par : Monsieur Fodé Bangaly Keita", 14, False, MUTED),
    ]
    first = True
    for text, size, bold, color in lines:
        p = box.paragraphs[0] if first else box.add_paragraph(); first = False
        p.text = text; p.font.size = Pt(size); p.font.bold = bold; p.font.color.rgb = color

    titles = [
        "1 — Localisation du site Pont Kiridi (Kipé–Nongo)",
        "2 — Plan d'installation de chantier (vue d'ensemble)",
        "3 — Organisation & moyens matériels",
        "4 — Phasage d'installation / exécution",
        "5 — Principe d'implantation des rives",
    ]
    order = [paths[3], paths[0], paths[1], paths[2], paths[4]]
    for title, img in zip(titles, order):
        s = prs.slides.add_slide(prs.slide_layouts[6])
        header(s, title)
        s.shapes.add_picture(str(img), Inches(0.35), Inches(0.85), width=Inches(12.6))

    # Synthèse texte
    s = prs.slides.add_slide(prs.slide_layouts[6])
    header(s, "6 — Synthèse du plan d'installation")
    tf = s.shapes.add_textbox(Inches(0.7), Inches(1.1), Inches(12), Inches(5.8)).text_frame
    bullets = [
        "Le chantier s'implante de part et d'autre du cours d'eau, entre Kipé (ouest) et Nongo (est).",
        "Base vie et stockage placés rive Kipé ; préfabrication et parc engins rive Nongo — pour limiter l'encombrement.",
        "Deux portails (Kipé / Nongo) + clôture continue pour sécuriser l'emprise et séparer du voisinage dense.",
        "Déviation provisoire sud pour maintenir l'accès riverains (piétons / 2-roues) pendant démolition et travaux.",
        "Deux postes de grue (G1, G2) pour levage des poutres et manutentions sur l'ouvrage de 62,80 m.",
        "Installation de chantier estimée à ~20 jours, avant démolition (45 j) puis fondations / superstructure.",
        "Contraintes majeures : urbanisation dense, lit du cours d'eau, NPHE/NPBE, affouillement 5,00 m.",
    ]
    first = True
    for b in bullets:
        p = tf.paragraphs[0] if first else tf.add_paragraph(); first = False
        p.text = "•  " + b
        p.font.size = Pt(16)
        p.font.color.rgb = RGBColor(30, 30, 30)
        p.space_after = Pt(8)

    out = Path("/workspace/exports/Plan_Installation_Chantier_Pont_Kiridi.pptx")
    prs.save(out)
    return out


def build_pdf(paths):
    ordered = [paths[3], paths[0], paths[1], paths[2], paths[4]]
    images = [PILImage.open(p).convert("RGB") for p in ordered]
    out = Path("/workspace/exports/Plan_Installation_Chantier_Pont_Kiridi.pdf")
    images[0].save(out, save_all=True, append_images=images[1:], resolution=220)
    return out


def main():
    print("Génération…")
    p1 = fig_plan_principal()
    print(p1)
    p2 = fig_organisation()
    print(p2)
    p3 = fig_phasage()
    print(p3)
    p4 = fig_localisation()
    print(p4)
    p5 = fig_coupes_principes()
    print(p5)
    paths = [p1, p2, p3, p4, p5]
    pptx = build_pptx(paths)
    pdf = build_pdf(paths)
    for p in paths:
        dest = ART / p.name
        dest.write_bytes(p.read_bytes())
    ART.joinpath("Plan_Installation_Chantier_Pont_Kiridi.pptx").write_bytes(pptx.read_bytes())
    ART.joinpath("Plan_Installation_Chantier_Pont_Kiridi.pdf").write_bytes(pdf.read_bytes())
    print(pptx)
    print(pdf)


if __name__ == "__main__":
    main()
