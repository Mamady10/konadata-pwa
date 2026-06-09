import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';

export interface ReportSection {
  heading: string;
  lines: string[];
}

export function renderOfflineReport(params: {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  modeLabel?: string;
}): string {
  const { title, subtitle, sections, modeLabel = 'Mode local (données Supabase)' } = params;
  const date = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  const parts: string[] = [
    title,
    subtitle ? subtitle : '',
    `Généré le ${date}`,
    modeLabel,
    '',
  ];

  for (const section of sections) {
    parts.push(`## ${section.heading}`);
    for (const line of section.lines) {
      parts.push(line);
    }
    parts.push('');
  }

  parts.push(
    '---',
    'Ce rapport est basé uniquement sur les données enregistrées dans KonaData. Vérifiez les chiffres avant diffusion officielle.'
  );

  return parts.filter((p) => p !== undefined).join('\n');
}

export async function finalizeSectorReport(params: {
  title: string;
  contextText: string;
  offlineSections: ReportSection[];
  subtitle?: string;
  organizationId?: string;
}): Promise<{ report: string; usedLlm: boolean }> {
  const { title, contextText, offlineSections, subtitle } = params;

  if (!hasActiveLlmApi()) {
    return {
      report: renderOfflineReport({ title, subtitle, sections: offlineSections }),
      usedLlm: false,
    };
  }

  const llmText = await queryKonaAI(
    `Rédigez un rapport professionnel en français pour la direction. Titre : ${title}. Structure : résumé exécutif, faits chiffrés, points d'attention, recommandations. N'inventez aucune donnée absente du contexte.`,
    contextText,
    params.organizationId
      ? { organizationId: params.organizationId, operation: 'report' }
      : undefined
  );

  return {
    report: llmText,
    usedLlm: true,
  };
}

export function formatCurrencyGnf(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} GNF`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10} %`;
}
