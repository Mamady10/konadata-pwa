import { scoreMention } from '@/lib/school/score-mention';

/** Appréciation conseil de classe suggérée (sans IA) à partir de la moyenne. */
export function suggestCouncilAppreciation(average: number | null): string {
  if (average == null || Number.isNaN(average)) return '';
  const m = scoreMention(average);
  if (average >= 14) {
    return `${m}. Félicitations pour vos excellents résultats. Poursuivez vos efforts.`;
  }
  if (average >= 10) {
    return `${m}. Résultats satisfaisants. Encouragements pour progresser davantage.`;
  }
  return `${m}. Des efforts supplémentaires sont nécessaires. L'établissement reste disponible pour vous accompagner.`;
}
