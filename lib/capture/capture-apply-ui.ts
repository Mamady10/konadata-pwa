import type { CaptureTemplateKind } from '@/lib/documents/capture-standard-templates';

export interface CaptureApplyUiConfig {
  label: string;
  needsClass?: boolean;
  needsSite?: boolean;
  needsProject?: boolean;
  optionalProject?: boolean;
  needsGradeMeta?: boolean;
  optionalSmsGuardians?: boolean;
}

export const CAPTURE_APPLY_UI: Partial<Record<CaptureTemplateKind, CaptureApplyUiConfig>> = {
  class_list: { label: 'Importer les élèves', needsClass: true, optionalSmsGuardians: true },
  grade_sheet: { label: 'Enregistrer les notes', needsClass: true, needsGradeMeta: true },
  attendance: { label: 'Enregistrer les présences', needsClass: true },
  fuel_sheet: { label: 'Enregistrer le carburant', needsSite: true },
  delivery_note: { label: 'Créer le bon de livraison', needsSite: true },
  daily_site_report: { label: 'Enregistrer le rapport journalier', needsSite: true },
  expense_sheet: { label: 'Enregistrer les dépenses' },
  purchase_order: { label: 'Enregistrer l\'achat' },
  stock_count: { label: 'Mettre à jour les stocks' },
  beneficiary_row: { label: 'Créer le bénéficiaire', optionalProject: true },
  field_report: { label: 'Enregistrer l\'activité', needsProject: true },
  workshop_attendance: { label: 'Enregistrer les présences', needsProject: true },
};

export function getCaptureApplyUi(kind: CaptureTemplateKind): CaptureApplyUiConfig | null {
  return CAPTURE_APPLY_UI[kind] ?? null;
}
