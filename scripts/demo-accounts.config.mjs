/** Comptes démo vidéo — liés aux organisations seed (migrations 010, 011, 037). */

export const DEMO_PASSWORD = 'DemoKona2026!';

export const DEMO_ORG_IDS = {
  school: '11111111-1111-1111-1111-111111111101',
  ngo: '11111111-1111-1111-1111-111111111102',
  btp: '11111111-1111-1111-1111-111111111103',
  pme: '11111111-1111-1111-1111-111111111104',
};

/** @type {Array<{
 *   key: string;
 *   email: string;
 *   fullName: string;
 *   orgId: string;
 *   orgType: 'school' | 'ngo' | 'btp' | 'business';
 *   captures: Array<{ id: string; url: string; wait?: number; scroll?: string }>;
 * }>} */
export const DEMO_ACCOUNTS = [
  {
    key: 'school',
    email: 'demo.ecole@konadata.demo',
    fullName: 'Directeur Démo ISC',
    orgId: DEMO_ORG_IDS.school,
    orgType: 'school',
    captures: [
      { id: '09-school-dashboard', url: '/etablissement', wait: 2500 },
      { id: '16-school-formations', url: '/etablissement/formations', wait: 2500 },
      { id: '17-school-assignations', url: '/utilisateurs/assignations', wait: 2500 },
      { id: '10-school-etudiants', url: '/etablissement/etudiants', wait: 2000 },
      { id: '11-school-import-ia', url: '/etablissement/etudiants/import', wait: 2500 },
      { id: '12-school-resultats', url: '/etablissement/resultats', wait: 2500 },
      { id: '13-school-bulletins', url: '/etablissement/bulletins', wait: 2000 },
      { id: '18-school-paiements', url: '/etablissement/paiements', wait: 2500 },
      { id: '14-school-candidatures', url: '/etablissement/candidatures', wait: 2000 },
      { id: '15-data-factory', url: '/data-factory', wait: 2000 },
    ],
  },
  {
    key: 'ngo',
    email: 'demo.ong@konadata.demo',
    fullName: 'Directrice Démo FDG',
    orgId: DEMO_ORG_IDS.ngo,
    orgType: 'ngo',
    captures: [
      { id: '20-ngo-dashboard', url: '/ong', wait: 2500 },
      { id: '21-ngo-projets', url: '/ong/projets', wait: 2000 },
      { id: '22-ngo-beneficiaires', url: '/ong/beneficiaires', wait: 2000 },
      { id: '23-ngo-sondages', url: '/ong/sondages', wait: 2500 },
      { id: '24-ngo-cartographie', url: '/ong/cartographie', wait: 2500 },
      // url dynamique : /ong/sondages/{surveyId}/analytiques — injecté par seed
    ],
  },
  {
    key: 'btp',
    email: 'demo.btp@konadata.demo',
    fullName: 'Directeur Démo BTP',
    orgId: DEMO_ORG_IDS.btp,
    orgType: 'btp',
    captures: [
      { id: '30-btp-dashboard', url: '/btp', wait: 2500 },
      { id: '31-btp-chantiers', url: '/btp/chantiers', wait: 2000 },
      { id: '32-btp-personnel', url: '/btp/personnel', wait: 2000 },
      { id: '33-btp-carburant', url: '/btp/carburant', wait: 2000 },
      { id: '34-btp-documents', url: '/btp/documents', wait: 2000 },
    ],
  },
  {
    key: 'pme',
    email: 'demo.pme@konadata.demo',
    fullName: 'Gérant Démo Mamou',
    orgId: DEMO_ORG_IDS.pme,
    orgType: 'business',
    captures: [
      { id: '40-pme-dashboard', url: '/pme', wait: 2500 },
      { id: '41-pme-ventes', url: '/pme/ventes', wait: 2000 },
      { id: '42-pme-stocks', url: '/pme/stocks', wait: 2000 },
      { id: '43-pme-clients', url: '/pme/clients', wait: 2000 },
    ],
  },
];

export const PUBLIC_SCENES = [
  { id: '01-intro-landing', url: '/?accueil=1', wait: 2000 },
  { id: '02-secteurs', url: '/?accueil=1', wait: 1500, scroll: '#secteurs' },
  { id: '03-fonctionnalites', url: '/?accueil=1', wait: 1500, scroll: '#fonctionnalites' },
  { id: '04-ia-strip', url: '/?accueil=1', wait: 1500, scroll: '#fonctionnalites' },
  { id: '05-login', url: '/login', wait: 2000 },
  { id: '06-register', url: '/register', wait: 2000 },
  { id: '07-register-sondage', url: '/register/sondage', wait: 2000 },
  { id: '08-contact', url: '/?accueil=1', wait: 1500, scroll: '#contact' },
  { id: '19-suivi-scolarite', url: '/suivi-scolarite', wait: 2000 },
  { id: '27-payer-scolarite', url: '/payer-scolarite', wait: 2000 },
  { id: '28-inscription-etablissement', url: '/inscription-etablissement', wait: 2500 },
];
