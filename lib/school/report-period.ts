/** Fenêtres temporelles pour les rapports de direction (établissement). */

export type SchoolReportPeriod = 'month' | 'trimester' | 'semester' | 'year';

export interface SchoolPeriodWindow {
  period: SchoolReportPeriod;
  start: Date;
  end: Date;
  /** Libellé court du type de période (ex. « Trimestre 2 »). */
  periodLabel: string;
  /** Plage de dates lisible (ex. « déc. 2025 – févr. 2026 »). */
  rangeLabel: string;
}

export const SCHOOL_REPORT_PERIODS: { id: SchoolReportPeriod; label: string }[] = [
  { id: 'month', label: 'Mois' },
  { id: 'trimester', label: 'Trimestre' },
  { id: 'semester', label: 'Semestre' },
  { id: 'year', label: 'Année scolaire' },
];

/** Mois de démarrage de l'année scolaire (septembre = 8, base 0). */
const SCHOOL_YEAR_START_MONTH = 8;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function monthShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

/** Année scolaire contenant `now` (l'année démarre en septembre). */
function schoolYearStartYear(now: Date): number {
  return now.getMonth() >= SCHOOL_YEAR_START_MONTH ? now.getFullYear() : now.getFullYear() - 1;
}

export function schoolAcademicYearLabel(now: Date = new Date()): string {
  const y = schoolYearStartYear(now);
  return `${y}-${y + 1}`;
}

export function resolveSchoolPeriod(
  period: SchoolReportPeriod,
  now: Date = new Date()
): SchoolPeriodWindow {
  const yStart = schoolYearStartYear(now);

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return {
      period,
      start: startOfDay(start),
      end,
      periodLabel: now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      rangeLabel: monthShort(start),
    };
  }

  if (period === 'year') {
    const start = new Date(yStart, SCHOOL_YEAR_START_MONTH, 1);
    const end = endOfDay(new Date(yStart + 1, SCHOOL_YEAR_START_MONTH, 0));
    return {
      period,
      start: startOfDay(start),
      end,
      periodLabel: `Année scolaire ${yStart}-${yStart + 1}`,
      rangeLabel: `${monthShort(start)} – ${monthShort(end)}`,
    };
  }

  // Offset (en mois) de `now` depuis le début de l'année scolaire (0..11).
  const monthsSinceStart =
    (now.getFullYear() - yStart) * 12 + (now.getMonth() - SCHOOL_YEAR_START_MONTH);
  const clamped = Math.max(0, Math.min(11, monthsSinceStart));

  if (period === 'trimester') {
    const index = Math.floor(clamped / 3); // 0..3
    const startMonthAbs = SCHOOL_YEAR_START_MONTH + index * 3;
    const start = new Date(yStart, startMonthAbs, 1);
    const end = endOfDay(new Date(yStart, startMonthAbs + 3, 0));
    return {
      period,
      start: startOfDay(start),
      end,
      periodLabel: `Trimestre ${index + 1} (${yStart}-${yStart + 1})`,
      rangeLabel: `${monthShort(start)} – ${monthShort(end)}`,
    };
  }

  // semester
  const index = Math.floor(clamped / 6); // 0..1
  const startMonthAbs = SCHOOL_YEAR_START_MONTH + index * 6;
  const start = new Date(yStart, startMonthAbs, 1);
  const end = endOfDay(new Date(yStart, startMonthAbs + 6, 0));
  return {
    period,
    start: startOfDay(start),
    end,
    periodLabel: `Semestre ${index + 1} (${yStart}-${yStart + 1})`,
    rangeLabel: `${monthShort(start)} – ${monthShort(end)}`,
  };
}
