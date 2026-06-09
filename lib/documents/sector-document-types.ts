import type { DocumentCategory } from '@/types/database';
import { getCaptureStandardById } from '@/lib/documents/capture-standard-templates';

export interface SectorDocumentTypeOption {
  id: string;
  label: string;
  category: DocumentCategory;
  hint?: string;
}

/** Types proposés aux agents ONG avant upload */
export const NGO_DOCUMENT_TYPES: SectorDocumentTypeOption[] = [
  { id: 'activity_report', label: 'Rapport d\'activité', category: 'ngo_report', hint: 'Compte-rendu terrain, ateliers, missions' },
  { id: 'financial_report', label: 'Rapport financier / dépenses', category: 'expense_report', hint: 'Justificatifs, décaissements, bilan projet' },
  { id: 'questionnaire', label: 'Questionnaire / enquête', category: 'questionnaire', hint: 'Sondages, collecte de données' },
  { id: 'beneficiary_list', label: 'Liste bénéficiaires', category: 'ngo_report', hint: 'Registres, listes de présence' },
  { id: 'partner_contract', label: 'Convention / partenariat', category: 'other', hint: 'Accords, MOU, contrats' },
  { id: 'invoice', label: 'Facture / bon de commande', category: 'invoice', hint: 'Achats, prestataires' },
  { id: 'site_photo', label: 'Photo terrain', category: 'ngo_report', hint: 'Preuves visuelles, géolocalisation' },
  { id: 'project_plan', label: 'Plan / document technique', category: 'other', hint: 'Schémas, cartes, planning' },
  { id: 'other', label: 'Autre document', category: 'other' },
];

/** Types proposés aux chefs de chantier / staff BTP avant upload */
export const BTP_DOCUMENT_TYPES: SectorDocumentTypeOption[] = [
  { id: 'site_report', label: 'Rapport de chantier', category: 'delivery_note', hint: 'Synthèse hebdomadaire, compte-rendu' },
  { id: 'progress_report', label: 'Rapport d\'avancement', category: 'other', hint: 'État d\'avancement physique / planning' },
  { id: 'fuel_report', label: 'Rapport carburant', category: 'fuel_report', hint: 'Consommation, pleins, anomalies' },
  { id: 'delivery_note', label: 'Bon de livraison', category: 'delivery_note', hint: 'Réceptions matériaux' },
  { id: 'supplier_invoice', label: 'Facture fournisseur', category: 'invoice', hint: 'Achats chantier' },
  { id: 'safety_sheet', label: 'Fiche sécurité / HSE', category: 'other', hint: 'Incidents, EPI, consignes' },
  { id: 'site_photo', label: 'Photo chantier', category: 'other', hint: 'Avancement, contrôle qualité' },
  { id: 'technical_plan', label: 'Plan technique', category: 'other', hint: 'Plans, coupes, métrés' },
  { id: 'other', label: 'Autre document', category: 'other' },
];

const NGO_BY_ID = Object.fromEntries(NGO_DOCUMENT_TYPES.map((t) => [t.id, t])) as Record<
  string,
  SectorDocumentTypeOption
>;
const BTP_BY_ID = Object.fromEntries(BTP_DOCUMENT_TYPES.map((t) => [t.id, t])) as Record<
  string,
  SectorDocumentTypeOption
>;

export function getNgoDocumentType(id: string): SectorDocumentTypeOption | undefined {
  return NGO_BY_ID[id];
}

export function getBtpDocumentType(id: string): SectorDocumentTypeOption | undefined {
  return BTP_BY_ID[id];
}

export function getDocumentTypeLabel(
  sector: 'ngo' | 'btp',
  typeId: string | null | undefined
): string {
  if (!typeId) return 'Non classé';
  const def = sector === 'ngo' ? NGO_BY_ID[typeId] : BTP_BY_ID[typeId];
  if (def) return def.label;
  if (typeId.startsWith('konadata_')) {
    const cap = getCaptureStandardById(typeId);
    if (cap) return `${cap.label} (KonaData)`;
  }
  return typeId;
}

export const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  school_report: 'Établissement',
  ngo_report: 'Rapport ONG',
  expense_report: 'Finances',
  questionnaire: 'Enquête',
  invoice: 'Facture',
  delivery_note: 'Logistique / BTP',
  fuel_report: 'Carburant',
  cv: 'RH',
  other: 'Autre',
};
