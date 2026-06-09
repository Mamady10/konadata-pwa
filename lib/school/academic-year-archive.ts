/** Construction des exports CSV pour une année scolaire clôturée */

export type AcademicYearArchiveCategory =
  | 'scolarite'
  | 'finances'
  | 'bulletins'
  | 'notes'
  | 'classes'
  | 'synthese';

export const ARCHIVE_CATEGORY_LABELS: Record<AcademicYearArchiveCategory, string> = {
  scolarite: 'Scolarité (élèves & dossiers)',
  finances: 'Finances (paiements)',
  bulletins: 'Bulletins',
  notes: 'Notes & évaluations',
  classes: 'Classes',
  synthese: 'Synthèse',
};

export type ArchiveRecord = {
  category: AcademicYearArchiveCategory;
  file_name: string;
  content_type: string;
  content: string;
  row_count: number;
};

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(';')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(';'));
  }
  return lines.join('\n');
}

export async function buildAcademicYearArchives(
  supabase: {
    from: (table: string) => ReturnType<import('@supabase/supabase-js').SupabaseClient['from']>;
  },
  orgId: string,
  year: string
): Promise<ArchiveRecord[]> {
  const archives: ArchiveRecord[] = [];

  const { data: yearClasses } = await supabase
    .from('school_classes')
    .select('id, name, level, department, program, capacity, tuition_fee_gnf, is_active')
    .eq('organization_id', orgId)
    .eq('academic_year', year)
    .order('name');

  const classIds = (yearClasses ?? []).map((c) => c.id as string);
  const classNameById = new Map(
    (yearClasses ?? []).map((c) => [c.id as string, c.name as string])
  );

  const classRows = (yearClasses ?? []).map((c) => [
    c.name,
    c.level ?? '',
    c.department ?? '',
    c.program ?? '',
    c.capacity ?? '',
    c.tuition_fee_gnf ?? '',
    c.is_active ? 'oui' : 'non',
  ]);
  archives.push({
    category: 'classes',
    file_name: `classes-${year}.csv`,
    content_type: 'text/csv',
    content: toCsv(
      ['classe', 'niveau', 'departement', 'filiere', 'capacite', 'frais_scolarite_gnf', 'active'],
      classRows
    ),
    row_count: classRows.length,
  });

  const { data: enrollments } = await supabase
    .from('school_enrollments')
    .select(
      'id, status, request_type, applicant_name, applicant_email, applicant_phone, academic_year, created_at, school_classes(name), school_students(matricule, enrollment_status, core_persons(full_name))'
    )
    .eq('organization_id', orgId)
    .eq('academic_year', year)
    .order('created_at', { ascending: false });

  const scolariteRows = (enrollments ?? []).map((e) => {
    const st = e.school_students as
      | { matricule?: string; enrollment_status?: string; core_persons?: { full_name?: string } }
      | { matricule?: string; enrollment_status?: string; core_persons?: { full_name?: string } }[]
      | null;
    const student = Array.isArray(st) ? st[0] : st;
    const cls = e.school_classes as { name?: string } | { name?: string }[] | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    const person = student?.core_persons;
    const fullName = Array.isArray(person) ? person[0]?.full_name : person?.full_name;
    return [
      student?.matricule ?? '',
      fullName ?? e.applicant_name ?? '',
      e.applicant_name ?? '',
      e.applicant_email ?? '',
      e.applicant_phone ?? '',
      className ?? '',
      e.request_type ?? 'new',
      e.status ?? '',
      e.created_at ?? '',
    ];
  });
  archives.push({
    category: 'scolarite',
    file_name: `scolarite-${year}.csv`,
    content_type: 'text/csv',
    content: toCsv(
      [
        'matricule',
        'nom_eleve',
        'demandeur',
        'email',
        'telephone',
        'classe',
        'type_demande',
        'statut',
        'date_demande',
      ],
      scolariteRows
    ),
    row_count: scolariteRows.length,
  });

  let paymentQuery = supabase
    .from('school_payments')
    .select(
      'amount, currency, payment_method, status, reference, paid_at, created_at, description, academic_year, school_students(matricule, core_persons(full_name))'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  const { data: paymentsByYear } = await paymentQuery.eq('academic_year', year);
  let payments = paymentsByYear ?? [];

  if (payments.length === 0 && classIds.length > 0) {
    const { data: yearStudents } = await supabase
      .from('school_students')
      .select('id')
      .eq('organization_id', orgId)
      .in('class_id', classIds);
    const studentIds = (yearStudents ?? []).map((s) => s.id as string);
    if (studentIds.length > 0) {
      const { data: fallbackPayments } = await supabase
        .from('school_payments')
        .select(
          'amount, currency, payment_method, status, reference, paid_at, created_at, description, academic_year, school_students(matricule, core_persons(full_name))'
        )
        .eq('organization_id', orgId)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });
      payments = fallbackPayments ?? [];
    }
  }

  const financeRows = payments.map((p) => {
    const st = p.school_students as
      | { matricule?: string; core_persons?: { full_name?: string } }
      | { matricule?: string; core_persons?: { full_name?: string } }[]
      | null;
    const student = Array.isArray(st) ? st[0] : st;
    const person = student?.core_persons;
    const fullName = Array.isArray(person) ? person[0]?.full_name : person?.full_name;
    return [
      student?.matricule ?? '',
      fullName ?? '',
      p.amount ?? '',
      p.currency ?? 'GNF',
      p.payment_method ?? '',
      p.status ?? '',
      p.description ?? '',
      p.reference ?? '',
      p.paid_at ?? '',
      p.academic_year ?? year,
    ];
  });
  archives.push({
    category: 'finances',
    file_name: `finances-${year}.csv`,
    content_type: 'text/csv',
    content: toCsv(
      [
        'matricule',
        'eleve',
        'montant',
        'devise',
        'mode',
        'statut',
        'description',
        'reference',
        'date_paiement',
        'annee',
      ],
      financeRows
    ),
    row_count: financeRows.length,
  });

  const { data: reportCards } = await supabase
    .from('school_report_cards')
    .select(
      'semester, average_score, rank, publication_status, generated_at, school_students(matricule, core_persons(full_name)), school_classes(name)'
    )
    .eq('organization_id', orgId)
    .eq('academic_year', year)
    .order('generated_at', { ascending: false });

  const bulletinRows = (reportCards ?? []).map((r) => {
    const st = r.school_students as
      | { matricule?: string; core_persons?: { full_name?: string } }
      | { matricule?: string; core_persons?: { full_name?: string } }[]
      | null;
    const student = Array.isArray(st) ? st[0] : st;
    const person = student?.core_persons;
    const fullName = Array.isArray(person) ? person[0]?.full_name : person?.full_name;
    const cls = r.school_classes as { name?: string } | { name?: string }[] | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    return [
      student?.matricule ?? '',
      fullName ?? '',
      className ?? '',
      r.semester ?? '',
      r.average_score ?? '',
      r.rank ?? '',
      r.publication_status ?? '',
      r.generated_at ?? '',
    ];
  });
  archives.push({
    category: 'bulletins',
    file_name: `bulletins-${year}.csv`,
    content_type: 'text/csv',
    content: toCsv(
      [
        'matricule',
        'eleve',
        'classe',
        'semestre',
        'moyenne',
        'rang',
        'publication',
        'genere_le',
      ],
      bulletinRows
    ),
    row_count: bulletinRows.length,
  });

  const { data: grades } = await supabase
    .from('school_grades')
    .select(
      'exam_type, score, max_score, semester, academic_year, school_students(matricule, core_persons(full_name)), school_subjects(name), school_classes(name)'
    )
    .eq('organization_id', orgId)
    .eq('academic_year', year)
    .order('created_at', { ascending: false });

  const noteRows = (grades ?? []).map((g) => {
    const st = g.school_students as
      | { matricule?: string; core_persons?: { full_name?: string } }
      | { matricule?: string; core_persons?: { full_name?: string } }[]
      | null;
    const student = Array.isArray(st) ? st[0] : st;
    const person = student?.core_persons;
    const fullName = Array.isArray(person) ? person[0]?.full_name : person?.full_name;
    const sub = g.school_subjects as { name?: string } | { name?: string }[] | null;
    const subjectName = Array.isArray(sub) ? sub[0]?.name : sub?.name;
    const cls = g.school_classes as { name?: string } | { name?: string }[] | null;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    return [
      student?.matricule ?? '',
      fullName ?? '',
      className ?? '',
      subjectName ?? '',
      g.exam_type ?? '',
      g.score ?? '',
      g.max_score ?? '',
      g.semester ?? '',
    ];
  });
  archives.push({
    category: 'notes',
    file_name: `notes-${year}.csv`,
    content_type: 'text/csv',
    content: toCsv(
      ['matricule', 'eleve', 'classe', 'matiere', 'evaluation', 'note', 'sur', 'semestre'],
      noteRows
    ),
    row_count: noteRows.length,
  });

  const enrolledCount = scolariteRows.filter((r) => r[7] === 'enrolled').length;
  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const synthese = {
    academic_year: year,
    classes: classRows.length,
    enrollments: scolariteRows.length,
    enrolled: enrolledCount,
    payments: financeRows.length,
    total_paid_gnf: totalPaid,
    report_cards: bulletinRows.length,
    grades: noteRows.length,
    exported_at: new Date().toISOString(),
  };
  archives.push({
    category: 'synthese',
    file_name: `synthese-${year}.json`,
    content_type: 'application/json',
    content: JSON.stringify(synthese, null, 2),
    row_count: 1,
  });

  return archives;
}
