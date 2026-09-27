/** Tutoriels communs à tous les secteurs (démonstration sur l'organisation vitrine BTP). */
import { VITRINE_ACCOUNTS, VITRINE_PASSWORD } from '../accounts.mjs';
import { must } from './helpers.mjs';

const CODE_LABEL = 'Équipe chantier Kipé';
const SITE_C = 'Route Dubréka – Khorira (8 km)';

async function deleteCodes({ services }) {
  const org = await services.orgId('btp');
  await must(services.admin.from('organization_access_codes').delete().eq('organization_id', org).eq('label', CODE_LABEL), 'purge codes');
}

/** Retire l'assignation « chef ↔ route Dubréka » ajoutée par le tutoriel. */
async function resetAssignment({ services }) {
  const { admin } = services;
  const org = await services.orgId('btp');
  const chef = await must(admin.from('profiles').select('id').eq('email', VITRINE_ACCOUNTS['btp-chef'].email).single(), 'chef');
  const site = await must(admin.from('btp_sites').select('id').eq('organization_id', org).eq('name', SITE_C).single(), 'chantier');
  await must(
    admin.from('collaborator_assignments').delete().eq('profile_id', chef.id).eq('resource_type', 'btp_site').eq('resource_id', site.id),
    'purge assignation'
  );
}

export const COMMON_TUTORIALS = [
  {
    id: 'commun-01-connexion-mobile',
    sector: 'brand',
    device: 'mobile',
    title: 'Se connecter et installer l’application',
    role: 'Tous les utilisateurs',
    anonymous: true,
    start: '/login',
    intro: 'Connectez-vous depuis votre téléphone et installez KonaData comme une application.',
    steps: [
      {
        say: 'Ouvrez konadatagn.com sur votre téléphone. Vous pouvez vous connecter avec votre numéro WhatsApp ou votre e-mail.',
        caption: 'Connexion par WhatsApp ou e-mail',
        highlight: { role: 'button', name: 'Email', exact: true },
        callout: 'WhatsApp ou e-mail',
      },
      {
        say: 'Touchez E-mail, puis saisissez votre adresse et votre mot de passe.',
        caption: 'Adresse e-mail et mot de passe',
        actions: [
          { click: { role: 'button', name: 'Email', exact: true }, waitFor: { css: '#email' } },
          { fill: { css: '#email' }, value: VITRINE_ACCOUNTS['btp-chef'].email },
          { fill: { css: '#password' }, value: VITRINE_PASSWORD },
        ],
      },
      {
        say: 'Touchez Se connecter : vous arrivez directement sur votre espace.',
        caption: 'Vous arrivez sur votre espace',
        click: { role: 'button', name: 'Se connecter' },
        waitUrl: (u) => !u.pathname.startsWith('/login'),
        wait: 2500,
      },
      {
        say: 'Mot de passe oublié ? Utilisez le lien sur la page de connexion : vous recevez un code par WhatsApp ou par e-mail.',
        caption: 'Mot de passe oublié : code par WhatsApp ou e-mail',
        card: {
          kicker: 'Bon à savoir',
          title: 'Mot de passe oublié ?',
          items: ['Page de connexion → « Mot de passe oublié ? »', 'Code reçu par WhatsApp ou par e-mail', 'Choisissez un nouveau mot de passe'],
        },
      },
      {
        say: 'Pour installer l’application : sur Android, ouvrez le menu de Chrome et choisissez Installer l’application. Sur iPhone, touchez Partager, puis Sur l’écran d’accueil.',
        caption: 'Installer KonaData sur l’écran d’accueil',
        card: {
          kicker: 'Installer l’application',
          title: 'KonaData sur votre écran d’accueil',
          items: [
            'Android (Chrome) : menu ⋮ → « Installer l’application »',
            'iPhone (Safari) : Partager → « Sur l’écran d’accueil »',
            'L’icône KonaData s’ouvre comme une application',
          ],
        },
      },
    ],
  },

  {
    id: 'commun-02-inviter-equipe',
    sector: 'brand',
    title: 'Inviter votre équipe avec un code d’accès',
    role: 'Direction',
    account: 'btp',
    start: '/utilisateurs',
    setup: deleteCodes,
    teardown: deleteCodes,
    intro: 'Invitez vos collaborateurs en quelques secondes avec un code d’accès.',
    steps: [
      {
        say: 'Dans Utilisateurs, la direction génère des codes d’accès pour ses collaborateurs.',
        caption: 'Utilisateurs → Codes d’accès',
        highlight: { text: /Codes d.accès/, up: 'card' },
        callout: 'Réservé à la direction',
        zoom: 1,
      },
      {
        say: 'Choisissez le rôle du collaborateur, puis indiquez son e-mail et un libellé.',
        caption: 'Rôle, e-mail et libellé',
        actions: [
          { click: { css: 'main [role=combobox]', nth: 0 }, waitFor: { role: 'option', name: 'Staff BTP' } },
          { click: { role: 'option', name: 'Staff BTP' } },
          { fill: { css: 'input[name=recipient_email]' }, value: 'mamadou.bah@batir-guinee.demo' },
          { fill: { css: 'input[name=label]' }, value: CODE_LABEL },
        ],
      },
      {
        say: 'Réglez le nombre d’utilisations et la durée de validité, puis cliquez sur Générer.',
        caption: 'Générer le code',
        actions: [
          { highlight: { css: 'input[name=max_uses]' }, callout: 'Plusieurs personnes possibles' },
          { click: { role: 'button', name: /^Générer/ }, waitFor: { css: 'main code.text-lg' }, waitTimeout: 30000 },
        ],
      },
      {
        say: 'Le code est créé. Copiez-le et envoyez-le par WhatsApp ou par e-mail.',
        caption: 'Copiez le code et envoyez-le',
        highlight: { css: 'main code.text-lg', up: 1 },
        callout: 'Code KONA-XXXX-XXXX',
      },
      {
        say: 'Votre collaborateur crée son compte, puis saisit le code sur la page Rejoindre. Il rejoint aussitôt votre organisation avec le bon rôle.',
        caption: 'Le collaborateur rejoint avec le code',
        card: {
          kicker: 'Côté collaborateur',
          title: 'Rejoindre l’organisation',
          items: ['Créer son compte sur konadatagn.com', 'Page « Rejoindre » → saisir le code', 'Accès immédiat, avec le rôle choisi'],
        },
      },
      {
        say: 'Tous les membres apparaissent ici. Vous pouvez bloquer un accès à tout moment, par exemple en fin de collaboration.',
        caption: 'Membres : bloquer ou réactiver un accès',
        actions: [
          { scrollTo: { text: "Membres de l'organisation" }, offset: 100 },
          { highlight: { text: "Membres de l'organisation", up: 'card' }, callout: 'Bloquer / réactiver' },
        ],
      },
    ],
  },

  {
    id: 'commun-03-assigner',
    sector: 'brand',
    title: 'Assigner un collaborateur à ses chantiers, classes ou projets',
    role: 'Direction',
    account: 'btp',
    start: '/btp/assignations',
    setup: resetAssignment,
    teardown: resetAssignment,
    intro: 'Chaque collaborateur ne voit que ce qui lui est assigné.',
    steps: [
      {
        say: 'Dans Assignations, choisissez ce que chaque collaborateur peut suivre : des chantiers dans le BTP, des classes dans une école, des projets dans une ONG.',
        caption: 'Chantiers, classes ou projets selon votre secteur',
        highlight: { text: 'Alpha CAMARA', exact: true, up: 'card' },
        callout: 'Un collaborateur',
      },
      {
        say: 'Cochez un chantier supplémentaire.',
        caption: 'Cocher le chantier',
        check: { css: 'label:has-text("Route Dubréka")', within: { text: 'Alpha CAMARA', exact: true, up: 'card' } },
      },
      {
        say: 'Enregistrez. Dès sa prochaine connexion, le chef de chantier verra ce chantier et pourra y saisir l’avancement et le carburant.',
        caption: 'Enregistré : accès immédiat',
        click: { role: 'button', name: 'Enregistrer pour ce collaborateur', nth: 0 },
        wait: 2000,
      },
    ],
  },
];
