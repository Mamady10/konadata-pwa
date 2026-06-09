import 'server-only';

import {
  parseStudentImportCsv,
  parseStudentImportFromText,
  parseStudentImportTable,
  type StudentImportParseResult,
} from '@/lib/school/student-import';
import { extractTextFromPdfBuffer } from '@/lib/documents/extract-pdf-server';

const EXCEL_EXT = /\.(xlsx|xls)$/i;
const PDF_EXT = /\.pdf$/i;

/** Lecture serveur CSV / Excel / PDF (couche texte). */
export async function parseStudentImportFileServer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null
): Promise<StudentImportParseResult> {
  const name = fileName.toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();

  if (name.endsWith('.csv') || mime === 'text/csv' || mime === 'text/plain') {
    return parseStudentImportCsv(buffer.toString('utf8'));
  }

  if (PDF_EXT.test(name) || mime.includes('pdf')) {
    try {
      const text = await extractTextFromPdfBuffer(buffer);
      return parseStudentImportFromText(text);
    } catch (e) {
      return {
        rows: [],
        warnings: [
          e instanceof Error
            ? `PDF : ${e.message}`
            : 'Impossible de lire ce PDF.',
        ],
        headers: [],
      };
    }
  }

  if (EXCEL_EXT.test(name) || mime.includes('spreadsheet') || mime.includes('excel')) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], warnings: ['Classeur Excel vide.'], headers: [] };
    }
    const sheet = workbook.Sheets[sheetName];
    const table = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][];
    return parseStudentImportTable(table);
  }

  return {
    rows: [],
    warnings: [
      'Format non reconnu côté serveur. Utilisez CSV, Excel, PDF ou une image pour KonaAI.',
    ],
    headers: [],
  };
}
