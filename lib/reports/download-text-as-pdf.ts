export function slugifyReportFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'rapport'
  );
}

export interface DownloadTextPdfOptions {
  title: string;
  content: string;
  fileName?: string;
  metaLine?: string;
  archiveRef?: string | null;
}

/** Export texte multi-pages en PDF (client uniquement). */
export async function downloadTextAsPdf({
  title,
  content,
  fileName,
  metaLine,
  archiveRef,
}: DownloadTextPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const newPageIfNeeded = (lineHeight: number) => {
    if (y + lineHeight > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeBlock = (text: string, fontSize: number, bold = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    const lh = fontSize * 0.42;
    for (const line of lines) {
      newPageIfNeeded(lh);
      doc.text(line, margin, y);
      y += lh;
    }
  };

  writeBlock(title, 14, true);
  const meta =
    metaLine ??
    `KonaData — ${new Date().toLocaleString('fr-FR')}${archiveRef ? ` — Réf. ${archiveRef.slice(0, 8)}` : ''}`;
  writeBlock(meta, 9, false, [100, 100, 100]);
  y += 4;
  writeBlock(content, 10);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i}/${pages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(fileName ?? `${slugifyReportFilename(title)}-${stamp}.pdf`);
}

export function formatReportItemAsText(item: {
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}): string {
  return [
    item.title,
    item.subtitle,
    `Statut : ${item.status}`,
    item.date ? `Date : ${item.date}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
