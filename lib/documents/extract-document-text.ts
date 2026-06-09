import 'server-only';

import { extractTextFromPdfBuffer } from '@/lib/documents/extract-pdf-server';
import { extractTextWithVision, hasActiveLlmApi } from '@/lib/integrations/openai';

const MAX_STORE_CHARS = 120_000;

export type ExtractionMethod =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'csv'
  | 'plain'
  | 'vision'
  | 'unsupported';

export type ExtractionStatus = 'ok' | 'partial' | 'failed' | 'skipped';

export interface DocumentExtractionResult {
  text: string;
  method: ExtractionMethod;
  status: ExtractionStatus;
  message?: string;
}

function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

function normalizeText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function capText(text: string): string {
  if (text.length <= MAX_STORE_CHARS) return text;
  return `${text.slice(0, MAX_STORE_CHARS)}\n\n[… texte tronqué pour indexation]`;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const res = await mammoth.extractRawText({ buffer });
  return normalizeText(res.value ?? '');
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames.slice(0, 5)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
    parts.push(`## Feuille: ${sheetName}\n${csv}`);
  }
  return normalizeText(parts.join('\n\n'));
}

function isImageExt(ext: string, mime: string | null): boolean {
  if (/^image\/(jpeg|png|gif|webp|tiff)/.test(mime ?? '')) return true;
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'bmp'].includes(ext);
}

export async function extractDocumentText(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  organizationId?: string;
}): Promise<DocumentExtractionResult> {
  const { buffer, fileName } = params;
  const mime = (params.mimeType ?? '').toLowerCase();
  const ext = extOf(fileName);

  try {
    if (ext === 'pdf' || mime.includes('pdf')) {
      const plain = normalizeText(await extractTextFromPdfBuffer(buffer));
      if (plain.length >= 15) {
        return { text: capText(plain), method: 'pdf', status: 'ok' };
      }

      const { extractScannedPdfWithVision } = await import(
        '@/lib/documents/extract-pdf-vision-server'
      );
      const vision = await extractScannedPdfWithVision(buffer, params.organizationId);
      if (vision.text.length > 10) {
        return {
          text: capText(vision.text),
          method: 'vision',
          status: 'ok',
          message:
            vision.visionPagesUsed > 0
              ? `PDF scanné — OCR KonaAI (${vision.visionPagesUsed} page(s)).`
              : undefined,
        };
      }

      return {
        text: '',
        method: 'pdf',
        status: 'partial',
        message:
          vision.message ??
          'PDF sans texte lisible. Uploadez JPG/PNG, Excel/CSV, ou activez KonaAI Vision (offre Standard+).',
      };
    }

    if (ext === 'docx' || mime.includes('wordprocessingml')) {
      const text = capText(await extractDocx(buffer));
      return text.length > 10
        ? { text, method: 'docx', status: 'ok' }
        : {
            text: '',
            method: 'docx',
            status: 'partial',
            message: 'Document Word vide ou illisible.',
          };
    }

    if (ext === 'doc') {
      return {
        text: '',
        method: 'unsupported',
        status: 'failed',
        message: 'Format .doc ancien : enregistrez en .docx ou PDF pour l’indexation.',
      };
    }

    if (['xlsx', 'xls', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('csv')) {
      const text = capText(await extractXlsx(buffer));
      return text.length > 5
        ? { text, method: ext === 'csv' ? 'csv' : 'xlsx', status: 'ok' }
        : { text: '', method: 'xlsx', status: 'partial', message: 'Tableur vide.' };
    }

    if (['txt', 'md', 'json', 'xml', 'html'].includes(ext) || mime.startsWith('text/')) {
      const text = capText(normalizeText(buffer.toString('utf8')));
      return { text, method: 'plain', status: text.length > 3 ? 'ok' : 'partial' };
    }

    if (isImageExt(ext, mime)) {
      if (!hasActiveLlmApi()) {
        return {
          text: '',
          method: 'vision',
          status: 'failed',
          message:
            'OCR manuscrit / photo : configurez OPENAI_API_KEY pour lire l’image (GPT Vision).',
        };
      }
      const text = capText(
        normalizeText(
          await extractTextWithVision(
            buffer,
            mime || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            params.organizationId
              ? { organizationId: params.organizationId, operation: 'vision_page', visionPages: 1 }
              : undefined
          )
        )
      );
      return text.length > 10
        ? { text, method: 'vision', status: 'ok' }
        : {
            text: '',
            method: 'vision',
            status: 'partial',
            message: 'Peu de texte détecté sur l’image.',
          };
    }

    return {
      text: '',
      method: 'unsupported',
      status: 'skipped',
      message: `Type de fichier non pris en charge pour l’indexation : .${ext || '?'}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur extraction';
    return { text: '', method: 'unsupported', status: 'failed', message: msg };
  }
}
