import 'server-only';

import PptxGenJS from 'pptxgenjs';
import type {
  WeeklyReportExportPayload,
  WeeklyReportImage,
} from '@/lib/btp/weekly-report-export-types';
import {
  displayOrgName,
  formatReportGeneratedAt,
  UPCOMING_EVENT_LABELS,
} from '@/lib/btp/weekly-report-export-types';
import { formatCurrency } from '@/lib/utils';
import { kpiStatusLabel } from '@/lib/btp/site-baseline';
import {
  comparisonMetricsTableRows,
  fitImage,
  milestoneTableRows,
  summaryCards,
} from '@/lib/btp/weekly-report-export-render';

const STATUS_HEX: Record<string, string> = {
  green: '10B981',
  amber: 'F59E0B',
  red: 'EF4444',
  neutral: '94A3B8',
};

const TASKS_PER_CHART_SLIDE = 14;
const PHOTOS_PER_SLIDE = 2;
const UPCOMING_PER_SLIDE = 10;

function imageData(img: WeeklyReportImage): string {
  return `image/${img.format === 'JPEG' ? 'jpeg' : 'png'};base64,${img.base64}`;
}

function frDate(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

const COLORS = {
  bg: 'F8FAFC',
  dark: '0A192F',
  primary: '2563EB',
  accent: '22D3EE',
  teal: '2DD4BF',
  text: '334155',
  muted: '64748B',
  headerBar: '1E3A8A',
  tableHead: 'EFF6FF',
};

type PptxSlide = ReturnType<PptxGenJS['addSlide']>;

interface HeaderContext {
  orgName: string;
  scopeLabel: string;
  periodLabel: string;
  logo: WeeklyReportImage | null;
}

const HEADER_LOGO_MAX_W = 1.05;
const HEADER_LOGO_MAX_H = 0.6;
const HEADER_TEXT_X = 5.35;
const HERO_LOGO_MAX_W = 3;
const HERO_LOGO_MAX_H = 1.1;

/** Logo sans cadre, ajusté (ratio conservé) dans la zone maxW × maxH ; retourne la largeur occupée. */
function addLogo(
  slide: PptxSlide,
  logo: WeeklyReportImage,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  align: 'left' | 'center' | 'right' = 'left'
): number {
  const fit = fitImage(logo.width, logo.height, maxW, maxH);
  const dx = align === 'right' ? maxW - fit.w : align === 'center' ? fit.dx : 0;
  slide.addImage({
    data: imageData(logo),
    x: x + dx,
    y: y + fit.dy,
    w: fit.w,
    h: fit.h,
  });
  return fit.w;
}

function drawHeaderBar(slide: PptxSlide, title: string, ctx: HeaderContext) {
  const logoW = ctx.logo
    ? fitImage(ctx.logo.width, ctx.logo.height, HEADER_LOGO_MAX_W, HEADER_LOGO_MAX_H).w
    : 0;
  const textRight = logoW > 0 ? 9.75 - logoW - 0.15 : 9.7;
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 10,
    h: 0.82,
    fill: { color: COLORS.headerBar },
  });
  slide.addShape('rect', {
    x: 0,
    y: 0.82,
    w: 10,
    h: 0.04,
    fill: { color: COLORS.primary },
  });
  slide.addText(title, {
    x: 0.35,
    y: 0.14,
    w: HEADER_TEXT_X - 0.45,
    h: 0.52,
    fontSize: 18,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Segoe UI',
    fit: 'shrink',
  });
  slide.addText(
    [
      {
        text: ctx.orgName.toUpperCase(),
        options: { bold: true, fontSize: 9, color: 'FFFFFF', breakLine: true },
      },
      {
        text: `${ctx.scopeLabel} · ${ctx.periodLabel}`,
        options: { fontSize: 8, color: 'CBD5E1' },
      },
    ],
    {
      x: HEADER_TEXT_X,
      y: 0.1,
      w: textRight - HEADER_TEXT_X,
      h: 0.62,
      align: 'right',
      valign: 'middle',
      fontFace: 'Segoe UI',
      fit: 'shrink',
    }
  );
  if (ctx.logo) {
    addLogo(
      slide,
      ctx.logo,
      9.75 - HEADER_LOGO_MAX_W,
      0.11,
      HEADER_LOGO_MAX_W,
      HEADER_LOGO_MAX_H,
      'right'
    );
  }
  slide.slideNumber = { x: 9.25, y: 5.3, w: 0.5, h: 0.25, fontSize: 9, color: '94A3B8', align: 'right' };
}

function tableHeaderCell(text: string) {
  return {
    text,
    options: {
      bold: true,
      color: COLORS.primary,
      fill: { color: COLORS.tableHead },
      fontSize: 11,
      fontFace: 'Segoe UI',
    },
  };
}

function tableCell(text: string) {
  return {
    text,
    options: { fontSize: 10, color: COLORS.text, fontFace: 'Segoe UI' },
  };
}

function addKeyValueTable(
  slide: PptxSlide,
  rows: [string, string][],
  y = 1.05
) {
  slide.addTable(
    [
      [tableHeaderCell('Champ'), tableHeaderCell('Valeur')],
      ...rows.map(([k, v]) => [tableCell(k), tableCell(v)]),
    ],
    {
      x: 0.45,
      y,
      w: 9.1,
      colW: [2.4, 6.7],
      border: { type: 'solid', color: 'E2E8F0', pt: 0.75 },
      fontSize: 10,
    }
  );
}

function fmtGnf(amount: number): string {
  return formatCurrency(amount);
}

export async function buildWeeklyReportPptxBuffer(
  payload: WeeklyReportExportPayload
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const orgName = displayOrgName(payload.orgName);
  const { structured: s } = payload;
  const generatedAt = `Généré le ${formatReportGeneratedAt(payload.generatedAt)}`;

  pptx.author = orgName;
  pptx.title = payload.title;
  pptx.subject = `Rapport périodique — ${payload.scopeLabel}`;
  pptx.layout = 'LAYOUT_16x9';

  const headerCtx: HeaderContext = {
    orgName,
    scopeLabel: payload.scopeLabel,
    periodLabel: payload.periodLabel,
    logo: s.logo ?? null,
  };
  const addHeaderBar = (slide: PptxSlide, title: string) => drawHeaderBar(slide, title, headerCtx);
  const logoOffset = s.logo ? 0.6 : 0;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: COLORS.dark };
  titleSlide.addShape('rect', {
    x: 0,
    y: 4.55,
    w: 10,
    h: 0.1,
    fill: { color: COLORS.primary },
  });
  if (s.logo) {
    addLogo(titleSlide, s.logo, 5 - HERO_LOGO_MAX_W / 2, 0.2, HERO_LOGO_MAX_W, HERO_LOGO_MAX_H, 'center');
  }
  titleSlide.addText(orgName.toUpperCase(), {
    x: 0.45,
    y: 0.65 + logoOffset + 0.1,
    w: 9.1,
    h: 0.75,
    fontSize: 26,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText('Rapport de chantier périodique', {
    x: 0.45,
    y: 1.45 + logoOffset,
    w: 9.1,
    h: 0.4,
    fontSize: 14,
    color: COLORS.accent,
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(payload.scopeLabel, {
    x: 0.45,
    y: 2.05 + logoOffset,
    w: 9.1,
    h: 0.55,
    fontSize: 22,
    bold: true,
    color: COLORS.teal,
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(payload.subtitle, {
    x: 0.45,
    y: 2.75 + logoOffset,
    w: 9.1,
    h: 0.45,
    fontSize: 13,
    color: 'CBD5E1',
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(`${payload.periodLabel} · ${generatedAt}`, {
    x: 0.45,
    y: 4.85,
    w: 9.1,
    h: 0.35,
    fontSize: 10,
    color: '94A3B8',
    align: 'center',
    fontFace: 'Segoe UI',
  });

  const summarySlide = pptx.addSlide();
  summarySlide.background = { color: COLORS.bg };
  addHeaderBar(summarySlide, 'Résumé');
  summaryCards(s).forEach((card, i) => {
    const x = 0.45 + (i % 2) * 4.65;
    const y = 1.15 + Math.floor(i / 2) * 2.1;
    const color = STATUS_HEX[card.status] ?? STATUS_HEX.neutral;
    summarySlide.addShape('roundRect', {
      x,
      y,
      w: 4.45,
      h: 1.85,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 },
      rectRadius: 0.08,
    });
    summarySlide.addShape('rect', { x, y, w: 4.45, h: 0.09, fill: { color } });
    summarySlide.addText(card.label.toUpperCase(), {
      x: x + 0.25,
      y: y + 0.2,
      w: 4,
      h: 0.35,
      fontSize: 11,
      color: COLORS.muted,
      fontFace: 'Segoe UI',
    });
    summarySlide.addText(card.value, {
      x: x + 0.25,
      y: y + 0.55,
      w: 4,
      h: 0.7,
      fontSize: card.value.length > 12 ? 22 : 30,
      bold: true,
      color,
      fontFace: 'Segoe UI',
    });
    summarySlide.addText(card.sub, {
      x: x + 0.25,
      y: y + 1.25,
      w: 4,
      h: 0.45,
      fontSize: 11,
      color: COLORS.text,
      fontFace: 'Segoe UI',
    });
  });

  const idSlide = pptx.addSlide();
  idSlide.background = { color: COLORS.bg };
  addHeaderBar(idSlide, 'Identification');
  addKeyValueTable(idSlide, [
    ['Organisation', orgName],
    ['Chantier', s.identification.chantier],
    ['Client / MOA', s.identification.client ?? '—'],
    ['N° contrat', s.identification.contractRef ?? '—'],
    ['Localisation', s.identification.localisation ?? '—'],
    ['Statut', s.identification.statut],
    [
      'Planning',
      s.identification.planningStart && s.identification.planningEnd
        ? `${s.identification.planningStart} → ${s.identification.planningEnd}`
        : '—',
    ],
    ['Période rapport', s.identification.periode],
  ]);

  const cmp = s.comparison;
  if (cmp) {
    const cmpSlide = pptx.addSlide();
    cmpSlide.background = { color: COLORS.bg };
    addHeaderBar(cmpSlide, 'Analyse planifié vs réel');
    cmpSlide.addText(
      s.hideFinancials
        ? `Planning : ${kpiStatusLabel(cmp.kpis.planning)}  ·  Délais : ${kpiStatusLabel(cmp.kpis.schedule)}  ·  Global : ${kpiStatusLabel(cmp.kpis.overall)}`
        : `Planning : ${kpiStatusLabel(cmp.kpis.planning)}  ·  Budget : ${kpiStatusLabel(cmp.kpis.budget)}  ·  Délais : ${kpiStatusLabel(cmp.kpis.schedule)}  ·  Global : ${kpiStatusLabel(cmp.kpis.overall)}`,
      {
        x: 0.45,
        y: 0.95,
        w: 9.1,
        h: 0.4,
        fontSize: 11,
        bold: true,
        color: COLORS.text,
        fontFace: 'Segoe UI',
      }
    );
    const metricRows = comparisonMetricsTableRows(cmp);
    if (metricRows.length > 1) {
      cmpSlide.addTable(
        [
          metricRows[0].map((h) => tableHeaderCell(h)),
          ...metricRows.slice(1).map((row) => row.map((c) => tableCell(c))),
        ],
        {
          x: 0.35,
          y: 1.35,
          w: 9.3,
          colW: [2.2, 2.3, 2.3, 2.5],
          fontSize: 9,
          border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
        }
      );
    }
    const mRows = (cmp.taskRows ?? []).length > 0 ? [] : milestoneTableRows(cmp);
    if (mRows.length > 0) {
      cmpSlide.addTable(
        [
          mRows[0].map((h) => tableHeaderCell(h)),
          ...mRows.slice(1).map((row) => row.map((c) => tableCell(c))),
        ],
        {
          x: 0.35,
          y: 3.55,
          w: 9.3,
          colW: [2, 1.5, 1.2, 2.8, 1.8],
          fontSize: 8,
          border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
        }
      );
    }
  }

  const taskRows = cmp?.taskRows ?? [];
  for (let i = 0; i < taskRows.length; i += TASKS_PER_CHART_SLIDE) {
    const chunk = taskRows.slice(i, i + TASKS_PER_CHART_SLIDE);
    const taskSlide = pptx.addSlide();
    taskSlide.background = { color: COLORS.bg };
    addHeaderBar(
      taskSlide,
      taskRows.length > TASKS_PER_CHART_SLIDE
        ? `Avancement par tâche (${Math.floor(i / TASKS_PER_CHART_SLIDE) + 1})`
        : 'Avancement par tâche'
    );
    // Les barres horizontales se dessinent de bas en haut : on inverse pour lire la 1re tâche en haut.
    const ordered = [...chunk].reverse();
    const labels = ordered.map((t) => (t.name.length > 34 ? `${t.name.slice(0, 32)}…` : t.name));
    taskSlide.addChart(
      pptx.ChartType.bar,
      [
        { name: 'Prévu', labels, values: ordered.map((t) => t.plannedPct) },
        { name: 'Réalisé', labels, values: ordered.map((t) => t.actualPct ?? 0) },
      ],
      {
        x: 0.35,
        y: 1.0,
        w: 9.3,
        h: 4.3,
        barDir: 'bar',
        barGrouping: 'clustered',
        valAxisMaxVal: 100,
        valAxisMinVal: 0,
        chartColors: ['CBD5E1', COLORS.primary],
        showLegend: true,
        legendPos: 'b',
        showValue: true,
        dataLabelFontSize: 8,
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 8,
      }
    );
  }

  const compareChartSlide = cmp ? pptx.addSlide() : null;
  if (compareChartSlide && cmp) {
    compareChartSlide.background = { color: COLORS.bg };
    addHeaderBar(compareChartSlide, s.hideFinancials ? 'Comparaisons — courbes' : 'Comparaisons — courbes & budget');
    if (cmp.timeElapsedPct != null) {
      compareChartSlide.addChart(
        pptx.ChartType.bar,
        [
          {
            name: '%',
            labels: ['Temps écoulé', 'Travaux réalisés'],
            values: [cmp.timeElapsedPct, cmp.actualPhysicalPct],
          },
        ],
        {
          x: 0.45,
          y: 1.05,
          w: 4.2,
          h: 3.5,
          showTitle: true,
          title: 'Temps vs avancement',
          valAxisMaxVal: 100,
          chartColors: [COLORS.primary],
        }
      );
    }
    if (cmp.plannedPhysicalPct != null) {
      compareChartSlide.addChart(
        pptx.ChartType.bar,
        [
          {
            name: '%',
            labels: ['Planifié', 'Réalisé'],
            values: [cmp.plannedPhysicalPct, cmp.actualPhysicalPct],
          },
        ],
        {
          x: 5.15,
          y: 1.05,
          w: 4.4,
          h: 3.5,
          showTitle: true,
          title: 'Avancement physique',
          valAxisMaxVal: 100,
          chartColors: [COLORS.teal],
        }
      );
    }
    if (cmp.budgetPlannedCumulative != null && s.synthesis.budget > 0 && cmp.sCurve.length < 2 && cmp.progressCurve.length < 2) {
      compareChartSlide.addChart(
        pptx.ChartType.bar,
        [
          {
            name: 'GNF (millions)',
            labels: ['Planifié cumulé', 'Consommé cumulé'],
            values: [
              Math.round(cmp.budgetPlannedCumulative / 1_000_000),
              Math.round(cmp.budgetConsumedCumulative / 1_000_000),
            ],
          },
        ],
        {
          x: 0.55,
          y: 4.75,
          w: 8.9,
          h: 1.15,
          showTitle: true,
          title: 'Budget cumulé',
          chartColors: ['F59E0B'],
        }
      );
    }
    const curve =
      cmp.sCurve.length >= 2
        ? cmp.sCurve
        : cmp.progressCurve.length >= 2
          ? cmp.progressCurve
          : [];
    if (curve.length >= 2) {
      compareChartSlide.addChart(
        pptx.ChartType.line,
        [
          {
            name: 'Planifié',
            labels: curve.map((p) => p.label),
            values: curve.map((p) => p.plannedPct ?? 0),
          },
          {
            name: 'Réalisé',
            labels: curve.map((p) => p.label),
            values: curve.map((p) => (p.actualPct != null ? p.actualPct : '')),
          },
        ],
        {
          x: 0.55,
          y: 4.75,
          w: 8.9,
          h: 1.15,
          showTitle: true,
          title:
            cmp.sCurve.length >= 2
              ? 'Courbe S avancement planifié vs réalisé'
              : 'Avancement planifié vs réalisé (période)',
          valAxisMaxVal: 100,
        }
      );
    }
  }

  const upcoming = s.upcoming;
  const upcomingPages = upcoming
    ? Math.ceil(upcoming.tasks.length / UPCOMING_PER_SLIDE)
    : 0;
  for (let page = 0; upcoming && page < upcomingPages; page++) {
    const pageTasks = upcoming.tasks.slice(
      page * UPCOMING_PER_SLIDE,
      (page + 1) * UPCOMING_PER_SLIDE
    );
    const upcomingSlide = pptx.addSlide();
    upcomingSlide.background = { color: COLORS.bg };
    addHeaderBar(
      upcomingSlide,
      upcomingPages > 1 ? `Prévisions (${page + 1}/${upcomingPages})` : 'Prévisions'
    );
    upcomingSlide.addText(upcoming.label, {
      x: 0.35,
      y: 0.98,
      w: 9.3,
      h: 0.4,
      fontSize: 13,
      bold: true,
      color: COLORS.text,
      fontFace: 'Segoe UI',
    });
    upcomingSlide.addTable(
      [
        ['Tâche', 'Période', 'Événement', 'Prévu fin', 'Actuel'].map((h) => tableHeaderCell(h)),
        ...pageTasks.map((t) =>
          [
            t.name,
            `${frDate(t.startDate)} → ${frDate(t.finishDate)}`,
            UPCOMING_EVENT_LABELS[t.event],
            `${t.plannedPctAtEnd} %`,
            t.actualPct != null ? `${t.actualPct} %` : '—',
          ].map((c) => tableCell(c))
        ),
      ],
      {
        x: 0.35,
        y: 1.45,
        w: 9.3,
        colW: [3.3, 2.4, 1.4, 1.1, 1.1],
        fontSize: 9,
        border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
      }
    );
  }

  const kpiSlide = pptx.addSlide();
  kpiSlide.background = { color: COLORS.bg };
  addHeaderBar(kpiSlide, 'Tableau de bord');

  const kpis = [
    { label: 'Fiches journalières', value: String(payload.stats.dailyEntries), color: COLORS.primary },
    { label: 'Relevés carburant', value: String(payload.stats.fuelLogs), color: '0D9488' },
    { label: 'Bons de livraison', value: String(payload.stats.deliveryNotes), color: '7C3AED' },
    { label: 'Mentions HSE', value: String(payload.stats.hseMentions), color: 'B45309' },
  ];
  kpis.forEach((kpi, i) => {
    const x = 0.45 + (i % 2) * 4.75;
    const y = 1.15 + Math.floor(i / 2) * 2.05;
    kpiSlide.addShape('roundRect', {
      x,
      y,
      w: 4.35,
      h: 1.75,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 },
      rectRadius: 0.08,
    });
    kpiSlide.addText(kpi.value, {
      x,
      y: y + 0.35,
      w: 4.35,
      h: 0.7,
      fontSize: 36,
      bold: true,
      color: kpi.color,
      align: 'center',
      fontFace: 'Segoe UI',
    });
    kpiSlide.addText(kpi.label, {
      x,
      y: y + 1.1,
      w: 4.35,
      h: 0.45,
      fontSize: 11,
      color: COLORS.muted,
      align: 'center',
      fontFace: 'Segoe UI',
    });
  });

  const synthSlide = pptx.addSlide();
  synthSlide.background = { color: COLORS.bg };
  addHeaderBar(synthSlide, 'Synthèse de la période');
  const delta = s.synthesis.physicalEnd - s.synthesis.physicalStart;
  const sign = delta >= 0 ? '+' : '';
  const physicalRow: [string, string] = [
    'Avancement physique',
    `${s.synthesis.physicalStart} % → ${s.synthesis.physicalEnd} % (${sign}${Math.round(delta)} pt)`,
  ];
  const delayRow: [string, string] = ['Retard cumulé', `${s.synthesis.delayDays} jour(s)`];
  addKeyValueTable(
    synthSlide,
    s.hideFinancials
      ? [physicalRow, delayRow, ['Fiches journalières', `${s.synthesis.dailyCount} sur la période`]]
      : [
          physicalRow,
          ['Avancement financier', `${s.synthesis.financialPct} %`],
          delayRow,
          ['Budget', fmtGnf(s.synthesis.budget)],
          ['Dépensé', fmtGnf(s.synthesis.spent)],
          ['Reste', fmtGnf(Math.max(0, s.synthesis.budget - s.synthesis.spent))],
        ]
  );

  const chartSlide = pptx.addSlide();
  chartSlide.background = { color: COLORS.bg };
  addHeaderBar(chartSlide, 'Graphiques — avancement & activité');
  chartSlide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: 'Avancement (%)',
        labels: s.hideFinancials ? ['Début de période', 'Fin de période'] : ['Début de période', 'Fin de période', 'Financier'],
        values: s.hideFinancials
          ? [s.synthesis.physicalStart, s.synthesis.physicalEnd]
          : [s.synthesis.physicalStart, s.synthesis.physicalEnd, s.synthesis.financialPct],
      },
    ],
    {
      x: 0.45,
      y: 1.05,
      w: 4.3,
      h: 3.6,
      showTitle: true,
      title: 'Avancement chantier',
      showLegend: false,
      valAxisMaxVal: 100,
      chartColors: [COLORS.primary],
    }
  );
  chartSlide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: 'Activité',
        labels: ['Fiches', 'Carburant', 'Bons BL', 'HSE'],
        values: [
          payload.stats.dailyEntries,
          payload.stats.fuelLogs,
          payload.stats.deliveryNotes,
          payload.stats.hseMentions,
        ],
      },
    ],
    {
      x: 5.1,
      y: 1.05,
      w: 4.45,
      h: 3.6,
      showTitle: true,
      title: 'Sources compilées',
      showLegend: false,
      chartColors: ['0D9488'],
    }
  );

  if (s.dailyRows.length > 0) {
    const dailySlide = pptx.addSlide();
    dailySlide.background = { color: COLORS.bg };
    addHeaderBar(dailySlide, 'Fiches journalières');

    dailySlide.addTable(
      [
        [
          tableHeaderCell('Date'),
          tableHeaderCell('Avanc.'),
          tableHeaderCell('Eff.'),
          tableHeaderCell('Météo'),
          tableHeaderCell('Travaux / notes'),
        ],
        ...s.dailyRows.map((r) => [
          tableCell(r.dateLabel),
          tableCell(`${r.progressPct} %`),
          tableCell(r.workers != null ? String(r.workers) : '—'),
          tableCell(r.weather ?? '—'),
          tableCell(r.notes),
        ]),
      ],
      {
        x: 0.35,
        y: 1.0,
        w: 9.3,
        colW: [1.3, 0.8, 0.7, 1.1, 5.4],
        fontSize: 9,
        border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
      }
    );

    const progressSlide = pptx.addSlide();
    progressSlide.background = { color: COLORS.bg };
    addHeaderBar(progressSlide, 'Évolution avancement journalier');
    progressSlide.addChart(
      pptx.ChartType.line,
      [
        {
          name: 'Avancement %',
          labels: s.dailyRows.map((r) => r.dateLabel),
          values: s.dailyRows.map((r) => r.progressPct),
        },
      ],
      {
        x: 0.55,
        y: 1.1,
        w: 8.9,
        h: 4.1,
        showTitle: false,
        showLegend: false,
        chartColors: [COLORS.teal],
        valAxisMaxVal: 100,
      }
    );
    if (s.avgWorkers != null) {
      progressSlide.addText(`Effectif moyen : ${s.avgWorkers} ouvrier(s) / jour`, {
        x: 0.55,
        y: 5.35,
        w: 8.9,
        h: 0.35,
        fontSize: 11,
        color: COLORS.muted,
        fontFace: 'Segoe UI',
      });
    }
  }

  const fuelSlide = pptx.addSlide();
  fuelSlide.background = { color: COLORS.bg };
  addHeaderBar(fuelSlide, 'Carburant');
  if (s.fuel.count === 0) {
    fuelSlide.addText('Aucun relevé carburant sur la période.', {
      x: 0.55,
      y: 1.3,
      w: 9,
      h: 0.5,
      fontSize: 13,
      color: COLORS.text,
      fontFace: 'Segoe UI',
    });
  } else {
    addKeyValueTable(fuelSlide, [
      ['Total litres', `${s.fuel.totalLiters.toLocaleString('fr-FR')} L`],
      ...(s.hideFinancials ? [] : [['Coût total', fmtGnf(s.fuel.totalCost)] as [string, string]]),
      ['Relevés / anomalies', `${s.fuel.count} / ${s.fuel.anomalies}`],
    ]);
    if (s.fuel.rows.length > 0) {
      fuelSlide.addChart(
        pptx.ChartType.bar,
        [
          {
            name: 'Litres',
            labels: s.fuel.rows.map((r) => r.dateLabel),
            values: s.fuel.rows.map((r) => r.liters),
          },
        ],
        {
          x: 0.55,
          y: 3.35,
          w: 8.9,
          h: 2.15,
          showTitle: true,
          title: 'Consommation par relevé',
          showLegend: false,
          chartColors: ['F59E0B'],
        }
      );
    }
  }

  const blSlide = pptx.addSlide();
  blSlide.background = { color: COLORS.bg };
  addHeaderBar(blSlide, 'Bons de livraison');
  if (s.deliveries.count === 0) {
    blSlide.addText('Aucun bon de livraison sur la période.', {
      x: 0.55,
      y: 1.3,
      w: 9,
      h: 0.5,
      fontSize: 13,
      color: COLORS.text,
      fontFace: 'Segoe UI',
    });
  } else {
    const hideAmounts = !!s.hideFinancials;
    blSlide.addTable(
      [
        [
          tableHeaderCell('Référence'),
          tableHeaderCell('Fournisseur'),
          ...(hideAmounts ? [] : [tableHeaderCell('Montant')]),
          tableHeaderCell('Date'),
        ],
        ...s.deliveries.rows.map((r) => [
          tableCell(r.reference),
          tableCell(r.supplier),
          ...(hideAmounts ? [] : [tableCell(fmtGnf(r.amount))]),
          tableCell(r.dateLabel),
        ]),
      ],
      {
        x: 0.45,
        y: 1.05,
        w: 9.1,
        colW: hideAmounts ? [2.6, 4.3, 2.2] : [2, 3.2, 2.2, 1.7],
        fontSize: 10,
        border: { type: 'solid', color: 'E2E8F0', pt: 0.75 },
      }
    );
    blSlide.addText(
      hideAmounts
        ? `${s.deliveries.count} bon(s) de livraison`
        : `${s.deliveries.count} bon(s) — total ${fmtGnf(s.deliveries.totalAmount)}`,
      {
        x: 0.55,
        y: 5.1,
        w: 9,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: COLORS.primary,
        fontFace: 'Segoe UI',
      }
    );
  }

  const hseSlide = pptx.addSlide();
  hseSlide.background = { color: COLORS.bg };
  addHeaderBar(hseSlide, 'HSE & pièces jointes');
  addKeyValueTable(hseSlide, [
    ['Mentions sécurité', `${s.hse.mentions} dans les fiches journalières`],
    ['Documents déposés', `${s.hse.docsCount} (HSE / photos)`],
    ...s.hse.noteSnippets.map((n, i): [string, string] => [`Note ${i + 1}`, n]),
  ]);

  const photos = s.photos ?? [];
  for (let i = 0; i < photos.length; i += PHOTOS_PER_SLIDE) {
    const photoSlide = pptx.addSlide();
    photoSlide.background = { color: COLORS.bg };
    addHeaderBar(photoSlide, 'Photos du chantier');
    photos.slice(i, i + PHOTOS_PER_SLIDE).forEach((photo, j) => {
      const boxX = 0.4 + j * 4.7;
      const boxY = 1.05;
      const boxW = 4.5;
      const boxH = 3.75;
      photoSlide.addShape('roundRect', {
        x: boxX,
        y: boxY,
        w: boxW,
        h: boxH + 0.5,
        fill: { color: 'FFFFFF' },
        line: { color: 'E2E8F0', width: 1 },
        rectRadius: 0.05,
      });
      const fit = fitImage(photo.width, photo.height, boxW - 0.2, boxH - 0.2);
      photoSlide.addImage({
        data: imageData(photo),
        x: boxX + 0.1 + fit.dx,
        y: boxY + 0.1 + fit.dy,
        w: fit.w,
        h: fit.h,
      });
      photoSlide.addText(
        [
          { text: photo.caption, options: { bold: true, color: COLORS.text } },
          { text: `  ·  ${photo.dateLabel}`, options: { color: COLORS.muted } },
        ],
        {
          x: boxX + 0.1,
          y: boxY + boxH,
          w: boxW - 0.2,
          h: 0.45,
          fontSize: 10,
          fontFace: 'Segoe UI',
          fit: 'shrink',
        }
      );
    });
  }

  if (s.comment) {
    const commentSlide = pptx.addSlide();
    commentSlide.background = { color: COLORS.bg };
    addHeaderBar(commentSlide, 'Commentaire chef de chantier');
    commentSlide.addText(s.comment, {
      x: 0.55,
      y: 1.2,
      w: 8.9,
      h: 4.2,
      fontSize: 13,
      color: COLORS.text,
      valign: 'top',
      fontFace: 'Segoe UI',
    });
  }

  const signSlide = pptx.addSlide();
  signSlide.background = { color: COLORS.bg };
  addHeaderBar(signSlide, 'Validation');
  const signatories = s.signatories ?? { preparedBy: null, moa: s.identification.moaRecipient ?? null };
  [
    { title: 'Établi par (chef de chantier)', name: signatories.preparedBy },
    { title: "Visa du maître d'ouvrage", name: signatories.moa },
  ].forEach((b, i) => {
    const x = 0.45 + i * 4.65;
    signSlide.addShape('roundRect', {
      x,
      y: 1.2,
      w: 4.45,
      h: 3.6,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 },
      rectRadius: 0.06,
    });
    signSlide.addText(
      [
        { text: b.title, options: { bold: true, color: COLORS.primary, fontSize: 14, breakLine: true } },
        { text: ' ', options: { breakLine: true } },
        { text: `Nom : ${b.name ?? ''}`, options: { breakLine: true } },
        { text: ' ', options: { breakLine: true } },
        { text: 'Date : ____________________', options: { breakLine: true } },
        { text: ' ', options: { breakLine: true } },
        { text: 'Signature :' },
      ],
      {
        x: x + 0.25,
        y: 1.35,
        w: 4,
        h: 3.3,
        valign: 'top',
        fontSize: 12,
        color: COLORS.text,
        fontFace: 'Segoe UI',
      }
    );
  });

  const closing = pptx.addSlide();
  closing.background = { color: COLORS.dark };
  if (s.logo) {
    addLogo(closing, s.logo, 5 - HERO_LOGO_MAX_W / 2, 0.55, HERO_LOGO_MAX_W, HERO_LOGO_MAX_H, 'center');
  }
  closing.addText(orgName, {
    x: 0.5,
    y: 2.0,
    w: 9,
    h: 0.7,
    fontSize: 28,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: 'Segoe UI',
  });
  closing.addText('Propulsé par KonaData · Simple, connecté, local.', {
    x: 0.5,
    y: 2.85,
    w: 9,
    h: 0.45,
    fontSize: 14,
    color: COLORS.accent,
    align: 'center',
    fontFace: 'Segoe UI',
  });
  closing.addText('www.konadatagn.com', {
    x: 0.5,
    y: 4.2,
    w: 9,
    h: 0.35,
    fontSize: 12,
    color: '94A3B8',
    align: 'center',
    fontFace: 'Segoe UI',
  });

  const data = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(data as ArrayBuffer);
}
