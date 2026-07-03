import { slugifyReportFilename } from '@/lib/reports/download-text-as-pdf';
import type { PmeFinancialReportData } from '@/lib/pme/financial-report-types';

type RGB = [number, number, number];

function fc(n: number): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} GNF`;
}

/** Génère et télécharge un PDF mis en page (couleurs, tableaux, graphes). */
export async function downloadPmeFinancialReportPdf(
  data: PmeFinancialReportData
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;
  const W = pageW - M * 2;
  let y = 0;

  const ink: RGB = [15, 23, 42];
  const muted: RGB = [100, 116, 139];
  const line: RGB = [226, 232, 240];
  const blue: RGB = [37, 99, 235];
  const red: RGB = [220, 38, 38];
  const green: RGB = [5, 150, 105];
  const amber: RGB = [245, 158, 11];

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const ensure = (h: number) => {
    if (y + h > pageH - 12) {
      doc.addPage();
      y = M;
    }
  };
  const sectionTitle = (label: string) => {
    ensure(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setText(ink);
    doc.text(label, M, y);
    y += 2;
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + W, y);
    y += 5;
  };

  const dayLabels = data.days.map((d) => d.label.slice(0, 3));

  // ---- En-tête ----
  setFill([10, 25, 47]);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setText([255, 255, 255]);
  doc.text(`ANALYSES FINANCIÈRES — ${data.orgName.toUpperCase()}`, M, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const generated = new Date(data.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  doc.text(`${data.periodLabel}  ·  ${data.rangeLabel}  ·  Généré le ${generated}`, M, 18);
  y = 32;

  // ---- Bilan (3 cartes) ----
  const cards: { label: string; value: string; color: RGB }[] = [
    { label: 'Entrées', value: fc(data.entreesTotal), color: blue },
    { label: 'Dépenses', value: fc(data.depensesTotal), color: red },
    { label: 'Reste', value: fc(data.resteTotal), color: data.resteTotal >= 0 ? green : amber },
  ];
  const gap = 5;
  const cardW = (W - gap * 2) / 3;
  const cardH = 18;
  cards.forEach((c, i) => {
    const x = M + i * (cardW + gap);
    setFill([248, 250, 252]);
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
    setFill(c.color);
    doc.roundedRect(x, y, 2.2, cardH, 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(muted);
    doc.text(c.label, x + 6, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText(ink);
    doc.text(c.value, x + 6, y + 14);
  });
  y += cardH + 10;

  // ---- Tableau global (jours en colonnes) ----
  sectionTitle('Détail par jour');
  drawTable();

  // ---- Graphes ----
  sectionTitle('Entrées par jour');
  drawBars(data.days.map((d) => d.entrees), blue);
  sectionTitle('Dépenses par jour');
  drawBars(data.days.map((d) => d.depenses), red);
  sectionTitle('Reste par jour');
  drawBars(data.days.map((d) => d.reste), green, amber);

  // ---- Pied de page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    setText([148, 163, 184]);
    doc.text('Données KonaData — vérifiez les chiffres avant diffusion.', M, pageH - 6);
    doc.text(`Page ${i}/${pages}`, pageW - M, pageH - 6, { align: 'right' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(
    `${slugifyReportFilename(`analyse-${data.orgName}-${data.periodLabel}`)}-${stamp}.pdf`
  );

  // ===== helpers =====

  function drawTable() {
    const labelW = 46;
    const totalW = 28;
    const dayW = (W - labelW - totalW) / 7;
    const rowH = 7;

    type Row = { label: string; values: number[]; strong?: boolean };
    const rows: Row[] = [
      { label: 'Entrées (ventes)', values: data.days.map((d) => d.entrees), strong: true },
      ...data.expenseCategories.map((c) => ({ label: c.category, values: c.byDay })),
      { label: 'Total dépenses', values: data.days.map((d) => d.depenses), strong: true },
      { label: 'Reste', values: data.days.map((d) => d.reste), strong: true },
    ];

    const header = () => {
      ensure(rowH);
      setFill([241, 245, 249]);
      doc.rect(M, y, W, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setText(muted);
      doc.text('Catégorie', M + 1.5, y + 4.7);
      dayLabels.forEach((d, i) => {
        doc.text(d, M + labelW + dayW * i + dayW - 1.5, y + 4.7, { align: 'right' });
      });
      doc.text('Total', M + W - 1.5, y + 4.7, { align: 'right' });
      y += rowH;
    };

    header();
    for (const r of rows) {
      if (y + rowH > pageH - 12) {
        doc.addPage();
        y = M;
        header();
      }
      const rowTotal = r.values.reduce((s, x) => s + x, 0);
      if (r.strong) {
        setFill([248, 250, 252]);
        doc.rect(M, y, W, rowH, 'F');
      }
      doc.setFont('helvetica', r.strong ? 'bold' : 'normal');
      doc.setFontSize(8);
      setText(ink);
      const lbl = r.label.length > 26 ? `${r.label.slice(0, 25)}…` : r.label;
      doc.text(lbl, M + 1.5, y + 4.7);
      r.values.forEach((v, i) => {
        const isReste = r.label === 'Reste';
        setText(isReste ? (v < 0 ? red : v > 0 ? green : muted) : ink);
        doc.text(v !== 0 ? fc(v) : '—', M + labelW + dayW * i + dayW - 1.5, y + 4.7, {
          align: 'right',
        });
      });
      setText(ink);
      doc.setFont('helvetica', 'bold');
      doc.text(fc(rowTotal), M + W - 1.5, y + 4.7, { align: 'right' });
      doc.setDrawColor(line[0], line[1], line[2]);
      doc.setLineWidth(0.2);
      doc.line(M, y + rowH, M + W, y + rowH);
      y += rowH;
    }
    y += 8;
  }

  function drawBars(values: number[], color: RGB, negColor?: RGB) {
    const chartH = 30;
    ensure(chartH + 12);
    const maxV = Math.max(1, ...values.map((v) => Math.abs(v)));
    const n = values.length;
    const slot = W / n;
    const barW = Math.min(20, slot * 0.55);
    const baseline = y + chartH;

    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.3);
    doc.line(M, baseline, M + W, baseline);

    values.forEach((v, i) => {
      const cx = M + slot * i + slot / 2;
      const h = Math.max(1.5, (Math.abs(v) / maxV) * chartH);
      setFill(v < 0 && negColor ? negColor : color);
      doc.roundedRect(cx - barW / 2, baseline - h, barW, h, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(ink);
      doc.text(v !== 0 ? `${Math.round(v / 1000)}k` : '0', cx, baseline - h - 1.5, {
        align: 'center',
      });
      doc.setFont('helvetica', 'normal');
      setText(muted);
      doc.text(dayLabels[i], cx, baseline + 4, { align: 'center' });
    });
    y = baseline + 12;
  }
}
