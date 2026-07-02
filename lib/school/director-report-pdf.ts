import { formatCurrency } from '@/lib/utils';
import type { SchoolDirectorReportData } from '@/lib/actions/school-director-report';
import { slugifyReportFilename } from '@/lib/reports/download-text-as-pdf';

type RGB = [number, number, number];

const STATUS_COLORS: RGB[] = [
  [37, 99, 235],
  [5, 150, 105],
  [217, 119, 6],
  [124, 58, 237],
  [220, 38, 38],
  [8, 145, 178],
  [100, 116, 139],
];

function nf(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n).replace(/\u202F/g, ' ');
}
function fc(n: number): string {
  return formatCurrency(n).replace(/\u202F/g, ' ');
}
function avgColor(avg: number | null): RGB {
  if (avg == null) return [148, 163, 184];
  if (avg >= 12) return [5, 150, 105];
  if (avg >= 10) return [37, 99, 235];
  if (avg >= 8) return [217, 119, 6];
  return [220, 38, 38];
}

/** Génère et télécharge un PDF mis en page (couleurs, tableaux, graphes). */
export async function downloadDirectorReportPdf(
  data: SchoolDirectorReportData
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  const W = pageW - M * 2;
  let y = 0;

  const ink: RGB = [15, 23, 42];
  const muted: RGB = [100, 116, 139];
  const line: RGB = [226, 232, 240];

  const ensure = (h: number) => {
    if (y + h > pageH - 14) {
      doc.addPage();
      y = M;
    }
  };
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const sectionTitle = (label: string) => {
    ensure(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setText(ink);
    doc.text(label, M, y);
    y += 2;
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + W, y);
    y += 6;
  };

  // ---- En-tête ----
  setFill([37, 99, 235]);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setText([255, 255, 255]);
  doc.text(data.orgName, M, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Rapport de direction — ${data.periodLabel}`, M, 19);
  doc.setFontSize(8);
  const generated = new Date(data.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  doc.text(
    `Année ${data.academicYear}  ·  ${data.rangeLabel}  ·  Généré le ${generated}`,
    M,
    24
  );
  y = 34;

  // ---- KPIs ----
  const kpis: { label: string; value: string; color: RGB }[] = [
    { label: 'Élèves inscrits', value: nf(data.kpis.studentsEnrolled), color: [37, 99, 235] },
    { label: 'Classes actives', value: nf(data.kpis.classesActive), color: [124, 58, 237] },
    { label: 'Nouvelles inscriptions', value: nf(data.kpis.newEnrollmentsPeriod), color: [8, 145, 178] },
    { label: 'Encaissé (période)', value: fc(data.kpis.collectedPeriod), color: [5, 150, 105] },
    { label: 'Notes saisies', value: nf(data.kpis.gradesPeriod), color: [217, 119, 6] },
    { label: 'Bulletins générés', value: nf(data.kpis.bulletinsPeriod), color: [220, 38, 38] },
  ];
  const cols = 3;
  const gap = 4;
  const cardW = (W - gap * (cols - 1)) / cols;
  const cardH = 20;
  ensure(cardH * 2 + gap);
  kpis.forEach((k, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    setFill([248, 250, 252]);
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cy, cardW, cardH, 2, 2, 'FD');
    setFill(k.color);
    doc.roundedRect(x + 4, cy + 4, 9, 1.6, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(muted);
    doc.text(k.label, x + 4, cy + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(k.value.length > 12 ? 11 : 14);
    setText(ink);
    doc.text(k.value, x + 4, cy + 16.5);
  });
  y += cardH * 2 + gap + 8;

  // ---- Encaissements sur la période (barres verticales) ----
  sectionTitle('Encaissements sur la période');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(muted);
  doc.text(`Total : ${fc(data.kpis.collectedPeriod)}`, M, y);
  y += 5;
  drawVerticalBars(
    data.collectionTrend.map((t) => ({
      label: t.label,
      value: t.amount,
      color: [37, 99, 235] as RGB,
      caption: t.amount > 0 ? `${nf(Math.round(t.amount / 1000))}k` : '0',
    }))
  );

  // ---- Finances par classe (tableau) ----
  sectionTitle('Situation financière par classe (cumul annuel)');
  drawFinanceTable();

  // ---- Candidatures & inscriptions (barres horizontales) ----
  sectionTitle('Candidatures & inscriptions');
  drawStatusBars();

  // ---- Résultats par classe (barres verticales) ----
  sectionTitle('Résultats par classe (moyenne sur 20)');
  drawVerticalBars(
    data.resultsByClass.map((r) => ({
      label: r.className,
      value: r.average ?? 0,
      color: avgColor(r.average),
      caption: r.average != null ? r.average.toFixed(1) : '—',
    }))
  );

  // ---- Pied de page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    setText([148, 163, 184]);
    doc.text(
      'Données KonaData — vérifiez les chiffres avant diffusion officielle.',
      M,
      pageH - 8
    );
    doc.text(`Page ${i}/${pages}`, pageW - M, pageH - 8, { align: 'right' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(
    `${slugifyReportFilename(`rapport-${data.orgName}-${data.periodLabel}`)}-${stamp}.pdf`
  );

  // ===== Fonctions de dessin (closures) =====

  function drawVerticalBars(
    items: { label: string; value: number; color: RGB; caption: string }[]
  ) {
    if (items.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(muted);
      ensure(6);
      doc.text('Aucune donnée.', M, y);
      y += 8;
      return;
    }
    const chartH = 34;
    ensure(chartH + 10);
    const maxV = Math.max(1, ...items.map((i) => i.value));
    const n = items.length;
    const slot = W / n;
    const barW = Math.min(16, slot * 0.6);
    const baseline = y + chartH;

    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.3);
    doc.line(M, baseline, M + W, baseline);

    items.forEach((it, i) => {
      const cx = M + slot * i + slot / 2;
      const h = Math.max(1.5, (it.value / maxV) * chartH);
      setFill(it.color);
      doc.roundedRect(cx - barW / 2, baseline - h, barW, h, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(ink);
      doc.text(it.caption, cx, baseline - h - 1.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setText(muted);
      const lbl = it.label.length > 12 ? `${it.label.slice(0, 11)}…` : it.label;
      doc.text(lbl, cx, baseline + 4, { align: 'center' });
    });
    y = baseline + 10;
  }

  function drawFinanceTable() {
    const rows = data.finance.rows;
    if (rows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(muted);
      ensure(6);
      doc.text('Aucune classe active.', M, y);
      y += 8;
      return;
    }
    // Colonnes : Classe | Inscrits | Attendu | Encaissé | Taux | Écart
    const cw = [W * 0.26, W * 0.12, W * 0.19, W * 0.19, W * 0.1, W * 0.14];
    const xs: number[] = [];
    let acc = M;
    for (const w of cw) {
      xs.push(acc);
      acc += w;
    }
    const rowH = 7;

    const header = () => {
      ensure(rowH);
      setFill([241, 245, 249]);
      doc.rect(M, y, W, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setText(muted);
      doc.text('Classe', xs[0] + 1.5, y + 4.7);
      doc.text('Inscrits', xs[1] + cw[1] - 1.5, y + 4.7, { align: 'right' });
      doc.text('Attendu', xs[2] + cw[2] - 1.5, y + 4.7, { align: 'right' });
      doc.text('Encaissé', xs[3] + cw[3] - 1.5, y + 4.7, { align: 'right' });
      doc.text('Taux', xs[4] + cw[4] - 1.5, y + 4.7, { align: 'right' });
      doc.text('Écart', xs[5] + cw[5] - 1.5, y + 4.7, { align: 'right' });
      y += rowH;
    };

    header();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    for (const r of rows) {
      if (y + rowH > pageH - 14) {
        doc.addPage();
        y = M;
        header();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
      }
      const ratio = r.expected > 0 ? r.collected / r.expected : 0;
      const pct = Math.round(ratio * 100);
      const barColor: RGB = ratio >= 0.8 ? [5, 150, 105] : ratio >= 0.5 ? [217, 119, 6] : [220, 38, 38];

      setText(ink);
      doc.setFont('helvetica', 'bold');
      const clName = r.className.length > 20 ? `${r.className.slice(0, 19)}…` : r.className;
      doc.text(clName, xs[0] + 1.5, y + 4.7);
      doc.setFont('helvetica', 'normal');
      doc.text(nf(r.enrolled), xs[1] + cw[1] - 1.5, y + 4.7, { align: 'right' });
      doc.text(fc(r.expected), xs[2] + cw[2] - 1.5, y + 4.7, { align: 'right' });
      doc.text(fc(r.collected), xs[3] + cw[3] - 1.5, y + 4.7, { align: 'right' });

      // mini barre de taux sous le %
      setText(muted);
      doc.text(`${pct}%`, xs[4] + cw[4] - 1.5, y + 3.4, { align: 'right' });
      setFill([238, 242, 247]);
      doc.rect(xs[4] + 1, y + 4.6, cw[4] - 2.5, 1.4, 'F');
      setFill(barColor);
      doc.rect(xs[4] + 1, y + 4.6, (cw[4] - 2.5) * Math.min(1, ratio), 1.4, 'F');

      setText(r.gap > 0 ? [220, 38, 38] : [5, 150, 105]);
      doc.setFont('helvetica', 'bold');
      doc.text(fc(r.gap), xs[5] + cw[5] - 1.5, y + 4.7, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      doc.setDrawColor(line[0], line[1], line[2]);
      doc.setLineWidth(0.2);
      doc.line(M, y + rowH, M + W, y + rowH);
      y += rowH;
    }

    // Total
    ensure(rowH);
    setFill([248, 250, 252]);
    doc.rect(M, y, W, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    setText(ink);
    doc.text('Total', xs[0] + 1.5, y + 4.7);
    doc.text(nf(data.finance.totals.enrolled), xs[1] + cw[1] - 1.5, y + 4.7, { align: 'right' });
    doc.text(fc(data.finance.totals.expected), xs[2] + cw[2] - 1.5, y + 4.7, { align: 'right' });
    doc.text(fc(data.finance.totals.collected), xs[3] + cw[3] - 1.5, y + 4.7, { align: 'right' });
    doc.text(fc(data.finance.totals.gap), xs[5] + cw[5] - 1.5, y + 4.7, { align: 'right' });
    y += rowH + 8;
  }

  function drawStatusBars() {
    const items = data.enrollmentStatus;
    const total = items.reduce((s, e) => s + e.count, 0);
    if (total === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(muted);
      ensure(6);
      doc.text('Aucun dossier.', M, y);
      y += 8;
      return;
    }
    const labelW = 42;
    const countW = 12;
    const barW = W - labelW - countW;
    const rowH = 7;
    items.forEach((s, i) => {
      ensure(rowH);
      const ratio = s.count / total;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText(ink);
      const lbl = s.label.length > 24 ? `${s.label.slice(0, 23)}…` : s.label;
      doc.text(lbl, M, y + 4.4);
      setFill([238, 242, 247]);
      doc.roundedRect(M + labelW, y + 1.4, barW, 3.4, 1, 1, 'F');
      setFill(STATUS_COLORS[i % STATUS_COLORS.length]);
      doc.roundedRect(M + labelW, y + 1.4, Math.max(1.5, barW * ratio), 3.4, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      setText(ink);
      doc.text(String(s.count), M + W, y + 4.4, { align: 'right' });
      y += rowH;
    });
    y += 6;
  }
}
