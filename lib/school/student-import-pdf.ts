'use client';

/**
 * Extraction de texte depuis PDF (couche texte) via PDF.js.
 */

export async function extractTextFromPdfFile(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const version = pdfjs.version ?? '4.10.38';
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    type LineItem = { str: string; x: number; y: number };
    const items: LineItem[] = [];

    for (const raw of content.items) {
      if (!('str' in raw)) continue;
      const str = String(raw.str ?? '').trim();
      if (!str) continue;
      const t = raw.transform as number[];
      items.push({ str, x: t[4] ?? 0, y: t[5] ?? 0 });
    }

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const yTolerance = 5;
    const lines: string[] = [];
    let bucketY: number | null = null;
    let parts: string[] = [];

    for (const item of items) {
      if (bucketY === null || Math.abs(item.y - bucketY) > yTolerance) {
        if (parts.length) lines.push(parts.join('\t'));
        bucketY = item.y;
        parts = [item.str];
      } else {
        parts.push(item.str);
      }
    }
    if (parts.length) lines.push(parts.join('\t'));
    pages.push(lines.join('\n'));
  }

  return pages.join('\n\n');
}
