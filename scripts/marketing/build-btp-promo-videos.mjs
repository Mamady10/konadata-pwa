#!/usr/bin/env node
/**
 * Vidéos promo BTP : modèles de rapport de chantier et devis avec métré / extrait des matériaux.
 * Réutilise le moteur des vidéos de campagne et les captures des tutoriels BTP
 * (docs/formation/tutoriels/.work/btp-06-rapport-periodique et btp-08-devis-metre).
 *
 * Sorties : docs/marketing/campagne/videos/konadata-btp-rapport|konadata-btp-devis-<format>.mp4 (+ .srt)
 *
 * Prérequis : node scripts/tutorials/build-tutorials.mjs --only=btp-06-rapport-periodique,btp-08-devis-metre
 * Usage : node scripts/marketing/build-btp-promo-videos.mjs [--only=konadata-btp-devis] [--format=9x16]
 */
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { A, SCENES, XF, bulletsAnim, kickerHtml, renderVideos } from './build-campaign-videos.mjs';
import { CTA_SCENE } from './campaign-videos.mjs';
import { ICON_PATHS, ROOT, chips, esc, glows, icon, rich, url } from './campaign-html.mjs';

const TUTO_WORK = path.join(ROOT, 'docs', 'formation', 'tutoriels', '.work');

function shot(tutorial, file) {
  const p = path.join(TUTO_WORK, tutorial, 'shots', file);
  if (!existsSync(p)) throw new Error(`Capture manquante : ${p} (relancer le tutoriel ${tutorial})`);
  return url(p);
}

function pdfPage(tutorial, n) {
  const dir = readdirSync(path.join(TUTO_WORK, tutorial)).find((d) => d.startsWith('pages-'));
  if (!dir) throw new Error(`Pages PDF manquantes pour ${tutorial}`);
  return url(path.join(TUTO_WORK, tutorial, dir, `page-${String(n).padStart(2, '0')}.jpg`));
}

Object.assign(ICON_PATHS, {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  eyeoff:
    '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  tag: '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41Z"/><circle cx="7" cy="7" r="1.5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
});

const PROMO_CSS = `
@keyframes focus{from{transform:scale(1)}to{transform:scale(var(--z))}}
.feat{display:flex;flex-direction:column;gap:.45em;padding:1em 1.1em;border-radius:1em;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.14)}
.feat svg{width:1.7em;height:1.7em;padding:.32em;border-radius:.5em;background:linear-gradient(135deg,var(--a1),var(--a2));color:#0A192F;stroke-width:2.4}
.feat b{font-size:1.02em;line-height:1.2}
.feat p{color:#CBD5E1;font-weight:500;font-size:.72em;line-height:1.35}
`;

// ------------------------------------------------------------ nouvelles scènes

/**
 * Écran d'ordinateur montrant une ou plusieurs captures successives, avec zoom sur la zone utile.
 * shots : [{ img, at: fraction de la scène, focus: [x%, y%, zoom], zoomAt: s après apparition }]
 */
function sceneScreen(sc, s, d, f) {
  const V = f.V;
  const layers = sc.shots
    .map((sh, i) => {
      const t0 = s + (sh.at ?? 0) * d;
      const fade = i ? `animation:${A('fade', t0, 0.45, 'linear')}` : '';
      const zoom = sh.focus
        ? `transform-origin:${sh.focus[0]}% ${sh.focus[1]}%;--z:${sh.focus[2]};animation:${A('focus', t0 + (sh.zoomAt ?? 0.9), sh.zoomDur ?? 1.8)}`
        : '';
      return `<div class="abs" style="inset:0;${fade}"><img src="${sh.img}" style="${zoom}"></div>`;
    })
    .join('');
  const lw = V ? 1000 : 1060;
  const screen = `<div class="laptop" style="width:${lw}px"><div class="lid"><div class="cam"></div><div class="screen" style="position:relative;aspect-ratio:16/9">${layers}</div></div><div class="base"></div></div>`;
  const step = sc.bulletStep ?? 0.45;
  if (V) {
    return `${glows()}
      <div class="abs col" style="left:80px;right:80px;top:170px;gap:30px;font-size:40px">
        <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
        <h1 style="font-size:88px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      </div>
      <div class="abs" style="left:40px;top:640px;animation:${A('rise', s + 0.3, 0.9)}">${screen}</div>
      <div class="abs" style="left:80px;right:80px;top:1320px;font-size:44px">${bulletsAnim(sc.bullets, s, 1.1, step)}</div>`;
  }
  return `${glows()}
    <div class="abs col" style="left:100px;top:0;bottom:130px;width:680px;justify-content:center;gap:34px;font-size:34px">
      <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
      <h1 style="font-size:70px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      ${bulletsAnim(sc.bullets, s, 1.1, step)}
    </div>
    <div class="abs" style="left:810px;top:200px;animation:${A('rise', s + 0.3, 0.9)}">${screen}</div>`;
}

/** Pages de PDF déployées en éventail. pages : [url], tags : pastilles affichées sous le titre. */
function scenePages(sc, s, d, f) {
  const V = f.V;
  const n = sc.pages.length;
  const pw = V ? 440 : 390;
  const spread = V ? 160 : 215;
  const cx = V ? 540 : 1340;
  const top = V ? 700 : 190;
  const pages = sc.pages
    .map((img, i) => {
      const k = i - (n - 1) / 2;
      return `<div class="abs" style="left:${cx - pw / 2 + k * spread}px;top:${top + Math.abs(k) * 28}px;z-index:${i + 1};animation:${A('rise', s + 0.35 + i * 0.28, 0.9)}"><div style="transform:rotate(${k * 5}deg)"><div class="card-img" style="width:${pw}px"><img src="${img}"></div></div></div>`;
    })
    .join('');
  const group = `<div class="abs" style="inset:0;animation:${A('zoom', s - XF, d + XF, 'linear')}">${pages}</div>`;
  if (V) {
    return `${glows()}
      <div class="abs col" style="left:80px;right:80px;top:170px;gap:30px;font-size:40px">
        <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
        <h1 style="font-size:88px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      </div>
      ${group}
      <div class="abs" style="left:80px;right:80px;top:1440px;font-size:44px;animation:${A('up', s + 1.4, 0.7)}">${chips(sc.tags)}</div>`;
  }
  return `${glows()}
    <div class="abs col" style="left:100px;top:0;bottom:130px;width:700px;justify-content:center;gap:36px;font-size:34px">
      <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
      <h1 style="font-size:72px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      <div style="font-size:40px;animation:${A('up', s + 1.4, 0.7)}">${chips(sc.tags)}</div>
    </div>
    ${group}`;
}

/** Grille d'atouts : items [{ icon, title, text }]. */
function sceneFeatures(sc, s, d, f) {
  const V = f.V;
  const cards = sc.items
    .map(
      (it, i) =>
        `<div class="feat" style="animation:${A('pop', s + 0.45 + i * 0.3, 0.7)}">${icon(it.icon)}<b>${esc(it.title)}</b><p>${esc(it.text)}</p></div>`
    )
    .join('');
  return `${glows()}
    <div class="abs col" style="${V ? 'left:80px;right:80px;top:380px' : 'left:120px;right:120px;top:150px'};gap:${V ? 80 : 60}px">
      <div class="col" style="gap:30px;font-size:${V ? 40 : 34}px">
        <div style="animation:${A('up', s + 0.1, 0.7)}">${kickerHtml(sc.kicker)}</div>
        <h1 style="font-size:${V ? 92 : 80}px;animation:${A('up', s + 0.25, 0.8)}">${rich(sc.title)}</h1>
      </div>
      <div style="display:grid;grid-template-columns:${V ? '1fr 1fr' : 'repeat(4,1fr)'};gap:${V ? 30 : 28}px;font-size:${V ? 44 : 38}px">${cards}</div>
    </div>`;
}

Object.assign(SCENES, { screen: sceneScreen, pages: scenePages, features: sceneFeatures });

// ------------------------------------------------------------------ vidéos
const OFFER = {
  type: 'offer',
  big: '*6 mois* gratuits',
  note: 'Pour les entreprises du BTP',
  say: 'Offre de lancement : six mois gratuits pour les entreprises du BTP.',
  caption: 'Offre de lancement : 6 mois gratuits pour les entreprises du BTP.',
};

const REPORT = 'btp-06-rapport-periodique';
const QUOTE = 'btp-08-devis-metre';

export const PROMO_VIDEOS = [
  {
    id: 'konadata-btp-rapport',
    accent: 'btp',
    scenes: [
      {
        type: 'hook',
        photo: 'photo-btp.png',
        kicker: 'Rapport de chantier',
        title: 'Votre rapport au maître d’ouvrage, *en 1 clic*.',
        say: 'Et si votre rapport de chantier se faisait en un clic ?',
        caption: 'Et si votre rapport de chantier se faisait en 1 clic ?',
      },
      {
        type: 'screen',
        kicker: 'Compilation automatique',
        title: 'Vos données du terrain, *déjà rassemblées*',
        bullets: ['Fiches journalières', 'Carburant et bons de livraison', 'Photos du chantier'],
        shots: [
          { img: shot(REPORT, '009-after.jpg'), focus: [24, 30, 1.3], zoomAt: 0.8 },
          { img: shot(REPORT, '010-before.jpg'), at: 0.62, focus: [34, 50, 1.45], zoomAt: 0.3, zoomDur: 1.2 },
        ],
        say: 'Choisissez le chantier et la période. Kona Data rassemble les fiches journalières, le carburant, les bons de livraison et les photos du chantier.',
        caption:
          'Choisissez le chantier et la période : KonaData rassemble fiches journalières, carburant, bons de livraison et photos.',
      },
      {
        type: 'pages',
        kicker: 'Modèle de rapport',
        title: 'Un rapport *professionnel*, prêt à envoyer',
        pages: [pdfPage(REPORT, 2), pdfPage(REPORT, 5), pdfPage(REPORT, 6), pdfPage(REPORT, 1)],
        tags: ['Planifié vs réalisé', 'Courbe en S', 'Photos datées', 'Visa du maître d’ouvrage'],
        say: 'Vous obtenez un rapport complet : planifié contre réalisé, courbe d’avancement, photos datées, et visa du maître d’ouvrage.',
        caption: 'Un rapport complet : planifié vs réalisé, courbe d’avancement, photos datées et visa du maître d’ouvrage.',
      },
      {
        type: 'features',
        kicker: 'Un modèle, tous vos besoins',
        title: 'Adapté à *chaque destinataire*',
        items: [
          { icon: 'calendar', title: 'Toutes les périodes', text: 'Semaine, mois, trimestre ou année' },
          { icon: 'eyeoff', title: 'Avec ou sans montants', text: 'Une version pour l’extérieur, sans chiffres' },
          { icon: 'file', title: 'PDF et PowerPoint', text: 'Pour l’envoi ou la réunion de chantier' },
          { icon: 'image', title: 'À votre image', text: 'Votre logo, vos photos, votre commentaire' },
        ],
        say: 'Semaine, mois, trimestre ou année. Avec ou sans montants. En PDF ou en PowerPoint, à votre logo.',
        caption: 'Semaine, mois, trimestre ou année. Avec ou sans montants. En PDF ou PowerPoint, à votre logo.',
      },
      OFFER,
      CTA_SCENE,
    ],
  },
  {
    id: 'konadata-btp-devis',
    accent: 'btp',
    scenes: [
      {
        type: 'hook',
        photoUrl: url(path.join(ROOT, 'scripts', 'tutorials', 'seed', 'assets', 'btp', 'Elevation_murs_agglos_R+3.jpg')),
        pos: ['70% 40%', '60% 40%'],
        kicker: 'Devis BTP',
        title: 'Ciment, fer, agglos : *calculés pour vous*.',
        say: 'Combien de sacs de ciment, de barres de fer et d’agglos pour ce devis ? Kona Data fait le calcul.',
        caption: 'Combien de sacs de ciment, de barres de fer et d’agglos ? KonaData fait le calcul.',
      },
      {
        type: 'screen',
        kicker: 'Métré',
        title: 'Saisissez les *dimensions* des ouvrages',
        bullets: ['Poteaux, poutres, dalles, murs', 'Dosages et aciers ajustables', 'Pertes incluses'],
        shots: [
          { img: shot(QUOTE, '005-filled.jpg'), focus: [30, 40, 1.3], zoomAt: 0.8 },
          { img: shot(QUOTE, '013-filled.jpg'), at: 0.5, focus: [25, 85, 1.45], zoomAt: 0.3, zoomDur: 1.4 },
        ],
        say: 'Dans le devis, saisissez les dimensions : poteaux, poutres, dalles ou murs. L’extrait des matériaux se calcule tout seul, pertes incluses.',
        caption: 'Saisissez les dimensions : poteaux, poutres, dalles ou murs. L’extrait des matériaux se calcule tout seul, pertes incluses.',
      },
      {
        type: 'screen',
        kicker: 'Extrait des matériaux',
        title: 'Reporté et *chiffré* en un clic',
        bullets: ['Prix de votre catalogue', 'Sous-totaux par lot', 'Montant en lettres'],
        shots: [{ img: shot(QUOTE, '017-scroll.jpg'), focus: [36, 38, 1.35], zoomAt: 0.9 }],
        say: 'D’un clic, l’extrait est reporté dans le lot et chiffré avec les prix de votre catalogue.',
        caption: 'D’un clic, l’extrait est reporté dans le lot et chiffré avec les prix de votre catalogue.',
      },
      {
        type: 'features',
        kicker: 'Devis détaillé',
        title: 'Tout ce qu’il faut pour *remporter le marché*',
        items: [
          { icon: 'layers', title: 'Lots détaillés', text: 'Matériaux, matériels, main-d’œuvre, suivi' },
          { icon: 'tag', title: 'Catalogue de prix', text: 'Vos prix, réutilisés à chaque devis' },
          { icon: 'pen', title: 'TVA et montant en lettres', text: 'Arrêté du devis automatique' },
          { icon: 'history', title: 'Versions et suivi', text: 'Envoyé, accepté, nouvelle version' },
        ],
        say: 'Lots détaillés, catalogue de prix, TVA, montant en lettres, versions et suivi du devis.',
        caption: 'Lots détaillés, catalogue de prix, TVA, montant en lettres, versions et suivi.',
      },
      {
        type: 'pages',
        kicker: 'Devis PDF',
        title: 'Un devis *prêt à signer*',
        pages: [pdfPage(QUOTE, 2), pdfPage(QUOTE, 3), pdfPage(QUOTE, 1)],
        tags: ['À votre logo', 'Récapitulatif', 'Bon pour accord'],
        say: 'Le devis PDF, à votre logo, est prêt à envoyer à votre client.',
        caption: 'Le devis PDF, à votre logo, est prêt à envoyer à votre client.',
      },
      OFFER,
      CTA_SCENE,
    ],
  },
];

renderVideos(PROMO_VIDEOS, { css: PROMO_CSS }).then(
  () => process.exit(0),
  (e) => {
    console.error('❌', e);
    process.exit(1);
  }
);
