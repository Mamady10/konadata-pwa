export function projectStatusLabel(status: string | null): string {
  const map: Record<string, string> = {
    active: 'En cours',
    planning: 'Planification',
    completed: 'Terminé',
    suspended: 'Suspendu',
    cancelled: 'Annulé',
  };
  return status ? (map[status] ?? status) : '—';
}

export function surveyStatusLabel(status: string | null): string {
  const map: Record<string, string> = {
    draft: 'Brouillon',
    scheduled: 'Programmé',
    active: 'En cours',
    closed: 'Terminé',
    archived: 'Archivé',
  };
  return status ? (map[status] ?? status) : '—';
}

export function paymentStatusLabel(status: string | null): string {
  const map: Record<string, string> = {
    pending: 'En attente',
    partial: 'Partiel',
    paid: 'Payé',
    overdue: 'En retard',
    cancelled: 'Annulé',
  };
  return status ? (map[status] ?? status) : '—';
}

export function siteStatusLabel(status: string | null): string {
  const map: Record<string, string> = {
    planning: 'Planification',
    active: 'En cours',
    paused: 'En pause',
    completed: 'Terminé',
    cancelled: 'Annulé',
  };
  return status ? (map[status] ?? status) : '—';
}
