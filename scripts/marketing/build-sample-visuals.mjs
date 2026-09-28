#!/usr/bin/env node
/**
 * Visuels réseaux sociaux à partir des exemples réels (BTP, école, ONG, PME).
 *
 * Entrées : docs/marketing/exemples/ (build-sample-reports.mjs pour le BTP, build-sector-samples.mjs pour les autres)
 * Sorties : docs/marketing/campagne/visuels/exemples-<secteur>/<format>/exemple-<visuel>.png
 *
 * Usage : node scripts/marketing/build-sample-visuals.mjs [--sector=btp,ecole,ong,pme] [--only=rapport,devis]
 */
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { ACCENTS, OFFER } from './campaign-content.mjs';
import { CAMPAIGN, CSS, WORK, ROOT, chips, esc, foot, glows, launchBrowser, logo, prepareBrandAssets, rich, url, kicker, icon } from './campaign-html.mjs';
import { renderPdfPages } from '../tutorials/engine/pdf-pages.mjs';

const EX = path.join(ROOT, 'docs', 'marketing', 'exemples');
const PAGES = path.join(WORK, 'exemples');
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1].split(',');
const ONLY = arg('only');
const SECTORS = arg('sector');

const PDFS = {
  hebdo: 'btp-rapports/01-rapport-hebdomadaire.pdf',
  mensuel: 'btp-rapports/02-rapport-mensuel.pdf',
  trimestriel: 'btp-rapports/03-rapport-trimestriel.pdf',
  annuel: 'btp-rapports/04-rapport-annuel.pdf',
  externe: 'btp-rapports/05-rapport-hebdomadaire-sans-montants.pdf',
  devis: 'btp-devis/devis-DEV-2026-0003.pdf',
  'ec-lycee': 'ecole/01-bulletin-lycee.pdf',
  'ec-primaire': 'ecole/02-bulletin-primaire.pdf',
  'ec-dir-mois': 'ecole/03-rapport-direction-mensuel.pdf',
  'ec-dir-annee': 'ecole/04-rapport-direction-annuel.pdf',
  'ec-recu': 'ecole/05-recu-paiement.pdf',
  'ong-cpn': 'ong/01-rapport-sondage-cpn-kindia.pdf',
  'ong-satisf': 'ong/02-rapport-sondage-satisfaction.pdf',
  'ong-general': 'ong/03-rapport-general-projets.pdf',
  'ong-budget': 'ong/04-execution-budgetaire.pdf',
  'ong-benef': 'ong/05-beneficiaires-kindia.pdf',
  'ong-tdb': 'ong/06-tableau-de-bord-ong.pdf',
  'pme-mois': 'pme/01-analyse-financiere-mensuelle.pdf',
  'pme-trim': 'pme/02-analyse-financiere-trimestrielle.pdf',
  'pme-annee': 'pme/03-analyse-financiere-annuelle.pdf',
  'pme-boutique': 'pme/04-analyse-boutique-madina.pdf',
};
const pg = (doc, n) => url(path.join(PAGES, doc, `page-${String(n).padStart(2, '0')}.jpg`));

const FORMATS = {
  carre: { W: 1080, H: 1080, B: 26, dir: 'carre-1080x1080', text: 'left:64px;right:64px;top:128px', h1: 58, sub: 25, stage: 'left:0;right:0;top:470px;bottom:120px', footY: 42 },
  portrait: { W: 1080, H: 1350, B: 28, dir: 'portrait-1080x1350', text: 'left:70px;right:70px;top:140px', h1: 66, sub: 28, stage: 'left:0;right:0;top:560px;bottom:140px', footY: 50 },
  paysage: { W: 1200, H: 628, B: 19, dir: 'paysage-1200x628', text: 'left:48px;width:540px;top:96px', h1: 40, sub: 18, stage: 'left:590px;right:10px;top:24px;bottom:24px', footY: 26, land: true },
};

/** Page A4 posée dans la scène : centre (x, y) et hauteur h en % de la scène. */
const page = (img, { x, y, h, r = 0, z = 1 }) =>
  `<div class="pg" style="left:${x}%;top:${y}%;height:${h}%;z-index:${z};transform:translate(-50%,-50%) rotate(${r}deg)"><img src="${img}"></div>`;

/** Page A4 paysage : centre (x, y) et largeur w en % de la scène, étiquette facultative en bas de page. */
const lpage = (img, { x, y, w, r = 0, z = 1, label, labelPos = 'left:50%;bottom:7%;transform:translateX(-50%)' }) =>
  `<div class="pg land" style="left:${x}%;top:${y}%;width:${w}%;z-index:${z};transform:translate(-50%,-50%) rotate(${r}deg)"><img src="${img}">${
    label ? `<div class="pill" style="${labelPos}">${esc(label)}</div>` : ''
  }</div>`;

/** Largeur d'une page paysage selon le format (la scène carrée est basse). */
const landW = (f, carre, portrait, paysage) => (f.land ? paysage : f.H > 1100 ? portrait : carre);

/** Recadrage d'une bande de page (top et height en % de la hauteur de page). */
const crop = (img, top, height) =>
  `<div class="crop" style="aspect-ratio:${(1 / (1.4142 * height / 100)).toFixed(4)}"><img src="${img}" style="margin-top:-${(1.4142 * top).toFixed(3)}%"></div>`;

const floatCard = (pos, html, z = 5) => `<div class="fc" style="${pos};z-index:${z}">${html}</div>`;
const pill = (pos, text, z = 6) => `<div class="pill" style="${pos};z-index:${z}">${esc(text)}</div>`;

const EXTRA_CSS = `
.pg{position:absolute;aspect-ratio:210/297;background:#fff;border-radius:.35em;overflow:hidden;box-shadow:0 1.6em 3em -1em rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.35)}
.pg.land{aspect-ratio:297/210}
.pg img{width:100%;height:100%;display:block;object-fit:cover}
.fc{position:absolute;padding:.8em 1em;border-radius:.9em;background:rgba(10,25,47,.92);border:1.5px solid rgba(255,255,255,.18);box-shadow:0 1.2em 2.5em -1em rgba(0,0,0,.8);backdrop-filter:blur(8px)}
.fc .l{color:#94A3B8;font-weight:700;font-size:.72em;text-transform:uppercase;letter-spacing:.08em}
.fc .v{font-weight:900;letter-spacing:-.02em;line-height:1.05;margin-top:.2em}
.fc ul{list-style:none;margin-top:.45em;display:flex;flex-direction:column;gap:.3em;font-weight:600;font-size:.82em;color:#E2E8F0}
.fc li{display:flex;justify-content:space-between;gap:1.2em}
.fc li b{color:var(--a2)}
.pill{position:absolute;padding:.42em .95em;border-radius:999px;background:linear-gradient(90deg,var(--a1),var(--a2));color:#06111F;font-weight:800;font-size:.8em;white-space:nowrap;box-shadow:0 .6em 1.4em -.5em rgba(0,0,0,.7)}
.pill.dark{background:#fff;color:#0A192F}
.crop{width:100%;overflow:hidden;border-radius:.5em;background:#fff}
.crop img{width:100%;display:block}
.stage{position:absolute}
.hsub{color:#CBD5E1;font-weight:500;line-height:1.4;margin-top:.5em}
.fbar{position:absolute;display:flex;align-items:center;justify-content:space-between;gap:1em}
`;

const VISUALS = {
  rapport: {
    kicker: 'Modèles de rapport BTP',
    title: 'Votre rapport de chantier, *prêt en\u00a01\u00a0clic*.',
    sub: 'Fiches journalières, carburant, livraisons et photos compilés automatiquement en PDF et PowerPoint.',
    chips: ['Semaine · Mois · Trimestre · Année', 'Votre logo', 'PDF + PowerPoint'],
    stage: (f) =>
      page(pg('hebdo', 6), { x: f.land ? 25 : 26, y: 52, h: 80, r: -9, z: 1 }) +
      page(pg('hebdo', 2), { x: f.land ? 75 : 74, y: 50, h: 80, r: 8, z: 2 }) +
      page(pg('hebdo', 1), { x: 50, y: 48, h: 92, r: 0, z: 3 }) +
      pill(f.land ? 'right:4%;top:6%' : 'right:9%;top:4%', 'PDF') +
      pill(f.land ? 'right:4%;top:17%' : 'right:9%;top:13%', 'PowerPoint'),
  },
  devis: {
    kicker: 'Devis BTP',
    title: 'Du métré au devis PDF, *en quelques minutes*.',
    sub: 'Saisissez les dimensions : ciment, sable, gravier, fers et agglos sont calculés et chiffrés avec vos prix.',
    chips: ['Lots et récapitulatif', 'TVA et montant en lettres', 'PDF + Excel'],
    stage: (f) =>
      page(pg('devis', 3), { x: f.land ? 36 : 35, y: 50, h: 90, r: -6, z: 1 }) +
      page(pg('devis', 11), { x: f.land ? 66 : 65, y: 50, h: 90, r: 5, z: 2 }) +
      floatCard(
        f.land ? 'left:0;top:4%;font-size:.9em' : 'left:5%;top:3%',
        `<div class="l">Métré → matériaux</div><ul><li>Ciment CPJ 42.5<b>219 sacs</b></li><li>Fer HA12<b>170 barres</b></li><li>Gravier<b>24,6 m³</b></li><li>Agglos pleins 20<b>1 239 u</b></li></ul>`,
        4
      ) +
      floatCard(
        f.land ? 'right:0;bottom:5%;font-size:.95em' : 'right:5%;bottom:4%',
        `<div class="l">Total TTC</div><div class="v" style="font-size:1.55em">2 138 974 200 <span style="font-size:.6em;color:#94A3B8">GNF</span></div>`,
        4
      ),
  },
  'sans-montants': {
    kicker: 'Rapport interne ou client',
    title: 'Le même rapport, *avec ou sans montants*.',
    sub: 'Une case à décocher : la version pour le maître d’ouvrage ne montre aucun chiffre financier.',
    chips: ['Budget et coûts masqués', 'Avancement et planning conservés', 'Photos et signatures'],
    stage: (f) =>
      page(pg('hebdo', 1), { x: 28, y: 55, h: 84, r: -4, z: 1 }) +
      page(pg('externe', 1), { x: 72, y: 55, h: 84, r: 4, z: 1 }) +
      pill('left:28%;top:3%;transform:translateX(-50%)', 'Interne', 3) +
      pill('left:72%;top:3%;transform:translateX(-50%)', 'Maître d’ouvrage', 3) +
      floatCard(
        f.land ? 'left:6%;right:6%;bottom:2%;padding:.5em' : 'left:8%;right:8%;bottom:1%;padding:.6em',
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6em">${crop(pg('hebdo', 1), 25.5, 10.5)}${crop(pg('externe', 1), 25.5, 10.5)}</div>`,
        4
      ),
  },
  periodes: {
    kicker: '4 modèles de rapport',
    title: 'Hebdo, mensuel, trimestriel, annuel : *à vous de choisir*.',
    sub: 'Planifié vs réalisé, courbe en S et prévisions de la période suivante, calculés pour vous.',
    chips: ['Planifié vs réalisé', 'Courbe en S', 'Prévisions'],
    stage: (f) =>
      [
        ['hebdo', 'Semaine', 19, -7],
        ['mensuel', 'Mois', 39.5, -2.5],
        ['trimestriel', 'Trimestre', 60.5, 2.5],
        ['annuel', 'Année', 81, 7],
      ]
        .map(
          ([doc, label, x, r], i) =>
            page(pg(doc, 1), { x, y: 46, h: f.land ? 66 : 74, r, z: i + 1 }) +
            pill(`left:${x}%;bottom:${f.land ? 6 : 3}%;transform:translateX(-50%)`, label, 10)
        )
        .join(''),
  },

  // ─── École ──────────────────────────────────────────────────────────────────
  bulletin: {
    sector: 'ecole',
    kicker: 'Bulletins scolaires',
    title: 'Des bulletins *prêts à imprimer*, cachet compris.',
    sub: 'Moyennes, rangs, mentions et appréciations calculés à partir des notes saisies. Toute la classe en un clic.',
    chips: ['Primaire · Collège · Lycée', 'Trimestres ou semestres', 'Logo et cachet'],
    stage: (f) =>
      page(pg('ec-primaire', 1), { x: f.land ? 30 : 32, y: 52, h: 82, r: -7, z: 1 }) +
      page(pg('ec-lycee', 1), { x: f.land ? 64 : 62, y: 49, h: 94, r: 3, z: 2 }) +
      floatCard(
        f.land ? 'left:0;bottom:4%;font-size:.9em' : 'left:6%;bottom:5%',
        `<div class="l">Terminale SM · 1er semestre</div><div class="v" style="font-size:1.7em">17,30 <span style="font-size:.55em;color:#94A3B8">/ 20</span></div><ul><li>Rang<b>1er sur 18</b></li><li>Mention<b>Très bien</b></li></ul>`,
        4
      ),
  },
  recu: {
    sector: 'ecole',
    kicker: 'Paiements de scolarité',
    title: 'Chaque paiement, *un reçu officiel vérifiable*.',
    sub: 'Montant en lettres, situation de la scolarité et QR code d’authenticité. Les impayés sortent en Excel pour les relances.',
    chips: ['Orange Money · MTN MoMo · Espèces', 'QR code de vérification', 'Exports Excel'],
    stage: (f) =>
      page(pg('ec-dir-mois', 1), { x: f.land ? 70 : 68, y: 53, h: 82, r: 6, z: 1 }) +
      page(pg('ec-recu', 1), { x: f.land ? 38 : 38, y: 49, h: 94, r: -3, z: 2 }) +
      floatCard(
        f.land ? 'right:0;top:3%;font-size:.85em' : 'right:5%;top:3%',
        `<div class="l">Encaissé en septembre</div><div class="v" style="font-size:1.45em">157 560 000 <span style="font-size:.6em;color:#94A3B8">GNF</span></div>`,
        4
      ) +
      floatCard(
        f.land ? 'right:0;bottom:4%;font-size:.85em' : 'right:5%;bottom:5%',
        `<div class="l">Export impayés (Excel)</div><ul><li>Élèves à relancer<b>150</b></li><li>Téléphone du tuteur<b>inclus</b></li></ul>`,
        4
      ),
  },
  direction: {
    sector: 'ecole',
    kicker: 'Rapport de direction',
    title: 'Toute l’école *sur une page*, chaque mois.',
    sub: 'Effectifs, encaissements, recouvrement par classe et résultats scolaires, prêts pour le conseil de gestion.',
    chips: ['Mois · Trimestre · Année scolaire', 'Recouvrement par classe', 'PDF présentable'],
    stage: (f) =>
      page(pg('ec-dir-annee', 2), { x: f.land ? 70 : 70, y: 53, h: 80, r: 6, z: 1 }) +
      page(pg('ec-dir-annee', 1), { x: f.land ? 40 : 40, y: 49, h: 94, r: -3, z: 2 }) +
      floatCard(
        f.land ? 'right:0;bottom:4%;font-size:.85em' : 'right:5%;bottom:6%',
        `<div class="l">Année scolaire 2026-2027</div><ul><li>Élèves inscrits<b>192</b></li><li>Classes actives<b>9</b></li><li>Encaissé<b>289,6 M GNF</b></li><li>Bulletins générés<b>145</b></li></ul>`,
        4
      ),
  },

  // ─── ONG ────────────────────────────────────────────────────────────────────
  bailleur: {
    sector: 'ong',
    kicker: 'Rapports bailleurs',
    title: 'Vos rapports bailleurs, *générés depuis le terrain*.',
    sub: 'Enquêtes, bénéficiaires, budget et documents compilés en rapports PDF clairs, prêts à envoyer.',
    chips: ['Enquêtes mobiles', 'Budget & exécution', 'Bénéficiaires'],
    stage: (f) =>
      page(pg('ong-cpn', 1), { x: f.land ? 25 : 26, y: 53, h: 80, r: -8, z: 1 }) +
      page(pg('ong-tdb', 1), { x: f.land ? 75 : 74, y: 51, h: 80, r: 7, z: 2 }) +
      page(pg('ong-general', 1), { x: 50, y: 48, h: 92, z: 3 }) +
      floatCard(
        f.land ? 'left:0;bottom:3%;font-size:.85em' : 'left:4%;bottom:4%',
        `<div class="l">Enquête CPN · Kindia</div><div class="v" style="font-size:1.5em">92 réponses</div><ul><li>4 CPN ou plus<b>55 %</b></li></ul>`,
        5
      ) +
      pill(f.land ? 'right:3%;top:5%' : 'right:8%;top:3%', 'PDF archivé'),
  },
  budget: {
    sector: 'ong',
    kicker: 'Suivi budgétaire',
    title: 'Budget et exécution, *projet par projet*.',
    sub: 'Taux d’exécution, avancement et bénéficiaires de chaque projet, réunis dans un seul document.',
    chips: ['6 projets suivis', 'Taux d’exécution', 'Archive des rapports'],
    stage: (f) =>
      page(pg('ong-tdb', 1), { x: f.land ? 70 : 69, y: 53, h: 82, r: 6, z: 1 }) +
      page(pg('ong-budget', 1), { x: f.land ? 38 : 38, y: 49, h: 94, r: -3, z: 2 }) +
      floatCard(
        f.land ? 'right:0;bottom:4%;font-size:.85em' : 'right:5%;bottom:6%',
        `<div class="l">Santé &amp; Avenir Guinée</div><ul><li>Budget total<b>19,4 Md GNF</b></li><li>Dépensé<b>9,8 Md GNF</b></li><li>Exécution<b>50,5 %</b></li><li>Bénéficiaires<b>30 550</b></li></ul>`,
        4
      ),
  },
  enquetes: {
    sector: 'ong',
    kicker: 'Enquêtes terrain',
    title: 'De la collecte mobile *au rapport d’enquête*.',
    sub: 'Les réponses arrivent des téléphones des enquêteurs, même hors ligne. Le rapport se génère tout seul.',
    chips: ['Hors ligne', 'Doublons détectés', 'Répartition par localité'],
    stage: (f) =>
      page(pg('ong-cpn', 1), { x: 30, y: 53, h: 86, r: -5, z: 1 }) +
      page(pg('ong-satisf', 1), { x: 70, y: 53, h: 86, r: 5, z: 2 }) +
      pill('left:30%;top:2%;transform:translateX(-50%)', 'CPN Kindia · 92', 3) +
      pill('left:70%;top:2%;transform:translateX(-50%)', 'Satisfaction · 126', 3) +
      floatCard(
        'left:50%;bottom:4%;transform:translateX(-50%);text-align:center' + (f.land ? ';font-size:.85em' : ''),
        `<div class="l">Bénéficiaires satisfaits</div><div class="v" style="font-size:1.8em">73 %</div>`,
        4
      ),
  },

  // ─── PME ────────────────────────────────────────────────────────────────────
  analyse: {
    sector: 'pme',
    kicker: 'Analyse financière',
    title: 'Entrées, dépenses, reste : *votre commerce en clair*.',
    sub: 'Ventes, achats et charges regroupés par semaine ou par mois, avec graphiques, prêts à imprimer.',
    chips: ['Mois · Trimestre · Année', 'Par boutique ou global', 'PDF présentable'],
    stage: (f) =>
      lpage(pg('pme-annee', 2), { x: f.land ? 50 : 60, y: landW(f, 45, 43, 30), w: landW(f, 52, 70, 78), r: 4, z: 1 }) +
      lpage(pg('pme-mois', 1), { x: f.land ? 50 : 42, y: landW(f, 63, 64, 70), w: landW(f, 52, 70, 78), r: -3, z: 2 }) +
      floatCard(
        f.land ? 'right:0;top:0;font-size:.8em' : 'right:3%;top:2%;font-size:.9em',
        `<div class="l">Septembre 2026</div><ul><li>Entrées<b>291,9 M GNF</b></li><li>Dépenses<b>232,3 M GNF</b></li><li>Reste<b>59,5 M GNF</b></li></ul>`,
        4
      ),
  },
  boutiques: {
    sector: 'pme',
    kicker: 'Toutes vos périodes',
    title: 'Chaque boutique, *chaque période*, un rapport.',
    sub: 'Le mois, le trimestre ou l’année, boutique par boutique.',
    chips: ['Mois · Trimestre · Année', 'Détail et gros', 'Graphiques inclus'],
    stage: (f) => {
      const w = landW(f, 39, 47, 45);
      const [y1, y2] = landW(f, [31, 74], [27, 73], [29, 71]);
      const [x1, x2] = f.land ? [27, 73] : [29, 71];
      const top = 'right:4%;top:5%';
      return [
        ['pme-mois', 'Mois', x1, y1, -3, top],
        ['pme-trim', 'Trimestre', x2, y1, 3, top],
        ['pme-annee', 'Année', x1, y2, 2],
        ['pme-boutique', 'Boutique Madina', x2, y2, -2],
      ]
        .map(([doc, label, x, y, r, labelPos], i) => lpage(pg(doc, 1), { x, y, w, r, z: i + 1, label, labelPos }))
        .join('');
    },
  },
  annee: {
    sector: 'pme',
    kicker: 'Bilan annuel',
    title: 'Toute l’année *en un tableau*.',
    sub: 'Chaque dépense par catégorie et par mois, le reste mois par mois : le bilan que votre banque vous demande.',
    chips: ['12 mois', 'Dépenses par catégorie', 'En millions de GNF'],
    stage: (f) =>
      lpage(pg('pme-annee', 1), { x: 50, y: f.land ? 42 : 46, w: landW(f, 64, 86, 96), r: -2, z: 2 }) +
      floatCard(
        f.land ? 'right:0;bottom:0;font-size:.8em' : 'right:4%;bottom:2%;font-size:.9em',
        `<div class="l">Année 2026 (janv.–sept.)</div><ul><li>Chiffre d’affaires<b>2,51 Md GNF</b></li><li>Dépenses<b>2,21 Md GNF</b></li><li>Résultat<b>307 M GNF</b></li></ul>`,
        4
      ),
  },
};

function html(v, f) {
  const sector = v.sector ?? 'btp';
  const [a1, a2] = ACCENTS[sector];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}${EXTRA_CSS}
:root{--a1:${a1};--a2:${a2}}</style></head><body>
<div class="cv" style="width:${f.W}px;height:${f.H}px;font-size:${f.B}px">
  ${glows()}
  <div class="abs" style="left:${f.land ? 48 : 64}px;top:${f.land ? 34 : 50}px">${logo(f.land ? 30 : 42)}</div>
  <div class="abs col" style="${f.text};gap:${f.land ? 14 : 18}px">
    ${kicker(v.kicker)}
    <h1 style="font-size:${f.h1}px">${rich(v.title)}</h1>
    <p class="hsub" style="font-size:${f.sub}px">${esc(v.sub)}</p>
    <div style="font-size:${f.land ? 17 : 22}px;margin-top:${f.land ? 4 : 6}px">${chips(v.chips)}</div>
  </div>
  <div class="stage" style="${f.stage}">${v.stage(f)}</div>
  <div class="fbar" style="left:${f.land ? 48 : 64}px;${f.land ? 'width:540px' : `right:64px`};bottom:${f.footY}px;font-size:${f.land ? 19 : 24}px">
    ${foot()}
    <div class="badge" style="font-size:.85em;white-space:nowrap;flex-shrink:0">${icon('gift')}<span>${esc(sector === 'ecole' ? OFFER.ecoles : OFFER.autres)}</span></div>
  </div>
</div></body></html>`;
}

async function main() {
  await prepareBrandAssets();
  const browser = await launchBrowser();
  try {
    const selected = Object.entries(VISUALS).filter(
      ([key, v]) => (!ONLY || ONLY.includes(key)) && (!SECTORS || SECTORS.includes(v.sector ?? 'btp'))
    );
    const docs = new Set(selected.flatMap(([, v]) => [...v.stage(FORMATS.carre).matchAll(/exemples\/([\w-]+)\/page-/g)].map((m) => m[1])));
    for (const key of docs) {
      const src = path.join(EX, PDFS[key]);
      if (!existsSync(src)) throw new Error(`PDF manquant : ${path.relative(ROOT, src)}`);
      await renderPdfPages(browser, src, path.join(PAGES, key), { maxPages: 12, width: 1400 });
    }
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const [key, v] of selected) {
      const outDir = path.join(CAMPAIGN, 'visuels', `exemples-${v.sector ?? 'btp'}`);
      for (const f of Object.values(FORMATS)) {
        await mkdir(path.join(outDir, f.dir), { recursive: true });
        const file = path.join(WORK, `exemple-${key}-${f.dir}.html`);
        await writeFile(file, html(v, f));
        await page.setViewportSize({ width: f.W, height: f.H });
        await page.goto(url(file), { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const out = path.join(outDir, f.dir, `exemple-${key}.png`);
        await page.screenshot({ path: out, clip: { x: 0, y: 0, width: f.W, height: f.H } });
        console.log('✓', path.relative(ROOT, out));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
