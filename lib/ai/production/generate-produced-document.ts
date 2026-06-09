import { gatherBtpReport } from '@/lib/ai/reports/gather-btp';
import { gatherNgoReport } from '@/lib/ai/reports/gather-ngo';
import { gatherSchoolReport } from '@/lib/ai/reports/gather-school';
import { renderOfflineReport, type ReportSection } from '@/lib/ai/reports/render-report';
import { SCOPE_ALL } from '@/lib/ai/sector-report-types';
import { getAiTemplateContext } from '@/lib/ai/adapt-from-template';
import { buildOfflineTemplateGuidance } from '@/lib/ai/offline-template-guidance';
import {
  productionKindLabel,
  templatePurposeForKind,
  type ProductionDocumentKind,
} from '@/lib/ai/production/document-kind';
import type { TemplateSector } from '@/lib/ai/document-template-purposes';
import { getTemplatePurposeDef } from '@/lib/ai/document-template-purposes';
import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';
import type { SchoolAiReportType } from '@/lib/ai/sector-report-types';

async function gatherForProduction(
  orgId: string,
  sector: TemplateSector,
  kind: ProductionDocumentKind,
  scopeId: string
) {
  const scope = scopeId?.trim() || SCOPE_ALL;

  if (sector === 'school') {
    const reportType: SchoolAiReportType =
      kind === 'bulletin' ? 'results' : 'overview';
    return gatherSchoolReport(orgId, scope, reportType);
  }
  if (sector === 'ngo') {
    return gatherNgoReport(orgId, scope, 'general');
  }
  return gatherBtpReport(orgId, scope, 'general');
}

export async function generateProducedDocument(params: {
  orgId: string;
  orgName: string;
  sector: TemplateSector;
  kind: ProductionDocumentKind;
  scopeId?: string;
}): Promise<
  | {
      content: string;
      usedLlm: boolean;
      title: string;
      subtitle: string;
      scopeLabel: string;
      scopeId: string;
      templatePurpose: string;
      reportTypeLabel: string;
    }
  | { error: string }
> {
  const scopeId = params.scopeId?.trim() || SCOPE_ALL;
  const purposeRes = templatePurposeForKind(params.sector, params.kind);
  if ('error' in purposeRes) return purposeRes;

  const template = await getAiTemplateContext(
    params.orgId,
    params.sector,
    purposeRes.purpose
  );
  if (!template) {
    const def = getTemplatePurposeDef(params.sector, purposeRes.purpose);
    return {
      error: `Aucun modèle IA enregistré pour « ${productionKindLabel(params.kind)} » (${def?.label ?? purposeRes.purpose}). Le directeur doit déposer un fichier dans Paramètres → Modèles IA.`,
    };
  }

  let gathered;
  try {
    gathered = await gatherForProduction(
      params.orgId,
      params.sector,
      params.kind,
      scopeId
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Données indisponibles';
    return { error: msg };
  }

  const kindLabel = productionKindLabel(params.kind);
  const title = `${kindLabel} — ${template.label} — ${gathered.scopeLabel}`;
  const subtitle = `${params.orgName} · aligné sur « ${template.fileName} »`;

  const templateBlock = [
    '=== MODÈLE DE RÉFÉRENCE (direction) ===',
    `Type : ${kindLabel}`,
    `Libellé : ${template.label}`,
    `Fichier modèle : ${template.fileName}`,
    template.purposeHint ? `Objectif : ${template.purposeHint}` : '',
    template.notes ? `Consignes direction : ${template.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const dataBlock = `${templateBlock}\n\n=== DONNÉES ORGANISATION ===\n${gathered.contextText}`;

  if (hasActiveLlmApi()) {
    const userPrompt = [
      `Produisez un document complet de type « ${kindLabel} » pour l'organisation.`,
      `Reproduisez la structure, les rubriques et le ton du modèle « ${template.label} ».`,
      'Utilisez uniquement les données fournies ; ne inventez pas de noms, notes ou montants.',
      'Format : markdown avec titres ## et listes. Incluez en-tête (établissement, période, périmètre) et sections du modèle.',
      gathered.scopeLabel !== 'Tout l\'établissement' && gathered.scopeLabel !== 'Tous les projets' && gathered.scopeLabel !== 'Tous les chantiers'
        ? `Périmètre : ${gathered.scopeLabel}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const content = await queryKonaAI(userPrompt, dataBlock, {
      organizationId: params.orgId,
      operation: 'report',
    });
    return {
      content,
      usedLlm: true,
      title,
      subtitle,
      scopeLabel: gathered.scopeLabel,
      scopeId,
      templatePurpose: purposeRes.purpose,
      reportTypeLabel: `${kindLabel} (modèle IA)`,
    };
  }

  const guidance = buildOfflineTemplateGuidance({
    sector: params.sector,
    template,
    producedFileName: title,
    producedDocType: kindLabel,
  });

  const sections: ReportSection[] = [
    ...gathered.sections,
    {
      heading: 'Alignement sur le modèle IA',
      lines: guidance.split('\n').filter((l) => l.trim()),
    },
  ];

  const body = renderOfflineReport({
    title,
    subtitle,
    sections,
    modeLabel: `Mode local — ${kindLabel} structuré (configurez OPENAI_API_KEY pour rédaction automatique)`,
  });

  return {
    content: body,
    usedLlm: false,
    title,
    subtitle,
    scopeLabel: gathered.scopeLabel,
    scopeId,
    templatePurpose: purposeRes.purpose,
    reportTypeLabel: `${kindLabel} (modèle IA, mode local)`,
  };
}
