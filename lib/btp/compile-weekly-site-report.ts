import { createClient } from '@/lib/supabase/server';
import { renderOfflineReport, formatCurrencyGnf, type ReportSection } from '@/lib/ai/reports/render-report';
import { siteStatusLabel } from '@/lib/sector/status-labels';
import {
  dateInRange,
  timestampInRange,
} from '@/lib/btp/week-period';
import type { WeeklyReportExportStructured } from '@/lib/btp/weekly-report-export-types';
import { resolveReportPeriod, type ReportPeriodType } from '@/lib/btp/report-period';
import {
  buildWeeklyComparisonMetrics,
  mapSiteRowToBaseline,
} from '@/lib/btp/site-baseline';
import type { BtpSiteMilestoneRow, PlanningRefSlot } from '@/lib/btp/site-baseline-types';
import { kpiStatusLabel } from '@/lib/btp/site-baseline';
import { sumLaborEntryAmount, type ExpenseCategory } from '@/lib/btp/site-financial';

export const BTP_WEEKLY_SITE_REPORT_TYPE = 'weekly_site';
export const BTP_WEEKLY_SITE_REPORT_LABEL = 'Rapport de chantier périodique';

export interface BtpWeeklyCompileInput {
  orgId: string;
  siteId: string;
  periodType?: ReportPeriodType;
  periodValue?: string;
  weeklyComment?: string | null;
  orgName?: string | null;
  planningRefSlot?: 1 | 2;
}

export interface BtpWeeklyCompileResult {
  title: string;
  subtitle: string;
  scopeLabel: string;
  periodType: ReportPeriodType;
  periodValue: string;
  periodLabel: string;
  isoWeek: string;
  periodFrom: string;
  periodTo: string;
  sections: ReportSection[];
  structured: WeeklyReportExportStructured;
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
  const resolvedPeriod = resolveReportPeriod(input.periodType ?? 'week', input.periodValue);
  const { from, to, periodLabel } = resolvedPeriod;
  const supabase = await createClient();

  const { data: site, error: siteErr } = await supabase
    .from('btp_sites')
    .select(
      'id, name, location, client, contract_ref, budget, spent, status, physical_progress, financial_progress, delay_days, start_date, end_date, description, moa_recipient, planned_avg_workers, planned_monthly_fuel_liters, budget_alert_pct, budget_breakdown'
    )
    .eq('organization_id', input.orgId)
    .eq('id', input.siteId)
    .maybeSingle();

  if (siteErr) throw new Error(siteErr.message);
  if (!site?.id) throw new Error('Chantier introuvable.');

  const milestonesRes = await supabase
    .from('btp_site_milestones')
    .select('id, label, target_physical_pct, planned_date, sort_order')
    .eq('organization_id', input.orgId)
    .eq('site_id', input.siteId)
    .order('sort_order', { ascending: true });

  const scheduleRes = await supabase
    .from('btp_site_planning_refs')
    .select('*')
    .eq('organization_id', input.orgId)
    .eq('site_id', input.siteId)
    .eq('slot', input.planningRefSlot ?? 1)
    .maybeSingle();

  const planningRefSlot: PlanningRefSlot = input.planningRefSlot === 2 ? 2 : 1;
  const planningRefRow = scheduleRes.data;

  const milestoneRows: BtpSiteMilestoneRow[] = milestonesRes.error
    ? []
    : (milestonesRes.data ?? []).map((m) => ({
    id: m.id as string,
    label: m.label as string,
    targetPhysicalPct: Number(m.target_physical_pct),
    plannedDate: (m.planned_date as string).slice(0, 10),
    sortOrder: Number(m.sort_order ?? 0),
  }));

  const baseline = mapSiteRowToBaseline(site as Record<string, unknown>, milestoneRows);
  const resolvedRef = planningRefRow
    ? resolvePlanningRef(baseline, mapPlanningRefRow(planningRefRow))
    : resolvePlanningRef(baseline, {
        id: '',
        siteId: input.siteId,
        slot: planningRefSlot,
        label: 'Référence linéaire',
        sourceType: 'linear',
        startDate: baseline.startDate,
        endDate: baseline.endDate,
        milestones: milestoneRows.map((m) => ({
          label: m.label,
          targetPhysicalPct: m.targetPhysicalPct,
          plannedDate: m.plannedDate,
          sortOrder: m.sortOrder,
        })),
        tasks: [],
        sourceFilename: null,
        projectTitle: null,
        updatedAt: new Date().toISOString(),
      });

  const siteName = site.name as string;
  const periodTypeLabel: Record<ReportPeriodType, string> = {
    week: 'hebdomadaire',
    month: 'mensuel',
    quarter: 'trimestriel',
    year: 'annuel',
  };
  const title = `Rapport de chantier ${periodTypeLabel[resolvedPeriod.periodType]} — ${siteName}`;
  const subtitle = periodLabel;

  const [dailyRes, fuelRes, notesRes, docsRes, allDailyRes, allFuelRes, allNotesRes, laborRes, expensesRes] =
    await Promise.all([
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
    supabase
      .from('btp_daily_progress')
      .select('progress_date, physical_pct, workers_count')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId)
      .order('progress_date', { ascending: true }),
    supabase
      .from('btp_fuel_logs')
      .select('cost, logged_at')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId)
      .lte('logged_at', `${to}T23:59:59`),
    supabase
      .from('btp_delivery_notes')
      .select('total_amount, delivery_date')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId),
    supabase
      .from('btp_labor_entries')
      .select('days, daily_rate, work_date')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId)
      .lte('work_date', to),
    supabase
      .from('btp_site_expenses')
      .select('category, amount, expense_date')
      .eq('organization_id', input.orgId)
      .eq('site_id', input.siteId)
      .lte('expense_date', to),
  ]);

  if (dailyRes.error) throw new Error(dailyRes.error.message);
  if (fuelRes.error) throw new Error(fuelRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);

  const daily = dailyRes.data ?? [];
  const fuel = fuelRes.data ?? [];
  const allDaily = allDailyRes.data ?? [];
  const allFuel = allFuelRes.data ?? [];
  const allNotesRaw = allNotesRes.data ?? [];
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

  const physStart =
    daily.length > 0
      ? Number(daily[0].physical_pct ?? site.physical_progress ?? 0)
      : Number(site.physical_progress ?? 0);
  const physEnd =
    daily.length > 0
      ? Number(daily[daily.length - 1].physical_pct ?? site.physical_progress ?? 0)
      : Number(site.physical_progress ?? 0);
  const budget = Number(site.budget ?? 0);

  const workersValsWeek = daily
    .map((d) => d.workers_count)
    .filter((w): w is number => w != null && !Number.isNaN(Number(w)));
  const avgWorkersWeek =
    workersValsWeek.length > 0
      ? Math.round(workersValsWeek.reduce((a, b) => a + Number(b), 0) / workersValsWeek.length)
      : null;

  const fuelCostToDate = allFuel.reduce((s, l) => s + Number(l.cost ?? 0), 0);
  const deliveryToDate = allNotesRaw
    .filter((n) => {
      const d = (n.delivery_date as string) || '';
      return d ? d.slice(0, 10) <= to : false;
    })
    .reduce((s, n) => s + Number(n.total_amount ?? 0), 0);

  const laborToDate = (laborRes.data ?? []).reduce(
    (s, r) => s + sumLaborEntryAmount(Number(r.days), Number(r.daily_rate)),
    0
  );
  const expensesByCategory: Partial<Record<ExpenseCategory, number>> = {};
  for (const e of expensesRes.data ?? []) {
    const cat = e.category as ExpenseCategory;
    expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + Number(e.amount ?? 0);
  }

  const comparison = buildWeeklyComparisonMetrics({
    siteBaseline: baseline,
    resolvedRef,
    asOfDate: to,
    periodFrom: from,
    periodTo: to,
    actualPhysicalPct: Math.round(physEnd),
    dailyProgressInWeek: daily.map((d) => ({
      date: (d.progress_date as string).slice(0, 10),
      physicalPct: Math.round(Number(d.physical_pct ?? 0)),
    })),
    dailyProgressAll: allDaily.map((d) => ({
      date: (d.progress_date as string).slice(0, 10),
      physicalPct: Math.round(Number(d.physical_pct ?? 0)),
    })),
    fuelCostToDate,
    deliveryAmountToDate: deliveryToDate,
    laborAmountToDate: laborToDate,
    expensesByCategory,
    fuelLitersWeek: fuel.reduce((s, l) => s + Number(l.liters ?? 0), 0),
    avgWorkersWeek,
    delayDays: Number(site.delay_days ?? 0),
  });

  const spent = comparison.budgetConsumedCumulative;
  const financialPct =
    comparison.financialPctAuto ?? Math.round(Number(site.financial_progress ?? 0));

  sections.push({
    heading: 'Identification',
    lines: [
      orgLine,
      baseline.client ? `Client / MOA : ${baseline.client}` : '',
      baseline.contractRef ? `N° contrat : ${baseline.contractRef}` : '',
      `Chantier : ${siteName}`,
      (site.location as string) ? `Localisation : ${site.location}` : '',
      `Statut : ${siteStatusLabel(site.status as string)}`,
      baseline.startDate && baseline.endDate
        ? `Planning : ${baseline.startDate} → ${baseline.endDate}`
        : '',
      `Période rapport : ${periodLabel}`,
    ].filter(Boolean),
  });

  const comparisonLines: string[] = [];
  comparisonLines.push(
    `Référence comparative : ${comparison.plannedRefLabel} (${comparison.plannedSource === 'ms_project' ? 'MS Project' : comparison.plannedSource === 'milestones' ? 'Jalons' : 'Dates contractuelles'}).`
  );
  if (comparison.plannedPhysicalPct != null) {
    comparisonLines.push(
      `Avancement planifié (réf.) : ${comparison.plannedPhysicalPct} % — réalisé : ${comparison.actualPhysicalPct} % (écart ${comparison.physicalGapPts! >= 0 ? '+' : ''}${comparison.physicalGapPts} pt)`
    );
  }
  if (comparison.timeElapsedPct != null) {
    comparisonLines.push(
      `Temps écoulé : ${comparison.timeElapsedPct} % — travaux : ${comparison.actualPhysicalPct} % (écart ${comparison.timeVsPhysicalGapPts! >= 0 ? '+' : ''}${comparison.timeVsPhysicalGapPts} pt)`
    );
  }
  if (comparison.budgetPlannedCumulative != null && budget > 0) {
    comparisonLines.push(
      `Budget planifié cumulé : ${formatCurrencyGnf(comparison.budgetPlannedCumulative)} — consommé : ${formatCurrencyGnf(comparison.budgetConsumedCumulative)} (écart ${comparison.budgetGapAmount! >= 0 ? '+' : ''}${formatCurrencyGnf(comparison.budgetGapAmount ?? 0)})`
    );
    comparisonLines.push(
      `Exécution financière : ${comparison.budgetExecutionPct} % — écart physique/financier : ${comparison.physicalVsFinancialGapPts! >= 0 ? '+' : ''}${comparison.physicalVsFinancialGapPts} pt`
    );
  }
  comparisonLines.push(
    `KPI synthèse : Planning ${kpiStatusLabel(comparison.kpis.planning)} · Budget ${kpiStatusLabel(comparison.kpis.budget)} · Délais ${kpiStatusLabel(comparison.kpis.schedule)} · Global ${kpiStatusLabel(comparison.kpis.overall)}`
  );
  if (comparison.milestoneRows.length > 0) {
    comparisonLines.push('Jalons :');
    for (const m of comparison.milestoneRows) {
      const actual = m.actualDate
        ? `atteint le ${m.actualDate} (${m.actualPhysicalPct} %)`
        : 'non atteint';
      const gap =
        m.gapDays != null
          ? m.gapDays === 0
            ? ' (à jour)'
            : m.gapDays > 0
              ? ` (+${m.gapDays} j)`
              : ` (${m.gapDays} j)`
          : '';
      comparisonLines.push(
        `• ${m.label} — prévu ${m.plannedDate} (${m.targetPhysicalPct} %) — ${actual}${gap}`
      );
    }
  }
  if (comparison.posteComparison.length > 0) {
    comparisonLines.push('Ventilation budgétaire (prévu vs réel) :');
    for (const p of comparison.posteComparison) {
      comparisonLines.push(
        `• ${p.label} — prévu ${formatCurrencyGnf(p.plannedAmount)} — réel ${formatCurrencyGnf(p.actualAmount)}${p.gapAmount !== 0 ? ` (écart ${p.gapAmount >= 0 ? '+' : ''}${formatCurrencyGnf(p.gapAmount)})` : ''}`
      );
    }
  }
  if (comparisonLines.length > 0) {
    sections.push({ heading: 'Analyse planifié vs réel', lines: comparisonLines });
  }

  sections.push({
    heading: 'Synthèse de la période',
    lines: [
      `Avancement physique : ${Math.round(physStart)} % → ${Math.round(physEnd)} % (${physEnd >= physStart ? '+' : ''}${Math.round(physEnd - physStart)} pt)`,
      `Avancement financier (calculé) : ${financialPct} %`,
      `Retard cumulé : ${Number(site.delay_days ?? 0)} jour(s)`,
      `Budget : ${formatCurrencyGnf(budget)} — dépensé (cumul) ${formatCurrencyGnf(spent)} — reste ${formatCurrencyGnf(Math.max(0, budget - spent))}`,
      `${daily.length} fiche(s) journalière(s) enregistrée(s) sur la période.`,
    ],
  });

  if (daily.length === 0) {
    sections.push({
      heading: 'Fiches journalières',
      lines: [
        'Aucune saisie quotidienne sur cette période.',
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

  const dailyRows = daily.map((d) => {
    const dateLabel = new Date(`${d.progress_date as string}T12:00:00Z`).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return {
      dateLabel,
      progressPct: Math.round(Number(d.physical_pct ?? 0)),
      workers: d.workers_count != null ? Number(d.workers_count) : null,
      weather: (d.weather as string) || null,
      notes: (d.notes as string)?.trim() || '—',
    };
  });

  const workersVals = daily
    .map((d) => d.workers_count)
    .filter((w): w is number => w != null && !Number.isNaN(Number(w)));
  const avgWorkers =
    workersVals.length > 0
      ? Math.round(workersVals.reduce((a, b) => a + Number(b), 0) / workersVals.length)
      : null;

  const structured: WeeklyReportExportStructured = {
    identification: {
      chantier: siteName,
      localisation: (site.location as string) || null,
      statut: siteStatusLabel(site.status as string),
      periode: periodLabel,
      client: baseline.client,
      contractRef: baseline.contractRef,
      moaRecipient: baseline.moaRecipient,
      planningStart: baseline.startDate,
      planningEnd: baseline.endDate,
    },
    synthesis: {
      physicalStart: Math.round(physStart),
      physicalEnd: Math.round(physEnd),
      financialPct,
      delayDays: Number(site.delay_days ?? 0),
      budget,
      spent,
      dailyCount: daily.length,
    },
    comparison,
    budgetBreakdown: baseline.budgetBreakdown,
    dailyRows,
    avgWorkers,
    fuel: {
      totalLiters: totalL,
      totalCost: totalFuelCost,
      count: fuel.length,
      anomalies,
      rows: fuel.map((l) => ({
        dateLabel: new Date(l.logged_at as string).toLocaleDateString('fr-FR'),
        liters: Number(l.liters ?? 0),
        isAnomaly: Boolean(l.is_anomaly),
      })),
    },
    deliveries: {
      count: notes.length,
      totalAmount: blTotal,
      rows: notes.map((n) => ({
        reference: n.reference as string,
        supplier: (n.supplier as string) ?? '—',
        amount: Number(n.total_amount ?? 0),
        dateLabel: n.delivery_date
          ? new Date(n.delivery_date as string).toLocaleDateString('fr-FR')
          : '—',
      })),
    },
    hse: {
      mentions: hseMentions,
      docsCount: hseDocs.length,
      noteSnippets: hseFromNotes.slice(0, 3).map((n) =>
        n.length > 200 ? `${n.slice(0, 200)}…` : n
      ),
    },
    comment: input.weeklyComment?.trim() || null,
  };

  return {
    title,
    subtitle,
    scopeLabel: siteName,
    periodType: resolvedPeriod.periodType,
    periodValue: resolvedPeriod.periodValue,
    periodLabel,
    isoWeek: resolvedPeriod.periodType === 'week' ? resolvedPeriod.periodValue : '',
    periodFrom: from,
    periodTo: to,
    sections,
    structured,
    report,
    stats: {
      dailyEntries: daily.length,
      fuelLogs: fuel.length,
      deliveryNotes: notes.length,
      hseMentions,
    },
  };
}
