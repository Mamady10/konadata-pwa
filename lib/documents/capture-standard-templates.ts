import type { DocumentCategory } from '@/types/database';
import type { TemplatePurposeDef, TemplateSector } from '@/lib/ai/document-template-purposes';
import type { SectorDocumentTypeOption } from '@/lib/documents/sector-document-types';

export type CaptureTemplateFormat = 'pdf' | 'csv';
export type CaptureTemplateKind =
  | 'grade_sheet'
  | 'attendance'
  | 'class_list'
  | 'field_report'
  | 'workshop_attendance'
  | 'beneficiary_row'
  | 'daily_site_report'
  | 'fuel_sheet'
  | 'delivery_note'
  | 'expense_sheet'
  | 'purchase_order'
  | 'stock_count';

export interface CaptureStandardTemplate {
  id: string;
  sector: TemplateSector;
  kind: CaptureTemplateKind;
  label: string;
  description: string;
  hint: string;
  category: DocumentCategory;
  formats: CaptureTemplateFormat[];
}

export const CAPTURE_STANDARD_TEMPLATES: CaptureStandardTemplate[] = [
  {
    id: 'konadata_school_grade_sheet',
    sector: 'school',
    kind: 'grade_sheet',
    label: 'Relevé de notes (grille)',
    description: 'Grille élève × matière — cases larges pour saisie manuscrite',
    hint: 'Imprimez, notez à la main, photographiez pour import Vision',
    category: 'school_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_school_attendance',
    sector: 'school',
    kind: 'attendance',
    label: 'Registre de présence',
    description: 'Date, nom, présent/absent — optimisé lecture manuscrite',
    hint: 'Une feuille par séance ou par semaine',
    category: 'school_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_school_class_list',
    sector: 'school',
    kind: 'class_list',
    label: 'Liste de classe',
    description: 'Noms, matricule, téléphone — base pour import élèves',
    hint: 'Alternative au registre libre ; même usage que l’import KonaAI',
    category: 'school_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_ngo_field_report',
    sector: 'ngo',
    kind: 'field_report',
    label: 'Rapport d’activité terrain',
    description: 'Date, lieu, participants, activités, observations',
    hint: 'Rapport hebdomadaire ou mission',
    category: 'ngo_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_ngo_workshop_attendance',
    sector: 'ngo',
    kind: 'workshop_attendance',
    label: 'Liste de présence atelier',
    description: 'Atelier / formation — nom, contact, signature',
    hint: 'Une ligne par participant',
    category: 'ngo_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_ngo_beneficiary_row',
    sector: 'ngo',
    kind: 'beneficiary_row',
    label: 'Fiche bénéficiaire (simplifiée)',
    description: 'Identité, contact, projet, remarques',
    hint: 'Une fiche par bénéficiaire ou lot de fiches',
    category: 'ngo_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_btp_daily_report',
    sector: 'btp',
    kind: 'daily_site_report',
    label: 'Rapport journalier chantier',
    description: 'Effectif, tâches, matériels, incidents, météo',
    hint: 'Compte-rendu de fin de journée',
    category: 'delivery_note',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_btp_fuel_sheet',
    sector: 'btp',
    kind: 'fuel_sheet',
    label: 'Fiche carburant',
    description: 'Engin, litres, chauffeur, index compteur',
    hint: 'Une ligne par plein ou par jour',
    category: 'fuel_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_btp_delivery_note',
    sector: 'btp',
    kind: 'delivery_note',
    label: 'Bon de livraison simplifié',
    description: 'Fournisseur, matériau, quantité, réception',
    hint: 'Réception matériaux chantier',
    category: 'delivery_note',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_pme_expense_sheet',
    sector: 'pme',
    kind: 'expense_sheet',
    label: 'Fiche dépense',
    description: 'Date, libellé, montant GNF, justificatif',
    hint: 'Suivi caisse ou notes de frais',
    category: 'expense_report',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_pme_purchase_order',
    sector: 'pme',
    kind: 'purchase_order',
    label: 'Bon de commande simplifié',
    description: 'Fournisseur, articles, quantités, montants',
    hint: 'Achats fournisseurs',
    category: 'invoice',
    formats: ['pdf', 'csv'],
  },
  {
    id: 'konadata_pme_stock_count',
    sector: 'pme',
    kind: 'stock_count',
    label: 'Inventaire stock',
    description: 'Référence, désignation, quantité comptée',
    hint: 'Inventaire physique magasin / dépôt',
    category: 'other',
    formats: ['pdf', 'csv'],
  },
];

export function getCaptureStandardsForSector(sector: TemplateSector): CaptureStandardTemplate[] {
  return CAPTURE_STANDARD_TEMPLATES.filter((t) => t.sector === sector);
}

export function getCaptureStandardById(id: string): CaptureStandardTemplate | undefined {
  return CAPTURE_STANDARD_TEMPLATES.find((t) => t.id === id);
}

export function isCaptureStandardPurpose(purpose: string): boolean {
  return purpose.startsWith('konadata_');
}

export function captureStandardToPurposeDef(t: CaptureStandardTemplate): TemplatePurposeDef {
  return {
    purpose: t.id,
    label: t.label,
    description: t.description,
    category: t.category,
    hint: t.hint,
    isCaptureStandard: true,
    captureFormats: t.formats,
  };
}

export function captureStandardToSectorOption(t: CaptureStandardTemplate): SectorDocumentTypeOption {
  return {
    id: t.id,
    label: `${t.label} (KonaData)`,
    category: t.category,
    hint: t.hint,
  };
}
