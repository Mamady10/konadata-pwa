// Génère l'argumentaire commercial KonaData (.docx) :
//  - Pitchs pour convaincre les futurs utilisateurs
//  - Classement / liste des avantages par type d'utilisateur et par secteur
//  - Estimation financière des avantages (ROI) par secteur
//
// Les estimations financières sont ILLUSTRATIVES (hypothèses explicites) et
// personnalisables par prospect.
//
// Usage : node scripts/generate-argumentaire-commercial-docx.mjs

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  PageBreak,
  Footer,
  Header,
} from 'docx';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ── Palette ────────────────────────────────────────────────
const NAVY = '0A192F';
const BLUE = '2563EB';
const SLATE = '475569';
const GREEN = '059669';
const LIGHT = 'F1F5F9';
const SECTORS = {
  school: { color: '2563EB', light: 'EAF1FF' },
  ngo: { color: '059669', light: 'E7F6F0' },
  btp: { color: 'D97706', light: 'FEF3E2' },
  pme: { color: '7C3AED', light: 'F3EBFF' },
};

// ── Helpers texte ──────────────────────────────────────────
const run = (text, opts = {}) =>
  new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
    size: opts.size, // demi-points
    font: 'Calibri',
  });

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    children: Array.isArray(text) ? text : [run(text, opts)],
  });

const h1 = (text, color = NAVY) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [run(text, { bold: true, color, size: 30 })],
  });

const h2 = (text, color = BLUE) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [run(text, { bold: true, color, size: 26 })],
  });

const h3 = (text, color = SLATE) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [run(text, { bold: true, color, size: 23 })],
  });

const bullet = (text, opts = {}) =>
  new Paragraph({
    bullet: { level: opts.level ?? 0 },
    spacing: { after: 60, line: 268 },
    children: Array.isArray(text) ? text : [run(text, opts)],
  });

// Bloc « pitch » encadré et ombré
const pitchBlock = (label, text, accent = BLUE, light = LIGHT) => [
  new Paragraph({
    spacing: { before: 120, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: light },
    border: {
      top: { style: BorderStyle.SINGLE, size: 2, color: accent },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 18, color: accent },
      right: { style: BorderStyle.SINGLE, size: 2, color: accent },
    },
    children: [run(label, { bold: true, color: accent, size: 20 })],
  }),
  new Paragraph({
    spacing: { before: 40, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: light },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: accent },
      left: { style: BorderStyle.SINGLE, size: 18, color: accent },
      right: { style: BorderStyle.SINGLE, size: 2, color: accent },
    },
    children: [run(text, { italics: true, color: '1E293B', size: 22 })],
  }),
];

// ── Helpers tableau ────────────────────────────────────────
const cell = (content, opts = {}) => {
  const children = Array.isArray(content)
    ? content
    : [
        new Paragraph({
          alignment: opts.align,
          spacing: { after: 0, line: 252 },
          children: [
            run(String(content), {
              bold: opts.bold,
              color: opts.color,
              size: opts.size ?? 19,
            }),
          ],
        }),
      ];
  return new TableCell({
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    verticalAlign: 'center',
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children,
  });
};

const table = (headers, rows, opts = {}) => {
  const headColor = opts.headColor ?? NAVY;
  const widths = opts.widths ?? [];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((hdr, i) =>
      cell(hdr, {
        bold: true,
        color: 'FFFFFF',
        fill: headColor,
        align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
        width: widths[i],
        size: 19,
      })
    ),
  });
  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((c, i) => {
        const isTotal = opts.totalRow && ri === rows.length - 1;
        return cell(c, {
          align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          fill: isTotal ? LIGHT : ri % 2 === 1 ? 'F8FAFC' : undefined,
          bold: isTotal || i === 0,
          width: widths[i],
          color: isTotal && i === r.length - 1 ? GREEN : undefined,
        });
      }),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    },
    rows: [headerRow, ...bodyRows],
  });
};

const spacer = (h = 80) => new Paragraph({ spacing: { after: h }, children: [] });

// ═══════════════════════════════════════════════════════════
// CONTENU
// ═══════════════════════════════════════════════════════════
const children = [];

// ── Couverture ─────────────────────────────────────────────
children.push(
  new Paragraph({ spacing: { before: 1400 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [run('KonaData', { bold: true, color: NAVY, size: 64 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      run('La plateforme intelligente de gestion de données', {
        color: BLUE,
        size: 26,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [
      run('Argumentaire commercial & avantages par secteur', {
        bold: true,
        color: '1E293B',
        size: 32,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
    children: [
      run('Pitchs · Bénéfices par utilisateur · Estimation financière (ROI)', {
        color: SLATE,
        size: 22,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      run('Établissements · ONG · BTP & Industrie · PME & Commerce', {
        color: SLATE,
        size: 20,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200 },
    children: [
      run('www.konadatagn.com  ·  contact@konadatagn.com', {
        color: SLATE,
        size: 18,
      }),
    ],
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// ── 1. Pitch global ────────────────────────────────────────
children.push(h1('1. KonaData en bref'));
children.push(
  p(
    "KonaData est une plateforme (application web et mobile) qui aide les organisations guinéennes à collecter, organiser et exploiter leurs données du quotidien. Une seule plateforme, quatre métiers : établissements scolaires, ONG, entreprises BTP et PME/commerces. Pensée pour le terrain : elle fonctionne même en connexion mobile faible et s'installe comme une application sur téléphone."
  )
);

children.push(...pitchBlock(
  'Pitch 30 secondes (accroche universelle)',
  "« Aujourd'hui, vos informations les plus importantes vivent sur des cahiers, des tableurs dispersés et dans la tête de vos collaborateurs. KonaData les rassemble dans un seul espace sécurisé : vous saisissez une fois, et vous obtenez automatiquement vos rapports, vos documents officiels et vos indicateurs — accessibles où que vous soyez, même avec une connexion faible. Vous gagnez du temps, vous réduisez les pertes d'argent, et vous décidez sur des chiffres fiables. »",
  BLUE
));

children.push(...pitchBlock(
  'Pitch 2 minutes (démonstration de valeur)',
  "« Chaque organisation perd de l'argent sans le voir : impayés oubliés, carburant non suivi, stock qui disparaît, rapports en retard qui bloquent un financement. Le problème n'est pas le manque de travail — c'est le manque d'information fiable au bon moment. KonaData règle ça. La direction voit tout en temps réel ; chaque collaborateur ne voit que son périmètre ; les rapports et documents se génèrent automatiquement grâce à l'IA ; et les notifications partent directement sur WhatsApp. En quelques jours, vous remplacez des dizaines de cahiers et de fichiers Excel par une plateforme unique, sécurisée et sauvegardée. Le retour sur investissement se mesure dès le premier trimestre. »",
  BLUE
));

children.push(spacer());
children.push(
  p([
    run('Les 4 promesses KonaData : ', { bold: true, color: NAVY, size: 22 }),
  ])
);
children.push(bullet([run('Gagner du temps', { bold: true }), run(' — saisie unique, rapports et documents automatiques (IA).')]));
children.push(bullet([run('Arrêter les pertes d\u2019argent', { bold: true }), run(' — impayés, carburant, stock et dépenses sous contrôle.')]));
children.push(bullet([run('Décider sur des données fiables', { bold: true }), run(' — tableaux de bord en temps réel, sans chiffres fictifs.')]));
children.push(bullet([run('Rassurer et professionnaliser', { bold: true }), run(' — données sécurisées, sauvegardées, image moderne vis-à-vis des partenaires et bailleurs.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 2. Classement des utilisateurs ────────────────────────
children.push(h1('2. À qui s\u2019adresse KonaData ? (classement des utilisateurs)'));
children.push(
  p(
    "On distingue trois familles d'utilisateurs : le DÉCIDEUR (celui qui signe et paie), les UTILISATEURS QUOTIDIENS (les équipes qui saisissent), et les BÉNÉFICIAIRES (ceux qui reçoivent le service, souvent sans compte)."
  )
);
children.push(
  table(
    ['Secteur', 'Décideur (signe)', 'Utilisateurs quotidiens', 'Bénéficiaires finaux'],
    [
      ['Établissement', 'Fondateur / Directeur', 'Scolarité, comptable, enseignants', 'Parents & élèves'],
      ['ONG', 'Directeur / Coordinateur', 'Chargés de projet, agents terrain', 'Bénéficiaires & bailleurs'],
      ['BTP', 'Directeur / DG', 'Chefs de chantier, magasiniers', 'Maîtres d\u2019ouvrage (MOA)'],
      ['PME', 'Gérant / Propriétaire', 'Vendeurs, comptable', 'Clients & fournisseurs'],
    ],
    { widths: [16, 24, 34, 26], headColor: NAVY }
  )
);

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 3. ARGUMENTAIRES PAR SECTEUR ──────────────────────────
children.push(h1('3. Argumentaires détaillés par secteur'));

// ---------- 3.1 ÉCOLE ----------
const sc = SECTORS.school;
children.push(h2('3.1  Établissements scolaires', sc.color));
children.push(...pitchBlock(
  'Speech directeur d\u2019établissement',
  "« Directeur, combien d'heures votre équipe passe-t-elle chaque trimestre à recopier des notes, calculer des moyennes et éditer des bulletins ? Et combien de frais de scolarité restent impayés faute de relance ? Avec KonaData, les enseignants saisissent les notes une fois, les bulletins se génèrent en PDF, les paiements sont suivis élève par élève, et les parents reçoivent un rappel automatique sur WhatsApp. Vous récupérez du temps, vous récupérez de l'argent, et vous donnez à votre école une image moderne et sérieuse. »",
  sc.color, sc.light
));

children.push(h3('Avantages par utilisateur', sc.color));
children.push(bullet([run('Direction : ', { bold: true }), run('vision temps réel des inscriptions, des finances et des résultats ; bulletins et rapports officiels en un clic ; gestion des rôles et des accès.')]));
children.push(bullet([run('Scolarité : ', { bold: true }), run('candidatures, inscriptions et import d\u2019élèves (CSV/IA) sans ressaisie ; dossiers centralisés.')]));
children.push(bullet([run('Comptable : ', { bold: true }), run('encaissements, échéanciers, impayés et reçus ; export comptable ; paiement Orange Money intégré.')]));
children.push(bullet([run('Enseignants : ', { bold: true }), run('saisie des notes par classe/matière assignée ; calcul automatique des moyennes ; plus de calculs manuels.')]));
children.push(bullet([run('Parents & élèves : ', { bold: true }), run('suivi de la scolarité et paiement en ligne sans créer de compte (matricule + téléphone) ; notifications WhatsApp.')]));

children.push(h3('Estimation financière des avantages', sc.color));
children.push(p([run('Hypothèse : ', { bold: true }), run('école de 300 élèves, scolarité moyenne 1 500 000 GNF/an (CA scolarité ≈ 450 M GNF). Coût plateforme ≈ 16 M GNF/an. Estimations illustratives.')], { size: 19 }));
children.push(
  table(
    ['Levier d\u2019économie / gain', 'Hypothèse', 'Gain estimé / an'],
    [
      ['Recouvrement des impayés', 'Rappels WhatsApp auto : -40 % d\u2019impayés (sur ~12 % de 450 M)', '≈ 21 600 000 GNF'],
      ['Temps administratif', 'Bulletins, moyennes, reçus automatisés (~2 postes partiels)', '≈ 9 000 000 GNF'],
      ['Économies papier & impressions', 'Bulletins, reçus, listes, cahiers de notes', '≈ 3 000 000 GNF'],
      ['Fraude & erreurs de caisse évitées', 'Traçabilité des encaissements', '≈ 5 000 000 GNF'],
      ['Total avantages estimés', '', '≈ 38 600 000 GNF'],
    ],
    { widths: [40, 40, 20], headColor: sc.color, totalRow: true }
  )
);
children.push(p([run('Bilan : ', { bold: true, color: GREEN }), run('pour ~16 M GNF investis, ~38 M GNF de valeur créée — un retour d\u2019environ ', { }), run('2,4×', { bold: true }), run(' dès la première année.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- 3.2 ONG ----------
const on = SECTORS.ngo;
children.push(h2('3.2  ONG & Associations', on.color));
children.push(...pitchBlock(
  'Speech directeur d\u2019ONG',
  "« Vos bailleurs exigent des données fiables et des rapports à temps — c'est ce qui débloque vos financements. Aujourd'hui, la collecte se fait sur papier, la ressaisie prend des jours et les erreurs vous coûtent en crédibilité. Avec KonaData, vos agents collectent sur mobile (même hors-ligne), les données remontent automatiquement, la cartographie et les analyses sont instantanées, et vous compilez un rapport bailleur professionnel en quelques minutes. Vous sécurisez vos financements actuels et vous en gagnez de nouveaux. »",
  on.color, on.light
));

children.push(h3('Avantages par utilisateur', on.color));
children.push(bullet([run('Direction / Coordination : ', { bold: true }), run('pilotage des projets, registre des bénéficiaires, cartographie, rapports bailleurs prêts à envoyer.')]));
children.push(bullet([run('Chargés de projet : ', { bold: true }), run('suivi des activités et des indicateurs des projets qui leur sont assignés.')]));
children.push(bullet([run('Agents terrain : ', { bold: true }), run('collecte via sondages QR / lien public, fonctionne en zone à faible réseau, envoi à la reconnexion.')]));
children.push(bullet([run('Bailleurs (bénéficiaires) : ', { bold: true }), run('rapports fiables, traçables et cartographiés qui renforcent la confiance.')]));
children.push(p([run('À noter : ', { bold: true }), run('option « sondage seul » sans abonnement complet — porte d\u2019entrée à faible coût.')], { size: 19 }));

children.push(h3('Estimation financière des avantages', on.color));
children.push(p([run('Hypothèse : ', { bold: true }), run('ONG gérant ~1 Md GNF de programmes/an, plusieurs enquêtes terrain. Coût plateforme ≈ 6 M GNF/an. Estimations illustratives.')], { size: 19 }));
children.push(
  table(
    ['Levier d\u2019économie / gain', 'Hypothèse', 'Gain estimé / an'],
    [
      ['Collecte digitale vs papier', 'Moins d\u2019impression, logistique et ressaisie', '≈ 15 000 000 GNF'],
      ['Rapports bailleurs à temps', 'Éviter retards → déblocage des tranches', '≈ 20 000 000 GNF'],
      ['Fiabilité des données', 'Moins d\u2019erreurs → crédibilité & renouvellement', '≈ 10 000 000 GNF'],
      ['Total avantages estimés', '', '≈ 45 000 000 GNF'],
    ],
    { widths: [40, 40, 20], headColor: on.color, totalRow: true }
  )
);
children.push(p([run('Bilan : ', { bold: true, color: GREEN }), run('un retour de l\u2019ordre de ', {}), run('7×', { bold: true }), run(' — sans compter la valeur stratégique d\u2019un financement sécurisé.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- 3.3 BTP ----------
const bt = SECTORS.btp;
children.push(h2('3.3  BTP & Industrie', bt.color));
children.push(...pitchBlock(
  'Speech directeur BTP',
  "« Sur un chantier, l'argent fuit là où on ne regarde pas : le carburant des engins, les matériaux qui disparaissent, les écarts entre le budget et le réel. Avec KonaData, chaque chef de chantier saisit l'avancement, le carburant et les bons de livraison depuis son téléphone. Vous comparez en temps réel le planifié et le réel, poste par poste, et vous recevez un rapport hebdomadaire prêt pour le maître d'ouvrage. Vous reprenez le contrôle de vos coûts — et une réduction de 10 % sur le carburant paie déjà l'abonnement plusieurs fois. »",
  bt.color, bt.light
));

children.push(h3('Avantages par utilisateur', bt.color));
children.push(bullet([run('Direction : ', { bold: true }), run('chantiers, budgets et planning ; finances budget vs réel par poste ; personnel et salaires ; rapports MOA.')]));
children.push(bullet([run('Chefs de chantier : ', { bold: true }), run('relevés d\u2019avancement quotidiens, bons de livraison, carburant et documents depuis le terrain (assignation par chantier).')]));
children.push(bullet([run('Magasiniers : ', { bold: true }), run('entrées/sorties de stock et matériels tracés.')]));
children.push(bullet([run('Maîtres d\u2019ouvrage (bénéficiaires) : ', { bold: true }), run('rapports d\u2019avancement clairs et réguliers, gage de sérieux.')]));

children.push(h3('Estimation financière des avantages', bt.color));
children.push(p([run('Hypothèse : ', { bold: true }), run('portefeuille de chantiers ~2 Md GNF/an, budget carburant ~120 M, matériaux ~200 M. Coût plateforme ≈ 3,6 M GNF/an. Estimations illustratives.')], { size: 19 }));
children.push(
  table(
    ['Levier d\u2019économie / gain', 'Hypothèse', 'Gain estimé / an'],
    [
      ['Contrôle du carburant', 'Suivi engins : -12 % de gaspillage/détournement', '≈ 14 400 000 GNF'],
      ['Réduction des pertes de matériaux', '-5 % sur stock via BL et traçabilité', '≈ 10 000 000 GNF'],
      ['Maîtrise des dépassements budget', '-1 % via suivi planifié vs réel', '≈ 20 000 000 GNF'],
      ['Total avantages estimés', '', '≈ 44 400 000 GNF'],
    ],
    { widths: [40, 40, 20], headColor: bt.color, totalRow: true }
  )
);
children.push(p([run('Bilan : ', { bold: true, color: GREEN }), run('un retour supérieur à ', {}), run('12×', { bold: true }), run(' — le contrôle du carburant seul rembourse l\u2019abonnement.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- 3.4 PME ----------
const pm = SECTORS.pme;
children.push(h2('3.4  PME & Commerce', pm.color));
children.push(...pitchBlock(
  'Speech gérant de commerce',
  "« Vous vendez tous les jours, mais savez-vous exactement ce qui vous reste comme marge, quel produit part le plus, et combien vos clients vous doivent ? Avec KonaData, vous enregistrez vos ventes et vos achats, votre stock se met à jour tout seul avec des alertes de rupture, et vous voyez votre chiffre d'affaires et vos marges en temps réel — boutique par boutique si vous en avez plusieurs. Vous arrêtez les fuites (démarque, erreurs de caisse, créances oubliées) et vous pilotez enfin votre commerce sur des chiffres. »",
  pm.color, pm.light
));

children.push(h3('Avantages par utilisateur', pm.color));
children.push(bullet([run('Gérant / Propriétaire : ', { bold: true }), run('ventes, achats, dépenses, marges et rapports ; gestion multi-boutiques et comparatif entre boutiques ; assignation des gérants.')]));
children.push(bullet([run('Vendeurs : ', { bold: true }), run('enregistrement des ventes, fichier clients et suivi du stock de leur boutique.')]));
children.push(bullet([run('Comptable : ', { bold: true }), run('dépenses, dettes/créances et export.')]));
children.push(bullet([run('Clients & fournisseurs (bénéficiaires) : ', { bold: true }), run('suivi des comptes, reçus et relations professionnalisés.')]));

children.push(h3('Estimation financière des avantages', pm.color));
children.push(p([run('Hypothèse : ', { bold: true }), run('commerce avec CA ~1,2 Md GNF/an, coût marchandises ~800 M. Coût plateforme ≈ 2,4 M GNF/an. Estimations illustratives.')], { size: 19 }));
children.push(
  table(
    ['Levier d\u2019économie / gain', 'Hypothèse', 'Gain estimé / an'],
    [
      ['Réduction de la démarque/pertes stock', '-2 % sur coût marchandises', '≈ 16 000 000 GNF'],
      ['Recouvrement des créances clients', 'Suivi des dettes clients', '≈ 5 000 000 GNF'],
      ['Erreurs de caisse & meilleures décisions', 'Traçabilité + pilotage des marges', '≈ 5 000 000 GNF'],
      ['Total avantages estimés', '', '≈ 26 000 000 GNF'],
    ],
    { widths: [40, 40, 20], headColor: pm.color, totalRow: true }
  )
);
children.push(p([run('Bilan : ', { bold: true, color: GREEN }), run('un retour d\u2019environ ', {}), run('10×', { bold: true }), run(' — la seule réduction de la démarque finance largement l\u2019outil.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 4. Avantages transversaux ─────────────────────────────
children.push(h1('4. Avantages communs à tous les secteurs'));
children.push(bullet([run('Une seule plateforme : ', { bold: true }), run('fini les cahiers et les fichiers Excel dispersés — tout est centralisé et sauvegardé.')]));
children.push(bullet([run('IA intégrée : ', { bold: true }), run('extraction de documents (OCR), rapports automatiques, assistant d\u2019analyse sur vos données.')]));
children.push(bullet([run('Rôles & confidentialité : ', { bold: true }), run('chaque collaborateur ne voit que son périmètre ; la direction voit tout.')]));
children.push(bullet([run('Fonctionne sur le terrain : ', { bold: true }), run('application installable (PWA), cache 3G/4G, envoi des données à la reconnexion.')]));
children.push(bullet([run('Notifications WhatsApp : ', { bold: true }), run('rappels et confirmations via le canal le plus utilisé en Guinée.')]));
children.push(bullet([run('Sécurité & isolation : ', { bold: true }), run('données de chaque organisation isolées (PostgreSQL + Row Level Security), hébergement cloud.')]));

children.push(spacer());

// ── 5. Synthèse financière comparée ───────────────────────
children.push(h1('5. Synthèse financière comparée (ROI par secteur)'));
children.push(p('Vue d\u2019ensemble des estimations ci-dessus. Chiffres illustratifs à adapter à chaque prospect.', { size: 19 }));
children.push(
  table(
    ['Secteur', 'Coût KonaData / an', 'Avantages estimés / an', 'Retour (ROI)'],
    [
      ['Établissement (300 él.)', '≈ 16 000 000 GNF', '≈ 38 600 000 GNF', '≈ 2,4×'],
      ['ONG (~1 Md programmes)', '≈ 6 000 000 GNF', '≈ 45 000 000 GNF', '≈ 7×'],
      ['BTP (~2 Md chantiers)', '≈ 3 600 000 GNF', '≈ 44 400 000 GNF', '≈ 12×'],
      ['PME (~1,2 Md CA)', '≈ 2 400 000 GNF', '≈ 26 000 000 GNF', '≈ 10×'],
    ],
    { widths: [30, 24, 26, 20], headColor: NAVY }
  )
);
children.push(spacer());
children.push(p([run('Message clé : ', { bold: true, color: NAVY }), run('quel que soit le secteur, KonaData se rembourse plusieurs fois dès la première année. L\u2019abonnement n\u2019est pas une dépense, c\u2019est un investissement rentable.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 6. Objections & réponses ──────────────────────────────
children.push(h1('6. Objections fréquentes & réponses'));
const objections = [
  ['« C\u2019est trop cher. »', 'Comparé à ce que vous perdez (impayés, carburant, stock) et au temps gagné, l\u2019outil se rembourse dès le premier trimestre. Voir le ROI par secteur.'],
  ['« Mon équipe n\u2019est pas à l\u2019aise avec l\u2019informatique. »', 'L\u2019interface est simple, en français, pensée pour le mobile. Formation et accompagnement inclus ; guides et vidéos fournis.'],
  ['« On a une mauvaise connexion. »', 'KonaData fonctionne en mode hors-ligne (PWA) et synchronise à la reconnexion. Conçue pour les réseaux mobiles guinéens.'],
  ['« Nos données sont-elles en sécurité ? »', 'Données isolées par organisation, hébergement cloud sécurisé, sauvegardes automatiques et accès par rôle.'],
  ['« On utilise déjà Excel / des cahiers. »', 'Vous pouvez importer vos fichiers existants (CSV/IA). KonaData remplace Excel tout en apportant automatisation, historique et accès partagé.'],
];
children.push(
  table(
    ['Objection', 'Réponse'],
    objections,
    { widths: [34, 66], headColor: NAVY }
  )
);

children.push(spacer(160));

// ── 7. Appel à l'action ───────────────────────────────────
children.push(h1('7. Prochaines étapes'));
children.push(bullet([run('Démonstration gratuite : ', { bold: true }), run('30 minutes sur vos propres cas d\u2019usage (comptes démo disponibles).')]));
children.push(bullet([run('Essai accompagné : ', { bold: true }), run('période d\u2019essai pour tester en conditions réelles.')]));
children.push(bullet([run('Tarif personnalisé : ', { bold: true }), run('adapté à votre taille et à vos besoins.')]));
children.push(spacer());
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200 },
    children: [run('Contactez-nous : contact@konadatagn.com  ·  www.konadatagn.com', { bold: true, color: BLUE, size: 24 })],
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240 },
    children: [run('Les estimations financières de ce document sont illustratives et fondées sur des hypothèses ; elles sont à personnaliser pour chaque prospect.', { italics: true, color: SLATE, size: 16 })],
  })
);

// ── Document ───────────────────────────────────────────────
const doc = new Document({
  creator: 'KonaData',
  title: 'Argumentaire commercial KonaData',
  description: 'Pitchs, avantages par utilisateur et estimation financière par secteur',
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22, color: '1E293B' } },
    },
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [run('KonaData — Argumentaire commercial', { color: 'CBD5E1', size: 16 })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [run('www.konadatagn.com  ·  contact@konadatagn.com', { color: SLATE, size: 16 })],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileName = process.argv[2]?.trim() || 'KonaData-argumentaire-commercial.docx';
const out = path.join(__dirname, '..', 'exports', fileName);
const buffer = await Packer.toBuffer(doc);
const { writeFile } = await import('node:fs/promises');
await writeFile(out, buffer);
console.log('Document généré :', out);
