'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { canOrganizationDirectorPay } from '@/lib/billing/offer-payment';
import { isSchoolStaffRole } from '@/lib/school/etablissement-access';
import { parseSchoolOrgSettings } from '@/lib/school/school-org-settings';
import type { AppRole } from '@/types/database';

export type OnboardingActor = 'ceo' | 'director' | 'team';

export interface SchoolOnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  actor: OnboardingActor;
}

export interface SchoolOnboardingStatus {
  steps: SchoolOnboardingStep[];
  completedCount: number;
  totalCount: number;
  billingStatus: string | null;
  accessAllowed: boolean;
  paymentToken: string | null;
  offerStatus: string | null;
}

export async function getSchoolOnboardingStatus(): Promise<{
  status: SchoolOnboardingStatus | null;
  error?: string;
}> {
  const session = await getSession();
  const orgId = session?.profile?.organization_id;
  const role = session?.profile?.role as AppRole | undefined;

  if (!orgId) return { status: null, error: 'Aucune organisation' };
  if (!isSchoolStaffRole(role) && role !== 'platform_admin') {
    return { status: null, error: 'Non autorisé' };
  }

  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('billing_status, type, tuition_fee_gnf, settings')
    .eq('id', orgId)
    .single();

  if (org?.type !== 'school') {
    return { status: null, error: 'Réservé aux établissements scolaires' };
  }

  const { data: offerRow } = await supabase
    .from('organization_billing_offers')
    .select('status, payment_token, activation_amount_gnf')
    .eq('organization_id', orgId)
    .maybeSingle();

  const { data: accessOk } = await supabase.rpc('organization_platform_access_ok', {
    p_org_id: orgId,
  });
  const accessAllowed = Boolean(accessOk);
  const offer = offerRow
    ? {
        status: offerRow.status as string,
        payment_token: offerRow.payment_token as string | null,
      }
    : null;

  const schoolSettings = parseSchoolOrgSettings(
    (org?.settings as Record<string, unknown> | null) ?? null
  );
  const currentAcademicYear = schoolSettings.default_academic_year;
  const orgDefaultTuition = Number(org?.tuition_fee_gnf ?? 0);

  const [
    { count: classCount },
    { count: classesWithFeesCount },
    { count: enrolledCount },
    { count: teacherCount },
    { count: subjectCount },
    { count: staffProfiles },
    { count: assignmentCount },
    paymentSettingsRes,
  ] = await Promise.all([
    supabase
      .from('school_classes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .eq('academic_year', currentAcademicYear),
    supabase
      .from('school_classes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .eq('academic_year', currentAcademicYear)
      .gt('tuition_fee_gnf', 0),
    supabase
      .from('school_students')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('enrollment_status', 'enrolled'),
    supabase
      .from('school_teachers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true),
    supabase
      .from('school_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .neq('role', 'org_admin'),
    supabase
      .from('school_teaching_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase.rpc('school_student_payment_settings', { p_org_id: orgId }),
  ]);

  const paymentSettings = paymentSettingsRes.data as { enabled?: boolean } | null;
  const feesConfigured =
    orgDefaultTuition > 0 || (classesWithFeesCount ?? 0) > 0;
  const paymentsEnabled = Boolean(paymentSettings?.enabled);

  const billingStatus = (org.billing_status as string) ?? null;
  const offerReady =
    canOrganizationDirectorPay(offer?.status) && Boolean(offer?.payment_token);
  const paid = billingStatus === 'active' && accessAllowed;

  const steps: SchoolOnboardingStep[] = [
    {
      id: 'ceo_offer',
      title: '1. Tarif validé par KonaData',
      description: offerReady
        ? 'Offre prête — le directeur peut payer.'
        : 'En attente : le CEO fixe le montant annuel sur Organisations.',
      href: role === 'platform_admin' ? '/organisations' : '/parametres/facturation',
      done: offerReady || paid,
      actor: 'ceo',
    },
    {
      id: 'director_pay',
      title: '2. Paiement annuel (activation)',
      description: paid
        ? 'Abonnement actif — accès complet ouvert.'
        : offerReady
          ? 'Tarif validé par KonaData — réglez via Facturation ou le lien de paiement.'
          : 'Bloqué tant que KonaData n’a pas validé le tarif (étape 1).',
      href:
        offerReady && offer?.payment_token
          ? `/paiement-organisation/${offer.payment_token}`
          : '/parametres/facturation',
      done: paid,
      actor: 'director',
    },
    {
      id: 'classes',
      title: '3. Classes / salles',
      description: paid
        ? `Créer les classes de l’année ${currentAcademicYear} (capacité, niveau).`
        : 'Disponible après paiement de l’abonnement.',
      href: '/etablissement/formations',
      done: paid && (classCount ?? 0) > 0,
      actor: 'director',
    },
    {
      id: 'fees_year',
      title: '4. Tarifs & année scolaire',
      description: paid
        ? feesConfigured
          ? `Frais inscription, réinscription et scolarité par classe — année ${currentAcademicYear}.`
          : 'Définir les frais par classe et l’échéancier (inscription, réinscription, tranches).'
        : 'Configurable dès Paramètres — utile avant la rentrée.',
      href: '/parametres/annee-scolaire',
      done: paid && feesConfigured,
      actor: 'director',
    },
    {
      id: 'payments_online',
      title: '5. Paiements familles en ligne',
      description: paid
        ? paymentsEnabled
          ? 'Les familles peuvent payer inscription, réinscription ou scolarité en ligne.'
          : 'Activer les paiements et choisir les types autorisés (Candidatures / liens staff).'
        : 'Préparez les réglages pendant l’attente de l’abonnement KonaData.',
      href: '/parametres/paiements-eleves',
      done: paid && paymentsEnabled,
      actor: 'director',
    },
    {
      id: 'students',
      title: '6. Importer votre première liste (~5 min)',
      description: paid
        ? 'CSV, Excel ou photo de liste — modèle vierge disponible sur le tableau de bord.'
        : 'Disponible après activation (essai 30 jours ou abonnement).',
      href: '/etablissement/etudiants/import',
      done: paid && (enrolledCount ?? 0) > 0,
      actor: 'team',
    },
    {
      id: 'catalog',
      title: '7. Matières & enseignants',
      description: paid
        ? 'Référentiel pédagogique dans Formations.'
        : 'Disponible après paiement de l’abonnement.',
      href: '/etablissement/formations',
      done: paid && (teacherCount ?? 0) > 0 && (subjectCount ?? 0) > 0,
      actor: 'director',
    },
    {
      id: 'users',
      title: '8. Comptes équipe',
      description: paid
        ? 'Codes d’accès scolarité, comptable, enseignants.'
        : 'Disponible après paiement de l’abonnement.',
      href: '/utilisateurs',
      done: paid && (staffProfiles ?? 0) > 0,
      actor: 'director',
    },
    {
      id: 'assignments',
      title: '9. Assignations',
      description: paid
        ? 'Lier chaque enseignant à ses classes et matières.'
        : 'Disponible après paiement de l’abonnement.',
      href: '/utilisateurs/assignations',
      done: paid && (assignmentCount ?? 0) > 0,
      actor: 'director',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return {
    status: {
      steps,
      completedCount,
      totalCount: steps.length,
      billingStatus,
      accessAllowed,
      paymentToken: offer?.payment_token ?? null,
      offerStatus: offer?.status ?? null,
    },
  };
}

export async function getSchoolBillingQuoteForCeo(orgId: string): Promise<{
  declaredAnnual: number;
  enrolledAnnual: number;
  error?: string;
}> {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { declaredAnnual: 0, enrolledAnnual: 0, error: 'Réservé au CEO KonaData' };
  }

  const supabase = await createClient();
  const [declaredRes, enrolledRes] = await Promise.all([
    supabase.rpc('compute_school_annual_amount', {
      p_org_id: orgId,
      p_use_declared: true,
    }),
    supabase.rpc('compute_school_annual_amount', {
      p_org_id: orgId,
      p_use_declared: false,
    }),
  ]);

  if (declaredRes.error) {
    return { declaredAnnual: 0, enrolledAnnual: 0, error: declaredRes.error.message };
  }

  return {
    declaredAnnual: Number(declaredRes.data ?? 0),
    enrolledAnnual: Number(enrolledRes.data ?? 0),
  };
}

