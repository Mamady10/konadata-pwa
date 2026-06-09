import type { TemplateSector } from '@/lib/ai/document-template-purposes';
import type { AiTemplateContext } from '@/lib/ai/adapt-from-template';

const SECTOR_LABELS: Record<TemplateSector, string> = {
  school: 'Établissement scolaire',
  ngo: 'ONG',
  btp: 'BTP / chantier',
};

/** Consignes utiles sans appel API (modèle + notes direction + type de document). */
export function buildOfflineTemplateGuidance(params: {
  sector: TemplateSector;
  template: AiTemplateContext;
  producedFileName: string;
  producedDocType?: string | null;
}): string {
  const { sector, template, producedFileName, producedDocType } = params;
  const lines: string[] = [
    'Mode local (sans OpenAI) — consignes générées à partir du modèle déposé par la direction.',
    '',
    `Organisation : ${SECTOR_LABELS[sector]}`,
    `Modèle de référence : ${template.label}`,
    `Fichier modèle : « ${template.fileName} »`,
  ];

  if (template.purposeHint) {
    lines.push('', 'Objectif du modèle :', template.purposeHint);
  }

  if (template.notes?.trim()) {
    lines.push('', 'Consignes de la direction :', template.notes.trim());
  }

  lines.push(
    '',
    'Document à aligner :',
    `• Fichier : « ${producedFileName} »`,
    producedDocType ? `• Type déclaré : ${producedDocType}` : '',
    '',
    'Checklist pour le rédacteur :',
    '1. Ouvrir le modèle de référence et reproduire la même structure (titres, ordre des sections).',
    '2. Reprendre le même niveau de détail et le même ton (formel / synthétique).',
    '3. Conserver les rubriques obligatoires visibles dans le modèle (tableaux, signatures, mentions).',
    '4. Adapter uniquement les données réelles du projet (noms, dates, montants en GNF) — ne pas inventer de chiffres.',
    '5. Vérifier logo, en-tête et pied de page comme sur le modèle.',
    '',
    'Quand une clé OpenAI (ou un autre fournisseur IA) sera configurée, des consignes plus détaillées pourront être générées automatiquement.'
  );

  return lines.filter((l) => l !== undefined).join('\n');
}
