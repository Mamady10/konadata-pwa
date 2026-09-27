/** Tutoriels ONG — organisation vitrine « Santé & Avenir Guinée ». */
import { addDaysIso, must, todayIso } from './helpers.mjs';

const NEW_PROJECT = 'Accès à l’eau – Forécariah';
const NEW_SURVEY = 'Fonctionnement des forages – Boké';
const NEW_BENEFICIARY = 'Sayon DOUMBOUYA';
const SURVEY_A4003 = 'b7a1e0c2-3d4f-4a5b-8c6d-0000000a4003';
const PROJECT_BOKE = /Accès à l.eau potable — Boké/;
const PROJECT_KINDIA = 'Santé maternelle et infantile — Kindia';

async function deleteProjects({ services }) {
  const org = await services.orgId('ong');
  await must(services.admin.from('ngo_projects').delete().eq('organization_id', org).eq('name', NEW_PROJECT), 'suppression projet');
}

/** Supprime le sondage du tutoriel et tout ce qui s'y rattache. */
async function deleteSurveys({ services }) {
  const { admin } = services;
  const org = await services.orgId('ong');
  const surveys = await must(admin.from('ngo_surveys').select('id').eq('organization_id', org).eq('title', NEW_SURVEY), 'lecture sondages');
  for (const s of surveys) {
    for (const table of [
      'ngo_survey_security_alerts',
      'ngo_survey_participation_locks',
      'ngo_survey_otp_challenges',
      'ngo_survey_charges',
      'ngo_survey_agent_assignments',
      'ngo_survey_responses',
    ]) {
      await admin.from(table).delete().eq('survey_id', s.id);
    }
    await must(admin.from('ngo_surveys').delete().eq('id', s.id), 'suppression sondage');
  }
}

async function deleteBeneficiaries({ services }) {
  const { admin } = services;
  const org = await services.orgId('ong');
  const persons = await must(
    admin.from('core_persons').select('id').eq('organization_id', org).eq('full_name', NEW_BENEFICIARY),
    'lecture personnes'
  );
  for (const p of persons) {
    await must(admin.from('ngo_beneficiaries').delete().eq('organization_id', org).eq('person_id', p.id), 'suppression bénéficiaire');
    await must(admin.from('core_persons').delete().eq('id', p.id), 'suppression personne');
  }
}

/** Les 3 rapports de la vitrine sont datés à 16:20:00 pile : tout autre rapport vient d'un tutoriel. */
async function deleteGeneratedReports({ services }) {
  const { admin } = services;
  const org = await services.orgId('ong');
  const rows = await must(admin.from('organization_ai_generated_reports').select('id, created_at').eq('organization_id', org), 'lecture rapports');
  for (const r of rows) {
    if (!/T16:20:00(\+00:00|Z|$)/.test(r.created_at)) {
      await must(admin.from('organization_ai_generated_reports').delete().eq('id', r.id), 'suppression rapport');
    }
  }
}

/** Le formulaire se referme parfois si la page se recharge juste après le clic : on le rouvre. */
async function ensureProjectForm({ page }) {
  const input = page.locator('input[name=name]');
  if (await input.isVisible()) return;
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await input.waitFor({ state: 'visible', timeout: 15000 });
}

const combobox = (nth) => ({ css: 'main [role=combobox]', nth });

export const ONG_TUTORIALS = [
  // ───────────────────────────────────────────── Tableau de bord
  {
    id: 'ong-01-tableau-de-bord',
    sector: 'ong',
    title: 'Le tableau de bord de la direction ONG',
    role: 'Direction',
    account: 'ong',
    start: '/ong',
    intro: 'Découvrez en une minute le tableau de bord de votre ONG.',
    steps: [
      {
        say: 'Dès la connexion, la direction voit l’essentiel : nombre de projets, bénéficiaires, budget total et taux d’exécution.',
        caption: 'Les indicateurs clés de tous vos projets',
        highlight: { css: 'main .grid >> nth=0' },
        callout: 'Indicateurs clés',
      },
      {
        say: 'Le graphique compare le budget prévu et le budget réellement dépensé.',
        caption: 'Budget prévu et réalisé',
        highlight: { text: 'Budget prévu vs réalisé', up: 'card' },
        callout: 'Prévu vs réalisé',
      },
      {
        say: 'À côté, la répartition des bénéficiaires par région montre où votre action se concentre.',
        caption: 'Les bénéficiaires par région',
        highlight: { text: 'Répartition géographique', up: 'card' },
        callout: 'Par région',
      },
      {
        say: 'KonaAI analyse vos données et signale les points à vérifier, par exemple des projets non actifs.',
        caption: 'KonaAI signale les points d’attention',
        highlight: { text: 'KonaAI — ONG', up: 'card' },
        callout: 'Alertes automatiques',
      },
      {
        say: 'En bas, retrouvez les projets actifs avec leur avancement, et les localités couvertes par vos interventions.',
        caption: 'Projets actifs et localités couvertes',
        actions: [
          { scrollTo: { text: 'Projets actifs', exact: true }, offset: 140 },
          { highlight: { text: 'Projets actifs', exact: true, up: 'card' }, callout: 'Avancement par projet' },
          { highlight: { text: 'Localités couvertes', exact: true, up: 'card' }, callout: 'Zones d’intervention' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Créer un projet
  {
    id: 'ong-02-creer-projet',
    sector: 'ong',
    title: 'Créer un projet',
    role: 'Direction',
    account: 'ong',
    start: '/ong/projets',
    setup: deleteProjects,
    teardown: deleteProjects,
    intro: 'Créez un projet avec sa zone, son budget et ses bénéficiaires ciblés.',
    steps: [
      {
        say: 'Dans le menu Projets, cliquez sur Ajouter.',
        caption: 'Projets → Ajouter',
        actions: [
          { run: async ({ page }) => page.waitForTimeout(2500) },
          { click: { role: 'button', name: 'Ajouter' }, waitFor: { css: 'input[name=name]' }, wait: 1500 },
        ],
      },
      {
        say: 'Donnez un nom au projet, puis indiquez la région et la localité d’intervention.',
        caption: 'Nom, région et localité',
        actions: [
          { run: ensureProjectForm },
          { fill: { css: 'input[name=name]' }, value: NEW_PROJECT },
          { fill: { css: 'input[name=region]' }, value: 'Kindia' },
          { fill: { css: 'input[name=locality]' }, value: 'Forécariah' },
        ],
      },
      {
        say: 'Saisissez le budget en francs guinéens et le nombre de bénéficiaires visés.',
        caption: 'Budget et bénéficiaires visés',
        actions: [
          { fill: { css: 'input[name=budget]' }, value: '1500000000' },
          { fill: { css: 'input[name=beneficiaries]' }, value: '6000' },
          { highlight: { css: 'input[name=progress_pct]', up: 1 }, callout: 'Avancement mis à jour ensuite' },
        ],
      },
      {
        say: 'Enregistrez : le projet apparaît dans la liste, et le tableau de bord intègre aussitôt son budget.',
        caption: 'Enregistré : le projet est dans la liste',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: NEW_PROJECT, exact: true }, waitTimeout: 30000, wait: 1500 },
          { highlight: { text: NEW_PROJECT, exact: true, up: 'card' }, callout: 'Nouveau projet' },
        ],
      },
      {
        say: 'Le crayon permet ensuite de mettre à jour le montant dépensé, l’avancement et le statut du projet.',
        caption: 'Mettre à jour dépenses, avancement et statut',
        highlight: { css: 'button:has(svg.lucide-pencil)', within: { text: NEW_PROJECT, exact: true, up: 'card' } },
        callout: 'Modifier',
      },
    ],
  },

  // ───────────────────────────────────────────── Sondage + QR code
  {
    id: 'ong-03-sondage-qr',
    sector: 'ong',
    title: 'Programmer un sondage et le partager par QR code',
    role: 'Direction',
    account: 'ong',
    start: '/ong/sondages',
    setup: deleteSurveys,
    teardown: deleteSurveys,
    intro: 'Créez un sondage lié à un projet et partagez-le par lien ou QR code.',
    steps: [
      {
        say: 'Dans Sondages, cliquez sur Programmer.',
        caption: 'Sondages → Programmer',
        click: { role: 'button', name: 'Programmer' },
        waitFor: { text: 'Nouveau sondage', exact: true },
      },
      {
        say: 'Donnez un titre, choisissez le projet concerné, la région, les dates et le nombre de personnes à interroger.',
        caption: 'Titre, projet, région, dates et objectif',
        actions: [
          { fill: { css: 'input[name=title]' }, value: NEW_SURVEY },
          { select: { css: 'select[name=project_id]' }, option: 'Accès à l’eau potable — Boké' },
          { fill: { css: 'input[name=region]' }, value: 'Boké' },
          { fill: { css: 'input[name=starts_at]' }, value: `${todayIso()}T08:00` },
          { fill: { css: 'input[name=ends_at]' }, value: `${addDaysIso(todayIso(), 30)}T18:00` },
          { fill: { css: 'input[name=target_responses]' }, value: '150' },
        ],
      },
      {
        say: 'Choisissez le statut En cours, et le mode Mixte : vos agents collectent sur le terrain, et chacun peut aussi répondre en ligne.',
        caption: 'Statut « En cours », mode « Mixte »',
        actions: [
          { click: combobox(0) },
          { click: { role: 'option', name: 'En cours', exact: true } },
          { click: combobox(1) },
          { click: { role: 'option', name: 'Mixte', exact: true } },
        ],
      },
      {
        say: 'Rédigez la question et les trois réponses proposées.',
        caption: 'La question et ses trois réponses',
        actions: [
          { fill: { css: 'input[name=question]' }, value: 'Le forage de votre village fonctionne-t-il ?' },
          { fill: { css: 'input[name=option_1]' }, value: 'Oui, tous les jours' },
          { fill: { css: 'input[name=option_2]' }, value: 'Il tombe souvent en panne' },
          { fill: { css: 'input[name=option_3]' }, value: 'Non, il est hors service' },
        ],
      },
      {
        say: 'Enregistrez : le sondage apparaît dans la liste, prêt pour la collecte.',
        caption: 'Enregistré : le sondage est en cours',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: NEW_SURVEY, exact: true }, waitTimeout: 30000, wait: 1500 },
          { highlight: { text: NEW_SURVEY, exact: true, up: 'card' }, callout: 'Nouveau sondage' },
        ],
      },
      {
        say: 'Ouvrez le Suivi du sondage. La carte Partager le sondage affiche le QR code et le lien de participation.',
        caption: 'Suivi → Partager le sondage',
        actions: [
          { click: { role: 'link', name: 'Suivi', within: { text: NEW_SURVEY, exact: true, up: 'card' } }, waitFor: { text: 'Partager le sondage', exact: true }, wait: 1500 },
          { highlight: { text: 'Partager le sondage', exact: true, up: 'card' }, callout: 'QR code et lien' },
        ],
      },
      {
        say: 'Téléchargez le QR code pour vos affiches ou WhatsApp, ou copiez le lien pour le diffuser où vous voulez.',
        caption: 'Télécharger le QR ou copier le lien',
        actions: [
          { run: async ({ ctx, baseUrl }) => ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin }) },
          { highlight: { role: 'button', name: 'Télécharger le QR' }, callout: 'Affiches, réseaux sociaux' },
          { click: { role: 'button', name: 'Copier', exact: true }, waitFor: { role: 'button', name: 'Copié', exact: true }, wait: 300 },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Résultats et cartographie
  {
    id: 'ong-04-resultats-cartographie',
    sector: 'ong',
    title: 'Analyser les résultats d’un sondage et sa carte GPS',
    role: 'Direction',
    account: 'ong',
    start: `/ong/sondages/${SURVEY_A4003}/analytiques`,
    intro: 'Graphiques, carte GPS et nettoyage des doublons : tout pour exploiter vos sondages.',
    steps: [
      {
        say: 'Depuis le suivi d’un sondage, ouvrez Analytiques. En haut : les réponses valides, l’objectif, la qualité GPS et les doublons détectés.',
        caption: 'Réponses, objectif, GPS et doublons',
        actions: [
          { run: async ({ page }) => page.waitForTimeout(4000) },
          { highlight: { text: 'Réponses valides', exact: true, up: 3 }, callout: 'Qualité des données' },
        ],
      },
      {
        say: 'L’onglet Dashboard présente la répartition des réponses et le nombre de réponses par localité.',
        caption: 'Répartition des réponses et localités',
        actions: [
          { scrollTo: { text: 'Répartition des réponses (QCM)' }, offset: 160 },
          { highlight: { text: 'Répartition des réponses (QCM)', up: 'card' }, callout: 'Répartition' },
          { highlight: { text: 'Réponses par localité', exact: true, up: 'card' }, callout: 'Par localité' },
        ],
      },
      {
        say: 'L’onglet Cartographie place chaque réponse sur la carte, grâce à la position GPS enregistrée lors de la collecte.',
        caption: 'Chaque réponse sur la carte',
        actions: [
          { click: { role: 'tab', name: 'Cartographie' }, waitFor: { css: '.leaflet-interactive' }, wait: 3000 },
          { scrollTo: { text: 'Cartographie des réponses GPS' }, offset: 110 },
          { highlight: { text: 'Cartographie des réponses GPS', up: 'card' }, callout: 'Points GPS' },
        ],
      },
      {
        say: 'Cliquez sur un point pour voir la réponse et la localité.',
        caption: 'Détail d’une réponse',
        click: { css: 'path.leaflet-interactive', nth: 40 },
        force: true,
        waitFor: { css: '.leaflet-popup-content' },
        wait: 800,
      },
      {
        say: 'Dans l’onglet Données, le bouton Nettoyer les doublons exclut les réponses en double. Elles restent en base, mais ne comptent plus dans les statistiques.',
        caption: 'Nettoyer les doublons en un clic',
        actions: [
          { click: { role: 'tab', name: 'Données' }, waitFor: { text: 'Nettoyage des données', exact: true } },
          { highlight: { text: 'Nettoyage des données', exact: true, up: 'card' }, callout: 'Réponses conservées en base' },
          { highlight: { role: 'button', name: 'Nettoyer les doublons' }, callout: '2 doublons détectés' },
        ],
      },
      {
        say: 'Enfin, l’onglet KonaAI rédige un rapport à partir des données nettoyées, archivé dans vos rapports.',
        caption: 'KonaAI rédige le rapport du sondage',
        actions: [
          { click: { role: 'tab', name: 'KonaAI' }, waitFor: { role: 'button', name: 'Générer le rapport KonaAI' } },
          { highlight: { text: 'Rapport automatique', exact: true, up: 'card' }, callout: 'Rapport archivé' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Bénéficiaire
  {
    id: 'ong-05-beneficiaire',
    sector: 'ong',
    title: 'Enregistrer un bénéficiaire',
    role: 'Direction / Suivi-évaluation',
    account: 'ong',
    start: '/ong/beneficiaires',
    setup: deleteBeneficiaries,
    teardown: deleteBeneficiaries,
    intro: 'Enregistrez un bénéficiaire et rattachez-le à son projet.',
    steps: [
      {
        say: 'Dans Bénéficiaires, retrouvez toutes les personnes suivies par vos projets. Cliquez sur Ajouter.',
        caption: 'Bénéficiaires → Ajouter',
        actions: [
          { run: async ({ page }) => page.waitForTimeout(3000) },
          { click: { role: 'button', name: 'Ajouter' }, waitFor: { text: 'Nouveau bénéficiaire', exact: true } },
        ],
      },
      {
        say: 'Saisissez le nom complet, le genre et le téléphone.',
        caption: 'Nom, genre et téléphone',
        actions: [
          { fill: { css: 'input[name=full_name]' }, value: NEW_BENEFICIARY },
          { click: combobox(0) },
          { click: { role: 'option', name: 'Femme', exact: true } },
          { fill: { css: 'input[name=phone]' }, value: '+224 622 45 18 90' },
        ],
      },
      {
        say: 'Rattachez la bénéficiaire à son projet, ici la santé maternelle et infantile à Kindia.',
        caption: 'Le projet concerné',
        actions: [
          { click: combobox(1) },
          { click: { role: 'option', name: PROJECT_KINDIA, exact: true } },
        ],
      },
      {
        say: 'Indiquez la région, la localité et la catégorie : femme enceinte.',
        caption: 'Région, localité et catégorie',
        actions: [
          { fill: { css: 'input[name=region]' }, value: 'Kindia' },
          { fill: { css: 'input[name=locality]' }, value: 'Friguiagbé' },
          { fill: { css: 'input[name=category]' }, value: 'Femme enceinte' },
        ],
      },
      {
        say: 'Enregistrez : la bénéficiaire apparaît en tête de liste, avec son projet.',
        caption: 'Enregistrée et rattachée au projet',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: NEW_BENEFICIARY, exact: true }, waitTimeout: 30000, wait: 2000 },
          { highlight: { text: NEW_BENEFICIARY, exact: true, up: 'card' }, callout: 'Nouvelle bénéficiaire' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Rapports
  {
    id: 'ong-06-rapports',
    sector: 'ong',
    title: 'Générer un rapport IA et l’exporter en PDF',
    role: 'Direction',
    account: 'ong',
    start: '/ong/rapports',
    setup: deleteGeneratedReports,
    teardown: deleteGeneratedReports,
    intro: 'Un rapport de projet rédigé automatiquement, archivé et exportable en PDF.',
    steps: [
      {
        say: 'Dans Rapports, KonaAI rédige des synthèses à partir de vos données : projets, budget, bénéficiaires, documents ou sondages.',
        caption: 'Rapports → Rapport IA',
        highlight: { text: 'Rapport IA — ONG', up: 'card' },
        callout: 'Synthèse automatique',
        zoom: 1,
      },
      {
        say: 'Choisissez le projet, ici l’accès à l’eau potable à Boké, puis le type de rapport : budget et exécution.',
        caption: 'Projet et type de rapport',
        actions: [
          { click: combobox(0) },
          { click: { role: 'option', name: PROJECT_BOKE } },
          { click: combobox(1) },
          { click: { role: 'option', name: 'Budget & exécution', exact: true } },
        ],
      },
      {
        say: 'Cliquez sur Générer et archiver. Le rapport est rédigé en quelques secondes.',
        caption: 'Générer et archiver',
        actions: [
          { click: { role: 'button', name: 'Générer et archiver' }, waitFor: { text: /Rapport enregistré dans l.historique/ }, waitTimeout: 120000, wait: 1500 },
          { highlight: { css: 'main pre', nth: 0 }, callout: 'Rapport rédigé' },
        ],
      },
      {
        say: 'Chaque rapport est conservé dans l’historique, avec son projet, son type et sa date.',
        caption: 'Archivé dans l’historique',
        actions: [
          // L'historique ne se met à jour qu'au rechargement de la page.
          { run: async ({ page }) => page.reload({ waitUntil: 'domcontentloaded' }), wait: 2000 },
          { scrollTo: { text: 'Historique des rapports — ONG' }, offset: 100 },
          { highlight: { css: 'li', nth: 0, within: { text: 'Historique des rapports — ONG', up: 'card' } }, callout: 'Nouveau rapport' },
        ],
      },
      {
        say: 'Cliquez sur PDF pour télécharger le rapport, prêt à envoyer à vos bailleurs.',
        caption: 'Le rapport en PDF',
        actions: [
          { download: { role: 'button', name: 'PDF', exact: true, nth: 0 } },
          { pages: { max: 3, title: 'Rapport IA — PDF' } },
        ],
      },
    ],
  },
];
