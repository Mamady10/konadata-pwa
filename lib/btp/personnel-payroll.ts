/** Cumul salaires mensuels du 1er janvier jusqu'à asOf (mois courant proratisé). */
export function accrueMonthlyPayrollYtd(
  monthlySalary: number,
  asOf: string,
  payrollStartDate?: string | null
): number {
  if (monthlySalary <= 0) return 0;

  const end = parseDate(asOf);
  if (!end) return 0;

  const yearStart = new Date(end.getFullYear(), 0, 1);
  const start = payrollStartDate ? parseDate(payrollStartDate) : yearStart;
  if (!start || start > end) return 0;

  const effectiveStart = start > yearStart ? start : yearStart;
  let total = 0;

  let cursor = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m, daysInMonth);

    const periodStart = effectiveStart > monthStart ? effectiveStart : monthStart;
    const periodEnd = end < monthEnd ? end : monthEnd;

    if (periodStart <= periodEnd) {
      const daysWorked =
        Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
      total += monthlySalary * (daysWorked / daysInMonth);
    }

    cursor = new Date(y, m + 1, 1);
  }

  return Math.round(total);
}

function parseDate(iso: string): Date | null {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sumPersonnelPayrollYtd(
  personnel: Array<{ monthlySalary: number; payrollStartDate?: string | null }>,
  asOf: string
): number {
  return personnel.reduce(
    (s, p) => s + accrueMonthlyPayrollYtd(p.monthlySalary, asOf, p.payrollStartDate),
    0
  );
}
