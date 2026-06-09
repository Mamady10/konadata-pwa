import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';

export interface ParsedSubjectGrade {
  name: string;
  score: number;
  maxScore: number;
}

export interface ParsedHandwrittenBulletin {
  studentName: string | null;
  academicYear: string | null;
  period: string | null;
  homeroomTeacher: string | null;
  subjects: ParsedSubjectGrade[];
  generalAverage: number | null;
  rawTranscription: string;
  parseMethod: 'llm' | 'heuristic' | 'none';
}

function parseNumber(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Extraction structurée sans API (lignes type FRANCAIS 13). */
function heuristicParse(text: string): ParsedHandwrittenBulletin {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let studentName: string | null = null;
  let academicYear: string | null = null;
  let period: string | null = null;
  let homeroomTeacher: string | null = null;
  let generalAverage: number | null = null;
  const subjects: ParsedSubjectGrade[] = [];

  for (const line of lines) {
    const upper = line.toUpperCase();

    const eleve = line.match(/(?:ELEVE|ÉLÈVE|ETUDIANT|ÉTUDIANT)\s*:?\s*(.+)/i);
    if (eleve) studentName = eleve[1].trim();

    const year = line.match(/(?:ANNEE|ANNÉE)\s*SCOLAIRE\s*:?\s*([\d/\-]+)/i);
    if (year) academicYear = year[1].trim();

    const prof = line.match(
      /(?:PROFESSEUR(?:E)?(?:\s+PRINCIPALE)?|PROF(?:ESSEUR)?(?:E)?)\s*:?\s*(.+)/i
    );
    if (prof) homeroomTeacher = prof[1].trim();

    const bulletin = line.match(/BULLETIN\s+(?:DU\s+)?(.+)/i);
    if (bulletin) period = bulletin[1].trim();

    const moy = line.match(/MOYENNE\s+GENERALE\s*:?\s*([\d,.]+)/i);
    if (moy) generalAverage = parseNumber(moy[1]);

    const subj = line.match(
      /^([A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜÇ][A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜÇa-zàâäéèêëïîôöùûüç\s]{2,30})\s+([\d,.]+)\s*$/
    );
    if (subj && !upper.includes('MOYENNE') && !upper.includes('BULLETIN')) {
      const score = parseNumber(subj[2]);
      if (score !== null) {
        subjects.push({ name: subj[1].trim(), score, maxScore: 20 });
      }
    }
  }

  return {
    studentName,
    academicYear,
    period,
    homeroomTeacher,
    subjects,
    generalAverage,
    rawTranscription: text,
    parseMethod: subjects.length || studentName ? 'heuristic' : 'none',
  };
}

export async function parseHandwrittenBulletinFromText(
  text: string,
  organizationId?: string
): Promise<ParsedHandwrittenBulletin> {
  const raw = text.trim();
  if (!raw) {
    return {
      studentName: null,
      academicYear: null,
      period: null,
      homeroomTeacher: null,
      subjects: [],
      generalAverage: null,
      rawTranscription: '',
      parseMethod: 'none',
    };
  }

  if (hasActiveLlmApi()) {
    const prompt = [
      'Analyse ce texte extrait d\'un bulletin scolaire manuscrit (OCR).',
      'Réponds UNIQUEMENT avec un JSON valide (pas de markdown) de la forme :',
      '{"studentName":string|null,"academicYear":string|null,"period":string|null,',
      '"homeroomTeacher":string|null,"generalAverage":number|null,',
      '"subjects":[{"name":string,"score":number,"maxScore":number}]}',
      'Utilise null si une information est absente. maxScore par défaut 20.',
    ].join('\n');

    const rawJson = await queryKonaAI(
      prompt,
      raw,
      organizationId
        ? { organizationId, operation: 'parse_bulletin' }
        : undefined
    );
    try {
      const cleaned = rawJson.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as {
        studentName?: string | null;
        academicYear?: string | null;
        period?: string | null;
        homeroomTeacher?: string | null;
        generalAverage?: number | null;
        subjects?: Array<{ name: string; score: number; maxScore?: number }>;
      };
      return {
        studentName: parsed.studentName ?? null,
        academicYear: parsed.academicYear ?? null,
        period: parsed.period ?? null,
        homeroomTeacher: parsed.homeroomTeacher ?? null,
        generalAverage:
          typeof parsed.generalAverage === 'number' ? parsed.generalAverage : null,
        subjects: (parsed.subjects ?? [])
          .filter((s) => s?.name && typeof s.score === 'number')
          .map((s) => ({
            name: s.name,
            score: s.score,
            maxScore: s.maxScore ?? 20,
          })),
        rawTranscription: raw,
        parseMethod: 'llm',
      };
    } catch {
      /* fallback heuristic */
    }
  }

  return heuristicParse(raw);
}

export function formatParsedBulletinForPrompt(parsed: ParsedHandwrittenBulletin): string {
  const lines = [
    '=== BULLETIN MANUSCRIT (extrait OCR) ===',
    parsed.studentName ? `Élève : ${parsed.studentName}` : '',
    parsed.academicYear ? `Année scolaire : ${parsed.academicYear}` : '',
    parsed.period ? `Période : ${parsed.period}` : '',
    parsed.homeroomTeacher ? `Professeur(e) principal(e) : ${parsed.homeroomTeacher}` : '',
    '',
    'Notes extraites :',
  ].filter(Boolean);

  if (parsed.subjects.length) {
    for (const s of parsed.subjects) {
      lines.push(`• ${s.name} : ${s.score}/${s.maxScore}`);
    }
  } else {
    lines.push('(aucune note structurée — voir transcription brute ci-dessous)');
  }

  if (parsed.generalAverage != null) {
    lines.push('', `Moyenne générale : ${parsed.generalAverage}`);
  }

  lines.push('', '--- Transcription brute ---', parsed.rawTranscription.slice(0, 6000));
  return lines.join('\n');
}
