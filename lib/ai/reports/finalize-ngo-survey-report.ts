import { getAiTemplateContext } from '@/lib/ai/adapt-from-template';
import { buildOfflineTemplateGuidance } from '@/lib/ai/offline-template-guidance';
import { NGO_SURVEY_REPORT_PURPOSE } from '@/lib/ai/document-template-purposes';
import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';
import {
  finalizeSectorReport,
  renderOfflineReport,
  type ReportSection,
} from '@/lib/ai/reports/render-report';

export async function finalizeNgoSurveyReport(params: {
  orgId: string;
  title: string;
  subtitle?: string;
  contextText: string;
  offlineSections: ReportSection[];
  scopeLabel: string;
}): Promise<{
  report: string;
  usedLlm: boolean;
  templateUsed: boolean;
  templateFileName?: string;
  title: string;
  subtitle?: string;
}> {
  const template = await getAiTemplateContext(
    params.orgId,
    'ngo',
    NGO_SURVEY_REPORT_PURPOSE
  );

  if (!template) {
    const result = await finalizeSectorReport({
      title: params.title,
      subtitle: params.subtitle,
      contextText: params.contextText,
      offlineSections: params.offlineSections,
      organizationId: params.orgId,
    });
    return {
      ...result,
      templateUsed: false,
      title: params.title,
      subtitle: params.subtitle,
    };
  }

  const kindLabel = 'Rapport de sondage';
  const title = `${params.title} — aligné sur « ${template.fileName} »`;
  const subtitle = [params.subtitle, `Modèle : ${template.label}`]
    .filter(Boolean)
    .join(' · ');

  const templateBlock = [
    '=== MODÈLE DE RÉFÉRENCE (direction) ===',
    `Type : ${kindLabel}`,
    `Libellé : ${template.label}`,
    `Fichier modèle : ${template.fileName}`,
    template.purposeHint ? `Objectif : ${template.purposeHint}` : '',
    template.notes ? `Consignes direction : ${template.notes}` : '',
    'Reproduisez la structure, les rubriques et le ton de ce modèle.',
  ]
    .filter(Boolean)
    .join('\n');

  const dataBlock = `${templateBlock}\n\n=== DONNÉES DU SONDAGE ===\n${params.contextText}`;

  if (hasActiveLlmApi()) {
    const userPrompt = [
      `Produisez un rapport de sondage complet en français pour la direction et les bailleurs.`,
      `Reproduisez fidèlement la structure, les rubriques et le ton du modèle « ${template.label} » (${template.fileName}).`,
      'Utilisez uniquement les données du sondage fournies ; ne inventez pas de chiffres ni de conclusions non supportées.',
      'Format : markdown avec titres ## et listes. Incluez synthèse exécutive, résultats chiffrés, analyse territoriale, qualité des données et recommandations si le modèle le prévoit.',
      `Sondage : ${params.scopeLabel}`,
    ]
      .filter(Boolean)
      .join('\n');

    const report = await queryKonaAI(userPrompt, dataBlock, {
      organizationId: params.orgId,
      operation: 'report',
    });
    return {
      report,
      usedLlm: true,
      templateUsed: true,
      templateFileName: template.fileName,
      title,
      subtitle,
    };
  }

  const guidance = buildOfflineTemplateGuidance({
    sector: 'ngo',
    template,
    producedFileName: params.title,
    producedDocType: kindLabel,
  });

  const sections: ReportSection[] = [
    ...params.offlineSections,
    {
      heading: 'Alignement sur le modèle organisation',
      lines: guidance.split('\n').filter((l) => l.trim()),
    },
  ];

  const report = renderOfflineReport({
    title,
    subtitle,
    sections,
    modeLabel:
      'Mode local — rapport structuré selon modèle (configurez OPENAI_API_KEY pour rédaction automatique)',
  });

  return {
    report,
    usedLlm: false,
    templateUsed: true,
    templateFileName: template.fileName,
    title,
    subtitle,
  };
}
