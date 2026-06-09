export function scoreMention(scoreOn20: number): string {
  if (scoreOn20 >= 16) return 'Très bien';
  if (scoreOn20 >= 14) return 'Bien';
  if (scoreOn20 >= 12) return 'Assez bien';
  if (scoreOn20 >= 10) return 'Passable';
  if (scoreOn20 >= 8) return 'Insuffisant';
  return 'Très insuffisant';
}
