export type BtpAiReportType = 'general' | 'fuel' | 'delivery_notes' | 'progress' | 'stock';

export type NgoAiReportType = 'general' | 'budget' | 'beneficiaries' | 'documents' | 'survey';

export type SchoolAiReportType =
  | 'overview'
  | 'finance'
  | 'enrollments'
  | 'results'
  | 'monthly';

export const BTP_AI_REPORT_TYPES: { id: BtpAiReportType; label: string; hint: string }[] = [
  { id: 'general', label: 'Rapport général chantier', hint: 'Budget, avancement, retards, synthèse' },
  { id: 'fuel', label: 'Carburant', hint: 'Consommations et anomalies du chantier' },
  { id: 'delivery_notes', label: 'Bons de livraison', hint: 'Livraisons et montants fournisseurs' },
  { id: 'progress', label: 'Avancement terrain', hint: 'Saisies quotidiennes et notes chantier' },
  { id: 'stock', label: 'Stocks (entrepôt)', hint: 'Stock organisation + livraisons liées au chantier' },
];

export const NGO_AI_REPORT_TYPES: { id: NgoAiReportType; label: string; hint: string }[] = [
  { id: 'general', label: 'Rapport général projet', hint: 'Statut, zone, bénéficiaires, avancement' },
  { id: 'budget', label: 'Budget & exécution', hint: 'Dépenses, budget restant, taux d\'exécution' },
  { id: 'beneficiaries', label: 'Bénéficiaires (zone projet)', hint: 'Profils dans la région du projet' },
  { id: 'documents', label: 'Documents projet', hint: 'Pièces déposées pour ce projet' },
  { id: 'survey', label: 'Rapport sondage', hint: 'Analyse des réponses, localités et qualité des données' },
];

export const SCHOOL_AI_REPORT_TYPES: { id: SchoolAiReportType; label: string; hint: string }[] = [
  { id: 'monthly', label: 'Rapport mensuel direction', hint: 'Synthèse du mois en cours — 1 clic' },
  { id: 'overview', label: 'Vue d\'ensemble', hint: 'Effectifs, candidatures, finances, résultats' },
  { id: 'finance', label: 'Finances', hint: 'Encaissements, attendus, écarts par classe' },
  { id: 'enrollments', label: 'Candidatures & inscriptions', hint: 'Dossiers par statut et classe' },
  { id: 'results', label: 'Résultats scolaires', hint: 'Notes et moyennes' },
];

export const SCOPE_ALL = '__all__';
