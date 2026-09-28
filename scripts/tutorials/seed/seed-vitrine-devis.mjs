/**
 * Devis vitrine complet (DEV-2026-0003) pour l'organisation « Bâtir Guinée SARL » :
 * lots détaillés, métré (extrait des matériaux calculé par le moteur de l'application),
 * lots répétés par niveau, forfaits, TVA 18 %.
 *
 *   node scripts/tutorials/seed/seed-vitrine-devis.mjs
 */
import crypto from 'crypto';
import { admin, must, iso, addDays, today } from './vitrine-common.mjs';
import { computeTakeoff, newTakeoffItem, emptyLotTakeoff } from '../../../lib/btp/quotes/takeoff.ts';

const ORG_ID = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000b7001';
const NUMBER = 'DEV-2026-0003';
const TODAY = today();

const id = () => crypto.randomUUID();

async function main() {
  const catalog = must(
    await admin.from('btp_price_catalog').select('designation, unit, unit_price, section').eq('organization_id', ORG_ID),
    'catalogue'
  );
  const price = new Map(catalog.map((c) => [c.designation, c]));
  const ref = must(
    await admin.from('btp_quotes').select('created_by').eq('organization_id', ORG_ID).eq('number', 'DEV-2026-0001').single(),
    'devis de référence'
  );
  const dirId = ref.created_by;

  const cat = (designation, quantity, section) => {
    const c = price.get(designation);
    if (!c) throw new Error(`Article absent du catalogue : ${designation}`);
    return { id: id(), section: section ?? c.section, designation, unit: c.unit, quantity, unitPrice: Number(c.unit_price) };
  };
  const free = (section, designation, unit, quantity, unitPrice) => ({ id: id(), section, designation, unit, quantity, unitPrice });
  const mo = (amount) => free('labor', "Main d'œuvre", 'ft', 1, amount);
  const suivi = (amount) => free('supervision', 'Suivi et contrôle du chantier', 'ft', 1, amount);

  const item = (kind, label, fields) => ({ ...newTakeoffItem(kind), label, ...fields });

  /** Lot détaillé avec métré : les lignes Matériaux sont générées par computeTakeoff. */
  const takeoffLot = (title, items, otherLines, { quantity = 1, unit = 'ens' } = {}) => {
    const takeoff = { ...emptyLotTakeoff(), items };
    const { materials } = computeTakeoff(takeoff);
    const matLines = materials.map((m) => {
      const c = price.get(m.designation);
      return {
        id: id(),
        section: 'materials',
        designation: m.designation,
        unit: m.unit,
        quantity: m.quantity,
        unitPrice: c ? Number(c.unit_price) : 0,
        takeoffKey: m.key,
      };
    });
    return { id: id(), title, kind: 'detailed', quantity, unit, lumpSumAmount: 0, lines: [...matLines, ...otherLines], takeoff };
  };
  const detailedLot = (title, lines, { quantity = 1, unit = 'ens' } = {}) => ({
    id: id(),
    title,
    kind: 'detailed',
    quantity,
    unit,
    lumpSumAmount: 0,
    lines,
  });
  const lumpLot = (title, amount, unit = 'fft') => ({ id: id(), title, kind: 'lump_sum', quantity: 1, unit, lumpSumAmount: amount, lines: [] });

  const lots = [
    detailedLot('Installation du chantier', [
      cat('Clôture de chantier en tôles', 86),
      cat('Baraque de chantier (bureau et magasin)', 1),
      cat('Transport de matériaux', 4),
      mo(4500000),
      suivi(2500000),
    ]),
    detailedLot('Terrassements', [
      cat('Location pelle hydraulique', 3),
      cat('Transport de matériaux', 14),
      cat('Manœuvre', 45),
      suivi(1500000),
    ]),
    takeoffLot(
      'Fondations et soubassement',
      [
        item('blinding', 'Béton de propreté sous semelles', { count: 20, length: 1.6, width: 1.6, height: 0.05 }),
        item('footing', 'Semelles isolées S1 (1,40 x 1,40)', { count: 20, length: 1.4, width: 1.4, height: 0.4 }),
        item('column', 'Amorces de poteaux', { count: 20, length: 0.25, width: 0.25, height: 1.2 }),
        item('ground_beam', 'Longrines 20 x 40', { count: 1, length: 118, width: 0.2, height: 0.4 }),
        item('masonry', 'Soubassement en agglos pleins 20', { blockType: 'solid20', length: 118, height: 0.8 }),
      ],
      [
        cat('Location bétonnière', 12, 'equipment'),
        cat('Location vibrateur', 8, 'equipment'),
        cat("Main d'œuvre qualifiée (maçon, ferrailleur)", 60),
        cat('Manœuvre', 90),
        suivi(3500000),
      ]
    ),
    takeoffLot(
      'Élévation rez-de-chaussée',
      [
        item('column', 'Poteaux 25 x 25', { count: 20, length: 0.25, width: 0.25, height: 3.1 }),
        item('masonry', 'Murs extérieurs agglos creux 15', { blockType: 'hollow15', length: 62, height: 3.1, openings: 34 }),
        item('masonry', 'Cloisons agglos creux 10', { blockType: 'hollow10', length: 48, height: 3.1, openings: 16 }),
        item('tie_beam', 'Chaînages horizontaux', { length: 110, width: 0.2, height: 0.2 }),
      ],
      [cat('Location bétonnière', 8, 'equipment'), cat("Main d'œuvre qualifiée (maçon, ferrailleur)", 55), cat('Manœuvre', 70), suivi(2500000)]
    ),
    takeoffLot(
      'Dalle haute rez-de-chaussée',
      [
        item('slab', 'Dalle pleine ép. 16 cm', { length: 16, width: 12, height: 0.16 }),
        item('beam', 'Poutres 20 x 45', { count: 22, length: 5, width: 0.2, height: 0.45 }),
      ],
      [
        cat('Location bétonnière', 4, 'equipment'),
        cat('Location vibrateur', 4, 'equipment'),
        cat("Main d'œuvre qualifiée (maçon, ferrailleur)", 40),
        cat('Manœuvre', 60),
        suivi(2000000),
      ]
    ),
    takeoffLot(
      'Élévation et dalle — étage courant (R+1, R+2)',
      [
        item('column', 'Poteaux 25 x 25', { count: 20, length: 0.25, width: 0.25, height: 3.0 }),
        item('masonry', 'Murs extérieurs agglos creux 15', { blockType: 'hollow15', length: 62, height: 3.0, openings: 30 }),
        item('masonry', 'Cloisons agglos creux 10', { blockType: 'hollow10', length: 52, height: 3.0, openings: 18 }),
        item('tie_beam', 'Chaînages horizontaux', { length: 114, width: 0.2, height: 0.2 }),
        item('slab', 'Dalle pleine ép. 16 cm', { length: 16, width: 12, height: 0.16 }),
        item('beam', 'Poutres 20 x 45', { count: 22, length: 5, width: 0.2, height: 0.45 }),
      ],
      [
        cat('Location bétonnière', 10, 'equipment'),
        cat("Main d'œuvre qualifiée (maçon, ferrailleur)", 90),
        cat('Manœuvre', 120),
        suivi(4000000),
      ],
      { quantity: 2, unit: 'niveau' }
    ),
    detailedLot('Toiture-terrasse et étanchéité', [
      free('materials', 'Forme de pente en béton léger', 'm²', 192, 65000),
      free('materials', 'Étanchéité multicouche autoprotégée', 'm²', 205, 185000),
      free('materials', 'Acrotère et relevés d’étanchéité', 'ml', 56, 145000),
      free('materials', 'Descentes d’eaux pluviales PVC Ø100', 'ml', 40, 95000),
      mo(9500000),
      suivi(1500000),
    ]),
    takeoffLot(
      'Enduits et chapes',
      [
        item('plaster', 'Enduit extérieur façades', { count: 1, length: 62, height: 9.6, openings: 94 }),
        item('plaster', 'Enduit intérieur murs et cloisons (2 faces)', { count: 2, length: 158, height: 3.0, openings: 110 }),
        item('screed', 'Chape de ragréage 3 niveaux', { count: 3, length: 15, width: 11, thickness: 0.05 }),
      ],
      [cat("Main d'œuvre qualifiée (maçon, ferrailleur)", 110), cat('Manœuvre', 110), suivi(2500000)]
    ),
    takeoffLot(
      'Revêtements et peinture',
      [
        item('tiling', 'Carrelage sols 60 x 60 (3 niveaux)', { count: 3, length: 15, width: 11 }),
        item('tiling', 'Faïence murale salles d’eau', { area: 96 }),
        item('painting', 'Peinture intérieure (murs + plafonds)', { count: 1, area: 1650, coats: 2 }),
        item('painting', 'Peinture façades', { count: 1, area: 500, coats: 2 }),
      ],
      [cat("Main d'œuvre qualifiée (maçon, ferrailleur)", 95), cat('Manœuvre', 60), suivi(2000000)]
    ),
    detailedLot('Menuiseries', [
      free('materials', 'Porte d’entrée blindée 100 x 220', 'u', 2, 6500000),
      free('materials', 'Portes intérieures isoplanes 80 x 210', 'u', 18, 1450000),
      free('materials', 'Fenêtres aluminium vitrées 120 x 120', 'u', 24, 2350000),
      free('materials', 'Baies coulissantes aluminium 240 x 220', 'u', 6, 5800000),
      free('materials', 'Garde-corps métalliques balcons', 'ml', 28, 650000),
      mo(8500000),
    ]),
    lumpLot('Plomberie sanitaire (réseaux, appareils, fosse septique)', 285000000),
    lumpLot('Électricité (courants forts et faibles, tableau, mise à la terre)', 240000000),
    lumpLot('Travaux divers et imprévus', 120000000),
  ];

  const lotTotal = (l) =>
    (l.kind === 'lump_sum' ? l.lumpSumAmount : l.lines.reduce((a, x) => a + Math.round(x.quantity * x.unitPrice * 100) / 100, 0)) *
    l.quantity;
  const totalHt = Math.round(lots.reduce((s, l) => s + lotTotal(l), 0) * 100) / 100;
  const vatRate = 18;
  const totalTtc = Math.round(totalHt * (1 + vatRate / 100) * 100) / 100;

  await admin.from('btp_quotes').delete().eq('organization_id', ORG_ID).eq('number', NUMBER);
  const quoteDate = addDays(TODAY, -2);
  must(
    await admin
      .from('btp_quotes')
      .insert({
        organization_id: ORG_ID,
        number: NUMBER,
        version: 1,
        title: "Construction d'un immeuble d'habitation R+2 à Nongo",
        subtitle: 'Gros œuvre, second œuvre et finitions — 3 niveaux de 180 m²',
        client_name: 'SCI Les Jardins de Nongo',
        client_contact: 'M. Ousmane DIALLO — +224 622 45 18 90',
        client_address: 'Nongo, Ratoma — Conakry',
        location: 'Nongo, Ratoma — Conakry',
        quote_date: iso(quoteDate),
        validity_days: 45,
        notes:
          'Prix en francs guinéens, hors frais de raccordement EDG et SEG.\n' +
          'Modalités : acompte de 30 % à la commande, 60 % selon avancement mensuel des travaux, 10 % à la réception.\n' +
          'Délai d’exécution : 10 mois à compter de l’ordre de service.',
        status: 'sent',
        vat_enabled: true,
        vat_rate: vatRate,
        lots,
        total_ht: totalHt,
        total_ttc: totalTtc,
        created_by: dirId,
        updated_by: dirId,
        sent_at: addDays(TODAY, -1).toISOString(),
      })
      .select('id')
      .single(),
    'devis'
  );

  console.log(`✓ ${NUMBER} : ${lots.length} lots, HT ${totalHt.toLocaleString('fr-FR')} GNF, TTC ${totalTtc.toLocaleString('fr-FR')} GNF`);
  for (const l of lots) console.log(`   ${l.title.padEnd(52)} ${Math.round(lotTotal(l)).toLocaleString('fr-FR').padStart(16)}`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
