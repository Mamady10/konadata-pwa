import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';
import {
  isValidStudentImportName,
  parseStudentImportFromText,
  parseStudentImportTable,
  type StudentImportRow,
} from '@/lib/school/student-import';

export type RosterExtractPurpose =
  | 'student_roster'
  | 'beneficiary_list'
  | 'personnel_list'
  | 'generic_table';

export interface RosterExtractRow {
  full_name: string;
  matricule?: string;
  email?: string;
  phone?: string;
  extra?: Record<string, string>;
  sourceLine: number;
}

export interface RosterExtractResult {
  rows: RosterExtractRow[];
  warnings: string[];
  parseMethod: 'llm' | 'heuristic' | 'table';
  detectedClassName?: string | null;
  detectedCount?: number | null;
}

const PURPOSE_LABELS: Record<RosterExtractPurpose, string> = {
  student_roster: 'liste d\'élèves / étudiants',
  beneficiary_list: 'liste de bénéficiaires',
  personnel_list: 'liste de personnel / agents',
  generic_table: 'liste ou tableau de personnes',
};

function mapStudentRows(rows: StudentImportRow[]): RosterExtractRow[] {
  return rows.map((r) => ({
    full_name: r.full_name,
    matricule: r.matricule,
    email: r.email,
    phone: r.phone,
    sourceLine: r.sourceLine,
  }));
}

function heuristicFromText(text: string): RosterExtractResult {
  const parsed = parseStudentImportFromText(text);
  return {
    rows: mapStudentRows(parsed.rows),
    warnings: parsed.warnings,
    parseMethod: 'heuristic',
    detectedCount: parsed.rows.length || null,
  };
}

export async function parseRosterFromExtractedText(
  text: string,
  purpose: RosterExtractPurpose,
  organizationId?: string
): Promise<RosterExtractResult> {
  const raw = text.trim();
  if (!raw) {
    return {
      rows: [],
      warnings: ['Aucun texte à analyser.'],
      parseMethod: 'heuristic',
    };
  }

  if (hasActiveLlmApi()) {
    const label = PURPOSE_LABELS[purpose];
    const prompt = [
      `Analyse ce texte extrait d'un document (OCR / scan) contenant une ${label}.`,
      'Réponds UNIQUEMENT avec un JSON valide (pas de markdown) :',
      '{"className":string|null,"totalCount":number|null,"rows":[',
      '{"full_name":string,"matricule":string|null,"email":string|null,"phone":string|null}]}',
      'Incluez chaque personne lisible. Ne inventez pas de noms absents du texte.',
      'Ignorez les en-têtes, pieds de page, mentions légales et lignes techniques (URLs, « import », « KonaData »).',
      'Utilisez null pour les champs manquants.',
    ].join('\n');

    const rawJson = await queryKonaAI(
      prompt,
      raw.slice(0, 24_000),
      organizationId ? { organizationId, operation: 'parse_roster' } : undefined
    );

    try {
      const cleaned = rawJson.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as {
        className?: string | null;
        totalCount?: number | null;
        rows?: Array<{
          full_name?: string;
          matricule?: string | null;
          email?: string | null;
          phone?: string | null;
        }>;
      };

      const rows: RosterExtractRow[] = [];
      for (const [i, r] of (parsed.rows ?? []).entries()) {
        const name = (r.full_name ?? '').trim();
        if (!name || !isValidStudentImportName(name)) continue;
        rows.push({
          full_name: name,
          matricule: r.matricule?.trim() || undefined,
          email: r.email?.trim() || undefined,
          phone: r.phone?.trim() || undefined,
          sourceLine: i + 1,
        });
      }

      if (rows.length > 0) {
        return {
          rows,
          warnings: [
            `${rows.length} personne(s) extraite(s) par KonaAI (OCR + structuration).`,
          ],
          parseMethod: 'llm',
          detectedClassName: parsed.className ?? null,
          detectedCount: parsed.totalCount ?? rows.length,
        };
      }
    } catch {
      /* heuristic fallback */
    }
  }

  return heuristicFromText(raw);
}

/** Convertit des lignes roster génériques vers le format import élèves. */
export function rosterRowsToStudentImport(rows: RosterExtractRow[]): StudentImportRow[] {
  return rows
    .filter((r) => isValidStudentImportName(r.full_name))
    .map((r) => ({
      full_name: r.full_name,
      matricule: r.matricule,
      email: r.email,
      phone: r.phone,
      sourceLine: r.sourceLine,
    }));
}

export function purposeForOrgType(orgType: string | null | undefined): RosterExtractPurpose {
  if (orgType === 'school') return 'student_roster';
  if (orgType === 'ngo') return 'beneficiary_list';
  if (orgType === 'btp') return 'personnel_list';
  return 'generic_table';
}

export { parseStudentImportTable };
