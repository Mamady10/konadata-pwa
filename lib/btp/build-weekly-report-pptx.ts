import 'server-only';

import PptxGenJS from 'pptxgenjs';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import { displayOrgName } from '@/lib/btp/weekly-report-export-types';
import { formatCurrency } from '@/lib/utils';
import { kpiStatusLabel } from '@/lib/btp/site-baseline';
import {
  comparisonMetricsTableRows,
  milestoneTableRows,
} from '@/lib/btp/weekly-report-export-render';

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

function addHeaderBar(slide: PptxSlide, title: string) {
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 10,
    h: 0.82,
    fill: { color: COLORS.headerBar },
  });
  slide.addText(title, {
    x: 0.35,
    y: 0.14,
    w: 9.2,
    h: 0.52,
    fontSize: 18,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Segoe UI',
  });
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
  const generatedAt =
    payload.generatedAt ??
    new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  pptx.author = orgName;
  pptx.title = payload.title;
  pptx.subject = `Rapport périodique — ${payload.scopeLabel}`;
  pptx.layout = 'LAYOUT_16x9';

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: COLORS.dark };
  titleSlide.addShape('rect', {
    x: 0,
    y: 4.55,
    w: 10,
    h: 0.1,
    fill: { color: COLORS.primary },
  });
  titleSlide.addText(orgName.toUpperCase(), {
    x: 0.45,
    y: 0.65,
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
    y: 1.45,
    w: 9.1,
    h: 0.4,
    fontSize: 14,
    color: COLORS.accent,
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(payload.scopeLabel, {
    x: 0.45,
    y: 2.05,
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
    y: 2.75,
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
      `Planning : ${kpiStatusLabel(cmp.kpis.planning)}  ·  Budget : ${kpiStatusLabel(cmp.kpis.budget)}  ·  Délais : ${kpiStatusLabel(cmp.kpis.schedule)}  ·  Global : ${kpiStatusLabel(cmp.kpis.overall)}`,
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
    const mRows = milestoneTableRows(cmp);
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

  const compareChartSlide = cmp ? pptx.addSlide() : null;
  if (compareChartSlide && cmp) {
    compareChartSlide.background = { color: COLORS.bg };
    addHeaderBar(compareChartSlide, 'Comparaisons — courbes & budget');
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
              : 'Avancement planifié vs réalisé (semaine)',
          valAxisMaxVal: 100,
        }
      );
    }
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
  addKeyValueTable(synthSlide, [
    [
      'Avancement physique',
      `${s.synthesis.physicalStart} % → ${s.synthesis.physicalEnd} % (${sign}${Math.round(delta)} pt)`,
    ],
    ['Avancement financier', `${s.synthesis.financialPct} %`],
    ['Retard cumulé', `${s.synthesis.delayDays} jour(s)`],
    ['Budget', fmtGnf(s.synthesis.budget)],
    ['Dépensé', fmtGnf(s.synthesis.spent)],
    ['Reste', fmtGnf(Math.max(0, s.synthesis.budget - s.synthesis.spent))],
  ]);

  const chartSlide = pptx.addSlide();
  chartSlide.background = { color: COLORS.bg };
  addHeaderBar(chartSlide, 'Graphiques — avancement & activité');
  chartSlide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: 'Avancement (%)',
        labels: ['Début semaine', 'Fin semaine', 'Financier'],
        values: [s.synthesis.physicalStart, s.synthesis.physicalEnd, s.synthesis.financialPct],
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
      ['Coût total', fmtGnf(s.fuel.totalCost)],
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
    blSlide.addTable(
      [
        [
          tableHeaderCell('Référence'),
          tableHeaderCell('Fournisseur'),
          tableHeaderCell('Montant'),
          tableHeaderCell('Date'),
        ],
        ...s.deliveries.rows.map((r) => [
          tableCell(r.reference),
          tableCell(r.supplier),
          tableCell(fmtGnf(r.amount)),
          tableCell(r.dateLabel),
        ]),
      ],
      {
        x: 0.45,
        y: 1.05,
        w: 9.1,
        colW: [2, 3.2, 2.2, 1.7],
        fontSize: 10,
        border: { type: 'solid', color: 'E2E8F0', pt: 0.75 },
      }
    );
    blSlide.addText(
      `${s.deliveries.count} bon(s) — total ${fmtGnf(s.deliveries.totalAmount)}`,
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
    ...s.hse.noteSnippets.map((n, i) => [`Note ${i + 1}`, n]),
  ]);

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

  const closing = pptx.addSlide();
  closing.background = { color: COLORS.dark };
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
