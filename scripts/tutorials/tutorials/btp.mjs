/** Tutoriels BTP — organisation vitrine « Bâtir Guinée SARL ». */
import { must, todayIso } from './helpers.mjs';

const KIPE = 'Immeuble R+4 Kipé';
const NEW_SITE = 'Villa R+1 Lambanyi';
const NEW_QUOTE = "Construction d'un immeuble R+2 à Nongo";
const METRE_QUOTE = "Construction d'une villa R+1 à Kipé";
const BL_REF = 'BL-2026-0450';
const FUEL_NOTE = 'Plein niveleuse — tronçon PK 6';

async function deleteSites({ services }) {
  const { admin } = services;
  const org = await services.orgId('btp');
  const sites = await must(admin.from('btp_sites').select('id').eq('organization_id', org).eq('name', NEW_SITE), 'lecture chantiers');
  for (const s of sites) await must(admin.from('btp_sites').delete().eq('id', s.id), 'suppression chantier');
}

async function deleteQuotes({ services }, title) {
  const org = await services.orgId('btp');
  await must(services.admin.from('btp_quotes').delete().eq('organization_id', org).eq('title', title), 'suppression devis');
}

async function siteId(services, name = KIPE) {
  const org = await services.orgId('btp');
  const row = await must(services.admin.from('btp_sites').select('id').eq('organization_id', org).eq('name', name).single(), 'chantier');
  return row.id;
}

/** Supprime les relevés du jour (saisis par le tutoriel) et recale l'avancement du chantier. */
async function resetTodayProgress({ services }) {
  const { admin } = services;
  const org = await services.orgId('btp');
  const id = await siteId(services);
  await must(admin.from('btp_daily_progress').delete().eq('organization_id', org).eq('site_id', id).gte('progress_date', todayIso()), 'purge relevé');
  const last = await must(
    admin.from('btp_daily_progress').select('physical_pct').eq('site_id', id).order('progress_date', { ascending: false }).limit(1).maybeSingle(),
    'dernier relevé'
  );
  if (last) await must(admin.from('btp_sites').update({ physical_progress: last.physical_pct }).eq('id', id), 'maj avancement');
}

async function deleteFuel({ services }) {
  const org = await services.orgId('btp');
  await must(services.admin.from('btp_fuel_logs').delete().eq('organization_id', org).eq('notes', FUEL_NOTE), 'purge carburant');
}

/** Supprime le BL du tutoriel et annule son entrée en stock. */
async function deleteDeliveryNote({ services }) {
  const { admin } = services;
  const org = await services.orgId('btp');
  const notes = await must(admin.from('btp_delivery_notes').select('id').eq('organization_id', org).eq('reference', BL_REF), 'lecture BL');
  for (const n of notes) {
    const moves = await must(admin.from('btp_stock_movements').select('id, stock_id, quantity').eq('delivery_note_id', n.id), 'mouvements');
    for (const m of moves) {
      const st = await must(admin.from('btp_stock').select('quantity').eq('id', m.stock_id).single(), 'stock');
      await must(admin.from('btp_stock').update({ quantity: Math.max(0, Number(st.quantity) - Number(m.quantity)) }).eq('id', m.stock_id), 'maj stock');
      await must(admin.from('btp_stock_movements').delete().eq('id', m.id), 'suppression mouvement');
    }
    await must(admin.from('btp_delivery_notes').delete().eq('id', n.id), 'suppression BL');
  }
}

async function deleteArchivedReports({ services }) {
  const org = await services.orgId('btp');
  await must(services.admin.from('organization_ai_generated_reports').delete().eq('organization_id', org), 'purge rapports');
}

/** Devis brouillon prêt pour le métré (lot « Élévation RDC » vide). */
async function createMetreQuote(run) {
  await deleteQuotes(run, METRE_QUOTE);
  const { admin } = run.services;
  const org = await run.services.orgId('btp');
  const director = await must(admin.from('profiles').select('id').eq('email', 'video.btp@konadata.demo').single(), 'directeur');
  const id = () => crypto.randomUUID();
  const line = (section, designation, unit, quantity, unitPrice) => ({ id: id(), section, designation, unit, quantity, unitPrice });
  const lots = [
    {
      id: id(),
      title: 'Installation du chantier',
      kind: 'detailed',
      quantity: 1,
      unit: 'ens',
      lumpSumAmount: 0,
      lines: [
        line('materials', 'Clôture de chantier en tôles', 'ml', 90, 85000),
        line('materials', 'Baraque de chantier (bureau et magasin)', 'ft', 1, 6500000),
        line('labor', "Main d'œuvre", 'ft', 1, 3500000),
      ],
    },
    {
      id: id(),
      title: 'Élévation RDC',
      kind: 'detailed',
      quantity: 1,
      unit: 'ens',
      lumpSumAmount: 0,
      lines: [line('materials', '', '', 0, 0), line('labor', "Main d'œuvre", 'ft', 1, 18000000), line('supervision', 'Suivi et contrôle du chantier', 'ft', 1, 2500000)],
    },
    { id: id(), title: 'Travaux divers et imprévus', kind: 'lump_sum', quantity: 1, unit: 'fft', lumpSumAmount: 8000000, lines: [] },
  ];
  const total = 90 * 85000 + 6500000 + 3500000 + 18000000 + 2500000 + 8000000;
  const existing = await must(admin.from('btp_quotes').select('number').eq('organization_id', org), 'numéros');
  const next = Math.max(0, ...existing.map((q) => Number(q.number.split('-').pop()) || 0)) + 1;
  const row = await must(
    admin
      .from('btp_quotes')
      .insert({
        organization_id: org,
        number: `DEV-2026-${String(next).padStart(4, '0')}`,
        title: METRE_QUOTE,
        subtitle: 'Villa 4 chambres — plans de l’architecte',
        client_name: 'M. Alhassane BARRY',
        location: 'Kipé, Ratoma — Conakry',
        quote_date: todayIso(),
        validity_days: 30,
        notes: 'Acompte de 30 % à la commande, solde selon avancement des travaux.',
        status: 'draft',
        lots,
        total_ht: total,
        total_ttc: total,
        created_by: director.id,
        updated_by: director.id,
      })
      .select('id')
      .single(),
    'devis métré'
  );
  run.quoteId = row.id;
}

const combobox = (nth) => ({ css: 'main [role=combobox]', nth });

export const BTP_TUTORIALS = [
  // ───────────────────────────────────────────── Tableau de bord
  {
    id: 'btp-01-tableau-de-bord',
    sector: 'btp',
    title: 'Le tableau de bord de la direction',
    role: 'Direction',
    account: 'btp',
    start: '/btp',
    intro: 'Découvrez en une minute le tableau de bord de la direction BTP.',
    steps: [
      {
        say: 'Dès la connexion, la direction voit l’essentiel : nombre de chantiers, carburant consommé, personnel actif et avancement moyen.',
        caption: 'Les indicateurs clés de tous vos chantiers',
        highlight: { css: 'main .grid >> nth=0' },
        callout: 'Indicateurs clés',
      },
      {
        say: 'Le graphique compare, semaine par semaine, l’avancement planifié et l’avancement réalisé.',
        caption: 'Planifié et réalisé, semaine par semaine',
        highlight: { text: 'Planifié vs Réalisé', up: 'card' },
        callout: 'Planifié vs réalisé',
      },
      {
        say: 'KonaAI analyse vos données et signale les priorités : anomalies de carburant, chantiers en retard, stock sous le seuil.',
        caption: 'KonaAI signale les priorités du jour',
        highlight: { text: 'KonaAI — BTP', up: 'card' },
        callout: 'Alertes automatiques',
      },
      {
        say: 'En bas, retrouvez les chantiers actifs avec leur retard, les derniers bons de livraison et les alertes carburant.',
        caption: 'Chantiers, bons de livraison et alertes carburant',
        actions: [
          { scrollTo: { text: 'Chantiers actifs', up: 'card' }, offset: 160 },
          { highlight: { text: 'Chantiers actifs', up: 'card' }, callout: 'Retards en jours' },
          { highlight: { text: 'Alertes carburant', up: 'card' }, callout: 'Consommations anormales' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Créer un chantier
  {
    id: 'btp-02-creer-chantier',
    sector: 'btp',
    title: 'Créer un chantier et son planning',
    role: 'Direction',
    account: 'btp',
    start: '/btp/chantiers',
    setup: deleteSites,
    teardown: deleteSites,
    intro: 'Créez un chantier avec son budget et son planning par tâches.',
    steps: [
      { say: 'Dans le menu Chantiers, cliquez sur Ajouter.', caption: 'Chantiers → Ajouter', click: { role: 'button', name: 'Ajouter' } },
      {
        say: 'Renseignez le nom du chantier, sa localisation, le maître d’ouvrage et le numéro du marché.',
        caption: 'Identification du chantier',
        actions: [
          { fill: { css: 'input[name=name]' }, value: NEW_SITE },
          { fill: { css: 'input[name=location]' }, value: 'Lambanyi, Ratoma — Conakry' },
          { fill: { css: 'input[name=client]' }, value: 'Mme Hawa CAMARA' },
          { fill: { css: 'input[name=contract_ref]' }, value: 'MA-2026-021' },
        ],
      },
      {
        say: 'Indiquez les dates de début et de fin, le budget total et le montant déjà engagé.',
        caption: 'Dates et budget',
        actions: [
          { fill: { css: 'input[name=start_date]' }, value: '2026-10-05' },
          { fill: { css: 'input[name=end_date]' }, value: '2027-06-30' },
          { fill: { css: 'input[name=budget]' }, value: '1450000000' },
        ],
      },
      {
        say: 'Saisissez ensuite les tâches du planning avec leurs dates. KonaData calcule la durée et le poids de chaque tâche.',
        caption: 'Le planning par tâches : durée et poids calculés',
        actions: [
          { scrollTo: { text: 'Planning des travaux' }, offset: 120 },
          { fill: { placeholder: 'Tâche (ex. Fondations)', nth: 0 }, value: 'Installation et terrassements' },
          { fill: { label: 'Date de début', exact: true, nth: 0 }, value: '2026-10-05' },
          { fill: { label: 'Date de fin', exact: true, nth: 0 }, value: '2026-11-07' },
          { fill: { placeholder: 'Tâche (ex. Fondations)', nth: 1 }, value: 'Fondations' },
          { fill: { label: 'Date de début', exact: true, nth: 1 }, value: '2026-11-02' },
          { fill: { label: 'Date de fin', exact: true, nth: 1 }, value: '2027-01-15' },
          {
            run: async ({ page }) => {
              const dates = [
                ['2027-01-11', '2027-04-30'],
                ['2027-04-19', '2027-06-30'],
              ];
              for (const [i, [start, end]] of dates.entries()) {
                await page.getByLabel('Date de début', { exact: true }).nth(i + 2).fill(start);
                await page.getByLabel('Date de fin', { exact: true }).nth(i + 2).fill(end);
              }
            },
          },
          { highlight: { text: 'Planning des travaux', up: 1 }, callout: 'Durée et poids calculés' },
        ],
      },
      {
        say: 'Complétez le niveau B : destinataire du rapport, effectif et carburant prévus, et la répartition du budget. Ces valeurs alimentent les comparaisons du rapport.',
        caption: 'Niveau B : prévisions et répartition du budget',
        actions: [
          { scrollTo: { text: 'Niveau B — Budget détaillé & ressources' }, offset: 100 },
          { fill: { css: 'input[name=moa_recipient]' }, value: 'Mme Hawa CAMARA' },
          { fill: { css: 'input[name=planned_avg_workers]' }, value: '12' },
          { fill: { css: 'input[name=planned_monthly_fuel_liters]' }, value: '500' },
          { highlight: { text: 'Répartition budgétaire (%)', up: 1 }, callout: 'Répartition du budget' },
        ],
      },
      {
        say: 'Enregistrez : le chantier apparaît dans la liste, prêt pour la saisie terrain.',
        caption: 'Enregistrer le chantier',
        actions: [
          { click: { role: 'button', name: 'Enregistrer le chantier' }, waitFor: { text: NEW_SITE, exact: true }, waitTimeout: 30000, wait: 1500 },
          { highlight: { text: NEW_SITE, exact: true, up: 'card' }, callout: 'Nouveau chantier' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Fiche journalière (mobile, chef de chantier)
  {
    id: 'btp-03-fiche-journaliere',
    sector: 'btp',
    device: 'mobile',
    title: 'La fiche journalière sur le terrain',
    role: 'Chef de chantier',
    account: 'btp-chef',
    start: '/btp/avancement',
    setup: resetTodayProgress,
    teardown: resetTodayProgress,
    intro: 'Le chef de chantier saisit l’avancement du jour depuis son téléphone.',
    steps: [
      {
        say: 'Depuis Avancement, touchez Saisir l’avancement.',
        caption: 'Avancement → Saisir',
        click: { role: 'button', name: /Saisir l.avancement/ },
        waitFor: { text: 'Nouveau relevé d' },
      },
      {
        say: 'Choisissez votre chantier.',
        caption: 'Choisir le chantier',
        actions: [{ click: combobox(0) }, { click: { role: 'option', name: KIPE } }],
      },
      {
        say: 'Pour chaque tâche en cours, indiquez le pourcentage réalisé. Le prévu du jour est affiché à côté.',
        caption: 'Réalisé par tâche, comparé au prévu',
        actions: [
          { scrollTo: { text: 'Avancement par tâche' }, offset: 80 },
          { fill: { label: 'Avancement réalisé — Dalles R+1 et R+2' }, value: '100' },
          { fill: { label: 'Avancement réalisé — Élévation R+2 et R+3' }, value: '27' },
        ],
      },
      {
        say: 'L’avancement global est recalculé automatiquement selon le poids de chaque tâche.',
        caption: 'Avancement global calculé automatiquement',
        highlight: { text: 'Avancement physique global (%)', up: 1 },
        callout: 'Calcul automatique',
      },
      {
        say: 'Ajoutez l’effectif, la météo et vos observations.',
        caption: 'Effectif, météo, observations',
        actions: [
          { fill: { css: 'input[name=workers_count]' }, value: '23' },
          { fill: { css: 'input[name=weather]' }, value: 'Averses le matin' },
          { fill: { css: 'input[name=notes]' }, value: 'Coulage poteaux R+3 bloc B, maçonnerie façade nord.' },
        ],
      },
      {
        say: 'Enregistrez. La direction voit immédiatement la mise à jour, et la fiche alimente le rapport de la semaine.',
        caption: 'Enregistré : la direction est informée',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: 'Relevé enregistré' }, waitTimeout: 30000, wait: 1200 },
          { highlight: { text: 'Relevé enregistré', up: 1 }, callout: 'Écart au planning' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Carburant
  {
    id: 'btp-04-carburant',
    sector: 'btp',
    title: 'Enregistrer un relevé de carburant',
    role: 'Chef de chantier / Direction',
    account: 'btp',
    start: '/btp/carburant',
    setup: deleteFuel,
    teardown: deleteFuel,
    intro: 'Suivez la consommation de carburant de chaque chantier et repérez les anomalies.',
    steps: [
      { say: 'Dans Carburant, cliquez sur Relevé.', caption: 'Carburant → Relevé', click: { role: 'button', name: 'Relevé', exact: true } },
      {
        say: 'Choisissez le chantier.',
        caption: 'Choisir le chantier',
        actions: [{ click: combobox(0) }, { click: { role: 'option', name: 'Route Dubréka – Khorira (8 km)' } }],
      },
      {
        say: 'Saisissez les litres, le coût et une note.',
        caption: 'Litres, coût et note',
        actions: [
          { fill: { css: 'input[name=liters]' }, value: '180' },
          { fill: { css: 'input[name=cost]' }, value: '2160000' },
          { fill: { css: 'input[name=notes]' }, value: FUEL_NOTE },
        ],
      },
      {
        say: 'En cas de consommation suspecte, cochez Anomalie : elle remontera dans les alertes de la direction.',
        caption: 'Signaler une anomalie',
        highlight: { text: 'Marquer comme anomalie', up: 1 },
        callout: 'Alerte direction',
      },
      {
        say: 'Enregistrez. Le relevé s’ajoute à l’historique et au rapport de la période.',
        caption: 'Enregistré dans l’historique',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, wait: 2500 },
          { highlight: { text: 'Route Dubréka – Khorira (8 km)', exact: true, nth: 0, up: 'card' }, callout: 'Nouveau relevé' },
          { highlight: { text: 'Alerte', exact: true, nth: 0, up: 'card' }, callout: 'Les anomalies ressortent en rouge' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Bons de livraison
  {
    id: 'btp-05-bons-livraison',
    sector: 'btp',
    title: 'Saisir et valider un bon de livraison',
    role: 'Chef de chantier / Direction',
    account: 'btp',
    start: '/btp/bons',
    setup: deleteDeliveryNote,
    teardown: deleteDeliveryNote,
    intro: 'Saisissez un bon de livraison, puis validez-le pour mettre le stock à jour.',
    steps: [
      {
        say: 'Dans Bons, cliquez sur Nouveau BL.',
        caption: 'Bons → Nouveau BL',
        click: { role: 'button', name: 'Nouveau BL' },
        waitFor: { text: 'Saisie — bon de livraison' },
      },
      {
        say: 'Choisissez le chantier, puis saisissez la référence, le montant, le fournisseur et la date.',
        caption: 'Chantier, référence, montant, fournisseur',
        actions: [
          { click: combobox(0) },
          { click: { role: 'option', name: KIPE } },
          { fill: { css: 'input[name=reference]' }, value: BL_REF },
          { fill: { css: 'input[name=total_amount]' }, value: '19000000' },
          { fill: { css: 'input[name=supplier]' }, value: 'Cimenterie de Conakry' },
          { fill: { css: 'input[name=delivery_date]' }, value: todayIso() },
        ],
      },
      {
        say: 'Détaillez les lignes reçues : article, quantité et unité.',
        caption: 'Les lignes reçues',
        actions: [
          { scrollTo: { text: 'Lignes reçues (détail)' }, offset: 120 },
          { fill: { placeholder: 'Ciment CPJ 42.5', nth: 0 }, value: 'Ciment CPJ 42.5 (sac de 50 kg)' },
          { fill: { field: 'Qté reçue' }, value: '200' },
          { fill: { placeholder: 'sacs', nth: 0 }, value: 'sac' },
        ],
      },
      {
        say: 'Enregistrez en brouillon.',
        caption: 'Enregistrer en brouillon',
        click: { role: 'button', name: 'Enregistrer en brouillon' },
        waitFor: { text: BL_REF, exact: true },
        waitTimeout: 30000,
        wait: 1500,
      },
      {
        say: 'Ouvrez le bon, gardez l’option d’entrée en stock, puis validez : les 200 sacs sont ajoutés au stock du chantier.',
        caption: 'Valider : le stock est mis à jour',
        actions: [
          { click: { text: BL_REF, exact: true }, waitFor: { role: 'button', name: 'Valider le bon' } },
          { highlight: { text: 'Ajouter les quantités au stock à la validation', up: 1 }, callout: 'Entrée en stock' },
          { click: { role: 'button', name: 'Valider le bon' }, wait: 2000 },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Rapport périodique
  {
    id: 'btp-06-rapport-periodique',
    sector: 'btp',
    title: 'Compiler le rapport de chantier périodique',
    role: 'Direction / Chef de chantier',
    account: 'btp',
    start: '/btp/rapports',
    setup: deleteArchivedReports,
    teardown: deleteArchivedReports,
    intro: 'Un rapport de chantier complet, compilé automatiquement en PDF et PowerPoint.',
    steps: [
      {
        say: 'Dans Rapports, le rapport périodique compile automatiquement les fiches journalières, le carburant et les bons de livraison.',
        caption: 'Rapports → Rapport périodique chantier',
        highlight: { text: 'Rapport périodique chantier', up: 'card' },
        callout: 'Compilation automatique',
        zoom: 1,
      },
      {
        say: 'Choisissez le chantier et la période : semaine, mois, trimestre ou année.',
        caption: 'Chantier et période',
        actions: [
          { click: combobox(0) },
          { click: { role: 'option', name: KIPE } },
          { highlight: combobox(1), callout: 'Semaine, mois, trimestre, année' },
        ],
      },
      {
        say: 'Choisissez le planning de référence pour la comparaison entre prévu et réalisé.',
        caption: 'Planning de référence',
        highlight: combobox(2),
        callout: 'Prévu vs réalisé',
      },
      {
        say: 'Pour un rapport destiné à l’extérieur, décochez les données financières : aucun montant n’apparaîtra.',
        caption: 'Avec ou sans données financières',
        highlight: { text: 'Afficher les données financières', up: 2 },
        callout: 'Rapport interne ou externe',
      },
      {
        say: 'Ajoutez un commentaire de synthèse. Les photos du chantier et le logo de l’entreprise sont intégrés automatiquement.',
        caption: 'Commentaire, photos et logo intégrés',
        actions: [
          { fill: { placeholder: 'Risques semaine prochaine, demandes MOA, décisions…' }, value: 'Dalle R+2 terminée. Semaine prochaine : poteaux et poutres R+3. Besoin : 120 barres HA12.' },
          { highlight: { text: 'Photos du chantier :', up: 1 }, callout: '6 photos les plus récentes' },
          { highlight: { text: "Logo de l'entreprise", up: 1 }, callout: 'En-tête du rapport' },
        ],
      },
      {
        say: 'Cliquez sur Compiler le rapport.',
        caption: 'Compiler le rapport',
        click: { role: 'button', name: 'Compiler le rapport' },
        waitFor: { role: 'button', name: 'Télécharger PDF' },
        waitTimeout: 180000,
        wait: 1500,
      },
      {
        say: 'Téléchargez le PDF : page de garde, indicateurs, planifié contre réalisé par tâche, courbes, carburant, bons de livraison, photos et signatures.',
        caption: 'Le rapport PDF, prêt à envoyer',
        actions: [
          { download: { role: 'button', name: 'Télécharger PDF' } },
          { pages: { max: 6, title: 'Rapport de chantier — PDF' } },
        ],
      },
      {
        say: 'Le même rapport existe en PowerPoint, pour vos réunions de chantier.',
        caption: 'Aussi en PowerPoint',
        highlight: { role: 'button', name: 'Télécharger PPTX' },
        callout: 'Présentation PowerPoint',
      },
    ],
  },

  // ───────────────────────────────────────────── Créer un devis
  {
    id: 'btp-07-creer-devis',
    sector: 'btp',
    title: 'Créer un devis par lots',
    role: 'Direction',
    account: 'btp',
    start: '/btp/devis',
    setup: (run) => deleteQuotes(run, NEW_QUOTE),
    teardown: (run) => deleteQuotes(run, NEW_QUOTE),
    intro: 'Créez un devis par lots, avec les prix de votre catalogue.',
    steps: [
      { say: 'Dans Devis, cliquez sur Nouveau devis.', caption: 'Devis → Nouveau devis', click: { role: 'button', name: 'Nouveau devis' } },
      {
        say: 'Saisissez l’intitulé du projet, le client et le lieu des travaux.',
        caption: 'Projet, client, lieu',
        actions: [
          { fill: { css: 'input[name=title]' }, value: NEW_QUOTE },
          { fill: { css: 'input[name=client_name]' }, value: 'M. Mamadou BARRY' },
          { fill: { css: 'input[name=location]' }, value: 'Nongo, Ratoma — Conakry' },
        ],
      },
      {
        say: 'Partez des lots types : installation, fondation, élévation, dalle, toiture et imprévus.',
        caption: 'Structure de départ : lots types',
        highlight: { css: 'select[name=structure]' },
        callout: 'Lots types proposés',
      },
      {
        say: 'Cliquez sur Créer et remplir le devis. Le numéro est attribué automatiquement.',
        caption: 'Numéro attribué automatiquement',
        click: { role: 'button', name: 'Créer et remplir le devis' },
        waitUrl: /\/btp\/devis\/[0-9a-f-]{36}/,
        wait: 1500,
      },
      {
        say: 'Dans chaque lot, tapez une désignation : le prix unitaire vient de votre catalogue. Saisissez la quantité.',
        caption: 'Les prix viennent du catalogue',
        actions: [
          { scrollTo: { text: 'Lot 1', exact: true }, offset: 90 },
          { fill: { placeholder: 'Désignation', nth: 0 }, value: 'Clôture de chantier en tôles' },
          { fill: { label: 'Quantité', exact: true, nth: 0 }, value: '120' },
          { fill: { label: 'Prix unitaire', exact: true, nth: 1 }, value: '4500000' },
          { fill: { label: 'Prix unitaire', exact: true, nth: 2 }, value: '1200000' },
        ],
      },
      {
        say: 'Chaque lot est organisé en rubriques : matériaux, matériels, main d’œuvre, suivi et contrôle, avec leurs sous-totaux.',
        caption: 'Rubriques et sous-totaux par lot',
        highlight: { text: 'Lot 1', exact: true, up: 'card' },
        callout: 'Sous-totaux automatiques',
      },
      {
        say: 'Le récapitulatif se met à jour en direct. Activez la TVA si besoin : le total est aussi écrit en lettres.',
        caption: 'Récapitulatif, TVA et montant en lettres',
        actions: [
          { click: { role: 'switch' } },
          { highlight: { text: 'Arrêté à la somme de', up: 'card' }, callout: 'Montant en lettres' },
        ],
      },
      {
        say: 'Enregistrez. Vous pourrez ensuite exporter en PDF ou en Excel, et suivre le statut du devis.',
        caption: 'Enregistrer, exporter, suivre',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', nth: 0 }, waitFor: { text: 'Devis enregistré.' }, waitTimeout: 30000 },
          { highlight: { text: 'Suivi du devis', up: 'card' }, callout: 'Envoyé, accepté, nouvelle version…' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Métré / extrait des matériaux
  {
    id: 'btp-08-devis-metre',
    sector: 'btp',
    title: 'Le métré : de l’ouvrage aux quantités de matériaux',
    role: 'Direction',
    account: 'btp',
    setup: createMetreQuote,
    start: (run) => `/btp/devis/${run.quoteId}`,
    teardown: (run) => deleteQuotes(run, METRE_QUOTE),
    intro: 'Saisissez les dimensions des ouvrages : KonaData calcule les matériaux et les chiffre.',
    steps: [
      {
        say: 'Dans votre devis, ouvrez le lot à chiffrer, ici l’élévation du rez-de-chaussée, puis cliquez sur Métré, extrait des matériaux.',
        caption: 'Lot → Métré / extrait des matériaux',
        actions: [
          { scrollTo: { text: 'Lot 2', exact: true }, offset: 90 },
          { click: { role: 'button', name: 'Métré / extrait des matériaux', nth: 1 } },
        ],
      },
      {
        say: 'Ajoutez les ouvrages. Pour les poteaux : le nombre et la hauteur. Les sections et le ratio d’acier sont préremplis.',
        caption: 'Poteaux : nombre et hauteur',
        actions: [
          { select: { css: 'select:has(option[value="column"])' }, option: 'Poteau' },
          { fill: { label: 'Nombre', exact: true, nth: 'last' }, value: '16' },
          { fill: { label: 'Hauteur', exact: true, nth: 'last' }, value: '3' },
        ],
      },
      {
        say: 'Puis les poutres, avec leur portée.',
        caption: 'Poutres : nombre et portée',
        actions: [
          { select: { css: 'select:has(option[value="beam"])' }, option: 'Poutre' },
          { fill: { label: 'Nombre', exact: true, nth: 'last' }, value: '12' },
          { fill: { label: 'Portée', exact: true, nth: 'last' }, value: '4,5' },
        ],
      },
      {
        say: 'Et les murs en agglos : longueur, hauteur, ouvertures à déduire.',
        caption: 'Murs en agglos : longueur, hauteur, ouvertures',
        actions: [
          { select: { css: 'select:has(option[value="masonry"])' }, option: 'Mur / cloison en agglos' },
          { fill: { label: 'Longueur', exact: true, nth: 'last' }, value: '64' },
          { fill: { label: 'Hauteur', exact: true, nth: 'last' }, value: '3' },
          { fill: { label: 'Ouvertures à déduire', exact: true, nth: 'last' }, value: '18' },
        ],
      },
      {
        say: 'L’extrait des matériaux est calculé instantanément : ciment, sable, gravier, fers par diamètre, fil à ligaturer, coffrage et agglos, pertes incluses.',
        caption: 'L’extrait des matériaux, pertes incluses',
        actions: [
          { scrollTo: { text: 'Extrait des matériaux', up: 'card' }, offset: 90 },
          { highlight: { text: 'Extrait des matériaux', up: 3 }, callout: 'Quantités calculées' },
        ],
      },
      {
        say: 'Cliquez sur Reporter dans les matériaux du lot : les lignes sont créées avec les prix de votre catalogue.',
        caption: 'Reporter dans le devis, prix du catalogue',
        actions: [
          { click: { role: 'button', name: 'Reporter dans les Matériaux du lot' }, wait: 1000 },
          { scrollTo: { text: 'métré', exact: true, nth: 0 }, offset: 160 },
          { highlight: { css: 'table', within: { text: 'Lot 2', exact: true, up: 'card' }, nth: 'last' }, callout: 'Lignes « métré » chiffrées' },
        ],
      },
      {
        say: 'Le total du lot et le récapitulatif sont à jour. Enregistrez, puis exportez le devis en PDF.',
        caption: 'Enregistrer et exporter en PDF',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', nth: 0 }, waitFor: { text: 'Devis enregistré.' }, waitTimeout: 30000 },
          { download: { role: 'button', name: 'PDF', exact: true } },
          { pages: { max: 4, title: 'Devis — PDF' } },
        ],
      },
    ],
  },
];
