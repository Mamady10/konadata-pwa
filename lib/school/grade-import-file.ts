'use client';

import {
  parseGradeImportCsv,
  parseGradeImportTable,
  type GradeImportParseResult,
} from '@/lib/school/grade-import';

const EXCEL_EXT = /\.(xlsx|xls)$/i;

export async function parseGradeImportFile(file: File): Promise<GradeImportParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
    return parseGradeImportCsv(await file.text());
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
    return parseGradeImportTable(table);
  }

  return {
    rows: [],
    warnings: [
      'Format non supporté pour l\'import de notes. Utilisez .csv, .xlsx ou .xls.',
      'Pour une photo ou un PDF manuscrit, utilisez l\'onglet « Pièces jointes ».',
    ],
    headers: [],
  };
}
