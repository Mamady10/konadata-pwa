/**
 * Parsing CSV / tableaux Excel (feuille → lignes) pour import élèves par classe.
 */

export interface StudentImportRow {
  full_name: string;
  matricule?: string;
  email?: string;
  phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  /** true si colonne explicite oui/1 ; défaut false si téléphone tuteur sans colonne */
  guardian_sms_consent?: boolean;
  /** Numéro de ligne dans le fichier (1 = en-tête) */
  sourceLine: number;
}

export interface StudentImportParseResult {
  rows: StudentImportRow[];
  /** Lignes ignorées ou invalides */
  warnings: string[];
  headers: string[];
}

const HEADER_ALIASES: Record<string, keyof Omit<StudentImportRow, 'sourceLine'>> = {
  nom: 'full_name',
  name: 'full_name',
  full_name: 'full_name',
  fullname: 'full_name',
  nom_complet: 'full_name',
  nomcomplet: 'full_name',
  eleve: 'full_name',
  élève: 'full_name',
  etudiant: 'full_name',
  étudiant: 'full_name',
  prenom_nom: 'full_name',
  'prénom_nom': 'full_name',
  matricule: 'matricule',
  mat: 'matricule',
  numero: 'matricule',
  numéro: 'matricule',
  id_eleve: 'matricule',
  email: 'email',
  mail: 'email',
  'e-mail': 'email',
  courriel: 'email',
  telephone: 'phone',
  téléphone: 'phone',
  tel: 'phone',
  phone: 'phone',
  mobile: 'phone',
  tuteur: 'guardian_name',
  tuteur_nom: 'guardian_name',
  guardian_name: 'guardian_name',
  nom_tuteur: 'guardian_name',
  parent: 'guardian_name',
  telephone_tuteur: 'guardian_phone',
  tel_tuteur: 'guardian_phone',
  guardian_phone: 'guardian_phone',
  phone_tuteur: 'guardian_phone',
  sms_tuteur: 'guardian_sms_consent',
  consentement_sms: 'guardian_sms_consent',
  guardian_sms_consent: 'guardian_sms_consent',
};

function parseConsentCell(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'oui' || v === 'yes' || v === 'true' || v === 'o';
}

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

/** Parse une ligne CSV avec guillemets. */
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

function mapRow(
  cells: string[],
  columnMap: (keyof Omit<StudentImportRow, 'sourceLine'> | null)[],
  sourceLine: number
): StudentImportRow | null {
  const row: Partial<StudentImportRow> = { sourceLine };
  columnMap.forEach((field, i) => {
    if (!field) return;
    const val = (cells[i] ?? '').trim();
    if (!val) return;
    row[field] = val as never;
  });
  const name = (row.full_name ?? '').trim();
  if (!name || !isValidStudentImportName(name)) return null;

  let guardian_sms_consent: boolean | undefined;
  const consentRaw = row.guardian_sms_consent as unknown;
  if (typeof consentRaw === 'string' && consentRaw.trim()) {
    guardian_sms_consent = parseConsentCell(consentRaw);
  }

  return {
    full_name: name,
    matricule: row.matricule?.trim() || undefined,
    email: row.email?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    guardian_name: row.guardian_name?.trim() || undefined,
    guardian_phone: row.guardian_phone?.trim() || undefined,
    guardian_sms_consent,
    sourceLine,
  };
}

function buildColumnMap(headers: string[]): (keyof Omit<StudentImportRow, 'sourceLine'> | null)[] {
  return headers.map((h) => {
    const key = normalizeHeader(h);
    return HEADER_ALIASES[key] ?? HEADER_ALIASES[key.replace(/_/g, '')] ?? null;
  });
}

export function parseStudentImportTable(
  tableRows: string[][],
  options?: { headerRowIndex?: number }
): StudentImportParseResult {
  const warnings: string[] = [];
  if (!tableRows.length) {
    return { rows: [], warnings: ['Fichier vide.'], headers: [] };
  }

  const headerIdx = options?.headerRowIndex ?? findHeaderRowIndex(tableRows);
  const headers = (tableRows[headerIdx] ?? []).map((c) => String(c ?? '').trim());
  const columnMap = buildColumnMap(headers);

  if (!columnMap.some((c) => c === 'full_name')) {
    return {
      rows: [],
      warnings: [
        'Colonne « nom » introuvable. Utilisez : nom, matricule, email, telephone (première ligne = en-têtes).',
      ],
      headers,
    };
  }

  const rows: StudentImportRow[] = [];
  for (let i = headerIdx + 1; i < tableRows.length; i++) {
    const cells = tableRows[i].map((c) => String(c ?? '').trim());
    if (cells.every((c) => !c)) continue;
    const mapped = mapRow(cells, columnMap, i + 1);
    if (mapped) {
      rows.push(mapped);
    } else {
      warnings.push(`Ligne ${i + 1} : nom manquant, ignorée.`);
    }
  }

  if (!rows.length && !warnings.length) {
    warnings.push('Aucune ligne élève valide après les en-têtes.');
  }

  return { rows, warnings, headers };
}

/** Détecte la ligne d'en-tête (contient « nom » ou « matricule »). */
function findHeaderRowIndex(tableRows: string[][]): number {
  for (let i = 0; i < Math.min(5, tableRows.length); i++) {
    const normalized = (tableRows[i] ?? []).map((c) => normalizeHeader(String(c ?? '')));
    if (normalized.some((h) => h === 'nom' || h === 'name' || h === 'matricule' || h === 'eleve')) {
      return i;
    }
  }
  return 0;
}

const PDF_SKIP_LINE =
  /^(page\s*\d*|liste\s+(des\s+)?(eleves|élèves|etudiants)|effectif|total|classe|salle|annee|année|n°|#|nom\s*(complet)?|matricule|prenom|prénom|\d+\s*\/\s*\d+|\d+)$/i;

const JUNK_STUDENT_NAME =
  /konadata|document\s+test|import\s+(des\s+)?(eleves|élèves)|\/etablissement\/|etablissement\/etudiants|https?:\/\/|année\s+scolaire|effectif\s*:|établissement\s+pilote|liste\s+interne/i;

/** Filtre en-têtes, pieds de page et métadonnées PDF mal interprétés comme élèves. */
export function isValidStudentImportName(name: string): boolean {
  const n = name.trim();
  if (!n || n.length < 3 || n.length > 80) return false;
  if (PDF_SKIP_LINE.test(n)) return false;
  if (JUNK_STUDENT_NAME.test(n)) return false;
  if (/\//.test(n) && (n.includes('import') || n.includes('etablissement') || n.includes('étudiants'))) {
    return false;
  }
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(n)) return false;

  const lower = n.toLowerCase();
  const metaWords = ['document', 'import', 'etablissement', 'établissement', 'konadata', 'pilote', 'scolaire'];
  const metaHits = metaWords.filter((w) => lower.includes(w)).length;
  if (metaHits >= 2) return false;
  if (lower.includes('import') && (lower.includes('élève') || lower.includes('eleve'))) return false;

  return true;
}

/** Extrait des élèves depuis du texte brut (export PDF avec couche texte). */
export function parseStudentImportFromText(text: string): StudentImportParseResult {
  const rawLines = text
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!rawLines.length) {
    return {
      rows: [],
      warnings: [
        'Aucun texte lisible dans le PDF. Si c’est un scan (photo), exportez en CSV/Excel ou utilisez un PDF généré depuis Word/Excel.',
      ],
      headers: [],
    };
  }

  const tableRows: string[][] = rawLines.map((line) => {
    if (line.includes('\t')) {
      return line.split('\t').map((c) => c.trim()).filter(Boolean);
    }
    if (/\s{2,}/.test(line)) {
      return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    }
    if (line.includes('|')) {
      return line.split('|').map((c) => c.trim()).filter(Boolean);
    }
    return [line];
  });

  const multiColCount = tableRows.filter((r) => r.length >= 2).length;
  if (multiColCount >= Math.max(2, Math.floor(tableRows.length * 0.25))) {
    const tableResult = parseStudentImportTable(tableRows);
    if (tableResult.rows.length > 0) {
      return {
        ...tableResult,
        warnings: [
          'Données extraites du PDF (tableau détecté).',
          ...tableResult.warnings,
        ],
      };
    }
  }

  const rows: StudentImportRow[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lineNo = i + 1;
    let cleaned = line.replace(/^\d+[\.\)\-\s]+/, '').trim();
    if (!cleaned || cleaned.length < 2 || PDF_SKIP_LINE.test(cleaned)) continue;

    const parts = cleaned.split(/\s+/).filter(Boolean);
    let matricule: string | undefined;
    let email: string | undefined;
    let phone: string | undefined;
    let full_name = cleaned;

    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (/^[\w.+-]+@[\w.-]+\.\w{2,}$/i.test(last)) {
        email = last;
        parts.pop();
      }
    }
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (/^[A-Z0-9][A-Z0-9\-_/]{2,}$/i.test(last) && /\d/.test(last)) {
        matricule = last;
        parts.pop();
      }
    }
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (/^\d{6,15}$/.test(last)) {
        phone = last;
        parts.pop();
      }
    }
    full_name = parts.join(' ').trim();
    if (!full_name || !isValidStudentImportName(full_name)) continue;

    rows.push({
      full_name,
      matricule,
      email,
      phone,
      sourceLine: lineNo,
    });
  }

  if (!rows.length) {
    warnings.push(
      'Impossible de reconnaître une liste d’élèves dans ce PDF. Préférez CSV/Excel, ou un PDF exporté depuis un tableur (pas une simple photo).'
    );
  } else {
    warnings.unshift(
      `${rows.length} nom(s) détecté(s) dans le PDF — vérifiez l’aperçu avant import.`
    );
  }

  return { rows, warnings, headers: ['nom (extrait PDF)'] };
}

export function parseStudentImportCsv(text: string): StudentImportParseResult {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) {
    return { rows: [], warnings: ['Fichier CSV vide.'], headers: [] };
  }
  const delimiter = detectDelimiter(lines[0]);
  const tableRows = lines.map((line) => parseCsvLine(line, delimiter));
  return parseStudentImportTable(tableRows);
}

export const STUDENT_IMPORT_TEMPLATE_CSV = [
  'nom;matricule;email;telephone;tuteur;telephone_tuteur;consentement_sms',
  'Diallo Aminata;;aminata@example.gn;622000001;Mamadou Diallo;622111001;oui',
  'Camara Ibrahim;;ibrahim@example.gn;622000002;Fatou Camara;622111002;oui',
  'Bah Fatoumata;ETU-2026-003;;622000003;Ibrahima Bah;622111003;non',
].join('\n');

export const MAX_STUDENT_IMPORT_ROWS = 500;
