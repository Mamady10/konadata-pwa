/**
 * Parsing CSV / Excel pour import de notes par évaluation.
 */

export interface GradeImportRow {
  matricule?: string;
  full_name?: string;
  score: number;
  max_score?: number;
  sourceLine: number;
}

export interface GradeImportParseResult {
  rows: GradeImportRow[];
  warnings: string[];
  headers: string[];
}

const HEADER_ALIASES: Record<string, keyof Omit<GradeImportRow, 'sourceLine'>> = {
  matricule: 'matricule',
  mat: 'matricule',
  numero: 'matricule',
  numéro: 'matricule',
  id_eleve: 'matricule',
  nom: 'full_name',
  name: 'full_name',
  full_name: 'full_name',
  eleve: 'full_name',
  élève: 'full_name',
  etudiant: 'full_name',
  note: 'score',
  notes: 'score',
  score: 'score',
  note_obtenue: 'score',
  sur: 'max_score',
  max: 'max_score',
  max_score: 'max_score',
  bareme: 'max_score',
  barème: 'max_score',
  total: 'max_score',
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_éèêëàâäùûüôöîïç]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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
      } else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseScore(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mapRow(
  cells: string[],
  columnMap: (keyof Omit<GradeImportRow, 'sourceLine'> | null)[],
  sourceLine: number
): GradeImportRow | null {
  const partial: Partial<GradeImportRow> = { sourceLine };
  columnMap.forEach((field, i) => {
    if (!field) return;
    const val = (cells[i] ?? '').trim();
    if (!val) return;
    if (field === 'score' || field === 'max_score') {
      const n = parseScore(val);
      if (n !== null) partial[field] = n;
    } else {
      partial[field] = val as never;
    }
  });

  const score = partial.score;
  if (score === undefined || score === null || Number.isNaN(score)) return null;

  const matricule = partial.matricule?.trim();
  const full_name = partial.full_name?.trim();
  if (!matricule && !full_name) return null;

  return {
    matricule: matricule || undefined,
    full_name: full_name || undefined,
    score,
    max_score: partial.max_score,
    sourceLine,
  };
}

export function parseGradeImportTable(table: string[][]): GradeImportParseResult {
  const warnings: string[] = [];
  if (!table.length) {
    return { rows: [], warnings: ['Fichier vide.'], headers: [] };
  }

  const headerRow = table.find((r) => r.some((c) => String(c).trim()));
  if (!headerRow) {
    return { rows: [], warnings: ['Aucune ligne d\'en-tête.'], headers: [] };
  }

  const headerIndex = table.indexOf(headerRow);
  const headers = headerRow.map((h) => String(h).trim());
  const columnMap = headers.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);

  if (!columnMap.includes('score')) {
    return {
      rows: [],
      warnings: ['Colonne « note » (ou score) introuvable.'],
      headers,
    };
  }
  if (!columnMap.includes('matricule') && !columnMap.includes('full_name')) {
    return {
      rows: [],
      warnings: ['Colonne « matricule » ou « nom » requise.'],
      headers,
    };
  }

  const rows: GradeImportRow[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const cells = table[i].map((c) => String(c ?? '').trim());
    if (!cells.some(Boolean)) continue;
    const row = mapRow(cells, columnMap, i + 1);
    if (row) rows.push(row);
    else warnings.push(`Ligne ${i + 1} ignorée (note ou identifiant manquant).`);
  }

  return { rows, warnings, headers };
}

export function parseGradeImportCsv(text: string): GradeImportParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], warnings: ['Fichier vide.'], headers: [] };
  const delimiter = detectDelimiter(lines[0]);
  const table = lines.map((l) => parseCsvLine(l, delimiter));
  return parseGradeImportTable(table);
}

export const MAX_GRADE_IMPORT_ROWS = 500;

export const GRADE_IMPORT_TEMPLATE_CSV = `matricule;nom;note;sur
MAT-001;Diallo Aminata;14;20
MAT-002;Camara Ibrahim;12,5;20
`;

export function defaultAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  if (now.getMonth() >= 8) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}
