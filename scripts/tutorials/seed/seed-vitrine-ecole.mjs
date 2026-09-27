#!/usr/bin/env node
/**
 * Organisation vitrine ÉCOLE « Groupe Scolaire Horizon » (Lambanyi, Conakry) pour les tutoriels et vidéos.
 * Année scolaire courante 2026-2027 (rentrée le lundi 7 septembre 2026) : inscriptions et réinscriptions,
 * frais et encaissements (1re tranche échue au 15 septembre), deux évaluations notées par matière au
 * 1er trimestre / 1er semestre, bulletins provisoires, emploi du temps, appels et actualités.
 * Ré-exécutable : purge les données de CETTE organisation uniquement, puis recrée tout.
 *
 * Usage : node scripts/tutorials/seed/seed-vitrine-ecole.mjs
 */
import { createHash, randomBytes, randomUUID } from 'crypto';
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

export const ORG_ID = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000ec001';
const YEAR = '2026-2027';
const R = rng(2027);
const TODAY = today();
const D = (s) => new Date(`${s}T12:00:00Z`);
const RENTREE = D('2026-09-07');
const ORG_PHONE = '+224 622 45 67 89';
const ORG_ADDRESS = 'Lambanyi, commune de Ratoma — Conakry';

// ------------------------------------------------------------------ classes et matières
const CLASSES = [
  { key: 'CE2', name: 'CE2 A', level: 'CE2', band: 'primaire', program: 'Fondamental', fee: 1_800_000, n: 22, age: 8, room: 'Salle 3' },
  { key: 'CM1', name: 'CM1 A', level: 'CM1', band: 'primaire', program: 'Fondamental', fee: 1_900_000, n: 21, age: 9, room: 'Salle 4' },
  { key: 'CM2', name: 'CM2 A', level: 'CM2', band: 'primaire', program: 'Fondamental', fee: 2_000_000, n: 23, age: 10, room: 'Salle 5' },
  { key: '7E', name: '7e A', level: '7e', band: 'college', program: 'Général', fee: 2_600_000, n: 24, age: 11, room: 'Salle 7' },
  { key: '8E', name: '8e A', level: '8e', band: 'college', program: 'Général', fee: 2_700_000, n: 22, age: 12, room: 'Salle 8' },
  { key: '10E', name: '10e A', level: '10e', band: 'college', program: 'Général', fee: 2_900_000, n: 23, age: 14, room: 'Salle 10' },
  { key: '11E', name: '11e Sciences', level: '11e', band: 'lycee', program: 'Sciences', department: 'Sciences', fee: 3_400_000, n: 20, age: 15, room: 'Salle 11' },
  { key: '12E', name: '12e SE', level: '12e', band: 'lycee', program: 'Sciences expérimentales', department: 'Sciences', fee: 3_700_000, n: 19, age: 16, room: 'Salle 12' },
  { key: 'TLE', name: 'Terminale SM', level: 'Terminale', band: 'lycee', program: 'Sciences mathématiques', department: 'Sciences', fee: 4_200_000, n: 18, age: 17, room: 'Salle 14' },
];

/** [nom, code, coefficient, créneaux hebdomadaires] — référentiel par palier (comme dans l'application). */
const SUBJECTS = {
  primaire: [
    ['Français', 'FR', 3, 4],
    ['Mathématiques', 'MATH', 3, 4],
    ['Sciences', 'SCI', 2, 2],
    ['Histoire-Géographie', 'HG', 2, 2],
    ['Éducation civique', 'EC', 1, 2],
    ['EPS', 'EPS', 1, 1],
  ],
  college: [
    ['Français', 'FR', 3, 3],
    ['Mathématiques', 'MATH', 3, 3],
    ['Anglais', 'EN', 2, 2],
    ['Physique-Chimie', 'PC', 2, 2],
    ['SVT', 'SVT', 2, 2],
    ['Histoire-Géographie', 'HG', 2, 2],
    ['EPS', 'EPS', 1, 1],
  ],
  lycee: [
    ['Mathématiques', 'MATH', 4, 3],
    ['Physique-Chimie', 'PC', 3, 2],
    ['SVT', 'SVT', 3, 2],
    ['Français', 'FR', 3, 2],
    ['Philosophie', 'PHILO', 2, 2],
    ['Anglais', 'EN', 2, 2],
    ['Histoire-Géographie', 'HG', 2, 1],
    ['EPS', 'EPS', 1, 1],
  ],
};
const PERIOD = { primaire: 'T1', college: 'T1', lycee: 'S1' };
const MAX_SCORE = { primaire: 10, college: 20, lycee: 20 };
/** Évaluations du début d'année : [type (préréglage de l'application), coefficient, jours de la semaine concernée]. */
const EVALUATIONS = [
  ['Interrogation', 1, ['2026-09-14', '2026-09-18']],
  ['Devoir', 2, ['2026-09-21', '2026-09-25']],
];
/** Devoir laissé sans notes pour le tutoriel « saisie des notes ». */
const MISSING_EVALUATION = { classKey: '7E', subject: 'Anglais', examType: 'Devoir' };
/** Classes sans bulletins pré-générés (tutoriel « générer les bulletins »). */
const CLASSES_WITHOUT_BULLETINS = ['7E', '10E'];

// ------------------------------------------------------------------ personnes
const TEACHERS = [
  { key: 'sow', name: 'Mamadou Lamarana SOW', specialty: 'Mathématiques', account: true },
  { key: 'camara', name: 'Hawa CAMARA', specialty: 'Institutrice (CE2)' },
  { key: 'kourouma', name: 'Mory KOUROUMA', specialty: 'Instituteur (CM1)' },
  { key: 'sylla', name: 'Aminata SYLLA', specialty: 'Institutrice (CM2)' },
  { key: 'barry', name: 'Kadiatou BARRY', specialty: 'Français' },
  { key: 'cisse', name: 'Mohamed Lamine CISSÉ', specialty: 'Anglais' },
  { key: 'soumah', name: 'Ibrahima SOUMAH', specialty: 'Physique-Chimie' },
  { key: 'konate', name: 'Fanta KONATÉ', specialty: 'SVT' },
  { key: 'kouyate', name: 'Sidiki KOUYATÉ', specialty: 'Histoire-Géographie' },
  { key: 'bangoura', name: 'Fodé BANGOURA', specialty: 'EPS' },
  { key: 'balde', name: 'Thierno Souleymane BALDÉ', specialty: 'Mathématiques (lycée)' },
  { key: 'fofana', name: 'Ousmane FOFANA', specialty: 'Philosophie' },
];
const PRIMARY_TEACHER = { CE2: 'camara', CM1: 'kourouma', CM2: 'sylla' };
const SUBJECT_TEACHER = {
  Français: 'barry',
  Anglais: 'cisse',
  'Physique-Chimie': 'soumah',
  SVT: 'konate',
  'Histoire-Géographie': 'kouyate',
  EPS: 'bangoura',
  Philosophie: 'fofana',
};
const teacherFor = (cls, subject) => {
  if (subject === 'EPS') return 'bangoura';
  if (cls.band === 'primaire') return PRIMARY_TEACHER[cls.key];
  if (subject === 'Mathématiques') return ['12E', 'TLE'].includes(cls.key) ? 'balde' : 'sow';
  return SUBJECT_TEACHER[subject];
};

const MALE = ['Mamadou', 'Alpha', 'Ibrahima', 'Ousmane', 'Abdoulaye', 'Thierno', 'Amadou', 'Mohamed', 'Sékou', 'Lansana', 'Moussa', 'Aboubacar', 'Boubacar', 'Alseny', 'Fodé', 'Karamo', 'Sidiki', 'Mamady', 'Djibril', 'Souleymane', 'Saïdou', 'Oumar', 'Ismaël', 'Sory', 'Yacouba', 'Mory', 'Naby', 'Kabinet', 'Facinet', 'Abdourahmane', 'Cheick', 'Salif', 'Aliou', 'Morlaye', 'Almamy', 'Seydouba', 'Tidiane', 'Lamine', 'Hassane', 'Issiaga'];
const MALE_2 = ['Saliou', 'Oury', 'Lamarana', 'Bailo', 'Dian', 'Sadio', 'Cellou', 'Aliou', 'Pathé', 'Diouldé'];
const FEMALE = ['Mariama', 'Fatoumata', 'Aïssatou', 'Kadiatou', 'Hawa', 'Oumou', 'Djénabou', 'Aminata', 'Ramatoulaye', 'Fanta', 'Nènè', 'Binta', 'Adama', 'Mabinty', 'Sayon', 'Saran', 'Fatou', 'Makalé', 'Kankou', 'Maïmouna', 'Hadiatou', 'Safiatou', 'Mahawa', 'Salématou', 'Aïcha', 'Rouguiatou', 'Kadidiatou', "M'Mah", 'Assiatou', 'Tenin', 'Mariame', 'Djaka', 'Hadja', 'Néné Oumou', 'Fatoumata Diaraye'];
const FEMALE_2 = ['Binta', 'Diaraye', 'Kadiatou', 'Hawa', 'Bobo', 'Djouma', 'Sadio', 'Tata'];
const LAST = ['DIALLO', 'BAH', 'BARRY', 'CAMARA', 'CONDÉ', 'SYLLA', 'SOUMAH', 'KEÏTA', 'KOUYATÉ', 'TOURÉ', 'BANGOURA', 'SOW', 'BALDÉ', 'CISSÉ', 'KABA', 'FOFANA', 'KONATÉ', 'SAVANÉ', 'KOUROUMA', 'TRAORÉ', 'DIAKITÉ', 'CAMARA', 'DIALLO', 'BAH', 'BARRY', 'SOW', 'DIALLO', 'BALDÉ', 'CAMARA', 'SYLLA'];
/** Combinaisons évitées (anciens chefs d'État). */
const FORBIDDEN = [/^Alpha( |$).*CONDÉ$/, /^Sékou( |$).*TOURÉ$/, /^Moussa( |$).*CAMARA$/, /^Lansana( |$).*CONTÉ$/];
const PHONE_PREFIX = ['620', '621', '622', '623', '624', '625', '626', '627', '628', '629', '660', '661', '662', '664', '666', '669', '655', '656', '611'];

const usedNames = new Set(['Mariama BAH', 'Alpha Oumar DIALLO', 'Fatoumata Binta KABA', 'Aïssatou SAVANÉ', 'Kadiatou DIALLO', ...TEACHERS.map((t) => t.name)]);
function personName(gender) {
  for (;;) {
    const first = gender === 'F' ? R.pick(FEMALE) : R.pick(MALE);
    const second = R.next() < 0.28 && !first.includes(' ') ? ` ${gender === 'F' ? R.pick(FEMALE_2) : R.pick(MALE_2)}` : '';
    const firstName = second.trim() === first ? first : first + second;
    const name = `${firstName} ${R.pick(LAST)}`;
    if (usedNames.has(name) || FORBIDDEN.some((re) => re.test(name))) continue;
    usedNames.add(name);
    return name;
  }
}
const pad2 = (n) => String(n).padStart(2, '0');
const phone = () => `+224 ${R.pick(PHONE_PREFIX)} ${pad2(R.int(10, 99))} ${pad2(R.int(10, 99))} ${pad2(R.int(10, 99))}`;
const gauss = () => {
  let u = 0;
  while (u === 0) u = R.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R.next());
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const at = (d, h, m = 0) => `${iso(d)}T${pad2(h)}:${pad2(m)}:00Z`;
const between = (a, b) => addDays(a, R.int(0, Math.max(0, Math.round((b - a) / 86400000))));
const isWeekday = (d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
const nextWeekday = (d) => {
  let x = new Date(d);
  while (!isWeekday(x)) x = addDays(x, 1);
  return x;
};
/** Borne les dates d'événements passés à hier (la vitrine reste cohérente si relancée plus tard). */
const YESTERDAY = addDays(TODAY, -1);
const past = (d) => (d > YESTERDAY ? YESTERDAY : d);
const token = () => randomBytes(24).toString('hex');
const verifyCode = (id, tok) => createHash('md5').update(id + tok).digest('hex').slice(0, 8).toUpperCase();

function mention(avg) {
  if (avg >= 16) return 'Très bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez bien';
  if (avg >= 10) return 'Passable';
  if (avg >= 8) return 'Insuffisant';
  return 'Très insuffisant';
}
function appreciation(avg) {
  const m = mention(avg);
  if (avg >= 14) return `${m}. Félicitations pour vos excellents résultats. Poursuivez vos efforts.`;
  if (avg >= 10) return `${m}. Résultats satisfaisants. Encouragements pour progresser davantage.`;
  return `${m}. Des efforts supplémentaires sont nécessaires. L'établissement reste disponible pour vous accompagner.`;
}

// ------------------------------------------------------------------ visuels
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect x="8" y="8" width="584" height="584" rx="96" fill="#FFFFFF" stroke="#E0A526" stroke-width="10"/>
  <circle cx="300" cy="235" r="160" fill="#0B5D3B"/>
  <circle cx="300" cy="245" r="72" fill="#E0A526"/>
  <rect x="160" y="245" width="280" height="130" fill="#0B5D3B"/>
  <path d="M175 245 L425 245" stroke="#F4D35E" stroke-width="8" stroke-linecap="round"/>
  <path d="M205 276 Q252 258 300 276 Q348 258 395 276 L395 330 Q348 312 300 330 Q252 312 205 330 Z" fill="#FFFFFF"/>
  <path d="M300 276 L300 330" stroke="#0B5D3B" stroke-width="6"/>
  <g stroke="#E0A526" stroke-width="9" stroke-linecap="round">
    <path d="M300 150 L300 124"/><path d="M232 176 L214 158"/><path d="M368 176 L386 158"/>
  </g>
  <text x="300" y="480" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="92" fill="#0B5D3B">HORIZON</text>
  <text x="300" y="540" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="40" letter-spacing="4" fill="#C8901A">GROUPE SCOLAIRE</text>
</svg>`;

const STAMP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <g fill="none" stroke="#1E3A8A" opacity="0.88">
    <circle cx="210" cy="210" r="196" stroke-width="10"/>
    <circle cx="210" cy="210" r="176" stroke-width="3"/>
    <circle cx="210" cy="210" r="112" stroke-width="3"/>
  </g>
  <g font-family="Arial, Helvetica, sans-serif" fill="#1E3A8A" opacity="0.9" text-anchor="middle" font-weight="700">
    <text x="210" y="84" font-size="30">GROUPE SCOLAIRE</text>
    <text x="210" y="192" font-size="44">HORIZON</text>
    <text x="210" y="232" font-size="22">★ LA DIRECTION ★</text>
    <text x="210" y="266" font-size="18" font-weight="600">Lambanyi — Ratoma</text>
    <text x="210" y="356" font-size="26">CONAKRY · GUINÉE</text>
  </g>
</svg>`;

const RENTREE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B5D3B"/><stop offset="1" stop-color="#127A4F"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1010" cy="470" r="170" fill="#E0A526" opacity="0.95"/>
  <rect x="780" y="470" width="420" height="160" fill="#0B5D3B"/>
  <path d="M800 470 L1200 470" stroke="#F4D35E" stroke-width="8"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#FFFFFF">
    <text x="70" y="120" font-size="34" font-weight="700" fill="#F4D35E">GROUPE SCOLAIRE HORIZON</text>
    <text x="70" y="230" font-size="86" font-weight="800">Rentrée scolaire</text>
    <text x="70" y="325" font-size="86" font-weight="800">2026-2027</text>
    <text x="70" y="410" font-size="40" font-weight="600">Lundi 7 septembre 2026 · 7 h 45</text>
    <text x="70" y="480" font-size="30">Primaire · Collège · Lycée — Lambanyi, Conakry</text>
    <text x="70" y="560" font-size="26" fill="#F4D35E">Inscriptions et réinscriptions ouvertes au secrétariat</text>
  </g>
</svg>`;

const frDate = (isoDate) => isoDate.split('-').reverse().join('/');

function birthCertificateSvg({ fullName, birth }) {
  const [first, ...rest] = fullName.split(' ');
  const last = rest.pop();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100">
  <rect width="850" height="1100" fill="#FBF8EF"/>
  <rect x="30" y="30" width="790" height="1040" fill="none" stroke="#8A7B55" stroke-width="3"/>
  <g font-family="Georgia, 'Times New Roman', serif" fill="#2B2B2B">
    <text x="425" y="100" font-size="26" font-weight="700" text-anchor="middle">RÉPUBLIQUE DE GUINÉE</text>
    <text x="425" y="135" font-size="18" text-anchor="middle">Travail — Justice — Solidarité</text>
    <text x="425" y="190" font-size="18" text-anchor="middle">Commune de Ratoma — Centre d'état civil</text>
    <text x="425" y="270" font-size="30" font-weight="700" text-anchor="middle">EXTRAIT D'ACTE DE NAISSANCE</text>
    <text x="80" y="370" font-size="22">Nom : ${last}</text>
    <text x="80" y="420" font-size="22">Prénom(s) : ${[first, ...rest].join(' ')}</text>
    <text x="80" y="470" font-size="22">Né(e) le : ${frDate(birth)}</text>
    <text x="80" y="520" font-size="22">À : Conakry</text>
    <text x="80" y="570" font-size="22">Fils / fille de : ${R.pick(MALE)} ${last}</text>
    <text x="80" y="620" font-size="22">Et de : ${R.pick(FEMALE)} ${R.pick(LAST)}</text>
    <text x="80" y="720" font-size="18" fill="#555">Délivré pour servir et valoir ce que de droit.</text>
    <text x="520" y="850" font-size="20">L'officier d'état civil</text>
  </g>
  <circle cx="640" cy="950" r="70" fill="none" stroke="#3B5BA9" stroke-width="5" opacity="0.6"/>
</svg>`;
}

function previousReportSvg({ fullName, cls }) {
  const prevBand = cls.level === '7e' ? 'primaire' : cls.band;
  const scale = MAX_SCORE[prevBand];
  const subjects = SUBJECTS[prevBand].slice(0, 6);
  const rows = subjects
    .map(([name], i) => {
      const note = ((R.int(18, 34) / 2) * (scale / 20)).toFixed(1);
      return `<text x="80" y="${330 + i * 56}" font-size="22">${name}</text><text x="640" y="${330 + i * 56}" font-size="22" text-anchor="end">${note} / ${scale}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100">
  <rect width="850" height="1100" fill="#FFFFFF"/>
  <rect x="0" y="0" width="850" height="140" fill="#1F4E79"/>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="425" y="70" font-size="30" font-weight="700" fill="#FFFFFF" text-anchor="middle">BULLETIN DE NOTES — 2025-2026</text>
    <text x="425" y="110" font-size="18" fill="#DCE6F2" text-anchor="middle">École de provenance — 3e trimestre</text>
    <text x="80" y="210" font-size="24" font-weight="700" fill="#1F2937">${fullName}</text>
    <text x="80" y="250" font-size="18" fill="#4B5563">Admis(e) en classe supérieure</text>
    <g fill="#1F2937">${rows}</g>
    <line x1="80" y1="${330 + subjects.length * 56}" x2="770" y2="${330 + subjects.length * 56}" stroke="#9CA3AF"/>
    <text x="80" y="${380 + subjects.length * 56}" font-size="24" font-weight="700" fill="#1F4E79">Moyenne annuelle : ${((R.int(22, 32) / 2) * (scale / 20)).toFixed(2)} / ${scale}</text>
  </g>
</svg>`;
}

function photoSvg() {
  const skin = R.pick(['#6B4226', '#7B4B2A', '#5A3620', '#8D5A3B']);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="540" viewBox="0 0 420 540">
  <rect width="420" height="540" fill="#DDE7F0"/>
  <ellipse cx="210" cy="230" rx="95" ry="115" fill="${skin}"/>
  <path d="M60 540 C70 400 140 360 210 360 C280 360 350 400 360 540 Z" fill="${R.pick(['#FFFFFF', '#1E3A8A', '#0B5D3B'])}"/>
  <rect x="180" y="330" width="60" height="50" fill="${skin}"/>
</svg>`;
}

// ------------------------------------------------------------------ stockage
async function listFilesRecursive(prefix) {
  const { data } = await admin.storage.from('documents').list(prefix, { limit: 1000 });
  const out = [];
  for (const entry of data ?? []) {
    const full = `${prefix}/${entry.name}`;
    if (entry.id) out.push(full);
    else out.push(...(await listFilesRecursive(full)));
  }
  return out;
}

async function storageCleanup() {
  const files = (await listFilesRecursive(ORG_ID)).filter((f) => !f.startsWith(`${ORG_ID}/branding/`));
  for (let i = 0; i < files.length; i += 100) await admin.storage.from('documents').remove(files.slice(i, i + 100));
}

async function uploadPng(storagePath, svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  must(await admin.storage.from('documents').upload(storagePath, png, { contentType: 'image/png', upsert: true }), `upload ${storagePath}`);
  return png;
}

async function patchSettings(mutate) {
  const org = must(await admin.from('organizations').select('settings').eq('id', ORG_ID).single(), 'settings');
  const settings = org.settings ?? {};
  mutate(settings);
  must(await admin.from('organizations').update({ settings }).eq('id', ORG_ID), 'maj settings');
}

// ------------------------------------------------------------------ main
async function main() {
  console.log('🏫  Organisation vitrine école —', VITRINE_ORGS.ecole.name);
  await ensureOrg({
    id: ORG_ID,
    name: VITRINE_ORGS.ecole.name,
    type: 'school',
    email: 'contact@gs-horizon.demo',
    phone: ORG_PHONE,
    address: ORG_ADDRESS,
  });
  // Pas de visibilité dans la liste publique d'inscription en ligne (établissement fictif).
  must(await admin.from('organizations').update({ accepts_student_applications: false }).eq('id', ORG_ID), 'org candidatures publiques');

  const dirId = await ensureMember(ORG_ID, { ...VITRINE_ACCOUNTS.ecole, phone: '+224 622 11 40 25', intent: 'org_admin', onboarding: 'director' });
  const censeurId = await ensureMember(ORG_ID, {
    email: 'video.censeur.ecole@konadata.demo',
    fullName: 'Alpha Oumar DIALLO',
    role: 'deputy_director',
    phone: '+224 628 33 17 90',
    intent: 'org_admin',
    onboarding: 'director',
  });
  const comptableId = await ensureMember(ORG_ID, {
    email: 'video.comptable.ecole@konadata.demo',
    fullName: 'Fatoumata Binta KABA',
    role: 'accountant',
    phone: '+224 621 58 04 66',
  });
  const scolariteId = await ensureMember(ORG_ID, {
    email: 'video.scolarite.ecole@konadata.demo',
    fullName: 'Aïssatou SAVANÉ',
    role: 'registrar',
    phone: '+224 664 20 71 38',
  });
  const profId = await ensureMember(ORG_ID, {
    email: 'video.prof.ecole@konadata.demo',
    fullName: 'Mamadou Lamarana SOW',
    role: 'teacher',
    phone: '+224 655 42 18 07',
  });
  const eleveId = await ensureMember(ORG_ID, {
    email: 'video.eleve.ecole@konadata.demo',
    fullName: 'Kadiatou DIALLO',
    role: 'student',
    phone: '+224 626 90 12 45',
    intent: 'learner',
    onboarding: 'learner',
  });
  await finalizeOrgSettings(ORG_ID, dirId, { platform_billing_period: 'annual' });
  await uploadLogo(ORG_ID, LOGO_SVG);
  console.log('  ✓ organisation, accès annuel, CGU, 6 comptes, logo');

  await storageCleanup();
  await wipe(ORG_ID, [
    'school_attendance_records',
    'school_attendance_sessions',
    'school_report_cards',
    'school_grade_evaluation_documents',
    'school_grades',
    'school_grade_evaluations',
    'school_schedules',
    'school_teaching_assignments',
    'school_tuition_reminder_log',
    'school_payment_webhook_events',
    'school_payment_otp_challenges',
    'school_guardian_portal_otp_challenges',
    'school_payments',
    'school_student_documents',
    'school_reenrollment_codes',
    'school_enrollments',
    'school_students',
    'school_teachers',
    'school_subjects',
    'school_classes',
    'school_announcements',
    'school_academic_year_archives',
    'organization_ai_generated_reports',
    'documents',
    'core_persons',
  ]);
  console.log('  ✓ purge des anciennes données de la vitrine');

  // Cachet (bulletins) : image + document
  const stampPath = `${ORG_ID}/branding/cachet.png`;
  const stampPng = await uploadPng(stampPath, STAMP_SVG);
  const stampDoc = must(
    await admin
      .from('documents')
      .insert({
        organization_id: ORG_ID,
        uploaded_by: dirId,
        file_name: 'cachet.png',
        file_path: stampPath,
        file_size: stampPng.length,
        mime_type: 'image/png',
        status: 'classified',
        category: 'other',
        ai_confidence: 98,
        extracted_data: { classified_by: 'user', original_name: 'cachet.png', document_type: 'school_stamp' },
      })
      .select('id')
      .single(),
    'document cachet'
  );

  // Classes
  const classId = {};
  const classRows = CLASSES.map((c) => {
    classId[c.key] = randomUUID();
    return {
      id: classId[c.key],
      organization_id: ORG_ID,
      name: c.name,
      level: c.level,
      education_level_band: c.band,
      department: c.department ?? null,
      program: c.program,
      academic_year: YEAR,
      capacity: c.band === 'lycee' ? 35 : 40,
      tuition_fee_gnf: c.fee,
      is_active: true,
      created_at: at(D('2026-06-10'), 9, 30),
    };
  });
  await insertMany('school_classes', classRows);

  // Matières (par palier)
  const subjectId = {};
  const subjectRows = [];
  for (const [band, list] of Object.entries(SUBJECTS)) {
    subjectId[band] = {};
    for (const [name, code, coefficient] of list) {
      subjectId[band][name] = randomUUID();
      subjectRows.push({
        id: subjectId[band][name],
        organization_id: ORG_ID,
        name,
        code,
        coefficient,
        education_level_band: band,
        is_active: true,
        created_at: at(D('2026-06-10'), 10, 0),
      });
    }
  }
  await insertMany('school_subjects', subjectRows);
  console.log(`  ✓ ${CLASSES.length} classes, ${subjectRows.length} matières (3 paliers)`);

  // Enseignants
  const teacherPersonId = {};
  const teacherId = {};
  const teacherPersons = [];
  const teacherRows = [];
  for (const t of TEACHERS) {
    teacherPersonId[t.key] = randomUUID();
    teacherId[t.key] = randomUUID();
    const tel = t.account ? '+224 655 42 18 07' : phone();
    const email = t.account ? 'video.prof.ecole@konadata.demo' : null;
    teacherPersons.push({
      id: teacherPersonId[t.key],
      organization_id: ORG_ID,
      profile_id: t.account ? profId : null,
      kind: 'teacher',
      full_name: t.name,
      email,
      phone: tel,
      gender: /^(Hawa|Aminata|Kadiatou|Fanta)/.test(t.name) ? 'F' : 'M',
    });
    teacherRows.push({ id: teacherId[t.key], organization_id: ORG_ID, person_id: teacherPersonId[t.key], specialty: t.specialty, is_active: true });
  }
  await insertMany('core_persons', teacherPersons);
  await insertMany('school_teachers', teacherRows);
  await insertMany(
    'school_teaching_assignments',
    CLASSES.filter((c) => teacherFor(c, 'Mathématiques') === 'sow').map((c) => ({
      organization_id: ORG_ID,
      profile_id: profId,
      class_id: classId[c.key],
      subject_id: subjectId[c.band]['Mathématiques'],
      assigned_by: dirId,
    }))
  );
  console.log(`  ✓ ${TEACHERS.length} enseignants (M. SOW : mathématiques 7e, 8e, 10e, 11e)`);

  // Emploi du temps
  const SLOTS = {
    primaire: [['08:00', '09:30'], ['09:45', '11:00'], ['11:15', '12:30']],
    college: [['08:00', '10:00'], ['10:15', '12:15'], ['12:30', '14:00']],
    lycee: [['08:00', '10:00'], ['10:15', '12:15'], ['12:30', '14:00']],
  };
  const schedules = [];
  for (const c of CLASSES) {
    const pool = [];
    for (const [name, , , hours] of SUBJECTS[c.band]) for (let i = 0; i < hours; i++) pool.push(name);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = R.int(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.forEach((name, idx) => {
      const [start, end] = SLOTS[c.band][idx % 3];
      schedules.push({
        organization_id: ORG_ID,
        class_id: classId[c.key],
        subject_id: subjectId[c.band][name],
        teacher_id: teacherId[teacherFor(c, name)],
        day_of_week: Math.floor(idx / 3),
        start_time: start,
        end_time: end,
        room: name === 'EPS' ? 'Terrain de sport' : ['Physique-Chimie', 'SVT'].includes(name) ? 'Laboratoire' : c.room,
      });
    });
  }
  await insertMany('school_schedules', schedules);
  console.log(`  ✓ emploi du temps (${schedules.length} créneaux, lundi → vendredi)`);

  // Élèves, inscriptions / réinscriptions
  const persons = [];
  const students = [];
  const enrollments = [];
  const roster = [];
  const matSeq = {};
  const nextMat = (yy) => {
    matSeq[yy] = (matSeq[yy] ?? 0) + 1;
    return `GSH-${yy}-${String(matSeq[yy]).padStart(4, '0')}`;
  };
  let studentAccountAttached = false;
  for (const c of CLASSES) {
    for (let i = 0; i < c.n; i++) {
      const gender = R.next() < 0.5 ? 'F' : 'M';
      let fullName = personName(gender);
      let profileId = null;
      if (!studentAccountAttached && c.key === '12E' && gender === 'F') {
        usedNames.delete(fullName);
        fullName = 'Kadiatou DIALLO';
        profileId = eleveId;
        studentAccountAttached = true;
      }
      const returning = R.next() < (c.band === 'primaire' ? 0.7 : 0.58);
      const entryYear = returning ? R.int(Math.max(19, 26 - (c.age - 5)), 25) : 26;
      const birth = new Date(Date.UTC(2026 - c.age - (R.next() < 0.25 ? 1 : 0), R.int(0, 11), R.int(1, 28), 12));
      const guardianGender = R.next() < 0.62 ? 'M' : 'F';
      const lastName = fullName.split(' ').pop();
      const guardianFirst = guardianGender === 'M' ? R.pick(MALE) : R.pick(FEMALE);
      const relation = guardianGender === 'M' ? (R.next() < 0.88 ? 'Père' : 'Oncle') : R.next() < 0.9 ? 'Mère' : 'Tante';
      const guardianName = `${guardianGender === 'M' ? 'M.' : 'Mme'} ${guardianFirst} ${relation === 'Père' ? lastName : R.pick(LAST)}`;
      const tel = phone();
      const created = returning
        ? between(D('2026-06-15'), D('2026-08-28'))
        : between(D('2026-07-01'), past(D('2026-09-10')));
      const personId = randomUUID();
      const studentId = randomUUID();
      const enrollmentId = randomUUID();
      persons.push({
        id: personId,
        organization_id: ORG_ID,
        profile_id: profileId,
        kind: 'student',
        full_name: fullName,
        email: profileId ? 'video.eleve.ecole@konadata.demo' : null,
        phone: tel,
        gender,
        date_of_birth: iso(birth),
        metadata: { guardian_name: guardianName, guardian_relation: relation, birth_place: R.pick(['Conakry', 'Conakry', 'Conakry', 'Kindia', 'Labé', 'Kankan', 'Boké', 'Mamou']) },
      });
      students.push({
        id: studentId,
        organization_id: ORG_ID,
        person_id: personId,
        matricule: nextMat(String(entryYear)),
        class_id: classId[c.key],
        enrollment_status: 'enrolled',
        enrollment_date: iso(addDays(created, R.int(0, 3))),
        enrollment_source: !returning && R.next() < 0.2 ? 'platform' : 'manual',
        created_at: at(created, R.int(8, 16), R.int(0, 59)),
      });
      enrollments.push({
        id: enrollmentId,
        organization_id: ORG_ID,
        student_id: studentId,
        class_id: classId[c.key],
        academic_year: YEAR,
        status: 'enrolled',
        request_type: returning ? 'reenrollment' : 'new',
        applicant_name: fullName,
        applicant_phone: tel,
        notes: returning ? 'Réinscription' : 'Nouvelle inscription',
        study_level: c.level,
        program: c.program,
        guardian_name: guardianName,
        guardian_phone: tel,
        guardian_relation: relation,
        guardian_sms_consent: R.next() < 0.88,
        dossier_submitted_at: returning ? null : at(created, R.int(9, 17), R.int(0, 59)),
        created_at: at(created, R.int(8, 16), R.int(0, 59)),
      });
      roster.push({ cls: c, studentId, enrollmentId, fullName, returning, created, ability: clamp(11.8 + gauss() * 3.1, 4.2, 18.6) });
    }
  }

  // Candidatures en cours (rentrée tardive)
  const CANDIDATES = [
    ['7E', 'pending', 2], ['7E', 'pending', 5], ['CE2', 'pending', 1], ['CM1', 'pending', 7], ['8E', 'pending', 3],
    ['11E', 'pending', 4], ['10E', 'pending', 9], ['CM2', 'admitted', 11], ['12E', 'admitted', 12],
  ];
  const candidates = [];
  for (const [key, status, daysAgo] of CANDIDATES) {
    const c = CLASSES.find((x) => x.key === key);
    const gender = R.next() < 0.5 ? 'F' : 'M';
    const fullName = personName(gender);
    const tel = phone();
    const created = past(addDays(TODAY, -daysAgo));
    const personId = randomUUID();
    const studentId = randomUUID();
    const enrollmentId = randomUUID();
    const guardianFirst = R.pick(MALE);
    persons.push({
      id: personId,
      organization_id: ORG_ID,
      kind: 'candidate',
      full_name: fullName,
      phone: tel,
      gender,
      date_of_birth: iso(new Date(Date.UTC(2026 - c.age, R.int(0, 11), R.int(1, 28), 12))),
      metadata: { guardian_name: `M. ${guardianFirst} ${fullName.split(' ').pop()}`, guardian_relation: 'Père' },
    });
    students.push({
      id: studentId,
      organization_id: ORG_ID,
      person_id: personId,
      matricule: nextMat('26'),
      class_id: classId[key],
      enrollment_status: status,
      enrollment_source: 'platform',
      created_at: at(created, R.int(8, 17), R.int(0, 59)),
    });
    enrollments.push({
      id: enrollmentId,
      organization_id: ORG_ID,
      student_id: studentId,
      class_id: classId[key],
      academic_year: YEAR,
      status,
      request_type: 'new',
      applicant_name: fullName,
      applicant_phone: tel,
      notes: 'Nouvelle inscription',
      study_level: c.level,
      program: c.program,
      guardian_name: `M. ${guardianFirst} ${fullName.split(' ').pop()}`,
      guardian_phone: tel,
      guardian_relation: 'Père',
      guardian_sms_consent: true,
      dossier_submitted_at: R.next() < 0.7 ? at(created, R.int(9, 18), R.int(0, 59)) : null,
      created_at: at(created, R.int(8, 17), R.int(0, 59)),
    });
    candidates.push({ studentId, enrollmentId, status, created, fullName, cls: c, birth: persons.at(-1).date_of_birth, submitted: Boolean(enrollments.at(-1).dossier_submitted_at) });
  }
  await insertMany('core_persons', persons, { chunk: 250 });
  await insertMany('school_students', students, { chunk: 250 });
  await insertMany('school_enrollments', enrollments, { chunk: 250 });

  // Pièces des dossiers de candidature (scans)
  const candidateDocs = [];
  for (const cand of candidates.filter((x) => x.submitted || x.status === 'admitted')) {
    const slug = cand.fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]+/g, '-').toLowerCase();
    const kinds = [
      ['birth_certificate', `acte-naissance-${slug}.png`, birthCertificateSvg(cand)],
      ['report_card_prev', `bulletin-2025-2026-${slug}.png`, previousReportSvg(cand)],
    ];
    if (R.next() < 0.6) kinds.push(['photo', `photo-${slug}.png`, photoSvg(cand)]);
    for (const [docType, fileName, svg] of kinds) {
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      const createdAt = at(cand.created, R.int(9, 18), R.int(0, 59));
      const documentId = await uploadDocument(ORG_ID, scolariteId, {
        fileName,
        buffer: png,
        mimeType: 'image/png',
        extracted: { document_type: docType },
        createdAt,
      });
      candidateDocs.push({ organization_id: ORG_ID, student_id: cand.studentId, enrollment_id: cand.enrollmentId, document_id: documentId, doc_type: docType, created_at: createdAt });
    }
  }
  await insertMany('school_student_documents', candidateDocs);
  console.log(`  ✓ ${roster.length} élèves inscrits (${roster.filter((r) => r.returning).length} réinscriptions), ${candidates.length} candidatures (${candidateDocs.length} pièces jointes)`);

  // Paiements : inscription / réinscription, scolarité (tranches), liens en attente
  const INSTALLMENTS = [
    { label: '1re tranche', percent: 40, due_date: '2026-09-15' },
    { label: '2e tranche', percent: 30, due_date: '2026-12-15' },
    { label: '3e tranche', percent: 30, due_date: '2027-03-15' },
  ];
  const FEE_NEW = 250_000;
  const FEE_RE = 150_000;
  const payments = [];
  const pickMethod = () => {
    const u = R.next();
    return u < 0.55 ? 'cash' : u < 0.83 ? 'orange_money' : u < 0.92 ? 'mtn_momo' : 'bank_transfer';
  };
  const refFor = (method, d) => {
    const dd = iso(d).slice(2).replace(/-/g, '');
    if (method === 'orange_money') return `MP${dd}.${pad2(R.int(8, 18))}${pad2(R.int(0, 59))}.C${R.int(10000, 99999)}`;
    if (method === 'mtn_momo') return `MOMO-${dd}${R.int(100000, 999999)}`;
    if (method === 'bank_transfer') return `VIR-ECOBANK-${R.int(100000, 999999)}`;
    return null;
  };
  const pay = (r, kind, amount, date, description) => {
    const method = pickMethod();
    payments.push({
      id: randomUUID(),
      organization_id: ORG_ID,
      student_id: r.studentId,
      enrollment_id: r.enrollmentId,
      amount,
      currency: 'GNF',
      payment_kind: kind,
      payment_method: method,
      status: 'paid',
      reference: refFor(method, date),
      description,
      paid_at: at(date, R.int(8, 16), R.int(0, 59)),
      academic_year: YEAR,
      confirmation_source: 'staff',
    });
  };
  const LAST_WEEK = [past(addDays(TODAY, -6)), YESTERDAY];
  let late = 0;
  for (const r of roster) {
    const fee = r.cls.fee;
    const t1 = Math.round((fee * 0.4) / 1000) * 1000;
    if (R.next() < 0.97) {
      pay(r, r.returning ? 'reenrollment' : 'enrollment', r.returning ? FEE_RE : FEE_NEW, addDays(r.created, R.int(0, 2)), r.returning ? `Frais de réinscription ${YEAR}` : `Frais d'inscription ${YEAR}`);
    }
    const tuitionFrom = new Date(Math.max(+r.created, +D('2026-08-17')));
    const u = R.next();
    if (u < 0.18) {
      pay(r, 'tuition', fee, past(between(tuitionFrom, D('2026-09-11'))), 'Frais de scolarité — année complète');
    } else if (u < 0.56) {
      pay(r, 'tuition', t1, past(between(tuitionFrom, D('2026-09-15'))), 'Frais de scolarité — 1re tranche');
    } else if (u < 0.7) {
      const first = Math.round(t1 * 0.6 / 50000) * 50000;
      const d1 = past(between(tuitionFrom, D('2026-09-08')));
      pay(r, 'tuition', first, d1, 'Frais de scolarité — acompte 1re tranche');
      pay(r, 'tuition', t1 - first, past(between(addDays(d1, 5), D('2026-09-25'))), 'Frais de scolarité — solde 1re tranche');
    } else if (u < 0.78) {
      pay(r, 'tuition', t1, past(between(LAST_WEEK[0], LAST_WEEK[1])), 'Frais de scolarité — 1re tranche (régularisation)');
    } else if (u < 0.88) {
      pay(r, 'tuition', Math.round(t1 * 0.5 / 100000) * 100000, past(between(tuitionFrom, D('2026-09-16'))), 'Frais de scolarité — acompte 1re tranche');
      late += 1;
    } else {
      late += 1;
    }
  }
  for (const cand of candidates.filter((c) => c.status === 'admitted')) {
    pay(cand, 'enrollment', FEE_NEW, cand.created, `Frais d'inscription ${YEAR}`);
  }
  payments.sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  payments.forEach((p, i) => {
    p.payment_token = token();
    p.receipt_number = `REC-2026-${String(i + 1).padStart(6, '0')}`;
    p.receipt_issued_at = p.paid_at;
    p.receipt_verification_code = verifyCode(p.id, p.payment_token);
    p.created_at = p.paid_at;
  });
  const paidCount = payments.length;
  // Liens de paiement envoyés aux familles, pas encore réglés
  const unpaid = roster.filter((r) => !payments.some((p) => p.student_id === r.studentId && p.payment_kind === 'tuition')).slice(0, 5);
  for (const r of unpaid) {
    const created = past(addDays(TODAY, -R.int(1, 4)));
    payments.push({
      id: randomUUID(),
      organization_id: ORG_ID,
      student_id: r.studentId,
      enrollment_id: r.enrollmentId,
      amount: Math.round((r.cls.fee * 0.4) / 1000) * 1000,
      currency: 'GNF',
      payment_kind: 'tuition',
      payment_method: 'orange_money',
      status: 'pending',
      description: 'Frais de scolarité — 1re tranche (lien de paiement)',
      due_date: iso(addDays(created, 7)),
      payment_token: token(),
      academic_year: YEAR,
      created_at: at(created, R.int(9, 16), R.int(0, 59)),
    });
  }
  await insertMany('school_payments', payments, { chunk: 250 });
  const collected = payments.filter((p) => p.status === 'paid' && p.payment_kind === 'tuition').reduce((s, p) => s + p.amount, 0);
  const expected = roster.reduce((s, r) => s + r.cls.fee, 0);
  console.log(
    `  ✓ ${paidCount} encaissements avec reçu, ${unpaid.length} liens en attente — scolarité ${Math.round((collected / expected) * 100)} % encaissée, ${late} élèves en retard sur la 1re tranche`
  );

  // Évaluations et notes
  const evaluations = [];
  const grades = [];
  const gradesByClass = {};
  const evalMeta = new Map();
  for (const c of CLASSES) {
    const classStudents = roster.filter((r) => r.cls.key === c.key);
    const max = MAX_SCORE[c.band];
    gradesByClass[c.key] = [];
    for (const [name, , coefficient] of SUBJECTS[c.band]) {
      const sid = subjectId[c.band][name];
      const offsets = new Map(classStudents.map((r) => [r.studentId, gauss() * 1.7 + (name === 'EPS' ? 1.5 : 0)]));
      for (const [examType, evalCoef, [from, to]] of EVALUATIONS) {
        const date = past(nextWeekday(between(D(from), D(to))));
        const teacherKey = teacherFor(c, name);
        evaluations.push({
          organization_id: ORG_ID,
          class_id: classId[c.key],
          subject_id: sid,
          exam_type: examType,
          semester: PERIOD[c.band],
          academic_year: YEAR,
          max_score: max,
          coefficient: evalCoef,
          created_by: teacherKey === 'sow' ? profId : censeurId,
          created_at: at(date, 10, R.int(0, 59)),
        });
        evalMeta.set(`${c.key}|${sid}|${examType}`, evalCoef);
        const skip = c.key === MISSING_EVALUATION.classKey && name === MISSING_EVALUATION.subject && examType === MISSING_EVALUATION.examType;
        if (skip) continue;
        for (const r of classStudents) {
          const on20 = clamp(r.ability + offsets.get(r.studentId) + gauss() * 1.8, 2.5, 19.5);
          const score = Math.round(((on20 * max) / 20) * 2) / 2;
          const row = {
            organization_id: ORG_ID,
            student_id: r.studentId,
            subject_id: sid,
            class_id: classId[c.key],
            exam_type: examType,
            score,
            max_score: max,
            semester: PERIOD[c.band],
            academic_year: YEAR,
            created_at: at(past(addDays(date, R.int(1, 2))), R.int(14, 19), R.int(0, 59)),
          };
          grades.push(row);
          gradesByClass[c.key].push({ ...row, coefficient, evalCoef });
        }
      }
    }
  }
  await insertMany('school_grade_evaluations', evaluations, { chunk: 250 });
  await insertMany('school_grades', grades, { select: 'id', chunk: 500 });
  console.log(`  ✓ ${evaluations.length} évaluations, ${grades.length} notes (interrogation + devoir par matière)`);

  // Bulletins provisoires (moyennes, rangs, appréciations)
  const cards = [];
  for (const c of CLASSES) {
    if (CLASSES_WITHOUT_BULLETINS.includes(c.key)) continue;
    const perStudent = roster
      .filter((r) => r.cls.key === c.key)
      .map((r) => {
        const bySubject = new Map();
        for (const g of gradesByClass[c.key].filter((x) => x.student_id === r.studentId)) {
          const b = bySubject.get(g.subject_id) ?? { sum: 0, coefs: 0, coefficient: g.coefficient };
          b.sum += (g.score / g.max_score) * 20 * g.evalCoef;
          b.coefs += g.evalCoef;
          bySubject.set(g.subject_id, b);
        }
        let ws = 0;
        let tc = 0;
        for (const b of bySubject.values()) {
          ws += (Math.round((b.sum / b.coefs) * 100) / 100) * b.coefficient;
          tc += b.coefficient;
        }
        return { r, average: tc ? Math.round((ws / tc) * 100) / 100 : 0 };
      })
      .sort((a, b) => b.average - a.average);
    perStudent.forEach(({ r, average }, i) => {
      cards.push({
        organization_id: ORG_ID,
        student_id: r.studentId,
        class_id: classId[c.key],
        semester: PERIOD[c.band],
        academic_year: YEAR,
        average_score: average,
        rank: i + 1,
        grades_completeness_pct: 100,
        publication_status: 'draft',
        appreciation: appreciation(average),
        generated_by: dirId,
        generated_at: at(past(D('2026-09-26')), 16, R.int(0, 30)),
      });
    });
  }
  await insertMany('school_report_cards', cards, { chunk: 250 });
  console.log(`  ✓ ${cards.length} bulletins provisoires (${CLASSES.length - CLASSES_WITHOUT_BULLETINS.length} classes ; 7e A et 10e A à générer)`);

  // Appels (10 derniers jours de classe)
  const schoolDays = [];
  for (let d = new Date(YESTERDAY); d >= RENTREE && schoolDays.length < 10; d = addDays(d, -1)) if (isWeekday(d)) schoolDays.push(new Date(d));
  const sessions = [];
  const records = [];
  const REMARKS = { absent: ['Malade', 'Absence non justifiée', 'Voyage familial', 'Rendez-vous médical'], late: ['Retard de 15 min', 'Retard (embouteillages)'], excused: ['Justificatif des parents'] };
  for (const d of schoolDays) {
    for (const c of CLASSES) {
      const sessionId = randomUUID();
      sessions.push({
        id: sessionId,
        organization_id: ORG_ID,
        class_id: classId[c.key],
        session_date: iso(d),
        notes: 'Appel du matin',
        source: 'manual',
        created_by: c.band === 'primaire' ? scolariteId : censeurId,
        created_at: at(d, 8, R.int(5, 25)),
      });
      for (const r of roster.filter((x) => x.cls.key === c.key)) {
        const u = R.next();
        const status = u < 0.035 ? 'absent' : u < 0.05 ? 'late' : u < 0.056 ? 'excused' : 'present';
        records.push({
          session_id: sessionId,
          organization_id: ORG_ID,
          student_id: r.studentId,
          status,
          remark: status === 'present' ? null : R.pick(REMARKS[status]),
          created_at: at(d, 8, 30),
        });
      }
    }
  }
  await insertMany('school_attendance_sessions', sessions, { chunk: 250 });
  await insertMany('school_attendance_records', records, { select: 'id', chunk: 1000 });
  console.log(`  ✓ ${sessions.length} appels, ${records.filter((x) => x.status === 'absent').length} absences, ${records.filter((x) => x.status === 'late').length} retards`);

  // Vie scolaire : actualités
  const posterPath = `${ORG_ID}/announcements/rentree-2026-2027.png`;
  await uploadPng(posterPath, RENTREE_SVG);
  const ANNOUNCEMENTS = [
    ['Résultats des examens nationaux 2026', 'Félicitations à nos candidats : 100 % de réussite au CEE, 94 % au BEPC et 88 % au baccalauréat unique. Merci aux enseignants et aux familles pour leur accompagnement.', 'results', '2026-08-20', null, '2026-08-20'],
    ['Rentrée scolaire 2026-2027', "La rentrée des classes aura lieu le lundi 7 septembre 2026 à 7 h 45 pour tous les niveaux. Les listes de fournitures sont disponibles au secrétariat. Tenue scolaire obligatoire dès le premier jour.", 'announcement', '2026-09-07', posterPath, '2026-09-01'],
    ['Paiement de la 1re tranche de scolarité', "Rappel : la 1re tranche (40 % des frais annuels) est à régler au plus tard le 15 septembre, à la caisse de l'établissement ou par Orange Money. Un reçu est remis pour chaque paiement.", 'announcement', '2026-09-15', null, '2026-09-09'],
    ['Réunion parents-professeurs', "Les parents d'élèves sont conviés à la réunion de rentrée le samedi 3 octobre 2026 à 10 h dans la grande salle : présentation des enseignants, du calendrier des évaluations et du règlement intérieur.", 'event', '2026-10-03', null, '2026-09-21'],
    ['Fête de l’Indépendance — pas de cours le 2 octobre', "À l'occasion de la fête nationale du 2 octobre, il n'y aura pas cours le vendredi. Reprise normale le lundi 5 octobre 2026.", 'holiday', '2026-10-02', null, '2026-09-24'],
    ['Journée sportive inter-classes', 'Tournoi de football et relais le samedi 17 octobre au terrain de sport de l’établissement. Inscriptions auprès de M. BANGOURA, professeur d’EPS.', 'event', '2026-10-17', null, '2026-09-25'],
  ];
  await insertMany(
    'school_announcements',
    ANNOUNCEMENTS.map(([title, body, category, eventDate, image, published]) => ({
      organization_id: ORG_ID,
      title,
      body,
      category,
      event_date: eventDate,
      visible_to_parents: true,
      visible_to_students: true,
      published_at: at(past(D(published)), 9, 15),
      created_at: at(past(D(published)), 9, 15),
      created_by: category === 'event' ? censeurId : dirId,
      image_path: image,
      image_paths: image ? [image] : [],
    }))
  );
  console.log(`  ✓ ${ANNOUNCEMENTS.length} actualités (vie scolaire)`);

  // Réglages établissement
  const stampCache = { base64: stampPng.toString('base64'), format: 'PNG' };
  await patchSettings((s) => {
    s.city = 'Conakry';
    s.phone = ORG_PHONE;
    s.tuition_fee_gnf = 2_500_000;
    s.accepts_student_applications = false;
    s.billing = { model: 'per_enrolled_student', configured_at: '2026-06-01T10:00:00Z' };
    s.receipt_seq_2026 = paidCount;
    s.student_payments = {
      enabled: true,
      allow_enrollment_payment: true,
      allow_reenrollment_payment: true,
      allow_tuition_payment: true,
      enrollment_new_fee_gnf: FEE_NEW,
      enrollment_reenrollment_fee_gnf: FEE_RE,
      min_payment_gnf: 100_000,
      tuition_installments: INSTALLMENTS,
      orange_money_enabled: true,
      orange_money_merchant_phone: '+224 622 45 67 89',
      orange_money_merchant_label: 'GS HORIZON',
      tuition_whatsapp_reminder_enabled: false,
    };
    s.student_matricules = {
      auto_generate_on_import: true,
      format: 'org_year_seq',
      org_prefix: 'GSH',
      seq_pad: 4,
      display_label: 'Matricule',
      counters: { 'GSH-26': matSeq['26'] ?? 0 },
    };
    const trimester = (n) => ({
      mode: 'trimester',
      periods: ['1er', '2e', '3e'].map((l, i) => ({ period_id: `T${i + 1}`, label: `${l} trimestre`, required_evaluations_per_subject: n })),
    });
    s.school = {
      ...(s.school ?? {}),
      registrar_can_record_payments: false,
      default_academic_year: YEAR,
      concluded_academic_years: [{ year: '2025-2026', concluded_at: '2026-07-31T17:00:00Z' }],
      grading_period_by_level: {
        primaire: trimester(2),
        college: trimester(2),
        lycee: {
          mode: 'semester',
          periods: [
            { period_id: 'S1', label: '1er semestre', required_evaluations_per_subject: 2 },
            { period_id: 'S2', label: '2e semestre', required_evaluations_per_subject: 2 },
          ],
        },
        universite: { mode: 'semester', periods: [{ period_id: 'S1', label: '1er semestre', required_evaluations_per_subject: 2 }] },
      },
      bulletin_default_exam_types: [],
      bulletin_template: {
        ...(s.school?.bulletin_template ?? {}),
        header_title: 'BULLETIN DE NOTES',
        header_subtitle: 'Groupe Scolaire Horizon — Primaire · Collège · Lycée',
        show_rank: true,
        show_appreciation: true,
        show_coefficients: true,
        show_all_subjects: true,
        show_evaluation_details: false,
        require_logo: true,
        require_stamp: true,
        footer_text: `Groupe Scolaire Horizon — ${ORG_ADDRESS} — Tél. ${ORG_PHONE}`,
        director_signature_label: 'La Directrice générale',
        primary_color: '0B5D3B',
        stamp: {
          document_id: stampDoc.id,
          file_name: 'cachet.png',
          processed_at: new Date().toISOString(),
          process_method: 'direct',
          pdf_cache: stampCache,
        },
      },
    };
  });
  console.log('  ✓ réglages : année 2026-2027, tranches, frais d’inscription, matricules GSH-26-xxxx, modèle de bulletin + cachet');

  const byClass = CLASSES.map((c) => `${c.name} (${roster.filter((r) => r.cls.key === c.key).length})`).join(', ');
  console.log('\n✅ Vitrine école prête —', byClass);
  console.log('   Direction :', VITRINE_ACCOUNTS.ecole.email, '| censeur : video.censeur.ecole@konadata.demo | comptable : video.comptable.ecole@konadata.demo');
  console.log('   Scolarité : video.scolarite.ecole@konadata.demo | enseignant : video.prof.ecole@konadata.demo | élève : video.eleve.ecole@konadata.demo');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
