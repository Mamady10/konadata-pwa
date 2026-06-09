import { createClient } from '@/lib/supabase/server';
import { getAiTemplateContext } from '@/lib/ai/adapt-from-template';
import { getTemplatePurposeDef } from '@/lib/ai/document-template-purposes';
import {
  formatParsedBulletinForPrompt,
  parseHandwrittenBulletinFromText,
  type ParsedHandwrittenBulletin,
} from '@/lib/ai/school/handwritten-bulletin';
import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';
import { processDocumentAfterUpload } from '@/lib/documents/process-document-after-upload';
import { renderOfflineReport, type ReportSection } from '@/lib/ai/reports/render-report';
import { buildOfflineTemplateGuidance } from '@/lib/ai/offline-template-guidance';

export interface GradeScanDocumentContext {
  documentId: string;
  fileName: string;
  label: string | null;
  className: string;
  subjectName: string;
  examType: string;
  semester: string;
  academicYear: string;
  classId: string;
  subjectId: string;
}

async function loadScanDocumentContext(
  orgId: string,
  documentId: string
): Promise<GradeScanDocumentContext | { error: string }> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from('school_grade_evaluation_documents')
    .select('id, label, evaluation_id, documents(id, file_name, file_path, mime_type)')
    .eq('organization_id', orgId)
    .eq('document_id', documentId)
    .maybeSingle();

  if (!link) {
    return { error: 'Ce fichier n\'est pas lié à une évaluation enseignant (Résultats → Pièces jointes).' };
  }

  const doc = link.documents as {
    id?: string;
    file_name?: string;
    file_path?: string;
  } | null;

  if (!doc?.file_path) return { error: 'Document introuvable.' };

  const { data: ev } = await supabase
    .from('school_grade_evaluations')
    .select('class_id, subject_id, exam_type, semester, academic_year')
    .eq('id', link.evaluation_id as string)
    .maybeSingle();

  if (!ev?.class_id || !ev?.subject_id) {
    return { error: 'Évaluation incomplète (classe ou matière manquante).' };
  }

  const [{ data: cls }, { data: sub }] = await Promise.all([
    supabase.from('school_classes').select('name').eq('id', ev.class_id).maybeSingle(),
    supabase.from('school_subjects').select('name').eq('id', ev.subject_id).maybeSingle(),
  ]);

  return {
    documentId: doc.id as string,
    fileName: doc.file_name ?? 'Document',
    label: (link.label as string) ?? null,
    className: (cls?.name as string) ?? 'Classe',
    subjectName: (sub?.name as string) ?? 'Matière',
    examType: ev.exam_type ?? 'Évaluation',
    semester: ev.semester ?? 'S1',
    academicYear: ev.academic_year ?? '',
    classId: ev.class_id as string,
    subjectId: ev.subject_id as string,
  };
}

export async function ensureScanDocumentExtracted(
  orgId: string,
  documentId: string
): Promise<{ text: string; message?: string } | { error: string }> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_path, file_name, mime_type, search_text, extracted_data, organization_id')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!doc?.file_path) return { error: 'Document introuvable.' };

  const existing = (doc.search_text as string)?.trim();
  if (existing && existing.length > 20) {
    return { text: existing };
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from('documents')
    .download(doc.file_path as string);

  if (dlErr || !blob) {
    return { error: dlErr?.message ?? 'Impossible de télécharger le fichier.' };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const res = await processDocumentAfterUpload(supabase, {
    documentId: doc.id as string,
    organizationId: orgId,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: doc.mime_type as string | null,
    fileBuffer: buffer,
    previousExtracted: (doc.extracted_data as Record<string, unknown>) ?? {},
  });

  const { data: refreshed } = await supabase
    .from('documents')
    .select('search_text')
    .eq('id', documentId)
    .single();

  const text = (refreshed?.search_text as string)?.trim() ?? '';
  if (!text) {
    return {
      error:
        res.message ??
        'Aucun texte extrait. Pour un manuscrit, configurez OPENAI_API_KEY (Vision) et réessayez.',
    };
  }

  return { text, message: res.message };
}

export async function generateBulletinFromScannedDocument(params: {
  orgId: string;
  orgName: string;
  documentId: string;
}): Promise<
  | {
      content: string;
      usedLlm: boolean;
      title: string;
      subtitle: string;
      scopeLabel: string;
      scopeId: string;
      templatePurpose: string;
      reportTypeLabel: string;
      parsed: ParsedHandwrittenBulletin;
      context: GradeScanDocumentContext;
    }
  | { error: string }
> {
  const ctxRes = await loadScanDocumentContext(params.orgId, params.documentId);
  if ('error' in ctxRes) return ctxRes;
  const ctx = ctxRes;

  const template = await getAiTemplateContext(params.orgId, 'school', 'school_bulletin');
  if (!template) {
    const def = getTemplatePurposeDef('school', 'school_bulletin');
    return {
      error: `Aucun modèle IA « Bulletin scolaire » enregistré. Déposez-le dans Paramètres → Modèles IA (${def?.hint ?? ''}).`,
    };
  }

  const extracted = await ensureScanDocumentExtracted(params.orgId, params.documentId);
  if ('error' in extracted) return extracted;

  const parsed = await parseHandwrittenBulletinFromText(extracted.text, params.orgId);

  const supabase = await createClient();
  const { data: docRow } = await supabase
    .from('documents')
    .select('extracted_data')
    .eq('id', params.documentId)
    .maybeSingle();
  const prev = (docRow?.extracted_data as Record<string, unknown>) ?? {};
  await supabase
    .from('documents')
    .update({
      extracted_data: {
        ...prev,
        handwritten_bulletin: parsed,
        handwritten_bulletin_at: new Date().toISOString(),
      },
    })
    .eq('id', params.documentId);

  const scopeLabel = `${ctx.className} — ${ctx.subjectName}`;
  const title = `Bulletin (scan) — ${parsed.studentName ?? ctx.fileName} — ${scopeLabel}`;
  const subtitle = `${params.orgName} · modèle « ${template.label} » · ${ctx.examType} ${ctx.semester}`;

  const templateBlock = [
    '=== MODÈLE DE RÉFÉRENCE (direction) ===',
    `Libellé : ${template.label}`,
    `Fichier modèle : ${template.fileName}`,
    template.purposeHint ? `Objectif : ${template.purposeHint}` : '',
    template.notes ? `Consignes direction : ${template.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const scanBlock = [
    '=== CONTEXTE ÉVALUATION ===',
    `Classe : ${ctx.className}`,
    `Matière enseignant : ${ctx.subjectName}`,
    `Type : ${ctx.examType}`,
    `Semestre : ${ctx.semester}`,
    `Année scolaire (session) : ${ctx.academicYear}`,
    `Fichier source : ${ctx.label ?? ctx.fileName}`,
    '',
    formatParsedBulletinForPrompt(parsed),
  ].join('\n');

  const dataBlock = `${templateBlock}\n\n${scanBlock}`;

  if (hasActiveLlmApi()) {
    const userPrompt = [
      'Produisez un bulletin scolaire complet à partir du scan manuscrit fourni.',
      'Reproduisez strictement la structure, les rubriques et le ton du modèle IA de référence.',
      'Intégrez toutes les notes et informations lisibles sur le scan (élève, matières, moyenne, période).',
      'N\'inventez pas de notes absentes du scan. Mentionnez les lacunes si l\'OCR est incomplet.',
      'Format : markdown avec titres ##, tableaux si utile, appréciations courtes par matière si le modèle le prévoit.',
    ].join('\n');

    const content = await queryKonaAI(userPrompt, dataBlock, {
      organizationId: params.orgId,
      operation: 'report',
    });
    return {
      content,
      usedLlm: true,
      title,
      subtitle,
      scopeLabel,
      scopeId: ctx.classId,
      templatePurpose: 'school_bulletin',
      reportTypeLabel: 'Bulletin (scan manuscrit + modèle IA)',
      parsed,
      context: ctx,
    };
  }

  const guidance = buildOfflineTemplateGuidance({
    sector: 'school',
    template,
    producedFileName: title,
    producedDocType: 'Bulletin scolaire (scan)',
  });

  const sections: ReportSection[] = [
    {
      heading: 'Données extraites du scan',
      lines: formatParsedBulletinForPrompt(parsed).split('\n').filter((l) => l.trim()),
    },
    {
      heading: 'Alignement modèle IA',
      lines: guidance.split('\n').filter((l) => l.trim()),
    },
  ];

  const content = renderOfflineReport({
    title,
    subtitle,
    sections,
    modeLabel:
      'Mode local — configurez OPENAI_API_KEY pour rédiger le bulletin final selon le modèle et le scan.',
  });

  return {
    content,
    usedLlm: false,
    title,
    subtitle,
    scopeLabel,
    scopeId: ctx.classId,
    templatePurpose: 'school_bulletin',
    reportTypeLabel: 'Bulletin (scan — mode local)',
    parsed,
    context: ctx,
  };
}
