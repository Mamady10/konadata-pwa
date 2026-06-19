export interface BtpPersonnelImportRow {
  fullName: string;
  monthlySalary: number;
  role?: string;
}

export interface BtpPersonnelImportParseResult {
  rows: BtpPersonnelImportRow[];
  warnings: string[];
  headers: string[];
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');
}

const NAME_HEADERS = new Set([
  'nom',
  'name',
  'full_name',
  'nom_complet',
  'employe',
  'employee',
  'prenom_nom',
  'collaborateur',
]);

const SALARY_HEADERS = new Set([
  'salaire',
  'salary',
  'salaire_mensuel',
  'monthly_salary',
  'montant',
  'amount',
  'salaire_brut',
  'remuneration',
  'gnf',
]);

const ROLE_HEADERS = new Set(['role', 'fonction', 'poste', 'titre', 'job']);

function parseSalary(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/,/g, '').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

export function parseBtpPersonnelImportTable(table: string[][]): BtpPersonnelImportParseResult {
  const warnings: string[] = [];
  if (!table.length) {
    return { rows: [], warnings: ['Fichier vide.'], headers: [] };
  }

  const headerRow = table[0].map((c) => normalizeHeader(String(c ?? '')));
  const headers = table[0].map((c) => String(c ?? '').trim());

  let nameCol = headerRow.findIndex((h) => NAME_HEADERS.has(h));
  let salaryCol = headerRow.findIndex((h) => SALARY_HEADERS.has(h));
  let roleCol = headerRow.findIndex((h) => ROLE_HEADERS.has(h));

  let dataStart = 1;
  if (nameCol < 0 || salaryCol < 0) {
    if (table.length >= 2) {
      const row1 = table[1].map((c) => normalizeHeader(String(c ?? '')));
      nameCol = row1.findIndex((h) => NAME_HEADERS.has(h));
      salaryCol = row1.findIndex((h) => SALARY_HEADERS.has(h));
      roleCol = row1.findIndex((h) => ROLE_HEADERS.has(h));
      if (nameCol >= 0 && salaryCol >= 0) dataStart = 2;
    }
    if (nameCol < 0) nameCol = 0;
    if (salaryCol < 0) salaryCol = 1;
    warnings.push('En-têtes non reconnus — colonnes A=nom, B=salaire utilisées par défaut.');
  }

  const rows: BtpPersonnelImportRow[] = [];
  const seen = new Set<string>();

  for (let i = dataStart; i < table.length; i++) {
    const line = table[i];
    if (!line?.length) continue;
    const fullName = String(line[nameCol] ?? '').trim();
    if (!fullName || fullName.length < 2) continue;
    const key = fullName.toLowerCase();
    if (seen.has(key)) {
      warnings.push(`Doublon ignoré : ${fullName}`);
      continue;
    }
    seen.add(key);
    const monthlySalary = parseSalary(String(line[salaryCol] ?? ''));
    if (monthlySalary <= 0) {
      warnings.push(`Salaire invalide pour « ${fullName} » — ligne ignorée.`);
      continue;
    }
    const role = roleCol >= 0 ? String(line[roleCol] ?? '').trim() : undefined;
    rows.push({
      fullName,
      monthlySalary,
      role: role || 'Employé direct',
    });
  }

  if (!rows.length) {
    warnings.push('Aucune ligne valide (nom + salaire mensuel requis).');
  }

  return { rows, warnings, headers };
}

export function parseBtpPersonnelImportCsv(text: string): BtpPersonnelImportParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const table = lines.map((line) => line.split(/[;,|\t]/).map((c) => c.trim()));
  return parseBtpPersonnelImportTable(table);
}
