import { createClient } from '@/lib/supabase/server';
import type { ReportSection } from '@/lib/ai/reports/render-report';
import { COLLECTION_MODE_LABELS } from '@/lib/ngo/survey-settings';
import type { NgoSurveyCollectionMode } from '@/lib/ngo/survey-settings';

function pct(part: number, total: number): string {
  if (total <= 0) return '0 %';
  return `${Math.round((part / total) * 100)} %`;
}

export async function gatherNgoSurveyReport(orgId: string, surveyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ngo_survey_analytics', {
    p_survey_id: surveyId,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) throw new Error(String(row.error));

  const stats = (row.stats ?? {}) as Record<string, unknown>;
  const quality = (row.quality ?? {}) as Record<string, unknown>;
  const valid = Number(quality.valid ?? stats.response_count ?? 0);
  const title = `Rapport sondage — ${row.title ?? 'Sans titre'}`;
  const subtitle = [
    row.region ? `Région : ${row.region}` : null,
    COLLECTION_MODE_LABELS[row.collection_mode as NgoSurveyCollectionMode] ??
      row.collection_mode,
  ]
    .filter(Boolean)
    .join(' · ');

  const choiceLines = Array.isArray(stats.by_choice)
    ? (stats.by_choice as { label: string; count: number }[]).map(
        (c) =>
          `• ${c.label} : ${c.count} (${pct(c.count, valid)})`
      )
    : ['Aucune réponse valide'];

  const regionLines = Array.isArray(stats.by_region)
    ? (stats.by_region as { label: string; count: number }[])
        .slice(0, 15)
        .map((r) => `• ${r.label} : ${r.count}`)
    : ['—'];

  const dayLines = Array.isArray(row.by_day)
    ? (row.by_day as { day: string; count: number }[]).map((d) => `• ${d.day} : ${d.count}`)
    : ['—'];

  const sections: ReportSection[] = [
    {
      heading: 'Synthèse',
      lines: [
        `Réponses valides : ${valid}`,
        `Réponses brutes : ${quality.total ?? valid}`,
        `Exclues (nettoyage) : ${quality.excluded ?? 0}`,
        `Objectif cibles : ${stats.target_responses ?? '—'}`,
        `Progression : ${stats.progress_pct != null ? `${stats.progress_pct} %` : '—'}`,
        `Groupes de doublons détectés : ${quality.duplicate_groups ?? 0}`,
        `Alertes sécurité non acquittées : ${quality.alerts ?? 0}`,
      ],
    },
    {
      heading: 'Répartition des choix (Q1)',
      lines: choiceLines,
    },
    {
      heading: 'Répartition géographique (localité)',
      lines: regionLines,
    },
    {
      heading: 'Collecte dans le temps',
      lines: dayLines.length ? dayLines : ['Pas encore de série temporelle'],
    },
    {
      heading: 'Qualité des données',
      lines: [
        `Avec GPS : ${quality.with_gps ?? 0} (${pct(Number(quality.with_gps ?? 0), valid)})`,
        `Avec localité : ${quality.with_locality ?? 0} (${pct(Number(quality.with_locality ?? 0), valid)})`,
        'Les réponses exclues ne sont pas comptées dans les pourcentages ci-dessus.',
      ],
    },
  ];

  const contextText = [
    title,
    subtitle,
    '',
    ...sections.flatMap((s) => [`## ${s.heading}`, ...s.lines, '']),
  ].join('\n');

  return {
    title,
    subtitle,
    scopeLabel: String(row.title ?? surveyId),
    contextText,
    sections,
  };
}

export async function gatherNgoSurveyChatContext(orgId: string, surveyId: string): Promise<string> {
  const gathered = await gatherNgoSurveyReport(orgId, surveyId);
  const { getAiTemplateContext } = await import('@/lib/ai/adapt-from-template');
  const { NGO_SURVEY_REPORT_PURPOSE } = await import('@/lib/ai/document-template-purposes');
  const template = await getAiTemplateContext(orgId, 'ngo', NGO_SURVEY_REPORT_PURPOSE);

  const supabase = await createClient();

  const { data: cross } = await supabase.rpc('ngo_survey_analytics', {
    p_survey_id: surveyId,
  });
  const row = (cross ?? {}) as Record<string, unknown>;
  const crossTab = Array.isArray(row.cross_tab)
    ? (row.cross_tab as { choice: string; locality: string; count: number }[])
        .slice(0, 20)
        .map((c) => `${c.choice} @ ${c.locality} : ${c.count}`)
    : [];

  const mapSample = Array.isArray(row.map_points)
    ? (row.map_points as { lat: number; lng: number; locality: string; choice: string }[])
        .slice(0, 15)
        .map((p) => `GPS ${p.lat},${p.lng} — ${p.locality} — ${p.choice}`)
    : [];

  const templateBlock = template
    ? [
        '=== MODÈLE RAPPORT ORGANISATION ===',
        `Fichier : ${template.fileName}`,
        template.purposeHint ? `Objectif : ${template.purposeHint}` : '',
        template.notes ? `Consignes direction : ${template.notes}` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return [
    templateBlock,
    gathered.contextText,
    '=== Croisement choix × localité (top) ===',
    ...crossTab,
    '=== Échantillon points GPS ===',
    ...(mapSample.length ? mapSample : ['Aucun point GPS']),
  ].join('\n');
}
