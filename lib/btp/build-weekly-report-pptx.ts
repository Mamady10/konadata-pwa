import 'server-only';

import PptxGenJS from 'pptxgenjs';
import type { WeeklyReportExportPayload } from '@/lib/btp/weekly-report-export-types';
import { sectionsForExport } from '@/lib/btp/weekly-report-export-types';

const COLORS = {
  bg: 'F8FAFC',
  dark: '0A192F',
  primary: '2563EB',
  accent: '22D3EE',
  teal: '2DD4BF',
  text: '334155',
  muted: '64748B',
  headerBar: '1E3A8A',
};

function addHeaderBar(slide: PptxGenSlide, title: string) {
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

type PptxGenSlide = {
  addShape: (shape: string, opts: Record<string, unknown>) => void;
  addText: (text: unknown, opts: Record<string, unknown>) => void;
  background?: { color: string };
};

function sectionBullets(lines: string[]) {
  return lines.flatMap((line) => {
    const parts = line.split('\n').filter(Boolean);
    return parts.map((part) => ({
      text: part.startsWith('•') ? part : `• ${part}`,
      options: { bullet: false, breakLine: true, fontSize: 13 },
    }));
  });
}

export async function buildWeeklyReportPptxBuffer(
  payload: WeeklyReportExportPayload
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const generatedAt =
    payload.generatedAt ??
    new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

  pptx.author = 'KonaData';
  pptx.title = payload.title;
  pptx.subject = `Rapport hebdomadaire — ${payload.scopeLabel}`;
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
  titleSlide.addText('KONADATA', {
    x: 0.5,
    y: 0.55,
    w: 9,
    h: 0.4,
    fontSize: 14,
    bold: true,
    color: COLORS.accent,
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(payload.title, {
    x: 0.45,
    y: 1.35,
    w: 9.1,
    h: 1.2,
    fontSize: 28,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(payload.subtitle, {
    x: 0.45,
    y: 2.65,
    w: 9.1,
    h: 0.55,
    fontSize: 15,
    color: COLORS.teal,
    align: 'center',
    fontFace: 'Segoe UI',
  });
  const orgLine = [payload.orgName, payload.scopeLabel].filter(Boolean).join(' · ');
  titleSlide.addText(orgLine, {
    x: 0.45,
    y: 3.35,
    w: 9.1,
    h: 0.4,
    fontSize: 12,
    color: 'CBD5E1',
    align: 'center',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(`${payload.isoWeek} · ${generatedAt}`, {
    x: 0.45,
    y: 4.85,
    w: 9.1,
    h: 0.35,
    fontSize: 10,
    color: '94A3B8',
    align: 'center',
    fontFace: 'Segoe UI',
  });

  const kpiSlide = pptx.addSlide();
  kpiSlide.background = { color: COLORS.bg };
  addHeaderBar(kpiSlide, 'Tableau de bord — semaine');

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

  for (const section of sectionsForExport(payload.sections)) {
    if (section.heading === 'Identification') continue;

    const slide = pptx.addSlide();
    slide.background = { color: COLORS.bg };
    addHeaderBar(slide, section.heading);

    slide.addText(sectionBullets(section.lines), {
      x: 0.45,
      y: 1.02,
      w: 9.1,
      h: 4.45,
      fontSize: 13,
      color: COLORS.text,
      valign: 'top',
      fontFace: 'Segoe UI',
    });
  }

  const closing = pptx.addSlide();
  closing.background = { color: COLORS.dark };
  closing.addText('KonaData', {
    x: 0.5,
    y: 2.1,
    w: 9,
    h: 0.6,
    fontSize: 32,
    bold: true,
    color: COLORS.accent,
    align: 'center',
    fontFace: 'Segoe UI',
  });
  closing.addText('Simple, connecté, local.', {
    x: 0.5,
    y: 2.85,
    w: 9,
    h: 0.45,
    fontSize: 16,
    color: 'E2E8F0',
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
