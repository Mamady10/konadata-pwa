'use client';

import type { ReportCardsSuggestion } from '@/lib/school/grades-to-bulletins';

interface Props {
  completeness: ReportCardsSuggestion | null;
  loading?: boolean;
}

export function ReportCardCompletenessPanel({ completeness, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Calcul de la complétude des notes…
      </div>
    );
  }

  if (!completeness || completeness.enrolledCount === 0) return null;

  const pct = completeness.coveragePct;
  const tone =
    pct >= 80
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : pct >= 60
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-red-500/25 bg-red-500/5';

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm space-y-2 ${tone}`}>
      {(completeness.levelBandLabel || completeness.periodLabel) && (
        <p className="text-xs text-muted-foreground">
          {completeness.levelBandLabel && (
            <span>
              Palier : <strong>{completeness.levelBandLabel}</strong>
            </span>
          )}
          {completeness.periodLabel && (
            <span>
              {completeness.levelBandLabel ? ' · ' : ''}
              Période : <strong>{completeness.periodLabel}</strong>
            </span>
          )}
          {completeness.includedExamTypesLabel && (
            <span>
              {' '}
              · Notes retenues : <strong>{completeness.includedExamTypesLabel}</strong>
            </span>
          )}
          {!completeness.includedExamTypesLabel && (
            <span> · Notes retenues : <strong>toutes les évaluations</strong></span>
          )}
        </p>
      )}
      <p>
        <strong>Complétude moyenne : {pct}%</strong>
        {completeness.evaluationSlots > 0 ? (
          <>
            {' '}
            — {completeness.evaluationSlots} évaluation(s) attendue(s) ·{' '}
            {completeness.studentsFullyComplete}/{completeness.enrolledCount} élève(s) avec toutes
            les notes
          </>
        ) : (
          <>
            {' '}
            — {completeness.studentsWithGrades}/{completeness.enrolledCount} élève(s) avec au moins
            une note (créez des évaluations dans Résultats pour un suivi fin)
          </>
        )}
      </p>
      <p className="text-muted-foreground text-xs">
        Moyenne par matière = moyenne des notes saisies (y compris 0/20). Moyenne générale
        pondérée par les coefficients. Les cases vides ne comptent pas dans la moyenne mais
        déclenchent une alerte avant génération.
      </p>
      {completeness.hasGaps && completeness.gapSummary && (
        <pre className="text-xs whitespace-pre-wrap rounded bg-amber-500/5 border border-amber-500/20 p-2 mt-2">
          {completeness.gapSummary}
        </pre>
      )}
      {!completeness.ready && (
        <p className="text-xs text-amber-800">
          Seuil conseillé : 60% de complétude avant génération massive. Vous pourrez tout de même
          continuer après confirmation.
        </p>
      )}
    </div>
  );
}
