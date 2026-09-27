#!/usr/bin/env node
/**
 * Organisation vitrine ONG « Santé & Avenir Guinée » pour les tutoriels et vidéos.
 * Programmes, projets, bénéficiaires, sondages géolocalisés, documents et rapports archivés,
 * datés par rapport à aujourd'hui (semaine en cours toujours remplie).
 * Ré-exécutable : purge les données de CETTE organisation uniquement, puis recrée tout.
 *
 * Usage : node scripts/tutorials/seed/seed-vitrine-ong.mjs
 */
import { jsPDF } from 'jspdf';
import sharp from 'sharp';
import { VITRINE_ACCOUNTS, VITRINE_ORGS } from '../accounts.mjs';
import {
  addDays,
  admin,
  ensureMember,
  ensureOrg,
  finalizeOrgSettings,
  insertMany,
  iso,
  must,
  rng,
  today,
  uploadDocument,
  uploadLogo,
  wipe,
} from './vitrine-common.mjs';

export const ORG_ID = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000a0001';
const R = rng(2027);
const TODAY = today();
const D = (s) => new Date(`${s}T12:00:00Z`);
const DAY = 86400000;
const MONDAY = addDays(TODAY, -((TODAY.getUTCDay() + 6) % 7));
/** Identifiants fixes (URL stables pour les tutoriels) : programmes a2xx, projets a3xx, sondages a4xx. */
const fixedId = (block, i) => `b7a1e0c2-3d4f-4a5b-8c6d-0000000a${block}${String(i + 1).padStart(2, '0')}`;
const gnf = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} GNF`;

// ------------------------------------------------------------------ localités (GPS approximatifs)
const LOC = {
  kaloum: ['Kaloum', 'Conakry', 9.5092, -13.7122, 0.004],
  dixinn: ['Dixinn', 'Conakry', 9.553, -13.68, 0.006],
  matam: ['Matam', 'Conakry', 9.545, -13.65, 0.006],
  matoto: ['Matoto', 'Conakry', 9.59, -13.615, 0.01],
  ratoma: ['Ratoma', 'Conakry', 9.625, -13.645, 0.01],
  coyah: ['Coyah', 'Kindia', 9.708, -13.387, 0.018],
  dubreka: ['Dubréka', 'Kindia', 9.79, -13.523, 0.012],
  forecariah: ['Forécariah', 'Kindia', 9.43, -13.088, 0.018],
  kindia: ['Kindia centre', 'Kindia', 10.057, -12.865, 0.014],
  friguiagbe: ['Friguiagbé', 'Kindia', 9.953, -12.957, 0.014],
  mambia: ['Mambia', 'Kindia', 10.135, -13.02, 0.018],
  damakania: ['Damakania', 'Kindia', 10.214, -12.835, 0.018],
  telimele: ['Télimélé', 'Kindia', 10.905, -13.043, 0.018],
  boke: ['Boké centre', 'Boké', 10.94, -14.296, 0.014],
  kamsar: ['Kamsar', 'Boké', 10.665, -14.605, 0.007],
  kolaboui: ['Kolaboui', 'Boké', 10.717, -14.417, 0.012],
  sangaredi: ['Sangarédi', 'Boké', 11.095, -13.79, 0.015],
  boffa: ['Boffa', 'Boké', 10.18, -14.04, 0.008],
  fria: ['Fria', 'Boké', 10.37, -13.58, 0.014],
  gaoual: ['Gaoual', 'Boké', 11.75, -13.2, 0.018],
  koundara: ['Koundara', 'Boké', 12.48, -13.3, 0.018],
  labe: ['Labé centre', 'Labé', 11.318, -12.283, 0.012],
  daralabe: ['Daralabé', 'Labé', 11.4, -12.19, 0.014],
  popodara: ['Popodara', 'Labé', 11.43, -12.36, 0.014],
  hafia: ['Hafia', 'Labé', 11.35, -12.42, 0.014],
  pita: ['Pita', 'Labé', 11.055, -12.396, 0.014],
  lelouma: ['Lélouma', 'Labé', 11.42, -12.53, 0.014],
  mamou: ['Mamou', 'Mamou', 10.375, -12.091, 0.014],
  dalaba: ['Dalaba', 'Mamou', 10.69, -12.25, 0.014],
  kankan: ['Kankan centre', 'Kankan', 10.385, -9.305, 0.014],
  karifamoriah: ['Karifamoriah', 'Kankan', 10.47, -9.43, 0.016],
  tokounou: ['Tokounou', 'Kankan', 9.66, -9.79, 0.016],
  bate: ['Baté-Nafadji', 'Kankan', 10.6, -9.25, 0.016],
  siguiri: ['Siguiri', 'Kankan', 11.422, -9.168, 0.014],
  kouroussa: ['Kouroussa', 'Kankan', 10.653, -9.885, 0.014],
  mandiana: ['Mandiana', 'Kankan', 10.63, -8.69, 0.014],
  faranah: ['Faranah', 'Faranah', 10.04, -10.743, 0.014],
  dabola: ['Dabola', 'Faranah', 10.75, -11.11, 0.014],
  kissidougou: ['Kissidougou', 'Faranah', 9.185, -10.1, 0.014],
  gueckedou: ['Guéckédou', "N'Zérékoré", 8.567, -10.133, 0.014],
  macenta: ['Macenta', "N'Zérékoré", 8.543, -9.47, 0.014],
  nzerekore: ["N'Zérékoré centre", "N'Zérékoré", 7.756, -8.818, 0.014],
  lola: ['Lola', "N'Zérékoré", 7.8, -8.53, 0.014],
  beyla: ['Beyla', "N'Zérékoré", 8.687, -8.657, 0.014],
};
const URBAN = new Set(['kaloum', 'dixinn', 'matam', 'matoto', 'ratoma', 'kindia', 'coyah', 'dubreka', 'boke', 'kamsar', 'labe', 'mamou', 'kankan', 'nzerekore']);

function gps(key) {
  const [, , lat, lng, j] = LOC[key];
  const r = () => (R.next() * 2 - 1) * j;
  return { latitude: Math.round((lat + r()) * 1e6) / 1e6, longitude: Math.round((lng + r()) * 1e6) / 1e6 };
}
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = R.next() * total;
  for (const [v, w] of entries) {
    x -= w;
    if (x <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

// ------------------------------------------------------------------ programmes et projets
const PROGRAMS = [
  {
    key: 'sante',
    name: 'Programme Santé communautaire 2025–2027',
    description: 'Santé maternelle, néonatale et infantile ; riposte aux épidémies ; agents de santé communautaire.',
    budget: 7_900_000_000,
    donor: 'UNICEF',
    start: '2025-01-01',
    end: '2027-12-31',
  },
  {
    key: 'wash',
    name: 'Programme WASH Guinée maritime',
    description: 'Accès à l’eau potable, assainissement et hygiène en zones rurales et minières.',
    budget: 6_400_000_000,
    donor: 'Union européenne',
    start: '2025-07-01',
    end: '2027-06-30',
  },
  {
    key: 'nutrition',
    name: 'Programme Nutrition et Éducation',
    description: 'Nutrition communautaire des enfants de moins de 5 ans et maintien des filles à l’école.',
    budget: 5_100_000_000,
    donor: 'PAM & Partenariat mondial pour l’éducation',
    start: '2025-04-01',
    end: '2027-07-31',
  },
];

const PROJECTS = [
  {
    key: 'kindia',
    program: 'sante',
    name: 'Santé maternelle et infantile — Kindia',
    description: 'Consultations prénatales, accouchements assistés et vaccination des enfants dans la préfecture de Kindia. Financement UNICEF (convention SAG-UNICEF-2025-027, 485 000 USD).',
    region: 'Kindia',
    locality: 'Kindia',
    budget: 3_850_000_000,
    spent: 2_310_000_000,
    status: 'active',
    progress: 58,
    beneficiaries: 4_800,
    start: '2025-10-01',
    end: '2027-03-31',
    indicators: [
      ['Femmes ayant effectué au moins 4 CPN', 2400, 1520, 'femmes', 'trimestrielle'],
      ['Accouchements assistés par du personnel qualifié', 1800, 1090, 'accouchements', 'trimestrielle'],
      ['Enfants de 0 à 11 mois complètement vaccinés', 2000, 1310, 'enfants', 'mensuelle'],
      ['Agents de santé communautaire formés', 120, 96, 'agents', 'semestrielle'],
    ],
    activities: [
      ['Formation de 48 agents de santé communautaire (Friguiagbé, Mambia)', '2025-11-17', true, 48],
      ['Dotation des centres de santé en kits d’accouchement', '2026-02-10', true, 0],
      ['Campagne de vaccination de rattrapage — Damakania', '2026-05-18', true, 1240],
      ['Causeries éducatives sur les CPN (12 villages)', '2026-09-22', true, 380],
      ['Supervision formative des centres de santé', '2026-10-06', false, 0],
      ['Revue semestrielle avec la DPS de Kindia', '2026-11-12', false, 35],
    ],
  },
  {
    key: 'boke',
    program: 'wash',
    name: 'Accès à l’eau potable — Boké',
    description: 'Construction et réhabilitation de forages, comités de gestion de l’eau et promotion de l’hygiène. Financement Union européenne (FED, 540 000 EUR).',
    region: 'Boké',
    locality: 'Boké',
    budget: 6_400_000_000,
    spent: 3_520_000_000,
    status: 'active',
    progress: 49,
    beneficiaries: 12_500,
    start: '2025-07-01',
    end: '2027-06-30',
    indicators: [
      ['Forages construits ou réhabilités', 45, 24, 'forages', 'trimestrielle'],
      ['Personnes ayant accès à une source d’eau améliorée', 25000, 12500, 'personnes', 'trimestrielle'],
      ['Comités de gestion de l’eau fonctionnels', 45, 22, 'comités', 'semestrielle'],
      ['Latrines familiales construites', 600, 310, 'latrines', 'trimestrielle'],
    ],
    activities: [
      ['Étude hydrogéologique et choix des sites', '2025-09-15', true, 0],
      ['Réhabilitation de 12 forages — Kamsar et Kolaboui', '2026-03-28', true, 0],
      ['Formation des comités de gestion de l’eau', '2026-06-09', true, 210],
      ['Construction de 12 nouveaux forages — Sangarédi', '2026-09-19', true, 0],
      ['Campagne hygiène et lavage des mains dans les écoles', '2026-10-14', false, 0],
    ],
  },
  {
    key: 'labe',
    program: 'nutrition',
    name: 'Nutrition communautaire — Labé',
    description: 'Dépistage de la malnutrition (périmètre brachial), prise en charge et jardins potagers. Appui du Programme alimentaire mondial (PAM).',
    region: 'Labé',
    locality: 'Labé',
    budget: 2_900_000_000,
    spent: 2_030_000_000,
    status: 'active',
    progress: 72,
    beneficiaries: 3_600,
    start: '2025-04-01',
    end: '2026-12-31',
    indicators: [
      ['Enfants de 6 à 59 mois dépistés (PB)', 9000, 7400, 'enfants', 'mensuelle'],
      ['Enfants MAM pris en charge', 1200, 880, 'enfants', 'mensuelle'],
      ['Mères formées à l’alimentation du nourrisson (ANJE)', 1500, 1120, 'mères', 'trimestrielle'],
      ['Jardins potagers communautaires', 30, 24, 'jardins', 'semestrielle'],
    ],
    activities: [
      ['Formation des relais communautaires au dépistage', '2025-05-12', true, 64],
      ['Distribution de farines enrichies (PSGM)', '2026-04-20', true, 860],
      ['Dépistage de masse — Daralabé et Popodara', '2026-06-15', true, 2100],
      ['Démonstrations culinaires dans 18 villages', '2026-09-24', true, 540],
      ['Évaluation finale SMART', '2026-12-01', false, 0],
    ],
  },
  {
    key: 'kankan',
    program: 'nutrition',
    name: 'Scolarisation des filles — Kankan',
    description: 'Kits scolaires, bourses d’excellence et associations de mères d’élèves (AME). Financement Partenariat mondial pour l’éducation (GPE).',
    region: 'Kankan',
    locality: 'Kankan',
    budget: 2_200_000_000,
    spent: 880_000_000,
    status: 'active',
    progress: 35,
    beneficiaries: 1_450,
    start: '2026-01-15',
    end: '2027-07-31',
    indicators: [
      ['Filles inscrites et maintenues à l’école', 1800, 1450, 'filles', 'annuelle'],
      ['Kits scolaires distribués', 1800, 1450, 'kits', 'annuelle'],
      ['Bourses d’excellence attribuées', 200, 60, 'bourses', 'annuelle'],
      ['Associations de mères d’élèves actives', 40, 18, 'AME', 'semestrielle'],
    ],
    activities: [
      ['Recensement des filles non scolarisées', '2026-02-16', true, 0],
      ['Mise en place de 18 AME', '2026-04-08', true, 360],
      ['Distribution des kits scolaires — rentrée 2026', '2026-09-15', true, 1450],
      ['Cérémonie des bourses d’excellence', '2026-10-20', false, 60],
    ],
  },
  {
    key: 'conakry',
    program: 'sante',
    name: 'Riposte choléra — Conakry',
    description: 'Sensibilisation, chloration de l’eau et kits d’hygiène dans les quartiers à risque. Financement OMS / fonds d’urgence.',
    region: 'Conakry',
    locality: 'Matoto',
    budget: 950_000_000,
    spent: 935_000_000,
    status: 'completed',
    progress: 100,
    beneficiaries: 8_200,
    start: '2025-02-01',
    end: '2025-11-30',
    indicators: [
      ['Ménages sensibilisés', 8000, 8200, 'ménages', 'mensuelle'],
      ['Kits d’hygiène distribués', 5000, 5120, 'kits', 'mensuelle'],
    ],
    activities: [
      ['Porte-à-porte de sensibilisation — Matoto et Ratoma', '2025-03-10', true, 3200],
      ['Distribution de kits d’hygiène', '2025-05-22', true, 5120],
      ['Rapport final et capitalisation', '2025-11-28', true, 40],
    ],
  },
  {
    key: 'nzerekore',
    program: 'sante',
    name: 'Santé communautaire — N’Zérékoré',
    description: 'Nouveau projet : étude de base en cours avant le démarrage des activités (2027).',
    region: "N'Zérékoré",
    locality: "N'Zérékoré",
    budget: 3_100_000_000,
    spent: 120_000_000,
    status: 'planning',
    progress: 5,
    beneficiaries: 0,
    start: '2026-11-02',
    end: '2028-10-31',
    indicators: [['Étude de base réalisée', 1, 0, 'étude', 'unique']],
    activities: [['Enquête de base (sondage terrain)', '2026-10-12', false, 0]],
  },
];

// ------------------------------------------------------------------ noms guinéens
const FIRST_F = ['Fatoumata', 'Mariama', 'Aïssatou', 'Kadiatou', 'Hawa', 'Oumou', 'Fanta', 'Mabinty', 'Djénabou', 'Binta', 'Salématou', 'Néné', 'Aminata', 'Saran', 'Mahawa', 'Asmaou', 'Rouguiatou', 'Tenin', 'Makalé', 'Hadja', 'Kadidiatou', 'Safiatou', 'Dalanda', 'Nana'];
const FIRST_M = ['Mamadou', 'Ibrahima', 'Ousmane', 'Abdoulaye', 'Mohamed', 'Amadou', 'Thierno', 'Boubacar', 'Moussa', 'Fodé', 'Karamo', 'Sidiki', 'Aboubacar', 'Djibril', 'Saïdou', 'Oumar', 'Kerfalla', 'Naby', 'Souleymane', 'Alseny', 'Mamady', 'Lamine', 'Ismaël', 'Yaya'];
const SURNAMES = {
  Conakry: ['CAMARA', 'SOUMAH', 'SYLLA', 'BANGOURA', 'CISSÉ', 'FOFANA', 'YANSANÉ', 'KEÏTA', 'DIALLO', 'BAH'],
  Kindia: ['CAMARA', 'SOUMAH', 'SYLLA', 'BANGOURA', 'CISSÉ', 'FOFANA', 'YANSANÉ', 'KEÏTA', 'CONDÉ'],
  Boké: ['CAMARA', 'SOUMAH', 'BANGOURA', 'SYLLA', 'CISSÉ', 'BARRY', 'DIALLO', 'FOFANA'],
  Labé: ['DIALLO', 'BAH', 'BARRY', 'SOW', 'BALDÉ', 'DIALLO', 'BAH', 'BARRY'],
  Mamou: ['DIALLO', 'BAH', 'BARRY', 'SOW', 'BALDÉ'],
  Kankan: ['CONDÉ', 'KEÏTA', 'KOUYATÉ', 'KABA', 'KONATÉ', 'DIAKITÉ', 'KANTÉ', 'CAMARA', 'CISSÉ'],
  Faranah: ['CONDÉ', 'KOUYATÉ', 'KEÏTA', 'MARA', 'KOUROUMA', 'CAMARA'],
  "N'Zérékoré": ['HABA', 'LOUA', 'GUILAVOGUI', 'KOLIÉ', 'KAMANO', 'LAMAH', 'KOÏVOGUI', 'TOLNO'],
};
const usedNames = new Set();
function personName(region, gender) {
  for (let i = 0; i < 50; i++) {
    const first = R.pick(gender === 'F' ? FIRST_F : FIRST_M);
    const n = `${first} ${R.pick(SURNAMES[region] ?? SURNAMES.Conakry)}`;
    const full = usedNames.has(n) ? `${first} ${R.pick(gender === 'F' ? FIRST_F : FIRST_M)} ${n.split(' ').pop()}` : n;
    if (!usedNames.has(full)) {
      usedNames.add(full);
      return full;
    }
  }
  return `${R.pick(gender === 'F' ? FIRST_F : FIRST_M)} ${R.pick(SURNAMES.Conakry)}`;
}
const phone = () => `+224 6${R.pick(['2', '5', '6'])}${R.int(0, 9)} ${R.int(10, 99)} ${R.int(10, 99)} ${R.int(10, 99)}`;
const dobYearsAgo = (minY, maxY) => iso(addDays(TODAY, -Math.round((minY + R.next() * (maxY - minY)) * 365.25)));

// ------------------------------------------------------------------ bénéficiaires
const BEN_PLAN = [
  {
    project: 'kindia',
    count: 85,
    locs: ['kindia', 'friguiagbe', 'mambia', 'damakania'],
    cats: [
      ['Femme enceinte', 0.35, 'F', [17, 40], 0.65],
      ['Mère allaitante', 0.3, 'F', [18, 42], 0.6],
      ['Enfant de moins de 5 ans', 0.3, null, [0.3, 4.9], 0],
      ['Accoucheuse villageoise', 0.05, 'F', [35, 60], 0.9],
    ],
  },
  {
    project: 'boke',
    count: 70,
    locs: ['boke', 'kamsar', 'kolaboui', 'sangaredi', 'boffa'],
    cats: [
      ['Ménage (chef de ménage)', 0.75, null, [24, 68], 0.8],
      ['Comité de gestion du point d’eau', 0.2, null, [25, 60], 0.95],
      ['Artisan réparateur de pompes', 0.05, 'M', [22, 50], 1],
    ],
  },
  {
    project: 'labe',
    count: 60,
    locs: ['labe', 'daralabe', 'popodara', 'hafia', 'pita'],
    cats: [
      ['Enfant 6–59 mois', 0.55, null, [0.5, 4.9], 0],
      ['Mère allaitante', 0.3, 'F', [18, 40], 0.55],
      ['Relais communautaire', 0.15, null, [22, 55], 0.95],
    ],
  },
  {
    project: 'kankan',
    count: 50,
    locs: ['kankan', 'karifamoriah', 'tokounou', 'bate'],
    cats: [
      ['Fille scolarisée (primaire)', 0.5, 'F', [7, 12], 0],
      ['Fille scolarisée (collège)', 0.35, 'F', [12, 16], 0.2],
      ['Membre AME (mère d’élève)', 0.15, 'F', [28, 55], 0.85],
    ],
  },
  {
    project: 'conakry',
    count: 25,
    locs: ['matoto', 'ratoma', 'matam'],
    cats: [
      ['Ménage (chef de ménage)', 0.8, null, [25, 65], 0.9],
      ['Relais communautaire', 0.2, null, [20, 50], 1],
    ],
  },
];

// ------------------------------------------------------------------ sondages
const SURVEYS = [
  {
    key: 'cpn',
    project: 'kindia',
    title: 'Consultations prénatales et vaccination — Kindia',
    description: 'Enquête auprès des mères sur le suivi de grossesse, le lieu d’accouchement et la vaccination des enfants.',
    region: 'Kindia',
    status: 'active',
    mode: 'mixed',
    target: 250,
    starts: '2026-08-03',
    ends: '2026-10-31',
    count: 92,
    currentWeek: 0.14,
    agents: ['agent1', 'suivi'],
    locs: [['kindia', 5], ['friguiagbe', 3], ['mambia', 3], ['damakania', 2], ['coyah', 3], ['dubreka', 2], ['forecariah', 2], ['telimele', 1]],
    questions: [
      { id: 'q1', text: 'Combien de consultations prénatales (CPN) avez-vous faites pendant votre dernière grossesse ?', type: 'single_choice', required: true, options: ['Aucune', '1 à 3 CPN', '4 CPN ou plus'] },
      { id: 'q2', text: 'Votre dernier enfant a-t-il reçu toutes les vaccinations prévues pour son âge ?', type: 'yes_no', required: true },
      { id: 'q3', text: 'Où avez-vous accouché ?', type: 'single_choice', required: true, options: ['Centre de santé / hôpital', 'À domicile avec une accoucheuse', 'À domicile sans assistance'] },
      { id: 'q4', text: 'Distance jusqu’au centre de santé le plus proche (km)', type: 'number', required: true },
      { id: 'q5', text: 'Principale difficulté pour accéder aux soins', type: 'text', required: false },
    ],
    answer(loc) {
      const urban = URBAN.has(loc);
      return {
        q1: weighted(urban ? [['Aucune', 5], ['1 à 3 CPN', 33], ['4 CPN ou plus', 62]] : [['Aucune', 14], ['1 à 3 CPN', 50], ['4 CPN ou plus', 36]]),
        q2: R.next() < (urban ? 0.84 : 0.66),
        q3: weighted(urban ? [['Centre de santé / hôpital', 80], ['À domicile avec une accoucheuse', 15], ['À domicile sans assistance', 5]] : [['Centre de santé / hôpital', 54], ['À domicile avec une accoucheuse', 32], ['À domicile sans assistance', 14]]),
        q4: urban ? R.int(1, 5) : R.int(4, 18),
        q5: R.pick(['Coût du transport', 'Éloignement du centre de santé', 'Manque de médicaments', 'Attente trop longue', 'Frais de consultation', 'Route impraticable en saison des pluies', 'Aucune difficulté', 'Aucune difficulté']),
      };
    },
  },
  {
    key: 'eau',
    project: 'boke',
    title: 'Accès à l’eau potable des ménages — Boké',
    description: 'Collecte terrain : source d’eau, temps de corvée, traitement de l’eau et fonctionnement des points d’eau.',
    region: 'Boké',
    status: 'active',
    mode: 'field_agent',
    target: 200,
    starts: '2026-07-13',
    ends: '2026-10-16',
    count: 74,
    currentWeek: 0.12,
    agents: ['agent2'],
    locs: [['boke', 4], ['kamsar', 4], ['kolaboui', 3], ['sangaredi', 3], ['boffa', 2], ['fria', 2], ['gaoual', 1], ['koundara', 1]],
    questions: [
      { id: 'q1', text: 'Principale source d’eau de boisson du ménage', type: 'single_choice', required: true, options: ['Forage / pompe manuelle', 'Puits traditionnel', 'Rivière / marigot'] },
      { id: 'q2', text: 'Temps pour aller chercher l’eau, aller-retour (minutes)', type: 'number', required: true },
      { id: 'q3', text: 'Traitez-vous l’eau avant de la boire (chlore, ébullition, filtre) ?', type: 'yes_no', required: true },
      { id: 'q4', text: 'Le point d’eau fonctionne-t-il toute l’année ?', type: 'single_choice', required: true, options: ['Oui, toute l’année', 'Seulement en saison des pluies', 'Non, en panne'] },
      { id: 'q5', text: 'Observation de l’enquêteur', type: 'text', required: false },
    ],
    answer(loc) {
      const good = ['boke', 'kamsar', 'kolaboui'].includes(loc);
      const src = weighted(good ? [['Forage / pompe manuelle', 64], ['Puits traditionnel', 28], ['Rivière / marigot', 8]] : [['Forage / pompe manuelle', 38], ['Puits traditionnel', 37], ['Rivière / marigot', 25]]);
      const minutes = src.startsWith('Forage') ? R.int(10, 35) : src.startsWith('Puits') ? R.int(15, 45) : R.int(30, 90);
      return {
        q1: src,
        q2: minutes,
        q3: R.next() < (src.startsWith('Forage') ? 0.38 : 0.52),
        q4: src.startsWith('Rivière') ? weighted([['Seulement en saison des pluies', 70], ['Oui, toute l’année', 30]]) : weighted([['Oui, toute l’année', 58], ['Seulement en saison des pluies', 28], ['Non, en panne', 14]]),
        q5: R.pick(['Forage réhabilité par le projet en 2026', 'File d’attente importante le matin', 'Eau trouble après les pluies', 'Comité de gestion actif', 'Pompe en panne depuis 3 semaines', 'Bidons propres et couverts', 'Point d’eau éloigné du hameau', 'Redevance mensuelle de 5 000 GNF par ménage']),
      };
    },
  },
  {
    key: 'satisfaction',
    project: null,
    title: 'Satisfaction des bénéficiaires 2026 — toutes zones',
    description: 'Mesure annuelle de la satisfaction des bénéficiaires dans les 8 régions (terrain + lien en ligne).',
    region: 'Toutes régions',
    status: 'active',
    mode: 'mixed',
    target: 300,
    starts: '2026-09-01',
    ends: '2026-10-15',
    count: 124,
    currentWeek: 0.2,
    agents: ['agent1', 'agent2', 'suivi'],
    locs: [
      ['matoto', 3], ['ratoma', 3], ['dixinn', 2], ['kaloum', 1], ['coyah', 2], ['kindia', 3], ['boke', 3], ['kamsar', 2],
      ['labe', 3], ['pita', 2], ['mamou', 2], ['dalaba', 1], ['kankan', 3], ['siguiri', 2], ['kouroussa', 1], ['mandiana', 1],
      ['faranah', 2], ['dabola', 1], ['kissidougou', 2], ['gueckedou', 1], ['macenta', 1], ['nzerekore', 3], ['lola', 1], ['beyla', 1],
    ],
    questions: [
      { id: 'q1', text: 'Êtes-vous satisfait(e) de l’appui reçu de Santé & Avenir Guinée ?', type: 'single_choice', required: true, options: ['Très satisfait(e)', 'Satisfait(e)', 'Peu satisfait(e)', 'Pas satisfait(e)'] },
      { id: 'q2', text: 'Quel appui avez-vous reçu ?', type: 'single_choice', required: true, options: ['Santé maternelle et infantile', 'Eau potable', 'Nutrition', 'Scolarisation des filles'] },
      { id: 'q3', text: 'Nombre de personnes dans le ménage', type: 'number', required: true },
      { id: 'q4', text: 'Recommanderiez-vous nos services à un voisin ?', type: 'yes_no', required: true },
      { id: 'q5', text: 'Suggestion d’amélioration', type: 'text', required: false },
    ],
    answer(loc) {
      const region = LOC[loc][1];
      const byRegion = { Conakry: 'Santé maternelle et infantile', Kindia: 'Santé maternelle et infantile', Boké: 'Eau potable', Labé: 'Nutrition', Mamou: 'Nutrition', Kankan: 'Scolarisation des filles' };
      const q1 = weighted([['Très satisfait(e)', 38], ['Satisfait(e)', 42], ['Peu satisfait(e)', 14], ['Pas satisfait(e)', 6]]);
      return {
        q1,
        q2: byRegion[region] && R.next() < 0.8 ? byRegion[region] : R.pick(['Santé maternelle et infantile', 'Eau potable', 'Nutrition', 'Scolarisation des filles']),
        q3: R.int(3, 14),
        q4: R.next() < (q1.startsWith('Très') || q1.startsWith('Satisfait') ? 0.93 : 0.45),
        q5: R.pick(['Plus de visites à domicile', 'Étendre le projet aux villages voisins', 'Distribuer plus de moustiquaires', 'Réparer les pompes plus vite', 'Former plus de jeunes du village', 'Continuer les causeries éducatives', 'Aucune, merci', 'Informer plus tôt des distributions']),
      };
    },
  },
  {
    key: 'nutrition',
    project: 'labe',
    title: 'Dépistage nutritionnel des enfants — Labé',
    description: 'Mesure du périmètre brachial (PB) des enfants de 6 à 59 mois et référence vers la prise en charge.',
    region: 'Labé',
    status: 'closed',
    mode: 'field_agent',
    target: 50,
    starts: '2026-05-04',
    ends: '2026-06-30',
    endDate: '2026-06-26',
    count: 52,
    currentWeek: 0,
    agents: ['agent1'],
    locs: [['labe', 3], ['daralabe', 2], ['popodara', 2], ['hafia', 2], ['pita', 2], ['lelouma', 1]],
    questions: [
      { id: 'q1', text: 'Résultat du périmètre brachial (PB)', type: 'single_choice', required: true, options: ['Vert — normal (≥ 125 mm)', 'Jaune — malnutrition modérée', 'Rouge — malnutrition sévère'] },
      { id: 'q2', text: 'Âge de l’enfant (mois)', type: 'number', required: true },
      { id: 'q3', text: 'L’enfant a-t-il reçu la vitamine A au cours des 6 derniers mois ?', type: 'yes_no', required: true },
      { id: 'q4', text: 'Référence', type: 'single_choice', required: true, options: ['Aucune référence', 'Programme de supplémentation (PSGM)', 'Centre de santé (UNTA)'] },
      { id: 'q5', text: 'Observation', type: 'text', required: false },
    ],
    answer() {
      const q1 = weighted([['Vert — normal (≥ 125 mm)', 72], ['Jaune — malnutrition modérée', 20], ['Rouge — malnutrition sévère', 8]]);
      return {
        q1,
        q2: R.int(6, 59),
        q3: R.next() < 0.78,
        q4: q1.startsWith('Vert') ? 'Aucune référence' : q1.startsWith('Jaune') ? 'Programme de supplémentation (PSGM)' : 'Centre de santé (UNTA)',
        q5: R.pick(['Mère informée des bonnes pratiques', 'Enfant vu avec son carnet', 'Suivi prévu dans 15 jours', 'Rendez-vous au centre de santé', 'Démonstration culinaire proposée']),
      };
    },
  },
  {
    key: 'base',
    project: 'nzerekore',
    title: 'Enquête de base — Santé communautaire N’Zérékoré',
    description: 'Situation de référence avant le démarrage du projet (accès aux soins, vaccination, paludisme).',
    region: "N'Zérékoré",
    status: 'draft',
    mode: 'field_agent',
    target: 400,
    starts: '2026-10-12',
    ends: '2026-11-13',
    count: 0,
    agents: [],
    locs: [],
    questions: [
      { id: 'q1', text: 'Le ménage dort-il sous moustiquaire imprégnée ?', type: 'single_choice', required: true, options: ['Oui, tous les membres', 'Oui, une partie', 'Non'] },
      { id: 'q2', text: 'Un enfant du ménage a-t-il eu de la fièvre ces 2 dernières semaines ?', type: 'yes_no', required: true },
      { id: 'q3', text: 'Distance jusqu’au centre de santé (km)', type: 'number', required: true },
    ],
  },
];

// ------------------------------------------------------------------ utilitaires
function surveyTimes(s, n) {
  const from = D(s.starts);
  const to = s.endDate ? D(s.endDate) : TODAY;
  const inWeek = Math.round(n * (s.currentWeek ?? 0));
  const out = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = i < inWeek ? [MONDAY, to] : [from, s.currentWeek ? addDays(MONDAY, -1) : to];
    let d = addDays(a, R.int(0, Math.max(0, Math.round((b - a) / DAY))));
    if (d.getUTCDay() === 0 && R.next() < 0.8) d = addDays(d, d < addDays(to, -1) ? 1 : -1);
    const t = new Date(d);
    t.setUTCHours(R.int(8, 17), R.int(0, 59), R.int(0, 59), 0);
    out.push(t);
  }
  return out.sort((x, y) => x - y);
}

async function storageCleanup() {
  const { data } = await admin.storage.from('documents').list(ORG_ID, { limit: 1000 });
  const files = (data ?? []).filter((f) => f.id).map((f) => `${ORG_ID}/${f.name}`);
  if (files.length) await admin.storage.from('documents').remove(files);
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="280" viewBox="0 0 1000 280">
  <rect x="10" y="20" width="240" height="240" rx="120" fill="#0F766E"/>
  <path d="M130 212 C 74 170 56 140 56 112 C 56 86 76 68 99 68 C 113 68 124 75 130 86 C 136 75 147 68 161 68 C 184 68 204 86 204 112 C 204 140 186 170 130 212 Z" fill="#FFFFFF"/>
  <path d="M130 196 C 130 160 150 128 186 116 C 180 152 160 180 130 196 Z" fill="#F97360"/>
  <rect x="112" y="104" width="16" height="48" rx="3" fill="#0F766E"/>
  <rect x="96" y="120" width="48" height="16" rx="3" fill="#0F766E"/>
  <text x="285" y="138" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="86" fill="#0F766E">SANTÉ &amp; AVENIR</text>
  <text x="285" y="228" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="78" fill="#F97360">GUINÉE</text>
  <text x="620" y="224" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="30" fill="#475569">ONG · depuis 2012</text>
</svg>`;

let logoDataUrl = null;
function pdfDoc(title, meta, sections) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const clean = (s) => String(s).replace(/[—–]/g, '-').replace(/[’]/g, "'").replace(/≥/g, '>=').replace(/\u202f|\u00a0/g, ' ');
  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 15, 12, 64, 18);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
  doc.text(['Santé & Avenir Guinée - ONG de droit guinéen', 'Kipé, Ratoma - Conakry - contact@sante-avenir-guinee.demo'].map(clean), 195, 17, { align: 'right' });
  doc.setDrawColor(15, 118, 110).setLineWidth(0.6).line(15, 34, 195, 34);
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(15, 118, 110);
  doc.text(doc.splitTextToSize(clean(title), 180), 15, 44);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100);
  doc.text(clean(meta), 15, 56);
  let y = 66;
  for (const [heading, lines] of sections) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(249, 115, 96);
    doc.text(clean(heading), 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(40);
    for (const l of lines) {
      const wrapped = doc.splitTextToSize(clean(l), 178);
      if (y + wrapped.length * 5 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(wrapped, 17, y);
      y += wrapped.length * 5 + 1;
    }
    y += 4;
  }
  doc.setFontSize(8).setTextColor(140).text('Document de démonstration - données fictives', 105, 290, { align: 'center' });
  return Buffer.from(doc.output('arraybuffer'));
}

// ------------------------------------------------------------------ main
async function main() {
  console.log('🤝 Organisation vitrine ONG —', VITRINE_ORGS.ong.name);
  await ensureOrg({
    id: ORG_ID,
    name: VITRINE_ORGS.ong.name,
    type: 'ngo',
    email: 'contact@sante-avenir-guinee.demo',
    phone: '+224 622 40 50 60',
    address: 'Quartier Kipé, Ratoma — Conakry',
  });

  const dirId = await ensureMember(ORG_ID, { ...VITRINE_ACCOUNTS.ong, phone: '+224 622 10 20 30', intent: 'org_admin', onboarding: 'director' });
  const progId = await ensureMember(ORG_ID, {
    email: 'video.programme.ong@konadata.demo',
    fullName: 'Aïssatou BAH',
    role: 'deputy_director',
    phone: '+224 628 33 44 55',
  });
  const suiviId = await ensureMember(ORG_ID, {
    email: 'video.suivi.ong@konadata.demo',
    fullName: 'Ibrahima SYLLA',
    role: 'ngo_staff',
    phone: '+224 655 21 43 65',
  });
  const agent1Id = await ensureMember(ORG_ID, {
    email: 'video.enqueteur1.ong@konadata.demo',
    fullName: 'Mamadou Aliou BARRY',
    role: 'ngo_staff',
    phone: '+224 621 87 65 43',
  });
  const agent2Id = await ensureMember(ORG_ID, {
    email: 'video.enqueteur2.ong@konadata.demo',
    fullName: 'Fanta KOUYATÉ',
    role: 'ngo_staff',
    phone: '+224 664 12 98 76',
  });
  const AGENT = { suivi: suiviId, agent1: agent1Id, agent2: agent2Id };

  await finalizeOrgSettings(ORG_ID, dirId, {
    ngo_surveys: {
      enabled: true,
      require_gps: true,
      allow_offline_collection: true,
      default_region: 'Kindia',
      max_active_surveys: 10,
      auto_close_when_target_reached: false,
      one_per_device: false,
      device_lock_days: 30,
      require_phone_otp: false,
      otp_channel: 'sms',
      require_survey_payment: false,
    },
  });
  await uploadLogo(ORG_ID, LOGO_SVG);
  logoDataUrl = `data:image/png;base64,${(await sharp(Buffer.from(LOGO_SVG)).png().toBuffer()).toString('base64')}`;
  console.log('  ✓ organisation, abonnement, CGU, 5 utilisateurs, logo, paramètres sondages');

  await storageCleanup();
  await wipe(ORG_ID, [
    'ngo_project_documents',
    'documents',
    'ngo_survey_security_alerts',
    'ngo_survey_participation_locks',
    'ngo_survey_otp_challenges',
    'ngo_survey_charges',
    'ngo_survey_agent_assignments',
    'ngo_survey_responses',
    'ngo_surveys',
    'ngo_beneficiaries',
    'core_persons',
    'ngo_indicators',
    'ngo_activities',
    'collaborator_assignments',
    'organization_ai_generated_reports',
    'ngo_projects',
    'ngo_programs',
  ]);
  console.log('  ✓ purge des anciennes données de la vitrine');

  // Programmes
  const progRows = await insertMany(
    'ngo_programs',
    PROGRAMS.map((p, i) => ({
      id: fixedId(20, i),
      organization_id: ORG_ID,
      name: p.name,
      description: p.description,
      budget: p.budget,
      currency: 'GNF',
      start_date: p.start,
      end_date: p.end,
      donor: p.donor,
      is_active: true,
      created_at: `${p.start}T09:00:00Z`,
    })),
    { select: 'id, name' }
  );
  const programId = Object.fromEntries(PROGRAMS.map((p) => [p.key, progRows.find((r) => r.name === p.name).id]));

  // Projets
  const projRows = await insertMany(
    'ngo_projects',
    PROJECTS.map((p, i) => ({
      id: fixedId(30, i),
      organization_id: ORG_ID,
      program_id: programId[p.program],
      name: p.name,
      description: p.description,
      region: p.region,
      locality: p.locality,
      budget: p.budget,
      spent: p.spent,
      currency: 'GNF',
      status: p.status,
      progress_pct: p.progress,
      start_date: p.start,
      end_date: p.end,
      beneficiaries: p.beneficiaries,
      created_at: `${iso(addDays(D(p.start), p.status === 'planning' ? -60 : -20))}T09:30:00Z`,
    })),
    { select: 'id, name' }
  );
  const projectId = Object.fromEntries(PROJECTS.map((p) => [p.key, projRows.find((r) => r.name === p.name).id]));
  console.log(`  ✓ ${PROGRAMS.length} programmes, ${PROJECTS.length} projets`);

  // Indicateurs et activités
  const indicators = [];
  const activities = [];
  for (const p of PROJECTS) {
    for (const [name, target, current, unit, frequency] of p.indicators) {
      indicators.push({ organization_id: ORG_ID, project_id: projectId[p.key], name, target_value: target, current_value: current, unit, frequency });
    }
    for (const [name, date, done, participants] of p.activities) {
      activities.push({
        organization_id: ORG_ID,
        project_id: projectId[p.key],
        name,
        planned_date: date,
        completed_date: done ? date : null,
        is_completed: done,
        participants,
      });
    }
  }
  await insertMany('ngo_indicators', indicators);
  await insertMany('ngo_activities', activities);
  console.log(`  ✓ ${indicators.length} indicateurs, ${activities.length} activités`);

  // Bénéficiaires
  const benPersons = [];
  const benMeta = [];
  for (const plan of BEN_PLAN) {
    const proj = PROJECTS.find((p) => p.key === plan.project);
    const from = D(proj.start);
    const to = proj.status === 'completed' ? D(proj.end) : TODAY;
    const span = Math.round((to - from) / DAY);
    for (let i = 0; i < plan.count; i++) {
      const [category, , g, [aMin, aMax], phoneRate] = weighted(plan.cats.map((c) => [c, c[1]]));
      const gender = g ?? (R.next() < 0.5 ? 'F' : 'M');
      const loc = R.pick(plan.locs);
      const region = LOC[loc][1];
      const fullName = personName(region, gender);
      const recent = proj.status !== 'completed' && i < 4;
      const created = addDays(recent ? MONDAY : from, recent ? R.int(0, Math.round((TODAY - MONDAY) / DAY)) : R.int(0, span));
      created.setUTCHours(R.int(8, 17), R.int(0, 59), 0, 0);
      benPersons.push({
        organization_id: ORG_ID,
        kind: 'beneficiary',
        full_name: fullName,
        gender,
        phone: R.next() < phoneRate ? phone() : null,
        email: phoneRate > 0.8 && R.next() < 0.15 ? `${fullName.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${fullName.split(' ').pop().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@gmail.com` : null,
        date_of_birth: dobYearsAgo(aMin, aMax),
        metadata: { vitrine: true, age_group: aMax < 6 ? '0-5 ans' : aMax <= 16 ? '6-16 ans' : '18 ans et +' },
        created_at: created.toISOString(),
      });
      benMeta.push({ project: plan.project, region, locality: LOC[loc][0], category, created_at: created.toISOString() });
    }
  }
  const persons = await insertMany('core_persons', benPersons, { select: 'id' });
  await insertMany(
    'ngo_beneficiaries',
    benMeta.map((b, i) => ({
      organization_id: ORG_ID,
      person_id: persons[i].id,
      project_id: projectId[b.project],
      region: b.region,
      locality: b.locality,
      category: b.category,
      created_at: b.created_at,
    }))
  );
  const women = benPersons.filter((p) => p.gender === 'F').length;
  const children = benPersons.filter((p) => p.metadata.age_group === '0-5 ans').length;
  console.log(`  ✓ ${benPersons.length} bénéficiaires (${women} femmes/filles, ${benPersons.length - women} hommes/garçons, ${children} enfants de 0 à 5 ans)`);

  // Sondages + réponses géolocalisées
  const surveyRows = await insertMany(
    'ngo_surveys',
    SURVEYS.map((s, i) => ({
      id: fixedId(40, i),
      organization_id: ORG_ID,
      project_id: s.project ? projectId[s.project] : null,
      title: s.title,
      description: s.description,
      questions: s.questions,
      status: s.status,
      region: s.region,
      starts_at: `${s.starts}T08:00:00Z`,
      ends_at: `${s.ends}T18:00:00Z`,
      target_responses: s.target,
      collection_mode: s.mode,
      assigned_zones: s.locs.map(([k]) => LOC[k][0]),
      public_token: `srv_5a47e0c2a0010000000000${String(i + 1).padStart(2, '0')}`,
      created_at: `${iso(addDays(D(s.starts), -6))}T10:00:00Z`,
      updated_at: `${iso(addDays(D(s.starts), -1))}T10:00:00Z`,
    })),
    { select: 'id, title' }
  );
  const surveyId = Object.fromEntries(SURVEYS.map((s) => [s.key, surveyRows.find((r) => r.title === s.title).id]));

  const assignments = [];
  for (const s of SURVEYS) for (const a of s.agents) assignments.push({ organization_id: ORG_ID, survey_id: surveyId[s.key], profile_id: AGENT[a] });
  await insertMany('ngo_survey_agent_assignments', assignments);

  let responseCount = 0;
  let gpsCount = 0;
  for (const s of SURVEYS) {
    if (!s.count) continue;
    const seen = new Set();
    const rows = surveyTimes(s, s.count).map((t, i) => {
      const loc = weighted(s.locs);
      const answers = s.answer(loc);
      const numQ = s.questions.find((q) => q.type === 'number').id;
      while (seen.has(JSON.stringify(answers) + loc)) answers[numQ] += 1;
      seen.add(JSON.stringify(answers) + loc);
      const agentKey = s.mode === 'field_agent' ? s.agents[0] : R.next() < 0.3 ? null : R.pick(s.agents);
      const offline = agentKey && R.next() < 0.25;
      return {
        organization_id: ORG_ID,
        survey_id: surveyId[s.key],
        agent_id: agentKey ? AGENT[agentKey] : null,
        respondent_id: `${s.key.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
        answers,
        ...gps(loc),
        locality: LOC[loc][0],
        is_offline: Boolean(offline),
        synced_at: new Date(t.getTime() + (offline ? R.int(2, 20) * 3600000 : 60000)).toISOString(),
        created_at: t.toISOString(),
      };
    });
    if (s.key === 'satisfaction') {
      for (const src of [rows[40], rows[85]]) {
        const t = new Date(new Date(src.created_at).getTime() + 7 * 60000).toISOString();
        rows.push({ ...src, respondent_id: `${src.respondent_id}-B`, created_at: t, synced_at: t });
      }
    }
    await insertMany('ngo_survey_responses', rows, { chunk: 200 });
    responseCount += rows.length;
    gpsCount += rows.filter((r) => r.latitude != null).length;
  }
  console.log(`  ✓ ${SURVEYS.length} sondages, ${responseCount} réponses (${gpsCount} géolocalisées, 2 doublons volontaires)`);

  // Assignations projets
  await insertMany('collaborator_assignments', [
    ...['kindia', 'boke', 'labe', 'kankan'].map((k) => ({ organization_id: ORG_ID, profile_id: suiviId, resource_type: 'ngo_project', resource_id: projectId[k], can_import: true, can_upload: true, can_edit: true, assigned_by: dirId })),
    ...['kindia', 'labe'].map((k) => ({ organization_id: ORG_ID, profile_id: agent1Id, resource_type: 'ngo_project', resource_id: projectId[k], can_import: false, can_upload: true, can_edit: false, assigned_by: dirId })),
    ...['boke', 'kankan'].map((k) => ({ organization_id: ORG_ID, profile_id: agent2Id, resource_type: 'ngo_project', resource_id: projectId[k], can_import: false, can_upload: true, can_edit: false, assigned_by: dirId })),
  ]);
  console.log('  ✓ assignations (suivi-évaluation : 4 projets ; enquêteurs : 2 projets chacun)');

  // Documents projets (PDF)
  const P = Object.fromEntries(PROJECTS.map((p) => [p.key, p]));
  const DOCS = [
    ['Convention_UNICEF-SAG_2025-027.pdf', 'partner_contract', 'Convention / partenariat', 'kindia', '2025-09-18', progId,
      'Convention de partenariat UNICEF - Santé & Avenir Guinée n° SAG-UNICEF-2025-027', 'Signée à Conakry le 18 septembre 2025',
      [['Objet', ['Mise en œuvre du projet « Santé maternelle et infantile - Kindia » dans les sous-préfectures de Friguiagbé, Mambia et Damakania.']],
        ['Montant et durée', ['Contribution UNICEF : 485 000 USD (environ 4,1 milliards GNF).', 'Durée : 1er octobre 2025 - 31 mars 2027 (18 mois).']],
        ['Engagements', ['Rapports narratifs et financiers trimestriels.', 'Suivi des indicateurs : CPN4, accouchements assistés, couverture vaccinale.', 'Audit externe à mi-parcours.']]]],
    ['Rapport_trimestriel_T2-2026_SMI_Kindia.pdf', 'activity_report', "Rapport d'activité", 'kindia', '2026-07-12', suiviId,
      'Rapport trimestriel T2 2026 - Santé maternelle et infantile - Kindia', 'Période : avril - juin 2026 - Rédigé par le suivi-évaluation',
      [['Faits marquants', ['Campagne de vaccination de rattrapage à Damakania : 1 240 enfants vaccinés.', '36 nouvelles accoucheuses villageoises orientées vers les centres de santé.']],
        ['Indicateurs', ['Femmes ayant fait au moins 4 CPN : 1 520 / 2 400 (63 %).', 'Accouchements assistés : 1 090 / 1 800 (61 %).', 'Enfants complètement vaccinés : 1 310 / 2 000 (66 %).']],
        ['Difficultés', ['Routes impraticables vers Mambia en saison des pluies.', 'Ruptures ponctuelles de vaccins au centre de santé de Friguiagbé.']]]],
    ['Rapport_financier_S1-2026_WASH_Boke.pdf', 'financial_report', 'Rapport financier / dépenses', 'boke', '2026-07-25', progId,
      'Rapport financier - 1er semestre 2026 - Accès à l\'eau potable - Boké', 'Période : janvier - juin 2026 - Bailleur : Union européenne',
      [['Synthèse', [`Budget total : ${gnf(P.boke.budget)}`, `Dépenses cumulées au 30/06/2026 : ${gnf(2_980_000_000)}`, 'Taux d\'exécution : 47 %']],
        ['Principales dépenses du semestre', ['Réhabilitation de 12 forages : 1 140 000 000 GNF', 'Formation des comités de gestion : 96 000 000 GNF', 'Personnel et logistique : 310 000 000 GNF']]]],
    ['Questionnaire_acces_eau_menages_Boke.pdf', 'questionnaire', 'Questionnaire / enquête', 'boke', '2026-07-08', suiviId,
      'Questionnaire - Accès à l\'eau potable des ménages', 'Version validée le 8 juillet 2026 - collecte sur tablette KonaData',
      [['Questions', SURVEYS[1].questions.map((q, i) => `${i + 1}. ${q.text}${q.options ? ` (${q.options.join(' / ')})` : ''}`)],
        ['Consignes enquêteur', ['Capturer la position GPS devant le point d\'eau.', 'Interroger le chef de ménage ou son conjoint.']]]],
    ['Liste_beneficiaires_forages_Kamsar.pdf', 'beneficiary_list', 'Liste bénéficiaires', 'boke', '2026-09-10', agent2Id,
      'Liste des ménages bénéficiaires - forages réhabilités de Kamsar', 'Établie le 10 septembre 2026',
      [['Ménages', benPersons.map((p, i) => [p, benMeta[i]]).filter(([, m]) => m.locality === 'Kamsar').slice(0, 18).map(([p, m], i) => `${i + 1}. ${p.full_name} - ${m.category}${p.phone ? ` - ${p.phone}` : ''}`)]]],
    ['Plan_de_travail_annuel_2026_Scolarisation_Kankan.pdf', 'project_plan', 'Plan / document technique', 'kankan', '2026-01-20', progId,
      'Plan de travail annuel 2026 - Scolarisation des filles - Kankan', 'Validé en comité de pilotage le 20 janvier 2026',
      [['Activités', P.kankan.activities.map(([n, d]) => `${d.split('-').reverse().join('/')} - ${n}`)],
        ['Cibles 2026', ['1 800 filles inscrites et maintenues', '200 bourses d\'excellence', '40 associations de mères d\'élèves actives']]]],
    ['Facture_kits_scolaires_Librairie_Kankan.pdf', 'invoice', 'Facture / bon de commande', 'kankan', '2026-09-03', progId,
      'Facture n° LK-2026-0412 - Librairie du Milo, Kankan', 'Émise le 3 septembre 2026 - Client : Santé & Avenir Guinée',
      [['Détail', ['1 450 kits scolaires (cartable, cahiers, stylos, ardoise) x 185 000 GNF = 268 250 000 GNF', 'Transport vers 4 sous-préfectures : 6 500 000 GNF']],
        ['Total', ['274 750 000 GNF - payé par virement le 10/09/2026']]]],
    ['Rapport_mission_depistage_nutritionnel_Labe.pdf', 'activity_report', "Rapport d'activité", 'labe', iso(addDays(MONDAY, 1)), agent1Id,
      'Rapport de mission - démonstrations culinaires et dépistage - Labé', `Mission du ${MONDAY.toISOString().slice(8, 10)}/${MONDAY.toISOString().slice(5, 7)} - Daralabé, Popodara, Hafia`,
      [['Réalisations', ['18 démonstrations culinaires, 540 mères participantes.', '312 enfants dépistés : 84 % vert, 12 % jaune, 4 % rouge.', '11 enfants référés vers l\'UNTA de Labé.']],
        ['Recommandations', ['Renforcer le stock de farines enrichies à Popodara.', 'Prévoir un second passage avant la fin octobre.']]]],
  ];
  for (const [fileName, typeId, typeLabel, pKey, date, by, title, meta, sections] of DOCS) {
    const docId = await uploadDocument(ORG_ID, by, {
      fileName,
      buffer: pdfDoc(title, meta, sections),
      mimeType: 'application/pdf',
      category: { partner_contract: 'other', activity_report: 'ngo_report', financial_report: 'expense_report', questionnaire: 'questionnaire', beneficiary_list: 'ngo_report', project_plan: 'other', invoice: 'invoice' }[typeId],
      createdAt: `${date}T14:${String(R.int(10, 59))}:00Z`,
      extracted: { document_type: typeId, document_type_label: typeLabel, project_id: projectId[pKey] },
    });
    must(await admin.from('ngo_project_documents').insert({ organization_id: ORG_ID, project_id: projectId[pKey], document_id: docId, doc_type: typeId }), 'lien document');
  }
  console.log(`  ✓ ${DOCS.length} documents PDF liés aux projets`);

  // Rapports archivés (historique KonaAI)
  const active = PROJECTS.filter((p) => p.status !== 'planning');
  const totB = PROJECTS.reduce((s, p) => s + p.budget, 0);
  const totS = PROJECTS.reduce((s, p) => s + p.spent, 0);
  const eau = SURVEYS[1];
  const REPORTS = [
    {
      scope_id: 'all',
      scope_label: 'Tous les projets',
      report_type: 'general',
      report_type_label: 'Rapport général projet',
      title: 'Rapport ONG — Général — Tous les projets',
      subtitle: 'Synthèse organisation',
      days: 3,
      content: [
        'RAPPORT ONG — GÉNÉRAL — TOUS LES PROJETS',
        'Synthèse organisation — Santé & Avenir Guinée',
        '',
        '1. Synthèse projets',
        `Totaux : budget ${gnf(totB)}, dépensé ${gnf(totS)}, taux global ${((totS / totB) * 100).toFixed(1)} %`,
        ...active.map((p) => `• ${p.name} — ${p.region} — budget ${gnf(p.budget)}, exécution ${((p.spent / p.budget) * 100).toFixed(0)} %, avancement ${p.progress} %, ${p.beneficiaries.toLocaleString('fr-FR')} bénéficiaires déclarés`),
        '',
        '2. Bénéficiaires',
        `${benPersons.length} bénéficiaires enregistrés individuellement (${women} femmes et filles, ${children} enfants de moins de 5 ans).`,
        '',
        '3. Points d’attention',
        '• Scolarisation des filles — Kankan : exécution budgétaire de 40 %, à accélérer avant la cérémonie des bourses.',
        '• Accès à l’eau — Boké : 14 % des points d’eau déclarés en panne dans le sondage ménages.',
        '• Nutrition — Labé : fin de projet au 31/12/2026, préparer l’évaluation finale SMART.',
      ].join('\n'),
    },
    {
      scope_id: projectId.boke,
      scope_label: P.boke.name,
      report_type: 'budget',
      report_type_label: 'Budget & exécution',
      title: `Rapport ONG — Budget — ${P.boke.name}`,
      subtitle: 'Boké — Boké',
      days: 11,
      content: [
        `RAPPORT ONG — BUDGET — ${P.boke.name.toUpperCase()}`,
        '',
        `Budget : ${gnf(P.boke.budget)} — dépensé : ${gnf(P.boke.spent)} — exécution : ${((P.boke.spent / P.boke.budget) * 100).toFixed(1)} %`,
        `Reste à engager : ${gnf(P.boke.budget - P.boke.spent)} sur 9 mois.`,
        '',
        'Indicateurs',
        ...P.boke.indicators.map(([n, t, c, u]) => `• ${n} : ${c.toLocaleString('fr-FR')} / ${t.toLocaleString('fr-FR')} ${u} (${Math.round((c / t) * 100)} %)`),
        '',
        'Recommandation : lancer l’appel d’offres des 21 forages restants avant la fin de la saison des pluies.',
      ].join('\n'),
    },
    {
      scope_id: surveyId.eau,
      scope_label: eau.title,
      report_type: 'survey',
      report_type_label: 'Rapport sondage',
      title: `Rapport sondage — ${eau.title}`,
      subtitle: `${eau.count} réponses — région de Boké`,
      days: 6,
      content: [
        `RAPPORT SONDAGE — ${eau.title.toUpperCase()}`,
        '',
        `${eau.count} réponses collectées par l’enquêtrice Fanta KOUYATÉ dans 8 localités (objectif : ${eau.target}).`,
        '',
        'Constats principaux',
        '• Le forage / pompe manuelle est la première source d’eau, surtout à Kamsar, Kolaboui et Boké centre.',
        '• Les ménages dépendant d’une rivière ou d’un marigot passent en moyenne plus d’une heure par jour à la corvée d’eau.',
        '• Environ un ménage sur deux ne traite pas l’eau avant de la boire.',
        '',
        'Recommandations',
        '• Prioriser Gaoual, Koundara et Fria pour les nouveaux forages.',
        '• Renforcer la promotion de la chloration à domicile.',
      ].join('\n'),
    },
  ];
  await insertMany(
    'organization_ai_generated_reports',
    REPORTS.map(({ days, ...r }) => ({
      organization_id: ORG_ID,
      sector: 'ngo',
      engine: 'local',
      created_by: dirId,
      created_at: `${iso(addDays(TODAY, -days))}T16:20:00Z`,
      ...r,
    }))
  );
  console.log(`  ✓ ${REPORTS.length} rapports archivés (historique Rapports)`);

  console.log('\n✅ Vitrine ONG prête');
  console.log('   Direction :', VITRINE_ACCOUNTS.ong.email);
  console.log('   Chargée de programme : video.programme.ong@konadata.demo');
  console.log('   Suivi-évaluation : video.suivi.ong@konadata.demo');
  console.log('   Enquêteurs : video.enqueteur1.ong@konadata.demo, video.enqueteur2.ong@konadata.demo');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
