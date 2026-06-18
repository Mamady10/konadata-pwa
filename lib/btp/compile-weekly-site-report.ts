import { createClient } from '@/lib/supabase/server';
import { renderOfflineReport, formatCurrencyGnf, type ReportSection } from '@/lib/ai/reports/render-report';
import { siteStatusLabel } from '@/lib/sector/status-labels';
import {
  isoWeekDateRange,
  parseIsoWeekValue,
  dateInRange,
  timestampInRange,
} from '@/lib/btp/week-period';

export const BTP_WEEKLY_SITE_REPORT_TYPE = 'weekly_site';
export const BTP_WEEKLY_SITE_REPORT_LABEL = 'Rapport de chantier hebdomadaire';

export interface BtpWeeklyCompileInput {
  orgId: string;
  siteId: string;
  isoWeek: string;
  weeklyComment?: string | null;
  orgName?: string | null;
}

export interface BtpWeeklyCompileResult {
  title: string;
  subtitle: string;
  scopeLabel: string;
  isoWeek: string;
  periodFrom: string;
  periodTo: string;
  sections: ReportSection[];
  report: string;
  stats: {
    dailyEntries: number;
    fuelLogs: number;
    deliveryNotes: number;
    hseMentions: number;
  };
}

export async function compileBtpWeeklySiteReport(
  input: BtpWeeklyCompileInput
): Promise<BtpWeeklyCompileResult> {
  const parsed = parseIsoWeekValue(input.isoWeek);
  if (!parsed) throw new Error('Semaine invalide (format attendu : 2026-W24).');

  const { from, to, labelFr } = isoWeekDateRange(parsed.year, parsed.week);
  const supabase = await createClient();

  const { data: site, error: siteErr } = await supabase
    .from('btp_sites')
    .select(
      'id, name, location, budget, spent, status, physical_progress, financial_progress, delay_days'
    )
    .eq('organization_id', input.orgId)
    .eq('id', input.siteId)
    .maybeSingle();

  if (siteErr) throw new Error(siteErr.message);
  if (!site?.id) throw new Error('Chantier introuvable.');

  const siteName = site.name as string;
  const title = `Rapport de chantier hebdomadaire — ${siteName}`;
  const subtitle = labelFr;

  const [dailyRes, fuelRes, notesRes, docsRes] = await Promise.all([
    supabase
      .from('btp_daily_progress')
      .select('progress_date, physical_pct, workers_count, notes, weather')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId)
      .gte('progress_date', from)
      .lte('progress_date', to)
      .order('progress_date', { ascending: true }),
    supabase
      .from('btp_fuel_logs')
      .select('liters, cost, logged_at, is_anomaly, notes')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId)
      .gte('logged_at', `${from}T00:00:00`)
      .lte('logged_at', `${to}T23:59:59`)
      .order('logged_at', { ascending: true }),
    supabase
      .from('btp_delivery_notes')
      .select('reference, supplier, total_amount, delivery_date')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId)
      .order('delivery_date', { ascending: true }),
    supabase
      .from('btp_site_documents')
      .select('doc_type, created_at, documents(file_name, created_at)')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId),
  ]);

  if (dailyRes.error) throw new Error(dailyRes.error.message);
  if (fuelRes.error) throw new Error(fuelRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);

  const daily = dailyRes.data ?? [];
  const fuel = fuelRes.data ?? [];
  const notes = (notesRes.data ?? []).filter((n) => {
    const d = (n.delivery_date as string) || '';
    return d ? dateInRange(d.slice(0, 10), from, to) : false;
  });

  const hseDocs = (docsRes.error ? [] : docsRes.data ?? []).filter((row) => {
    const doc = row.documents as { created_at?: string } | null;
    const created = doc?.created_at ?? (row.created_at as string);
    if (!created) return false;
    if (!timestampInRange(created, from, to)) return false;
    const t = (row.doc_type as string) || '';
    return t === 'safety_sheet' || t === 'site_photo';
  });

  const sections: ReportSection[] = [];

  const orgLine = input.orgName ? `Organisation : ${input.orgName}` : '';
  sections.push({
    heading: 'Identification',
    lines: [
      orgLine,
      `Chantier : ${siteName}`,
      (site.location as string) ? `Localisation : ${site.location}` : '',
      `Statut : ${siteStatusLabel(site.status as string)}`,
      `Période : ${labelFr}`,
    ].filter(Boolean),
  });

  const physStart =
    daily.length > 0
      ? Number(daily[0].physical_pct ?? site.physical_progress ?? 0)
      : Number(site.physical_progress ?? 0);
  const physEnd =
    daily.length > 0
      ? Number(daily[daily.length - 1].physical_pct ?? site.physical_progress ?? 0)
      : Number(site.physical_progress ?? 0);
  const budget = Number(site.budget ?? 0);
  const spent = Number(site.spent ?? 0);

  sections.push({
    heading: 'Synthèse de la semaine',
    lines: [
      `Avancement physique : ${Math.round(physStart)} % → ${Math.round(physEnd)} % (${physEnd >= physStart ? '+' : ''}${Math.round(physEnd - physStart)} pt)`,
      `Avancement financier (chantier) : ${Math.round(Number(site.financial_progress ?? 0))} %`,
      `Retard cumulé : ${Number(site.delay_days ?? 0)} jour(s)`,
      `Budget : ${formatCurrencyGnf(budget)} — dépensé ${formatCurrencyGnf(spent)} — reste ${formatCurrencyGnf(Math.max(0, budget - spent))}`,
      `${daily.length} fiche(s) journalière(s) enregistrée(s) sur la période.`,
    ],
  });

  if (daily.length === 0) {
    sections.push({
      heading: 'Fiches journalières',
      lines: [
        'Aucune saisie quotidienne sur cette semaine.',
        'Rappel : enregistrez chaque jour dans BTP → Avancement (travaux, effectifs, notes).',
      ],
    });
  } else {
    const dailyLines = daily.map((d) => {
      const date = new Date(`${d.progress_date as string}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      const workers =
        d.workers_count != null ? ` — ${d.workers_count} ouvrier(s)` : '';
      const weather = (d.weather as string) ? ` — ${d.weather}` : '';
      const note = (d.notes as string)?.trim() || '—';
      return `• ${date} : ${Math.round(Number(d.physical_pct ?? 0))} %${workers}${weather}\n  ${note}`;
    });
    sections.push({ heading: 'Fiches journalières (compilation)', lines: dailyLines });

    const workersVals = daily
      .map((d) => d.workers_count)
      .filter((w): w is number => w != null && !Number.isNaN(Number(w)));
    if (workersVals.length > 0) {
      const avg = Math.round(workersVals.reduce((a, b) => a + b, 0) / workersVals.length);
      sections.push({
        heading: 'Effectif moyen',
        lines: [`${avg} ouvrier(s) / jour (moyenne sur ${workersVals.length} saisie(s)).`],
      });
    }
  }

  const totalL = fuel.reduce((s, l) => s + Number(l.liters ?? 0), 0);
  const totalFuelCost = fuel.reduce((s, l) => s + Number(l.cost ?? 0), 0);
  const anomalies = fuel.filter((l) => l.is_anomaly).length;
  sections.push({
    heading: 'Carburant',
    lines:
      fuel.length === 0
        ? ['Aucun relevé carburant sur la période.']
        : [
            `Total : ${totalL.toLocaleString('fr-FR')} L — ${formatCurrencyGnf(totalFuelCost)}`,
            `Relevés : ${fuel.length} — Anomalies : ${anomalies}`,
            ...fuel.slice(0, 10).map((l) => {
              const d = new Date(l.logged_at as string).toLocaleDateString('fr-FR');
              return `• ${d} : ${Number(l.liters ?? 0).toLocaleString('fr-FR')} L${l.is_anomaly ? ' ⚠' : ''}`;
            }),
          ],
  });

  const blTotal = notes.reduce((s, n) => s + Number(n.total_amount ?? 0), 0);
  sections.push({
    heading: 'Bons de livraison',
    lines:
      notes.length === 0
        ? ['Aucun bon de livraison sur la période.']
        : [
            `${notes.length} bon(s) — total ${formatCurrencyGnf(blTotal)}`,
            ...notes.map((n) => {
              const d = n.delivery_date
                ? new Date(n.delivery_date as string).toLocaleDateString('fr-FR')
                : '—';
              return `• ${n.reference} — ${n.supplier ?? '—'} — ${formatCurrencyGnf(Number(n.total_amount ?? 0))} (${d})`;
            }),
          ],
  });

  const hseFromNotes = daily
    .map((d) => (d.notes as string) || '')
    .filter((n) => /incident|hse|sécurit|securit|accident|bless/i.test(n));
  const hseMentions = hseFromNotes.length;

  sections.push({
    heading: 'HSE & pièces jointes',
    lines: [
      hseMentions > 0
        ? `${hseMentions} mention(s) sécurité / incident dans les fiches journalières.`
        : 'Aucune mention incident dans les fiches journalières.',
      hseDocs.length > 0
        ? `Documents déposés : ${hseDocs.length} (HSE / photos).`
        : 'Aucun document HSE ou photo déposé sur la période.',
      ...hseFromNotes.slice(0, 3).map((n, i) => `  ${i + 1}. ${n.slice(0, 200)}${n.length > 200 ? '…' : ''}`),
    ],
  });

  if (input.weeklyComment?.trim()) {
    sections.push({
      heading: 'Commentaire chef de chantier / direction',
      lines: [input.weeklyComment.trim()],
    });
  }

  sections.push({
    heading: 'Prochaine étape',
    lines: [
      'Chef de chantier : compléter les fiches journalières manquantes.',
      'Directeur : valider ce rapport, archiver et transmettre au MOA / client.',
      'Modèle papier de référence : docs/btp/modeles/rapport-chantier-hebdomadaire.html',
    ],
  });

  const report = renderOfflineReport({
    title,
    subtitle,
    sections,
    modeLabel: 'Compilation automatique — fiches journalières + carburant + BL',
  });

  return {
    title,
    subtitle,
    scopeLabel: siteName,
    isoWeek: input.isoWeek,
    periodFrom: from,
    periodTo: to,
    sections,
    report,
    stats: {
      dailyEntries: daily.length,
      fuelLogs: fuel.length,
      deliveryNotes: notes.length,
      hseMentions,
    },
  };
}
