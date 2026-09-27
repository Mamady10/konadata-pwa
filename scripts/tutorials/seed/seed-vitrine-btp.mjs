#!/usr/bin/env node
/**
 * Organisation vitrine BTP « Bâtir Guinée SARL » pour les tutoriels et vidéos.
 * Données cohérentes et datées par rapport à aujourd'hui (semaine en cours toujours remplie).
 * Ré-exécutable : purge les données de CETTE organisation uniquement, puis recrée tout.
 *
 * Usage : node scripts/tutorials/seed/seed-vitrine-btp.mjs
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const ORG_ID = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000b7001';
const R = rng(2026);
const TODAY = today();
const D = (s) => new Date(`${s}T12:00:00Z`);
const DAY = 86400000;
const FUEL_PRICE = 12000;

// ------------------------------------------------------------------ chantiers et plannings
const SITES = [
  {
    key: 'A',
    name: 'Immeuble R+4 Kipé',
    location: 'Kipé, Ratoma — Conakry',
    client: 'SCI Les Palmiers de Kipé',
    contract_ref: 'MA-2026-014',
    description: "Construction d'un immeuble résidentiel R+4 de 16 appartements avec parking.",
    moa_recipient: 'M. Thierno Ousmane DIALLO — Gérant, SCI Les Palmiers de Kipé',
    budget: 6_200_000_000,
    opening: 1_650_000_000,
    start: '2026-03-02',
    end: '2027-02-26',
    workers: [18, 26],
    planned_avg_workers: 22,
    fuel: [120, 250],
    planned_monthly_fuel_liters: 1400,
    delay_days: 4,
    financial_progress: 47,
    breakdown: { labor: 22, materials: 48, equipment: 12, subcontract: 12, overhead: 6 },
    tasks: [
      ['Installation de chantier', '2026-03-02', '2026-03-14'],
      ['Terrassements et fouilles', '2026-03-09', '2026-04-04'],
      ['Fondations (semelles, longrines)', '2026-03-30', '2026-05-16'],
      ['Soubassement et dallage RDC', '2026-05-11', '2026-06-13'],
      ['Élévation RDC et R+1', '2026-06-08', '2026-08-15'],
      ['Dalles R+1 et R+2', '2026-07-20', '2026-09-19', 0.94],
      ['Élévation R+2 et R+3', '2026-09-07', '2026-11-14', 0.8],
      ['Réseaux (gaines électricité, plomberie)', '2026-09-28', '2026-12-31'],
      ['Dalles R+3 et R+4', '2026-10-19', '2026-12-19'],
      ['Enduits et revêtements', '2026-11-16', '2027-02-12'],
      ['Toiture-terrasse et étanchéité', '2026-12-14', '2027-01-23'],
      ['Menuiseries et peinture', '2027-01-11', '2027-02-26'],
    ],
    milestones: [
      ['Fondations achevées', 12, '2026-05-16'],
      ['Gros œuvre RDC + R+1', 30, '2026-08-15'],
      ['Dalle R+2 coulée', 45, '2026-09-19'],
      ['Gros œuvre terminé', 70, '2026-12-19'],
      ['Réception provisoire', 100, '2027-02-26'],
    ],
    activities: {
      'Dalles R+1 et R+2': ['décoffrage dalle R+2 bloc A', 'coulage dalle R+2 bloc B', 'ferraillage dalle R+2'],
      'Élévation R+2 et R+3': ['coffrage poteaux R+3', 'élévation murs agglos R+3', 'ferraillage poutres R+3'],
      'Élévation RDC et R+1': ['élévation murs R+1', 'chaînages R+1'],
    },
  },
  {
    key: 'B',
    name: 'Centre de santé de Coyah',
    location: 'Coyah centre',
    client: 'Ministère de la Santé — PNDS',
    contract_ref: 'AO-MS-2026-031',
    description: "Construction d'un centre de santé (consultations, maternité, pharmacie) et de ses annexes.",
    moa_recipient: 'Direction préfectorale de la santé de Coyah',
    budget: 2_850_000_000,
    opening: 420_000_000,
    start: '2026-05-04',
    end: '2026-12-18',
    workers: [11, 16],
    planned_avg_workers: 14,
    fuel: [70, 150],
    planned_monthly_fuel_liters: 700,
    delay_days: 6,
    financial_progress: 52,
    breakdown: { labor: 25, materials: 45, equipment: 10, subcontract: 14, overhead: 6 },
    tasks: [
      ['Installation de chantier', '2026-05-04', '2026-05-16'],
      ['Terrassements et fondations', '2026-05-11', '2026-06-27'],
      ['Élévation des murs', '2026-06-22', '2026-08-29'],
      ['Charpente et couverture', '2026-08-17', '2026-09-26', 0.86],
      ['Plomberie et électricité', '2026-09-07', '2026-11-06', 0.75],
      ['Enduits et carrelage', '2026-09-28', '2026-11-27'],
      ['Menuiseries et peinture', '2026-11-02', '2026-12-11'],
      ['VRD et clôture', '2026-11-16', '2026-12-18'],
    ],
    milestones: [
      ['Fondations achevées', 20, '2026-06-27'],
      ['Hors d’eau', 60, '2026-09-26'],
      ['Réception provisoire', 100, '2026-12-18'],
    ],
    activities: {
      'Charpente et couverture': ['pose charpente métallique bloc maternité', 'pose des tôles bac alu'],
      'Plomberie et électricité': ['saignées et gaines électriques', 'réseau d’eau froide'],
      'Élévation des murs': ['élévation murs bloc consultations'],
    },
  },
  {
    key: 'C',
    name: 'Route Dubréka – Khorira (8 km)',
    location: 'Dubréka',
    client: 'Préfecture de Dubréka — Programme routes rurales',
    contract_ref: 'MR-DBK-2026-007',
    description: 'Réhabilitation de 8 km de route en latérite avec revêtement bicouche et ouvrages hydrauliques.',
    moa_recipient: 'Direction préfectorale des travaux publics de Dubréka',
    budget: 9_400_000_000,
    opening: 2_900_000_000,
    start: '2026-02-02',
    end: '2027-01-29',
    workers: [24, 34],
    planned_avg_workers: 30,
    fuel: [450, 800],
    planned_monthly_fuel_liters: 4200,
    delay_days: 0,
    financial_progress: 60,
    breakdown: { labor: 15, materials: 35, equipment: 30, subcontract: 15, overhead: 5 },
    tasks: [
      ['Installation et déviations', '2026-02-02', '2026-02-21'],
      ['Débroussaillage et décapage', '2026-02-16', '2026-03-28'],
      ['Terrassements (déblais / remblais)', '2026-03-16', '2026-06-27'],
      ['Ouvrages hydrauliques (dalots, buses)', '2026-05-04', '2026-09-12'],
      ['Couche de fondation', '2026-06-15', '2026-10-10', 0.97],
      ['Couche de base', '2026-08-31', '2026-11-21'],
      ['Revêtement bicouche', '2026-10-26', '2026-12-26'],
      ['Signalisation et finitions', '2026-12-14', '2027-01-29'],
    ],
    milestones: [
      ['Terrassements terminés', 35, '2026-06-27'],
      ['Ouvrages hydrauliques posés', 55, '2026-09-12'],
      ['Mise en circulation', 100, '2027-01-29'],
    ],
    activities: {
      'Couche de fondation': ['mise en œuvre graveleux latéritique PK 5+200 à PK 5+800', 'compactage couche de fondation'],
      'Couche de base': ['réglage couche de base PK 2+000', 'arrosage et compactage'],
      'Ouvrages hydrauliques (dalots, buses)': ['pose buses Ø1000 PK 6+400'],
    },
  },
];

const COMPLETED_SITE = {
  name: 'École primaire de Kindia (6 classes)',
  location: 'Kindia',
  client: 'Commune urbaine de Kindia',
  contract_ref: 'MA-KIN-2025-022',
  description: "Construction d'une école primaire de 6 classes avec bloc administratif et latrines.",
  moa_recipient: 'Commune urbaine de Kindia',
  budget: 1_350_000_000,
  opening_spent: 1_310_000_000,
  spent: 1_310_000_000,
  status: 'completed',
  physical_progress: 100,
  financial_progress: 97,
  delay_days: 0,
  start_date: '2025-11-03',
  end_date: '2026-07-31',
  completed_at: '2026-07-24T12:00:00Z',
  closure_comment: 'Réception provisoire prononcée sans réserve majeure.',
};

const uid = (k, i) => `t-${k.toLowerCase()}${String(i + 1).padStart(2, '0')}`;
const dur = (a, b) => Math.round((D(b) - D(a)) / DAY) + 1;

function buildTasks(site) {
  const total = site.tasks.reduce((s, t) => s + dur(t[1], t[2]), 0);
  return site.tasks.map((t, i) => ({
    uid: uid(site.key, i),
    name: t[0],
    startDate: t[1],
    finishDate: t[2],
    durationDays: dur(t[1], t[2]),
    weight: dur(t[1], t[2]),
    weightPct: Math.round((dur(t[1], t[2]) / total) * 10000) / 100,
    factor: t[3] ?? 1,
    isMilestone: false,
    outlineLevel: 1,
    sortOrder: i,
  }));
}

function plannedPct(task, date) {
  const s = D(task.startDate);
  const f = D(task.finishDate);
  if (date < s) return 0;
  if (date >= f) return 100;
  return Math.min(100, ((date - s) / DAY + 1) / task.durationDays * 100);
}

function actualPct(task, date) {
  const p = plannedPct(task, date) * task.factor;
  return Math.round(Math.min(100, p) * 10) / 10;
}

// ------------------------------------------------------------------ personnes
const WORKERS = [
  ['Mamadou Saliou BALDÉ', "Chef d'équipe coffrage", 180000, 'A', 'M'],
  ['Ousmane KEÏTA', 'Maçon', 150000, 'A', 'M'],
  ['Sékou TOURÉ', 'Maçon', 150000, 'A', 'M'],
  ['Alseny SOUMAH', 'Ferrailleur', 160000, 'A', 'M'],
  ['Mohamed CAMARA', 'Ferrailleur', 160000, 'A', 'M'],
  ['Ibrahima KOUROUMA', 'Coffreur', 150000, 'A', 'M'],
  ['Lansana SYLLA', 'Manœuvre', 90000, 'A', 'M'],
  ['Abdoulaye BAH', 'Manœuvre', 90000, 'A', 'M'],
  ['Aïssatou BARRY', 'Magasinière', 140000, 'A', 'F'],
  ['Fodé BANGOURA', 'Électricien', 170000, 'B', 'M'],
  ['Aboubacar DIALLO', 'Plombier', 170000, 'B', 'M'],
  ['Moussa CISSÉ', 'Maçon', 150000, 'B', 'M'],
  ['Karamo KONATÉ', 'Manœuvre', 90000, 'B', 'M'],
  ['Amara TRAORÉ', "Conducteur d'engin (niveleuse)", 220000, 'C', 'M'],
  ['Sidiki FOFANA', "Conducteur d'engin (compacteur)", 220000, 'C', 'M'],
  ['Mamady KANTÉ', 'Chauffeur camion benne', 180000, 'C', 'M'],
  ['Djibril SOW', 'Topographe', 250000, 'C', 'M'],
];

const EQUIPMENT = [
  ['Bétonnière 350 L', 'Bétonnière', 'BTN-02', 640, 'operational', 'A'],
  ['Monte-charge 500 kg', 'Levage', 'MC-01', 420, 'operational', 'A'],
  ['Vibrateur à aiguille', 'Petit matériel', 'VIB-05', 310, 'operational', 'A'],
  ['Groupe électrogène 60 kVA', 'Énergie', 'GE-60-01', 760, 'maintenance', 'B'],
  ['Pelle hydraulique CAT 320', 'Terrassement', 'RC-4521-A', 1850, 'operational', 'C'],
  ['Niveleuse CAT 140K', 'Terrassement', 'RC-7812-B', 1320, 'operational', 'C'],
  ['Compacteur BOMAG BW 213', 'Compactage', 'RC-3345-C', 980, 'operational', 'C'],
  ['Camion benne Sinotruk 25 t', 'Transport', 'RC-9021-D', 2100, 'operational', 'C'],
];

const STOCK = [
  ['Ciment CPJ 42.5 (sac de 50 kg)', 'sac', 180, 150, 'materials', 'A'],
  ['Fer HA10 (barre de 12 m)', 'barre', 95, 120, 'materials', 'A'],
  ['Fer HA12 (barre de 12 m)', 'barre', 40, 100, 'materials', 'A'],
  ['Agglos creux 15', 'u', 2600, 1500, 'materials', 'A'],
  ['Sable', 'm³', 18, 10, 'materials', 'A'],
  ['Gravier', 'm³', 12, 10, 'materials', 'A'],
  ['Carreaux 40×40', 'm²', 320, 100, 'materials', 'B'],
  ['Ciment CPJ 42.5 (sac de 50 kg)', 'sac', 60, 80, 'materials', 'B'],
  ['Gasoil', 'L', 1800, 1000, 'consumables', null],
  ['Casques et gilets (EPI)', 'u', 14, 20, 'tools', null],
];

// ------------------------------------------------------------------ catalogue de prix
const CATALOG = [
  ['Ciment CPJ 42.5 (sac de 50 kg)', 'sac', 95000, 'materials'],
  ['Sable', 'm³', 180000, 'materials'],
  ['Gravier', 'm³', 350000, 'materials'],
  ['Fer HA6 (barre de 12 m)', 'barre', 35000, 'materials'],
  ['Fer HA8 (barre de 12 m)', 'barre', 55000, 'materials'],
  ['Fer HA10 (barre de 12 m)', 'barre', 85000, 'materials'],
  ['Fer HA12 (barre de 12 m)', 'barre', 120000, 'materials'],
  ['Fer HA14 (barre de 12 m)', 'barre', 165000, 'materials'],
  ['Fer HA16 (barre de 12 m)', 'barre', 215000, 'materials'],
  ['Fer HA20 (barre de 12 m)', 'barre', 335000, 'materials'],
  ['Fil à ligaturer', 'kg', 25000, 'materials'],
  ['Coffrage bois (surface à coffrer)', 'm²', 45000, 'materials'],
  ['Agglos creux 10', 'u', 4500, 'materials'],
  ['Agglos creux 15', 'u', 5500, 'materials'],
  ['Agglos creux 20', 'u', 7000, 'materials'],
  ['Agglos pleins 15', 'u', 7500, 'materials'],
  ['Agglos pleins 20', 'u', 9000, 'materials'],
  ['Carreaux', 'm²', 120000, 'materials'],
  ['Ciment blanc (joints)', 'kg', 12000, 'materials'],
  ["Peinture d'impression", 'L', 45000, 'materials'],
  ['Peinture de finition', 'L', 65000, 'materials'],
  ['Clôture de chantier en tôles', 'ml', 85000, 'materials'],
  ['Baraque de chantier (bureau et magasin)', 'ft', 6500000, 'materials'],
  ['Location bétonnière', 'jour', 350000, 'equipment'],
  ['Location vibrateur', 'jour', 150000, 'equipment'],
  ['Location pelle hydraulique', 'jour', 3500000, 'equipment'],
  ['Transport de matériaux', 'voyage', 450000, 'equipment'],
  ["Main d'œuvre", 'ft', 0, 'labor'],
  ["Main d'œuvre qualifiée (maçon, ferrailleur)", 'jour', 150000, 'labor'],
  ['Manœuvre', 'jour', 90000, 'labor'],
  ['Suivi et contrôle du chantier', 'ft', 0, 'supervision'],
];

// ------------------------------------------------------------------ utilitaires
const workDays = (from, to) => {
  const out = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) if (d.getUTCDay() !== 0) out.push(new Date(d));
  return out;
};
const WEATHER = ['Ensoleillé', 'Nuageux', 'Couvert', 'Averses l’après-midi', 'Pluie matinale', 'Ensoleillé', 'Nuageux'];
const EXTRAS = [
  'HSE : briefing sécurité, port des EPI vérifié.',
  'Arrêt de 2 h pour forte pluie.',
  'Visite du bureau de contrôle : RAS.',
  'Nettoyage et rangement du chantier.',
  '',
  '',
];

async function storageCleanup() {
  const { data } = await admin.storage.from('documents').list(ORG_ID, { limit: 1000 });
  const files = (data ?? []).filter((f) => f.id).map((f) => `${ORG_ID}/${f.name}`);
  if (files.length) await admin.storage.from('documents').remove(files);
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="280" viewBox="0 0 1000 280">
  <rect x="0" y="0" width="1000" height="280" rx="40" fill="#FFFFFF"/>
  <rect x="10" y="20" width="240" height="240" rx="48" fill="#0F2A4A"/>
  <rect x="62" y="120" width="44" height="104" fill="#F59E0B"/>
  <rect x="118" y="84" width="44" height="140" fill="#FBBF24"/>
  <rect x="174" y="140" width="34" height="84" fill="#F59E0B"/>
  <path d="M52 76 L202 50" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round"/>
  <path d="M184 54 L184 96" stroke="#FFFFFF" stroke-width="6"/>
  <text x="285" y="140" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="104" fill="#0F2A4A">BÂTIR</text>
  <text x="285" y="228" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="78" fill="#F59E0B">GUINÉE</text>
  <text x="610" y="226" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="30" fill="#475569">SARL · BTP</text>
</svg>`;

// ------------------------------------------------------------------ main
async function main() {
  console.log('🏗️  Organisation vitrine BTP —', VITRINE_ORGS.btp.name);
  await ensureOrg({
    id: ORG_ID,
    name: VITRINE_ORGS.btp.name,
    type: 'btp',
    email: 'contact@batir-guinee.demo',
    phone: '+224 620 00 00 00',
    address: 'Immeuble Kaloum Center, Conakry',
  });

  const dirId = await ensureMember(ORG_ID, { ...VITRINE_ACCOUNTS.btp, phone: '+224 620 11 22 33', intent: 'org_admin', onboarding: 'director' });
  const chefId = await ensureMember(ORG_ID, { ...VITRINE_ACCOUNTS['btp-chef'], phone: '+224 621 44 55 66' });
  const condId = await ensureMember(ORG_ID, {
    email: 'video.conducteur.btp@konadata.demo',
    fullName: 'Mamadou Saliou DIALLO',
    role: 'btp_staff',
    phone: '+224 622 77 88 99',
  });
  await finalizeOrgSettings(ORG_ID, dirId);
  await uploadLogo(ORG_ID, LOGO_SVG);
  console.log('  ✓ organisation, abonnement, CGU, 3 utilisateurs, logo');

  await storageCleanup();
  await wipe(ORG_ID, [
    'btp_site_documents',
    'documents',
    'btp_stock_movements',
    'btp_stock',
    'btp_labor_entries',
    'btp_personnel',
    'core_persons',
    'btp_fuel_logs',
    'btp_delivery_notes',
    'btp_site_expenses',
    'btp_contracts',
    'btp_daily_progress',
    'btp_site_milestones',
    'btp_site_planning_refs',
    'btp_equipment',
    'collaborator_assignments',
    'btp_quote_access',
    'btp_quotes',
    'btp_price_catalog',
    'organization_ai_generated_reports',
    'btp_sites',
  ]);
  console.log('  ✓ purge des anciennes données de la vitrine');

  // Chantiers
  const siteRows = SITES.map((s) => ({
    organization_id: ORG_ID,
    name: s.name,
    location: s.location,
    client: s.client,
    contract_ref: s.contract_ref,
    description: s.description,
    moa_recipient: s.moa_recipient,
    budget: s.budget,
    opening_spent: s.opening,
    spent: s.opening,
    currency: 'GNF',
    status: 'active',
    physical_progress: 0,
    financial_progress: s.financial_progress,
    delay_days: s.delay_days,
    start_date: s.start,
    end_date: s.end,
    planned_avg_workers: s.planned_avg_workers,
    planned_monthly_fuel_liters: s.planned_monthly_fuel_liters,
    budget_alert_pct: 90,
    budget_breakdown: s.breakdown,
    default_planning_ref_slot: 1,
  }));
  const inserted = await insertMany('btp_sites', siteRows, { select: 'id, name' });
  const siteId = Object.fromEntries(SITES.map((s) => [s.key, inserted.find((r) => r.name === s.name).id]));
  await insertMany('btp_sites', [{ organization_id: ORG_ID, currency: 'GNF', budget_breakdown: {}, ...COMPLETED_SITE }]);
  console.log('  ✓ 4 chantiers');

  // Plannings + jalons
  const tasksBySite = {};
  const refs = [];
  const milestones = [];
  for (const s of SITES) {
    const tasks = buildTasks(s);
    tasksBySite[s.key] = tasks;
    refs.push({
      organization_id: ORG_ID,
      site_id: siteId[s.key],
      slot: 1,
      label: 'Planning contractuel',
      source_type: 'tasks',
      start_date: s.start,
      end_date: s.end,
      project_title: s.name,
      milestones: [],
      tasks: tasks.map(({ factor, weightPct, ...t }) => t),
    });
    refs.push({
      organization_id: ORG_ID,
      site_id: siteId[s.key],
      slot: 2,
      label: 'Référence 2 — À configurer',
      source_type: 'linear',
      start_date: s.start,
      end_date: s.end,
      milestones: [],
      tasks: [],
    });
    s.milestones.forEach(([label, pct, date], i) =>
      milestones.push({ organization_id: ORG_ID, site_id: siteId[s.key], label, target_physical_pct: pct, planned_date: date, sort_order: i })
    );
  }
  await insertMany('btp_site_planning_refs', refs);
  await insertMany('btp_site_milestones', milestones);
  console.log('  ✓ plannings par tâches et jalons');

  // Personnel + pointage
  const persons = await insertMany(
    'core_persons',
    WORKERS.map(([name, , , , g], i) => ({
      organization_id: ORG_ID,
      kind: 'worker',
      full_name: name,
      phone: `+224 62${i % 10} ${String(100 + i * 7).slice(-3)} ${String(20 + i * 3).padStart(2, '0')} ${String(40 + i).slice(-2)}`,
      gender: g,
    })),
    { select: 'id, full_name' }
  );
  const personnel = await insertMany(
    'btp_personnel',
    WORKERS.map(([name, role, rate, site]) => ({
      organization_id: ORG_ID,
      site_id: siteId[site],
      person_id: persons.find((p) => p.full_name === name).id,
      role,
      daily_rate: rate,
      is_active: true,
      monthly_salary: 0,
    })),
    { select: 'id, site_id, daily_rate' }
  );
  const labor = [];
  for (const p of personnel) {
    for (const d of workDays(addDays(TODAY, -34), addDays(TODAY, -1))) {
      if (R.next() < 0.06) continue;
      const days = d.getUTCDay() === 6 ? 0.5 : 1;
      labor.push({ organization_id: ORG_ID, site_id: p.site_id, personnel_id: p.id, work_date: iso(d), days, daily_rate: p.daily_rate });
    }
  }
  await insertMany('btp_labor_entries', labor, { select: 'id', chunk: 500 });
  console.log(`  ✓ ${personnel.length} ouvriers, ${labor.length} pointages`);

  // Matériels et stock
  const equipment = await insertMany(
    'btp_equipment',
    EQUIPMENT.map(([name, type, reg, hours, status, site]) => ({
      organization_id: ORG_ID,
      site_id: siteId[site],
      name,
      type,
      registration: reg,
      hours_used: hours,
      status,
    })),
    { select: 'id, site_id, name' }
  );
  const stock = await insertMany(
    'btp_stock',
    STOCK.map(([item, unit, qty, min, category, site]) => ({
      organization_id: ORG_ID,
      site_id: site ? siteId[site] : null,
      item_name: item,
      unit,
      quantity: qty,
      min_threshold: min,
      category,
      last_updated: addDays(TODAY, -R.int(0, 4)).toISOString(),
    })),
    { select: 'id, item_name, site_id' }
  );
  console.log('  ✓ matériels et stock');

  // Bons de livraison
  const notes = [];
  let ref = 330;
  const bl = (site, date, supplier, items, description) => {
    ref += 1;
    const total = items.reduce((s, it) => s + it.qty * it.price, 0);
    notes.push({
      organization_id: ORG_ID,
      site_id: siteId[site],
      reference: `BL-2026-0${ref}`,
      supplier,
      total_amount: total,
      delivery_date: iso(date),
      description,
      status: 'validated',
      items: items.map(({ price, ...it }) => it),
    });
  };
  const monthly = {
    A: [
      ['Cimenterie de Conakry', [{ item: 'Ciment CPJ 42.5 (sac de 50 kg)', category: 'materials', qty: 400, unit: 'sac', price: 95000 }]],
      ['Fer et Aciers de Kaloum', [{ item: 'Fer HA12 (barre de 12 m)', category: 'materials', qty: 180, unit: 'barre', price: 120000 }, { item: 'Fer HA8 (barre de 12 m)', category: 'materials', qty: 150, unit: 'barre', price: 55000 }]],
      ['Carrière de Kagbélen', [{ item: 'Gravier', category: 'materials', qty: 40, unit: 'm³', price: 350000 }, { item: 'Sable', category: 'materials', qty: 35, unit: 'm³', price: 180000 }]],
    ],
    B: [
      ['Quincaillerie de Coyah', [{ item: 'Ciment CPJ 42.5 (sac de 50 kg)', category: 'materials', qty: 220, unit: 'sac', price: 95000 }, { item: 'Agglos creux 15', category: 'materials', qty: 3000, unit: 'u', price: 5500 }]],
    ],
    C: [
      ['Carrière de Kagbélen', [{ item: 'Graveleux latéritique', category: 'materials', qty: 1600, unit: 'm³', price: 45000 }]],
      ['Buses et Dalots de Kindia', [{ item: 'Buses béton Ø1000', category: 'materials', qty: 24, unit: 'u', price: 850000 }]],
    ],
  };
  for (const s of SITES) {
    for (let d = addDays(D(s.start), 20); d < addDays(TODAY, -21); d = addDays(d, 30)) {
      const [supplier, items] = R.pick(monthly[s.key]);
      bl(s.key, d, supplier, items, 'Approvisionnement mensuel');
    }
  }
  const w = (n) => addDays(TODAY, n);
  bl('A', w(-27), 'Bois et Coffrage Madina', [{ item: 'Contreplaqué de coffrage 18 mm', category: 'materials', qty: 120, unit: 'plaque', price: 180000 }], 'Coffrage dalles R+2');
  bl('A', w(-17), 'Agglos Matoto', [{ item: 'Agglos creux 15', category: 'materials', qty: 4000, unit: 'u', price: 5500 }], 'Élévation R+2');
  bl('B', w(-19), 'Électricité Générale de Guinée', [{ item: 'Câbles et gaines électriques', category: 'materials', qty: 1, unit: 'lot', price: 18400000 }], 'Réseau électrique');
  bl('C', w(-12), 'Bitumes de l’Ouest', [{ item: 'Émulsion de bitume', category: 'materials', qty: 12, unit: 't', price: 8000000 }], 'Préparation revêtement');
  bl('B', w(-6), 'Quincaillerie de Coyah', [{ item: 'Tôles bac alu 6/10', category: 'materials', qty: 450, unit: 'u', price: 65000 }], 'Couverture bloc maternité');
  bl('A', w(-5), 'Cimenterie de Conakry', [{ item: 'Ciment CPJ 42.5 (sac de 50 kg)', category: 'materials', qty: 300, unit: 'sac', price: 95000 }], 'Poteaux et murs R+3');
  bl('C', w(-4), 'Carrière de Kagbélen', [{ item: 'Graveleux latéritique', category: 'materials', qty: 1200, unit: 'm³', price: 45000 }], 'Couche de fondation PK 5');
  bl('A', w(-3), 'Fer et Aciers de Kaloum', [{ item: 'Fer HA10 (barre de 12 m)', category: 'materials', qty: 120, unit: 'barre', price: 85000 }, { item: 'Fer HA12 (barre de 12 m)', category: 'materials', qty: 80, unit: 'barre', price: 120000 }], 'Poutres R+3');
  bl('A', w(-2), 'Carrière de Kagbélen', [{ item: 'Gravier', category: 'materials', qty: 30, unit: 'm³', price: 350000 }, { item: 'Sable', category: 'materials', qty: 25, unit: 'm³', price: 180000 }], 'Béton poteaux R+3');
  const noteRows = await insertMany('btp_delivery_notes', notes, { select: 'id, reference' });
  console.log(`  ✓ ${noteRows.length} bons de livraison`);

  // Mouvements de stock (sorties récentes)
  const stockA = (name) => stock.find((s) => s.item_name === name && s.site_id === siteId.A);
  const moves = [
    [stockA('Ciment CPJ 42.5 (sac de 50 kg)'), 'in', 300, w(-5), 'Réception BL ciment', null],
    [stockA('Ciment CPJ 42.5 (sac de 50 kg)'), 'out', 85, w(-4), 'Béton poteaux R+3', 'Mamadou Saliou BALDÉ'],
    [stockA('Ciment CPJ 42.5 (sac de 50 kg)'), 'out', 60, w(-2), 'Mortier maçonnerie R+3', 'Ousmane KEÏTA'],
    [stockA('Fer HA10 (barre de 12 m)'), 'in', 120, w(-3), 'Réception BL aciers', null],
    [stockA('Fer HA12 (barre de 12 m)'), 'out', 60, w(-2), 'Ferraillage poutres R+3', 'Alseny SOUMAH'],
    [stockA('Agglos creux 15'), 'out', 900, w(-1), 'Élévation murs R+3', 'Sékou TOURÉ'],
  ];
  await insertMany(
    'btp_stock_movements',
    moves.map(([st, type, qty, date, notesTxt, requester]) => ({
      organization_id: ORG_ID,
      stock_id: st.id,
      movement_type: type,
      quantity: qty,
      site_id: siteId.A,
      requester_name: requester,
      notes: notesTxt,
      movement_date: iso(date),
      created_by: dirId,
    }))
  );

  // Carburant (13 mois max) + anomalies
  const fuel = [];
  for (const s of SITES) {
    const eq = equipment.filter((e) => e.site_id === siteId[s.key]);
    const from = new Date(Math.max(D(s.start), addDays(TODAY, -390)));
    for (let d = addDays(from, 2); d <= addDays(TODAY, -1); d = addDays(d, R.int(3, 5))) {
      if (d.getUTCDay() === 0) continue;
      const liters = R.round(s.fuel[0], s.fuel[1], 5);
      fuel.push({
        organization_id: ORG_ID,
        site_id: siteId[s.key],
        equipment_id: eq.length ? R.pick(eq).id : null,
        liters,
        cost: liters * FUEL_PRICE,
        logged_by: chefId,
        is_anomaly: false,
        notes: null,
        logged_at: `${iso(d)}T08:30:00Z`,
      });
    }
  }
  const anomaly = (key, date, liters, eqName, note) => {
    const eq = equipment.find((e) => e.name === eqName);
    fuel.push({
      organization_id: ORG_ID,
      site_id: siteId[key],
      equipment_id: eq?.id ?? null,
      liters,
      cost: liters * FUEL_PRICE,
      logged_by: chefId,
      is_anomaly: true,
      notes: note,
      logged_at: `${iso(date)}T09:15:00Z`,
    });
  };
  anomaly('A', w(-15), 410, 'Bétonnière 350 L', 'Consommation anormale : +65 % par rapport à la moyenne du chantier — contrôle demandé.');
  anomaly('C', w(-3), 1180, 'Niveleuse CAT 140K', 'Écart de 48 % par rapport à la moyenne — vérification du plein de la niveleuse.');
  anomaly('B', w(-39), 290, 'Groupe électrogène 60 kVA', 'Plein supérieur à la capacité du réservoir — à justifier.');
  fuel.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  await insertMany('btp_fuel_logs', fuel, { select: 'id', chunk: 500 });
  console.log(`  ✓ ${fuel.length} relevés carburant (3 anomalies)`);

  // Dépenses et contrats
  await insertMany('btp_site_expenses', [
    { organization_id: ORG_ID, site_id: siteId.A, category: 'overhead', amount: 6500000, expense_date: iso(w(-22)), description: 'Gardiennage du chantier — septembre', supplier: 'Sécurité Plus Guinée', created_by: dirId },
    { organization_id: ORG_ID, site_id: siteId.A, category: 'equipment', amount: 9000000, expense_date: iso(w(-26)), description: 'Location monte-charge — septembre', supplier: 'Loc Matériel Conakry', created_by: dirId },
    { organization_id: ORG_ID, site_id: siteId.A, category: 'subcontract', amount: 45000000, expense_date: iso(w(-12)), description: 'Plomberie — acompte 30 %', supplier: 'Sanitaires Pro SARL', reference: 'FAC-SP-118', created_by: dirId },
    { organization_id: ORG_ID, site_id: siteId.B, category: 'subcontract', amount: 120000000, expense_date: iso(w(-15)), description: 'Charpente métallique — situation n°2', supplier: 'Métal Construction Guinée', reference: 'SIT-02', created_by: dirId },
    { organization_id: ORG_ID, site_id: siteId.B, category: 'overhead', amount: 4800000, expense_date: iso(w(-9)), description: 'Essais de laboratoire (béton)', supplier: 'Laboratoire National du BTP', created_by: dirId },
    { organization_id: ORG_ID, site_id: siteId.C, category: 'subcontract', amount: 380000000, expense_date: iso(w(-28)), description: 'Ouvrages hydrauliques — situation n°3', supplier: 'BTP Fouta SARL', reference: 'SIT-03', created_by: dirId },
    { organization_id: ORG_ID, site_id: siteId.C, category: 'equipment', amount: 72000000, expense_date: iso(w(-27)), description: 'Location niveleuse — août', supplier: 'Loc Matériel Conakry', created_by: dirId },
  ]);
  await insertMany('btp_contracts', [
    { organization_id: ORG_ID, site_id: siteId.A, title: 'Plomberie sanitaire', contractor: 'Sanitaires Pro SARL', amount: 150000000, paid_amount: 45000000, signed_date: '2026-08-20', contract_type: 'subcontract', status: 'active' },
    { organization_id: ORG_ID, site_id: siteId.B, title: 'Charpente et couverture', contractor: 'Métal Construction Guinée', amount: 260000000, paid_amount: 120000000, signed_date: '2026-07-10', contract_type: 'subcontract', status: 'active' },
    { organization_id: ORG_ID, site_id: siteId.C, title: 'Ouvrages hydrauliques', contractor: 'BTP Fouta SARL', amount: 1100000000, paid_amount: 760000000, signed_date: '2026-04-15', contract_type: 'subcontract', status: 'active' },
  ]);
  console.log('  ✓ dépenses et contrats de sous-traitance');

  // Fiches journalières (historique hebdomadaire + 6 dernières semaines quotidiennes)
  const WEEK_NOTES_A = [
    'Travaux : décoffrage dalle R+2 bloc A, ferraillage poteaux R+3. HSE : briefing sécurité du lundi, port des EPI vérifié.',
    'Travaux : coffrage poteaux R+3 (P1 à P8). Livraison de 300 sacs de ciment CPJ 42.5 réceptionnée.',
    'Travaux : élévation murs agglos R+3 façade nord. Arrêt de 2 h pour forte pluie l’après-midi.',
    'Travaux : ferraillage poutres R+3, réception des aciers HA10 / HA12.',
    'Travaux : coulage poteaux R+3 (8 m³). Visite du bureau de contrôle : RAS.',
    'Travaux : maçonnerie R+3 et nettoyage de fin de semaine.',
  ];
  const monday = addDays(TODAY, -((TODAY.getUTCDay() + 6) % 7));
  let progressCount = 0;
  for (const s of SITES) {
    const tasks = tasksBySite[s.key];
    const dailyFrom = addDays(TODAY, -42);
    const dates = [];
    for (let d = addDays(D(s.start), 11); d < dailyFrom; d = addDays(d, 7)) dates.push(d);
    dates.push(...workDays(dailyFrom, addDays(TODAY, -1)));
    const rows = dates.map((d) => {
      const tp = tasks
        .filter((t) => D(t.startDate) <= d)
        .map((t) => ({ uid: t.uid, name: t.name, pct: actualPct(t, d), weight: t.weightPct }));
      const physical = Math.round(tasks.reduce((sum, t) => sum + actualPct(t, d) * t.weightPct, 0) / 100 * 10) / 10;
      const active = tasks.filter((t) => D(t.startDate) <= d && actualPct(t, d) < 100);
      const act = active.map((t) => R.pick(s.activities[t.name] ?? [t.name.toLowerCase()])).slice(0, 2);
      const dayIdx = Math.round((d - monday) / DAY);
      const notesTxt =
        s.key === 'A' && dayIdx >= 0 && dayIdx < 6
          ? WEEK_NOTES_A[dayIdx]
          : `Travaux : ${act.join(', ') || 'finitions et nettoyage'}. ${R.pick(EXTRAS)}`.trim();
      return {
        organization_id: ORG_ID,
        site_id: siteId[s.key],
        progress_date: iso(d),
        physical_pct: physical,
        workers_count: R.int(s.workers[0], s.workers[1]),
        weather: R.pick(WEATHER),
        notes: notesTxt,
        task_progress: tp,
        created_by: s.key === 'C' ? condId : chefId,
      };
    });
    for (const row of rows) must(await admin.from('btp_daily_progress').insert(row), 'fiche journalière');
    progressCount += rows.length;
  }
  console.log(`  ✓ ${progressCount} fiches journalières (avancement par tâche)`);

  // Photos de la semaine (chantier A)
  const PHOTOS = [
    ['Briefing_securite_HSE.jpg', 0],
    ['Livraison_ciment_300_sacs.jpg', 1],
    ['Coffrage_poteaux_R+2.jpg', 1],
    ['Elevation_murs_agglos_R+3.jpg', 2],
    ['Ferraillage_poutres_R+3.jpg', 3],
    ['Coulage_dalle_R+2.jpg', 4],
  ];
  for (const [file, offset] of PHOTOS) {
    const date = addDays(monday, offset);
    const buffer = await readFile(path.join(__dir, 'assets', 'btp', file));
    const docId = await uploadDocument(ORG_ID, chefId, {
      fileName: file,
      buffer,
      mimeType: 'image/jpeg',
      category: 'other',
      createdAt: `${iso(date)}T15:00:00Z`,
      extracted: { document_type: 'site_photo', document_type_label: 'Photo de chantier', site_id: siteId.A, photo_date: iso(date) },
    });
    must(await admin.from('btp_site_documents').insert({ organization_id: ORG_ID, site_id: siteId.A, document_id: docId, doc_type: 'site_photo' }), 'lien photo');
  }
  console.log('  ✓ 6 photos de chantier (semaine en cours)');

  // Assignations et accès devis
  await insertMany('collaborator_assignments', [
    ...['A', 'B'].map((k) => ({ organization_id: ORG_ID, profile_id: chefId, resource_type: 'btp_site', resource_id: siteId[k], can_import: false, can_upload: true, can_edit: true, assigned_by: dirId })),
    { organization_id: ORG_ID, profile_id: condId, resource_type: 'btp_site', resource_id: siteId.C, can_import: false, can_upload: true, can_edit: true, assigned_by: dirId },
  ]);
  await insertMany('btp_quote_access', [{ organization_id: ORG_ID, profile_id: chefId, granted_by: dirId }], { select: 'profile_id' });
  console.log('  ✓ assignations (chef : Kipé + Coyah ; conducteur : route Dubréka)');

  // Catalogue de prix + devis existants
  await insertMany(
    'btp_price_catalog',
    CATALOG.map(([designation, unit, unit_price, section]) => ({ organization_id: ORG_ID, designation, unit, unit_price, section, updated_by: dirId }))
  );
  const line = (section, designation, unit, quantity, unitPrice) => ({ id: crypto.randomUUID(), section, designation, unit, quantity, unitPrice });
  const lot = (title, lines) => ({ id: crypto.randomUUID(), title, kind: 'detailed', quantity: 1, unit: 'ens', lumpSumAmount: 0, lines });
  const lump = (title, amount) => ({ id: crypto.randomUUID(), title, kind: 'lump_sum', quantity: 1, unit: 'fft', lumpSumAmount: amount, lines: [] });
  const total = (lots) =>
    lots.reduce((s, l) => s + (l.kind === 'lump_sum' ? l.lumpSumAmount : l.lines.reduce((a, x) => a + x.quantity * x.unitPrice, 0)) * l.quantity, 0);
  const villa = [
    lot('Installation du chantier', [line('equipment', 'Installation et repli du chantier', 'ft', 1, 8500000), line('labor', "Main d'œuvre", 'ft', 1, 3000000)]),
    lot('Travaux de fondation', [
      line('materials', 'Ciment CPJ 42.5 (sac de 50 kg)', 'sac', 160, 95000),
      line('materials', 'Sable', 'm³', 18, 180000),
      line('materials', 'Gravier', 'm³', 22, 350000),
      line('materials', 'Fer HA12 (barre de 12 m)', 'barre', 95, 120000),
      line('labor', "Main d'œuvre", 'ft', 1, 14000000),
    ]),
    lot('Élévation RDC', [line('materials', 'Agglos creux 15', 'u', 3800, 5500), line('materials', 'Ciment CPJ 42.5 (sac de 50 kg)', 'sac', 120, 95000), line('labor', "Main d'œuvre", 'ft', 1, 16000000)]),
    lump('Travaux divers et imprévus', 12000000),
  ];
  const maternite = [
    lot('Gros œuvre bloc maternité', [
      line('materials', 'Ciment CPJ 42.5 (sac de 50 kg)', 'sac', 420, 95000),
      line('materials', 'Fer HA10 (barre de 12 m)', 'barre', 260, 85000),
      line('materials', 'Agglos creux 15', 'u', 7200, 5500),
      line('labor', "Main d'œuvre", 'ft', 1, 48000000),
      line('supervision', 'Suivi et contrôle du chantier', 'ft', 1, 9500000),
    ]),
    lump('Travaux divers et imprévus', 20000000),
  ];
  const quote = (number, title, client, location, lots, status, days) => {
    const ht = total(lots);
    return {
      organization_id: ORG_ID,
      number,
      version: 1,
      title,
      subtitle: location,
      client_name: client,
      location,
      quote_date: iso(addDays(TODAY, -days)),
      validity_days: 30,
      notes: 'Acompte de 30 % à la commande, solde selon avancement des travaux.',
      status,
      vat_enabled: false,
      vat_rate: 18,
      lots,
      total_ht: ht,
      total_ttc: ht,
      created_by: dirId,
      updated_by: dirId,
      sent_at: status !== 'draft' ? addDays(TODAY, -days + 1).toISOString() : null,
      accepted_at: status === 'accepted' ? addDays(TODAY, -days + 8).toISOString() : null,
    };
  };
  await insertMany('btp_quotes', [
    quote('DEV-2026-0001', "Construction d'une villa R+1 à Lambanyi", 'Mme Hawa CAMARA', 'Lambanyi, Ratoma — Conakry', villa, 'accepted', 40),
    quote('DEV-2026-0002', 'Extension du centre de santé de Coyah — bloc maternité', 'Ministère de la Santé — PNDS', 'Coyah', maternite, 'sent', 9),
  ]);
  console.log('  ✓ catalogue de prix (' + CATALOG.length + ' articles) et 2 devis');

  console.log('\n✅ Vitrine BTP prête');
  console.log('   Direction :', VITRINE_ACCOUNTS.btp.email);
  console.log('   Chef de chantier :', VITRINE_ACCOUNTS['btp-chef'].email);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
