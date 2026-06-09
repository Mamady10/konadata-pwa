'use client';

import {
  parseStudentImportCsv,
  parseStudentImportFromText,
  parseStudentImportTable,
  type StudentImportParseResult,
} from '@/lib/school/student-import';
import { extractTextFromPdfFile } from '@/lib/school/student-import-pdf';

const EXCEL_EXT = /\.(xlsx|xls)$/i;
const PDF_EXT = /\.pdf$/i;

export async function parseStudentImportFile(file: File): Promise<StudentImportParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
    const text = await file.text();
    return parseStudentImportCsv(text);
  }

  if (PDF_EXT.test(name) || file.type === 'application/pdf') {
    try {
      const text = await extractTextFromPdfFile(file);
      return parseStudentImportFromText(text);
    } catch (e) {
      return {
        rows: [],
        warnings: [
          e instanceof Error
            ? `PDF : ${e.message}`
            : 'Impossible de lire ce PDF. Essayez CSV/Excel ou un PDF non scanné.',
        ],
        headers: [],
      };
    }
  }

  if (EXCEL_EXT.test(name) || file.type.includes('spreadsheet') || file.type.includes('excel')) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
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
    warnings: ['Format non supporté. Utilisez .csv, .xlsx, .xls ou .pdf (liste avec texte sélectionnable).'],
    headers: [],
  };
}
