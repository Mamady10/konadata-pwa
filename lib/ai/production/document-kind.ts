import type { TemplateSector } from '@/lib/ai/document-template-purposes';
import { orgTypeToTemplateSector } from '@/lib/ai/document-template-purposes';

export type ProductionDocumentKind = 'rapport' | 'bulletin';

export function templateSectorFromOrgType(
  orgType: string | null | undefined
): TemplateSector | null {
  return orgTypeToTemplateSector(orgType);
}

/** Clé `purpose` dans organization_ai_document_templates */
export function templatePurposeForKind(
  sector: TemplateSector,
  kind: ProductionDocumentKind
): { purpose: string } | { error: string } {
  if (sector === 'school') {
    return {
      purpose: kind === 'bulletin' ? 'school_bulletin' : 'school_report',
    };
  }
  if (kind === 'bulletin') {
    return {
      error:
        'Le type « bulletin » est disponible uniquement pour les établissements scolaires. Choisissez « rapport » pour ONG ou BTP.',
    };
  }
  if (sector === 'ngo') {
    return { purpose: 'activity_report' };
  }
  return { purpose: 'site_report' };
}

export function productionKindLabel(kind: ProductionDocumentKind): string {
  return kind === 'bulletin' ? 'Bulletin' : 'Rapport';
}
