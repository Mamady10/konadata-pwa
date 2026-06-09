'use client';

import {
  parseClassImportCsv,
  parseClassImportTable,
  type ClassImportParseResult,
} from '@/lib/school/class-import';

const EXCEL_EXT = /\.(xlsx|xls)$/i;

export async function parseClassImportFile(file: File): Promise<ClassImportParseResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain') {
    const text = await file.text();
    return parseClassImportCsv(text);
  }

  if (EXCEL_EXT.test(name) || file.type.includes('spreadsheet') || file.type.includes('excel')) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], errors: ['Classeur Excel vide.'], warnings: [], headers: [] };
    }
    const sheet = workbook.Sheets[sheetName];
    const table = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][];
    return parseClassImportTable(table);
  }

  return {
    rows: [],
    errors: ['Format non supporté. Utilisez .csv, .xlsx ou .xls.'],
    warnings: [],
    headers: [],
  };
}

export async function downloadClassImportTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const sample = [
    ['nom', 'palier', 'niveau', 'filière', 'département', 'capacité'],
    ['3ème A', 'college', '9e', 'Général', '', '40'],
    ['Terminale C', 'lycee', 'Terminale', 'Scientifique', '', '35'],
  ];

  if (format === 'csv') {
    const csv = sample.map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_import_classes.csv';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Classes');
  XLSX.writeFile(wb, 'modele_import_classes.xlsx');
}
