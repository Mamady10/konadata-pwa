'use server';

import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { previewAiDocumentExtract } from '@/lib/actions/ai-document-extract';
import {
  rosterRowsToStudentImport,
  type RosterExtractResult,
} from '@/lib/ai/extraction/roster-extract';
import type { StudentImportRow } from '@/lib/school/student-import';
import { parseStudentImportFileServer } from '@/lib/school/student-import-file-server';

export type StudentImportAiPreview = {
  rows: StudentImportRow[];
  warnings: string[];
  fileName: string;
  usedAi: boolean;
  extractionMethod?: string;
  detectedClassName?: string | null;
  detectedCount?: number | null;
  quotaHint?: string;
};

function needsAiFallback(
  fileName: string,
  rowCount: number,
  warnings: string[]
): boolean {
  const isImage = /\.(jpe?g|png|webp|heic|heif|tiff?|gif)$/i.test(fileName);
  if (isImage) return true;
  if (rowCount > 0) return false;
  const w = warnings.join(' ').toLowerCase();
  return (
    w.includes('scan') ||
    w.includes('impossible') ||
    w.includes('aucun texte') ||
    w.includes('photo') ||
    w.includes('ocr')
  );
}

/** Parse fichier élèves : classique puis KonaAI Vision si scan / image. */
export async function previewStudentImportWithAi(
  formData: FormData
): Promise<StudentImportAiPreview | { error: string }> {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.manageStudents) {
    return { error: 'Réservé à la direction ou la scolarité.' };
  }

  await requireOrgId();

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File)) return { error: 'Fichier requis.' };

  let rows: StudentImportRow[] = [];
  let warnings: string[] = [];
  let usedAi = false;
  let extractionMethod: string | undefined;
  let detectedClassName: string | null | undefined;
  let detectedCount: number | null | undefined;
  let quotaHint: string | undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseStudentImportFileServer(buffer, file.name, file.type || null);
  rows = parsed.rows;
  warnings = parsed.warnings;

  if (needsAiFallback(file.name, rows.length, warnings)) {
    const aiForm = new FormData();
    aiForm.set('file', file);
    const aiRes = await previewAiDocumentExtract(aiForm, {
      purpose: 'student_roster',
      structureList: true,
    });

    if ('error' in aiRes) {
      if (rows.length > 0) {
        warnings.push(`KonaAI : ${aiRes.error}`);
      } else {
        return { error: aiRes.error };
      }
    } else {
      usedAi = true;
      extractionMethod = aiRes.extractionMethod;
      quotaHint = aiRes.quotaHint;
      const roster: RosterExtractResult | null = aiRes.roster;
      if (roster && roster.rows.length > 0) {
        rows = rosterRowsToStudentImport(roster.rows);
        warnings = [
          aiRes.message,
          ...roster.warnings,
          ...(aiRes.quotaHint ? [aiRes.quotaHint] : []),
        ].filter((w): w is string => Boolean(w));
        detectedClassName = roster.detectedClassName;
        detectedCount = roster.detectedCount ?? roster.rows.length;
      } else if (!rows.length) {
        return {
          error:
            aiRes.message ??
            'KonaAI n\'a pas reconnu de liste d\'élèves. Essayez CSV/Excel ou une photo plus nette.',
        };
      }
    }
  }

  if (!rows.length) {
    return {
      error:
        warnings[0] ??
        'Aucun élève détecté. Utilisez le modèle CSV ou une liste plus lisible.',
    };
  }

  return {
    rows,
    warnings,
    fileName: file.name,
    usedAi,
    extractionMethod,
    detectedClassName,
    detectedCount,
    quotaHint,
  };
}
