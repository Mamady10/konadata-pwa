import 'server-only';

import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';
import type { OrgLogoImage } from '@/lib/school/fetch-org-logo';

export type StampProcessMethod = 'direct' | 'pdf_render' | 'vision';

export interface ProcessedStampImage extends OrgLogoImage {
  method: StampProcessMethod;
  aiValidated?: boolean;
}

function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

function isImage(fileName: string, mime: string): boolean {
  if (/^image\/(jpeg|png|webp|gif)/.test(mime)) return true;
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extOf(fileName));
}

async function renderPdfFirstPagePng(buffer: Buffer): Promise<Buffer | null> {
  let createCanvas: (w: number, h: number) => {
    getContext: (t: '2d') => unknown;
    toBuffer: (mime: string) => Buffer;
  };
  try {
    const canvasMod = await import('@napi-rs/canvas');
    createCanvas = canvasMod.createCanvas as typeof createCanvas;
  } catch {
    return null;
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  if (doc.numPages < 1) return null;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({
    canvasContext: ctx as never,
    viewport,
  } as unknown as Parameters<typeof page.render>[0]).promise;
  return canvas.toBuffer('image/png');
}

async function validateStampWithVision(
  png: Buffer,
  organizationId?: string
): Promise<boolean> {
  if (!hasActiveLlmApi()) return false;
  try {
    const reply = await queryKonaAI(
      'Ce document est-il un cachet ou sceau officiel d\'établissement scolaire ? Réponds uniquement OUI ou NON.',
      png,
      organizationId ? { organizationId, operation: 'vision_page', visionPages: 1 } : undefined
    );
    return /^oui/i.test(reply.trim());
  } catch {
    return false;
  }
}

/** Extrait une image de cachet depuis PNG/JPEG/PDF — avec ou sans IA. */
export async function processBulletinStampBuffer(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  organizationId?: string;
}): Promise<ProcessedStampImage | { error: string }> {
  const mime = (params.mimeType ?? '').toLowerCase();
  const { buffer, fileName } = params;

  if (isImage(fileName, mime)) {
    const format = mime.includes('jpeg') || extOf(fileName) === 'jpg' ? 'JPEG' : 'PNG';
    let aiValidated: boolean | undefined;
    if (hasActiveLlmApi() && params.organizationId) {
      aiValidated = await validateStampWithVision(buffer, params.organizationId);
    }
    return {
      base64: buffer.toString('base64'),
      format: format as 'PNG' | 'JPEG',
      method: hasActiveLlmApi() && aiValidated ? 'vision' : 'direct',
      aiValidated,
    };
  }

  if (extOf(fileName) === 'pdf' || mime.includes('pdf')) {
    const png = await renderPdfFirstPagePng(buffer);
    if (!png) {
      return {
        error:
          'PDF non lisible. Déposez une image PNG/JPEG du cachet ou activez le module canvas serveur.',
      };
    }
    let aiValidated: boolean | undefined;
    if (hasActiveLlmApi() && params.organizationId) {
      aiValidated = await validateStampWithVision(png, params.organizationId);
    }
    return {
      base64: png.toString('base64'),
      format: 'PNG',
      method: hasActiveLlmApi() && aiValidated ? 'vision' : 'pdf_render',
      aiValidated,
    };
  }

  return { error: 'Format non supporté pour le cachet. Utilisez PNG, JPEG ou PDF.' };
}
