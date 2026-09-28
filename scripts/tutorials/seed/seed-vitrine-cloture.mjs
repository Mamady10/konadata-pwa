/**
 * Historique du chantier terminé « École primaire de Kindia (6 classes) » (organisation vitrine BTP) :
 * fiches hebdomadaires, carburant, bons de livraison et pièces du dossier de clôture.
 *
 *   node scripts/tutorials/seed/seed-vitrine-cloture.mjs
 */
import { jsPDF } from 'jspdf';
import { admin, must, rng, iso, addDays, insertMany, uploadDocument } from './vitrine-common.mjs';

const ORG_ID = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000b7001';
const START = new Date('2025-11-10T00:00:00Z');
const END = new Date('2026-07-24T00:00:00Z');
const FUEL_PRICE = 12000;
const R = rng(2026);

const PHASES = [
  [0, 'Installation du chantier, implantation et terrassements des fondations.'],
  [8, 'Fouilles, béton de propreté et semelles des blocs A et B.'],
  [16, 'Longrines, soubassement et remblai compacté.'],
  [26, 'Poteaux et élévation des murs en agglos des 6 classes.'],
  [42, 'Chaînages, poutres et dalle du bloc administratif.'],
  [55, 'Charpente métallique et couverture en tôles bac alu.'],
  [68, 'Enduits intérieurs et extérieurs, chapes des classes.'],
  [80, 'Menuiseries métalliques, électricité et latrines.'],
  [90, 'Carrelage, peinture, tableaux muraux et aménagements extérieurs.'],
  [98, 'Nettoyage, levée des réserves et préparation de la réception.'],
];
const EXTRAS = ['HSE : briefing sécurité, EPI vérifiés.', 'Visite du bureau de contrôle : RAS.', 'Réunion de chantier avec la commune.', ''];
const WEATHER = ['Ensoleillé', 'Nuageux', 'Couvert', 'Averses l’après-midi', 'Pluie matinale'];

function smallPdf(title, lines) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Bâtir Guinée SARL', 20, 25);
  doc.setFontSize(13);
  doc.text(title, 20, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  lines.forEach((l, i) => doc.text(l, 20, 55 + i * 7));
  return Buffer.from(doc.output('arraybuffer'));
}

async function main() {
  const site = must(
    await admin.from('btp_sites').select('id, name').eq('organization_id', ORG_ID).ilike('name', 'École primaire de Kindia%').single(),
    'chantier Kindia'
  );
  const dirId = must(
    await admin.from('btp_quotes').select('created_by').eq('organization_id', ORG_ID).eq('number', 'DEV-2026-0001').single(),
    'directeur'
  ).created_by;

  const links = must(await admin.from('btp_site_documents').select('document_id').eq('site_id', site.id), 'liens documents');
  for (const table of ['btp_daily_progress', 'btp_fuel_logs', 'btp_delivery_notes', 'btp_site_documents']) {
    must(await admin.from(table).delete().eq('site_id', site.id).select('id'), `nettoyage ${table}`);
  }
  if (links.length) await admin.from('documents').delete().in('id', links.map((l) => l.document_id));

  // Fiches hebdomadaires (courbe en S jusqu'à 100 %)
  const weeks = [];
  for (let d = START; d <= END; d = addDays(d, 7)) weeks.push(d);
  if (iso(weeks[weeks.length - 1]) !== iso(END)) weeks.push(END);
  const n = weeks.length - 1;
  const daily = weeks.map((d, i) => {
    const x = i / n;
    const pct = i === n ? 100 : Math.round((100 * (3 * x * x - 2 * x * x * x)) * 10) / 10;
    const phase = [...PHASES].reverse().find(([from]) => pct >= from)[1];
    return {
      organization_id: ORG_ID,
      site_id: site.id,
      progress_date: iso(d),
      physical_pct: pct,
      workers_count: R.int(14, 26),
      weather: R.pick(WEATHER),
      notes: i === n ? 'Réception provisoire avec la commune urbaine de Kindia. Remise des clés.' : `Travaux : ${phase} ${R.pick(EXTRAS)}`.trim(),
      created_by: dirId,
    };
  });
  await insertMany('btp_daily_progress', daily, { select: 'id' });

  // Carburant (bétonnière et groupe électrogène)
  const fuel = [];
  for (let d = addDays(START, 2); d <= END; d = addDays(d, R.int(6, 9))) {
    const liters = R.int(12, 28) * 5;
    fuel.push({ organization_id: ORG_ID, site_id: site.id, liters, cost: liters * FUEL_PRICE, logged_by: dirId, is_anomaly: false, logged_at: `${iso(d)}T08:30:00Z` });
  }
  await insertMany('btp_fuel_logs', fuel, { select: 'id' });

  // Bons de livraison
  const NOTES = [
    ['2025-11-18', 'Carrière de Kagbélen', 'Gravier', 45, 'm³', 350000],
    ['2025-12-05', 'Cimenterie de Conakry', 'Ciment CPJ 42.5 (sac de 50 kg)', 600, 'sac', 95000],
    ['2025-12-19', 'Fer et Aciers de Kaloum', 'Fer HA12 (barre de 12 m)', 260, 'barre', 120000],
    ['2026-01-16', 'Agglos Kindia Services', 'Agglos creux 15', 14000, 'u', 5500],
    ['2026-02-06', 'Cimenterie de Conakry', 'Ciment CPJ 42.5 (sac de 50 kg)', 750, 'sac', 95000],
    ['2026-03-13', 'Métal Construction Guinée', 'Charpente métallique (lot)', 1, 'lot', 96000000],
    ['2026-03-27', 'Quincaillerie de Kindia', 'Tôles bac alu 6/10', 620, 'u', 65000],
    ['2026-04-24', 'Carrière de Kagbélen', 'Sable', 60, 'm³', 180000],
    ['2026-05-22', 'Menuiserie Métallique du Fouta', 'Portes et fenêtres métalliques', 1, 'lot', 58000000],
    ['2026-06-19', 'Céramiques de Guinée', 'Carreaux 40×40', 520, 'm²', 120000],
    ['2026-07-03', 'Peintures Tropicales', 'Peinture de finition', 420, 'L', 65000],
  ];
  await insertMany(
    'btp_delivery_notes',
    NOTES.map(([date, supplier, item, qty, unit, price], i) => ({
      organization_id: ORG_ID,
      site_id: site.id,
      reference: `BL-KIN-${String(i + 1).padStart(3, '0')}`,
      supplier,
      total_amount: qty * price,
      delivery_date: date,
      description: 'Approvisionnement chantier école de Kindia',
      status: 'validated',
      items: [{ item, category: 'materials', qty, unit }],
    })),
    { select: 'id' }
  );

  // Montant exécuté = reprise d'ouverture + coûts saisis (carburant, bons)
  const tracked = fuel.reduce((s, f) => s + f.cost, 0) + NOTES.reduce((s, x) => s + x[3] * x[5], 0);
  must(
    await admin
      .from('btp_sites')
      .update({
        spent: 1_310_000_000,
        opening_spent: 1_310_000_000 - tracked,
        budget_alert_pct: 98,
        budget_breakdown: { materials: 42, equipment: 3.5 },
      })
      .eq('id', site.id)
      .select('id'),
    'montants chantier'
  );

  // Pièces du dossier de clôture
  const DOCS = [
    ['PV-reception-provisoire-ecole-Kindia.pdf', 'site_report', '2026-07-24', 'Procès-verbal de réception provisoire', [
      'Ouvrage : École primaire de 6 classes, bloc administratif et latrines.',
      'Maître d’ouvrage : Commune urbaine de Kindia.',
      'Réception prononcée le 24/07/2026 avec réserves mineures.',
    ]],
    ['Liste-des-reserves-ecole-Kindia.pdf', 'progress_report', '2026-07-24', 'Liste des réserves', [
      '1. Reprise de peinture salles 3 et 5.',
      '2. Réglage de trois fenêtres (bloc B).',
      'Délai de levée : 30 jours.',
    ]],
    ['Rapport-bureau-de-controle-final.pdf', 'site_report', '2026-07-20', 'Rapport final du bureau de contrôle', [
      'Structure conforme aux plans d’exécution.',
      'Essais béton : résistance moyenne 27 MPa (> 25 MPa requis).',
    ]],
    ['Plans-de-recolement-ecole-Kindia.pdf', 'technical_plan', '2026-07-22', 'Plans de récolement', ['Plan de masse, plans des blocs A et B, réseaux.']],
    ['Attestation-HSE-fin-de-chantier.pdf', 'safety_sheet', '2026-07-23', 'Attestation HSE de fin de chantier', ['Aucun accident avec arrêt sur la durée du chantier.']],
    ['Decompte-general-definitif.pdf', 'supplier_invoice', '2026-07-24', 'Décompte général définitif', ['Montant du marché : 1 350 000 000 GNF.', 'Montant exécuté : 1 310 000 000 GNF.']],
  ];
  for (const [fileName, docType, date, title, lines] of DOCS) {
    const docId = await uploadDocument(ORG_ID, dirId, {
      fileName,
      buffer: smallPdf(title, lines),
      mimeType: 'application/pdf',
      category: 'other',
      createdAt: `${date}T10:00:00Z`,
      extracted: { document_type: docType, site_id: site.id },
    });
    must(await admin.from('btp_site_documents').insert({ organization_id: ORG_ID, site_id: site.id, document_id: docId, doc_type: docType }), 'lien document');
  }

  console.log(`✓ ${site.name} : ${daily.length} fiches, ${fuel.length} relevés carburant, ${NOTES.length} bons, ${DOCS.length} pièces`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
