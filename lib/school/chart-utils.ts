/** Agrégations mensuelles pour graphiques dashboard */

const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function monthKeyFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthSeries(count = 6) {
  const buckets: { key: string; mois: string; inscriptions: number; montant: number }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      mois: MONTH_SHORT[d.getMonth()],
      inscriptions: 0,
      montant: 0,
    });
  }
  return buckets;
}

export function incrementMonth(
  buckets: ReturnType<typeof buildMonthSeries>,
  dateStr: string | null | undefined,
  field: 'inscriptions' | 'montant',
  amount = 1
) {
  if (!dateStr) return;
  const key = monthKeyFromDate(dateStr);
  const bucket = buckets.find((b) => b.key === key);
  if (bucket) bucket[field] += amount;
}

export function toInscriptionsChart(buckets: ReturnType<typeof buildMonthSeries>) {
  return buckets.map(({ mois, inscriptions }) => ({ mois, inscriptions }));
}

export function toPaymentsChart(buckets: ReturnType<typeof buildMonthSeries>) {
  return buckets.map(({ mois, montant }) => ({ mois, montant }));
}
