import { isoWeekDateRange, parseIsoWeekValue } from '@/lib/btp/week-period';

export type ReportPeriodType = 'week' | 'month' | 'quarter' | 'year';

export interface ResolvedReportPeriod {
  periodType: ReportPeriodType;
  periodValue: string;
  periodLabel: string;
  from: string;
  to: string;
}

function pad2(v: number): string {
  return String(v).padStart(2, '0');
}

function monthLabelFr(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  const monthName = d.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

function lastDayOfMonthIso(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function shortDateFr(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Période de même nature qui suit immédiatement celle se terminant à `periodTo`. */
export function nextReportPeriodRange(
  periodType: ReportPeriodType,
  periodTo: string
): { from: string; to: string; label: string } | null {
  const end = new Date(`${periodTo.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() + 1);
  const from = start.toISOString().slice(0, 10);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;

  if (periodType === 'week') {
    const last = new Date(start);
    last.setUTCDate(last.getUTCDate() + 6);
    const to = last.toISOString().slice(0, 10);
    return { from, to, label: `Semaine suivante (${shortDateFr(from)} - ${shortDateFr(to)})` };
  }
  if (periodType === 'month') {
    return {
      from,
      to: lastDayOfMonthIso(year, month),
      label: `Mois suivant (${monthLabelFr(year, month)})`,
    };
  }
  if (periodType === 'quarter') {
    const quarter = Math.ceil(month / 3);
    return {
      from,
      to: lastDayOfMonthIso(year, quarter * 3),
      label: `Trimestre suivant (T${quarter} ${year})`,
    };
  }
  return { from, to: `${year}-12-31`, label: `Année suivante (${year})` };
}

export function getDefaultPeriodValue(periodType: ReportPeriodType): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (periodType === 'week') {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const weekStart = new Date(jan4);
    weekStart.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
    const today = new Date(Date.UTC(year, now.getMonth(), now.getDate()));
    const diff = Math.floor((today.getTime() - weekStart.getTime()) / 86400000);
    const week = Math.max(1, Math.floor(diff / 7) + 1);
    return `${year}-W${pad2(week)}`;
  }
  if (periodType === 'month') return `${year}-${pad2(month)}`;
  if (periodType === 'quarter') return `${year}-Q${Math.ceil(month / 3)}`;
  return String(year);
}

export function resolveReportPeriod(
  periodType: ReportPeriodType,
  rawValue: string | null | undefined
): ResolvedReportPeriod {
  const value = (rawValue ?? '').trim() || getDefaultPeriodValue(periodType);

  if (periodType === 'week') {
    const parsed = parseIsoWeekValue(value);
    if (!parsed) throw new Error('Semaine invalide (format attendu : 2026-W24).');
    const { from, to, labelFr } = isoWeekDateRange(parsed.year, parsed.week);
    return { periodType, periodValue: value, periodLabel: labelFr, from, to };
  }

  if (periodType === 'month') {
    const m = value.match(/^(\d{4})-(\d{2})$/);
    if (!m) throw new Error('Mois invalide (format attendu : 2026-06).');
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) throw new Error('Mois invalide.');
    const from = `${year}-${pad2(month)}-01`;
    const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { periodType, periodValue: value, periodLabel: monthLabelFr(year, month), from, to };
  }

  if (periodType === 'quarter') {
    const q = value.match(/^(\d{4})-Q([1-4])$/);
    if (!q) throw new Error('Trimestre invalide (format attendu : 2026-Q2).');
    const year = Number(q[1]);
    const quarter = Number(q[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const from = `${year}-${pad2(startMonth)}-01`;
    const to = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
    return { periodType, periodValue: value, periodLabel: `T${quarter} ${year}`, from, to };
  }

  const y = value.match(/^\d{4}$/);
  if (!y) throw new Error('Année invalide (format attendu : 2026).');
  const year = Number(y[0]);
  return {
    periodType,
    periodValue: value,
    periodLabel: `Année ${year}`,
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}
