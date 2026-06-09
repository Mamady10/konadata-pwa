'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { revalidatePath } from 'next/cache';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { parseSchoolOrgSettings } from '@/lib/school/school-org-settings';
import {
  normalizeInstallmentsForSave,
  parseStudentPaymentSettings,
  sumInstallmentPercents,
  type StudentPaymentSettings,
  type TuitionInstallment,
} from '@/lib/school/student-payments';

export type AcademicYearClassFee = {
  id: string;
  name: string;
  level: string | null;
  tuition_fee_gnf: number | null;
};

export type AcademicYearFeeSetup = {
  year: string;
  orgDefaultTuitionGnf: number;
  paymentSettings: StudentPaymentSettings;
  classes: AcademicYearClassFee[];
};

async function requireDirector() {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector) {
    return { error: 'Seul le directeur peut modifier les tarifs et échéanciers.' as const };
  }
  return { session };
}

export async function getAcademicYearFeeSetup(
  targetYear?: string
): Promise<{ setup: AcademicYearFeeSetup } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('settings, type')
    .eq('id', orgId)
    .single();

  if (orgErr) return { error: orgErr.message };
  if (org?.type !== 'school') return { error: 'Réservé aux établissements.' };

  const schoolSettings = parseSchoolOrgSettings((org.settings as Record<string, unknown>) ?? null);
  const year =
    targetYear?.trim() || schoolSettings.default_academic_year;

  const orgSettings = (org.settings ?? {}) as { tuition_fee_gnf?: number };
  const orgDefaultTuitionGnf = Number(orgSettings.tuition_fee_gnf ?? 1_500_000);

  const { data: paymentRaw, error: payErr } = await supabase.rpc(
    'school_student_payment_settings',
    { p_org_id: orgId }
  );
  if (payErr) return { error: payErr.message };

  const { data: classes, error: clsErr } = await supabase
    .from('school_classes')
    .select('id, name, level, tuition_fee_gnf')
    .eq('organization_id', orgId)
    .eq('academic_year', year)
    .eq('is_active', true)
    .order('name');

  if (clsErr) return { error: clsErr.message };

  return {
    setup: {
      year,
      orgDefaultTuitionGnf,
      paymentSettings: parseStudentPaymentSettings(paymentRaw),
      classes: (classes ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        level: (c.level as string) || null,
        tuition_fee_gnf:
          c.tuition_fee_gnf != null ? Number(c.tuition_fee_gnf) : null,
      })),
    },
  };
}

export async function saveAcademicYearFeeSetup(params: {
  enrollmentNewFeeGnf: number;
  enrollmentReenrollmentFeeGnf: number;
  minPaymentGnf: number;
  tuitionInstallments: TuitionInstallment[];
  classTuitions: Array<{ classId: string; tuitionFeeGnf: number }>;
}): Promise<{ success: true } | { error: string }> {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: paymentRaw, error: loadErr } = await supabase.rpc(
    'school_student_payment_settings',
    { p_org_id: orgId }
  );
  if (loadErr) return { error: loadErr.message };

  const current = parseStudentPaymentSettings(paymentRaw);
  const installments = normalizeInstallmentsForSave(params.tuitionInstallments);

  if (installments.length > 0) {
    const pctSum = sumInstallmentPercents(installments);
    if (Math.abs(pctSum - 100) > 0.01) {
      return {
        error: `Les pourcentages des tranches doivent totaliser 100 % (actuellement ${pctSum.toFixed(0)} %).`,
      };
    }
  }

  const nextSettings: StudentPaymentSettings = {
    ...current,
    enrollment_new_fee_gnf: Math.max(0, params.enrollmentNewFeeGnf),
    enrollment_reenrollment_fee_gnf: Math.max(0, params.enrollmentReenrollmentFeeGnf),
    min_payment_gnf: Math.max(10_000, params.minPaymentGnf),
    tuition_installments: installments,
  };

  const { error: settingsErr } = await supabase.rpc('update_school_student_payment_settings', {
    p_org_id: orgId,
    p_settings: nextSettings,
  });
  if (settingsErr) return { error: settingsErr.message };

  for (const row of params.classTuitions) {
    const fee = row.tuitionFeeGnf > 0 ? row.tuitionFeeGnf : null;
    const { error: clsErr } = await supabase
      .from('school_classes')
      .update({ tuition_fee_gnf: fee })
      .eq('id', row.classId)
      .eq('organization_id', orgId);
    if (clsErr) return { error: clsErr.message };
  }

  const paths = [
    '/parametres/annee-scolaire',
    '/parametres/paiements-eleves',
    '/etablissement/candidatures',
    '/etablissement/paiements',
    '/etablissement/formations',
  ];
  for (const p of paths) revalidatePath(p);

  return { success: true };
}
