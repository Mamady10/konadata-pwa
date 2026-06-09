import type { OrganizationType } from '@/types/database';
import { sectorFromOrgType, type Sector } from '@/types/database';

export type KonaChatSector = Sector;

const SECTOR_LABELS: Record<KonaChatSector, string> = {
  global: 'Organisation',
  etablissement: 'Établissement scolaire',
  ong: 'ONG',
  btp: 'BTP / Construction',
  pme: 'PME',
};

export function chatSectorFromOrgType(orgType: OrganizationType | string | undefined): KonaChatSector {
  return sectorFromOrgType(orgType);
}

export function chatSectorLabel(sector: KonaChatSector): string {
  return SECTOR_LABELS[sector] ?? 'Organisation';
}

export function chatReportPath(sector: KonaChatSector): string {
  if (sector === 'etablissement') return '/etablissement/rapports';
  if (sector === 'ong') return '/ong/rapports';
  if (sector === 'btp') return '/btp/rapports';
  if (sector === 'pme') return '/pme/rapports';
  return '/dashboard';
}

export const CHAT_SUGGESTIONS: Record<KonaChatSector, string[]> = {
  etablissement: [
    'Combien avons-nous encaissé ce mois-ci ?',
    'Combien de candidatures sont en attente ?',
    'Où est le rapport PDF déposé sur les finances ?',
    'Quelles classes ont le plus grand écart de paiement ?',
    'Résume la situation financière de l\'établissement',
  ],
  ong: [
    'Quel est le taux d\'exécution budgétaire global ?',
    'Liste les projets actifs et leur avancement',
    'Combien de bénéficiaires sont enregistrés ?',
    'Fais le résumé de tous les projets',
  ],
  btp: [
    'Quel chantier consomme le plus de carburant ?',
    'Quels chantiers sont en retard ?',
    'Synthèse budget et avancement de tous les chantiers',
    'Y a-t-il des anomalies carburant ?',
  ],
  pme: [
    'Quel est notre chiffre d\'affaires et résultat net ?',
    'Quelles créances clients sont les plus élevées ?',
    'Quels produits sont en stock bas ?',
    'Résume l\'activité commerciale récente',
  ],
  global: [
    'Résume les indicateurs de mon organisation',
    'Où générer un rapport détaillé ?',
  ],
};

export function chatSuggestionsForSector(sector: KonaChatSector): string[] {
  return CHAT_SUGGESTIONS[sector] ?? CHAT_SUGGESTIONS.global;
}
