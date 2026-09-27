/** Outils partagés par les définitions de tutoriels. */

export const todayIso = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10);
};

export const addDaysIso = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label} : ${error.message}`);
  return data;
}
