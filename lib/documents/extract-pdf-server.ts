import 'server-only';

const MAX_PAGES = 60;

/**
 * Extraction texte PDF côté serveur (pdfjs-dist legacy, sans worker navigateur).
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
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

  if (doc.numPages > MAX_PAGES) {
    pages.push(`[… ${doc.numPages - MAX_PAGES} page(s) non lues — limite ${MAX_PAGES}]`);
  }

  return pages.join('\n\n').trim();
}
