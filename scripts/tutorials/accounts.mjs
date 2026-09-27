/**
 * Organisations « vitrine » réservées aux tutoriels et vidéos (créées par scripts/tutorials/seed-vitrine-*.mjs).
 * Distinctes des comptes démo historiques (scripts/demo-accounts.config.mjs).
 */
export const VITRINE_PASSWORD = process.env.VITRINE_PASSWORD || 'DemoKona2026!';

export const VITRINE_ACCOUNTS = {
  btp: { email: 'video.btp@konadata.demo', fullName: 'Ibrahima SOW', role: 'org_admin', home: '/btp' },
  'btp-chef': { email: 'video.chef.btp@konadata.demo', fullName: 'Alpha CAMARA', role: 'btp_staff', home: '/btp/avancement' },
  ecole: { email: 'video.ecole@konadata.demo', fullName: 'Mariama BAH', role: 'org_admin', home: '/etablissement' },
  ong: { email: 'video.ong@konadata.demo', fullName: 'Fatoumata CONDÉ', role: 'org_admin', home: '/ong' },
  pme: { email: 'video.pme@konadata.demo', fullName: 'Kadiatou SYLLA', role: 'org_admin', home: '/pme' },
};

export const VITRINE_ORGS = {
  btp: { name: 'Bâtir Guinée SARL', city: 'Conakry' },
  ecole: { name: 'Groupe Scolaire Horizon', city: 'Conakry' },
  ong: { name: 'Santé & Avenir Guinée', city: 'Conakry' },
  pme: { name: 'Espace Commercial Madina', city: 'Conakry' },
};
