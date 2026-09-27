/** Tutoriels Écoles — organisation vitrine « Groupe Scolaire Horizon ». */
import { must } from './helpers.mjs';

const YEAR = '2026-2027';
const NEW_CLASS = '9e A';
const NEW_SUBJECT = 'Informatique';
const NEW_STUDENT = 'Aïcha SOUMAORO';
const PAYER = 'Mariame FOFANA (GSH-26-0027)';
const PAYER_MATRICULE = 'GSH-26-0027';
const PAY_REF = 'OM-260927-4471';
const GRADES = ['14', '11,5', '16', '9', '12', '15,5', '13', '10', '17', '12,5', '8,5', '14', '11', '15', '13,5', '16,5', '10,5', '12', '18', '9,5', '13', '14,5', '11', '15'];

/**
 * Sans service worker : au premier chargement, son activation recharge la page
 * (PWAProvider, « controllerchange ») au milieu de la capture.
 */
async function noServiceWorker({ ctx }) {
  await ctx.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      Object.defineProperty(navigator.serviceWorker, 'register', { value: () => new Promise(() => {}) });
    }
  });
}

const prepared = (fn) => async (run) => {
  await noServiceWorker(run);
  if (fn) await fn(run);
};

async function classId(services, name) {
  const org = await services.orgId('ecole');
  const row = await must(
    services.admin.from('school_classes').select('id').eq('organization_id', org).eq('name', name).eq('academic_year', YEAR).single(),
    `classe ${name}`
  );
  return row.id;
}

async function deleteClassAndSubject({ services }) {
  const { admin } = services;
  const org = await services.orgId('ecole');
  await must(admin.from('school_classes').delete().eq('organization_id', org).eq('name', NEW_CLASS), 'suppression classe');
  await must(admin.from('school_subjects').delete().eq('organization_id', org).eq('name', NEW_SUBJECT), 'suppression matière');
}

async function deleteStudent({ services }) {
  const { admin } = services;
  const org = await services.orgId('ecole');
  const persons = await must(admin.from('core_persons').select('id').eq('organization_id', org).eq('full_name', NEW_STUDENT), 'lecture élève');
  for (const p of persons) {
    await must(admin.from('school_students').delete().eq('organization_id', org).eq('person_id', p.id), 'suppression élève');
    await must(admin.from('core_persons').delete().eq('id', p.id), 'suppression personne');
  }
}

async function deletePayment({ services }) {
  const { admin } = services;
  const org = await services.orgId('ecole');
  const st = await must(admin.from('school_students').select('id').eq('organization_id', org).eq('matricule', PAYER_MATRICULE).single(), 'élève payeur');
  await must(admin.from('school_payments').delete().eq('organization_id', org).eq('student_id', st.id).eq('reference', PAY_REF), 'suppression paiement');
}

/** Retire les notes du devoir d'anglais de 7e A et les bulletins générés automatiquement. */
async function resetEnglishGrades({ services }) {
  const { admin } = services;
  const org = await services.orgId('ecole');
  const cls = await classId(services, '7e A');
  const subject = await must(
    admin.from('school_subjects').select('id').eq('organization_id', org).eq('name', 'Anglais').eq('education_level_band', 'college').single(),
    'matière anglais'
  );
  const key = (q) => q.eq('organization_id', org).eq('class_id', cls).eq('subject_id', subject.id).eq('exam_type', 'Devoir').eq('semester', 'T1').eq('academic_year', YEAR);
  await must(key(admin.from('school_grades').delete()), 'purge notes');
  await must(key(admin.from('school_grade_evaluations').update({ coefficient: 2, max_score: 20 })), 'évaluation');
  await must(admin.from('school_report_cards').delete().eq('organization_id', org).eq('class_id', cls).eq('semester', 'T1').eq('academic_year', YEAR), 'purge bulletins 7e A');
}

/** Candidats (non inscrits) rattachés à la classe : la grille les liste aussi, on ne les note pas. */
async function candidateNames({ services }, className) {
  const org = await services.orgId('ecole');
  const cls = await classId(services, className);
  const rows = await must(
    services.admin.from('school_students').select('core_persons(full_name)').eq('organization_id', org).eq('class_id', cls).neq('enrollment_status', 'enrolled'),
    'candidats'
  );
  return rows.map((r) => r.core_persons?.full_name).filter(Boolean);
}

async function resetBulletins10e({ services }) {
  const org = await services.orgId('ecole');
  const cls = await classId(services, '10e A');
  await must(services.admin.from('school_report_cards').delete().eq('organization_id', org).eq('class_id', cls), 'purge bulletins 10e A');
}

const card = (title, extra = {}) => ({ text: title, exact: true, up: 'card', ...extra });
const comboIn = (within, nth) => ({ css: '[role=combobox]', within, nth });

const CLASS_CARD = card('Ajouter une classe');
const SUBJECT_CARD = card('Ajouter une matière');
const STUDENT_CARD = card('Nouvel élève');
const PAY_CARD = card('Nouveau paiement au guichet');
const HISTORY_CARD = card('Historique des paiements');
const GRID_CARD = card('Grille — une ligne par élève');
const BULLETIN_CARD = { text: 'Générer & publier (direction)', up: 'card' };
const GRADE_INPUT = 'main table tbody tr:not(.kd-candidate) input[inputmode=decimal]';

export const ECOLE_TUTORIALS = [
  // ───────────────────────────────────────────── Tableau de bord
  {
    id: 'ecole-01-tableau-de-bord',
    sector: 'ecole',
    title: 'Le tableau de bord de la direction',
    role: 'Direction',
    account: 'ecole',
    start: '/etablissement',
    setup: prepared(),
    intro: 'Découvrez en une minute le tableau de bord de la direction de l’école.',
    steps: [
      {
        say: 'Dès la connexion, la direction voit l’essentiel : candidatures en attente, élèves inscrits, taux de paiement de la scolarité et montant encaissé.',
        caption: 'Inscriptions et encaissements en un coup d’œil',
        highlight: { css: 'main div.grid:has-text("Candidats / En attente")' },
        callout: 'Indicateurs clés',
      },
      {
        say: 'Juste en dessous : les enseignants, les classes actives, les paiements en attente et les élèves inscrits sans classe.',
        caption: 'Enseignants, classes, paiements en attente',
        highlight: { css: 'main div.grid:has-text("Classes actives")' },
        callout: 'À surveiller',
      },
      {
        say: 'Les graphiques montrent l’évolution des inscriptions et des encaissements, mois par mois.',
        caption: 'Inscriptions et paiements, mois par mois',
        actions: [
          { scrollTo: { text: 'Évolution des inscriptions' }, offset: 110 },
          { highlight: { css: 'main div.grid:has-text("Évolution des paiements")' }, callout: 'Évolution mensuelle' },
        ],
      },
      {
        say: 'KonaAI analyse vos données et signale les priorités : candidatures à traiter, familles à relancer. À gauche, la répartition des élèves par classe.',
        caption: 'KonaAI signale les priorités du jour',
        actions: [
          { highlight: { text: 'KonaAI — Établissement', up: 'card' }, callout: 'Alertes automatiques' },
          { highlight: card('Répartition par classe'), callout: 'Effectifs par classe' },
        ],
      },
      {
        say: 'En bas, retrouvez les dernières inscriptions, les paiements récents et les élèves en attente de validation.',
        caption: 'Inscriptions, paiements et élèves en attente',
        actions: [
          { scrollTo: card('Dernières inscriptions'), offset: 120 },
          { highlight: card('Dernières inscriptions'), callout: 'Nouveaux dossiers' },
          { highlight: card('Paiements récents'), callout: 'Derniers encaissements' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Classes et matières
  {
    id: 'ecole-02-classes-matieres',
    sector: 'ecole',
    title: 'Créer une classe et une matière',
    role: 'Direction / Scolarité',
    account: 'ecole',
    start: '/etablissement/formations',
    setup: prepared(deleteClassAndSubject),
    teardown: deleteClassAndSubject,
    intro: 'Créez vos classes avec leurs frais de scolarité, puis vos matières par palier.',
    steps: [
      {
        say: 'Dans Formations, organisez votre catalogue : les classes, les matières et les enseignants.',
        caption: 'Formations : classes, matières, enseignants',
        highlight: { role: 'tablist' },
        callout: 'Trois onglets',
        zoom: 1,
      },
      {
        say: 'Pour créer une classe, choisissez le palier : il fixe les périodes de notation, trimestres ou semestres. Saisissez ensuite le nom et le niveau.',
        caption: 'Palier, nom et niveau',
        actions: [
          { scrollTo: CLASS_CARD, offset: 90 },
          { highlight: comboIn(CLASS_CARD, 0), callout: 'Collège : trimestres' },
          { fill: { css: 'input[name=name]', within: CLASS_CARD }, value: NEW_CLASS },
          { click: comboIn(CLASS_CARD, 1) },
          { click: { role: 'option', name: '9e', exact: true } },
        ],
      },
      {
        say: 'Indiquez la filière, puis les frais de scolarité annuels de la classe.',
        caption: 'Filière et frais de scolarité',
        actions: [
          { fill: { css: 'input[name=program]', within: CLASS_CARD }, value: 'Général' },
          { fill: { css: 'input[name=tuition_fee_gnf]', within: CLASS_CARD }, value: '2800000' },
        ],
      },
      {
        say: 'Cliquez sur Créer : la classe apparaît dans la liste avec ses frais par élève. Ils serviront au suivi des paiements.',
        caption: 'La classe est créée',
        actions: [
          { click: { role: 'button', name: 'Créer', exact: true, within: CLASS_CARD }, waitFor: { text: 'Classe créée.' }, waitTimeout: 30000, wait: 1500 },
          { scrollTo: { css: 'td:text-is("9e A")' }, offset: 300 },
          { highlight: { css: 'td:text-is("9e A")', up: 1 }, callout: '2 800 000 FG par élève' },
        ],
      },
      {
        say: 'Passez à l’onglet Matières. Une matière est rattachée à un palier : elle sert à toutes les classes du collège.',
        caption: 'Matières : une par palier',
        actions: [
          { click: { role: 'tab', name: /^Matières/ }, waitFor: { text: 'Ajouter une matière', exact: true } },
          { scrollTo: SUBJECT_CARD, offset: 90 },
          { fill: { css: 'input[name=name]', within: SUBJECT_CARD }, value: NEW_SUBJECT },
          { fill: { css: 'input[name=code]', within: SUBJECT_CARD }, value: 'INFO' },
          { highlight: { css: 'input[name=coefficient]', within: SUBJECT_CARD }, callout: 'Coefficient au bulletin' },
        ],
      },
      {
        say: 'Cliquez sur Créer. La matière est prête pour la saisie des notes et les bulletins.',
        caption: 'Prête pour les notes et les bulletins',
        actions: [
          { click: { role: 'button', name: 'Créer', exact: true, within: SUBJECT_CARD }, waitFor: { text: 'Matière créée.' }, waitTimeout: 30000, wait: 1500 },
          { scrollTo: { css: 'td:text-is("Informatique")' }, offset: 300 },
          { highlight: { css: 'td:text-is("Informatique")', up: 1 }, callout: 'Nouvelle matière' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Inscrire un élève
  {
    id: 'ecole-03-inscrire-eleve',
    sector: 'ecole',
    title: 'Inscrire un élève',
    role: 'Direction / Scolarité',
    account: 'ecole',
    start: '/etablissement/etudiants',
    setup: prepared(deleteStudent),
    teardown: deleteStudent,
    intro: 'Inscrivez un nouvel élève : son code élève est généré automatiquement.',
    steps: [
      {
        say: 'Dans Élèves, retrouvez toute la liste avec le code élève, la classe et le statut. Cliquez sur Ajouter un élève.',
        caption: 'Élèves → Ajouter un élève',
        click: { role: 'button', name: 'Ajouter un élève' },
        waitFor: { text: 'Nouvel élève', exact: true },
      },
      {
        say: 'Saisissez le nom complet de l’élève et le numéro de téléphone de la famille.',
        caption: 'Nom et téléphone',
        actions: [
          { fill: { css: 'input[name=full_name]' }, value: NEW_STUDENT },
          { fill: { css: 'input[name=phone]' }, value: '+224 622 45 18 90' },
        ],
      },
      {
        say: 'Choisissez la classe. Laissez le matricule vide : Kona Data génère automatiquement le code élève.',
        caption: 'Classe, code élève automatique',
        actions: [
          { click: comboIn(STUDENT_CARD, 0) },
          { click: { role: 'option', name: '8e A', exact: true } },
          { highlight: { css: 'input[name=matricule]' }, callout: 'Code généré automatiquement' },
        ],
      },
      {
        say: 'Le statut est Inscrit par défaut. Vous pouvez aussi enregistrer un candidat en attente ou admis.',
        caption: 'Inscrit, en attente ou admis',
        highlight: comboIn(STUDENT_CARD, 1),
        callout: 'Statut de l’élève',
      },
      {
        say: 'Enregistrez : l’élève apparaît en tête de liste, avec son code élève.',
        caption: 'L’élève est inscrit',
        actions: [
          { click: { role: 'button', name: 'Enregistrer', exact: true }, waitFor: { text: 'Élève créé.' }, waitTimeout: 30000, wait: 1500 },
          { highlight: { text: NEW_STUDENT, exact: true, up: 1 }, callout: 'Code élève attribué' },
        ],
      },
      {
        say: 'Ouvrez son dossier : l’échéancier de scolarité est déjà calculé selon les frais de sa classe.',
        caption: 'Le dossier de l’élève',
        actions: [
          { click: { role: 'link', name: 'Dossier', nth: 0 }, waitUrl: /\/etablissement\/etudiants\/[0-9a-f-]{36}/, wait: 1500 },
          { highlight: card('Scolarité'), callout: 'Échéancier de scolarité' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Paiement et reçu
  {
    id: 'ecole-04-paiement-recu',
    sector: 'ecole',
    title: 'Encaisser la scolarité et remettre le reçu',
    role: 'Direction / Comptabilité',
    account: 'ecole',
    start: '/etablissement/paiements',
    setup: prepared(deletePayment),
    teardown: deletePayment,
    intro: 'Enregistrez un paiement au guichet et remettez un reçu officiel en PDF.',
    steps: [
      {
        say: 'Dans Paiements, suivez les frais attendus et encaissés, classe par classe. Cliquez sur Enregistrer un paiement.',
        caption: 'Paiements → Enregistrer un paiement',
        actions: [
          { highlight: { text: 'Prévisions vs encaissements', up: 'card' }, callout: 'Attendu, encaissé, écart' },
          { click: { role: 'button', name: 'Enregistrer un paiement' }, waitFor: { text: 'Nouveau paiement au guichet' } },
        ],
      },
      {
        say: 'Choisissez l’élève. Son solde s’affiche aussitôt, avec l’échéancier des tranches.',
        caption: 'L’élève et son solde',
        actions: [
          { scrollTo: PAY_CARD, offset: 90 },
          { click: comboIn(PAY_CARD, 0) },
          { click: { role: 'option', name: PAYER } },
          { highlight: { text: 'Échéancier indicatif', up: 'card' }, callout: 'Tranches et reste à payer' },
        ],
      },
      {
        say: 'Saisissez le montant de la première tranche, choisissez Orange Money et notez la référence de la transaction.',
        caption: 'Montant, mode de paiement, référence',
        actions: [
          { fill: { css: 'input[name=amount]' }, value: '1040000' },
          { click: comboIn(PAY_CARD, 2) },
          { click: { role: 'option', name: 'Orange Money' } },
          { fill: { css: 'input[name=reference]' }, value: PAY_REF },
        ],
      },
      {
        say: 'Enregistrez : le paiement s’ajoute à l’historique, avec un numéro de reçu unique.',
        caption: 'Enregistré, avec son numéro de reçu',
        actions: [
          {
            click: { role: 'button', name: 'Enregistrer le paiement' },
            waitFor: { css: 'tbody tr:first-child:has-text("Mariame FOFANA")', within: HISTORY_CARD },
            waitTimeout: 30000,
            wait: 1500,
          },
          { scrollTo: HISTORY_CARD, offset: 90 },
          { highlight: { css: 'tbody tr', within: HISTORY_CARD, nth: 0 }, callout: 'Reçu REC-2026' },
        ],
      },
      {
        say: 'Cliquez sur le numéro du reçu : le reçu officiel s’ouvre, avec le solde restant, un code et un QR code de vérification.',
        caption: 'Le reçu officiel, vérifiable par QR code',
        actions: [
          {
            run: async ({ page }) => {
              await page.locator('a[href^="/recu-scolarite/"]').evaluateAll((links) => links.forEach((a) => a.removeAttribute('target')));
            },
          },
          { click: { css: 'a[href^="/recu-scolarite/"]', within: HISTORY_CARD, nth: 0 }, waitUrl: /\/recu-scolarite\//, wait: 2000 },
          { highlight: { css: '#receipt' }, callout: 'Code et QR de vérification' },
        ],
      },
      {
        say: 'Téléchargez-le en PDF pour l’imprimer ou l’envoyer à la famille.',
        caption: 'Le reçu en PDF',
        actions: [
          {
            run: async ({ page }) => {
              await page.evaluate(() => {
                window.open = (url) => {
                  const a = document.createElement('a');
                  a.href = String(url);
                  a.download = '';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  return null;
                };
              });
            },
          },
          { download: { role: 'button', name: 'Télécharger PDF' } },
          { pages: { max: 1, title: 'Reçu de paiement — PDF' } },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Saisie des notes
  {
    id: 'ecole-05-saisie-notes',
    sector: 'ecole',
    title: 'Saisir les notes d’une classe',
    role: 'Enseignant / Direction',
    account: 'ecole',
    start: '/etablissement/resultats',
    setup: prepared(async (run) => {
      await resetEnglishGrades(run);
      run.candidates = await candidateNames(run, '7e A');
    }),
    teardown: resetEnglishGrades,
    intro: 'Saisissez les notes de toute une classe en une seule grille.',
    steps: [
      {
        say: 'Dans Résultats, l’onglet Grille permet de saisir les notes de toute une classe en une fois. Choisissez la matière, puis la classe.',
        caption: 'Résultats → Grille : matière et classe',
        actions: [
          { click: comboIn(GRID_CARD, 0) },
          { click: { role: 'option', name: 'Anglais (Collège)' } },
          { click: comboIn(GRID_CARD, 1) },
          { click: { role: 'option', name: /^7e A/ } },
        ],
      },
      {
        say: 'Sélectionnez le type d’évaluation, ici un devoir, et la période : le premier trimestre.',
        caption: 'Type d’évaluation et trimestre',
        actions: [
          { click: comboIn(GRID_CARD, 2) },
          { click: { role: 'option', name: 'Devoir', exact: true } },
          { highlight: comboIn(GRID_CARD, 3), callout: '1er trimestre' },
        ],
      },
      {
        say: 'Vérifiez le barème et le coefficient du devoir : il comptera double dans la moyenne d’anglais.',
        caption: 'Barème sur 20, coefficient 2',
        actions: [
          { fill: { field: 'Coef. évaluation' }, value: '2', instant: true },
          { highlight: { field: 'Coef. évaluation', up: 1 }, callout: 'Coefficient 2' },
        ],
      },
      {
        say: 'Tapez les notes sur vingt, élève par élève. Une virgule suffit pour les demi-points.',
        caption: 'Une note par élève',
        actions: [
          {
            run: async ({ page, candidates }) => {
              await page.locator('main table tbody tr').evaluateAll((rows, names) => {
                for (const tr of rows) if (names.includes(tr.querySelector('td')?.textContent?.trim())) tr.classList.add('kd-candidate');
              }, candidates);
            },
          },
          { scrollTo: { css: 'main table' }, offset: 120 },
          ...GRADES.slice(0, 4).map((value, nth) => ({ fill: { css: GRADE_INPUT, nth }, value })),
          {
            run: async ({ page }) => {
              const inputs = page.locator(GRADE_INPUT);
              const n = await inputs.count();
              for (let i = 4; i < n; i++) await inputs.nth(i).fill(GRADES[i % GRADES.length]);
            },
          },
          { highlight: { css: 'main table' }, callout: 'Toute la classe' },
        ],
      },
      {
        say: 'Enregistrez toutes les notes : elles comptent aussitôt dans les moyennes et les bulletins de la classe.',
        caption: 'Notes enregistrées',
        actions: [
          {
            click: { role: 'button', name: 'Enregistrer toutes les notes saisies' },
            waitFor: { text: /note\(s\) enregistrée\(s\)/ },
            waitTimeout: 90000,
            wait: 1500,
          },
          { highlight: { text: /note\(s\) enregistrée\(s\)/ }, callout: 'Enregistré' },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── Bulletins
  {
    id: 'ecole-06-bulletins',
    sector: 'ecole',
    title: 'Générer les bulletins en PDF',
    role: 'Direction',
    account: 'ecole',
    start: '/etablissement/bulletins',
    setup: prepared(resetBulletins10e),
    teardown: resetBulletins10e,
    intro: 'Générez les bulletins de toute une classe : moyennes, rangs et PDF prêts à imprimer.',
    steps: [
      {
        say: 'Dans Bulletins, choisissez la classe, la période et l’année scolaire.',
        caption: 'Classe, trimestre, année',
        actions: [
          { click: comboIn(BULLETIN_CARD, 0) },
          { click: { role: 'option', name: '10e A', exact: true } },
          { highlight: comboIn(BULLETIN_CARD, 1), callout: '1er trimestre' },
          { click: comboIn(BULLETIN_CARD, 2) },
          { click: { role: 'option', name: YEAR, exact: true } },
        ],
      },
      {
        say: 'Kona Data vérifie d’abord que toutes les notes sont saisies. Ici, chaque élève a ses deux notes dans chaque matière.',
        caption: 'Vérification des notes manquantes',
        highlight: { text: /Complétude moyenne/, up: 1 },
        callout: 'Complétude des notes',
      },
      {
        say: 'Cliquez sur Générer : les moyennes, les rangs et les appréciations sont calculés pour toute la classe.',
        caption: 'Moyennes et rangs calculés',
        actions: [
          { highlight: { role: 'button', name: 'Générer / recalculer (provisoire)' }, callout: 'Générer' },
          {
            // Le contrôle « Notes manquantes » signale à tort des trous (élèves sans id) : on confirme hors caméra.
            run: async ({ page }) => {
              await page.getByRole('button', { name: 'Générer / recalculer (provisoire)' }).click();
              const done = page.getByText(/bulletins provisoires générés/);
              const confirm = page.getByRole('button', { name: 'Continuer quand même' });
              await done.or(confirm).first().waitFor({ timeout: 120000 });
              if (await confirm.isVisible()) await confirm.click();
              await done.waitFor({ timeout: 120000 });
            },
            wait: 1500,
          },
          { highlight: { text: /bulletins provisoires générés/ }, callout: 'Bulletins provisoires' },
        ],
      },
      {
        say: 'Les bulletins restent provisoires : vous pouvez encore corriger une note ou une appréciation, puis recalculer.',
        caption: 'Provisoires : corrigez et recalculez',
        actions: [
          { scrollTo: card('Bulletins générés'), offset: 90 },
          { highlight: { css: 'thead', within: card('Bulletins générés') }, callout: 'Moyenne, rang, appréciation' },
        ],
      },
      {
        say: 'Téléchargez le bulletin d’un élève en PDF : notes par matière, moyenne, rang, appréciation, logo et cachet de l’école.',
        caption: 'Le bulletin PDF de l’élève',
        actions: [
          { download: { css: 'tr:has(td:text-is("1")) button:has-text("PDF")' } },
          { pages: { max: 1, title: 'Bulletin scolaire — PDF' } },
        ],
      },
      {
        say: 'Une fois tout validé, Publier définitif verrouille les bulletins et prévient les familles par SMS.',
        caption: 'Publier : bulletins verrouillés, familles prévenues',
        actions: [
          { scrollTo: BULLETIN_CARD, offset: 90 },
          { highlight: { role: 'button', name: 'Publier définitif + SMS' }, callout: 'Verrouillage et SMS aux familles' },
        ],
      },
    ],
  },
];
