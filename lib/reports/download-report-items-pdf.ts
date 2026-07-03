import { slugifyReportFilename } from '@/lib/reports/download-text-as-pdf';

type RGB = [number, number, number];

export interface ReportPdfItem {
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}

const ACCENTS: RGB[] = [
  [37, 99, 235],
  [5, 150, 105],
  [217, 119, 6],
  [124, 58, 237],
  [220, 38, 38],
  [8, 145, 178],
  [219, 39, 119],
];

/** Nettoie les espaces insécables (U+202F/U+00A0) mal rendus par jsPDF. */
function clean(s: string): string {
  return (s ?? '').replace(/[\u202F\u00A0]/g, ' ');
}

interface Options {
  title: string;
  description?: string;
  items: ReportPdfItem[];
  fileName?: string;
}

/** Export stylé (cartes colorées) d'une liste d'indicateurs de synthèse. */
export async function downloadReportItemsPdf({
  title,
  description,
  items,
  fileName,
}: Options): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  const W = pageW - M * 2;

  const ink: RGB = [15, 23, 42];
  const muted: RGB = [100, 116, 139];
  const line: RGB = [226, 232, 240];

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  // En-tête
  setFill([10, 25, 47]);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setText([255, 255, 255]);
  doc.text(clean(title), M, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const generated = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
  doc.text(
    `${description ? clean(description) + '  ·  ' : ''}KonaData  ·  ${generated}`,
    M,
    19
  );

  let y = 34;

  const cols = 2;
  const gap = 6;
  const cardW = (W - gap * (cols - 1)) / cols;
  const cardH = 30;

  if (items.length === 0) {
    doc.setFontSize(11);
    setText(muted);
    doc.text('Aucune donnée disponible.', M, y);
  }

  items.forEach((it, i) => {
    const col = i % cols;
    if (col === 0 && y + cardH > pageH - 16 && i > 0) {
      doc.addPage();
      y = M;
    }
    const x = M + col * (cardW + gap);
    const accent = ACCENTS[i % ACCENTS.length];

    setFill([248, 250, 252]);
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');
    setFill(accent);
    doc.roundedRect(x, y, 2.4, cardH, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setText(ink);
    doc.text(clean(it.title), x + 6, y + 8, { maxWidth: cardW - 10 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    setText(accent);
    doc.text(clean(it.status), x + 6, y + 17, { maxWidth: cardW - 10 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(muted);
    doc.text(clean(it.subtitle), x + 6, y + 24, { maxWidth: cardW - 10 });
    if (it.date) {
      doc.setFontSize(7.5);
      doc.text(clean(it.date), x + 6, y + 28, { maxWidth: cardW - 10 });
    }

    if (col === cols - 1) y += cardH + gap;
  });

  // Pied de page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    setText([148, 163, 184]);
    doc.text('Données KonaData — vérifiez les chiffres avant diffusion.', M, pageH - 8);
    doc.text(`Page ${i}/${pages}`, pageW - M, pageH - 8, { align: 'right' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(fileName ?? `${slugifyReportFilename(title)}-${stamp}.pdf`);
}
