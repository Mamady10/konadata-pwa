'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getMyAssignedBtpSiteIds, getMyAssignedNgoProjectIds } from '@/lib/actions/assignments';
import { importSchoolStudentsBatch } from '@/lib/actions/school';
import type { StudentImportRow } from '@/lib/school/student-import';
import type {
  CaptureExtractionResult,
  CaptureGradeSheetRow,
} from '@/lib/ai/extraction/capture-extract-types';
import {
  type CaptureApplyResult,
  currentAcademicYear,
  loadCaptureDocument,
  markDocumentCaptureApplied,
  normalizePersonName,
  parseIntegerValue,
  parseNumericValue,
  parseOptionalDate,
  resolveBtpSiteIdForDocument,
  resolveNgoProjectIdForDocument,
} from '@/lib/capture/capture-apply-helpers';
import { createBtpDeliveryNoteFromParams } from '@/lib/actions/btp-financial';

export type { CaptureApplyResult };

export interface CaptureApplyParams {
  classId?: string;
  siteId?: string;
  projectId?: string;
  examType?: string;
  semester?: string;
  academicYear?: string;
  defaultMaxScore?: number;
  sendSmsToGuardians?: boolean;
}

const GRADE_COLUMNS: { key: keyof CaptureGradeSheetRow; labels: string[] }[] = [
  { key: 'maths', labels: ['maths', 'mathématiques', 'mathematiques', 'math'] },
  { key: 'francais', labels: ['français', 'francais', 'francais'] },
  { key: 'anglais', labels: ['anglais', 'english', 'ang'] },
  { key: 'svt', labels: ['svt', 'sciences', 'svt sciences'] },
  { key: 'hist_geo', labels: ['hist_geo', 'histoire', 'hist-géo', 'histoire geo', 'histoire-geographie'] },
];

function resolveSubjectId(
  subjects: Array<{ id: string; name: string }>,
  labels: string[]
): string | null {
  const normalized = subjects.map((s) => ({
    id: s.id,
    name: normalizePersonName(s.name),
  }));
  for (const label of labels) {
    const needle = normalizePersonName(label);
    const exact = normalized.find((s) => s.name === needle);
    if (exact) return exact.id;
    const partial = normalized.find((s) => s.name.includes(needle) || needle.includes(s.name));
    if (partial) return partial.id;
  }
  return null;
}

function revalidateForKind(kind: string): void {
  if (kind.startsWith('grade') || kind === 'class_list' || kind === 'attendance') {
    revalidatePath('/etablissement/rapports');
    revalidatePath('/etablissement/etudiants');
    revalidatePath('/etablissement/resultats');
    revalidatePath('/etablissement/bulletins');
    revalidatePath('/etablissement/vie-scolaire');
  }
  if (kind.includes('fuel') || kind.includes('delivery') || kind.includes('daily_site') || kind.includes('btp')) {
    revalidatePath('/btp/documents');
    revalidatePath('/btp/carburant');
    revalidatePath('/btp/bons');
    revalidatePath('/btp/materiels');
    revalidatePath('/btp/avancement');
    revalidatePath('/btp/rapports');
    revalidatePath('/btp/finances');
  }
  if (kind.includes('expense') || kind.includes('purchase') || kind.includes('stock')) {
    revalidatePath('/pme/documents');
    revalidatePath('/pme/depenses');
    revalidatePath('/pme/achats');
    revalidatePath('/pme/stocks');
    revalidatePath('/pme/rapports');
  }
  if (
    kind.includes('beneficiary') ||
    kind.includes('field') ||
    kind.includes('workshop') ||
    kind.includes('ngo')
  ) {
    revalidatePath('/ong/documents');
    revalidatePath('/ong/beneficiaires');
    revalidatePath('/ong/rapports');
    revalidatePath('/ong/projets');
  }
}

export async function applyCaptureToDatabase(
  documentId: string,
  params: CaptureApplyParams = {}
): Promise<CaptureApplyResult> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const loaded = await loadCaptureDocument(supabase, orgId, documentId);
  if ('error' in loaded) return { error: loaded.error };

  const { capture, extracted } = loaded;
  let result: CaptureApplyResult;

  switch (capture.kind) {
    case 'class_list':
      result = await applyClassList(orgId, capture, documentId, params);
      break;
    case 'grade_sheet':
      result = await applyGradeSheet(orgId, supabase, capture, params);
      break;
    case 'fuel_sheet':
      result = await applyFuelSheet(orgId, supabase, documentId, extracted, capture, params.siteId);
      break;
    case 'delivery_note':
      result = await applyDeliveryNote(orgId, supabase, documentId, extracted, capture, params.siteId);
      break;
    case 'daily_site_report':
      result = await applyDailySiteReport(orgId, supabase, documentId, extracted, capture, params.siteId);
      break;
    case 'expense_sheet':
      result = await applyExpenseSheet(orgId, supabase, capture);
      break;
    case 'purchase_order':
      result = await applyPurchaseOrder(orgId, supabase, capture);
      break;
    case 'stock_count':
      result = await applyStockCount(orgId, supabase, capture);
      break;
    case 'beneficiary_row':
      result = await applyBeneficiary(orgId, supabase, documentId, extracted, capture, params.projectId);
      break;
    case 'field_report':
      result = await applyFieldReport(orgId, supabase, documentId, extracted, capture, params.projectId);
      break;
    case 'workshop_attendance':
      result = await applyWorkshopAttendance(orgId, supabase, documentId, extracted, capture, params.projectId);
      break;
    case 'attendance':
      result = await applySchoolAttendance(supabase, orgId, documentId, capture, params);
      break;
    default:
      return { error: `Type ${capture.kind} non pris en charge pour l'application métier.` };
  }

  if (!result.error) {
    await markDocumentCaptureApplied(supabase, documentId, orgId, extracted, {
      ...result,
      kind: capture.kind,
    });
    revalidateForKind(capture.kind);
  }

  return result;
}

async function applyClassList(
  _orgId: string,
  capture: CaptureExtractionResult,
  _documentId: string,
  params: CaptureApplyParams
): Promise<CaptureApplyResult> {
  const classId = params.classId;
  if (!classId) return { error: 'Sélectionnez une classe.' };
  if (capture.payload.shape !== 'person_rows') return { error: 'Format invalide.' };

  const rows: StudentImportRow[] = capture.payload.rows
    .filter((r) => r.full_name?.trim())
    .map((r, i) => ({
      full_name: r.full_name.trim(),
      matricule: r.identifier?.trim(),
      phone: r.phone?.trim(),
      email: r.email?.trim(),
      sourceLine: i + 2,
    }));

  const batch = await importSchoolStudentsBatch(classId, rows, 'enrolled', {
    autoGenerateMatricules: true,
    sendSmsToGuardians: params.sendSmsToGuardians,
  });
  if ('error' in batch) return { error: batch.error };
  let message = `${batch.created} créé(s), ${batch.updated} mis à jour.`;
  if (batch.sms_sent) message += ` ${batch.sms_sent} SMS tuteur envoyé(s).`;
  return {
    created: batch.created,
    updated: batch.updated,
    message,
  };
}

async function applyGradeSheet(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  capture: { payload: { shape: string; rows?: CaptureGradeSheetRow[] } },
  params: CaptureApplyParams
): Promise<CaptureApplyResult> {
  if (!params.classId) return { error: 'Sélectionnez une classe.' };
  if (capture.payload.shape !== 'grade_sheet' || !capture.payload.rows?.length) {
    return { error: 'Grille de notes vide.' };
  }

  const examType = (params.examType ?? 'Devoir').trim();
  const semester = (params.semester ?? 'S1').trim();
  const academicYear = (params.academicYear ?? currentAcademicYear()).trim();
  const maxScore = params.defaultMaxScore ?? 20;

  const { data: students } = await supabase
    .from('school_students')
    .select('id, matricule, class_id, core_persons(full_name)')
    .eq('organization_id', orgId)
    .eq('class_id', params.classId);

  const byMatricule = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const s of students ?? []) {
    const m = (s.matricule as string)?.trim();
    if (m) byMatricule.set(m.toUpperCase(), s.id as string);
    const person = (s.core_persons ?? {}) as { full_name?: string };
    if (person.full_name) byName.set(normalizePersonName(person.full_name), s.id as string);
  }

  const { data: subjects } = await supabase
    .from('school_subjects')
    .select('id, name')
    .eq('organization_id', orgId);

  const subjectList = (subjects ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));

  const skipKeys = new Set(['full_name', 'student_code', 'moyenne']);
  const dynamicKeys = new Set<string>();
  for (const row of capture.payload.rows) {
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (skipKeys.has(k) || v == null || String(v).trim() === '') continue;
      dynamicKeys.add(k);
    }
  }

  const columnSubjects: Array<{ key: string; subjectId: string }> = [];
  const usedSubjectIds = new Set<string>();

  for (const col of GRADE_COLUMNS) {
    const subjectId = resolveSubjectId(subjectList, col.labels);
    if (subjectId && !usedSubjectIds.has(subjectId)) {
      columnSubjects.push({ key: col.key, subjectId });
      usedSubjectIds.add(subjectId);
    }
  }

  for (const key of dynamicKeys) {
    if (GRADE_COLUMNS.some((c) => c.key === key)) continue;
    const subjectId = resolveSubjectId(subjectList, [
      key,
      key.replace(/_/g, ' '),
      key.replace(/_/g, '-'),
    ]);
    if (subjectId && !usedSubjectIds.has(subjectId)) {
      columnSubjects.push({ key, subjectId });
      usedSubjectIds.add(subjectId);
    }
  }

  if (!columnSubjects.length) {
    return {
      error:
        'Aucune matière reconnue. Créez le catalogue dans Formations ou alignez les en-têtes du fichier.',
    };
  }

  let saved = 0;
  let skipped = 0;

  for (const row of capture.payload.rows) {
    let studentId: string | undefined;
    if (row.student_code) {
      studentId = byMatricule.get(row.student_code.trim().toUpperCase());
    }
    if (!studentId && row.full_name) {
      studentId = byName.get(normalizePersonName(row.full_name));
    }
    if (!studentId) {
      skipped++;
      continue;
    }

    for (const col of columnSubjects) {
      const raw = (row as Record<string, unknown>)[col.key];
      if (typeof raw !== 'string' && raw != null) continue;
      const score = parseNumericValue(raw as string | undefined);
      if (score === null) continue;

      const payload = {
        organization_id: orgId,
        student_id: studentId,
        subject_id: col.subjectId!,
        class_id: params.classId,
        exam_type: examType,
        semester,
        academic_year: academicYear,
        score,
        max_score: maxScore,
      };

      const { data: existing } = await supabase
        .from('school_grades')
        .select('id')
        .eq('organization_id', orgId)
        .eq('student_id', studentId)
        .eq('subject_id', col.subjectId!)
        .eq('class_id', params.classId)
        .eq('exam_type', examType)
        .eq('semester', semester)
        .eq('academic_year', academicYear)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('school_grades')
          .update({ score, max_score: maxScore })
          .eq('id', existing.id);
      } else {
        const { error } = await supabase.from('school_grades').insert(payload);
        if (error) {
          skipped++;
          continue;
        }
      }
      saved++;
    }
  }

  const { autoGenerateReportCardsAfterGrades } = await import(
    '@/lib/school/grades-to-bulletins'
  );
  const reportCards = await autoGenerateReportCardsAfterGrades(
    orgId,
    params.classId,
    semester,
    academicYear,
    { auto: true }
  );

  let message = `${saved} note(s) enregistrée(s)${skipped ? `, ${skipped} ligne(s) ignorée(s)` : ''}.`;
  if (reportCards.autoGenerated && reportCards.generatedCount) {
    message += ` ${reportCards.generatedCount} bulletin(s) provisoire(s) généré(s) automatiquement.`;
  } else if (reportCards.ready) {
    message += ` Couverture notes ${reportCards.coveragePct}% — générez les bulletins.`;
  }

  return {
    saved,
    skipped,
    message,
    reportCards,
  };
}

async function applyFuelSheet(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  extracted: Record<string, unknown>,
  capture: { payload: { shape: string; rows?: Array<Record<string, string | undefined>> } },
  siteIdParam?: string
): Promise<CaptureApplyResult> {
  const siteRes = await resolveBtpSiteIdForDocument(supabase, orgId, documentId, extracted, siteIdParam);
  if (typeof siteRes !== 'string') return siteRes;

  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteRes)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }

  if (capture.payload.shape !== 'fuel_rows' || !capture.payload.rows?.length) {
    return { error: 'Fiche carburant vide.' };
  }

  let saved = 0;
  let skipped = 0;

  for (const row of capture.payload.rows) {
    const liters = parseNumericValue(row.liters);
    if (!liters || liters <= 0) {
      skipped++;
      continue;
    }
    const notes = [row.equipment, row.driver, row.meter_index ? `Index ${row.meter_index}` : null, row.remark]
      .filter(Boolean)
      .join(' · ');

    const dateStr = parseOptionalDate(row.date);
    const loggedAt = dateStr ? `${dateStr}T12:00:00.000Z` : new Date().toISOString();

    const { error } = await supabase.from('btp_fuel_logs').insert({
      organization_id: orgId,
      site_id: siteRes,
      liters,
      notes: notes || null,
      logged_at: loggedAt,
    });
    if (error) skipped++;
    else saved++;
  }

  return { saved, skipped, message: `${saved} plein(s) enregistré(s).` };
}

async function applyDeliveryNote(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  extracted: Record<string, unknown>,
  capture: { payload: { shape: string; rows?: Array<Record<string, string | undefined>> } },
  siteIdParam?: string
): Promise<CaptureApplyResult> {
  const siteRes = await resolveBtpSiteIdForDocument(supabase, orgId, documentId, extracted, siteIdParam);
  if (typeof siteRes !== 'string') return siteRes;

  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteRes)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }

  if (capture.payload.shape !== 'delivery_rows' || !capture.payload.rows?.length) {
    return { error: 'Bon de livraison vide.' };
  }

  const items = capture.payload.rows.map((r) => ({
    item: r.material ?? 'Matériau',
    category: 'materials' as const,
    qty: Number(r.quantity) > 0 ? Number(r.quantity) : r.quantity ?? '',
    unit: r.unit ?? undefined,
    description: r.received_by ? `Reçu par : ${r.received_by}` : undefined,
  }));

  const first = capture.payload.rows[0];
  const supplier =
    capture.payload.rows.map((r) => r.supplier).find(Boolean) ?? first.supplier ?? null;
  const deliveryDate = parseOptionalDate(
    capture.payload.rows.map((r) => r.date).find(Boolean) ?? first.date
  ) ?? new Date().toISOString().slice(0, 10);

  const reference = `BL-${documentId.slice(0, 8).toUpperCase()}-${Date.now().toString(36)}`;

  const totalFromRows = capture.payload.rows.reduce(
    (sum, r) => sum + (Number(r.amount) || Number(r.total) || 0),
    0
  );
  const totalAmount =
    totalFromRows > 0
      ? totalFromRows
      : Number(extracted.total_amount ?? extracted.amount ?? 0) || items.length * 1000;

  const description =
    (extracted.description as string) ||
    `Import capture — ${items.length} ligne(s)${supplier ? ` — ${supplier}` : ''}`;

  const result = await createBtpDeliveryNoteFromParams({
    orgId,
    siteId: siteRes,
    reference,
    amount: totalAmount,
    category: 'materials',
    description,
    items,
    documentId,
    status: 'draft',
    addToStock: false,
    supplier,
    deliveryDate,
    skipAccessCheck: true,
  });

  if ('error' in result) return { error: result.error };
  return { saved: items.length, message: `Bon ${reference} créé en brouillon (${items.length} ligne(s)). Validez-le depuis Bons.` };
}

async function applyDailySiteReport(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  extracted: Record<string, unknown>,
  capture: { payload: { shape: string; fields?: Record<string, string | undefined> } },
  siteIdParam?: string
): Promise<CaptureApplyResult> {
  const siteRes = await resolveBtpSiteIdForDocument(supabase, orgId, documentId, extracted, siteIdParam);
  if (typeof siteRes !== 'string') return siteRes;

  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteRes)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }

  if (capture.payload.shape !== 'daily_site_report') return { error: 'Rapport journalier invalide.' };
  const f = capture.payload.fields ?? {};

  const progressDate = parseOptionalDate(f.date) ?? new Date().toISOString().slice(0, 10);
  const workersCount = parseIntegerValue(f.workforce);
  const notes = [
    f.tasks ? `Travaux : ${f.tasks}` : null,
    f.materials ? `Matériels : ${f.materials}` : null,
    f.incidents ? `Incidents : ${f.incidents}` : null,
    f.observations ? `Observations : ${f.observations}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('btp_daily_progress').insert({
    organization_id: orgId,
    site_id: siteRes,
    progress_date: progressDate,
    workers_count: workersCount,
    notes: notes || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  return { saved: 1, message: `Rapport journalier enregistré pour le ${progressDate}.` };
}

async function applyExpenseSheet(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  capture: { payload: { shape: string; rows?: Array<Record<string, string | undefined>> } }
): Promise<CaptureApplyResult> {
  if (capture.payload.shape !== 'expense_rows' || !capture.payload.rows?.length) {
    return { error: 'Fiche dépenses vide.' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  let saved = 0;
  let skipped = 0;

  for (const row of capture.payload.rows) {
    const amount = parseNumericValue(row.amount_gnf);
    if (!amount || amount <= 0) {
      skipped++;
      continue;
    }
    const parts = [row.label, row.payment_mode ? `(${row.payment_mode})` : null, row.receipt_ref ? `Réf. ${row.receipt_ref}` : null]
      .filter(Boolean)
      .join(' ');

    const { error } = await supabase.from('pme_expenses').insert({
      organization_id: orgId,
      category: row.payment_mode?.trim() || 'general',
      description: parts || 'Dépense importée',
      amount,
      expense_date: parseOptionalDate(row.date) ?? new Date().toISOString().slice(0, 10),
      created_by: user?.id ?? null,
    });
    if (error) skipped++;
    else saved++;
  }

  return { saved, skipped, message: `${saved} dépense(s) enregistrée(s).` };
}

async function applyPurchaseOrder(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  capture: { payload: { shape: string; rows?: Array<Record<string, string | undefined>> } }
): Promise<CaptureApplyResult> {
  if (capture.payload.shape !== 'purchase_rows' || !capture.payload.rows?.length) {
    return { error: 'Bon de commande vide.' };
  }

  const items = capture.payload.rows.map((r) => ({
    product: r.designation ?? 'Article',
    qty: r.quantity ?? '',
    unit_price: r.unit_price_gnf ?? '',
    total: r.total_gnf ?? '',
    remark: r.remark ?? '',
  }));

  let total = 0;
  for (const r of capture.payload.rows) {
    const lineTotal = parseNumericValue(r.total_gnf);
    if (lineTotal) total += lineTotal;
  }
  if (!total) {
    for (const r of capture.payload.rows) {
      const qty = parseNumericValue(r.quantity) ?? 1;
      const unit = parseNumericValue(r.unit_price_gnf) ?? 0;
      total += qty * unit;
    }
  }

  const reference =
    capture.payload.rows.map((r) => r.reference).find(Boolean)?.trim() ||
    `BC-${Date.now().toString(36).toUpperCase()}`;

  const { error } = await supabase.from('pme_purchases').insert({
    organization_id: orgId,
    reference,
    items,
    total,
    notes: 'Import KonaData capture',
  });

  if (error) return { error: error.message };
  return { saved: items.length, message: `Achat ${reference} enregistré.` };
}

async function applyStockCount(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  capture: { payload: { shape: string; rows?: Array<Record<string, string | undefined>> } }
): Promise<CaptureApplyResult> {
  if (capture.payload.shape !== 'stock_rows' || !capture.payload.rows?.length) {
    return { error: 'Inventaire vide.' };
  }

  const { data: products } = await supabase
    .from('pme_products')
    .select('id, name, sku')
    .eq('organization_id', orgId);

  const bySku = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const p of products ?? []) {
    const sku = (p.sku as string)?.trim().toUpperCase();
    if (sku) bySku.set(sku, p.id as string);
    byName.set(normalizePersonName(p.name as string), p.id as string);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of capture.payload.rows) {
    const qty = parseNumericValue(row.quantity_counted);
    if (qty === null) {
      skipped++;
      continue;
    }

    let productId: string | undefined;
    const ref = row.reference?.trim().toUpperCase();
    if (ref) productId = bySku.get(ref);
    if (!productId && row.designation) {
      productId = byName.get(normalizePersonName(row.designation));
    }
    if (!productId) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('pme_products')
      .update({ stock_quantity: qty })
      .eq('id', productId)
      .eq('organization_id', orgId);

    if (error) skipped++;
    else updated++;
  }

  return {
    updated,
    skipped,
    message: `${updated} stock(s) mis à jour${skipped ? `, ${skipped} ligne(s) non reconnue(s)` : ''}.`,
  };
}

async function applyBeneficiary(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  extracted: Record<string, unknown>,
  capture: { payload: { shape: string; fields?: Record<string, string | undefined> } },
  projectIdParam?: string
): Promise<CaptureApplyResult> {
  if (capture.payload.shape !== 'beneficiary') return { error: 'Fiche bénéficiaire invalide.' };
  const f = capture.payload.fields ?? {};
  const fullName = f.full_name?.trim();
  if (!fullName) return { error: 'Nom du bénéficiaire manquant.' };

  let projectId: string | null = null;
  const projectRes = await resolveNgoProjectIdForDocument(
    supabase,
    orgId,
    documentId,
    extracted,
    projectIdParam
  );
  if (typeof projectRes === 'string') projectId = projectRes;
  else if (f.project?.trim()) {
    const { data: proj } = await supabase
      .from('ngo_projects')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('name', `%${f.project.trim()}%`)
      .maybeSingle();
    projectId = (proj?.id as string) ?? null;
  }

  const gender = f.sex_age?.trim() || null;

  const { data: person, error: personErr } = await supabase
    .from('core_persons')
    .insert({
      organization_id: orgId,
      kind: 'beneficiary',
      full_name: fullName,
      gender,
      phone: f.phone?.trim() || null,
    })
    .select('id')
    .single();

  if (personErr) return { error: personErr.message };

  const { error } = await supabase.from('ngo_beneficiaries').insert({
    organization_id: orgId,
    person_id: person.id,
    project_id: projectId,
    locality: f.locality?.trim() || null,
    category: f.remarks?.trim() || null,
  });

  if (error) return { error: error.message };
  return { created: 1, message: `Bénéficiaire « ${fullName} » créé.` };
}

async function applyFieldReport(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  extracted: Record<string, unknown>,
  capture: { payload: { shape: string; fields?: Record<string, string | undefined> } },
  projectIdParam?: string
): Promise<CaptureApplyResult> {
  const projectRes = await resolveNgoProjectIdForDocument(
    supabase,
    orgId,
    documentId,
    extracted,
    projectIdParam
  );
  if (typeof projectRes !== 'string') return projectRes;

  const assigned = await getMyAssignedNgoProjectIds();
  if (assigned !== null && !assigned.includes(projectRes)) {
    return { error: 'Vous n\'êtes pas assigné à ce projet.' };
  }

  if (capture.payload.shape !== 'field_report') return { error: 'Rapport terrain invalide.' };
  const f = capture.payload.fields ?? {};

  const name =
    f.activities?.trim().slice(0, 120) ||
    (f.location ? `Mission — ${f.location}` : 'Rapport d\'activité terrain');

  const description = [
    f.location ? `Lieu : ${f.location}` : null,
    f.participants ? `Participants : ${f.participants}` : null,
    f.activities ? `Activités : ${f.activities}` : null,
    f.results ? `Résultats : ${f.results}` : null,
    f.difficulties ? `Difficultés : ${f.difficulties}` : null,
    f.recommendations ? `Recommandations : ${f.recommendations}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const participants = parseIntegerValue(f.participants) ?? 0;
  const plannedDate = parseOptionalDate(f.date);

  const { error } = await supabase.from('ngo_activities').insert({
    organization_id: orgId,
    project_id: projectRes,
    name,
    description: description || null,
    planned_date: plannedDate,
    completed_date: plannedDate,
    is_completed: Boolean(plannedDate),
    participants,
  });

  if (error) return { error: error.message };
  return { saved: 1, message: 'Activité terrain enregistrée dans le projet.' };
}

async function applyWorkshopAttendance(
  orgId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  extracted: Record<string, unknown>,
  capture: {
    payload: {
      shape: string;
      rows?: Array<Record<string, string | undefined>>;
      meta?: Record<string, string>;
    };
  },
  projectIdParam?: string
): Promise<CaptureApplyResult> {
  const projectRes = await resolveNgoProjectIdForDocument(
    supabase,
    orgId,
    documentId,
    extracted,
    projectIdParam
  );
  if (typeof projectRes !== 'string') return projectRes;

  const assigned = await getMyAssignedNgoProjectIds();
  if (assigned !== null && !assigned.includes(projectRes)) {
    return { error: 'Vous n\'êtes pas assigné à ce projet.' };
  }

  if (capture.payload.shape !== 'person_rows' || !capture.payload.rows?.length) {
    return { error: 'Liste de présence vide.' };
  }

  const lines = capture.payload.rows
    .filter((r) => r.full_name?.trim())
    .map((r) => {
      const parts = [r.full_name.trim(), r.identifier, r.phone, r.remark].filter(Boolean);
      return parts.join(' — ');
    });

  const plannedDate = parseOptionalDate(capture.payload.meta?.date);

  const { error } = await supabase.from('ngo_activities').insert({
    organization_id: orgId,
    project_id: projectRes,
    name: 'Présence atelier',
    description: lines.join('\n'),
    planned_date: plannedDate,
    participants: lines.length,
    is_completed: Boolean(plannedDate),
  });

  if (error) return { error: error.message };
  return { saved: lines.length, message: `${lines.length} participant(s) enregistré(s).` };
}

async function applySchoolAttendance(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  documentId: string,
  capture: {
    payload: {
      shape: string;
      rows?: Array<Record<string, string | undefined>>;
      meta?: Record<string, string>;
    };
  },
  params: CaptureApplyParams
): Promise<CaptureApplyResult> {
  if (capture.payload.shape !== 'person_rows' || !capture.payload.rows?.length) {
    return { error: 'Registre de présence vide.' };
  }

  const sessionDate = capture.payload.meta?.date ?? null;

  if (params.classId) {
    const { persistCaptureAttendance } = await import('@/lib/actions/school-attendance');
    const persisted = await persistCaptureAttendance({
      orgId,
      classId: params.classId,
      documentId,
      sessionDate,
      rows: capture.payload.rows.map((r) => ({
        full_name: r.full_name ?? '',
        identifier: r.identifier,
        present: r.present,
        absent: r.absent,
        remark: r.remark,
      })),
    });

    if ('error' in persisted) return { error: persisted.error };

    return {
      saved: persisted.saved,
      message: `${persisted.saved} présence(s) enregistrée(s) : ${persisted.present} présent(s), ${persisted.absent} absent(s)${sessionDate ? ` — ${sessionDate}` : ''}.`,
    };
  }

  let present = 0;
  let absent = 0;
  const records = capture.payload.rows.map((r) => {
    const p = (r.present ?? '').toLowerCase();
    const a = (r.absent ?? '').toLowerCase();
    const isPresent = p === 'oui' || p === 'x' || p === '1' || p === 'p' || p === 'present';
    const isAbsent = a === 'oui' || a === 'x' || a === '1' || a === 'a' || a === 'absent';
    if (isPresent) present++;
    else if (isAbsent) absent++;
    return {
      full_name: r.full_name,
      identifier: r.identifier,
      present: r.present,
      absent: r.absent,
      remark: r.remark,
    };
  });

  return {
    saved: records.length,
    message: `Présence archivée (document) : ${present} présent(s), ${absent} absent(s)${sessionDate ? ` — ${sessionDate}` : ''}. Sélectionnez une classe pour enregistrer en base.`,
    extraExtracted: {
      school_attendance_log: {
        session_date: sessionDate,
        present_count: present,
        absent_count: absent,
        records,
        applied_at: new Date().toISOString(),
      },
    },
  };
}
