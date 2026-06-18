/** Semaine ISO (lundi → dimanche), format HTML input type="week" : 2026-W24 */

export function getIsoWeekParts(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function toIsoWeekValue(date: Date): string {
  const { year, week } = getIsoWeekParts(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getCurrentIsoWeekValue(): string {
  return toIsoWeekValue(new Date());
}

export function parseIsoWeekValue(value: string): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{1,2})$/i.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  return { year, week };
}

function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function formatUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isoWeekDateRange(
  year: number,
  week: number
): { from: string; to: string; labelFr: string } {
  const monday = mondayOfIsoWeek(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const from = formatUtcDate(monday);
  const to = formatUtcDate(sunday);
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  return {
    from,
    to,
    labelFr: `Semaine ${week} — du ${fmt(from)} au ${fmt(to)}`,
  };
}

export function dateInRange(dateIso: string, from: string, to: string): boolean {
  return dateIso >= from && dateIso <= to;
}

export function timestampInRange(ts: string, from: string, to: string): boolean {
  const day = ts.slice(0, 10);
  return dateInRange(day, from, to);
}
