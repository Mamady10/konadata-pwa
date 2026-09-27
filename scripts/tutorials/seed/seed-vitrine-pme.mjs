#!/usr/bin/env node
/**
 * Organisation vitrine PME « Espace Commercial Madina » (gros & détail, marché Madina) pour les tutoriels et vidéos.
 * Données cohérentes et datées par rapport à aujourd'hui (jour, semaine et mois en cours toujours remplis).
 * Ré-exécutable : purge les données de CETTE organisation uniquement, puis recrée tout.
 *
 * Usage : node scripts/tutorials/seed/seed-vitrine-pme.mjs
 */
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
  uploadLogo,
  wipe,
} from './vitrine-common.mjs';

export const ORG_ID = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000c0001';
const R = rng(2031);
const TODAY = today();
const START = new Date('2026-01-02T12:00:00Z');
const DAY = 86400000;
// Les tableaux de bord lisent toutes les lignes (plafond PostgREST de 1000 lignes par requête).
const MAX_ROWS = 980;

const STAFF = {
  caisse: { email: 'video.caissiere.pme@konadata.demo', fullName: 'Fatoumata Binta DIALLO', role: 'pme_staff', phone: '+224 628 11 22 33' },
  stock: { email: 'video.magasinier.pme@konadata.demo', fullName: 'Ibrahima BANGOURA', role: 'pme_staff', phone: '+224 628 44 55 66' },
};

const BOUTIQUES = {
  MADINA: {
    name: 'Boutique Madina — Détail',
    address: 'Marché Madina, allée des grossistes, Matam — Conakry',
    phone: '+224 628 11 22 33',
    manager: STAFF.caisse.fullName,
  },
  DEPOT: {
    name: 'Dépôt Matam — Gros',
    address: 'Route du Niger, Matam — Conakry',
    phone: '+224 628 44 55 66',
    manager: STAFF.stock.fullName,
  },
};

// ------------------------------------------------------------------ fournisseurs
const SUPPLIERS = {
  KALOUM: { name: 'Grossiste Kaloum Import', phone: '+224 622 40 11 20', email: 'commandes@kaloum-import.demo', address: 'Port autonome, Kaloum — Conakry', every: 7, weekday: 1, boutique: 'DEPOT' },
  PORT: { name: 'Comptoir Alimentaire du Port', phone: '+224 622 51 30 44', email: 'ventes@comptoir-port.demo', address: 'Boulbinet, Kaloum — Conakry', every: 7, weekday: 2, boutique: 'DEPOT' },
  KANKAN: { name: 'Huilerie de Kankan', phone: '+224 625 18 72 09', email: 'depot.conakry@huilerie-kankan.demo', address: 'Dépôt de Matoto — Conakry', every: 7, weekday: 3, boutique: 'DEPOT' },
  COYAH: { name: 'Distribution Coyah Frères', phone: '+224 621 66 04 58', email: 'contact@coyah-freres.demo', address: 'Route nationale 1, Coyah', every: 7, weekday: 4, boutique: 'MADINA' },
  TELECOM: { name: 'Télécom Express Madina', phone: '+224 620 93 27 15', email: null, address: 'Marché Madina — Conakry', every: 7, weekday: 5, boutique: 'MADINA' },
  HYGIENE: { name: 'Hygiène Plus Guinée', phone: '+224 624 35 80 61', email: 'commandes@hygieneplus-gn.demo', address: 'Zone industrielle de Matoto — Conakry', every: 14, weekday: 6, boutique: 'MADINA' },
};

// ------------------------------------------------------------------ catalogue
// [sku, nom, unité, prix de vente, coût d'achat, fournisseur, popularité, qté détail, qté gros]
const PRODUCTS = [
  ['ALI-RIZ25', 'Riz brisé importé — sac 25 kg', 'sac', 280000, 224000, 'KALOUM', 10, [1, 2], [10, 40]],
  ['ALI-RIZP25', 'Riz parfumé — sac 25 kg', 'sac', 335000, 264000, 'KALOUM', 5, [1, 2], [5, 20]],
  ['ALI-RIZL25', 'Riz local étuvé — sac 25 kg', 'sac', 310000, 240000, 'KALOUM', 4, [1, 1], [5, 15]],
  ['ALI-SUC50', 'Sucre en poudre — sac 50 kg', 'sac', 520000, 418000, 'KALOUM', 6, [1, 1], [3, 15]],
  ['ALI-SUCM1', 'Sucre en morceaux — boîte 1 kg', 'boîte', 16000, 12000, 'KALOUM', 5, [1, 4], [20, 60]],
  ['ALI-FAR50', 'Farine de blé — sac 50 kg', 'sac', 385000, 305000, 'KALOUM', 3, [1, 1], [3, 12]],
  ['ALI-SEL25', 'Sel iodé — sac 25 kg', 'sac', 65000, 48000, 'KALOUM', 2, [1, 1], [3, 10]],
  ['ALI-OIG25', 'Oignons — sac 25 kg', 'sac', 155000, 118000, 'KALOUM', 4, [1, 2], [3, 10]],
  ['ALI-HUI5', 'Huile végétale — bidon 5 L', 'bidon', 110000, 86000, 'KANKAN', 9, [1, 3], [10, 30]],
  ['ALI-HUI20', 'Huile végétale — bidon 20 L', 'bidon', 420000, 330000, 'KANKAN', 5, [1, 1], [3, 12]],
  ['ALI-PAL5', 'Huile de palme rouge — bidon 5 L', 'bidon', 95000, 72000, 'KANKAN', 3, [1, 2], [5, 15]],
  ['ALI-SPA', 'Spaghetti 500 g — carton de 20', 'carton', 120000, 94000, 'PORT', 5, [1, 2], [5, 20]],
  ['ALI-MAC', 'Macaroni 500 g — carton de 20', 'carton', 115000, 90000, 'PORT', 3, [1, 2], [5, 15]],
  ['ALI-TOM70', 'Tomate concentrée 70 g — carton de 50', 'carton', 95000, 72000, 'PORT', 6, [1, 2], [5, 20]],
  ['ALI-TOM400', 'Tomate concentrée 400 g — carton de 24', 'carton', 210000, 165000, 'PORT', 3, [1, 1], [3, 10]],
  ['ALI-LAIT400', 'Lait en poudre — sachet 400 g', 'sachet', 38000, 29000, 'PORT', 7, [1, 5], [24, 72]],
  ['ALI-LAIT25', 'Lait en poudre — sac 25 kg', 'sac', 1350000, 1070000, 'PORT', 2, [1, 1], [1, 4]],
  ['ALI-LCS', 'Lait concentré sucré — carton de 48', 'carton', 360000, 285000, 'PORT', 3, [1, 1], [2, 8]],
  ['ALI-SAR', "Sardines à l'huile — carton de 50", 'carton', 400000, 320000, 'PORT', 2, [1, 1], [2, 6]],
  ['ALI-CUB', 'Bouillon cube — boîte de 100', 'boîte', 32000, 24000, 'PORT', 6, [1, 3], [10, 40]],
  ['ALI-CAF', 'Café soluble — boîte 200 g', 'boîte', 45000, 34000, 'PORT', 2, [1, 2], [6, 24]],
  ['ALI-THE', 'Thé vert — paquet 250 g', 'paquet', 18000, 13000, 'PORT', 3, [1, 4], [20, 50]],
  ['BOI-EAU15', 'Eau minérale 1,5 L — pack de 6', 'pack', 24000, 18000, 'COYAH', 7, [1, 4], [20, 60]],
  ['BOI-EAU05', 'Eau minérale 0,5 L — pack de 12', 'pack', 25000, 18500, 'COYAH', 4, [1, 3], [10, 40]],
  ['BOI-JUS', 'Jus de fruits 1 L — carton de 12', 'carton', 150000, 118000, 'COYAH', 3, [1, 1], [3, 10]],
  ['BOI-SOD', 'Boisson gazeuse 33 cl — pack de 24', 'pack', 130000, 102000, 'COYAH', 4, [1, 2], [5, 15]],
  ['BOI-ENE', 'Boisson énergisante 25 cl — pack de 24', 'pack', 180000, 140000, 'COYAH', 2, [1, 1], [2, 8]],
  ['HYG-SAVM', 'Savon de ménage 300 g — carton de 36', 'carton', 150000, 115000, 'HYGIENE', 5, [1, 1], [3, 12]],
  ['HYG-SAVT', 'Savon de toilette — carton de 72', 'carton', 280000, 215000, 'HYGIENE', 2, [1, 1], [2, 6]],
  ['HYG-DEN', 'Dentifrice 100 ml — tube', 'tube', 12000, 8500, 'HYGIENE', 4, [1, 3], [24, 72]],
  ['HYG-COU', 'Couches bébé — paquet de 40', 'paquet', 75000, 57000, 'HYGIENE', 3, [1, 2], [5, 15]],
  ['HYG-SER', 'Serviettes hygiéniques — paquet de 10', 'paquet', 12000, 8500, 'HYGIENE', 3, [1, 3], [20, 50]],
  ['ENT-DET', 'Détergent en poudre — seau 5 kg', 'seau', 85000, 65000, 'HYGIENE', 3, [1, 1], [4, 12]],
  ['ENT-JAV', 'Eau de Javel 1 L — carton de 12', 'carton', 60000, 45000, 'HYGIENE', 3, [1, 1], [3, 10]],
  ['ENT-VAI', 'Liquide vaisselle 750 ml', 'flacon', 20000, 14500, 'HYGIENE', 3, [1, 3], [12, 36]],
  ['ENT-INS', 'Insecticide aérosol 400 ml', 'bombe', 35000, 26000, 'HYGIENE', 3, [1, 2], [12, 24]],
  ['TEL-ORA100', 'Recharge Orange 100 000 GNF', 'recharge', 100000, 96000, 'TELECOM', 5, [1, 2], [10, 30]],
  ['TEL-MTN50', 'Recharge MTN 50 000 GNF', 'recharge', 50000, 48000, 'TELECOM', 4, [1, 3], [10, 40]],
  ['TEL-SIM', 'Carte SIM Orange', 'unité', 10000, 6000, 'TELECOM', 2, [1, 2], [10, 20]],
  ['TEL-CHG', 'Chargeur de téléphone USB', 'unité', 45000, 30000, 'TELECOM', 2, [1, 1], [5, 10]],
].map(([sku, name, unit, price, cost, supplier, weight, detail, gros]) => ({ sku, name, unit, price, cost, supplier, weight, detail, gros }));
const LOW_STOCK = ['ALI-LAIT400', 'ALI-HUI20', 'ALI-TOM70', 'HYG-COU', 'TEL-MTN50'];
const bySku = Object.fromEntries(PRODUCTS.map((p) => [p.sku, p]));

// ------------------------------------------------------------------ clients
const PASSAGE = 'Client de passage (comptoir)';
const PROS = [
  ['Alimentation Bah & Fils — Hamdallaye', '+224 622 31 45 67', 'bahetfils@gmail.demo', 5],
  ['Boutique Diallo & Frères — Bambeto', '+224 624 12 78 90', null, 5],
  ['Restaurant Chez Fanta — Kaloum', '+224 628 90 12 34', 'chezfanta@gmail.demo', 3],
  ['Hadja Mariama BARRY — Marché Niger', '+224 621 55 43 21', null, 3],
  ['Épicerie Sow — Kipé', '+224 620 77 81 02', null, 4],
  ['Cantine scolaire Les Étoiles — Matoto', '+224 625 40 60 80', 'intendance@lesetoiles.demo', 2],
  ['Maquis Le Fromager — Taouyah', '+224 622 08 19 37', null, 2],
  ['Superette Kaba — Lambanyi', '+224 626 14 25 36', 'superette.kaba@gmail.demo', 4],
  ['Mamadou Oury BALDÉ — revendeur Coyah', '+224 623 70 11 59', null, 3],
];
const PARTICULIERS = [
  ['Aïssatou CAMARA', '+224 621 10 20 30'],
  ['Ousmane CONDÉ', '+224 622 45 67 89'],
  ['Fatoumata SOW', '+224 620 33 44 55'],
  ['Mohamed SOUMAH', '+224 628 76 54 32'],
  ['Mariama KEÏTA', '+224 624 98 76 10'],
  ['Ibrahima CISSÉ', '+224 625 11 22 44'],
  ['Aminata KABA', '+224 626 60 70 80'],
  ['Sékou FOFANA', '+224 627 13 57 91'],
  ['Lansana KONATÉ', '+224 623 24 68 02'],
  ['Djénabou BAH', '+224 621 86 42 08'],
  ['Abdoulaye BANGOURA', '+224 622 97 53 11'],
];

// Crédits clients : [client, jours écoulés, échéance (jours ou date), paiements [jours après, part, moyen, note]]
const DEBTS = [
  ['Superette Kaba — Lambanyi', 110, 30, [[15, 0.5, 'orange_money', 'Premier versement Orange Money'], [34, 1, 'cash', 'Solde en espèces']]],
  ['Alimentation Bah & Fils — Hamdallaye', 75, 30, [[0, 0.3, 'cash', 'Acompte à la livraison'], [28, 1, 'orange_money', 'Solde via Orange Money']]],
  ['Hadja Mariama BARRY — Marché Niger', 62, '2026-08-31', [[10, 0.25, 'cash', 'Versement espèces']]],
  ['Restaurant Chez Fanta — Kaloum', 48, 21, [[20, 1, 'mtn_momo', 'Règlement MTN MoMo']]],
  ['Boutique Diallo & Frères — Bambeto', 21, 30, [[7, 0.4, 'orange_money', 'Versement Orange Money']]],
  ['Cantine scolaire Les Étoiles — Matoto', 12, 30, [[0, 0.25, 'bank_transfer', 'Acompte par virement']]],
  ['Épicerie Sow — Kipé', 9, 15, []],
  ['Maquis Le Fromager — Taouyah', 5, 14, []],
  ['Alimentation Bah & Fils — Hamdallaye', 3, 30, [[0, 0.3, 'cash', 'Acompte initial']]],
];

// ------------------------------------------------------------------ personnel (salaires)
const EMPLOYEES = [
  [STAFF.caisse.fullName, 'caissière', 1800000, 'MADINA'],
  ['Mamady KEÏTA', 'vendeur', 1400000, 'MADINA'],
  [STAFF.stock.fullName, 'magasinier', 1800000, 'DEPOT'],
  ['Alpha SOUMAH', 'manutentionnaire', 1200000, 'DEPOT'],
  ['Karamo KONATÉ', 'gardien', 900000, 'DEPOT'],
];

// ------------------------------------------------------------------ utilitaires
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const at = (d, h, m) => `${iso(d)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
const round = (n, step = 5000) => Math.round(n / step) * step;
const fmt = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} GNF`;
const notSunday = (d) => (d.getUTCDay() === 0 ? addDays(d, -1) : d);
const totalWeight = PRODUCTS.reduce((s, p) => s + p.weight, 0);
const proWeight = PROS.reduce((s, p) => s + p[3], 0);

function pickProduct() {
  let x = R.next() * totalWeight;
  for (const p of PRODUCTS) if ((x -= p.weight) < 0) return p;
  return PRODUCTS[0];
}
function pickPro() {
  let x = R.next() * proWeight;
  for (const p of PROS) if ((x -= p[3]) < 0) return p[0];
  return PROS[0][0];
}
function pickMethod(kind) {
  const x = R.next();
  if (kind === 'gros') return x < 0.4 ? 'cash' : x < 0.7 ? 'orange_money' : x < 0.8 ? 'mtn_momo' : 'bank_transfer';
  return x < 0.6 ? 'cash' : x < 0.88 ? 'orange_money' : 'mtn_momo';
}
function basket(kind) {
  const n = kind === 'gros' ? R.int(2, 5) : R.int(1, 4);
  const chosen = new Set();
  while (chosen.size < n) chosen.add(pickProduct());
  return [...chosen].map((p) => {
    const [a, b] = kind === 'gros' ? p.gros : p.detail;
    const qty = R.int(a, b);
    return { sku: p.sku, product: p.name, unit: p.unit, qty, unit_price: p.price, total: qty * p.price };
  });
}
const sumItems = (items) => items.reduce((s, it) => s + it.total, 0);

/** Affluence du jour : jour de semaine, fin de mois, Ramadan / Tabaski, saison des pluies, rentrée, croissance. */
function dayFactor(d, idx, total) {
  const s = iso(d);
  if (['2026-03-20', '2026-05-01', '2026-05-27'].includes(s)) return 0;
  let f = [0.55, 1.0, 0.95, 1.0, 1.0, 0.9, 1.3][d.getUTCDay()];
  const dom = d.getUTCDate();
  if (dom >= 25 || dom <= 5) f *= 1.2;
  if (s >= '2026-02-18' && s <= '2026-03-19') f *= s >= '2026-03-12' ? 1.5 : 1.15;
  if (s >= '2026-05-18' && s <= '2026-05-26') f *= 1.5;
  if (s >= '2026-07-01' && s <= '2026-08-31') f *= 0.9;
  if (s >= '2026-09-14') f *= 1.1;
  return f * (0.85 + (0.25 * idx) / total);
}

function buildSales() {
  const sales = [];
  const push = (date, h, m, kind, customer, boutique, extra = {}) => {
    const items = basket(kind);
    sales.push({ soldAt: at(date, h, m), kind, customer, boutique, items, total: sumItems(items), status: 'paid', method: pickMethod(kind), notes: null, ...extra });
  };
  const totalDays = Math.round((TODAY - START) / DAY);
  for (let d = new Date(START), idx = 0; d < TODAY; d = addDays(d, 1), idx++) {
    const f = dayFactor(d, idx, totalDays);
    if (!f) continue;
    const nRetail = Math.max(0, Math.round(2.0 * f + (R.next() - 0.5) * 2));
    const nGros = Math.max(0, Math.round(1.2 * f + (R.next() - 0.5)));
    for (let i = 0; i < nRetail; i++) {
      const customer = R.next() < 0.6 ? PASSAGE : R.pick(PARTICULIERS)[0];
      push(d, R.int(8, 18), R.int(0, 59), 'detail', customer, R.next() < 0.8 ? 'MADINA' : 'DEPOT');
    }
    for (let i = 0; i < nGros; i++) push(d, R.int(8, 13), R.int(0, 59), 'gros', pickPro(), R.next() < 0.75 ? 'DEPOT' : 'MADINA');
  }

  // Aujourd'hui : ventes déjà passées dans la journée (les 5 plus récentes du tableau de bord).
  const now = new Date();
  const base = Math.min(now.getTime(), new Date(`${iso(TODAY)}T18:00:00Z`).getTime());
  const todays = [
    [300, 'detail', 'Djénabou BAH', 'MADINA', 'orange_money'],
    [215, 'gros', 'Superette Kaba — Lambanyi', 'DEPOT', 'cash'],
    [140, 'detail', PASSAGE, 'MADINA', 'cash'],
    [70, 'detail', 'Mohamed SOUMAH', 'MADINA', 'mtn_momo'],
    [15, 'detail', 'Aïssatou CAMARA', 'MADINA', 'orange_money'],
  ];
  for (const [minutesAgo, kind, customer, boutique, method] of todays) {
    const t = new Date(Math.max(base - minutesAgo * 60000, new Date(`${iso(TODAY)}T07:30:00Z`).getTime()));
    const items = basket(kind);
    sales.push({ soldAt: t.toISOString(), kind, customer, boutique, items, total: sumItems(items), status: 'paid', method, notes: null });
  }

  // Ventes à crédit (reliées aux dettes clients).
  for (const [customer, daysAgo, due, payments] of DEBTS) {
    const date = notSunday(addDays(TODAY, -daysAgo));
    let items;
    do items = basket('gros');
    while (sumItems(items) < 3_000_000 || sumItems(items) > 16_000_000);
    const dueDate = typeof due === 'string' ? due : iso(addDays(date, due));
    const paidShare = payments.reduce((m, p) => Math.max(m, p[1]), 0);
    const overdue = dueDate < iso(TODAY) && paidShare < 1;
    const status = paidShare >= 1 ? 'paid' : overdue ? 'overdue' : paidShare > 0 ? 'partial' : 'pending';
    sales.push({
      soldAt: at(date, 10, 30),
      kind: 'gros',
      customer,
      boutique: 'DEPOT',
      items,
      total: sumItems(items),
      status,
      method: null,
      notes: `Vente à crédit — échéance ${dueDate.split('-').reverse().join('/')}`,
      debt: { date, dueDate, payments },
    });
  }

  sales.sort((a, b) => a.soldAt.localeCompare(b.soldAt));
  sales.forEach((s, i) => (s.reference = `VTE-2026-${String(i + 1).padStart(4, '0')}`));
  return sales;
}

/**
 * Réapprovisionnements : chaque fournisseur livre à jour fixe ce qui se vend pendant la semaine calendaire
 * de la livraison (jours déjà écoulés seulement), pour que chaque semaine du rapport reste bénéficiaire.
 */
function buildPurchases(sales) {
  const soldByDay = new Map();
  for (const s of sales) {
    const day = s.soldAt.slice(0, 10);
    for (const it of s.items) {
      const key = `${day}|${it.sku}`;
      soldByDay.set(key, (soldByDay.get(key) ?? 0) + it.qty);
    }
  }
  const purchases = [];
  for (const [key, sup] of Object.entries(SUPPLIERS)) {
    const skus = PRODUCTS.filter((p) => p.supplier === key).map((p) => p.sku);
    let d = new Date(START);
    while (d.getUTCDay() !== sup.weekday) d = addDays(d, 1);
    for (; d <= TODAY; d = addDays(d, sup.every)) {
      const from = addDays(d, -((d.getUTCDay() + 6) % 7));
      const qty = Object.fromEntries(skus.map((s) => [s, 0]));
      for (let i = 0; i < sup.every; i++) {
        const day = addDays(from, i);
        if (day < START || day > TODAY) continue;
        for (const s of skus) qty[s] += soldByDay.get(`${iso(day)}|${s}`) ?? 0;
      }
      const items = skus
        .map((s) => ({ s, q: qty[s] }))
        .filter((x) => x.q > 0)
        .map(({ s, q }) => ({ sku: s, product: bySku[s].name, unit: bySku[s].unit, qty: q, unit_cost: bySku[s].cost, total: q * bySku[s].cost }));
      if (!items.length) continue;
      purchases.push({
        purchasedAt: at(d, R.int(8, 9), R.int(0, 59)),
        supplier: key,
        boutique: sup.boutique,
        items,
        total: items.reduce((a, it) => a + it.total, 0),
        status: 'paid',
        method: sup.every === 7 && key !== 'TELECOM' ? (R.next() < 0.6 ? 'bank_transfer' : 'cash') : R.next() < 0.5 ? 'orange_money' : 'cash',
        notes: `Réapprovisionnement — livraison ${BOUTIQUES[sup.boutique].name}`,
      });
    }
  }
  purchases.sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  purchases.forEach((p, i) => (p.reference = `ACH-2026-${String(i + 1).padStart(4, '0')}`));
  // Dernières livraisons encore dues aux fournisseurs.
  const last = (key) => purchases.filter((p) => p.supplier === key).at(-1);
  Object.assign(last('KALOUM'), { status: 'pending', method: null });
  Object.assign(last('PORT'), { status: 'partial' });
  return purchases;
}

function buildExpenses() {
  const out = [];
  const add = (date, category, description, amount, boutique) => {
    if (date <= TODAY) out.push({ expense_date: iso(date), category, description, amount: round(amount), boutique });
  };
  for (let m = 0; m <= TODAY.getUTCMonth(); m++) {
    const day = (n) => notSunday(new Date(Date.UTC(2026, m, n, 12)));
    const prev = MONTHS[(m + 11) % 12];
    add(day(3), 'Loyer', `Loyer boutique Madina — ${MONTHS[m]}`, 5000000, 'MADINA');
    add(day(3), 'Loyer', `Loyer dépôt Matam — ${MONTHS[m]}`, 3500000, 'DEPOT');
    add(day(10), 'Électricité', `Facture EDG boutique Madina — ${prev}`, R.round(950000, 1300000, 5000), 'MADINA');
    add(day(11), 'Électricité', `Facture EDG dépôt Matam — ${prev}`, R.round(700000, 1000000, 5000), 'DEPOT');
    add(day(5), 'Impôts et taxes', `Droit de place — marché Madina (${MONTHS[m]})`, 150000, 'MADINA');
    add(day(6), 'Télécom', `Forfait internet et téléphone — ${MONTHS[m]}`, 350000, 'MADINA');
    add(day(18), 'Emballages', 'Sacs plastiques et emballages', R.round(250000, 400000, 5000), 'MADINA');
    if (m % 3 === 0) add(day(15), 'Impôts et taxes', `Patente et CFU — T${m / 3 + 1} 2026`, 2800000, 'DEPOT');
    const lastDay = notSunday(new Date(Date.UTC(2026, m + 1, 0, 12)));
    for (const [name, job, salary, boutique] of EMPLOYEES) add(lastDay, 'Salaires', `Salaire ${MONTHS[m]} — ${name} (${job})`, salary, boutique);
  }
  for (let d = new Date(START); d <= TODAY; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    const rainy = iso(d) >= '2026-06-15' && iso(d) <= '2026-09-15';
    if (dow === 1) add(d, 'Transport', 'Camion — enlèvement marchandises au port vers le dépôt', R.round(450000, 750000, 5000), 'DEPOT');
    if (dow === 4) add(d, 'Transport', 'Taxi-moto — livraisons clients', R.round(150000, 300000, 5000), 'MADINA');
    if (dow === 3) add(d, 'Carburant', `Gasoil groupe électrogène (${rainy ? 35 : 25} L)`, (rainy ? 35 : 25) * 12000, 'DEPOT');
    if (dow === 6) add(d, 'Nourriture', 'Repas du personnel — semaine', R.round(200000, 280000, 5000), 'MADINA');
  }
  add(new Date('2026-04-14T12:00:00Z'), 'Entretien', 'Réparation du congélateur (boissons)', 650000, 'MADINA');
  add(new Date('2026-06-09T12:00:00Z'), 'Entretien', 'Réfection de la toiture du dépôt avant les pluies', 2400000, 'DEPOT');
  add(new Date('2026-09-22T12:00:00Z'), 'Entretien', 'Peinture et enseigne de la boutique', 1200000, 'MADINA');
  return out;
}

/** Stock final : environ 1 à 3 semaines de ventes, seuil d'alerte ≈ 1 semaine ; quelques articles sous le seuil. */
function buildStock(sales) {
  const from = addDays(TODAY, -56).toISOString();
  const qty = Object.fromEntries(PRODUCTS.map((p) => [p.sku, 0]));
  for (const s of sales) if (s.soldAt >= from) for (const it of s.items) qty[it.sku] += it.qty;
  return Object.fromEntries(
    PRODUCTS.map((p) => {
      const weekly = qty[p.sku] / 8;
      const min = Math.max(3, Math.ceil(weekly * 0.7));
      const stock = LOW_STOCK.includes(p.sku)
        ? Math.max(1, Math.floor(min * R.round(0.25, 0.8, 0.05)))
        : Math.max(min + 3, Math.ceil(weekly * R.round(1.4, 3.2, 0.1)));
      return [p.sku, { stock, min }];
    })
  );
}

function periodTotals(sales, purchases, expenses, from, to) {
  const a = iso(from);
  const b = iso(to);
  const inRange = (s) => s.slice(0, 10) >= a && s.slice(0, 10) <= b;
  const ventes = sales.filter((s) => inRange(s.soldAt)).reduce((t, s) => t + s.total, 0);
  const achats = purchases.filter((p) => inRange(p.purchasedAt)).reduce((t, p) => t + p.total, 0);
  const charges = expenses.filter((e) => inRange(e.expense_date)).reduce((t, e) => t + e.amount, 0);
  return { ventes, achats, charges, reste: ventes - achats - charges };
}

async function storageCleanup() {
  const { data } = await admin.storage.from('documents').list(ORG_ID, { limit: 1000 });
  const files = (data ?? []).filter((f) => f.id).map((f) => `${ORG_ID}/${f.name}`);
  if (files.length) await admin.storage.from('documents').remove(files);
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="280" viewBox="0 0 1000 280">
  <rect x="10" y="20" width="240" height="240" rx="48" fill="#3730A3"/>
  <path d="M98 112 V96 a32 32 0 0 1 64 0 V112" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round"/>
  <path d="M62 108 H198 L184 226 H76 Z" fill="#FACC15"/>
  <text x="130" y="200" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="70" fill="#3730A3">M</text>
  <text x="285" y="132" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="104" fill="#3730A3">ESPACE</text>
  <text x="287" y="206" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="54" fill="#CA8A04">COMMERCIAL MADINA</text>
  <text x="289" y="248" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="26" fill="#475569">Gros &amp; détail · Marché Madina, Conakry</text>
</svg>`;

// ------------------------------------------------------------------ main
async function main() {
  console.log('🛒 Organisation vitrine PME —', VITRINE_ORGS.pme.name);
  await ensureOrg({
    id: ORG_ID,
    name: VITRINE_ORGS.pme.name,
    type: 'business',
    email: 'contact@espace-madina.demo',
    phone: '+224 628 00 12 12',
    address: 'Marché Madina, Matam — Conakry',
    planSector: 'business',
  });

  const dirId = await ensureMember(ORG_ID, { ...VITRINE_ACCOUNTS.pme, phone: '+224 628 00 12 12', intent: 'org_admin', onboarding: 'director' });
  const caisseId = await ensureMember(ORG_ID, STAFF.caisse);
  const stockId = await ensureMember(ORG_ID, STAFF.stock);
  await finalizeOrgSettings(ORG_ID, dirId);
  await uploadLogo(ORG_ID, LOGO_SVG);
  console.log('  ✓ organisation, abonnement, CGU, 3 utilisateurs, logo');

  await storageCleanup();
  await wipe(ORG_ID, [
    'pme_debt_payments',
    'pme_debts',
    'pme_transactions',
    'pme_sales',
    'pme_purchases',
    'pme_expenses',
    'pme_products',
    'collaborator_assignments',
    'pme_boutiques',
    'pme_customers',
    'pme_suppliers',
    'documents',
    'organization_ai_generated_reports',
  ]);
  console.log('  ✓ purge des anciennes données de la vitrine');

  // Données calculées en mémoire
  const sales = buildSales();
  const purchases = buildPurchases(sales);
  const expenses = buildExpenses();
  const stock = buildStock(sales);
  for (const [label, n] of [['ventes', sales.length], ['dépenses', expenses.length], ['achats', purchases.length]]) {
    if (n > MAX_ROWS) throw new Error(`Trop de ${label} (${n}) : les indicateurs seraient tronqués à 1000 lignes.`);
  }

  // Boutiques et assignations
  const bq = await insertMany(
    'pme_boutiques',
    Object.values(BOUTIQUES).map((b) => ({ organization_id: ORG_ID, ...b, is_active: true })),
    { select: 'id, name' }
  );
  const boutiqueId = Object.fromEntries(Object.entries(BOUTIQUES).map(([k, b]) => [k, bq.find((r) => r.name === b.name).id]));
  await insertMany('collaborator_assignments', [
    { organization_id: ORG_ID, profile_id: caisseId, resource_type: 'pme_boutique', resource_id: boutiqueId.MADINA, can_import: false, can_upload: true, can_edit: true, assigned_by: dirId },
    ...['MADINA', 'DEPOT'].map((k) => ({ organization_id: ORG_ID, profile_id: stockId, resource_type: 'pme_boutique', resource_id: boutiqueId[k], can_import: true, can_upload: true, can_edit: true, assigned_by: dirId })),
  ]);
  console.log('  ✓ 2 boutiques (caissière : Madina ; magasinier : Madina + dépôt)');

  // Fournisseurs
  const supplierBalance = {};
  for (const p of purchases) {
    if (p.status === 'pending') supplierBalance[p.supplier] = (supplierBalance[p.supplier] ?? 0) + p.total;
    if (p.status === 'partial') supplierBalance[p.supplier] = (supplierBalance[p.supplier] ?? 0) + round(p.total / 2, 1000);
  }
  const sup = await insertMany(
    'pme_suppliers',
    Object.entries(SUPPLIERS).map(([k, s]) => ({
      organization_id: ORG_ID,
      name: s.name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      balance: supplierBalance[k] ?? 0,
      is_active: true,
      created_at: addDays(START, -20).toISOString(),
    })),
    { select: 'id, name' }
  );
  const supplierId = Object.fromEntries(Object.entries(SUPPLIERS).map(([k, s]) => [k, sup.find((r) => r.name === s.name).id]));

  // Crédits : montants et soldes clients
  const debtRows = [];
  const balance = {};
  for (const s of sales.filter((x) => x.debt)) {
    const { date, dueDate, payments } = s.debt;
    let paid = 0;
    const pays = payments.map(([after, share, method, note]) => {
      const amount = share >= 1 ? s.total - paid : round(s.total * share, 50000) - paid;
      paid += amount;
      return { amount, method, note, paid_at: iso(addDays(date, after)) };
    });
    balance[s.customer] = (balance[s.customer] ?? 0) + (s.total - paid);
    const names = s.items.slice(0, 3).map((it) => `${it.qty} × ${it.product.split(' — ')[0].toLowerCase()}`);
    debtRows.push({ sale: s, pays, description: `${s.reference} — ${names.join(', ')}${s.items.length > 3 ? '…' : ''}` });
  }

  // Clients
  const customerRows = [
    { name: PASSAGE, phone: null, email: null, address: 'Vente au comptoir', notes: 'Ventes sans fiche client' },
    ...PROS.map(([name, phone, email]) => ({ name, phone, email, address: name.split(' — ')[1] ?? null, notes: 'Client professionnel (revendeur)' })),
    ...PARTICULIERS.map(([name, phone]) => ({ name, phone, email: null, address: null, notes: null })),
  ].map((c, i) => ({ organization_id: ORG_ID, ...c, balance: balance[c.name] ?? 0, is_active: true, created_at: addDays(START, -30 + i).toISOString() }));
  const cust = await insertMany('pme_customers', customerRows, { select: 'id, name' });
  const customerId = Object.fromEntries(cust.map((c) => [c.name, c.id]));
  console.log(`  ✓ ${Object.keys(SUPPLIERS).length} fournisseurs, ${cust.length} clients`);

  // Articles
  const prod = await insertMany(
    'pme_products',
    PRODUCTS.map((p) => ({
      organization_id: ORG_ID,
      boutique_id: boutiqueId.MADINA,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      unit_price: p.price,
      stock_quantity: stock[p.sku].stock,
      min_stock: stock[p.sku].min,
      is_active: true,
      created_at: addDays(START, -15).toISOString(),
    })),
    { select: 'id, sku' }
  );
  const productId = Object.fromEntries(prod.map((p) => [p.sku, p.id]));
  const withIds = (items) => items.map(({ sku, ...it }) => ({ product_id: productId[sku], sku, ...it }));
  console.log(`  ✓ ${prod.length} articles (${LOW_STOCK.length} sous le seuil d'alerte)`);

  // Ventes
  await insertMany(
    'pme_sales',
    sales.map((s) => ({
      organization_id: ORG_ID,
      boutique_id: boutiqueId[s.boutique],
      customer_id: customerId[s.customer],
      reference: s.reference,
      items: withIds(s.items),
      subtotal: s.total,
      total: s.total,
      payment_status: s.status,
      payment_method: s.method,
      sold_at: s.soldAt,
      created_at: s.soldAt,
      notes: s.notes,
    })),
    { select: 'id', chunk: 250 }
  );
  console.log(`  ✓ ${sales.length} ventes`);

  // Achats
  await insertMany(
    'pme_purchases',
    purchases.map((p) => ({
      organization_id: ORG_ID,
      boutique_id: boutiqueId[p.boutique],
      supplier_id: supplierId[p.supplier],
      reference: p.reference,
      items: withIds(p.items),
      total: p.total,
      payment_status: p.status,
      payment_method: p.method,
      purchased_at: p.purchasedAt,
      created_at: p.purchasedAt,
      notes: p.notes,
    })),
    { select: 'id', chunk: 250 }
  );
  console.log(`  ✓ ${purchases.length} achats fournisseurs`);

  // Dépenses
  await insertMany(
    'pme_expenses',
    expenses.map((e) => ({
      organization_id: ORG_ID,
      boutique_id: boutiqueId[e.boutique],
      category: e.category,
      description: e.description,
      amount: e.amount,
      expense_date: e.expense_date,
      created_by: dirId,
      created_at: `${e.expense_date}T11:00:00Z`,
    })),
    { select: 'id', chunk: 250 }
  );
  console.log(`  ✓ ${expenses.length} dépenses`);

  // Dettes + paiements (le montant payé et le statut sont recalculés par déclencheur)
  const debts = await insertMany(
    'pme_debts',
    debtRows.map(({ sale, description }) => ({
      organization_id: ORG_ID,
      customer_id: customerId[sale.customer],
      debtor_name: sale.customer,
      description,
      original_amount: sale.total,
      due_date: sale.debt.dueDate,
      incurred_at: iso(sale.debt.date),
      created_by: dirId,
      created_at: sale.soldAt,
    })),
    { select: 'id, description' }
  );
  const payRows = debtRows.flatMap(({ description, pays }) => {
    const id = debts.find((d) => d.description === description).id;
    return pays.map((p) => ({ organization_id: ORG_ID, debt_id: id, created_by: caisseId, created_at: `${p.paid_at}T16:00:00Z`, ...p }));
  });
  if (payRows.length) await insertMany('pme_debt_payments', payRows);
  const check = must(await admin.from('pme_debts').select('status').eq('organization_id', ORG_ID), 'lecture dettes');
  const byStatus = check.reduce((m, d) => ({ ...m, [d.status]: (m[d.status] ?? 0) + 1 }), {});
  console.log(`  ✓ ${debts.length} crédits clients (${JSON.stringify(byStatus)}), ${payRows.length} remboursements`);

  // Synthèse
  const monday = addDays(TODAY, -((TODAY.getUTCDay() + 6) % 7));
  const y = TODAY.getUTCFullYear();
  const mo = TODAY.getUTCMonth();
  const periods = {
    Jour: [TODAY, TODAY],
    Semaine: [monday, addDays(monday, 6)],
    Mois: [new Date(Date.UTC(y, mo, 1)), new Date(Date.UTC(y, mo + 1, 0))],
    Trimestre: [new Date(Date.UTC(y, Math.floor(mo / 3) * 3, 1)), new Date(Date.UTC(y, Math.floor(mo / 3) * 3 + 3, 0))],
    Année: [new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31))],
  };
  console.log('\n  Rapport « Analyse financière » (entrées − achats − dépenses) :');
  for (const [label, [a, b]] of Object.entries(periods)) {
    const t = periodTotals(sales, purchases, expenses, a, b);
    const marge = t.ventes ? Math.round(((t.ventes - t.achats) / t.ventes) * 100) : 0;
    console.log(`   ${label.padEnd(9)} ventes ${fmt(t.ventes).padStart(19)} · achats ${fmt(t.achats).padStart(19)} · charges ${fmt(t.charges).padStart(15)} · reste ${fmt(t.reste).padStart(17)} · marge brute ${marge} %`);
    if (label !== 'Jour' && t.reste <= 0) console.warn(`   ⚠️  résultat négatif sur la période « ${label} »`);
  }
  const months = [];
  for (let m = 0; m <= mo; m++) {
    const t = periodTotals(sales, purchases, expenses, new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 0)));
    months.push(`${MONTHS[m].slice(0, 4)} ${Math.round(t.reste / 1e6)} M`);
    if (t.reste <= 0) console.warn(`   ⚠️  résultat négatif en ${MONTHS[m]}`);
  }
  console.log(`   Reste par mois : ${months.join(' · ')}`);
  const revenue = sales.reduce((t, s) => t + s.total, 0);
  const opex = expenses.reduce((t, e) => t + e.amount, 0);
  const receivables = Object.values(balance).reduce((a, b) => a + b, 0);
  console.log(`   Tableau de bord : CA ${fmt(revenue)} · dépenses ${fmt(opex)} · résultat ${fmt(revenue - opex)} · créances ${fmt(receivables)}`);

  console.log('\n✅ Vitrine PME prête');
  console.log('   Direction :', VITRINE_ACCOUNTS.pme.email);
  console.log('   Caissière :', STAFF.caisse.email);
  console.log('   Magasinier :', STAFF.stock.email);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
