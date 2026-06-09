/** Import CSV / Excel classes (nom, palier, niveau, filière). */

import {
  parseEducationLevelBand,
  type EducationLevelBand,
} from '@/lib/school/education-level-catalog';

type ClassImportField =
  | 'name'
  | 'education_level_band'
  | 'level'
  | 'program'
  | 'department'
  | 'capacity';

const CLASS_HEADER_ALIASES: Record<string, ClassImportField> = {
  nom: 'name',
  name: 'name',
  classe: 'name',
  class: 'name',
  palier: 'education_level_band',
  band: 'education_level_band',
  bande: 'education_level_band',
  education_level_band: 'education_level_band',
  niveau: 'level',
  level: 'level',
  filiere: 'program',
  filière: 'program',
  program: 'program',
  programme: 'program',
  departement: 'department',
  département: 'department',
  department: 'department',
  capacite: 'capacity',
  capacité: 'capacity',
  capacity: 'capacity',
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseClassImportBand(raw: string): EducationLevelBand | null {
  const direct = parseEducationLevelBand(raw);
  if (direct) return direct;
  const t = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (t === 'primaire' || t === 'prim' || t === 'fondamental') return 'primaire';
  if (t === 'college' || t === 'colleg') return 'college';
  if (t === 'lycee' || t === 'lyc') return 'lycee';
  if (t === 'universite' || t === 'sup' || t === 'superieur') return 'universite';
  return null;
}

export interface ClassImportRow {
  name: string;
  education_level_band: EducationLevelBand;
  level: string | null;
  program: string | null;
  department: string | null;
  capacity: number;
}

export interface ClassImportParseResult {
  rows: ClassImportRow[];
  errors: string[];
  warnings: string[];
  headers: string[];
}

function buildClassColumnMap(headers: string[]): (ClassImportField | null)[] {
  return headers.map((h) => {
    const key = normalizeHeader(h);
    return CLASS_HEADER_ALIASES[key] ?? CLASS_HEADER_ALIASES[key.replace(/_/g, '')] ?? null;
  });
}

function findClassHeaderRowIndex(tableRows: string[][]): number {
  for (let i = 0; i < Math.min(tableRows.length, 8); i++) {
    const headers = (tableRows[i] ?? []).map((c) => String(c ?? '').trim());
    const columnMap = buildClassColumnMap(headers);
    if (columnMap.includes('name') && columnMap.includes('education_level_band')) {
      return i;
    }
  }
  return -1;
}

function parseClassRowPositional(
  cells: string[],
  lineNum: number
): { row?: ClassImportRow; error?: string } {
  if (cells.length < 2) {
    return { error: `Ligne ${lineNum} : colonnes insuffisantes` };
  }
  const name = cells[0]?.trim();
  if (!name) {
    return { error: `Ligne ${lineNum} : nom manquant` };
  }
  const bandRaw = cells[1]?.trim() ?? '';
  const band = parseClassImportBand(bandRaw);
  if (!band) {
    return { error: `Ligne ${lineNum} : palier invalide (${bandRaw})` };
  }
  return {
    row: {
      name,
      education_level_band: band,
      level: cells[2]?.trim() || null,
      program: cells[3]?.trim() || null,
      department: cells[4]?.trim() || null,
      capacity: Number(cells[5]) > 0 ? Number(cells[5]) : 40,
    },
  };
}

function parseClassRowMapped(
  cells: string[],
  columnMap: (ClassImportField | null)[],
  lineNum: number
): { row?: ClassImportRow; error?: string } {
  const values: Partial<Record<ClassImportField, string>> = {};
  columnMap.forEach((field, i) => {
    if (!field) return;
    const val = String(cells[i] ?? '').trim();
    if (val) values[field] = val;
  });

  const name = values.name?.trim();
  if (!name) {
    return { error: `Ligne ${lineNum} : nom manquant` };
  }
  const bandRaw = values.education_level_band?.trim() ?? '';
  const band = parseClassImportBand(bandRaw);
  if (!band) {
    return { error: `Ligne ${lineNum} : palier invalide (${bandRaw})` };
  }

  const capacityRaw = values.capacity?.trim();
  const capacity = capacityRaw && Number(capacityRaw) > 0 ? Number(capacityRaw) : 40;

  return {
    row: {
      name,
      education_level_band: band,
      level: values.level?.trim() || null,
      program: values.program?.trim() || null,
      department: values.department?.trim() || null,
      capacity,
    },
  };
}

export function parseClassImportTable(tableRows: string[][]): ClassImportParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tableRows.length) {
    return { rows: [], errors: ['Fichier vide'], warnings: [], headers: [] };
  }

  const headerIdx = findClassHeaderRowIndex(tableRows);
  const rows: ClassImportRow[] = [];

  if (headerIdx >= 0) {
    const headers = (tableRows[headerIdx] ?? []).map((c) => String(c ?? '').trim());
    const columnMap = buildClassColumnMap(headers);

    for (let i = headerIdx + 1; i < tableRows.length; i++) {
      const cells = tableRows[i].map((c) => String(c ?? '').trim());
      if (cells.every((c) => !c)) continue;
      const parsed = parseClassRowMapped(cells, columnMap, i + 1);
      if (parsed.row) rows.push(parsed.row);
      else if (parsed.error) warnings.push(parsed.error);
    }

    return { rows, errors, warnings, headers };
  }

  for (let i = 0; i < tableRows.length; i++) {
    const cells = tableRows[i].map((c) => String(c ?? '').trim());
    if (cells.every((c) => !c)) continue;
    const parsed = parseClassRowPositional(cells, i + 1);
    if (parsed.row) rows.push(parsed.row);
    else if (parsed.error) warnings.push(parsed.error);
  }

  if (!rows.length && !warnings.length) {
    errors.push('Aucune classe valide trouvée.');
  }

  return { rows, errors, warnings, headers: [] };
}

function detectDelimiter(line: string): ',' | ';' | '\t' {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as keyof typeof counts]++;
  }
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] >= counts[',']) return '\t';
  return ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseClassImportCsv(text: string): ClassImportParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { rows: [], errors: ['Fichier vide'], warnings: [], headers: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const table = lines.map((line) => parseCsvLine(line, delimiter));
  return parseClassImportTable(table);
}
