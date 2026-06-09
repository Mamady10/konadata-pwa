import 'server-only';

import { extractTextFromPdfBuffer } from '@/lib/documents/extract-pdf-server';
import { extractTextWithVision } from '@/lib/integrations/openai';
import type { AiCallContext } from '@/lib/ai/providers/types';

const MAX_VISION_PAGES = 8;
const RENDER_SCALE = 2;

/**
 * OCR Vision sur PDF scanné (sans couche texte) : rendu page → PNG → transcription.
 * Même principe que les copies manuscrites (Résultats → Pièces jointes).
 */
export async function extractScannedPdfWithVision(
  buffer: Buffer,
  organizationId?: string,
  options?: { maxPages?: number }
): Promise<{ text: string; visionPagesUsed: number; message?: string }> {
  const maxPages = Math.min(options?.maxPages ?? MAX_VISION_PAGES, MAX_VISION_PAGES);

  const plain = (await extractTextFromPdfBuffer(buffer)).trim();
  if (plain.length >= 40) {
    return { text: plain, visionPagesUsed: 0 };
  }

  let createCanvas: (w: number, h: number) => {
    getContext: (t: '2d') => unknown;
    toBuffer: (mime: string) => Buffer;
  };
  try {
    const canvasMod = await import('@napi-rs/canvas');
    createCanvas = canvasMod.createCanvas as typeof createCanvas;
  } catch {
    return {
      text: '',
      visionPagesUsed: 0,
      message:
        'PDF scanné : module canvas serveur indisponible. Uploadez une photo (JPG/PNG) ou un Excel.',
    };
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pageCount = Math.min(doc.numPages, maxPages);
  const parts: string[] = [];
  let visionPagesUsed = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({
      canvasContext: ctx as never,
      viewport,
    } as unknown as Parameters<typeof page.render>[0]).promise;

    const png = canvas.toBuffer('image/png');
    const aiCtx: AiCallContext | undefined = organizationId
      ? {
          organizationId,
          operation: 'vision_page',
          visionPages: 1,
        }
      : undefined;

    const transcribed = await extractTextWithVision(png, 'image/png', aiCtx);
    visionPagesUsed += 1;
    if (transcribed.trim()) {
      parts.push(`--- Page ${pageNum} ---\n${transcribed.trim()}`);
    }
  }

  if (doc.numPages > maxPages) {
    parts.push(`[… ${doc.numPages - maxPages} page(s) non lues — limite ${maxPages}]`);
  }

  const text = parts.join('\n\n').trim();
  if (!text) {
    return {
      text: '',
      visionPagesUsed,
      message:
        'Peu de texte lu sur ce PDF scanné. Vérifiez la qualité du scan ou utilisez Excel/CSV.',
    };
  }

  return { text, visionPagesUsed };
}
