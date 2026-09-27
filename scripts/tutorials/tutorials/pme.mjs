/** Tutoriels PME — organisation vitrine « Espace Commercial Madina ». */
import { addDaysIso, must, todayIso } from './helpers.mjs';

const BOUTIQUE = 'Boutique Madina — Détail';
const DEPOT = 'Dépôt Matam — Gros';

const SALE_CUSTOMER = 'Épicerie Sow — Kipé';
const SALE_CARD = /Épicerie Sow — Kipé — 1.270.000/;
const SALE_NOTES = '3 sacs de riz brisé 25 kg + 2 bidons d’huile 5 L + 1 carton de tomate 400 g';
const SALE_AMOUNT = '1270000';

const NEW_ITEM = 'Mayonnaise — seau 5 kg';

const EXPENSE_DESC = 'Tricycle — livraison dépôt Matam → Madina';
const PURCHASE_REF = 'FAC-HK-2291';

const DEBT_CUSTOMER = 'Mariama KEÏTA';
const DEBT_DESC = '2 sacs de riz parfumé 25 kg + 1 bidon d’huile 20 L';

async function deleteSale({ services }) {
  const org = await services.orgId('pme');
  await must(services.admin.from('pme_sales').delete().eq('organization_id', org).eq('notes', SALE_NOTES), 'purge vente');
}

async function deleteItem({ services }) {
  const org = await services.orgId('pme');
  await must(services.admin.from('pme_products').delete().eq('organization_id', org).eq('name', NEW_ITEM), 'purge article');
}

async function deleteExpenseAndPurchase({ services }) {
  const org = await services.orgId('pme');
  await must(services.admin.from('pme_expenses').delete().eq('organization_id', org).eq('description', EXPENSE_DESC), 'purge dépense');
  await must(services.admin.from('pme_purchases').delete().eq('organization_id', org).eq('reference', PURCHASE_REF), 'purge achat');
}

async function deleteDebt({ services }) {
  const { admin } = services;
  const org = await services.orgId('pme');
  const debts = await must(admin.from('pme_debts').select('id').eq('organization_id', org).eq('description', DEBT_DESC), 'lecture dettes');
  for (const d of debts) {
    await must(admin.from('pme_debt_payments').delete().eq('debt_id', d.id), 'purge paiements');
    await must(admin.from('pme_debts').delete().eq('id', d.id), 'purge dette');
  }
}

const debtCard = { text: DEBT_DESC, up: 'card' };

export const PME_TUTORIALS = [
  // ───────────────────────────────────────────── Tableau de bord
  {
    id: 'pme-01-tableau-de-bord',
    sector: 'pme',
    title: 'Le tableau de bord de votre commerce',
    role: 'Gérant / Propriétaire',
    account: 'pme',
    start: '/pme',
    intro: 'Découvrez en une minute le tableau de bord de votre commerce.',
    steps: [
      {
        say: 'Dès la connexion, vous voyez l’essentiel de votre commerce : chiffre d’affaires, dépenses et nombre d’articles en stock.',
        caption: 'Les indicateurs clés de votre commerce',
        highlight: { css: 'main .grid', nth: 0 },
        callout: 'Indicateurs clés',
      },
      {
        say: 'Les recommandations de Kona Data signalent les priorités : articles sous le seuil d’alerte, créances clients à relancer.',
        caption: 'Les recommandations IA du jour',
        highlight: { text: 'Recommandations IA', up: 'card' },
        callout: 'Priorités du jour',
      },
      {
        say: 'Juste en dessous, retrouvez vos dernières ventes avec leur statut de paiement, et vos dépenses récentes.',
        caption: 'Dernières ventes et dépenses récentes',
        actions: [
          { scrollTo: { text: 'Dernières ventes', exact: true }, offset: 120 },
          { highlight: { text: 'Dernières ventes', exact: true, up: 'card' }, callout: 'Payé, en attente, partiel' },
          { highlight: { text: 'Dépenses récentes', exact: true, up: 'card' }, callout: 'Loyer, transport, salaires…' },
        ],
      },
      {
        say: 'En bas, les articles en stock bas à réapprovisionner, et les clients qui vous doivent encore de l’argent.',
        caption: 'Stock bas et créances clients',
        actions: [
          { scrollTo: { text: /^Stock bas \(/, up: 2 }, offset: 160 },
          { highlight: { text: /^Stock bas \(/, up: 1 }, callout: 'À réapprovisionner' },
          { highlight: { text: 'Créances clients', exact: true, up: 1 }, callout: 'À encaisser' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Enregistrer une vente
  {
    id: 'pme-02-enregistrer-vente',
    sector: 'pme',
    title: 'Enregistrer une vente',
    role: 'Gérant / Caissière',
    account: 'pme',
    start: '/pme/ventes',
    setup: deleteSale,
    teardown: deleteSale,
    intro: 'Enregistrez une vente en quelques secondes, au comptoir ou au dépôt.',
    steps: [
      {
        say: 'Dans Ventes, cliquez sur Nouvelle vente.',
        caption: 'Ventes → Nouvelle vente',
        click: { role: 'button', name: 'Nouvelle vente' },
        waitFor: { css: 'input[name=total]' },
      },
      {
        say: 'La référence est attribuée automatiquement. Saisissez le montant de la vente et choisissez le client.',
        caption: 'Montant et client',
        actions: [
          { highlight: { css: 'input[name=reference]' }, callout: 'Référence automatique' },
          { fill: { css: 'input[name=total]' }, value: SALE_AMOUNT },
          { select: { css: 'select[name=customer_id]' }, option: SALE_CUSTOMER },
        ],
      },
      {
        say: 'Choisissez la boutique et le statut du paiement : ici, le client a payé comptant.',
        caption: 'Boutique et paiement',
        actions: [
          { select: { css: 'select[name=boutique_id]' }, option: BOUTIQUE },
          { select: { css: 'select[name=payment_status]' }, option: 'Payé' },
        ],
      },
      {
        say: 'Dans les notes, détaillez les articles vendus.',
        caption: 'Le détail des articles dans les notes',
        fill: { css: 'input[name=notes]' },
        value: SALE_NOTES,
      },
      {
        say: 'Enregistrez : la vente apparaît en tête de liste, et le tableau de bord est mis à jour.',
        caption: 'Enregistrée en tête de liste',
        actions: [
          {
            click: { role: 'button', name: 'Enregistrer', exact: true },
            waitFor: { text: SALE_CARD },
            waitTimeout: 30000,
            wait: 1500,
          },
          { highlight: { text: SALE_CARD, up: 'card' }, callout: 'Nouvelle vente · Payé' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Stock et alertes
  {
    id: 'pme-03-stock-alerte',
    sector: 'pme',
    title: 'Ajouter un article et suivre les alertes de stock',
    role: 'Gérant / Magasinier',
    account: 'pme',
    start: '/pme/stocks',
    setup: deleteItem,
    teardown: deleteItem,
    intro: 'Ajoutez un article avec son seuil d’alerte : KonaData vous prévient quand il faut réapprovisionner.',
    steps: [
      {
        say: 'Dans Stocks, cliquez sur Nouvel article.',
        caption: 'Stocks → Nouvel article',
        click: { role: 'button', name: 'Nouvel article' },
        waitFor: { css: 'input[name=name]' },
      },
      {
        say: 'Saisissez le nom de l’article, la boutique, son code, l’unité et le prix de vente.',
        caption: 'Nom, boutique, code, unité et prix',
        actions: [
          { fill: { css: 'input[name=name]' }, value: NEW_ITEM },
          { select: { css: 'select[name=boutique_id]' }, option: DEPOT },
          { fill: { css: 'input[name=sku]' }, value: 'ALI-MAY5' },
          { fill: { css: 'input[name=unit]' }, value: 'seau' },
          { fill: { css: 'input[name=unit_price]' }, value: '145000' },
        ],
      },
      {
        say: 'Indiquez la quantité en stock et le seuil d’alerte. Ici, il ne reste que deux seaux pour un seuil de cinq.',
        caption: 'Quantité en stock et seuil d’alerte',
        actions: [
          { fill: { css: 'input[name=stock_quantity]' }, value: '2' },
          { fill: { css: 'input[name=min_stock]' }, value: '5' },
        ],
      },
      {
        say: 'Enregistrez. L’article est marqué Stock bas : il est temps de passer commande.',
        caption: 'Badge « Stock bas » sous le seuil',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: NEW_ITEM, exact: true }, waitTimeout: 30000, wait: 2500 },
          { highlight: { text: NEW_ITEM, exact: true, up: 'card' }, callout: 'Stock bas' },
        ],
      },
      {
        say: 'Sur le tableau de bord, l’article rejoint la liste des stocks bas, et Kona Data le signale dans ses recommandations.',
        caption: 'L’alerte remonte au tableau de bord',
        actions: [
          { goto: '/pme' },
          { scrollTo: { text: /^Stock bas \(/, up: 2 }, offset: 160 },
          { highlight: { text: /^Stock bas \(/, up: 1 }, callout: 'Nouvel article à commander' },
          { highlight: { text: /sous le seuil de stock/, up: 1 }, callout: 'Recommandation IA' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Dépenses et achats
  {
    id: 'pme-04-depenses-achats',
    sector: 'pme',
    title: 'Enregistrer une dépense et un achat fournisseur',
    role: 'Gérant / Propriétaire',
    account: 'pme',
    start: '/pme/depenses',
    setup: deleteExpenseAndPurchase,
    teardown: deleteExpenseAndPurchase,
    intro: 'Notez chaque dépense et chaque achat : vos rapports calculent ce qu’il vous reste vraiment.',
    steps: [
      {
        say: 'Dans Dépenses, cliquez sur Ajouter.',
        caption: 'Dépenses → Ajouter',
        click: { role: 'button', name: 'Ajouter', exact: true },
        waitFor: { css: 'input[name=amount]' },
      },
      {
        say: 'Indiquez la catégorie, par exemple Transport, une description et le montant. La catégorie regroupe vos dépenses dans les rapports.',
        caption: 'Catégorie, description et montant',
        actions: [
          { fill: { css: 'input[name=category]' }, value: 'Transport' },
          { fill: { css: 'input[name=description]' }, value: EXPENSE_DESC },
          { fill: { css: 'input[name=amount]' }, value: '150000' },
          { fill: { css: 'input[name=expense_date]' }, value: todayIso() },
          { select: { css: 'select[name=boutique_id]' }, option: DEPOT },
        ],
      },
      {
        say: 'Enregistrez : la dépense s’ajoute à la liste.',
        caption: 'Dépense enregistrée',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: EXPENSE_DESC, exact: true }, waitTimeout: 30000, wait: 1500 },
          { highlight: { text: EXPENSE_DESC, exact: true, up: 'card' }, callout: 'Transport · 150 000 FG' },
        ],
      },
      {
        say: 'Pour une livraison de marchandises, allez dans Achats et cliquez sur Ajouter.',
        caption: 'Achats → Ajouter',
        actions: [
          { goto: '/pme/achats' },
          { click: { role: 'button', name: 'Ajouter', exact: true }, waitFor: { css: 'input[name=total]' } },
        ],
      },
      {
        say: 'Saisissez le numéro de facture du fournisseur, le montant, le fournisseur, la boutique livrée et le statut du paiement.',
        caption: 'Facture, montant, fournisseur, paiement',
        actions: [
          { fill: { css: 'input[name=reference]' }, value: PURCHASE_REF },
          { fill: { css: 'input[name=total]' }, value: '8250000' },
          { select: { css: 'select[name=supplier_id]' }, option: 'Huilerie de Kankan' },
          { select: { css: 'select[name=boutique_id]' }, option: DEPOT },
          { select: { css: 'select[name=payment_status]' }, option: 'En attente' },
        ],
      },
      {
        say: 'Enregistrez. L’achat apparaît en tête de liste, en attente de paiement, et entre dans le calcul de vos rapports.',
        caption: 'Achat enregistré, en attente de paiement',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: PURCHASE_REF, exact: true }, waitTimeout: 30000, wait: 1500 },
          { highlight: { text: PURCHASE_REF, exact: true, up: 'card' }, callout: 'En attente de paiement' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Crédits clients
  {
    id: 'pme-05-credits-clients',
    sector: 'pme',
    title: 'Suivre les crédits clients et leurs remboursements',
    role: 'Gérant / Propriétaire',
    account: 'pme',
    start: '/pme/dettes',
    setup: deleteDebt,
    teardown: deleteDebt,
    intro: 'Notez les ventes à crédit et suivez chaque remboursement jusqu’au solde.',
    steps: [
      {
        say: 'Dans Crédits et dettes, vous voyez en un coup d’œil le total crédité, l’argent déjà encaissé et le reste dû.',
        caption: 'Total crédité, encaissé, restant dû',
        highlight: { text: 'Total crédité', exact: true, up: 4 },
        callout: 'Vue d’ensemble',
      },
      {
        say: 'Cliquez sur Nouvelle dette, choisissez le client et décrivez les marchandises données à crédit.',
        caption: 'Nouvelle dette : client et motif',
        actions: [
          { click: { role: 'button', name: 'Nouvelle dette' }, waitFor: { css: 'input[name=original_amount]' } },
          { select: { css: 'select[name=customer_id]' }, option: DEBT_CUSTOMER },
          { fill: { css: 'input[name=description]' }, value: DEBT_DESC },
        ],
      },
      {
        say: 'Saisissez le montant total dû et fixez une échéance de remboursement, puis enregistrez.',
        caption: 'Montant dû et échéance',
        actions: [
          { fill: { css: 'input[name=original_amount]' }, value: '1090000' },
          { fill: { css: 'input[name=incurred_at]' }, value: todayIso() },
          { fill: { css: 'input[name=due_date]' }, value: addDaysIso(todayIso(), 15) },
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: debtCard, waitTimeout: 30000, wait: 2500 },
        ],
      },
      {
        say: 'La dette apparaît avec le badge À payer.',
        caption: 'Nouvelle dette : « À payer »',
        actions: [
          { scrollTo: debtCard, offset: 200 },
          { highlight: debtCard, callout: 'À payer' },
        ],
      },
      {
        say: 'Quand le client rembourse une partie, cliquez sur Saisir un paiement reçu et indiquez le montant.',
        caption: 'Saisir un paiement reçu',
        actions: [
          { click: { role: 'button', name: 'Saisir un paiement reçu', within: debtCard }, waitFor: { css: 'input[name=amount]' } },
          { fill: { css: 'input[name=amount]' }, value: '500000' },
          { fill: { css: 'input[name=note]' }, value: 'Versement Orange Money' },
        ],
      },
      {
        say: 'Validez : le badge passe à Partiel, la barre de progression avance et les totaux sont mis à jour.',
        caption: 'Remboursement partiel : badge « Partiel »',
        actions: [
          {
            click: { role: 'button', name: 'Valider le paiement' },
            waitFor: { text: 'Partiel', exact: true, within: debtCard },
            waitTimeout: 30000,
            wait: 2500,
          },
          { scrollTo: debtCard, offset: 200 },
          { highlight: debtCard, callout: 'Partiel · reste 590 000 FG' },
          { scrollTo: { text: 'Total crédité', exact: true }, offset: 140 },
          { highlight: { text: 'Total crédité', exact: true, up: 4 }, callout: 'Totaux mis à jour' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Rapports
  {
    id: 'pme-06-rapports',
    sector: 'pme',
    title: 'L’analyse financière et son export PDF',
    role: 'Gérant / Propriétaire',
    account: 'pme',
    start: '/pme/rapports',
    intro: 'Entrées, dépenses et reste de votre commerce, prêts à présenter en PDF.',
    steps: [
      {
        say: 'Dans Rapports, l’analyse financière calcule vos entrées, vos dépenses et ce qu’il vous reste, à partir des ventes, des achats et des dépenses.',
        caption: 'Rapports → Analyse financière',
        highlight: { text: 'Analyse financière — présentable', up: 'card' },
        callout: 'Ventes, achats, dépenses',
        zoom: 1,
      },
      {
        say: 'Choisissez une boutique ou toutes les boutiques, puis la période : semaine, mois, trimestre ou année. Ici, le mois en cours.',
        caption: 'Boutique et période',
        actions: [
          { highlight: { css: '#pme-boutique' }, callout: 'Une boutique ou toutes' },
          { click: { role: 'button', name: 'Mois', exact: true }, waitFor: { role: 'button', name: 'Télécharger PDF' }, waitTimeout: 60000, wait: 1500 },
        ],
      },
      {
        say: 'Le bilan s’affiche : entrées, dépenses, et le reste, c’est-à-dire ce que le commerce a vraiment gagné.',
        caption: 'Entrées, dépenses et reste',
        actions: [
          { scrollTo: { text: /^Analyses financières —/ }, offset: 120 },
          { highlight: { text: 'Entrées', exact: true, up: 3 }, callout: 'Le bilan de la période' },
        ],
      },
      {
        say: 'Les tableaux et les graphiques détaillent chaque semaine du mois, avec les achats de marchandises et les dépenses par catégorie.',
        caption: 'Tableaux et graphiques, semaine par semaine',
        actions: [
          { scrollTo: { text: /^Entrées par / }, offset: 200 },
          { highlight: { text: /^Entrées par /, up: 1 }, callout: 'Entrées par semaine' },
          { scrollTo: { text: 'Dépenses par catégorie', exact: true }, offset: 120 },
          { highlight: { text: 'Dépenses par catégorie', exact: true, up: 1 }, callout: 'Marchandises, loyer, transport…' },
        ],
      },
      {
        say: 'Cliquez sur Télécharger PDF : un rapport propre, prêt à présenter à votre banque ou à vos associés.',
        caption: 'Le rapport PDF, prêt à présenter',
        actions: [
          { download: { role: 'button', name: 'Télécharger PDF' } },
          { pages: { max: 4, title: 'Analyse financière — PDF' } },
        ],
      },
    ],
  },
];
