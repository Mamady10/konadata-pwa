const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function scheduleDayLabel(day: number): string {
  return DAY_LABELS[day] ?? `J${day}`;
}

export const SCHEDULE_DAYS = DAY_LABELS.map((label, value) => ({ value, label }));
