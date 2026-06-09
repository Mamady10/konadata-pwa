import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getSchoolFinanceByClass, getOrgDefaultAcademicYear } from '@/lib/actions/school';
import { formatCurrencyGnf } from '@/lib/ai/reports/render-report';

export interface SchoolQuickMetrics {
  academicYear: string;
  enrolledStudents: number;
  activeClasses: number;
  pendingEnrollments: number;
  monthLabel: string;
  monthCollectedGnf: number;
  monthPaymentCount: number;
  totalCollectedGnf: number;
  totalExpectedGnf: number;
  totalPendingCandidates: number;
  topPaymentGaps: Array<{ className: string; gapGnf: number; enrolled: number }>;
}

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['']/g, ' ');
}

function monthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

export async function fetchSchoolQuickMetrics(orgId: string): Promise<SchoolQuickMetrics> {
  const supabase = await createClient();
  const academicYear = await getOrgDefaultAcademicYear(orgId);
  const { start, end, label } = monthWindow();

  const [finance, yearFilter] = await Promise.all([
    getSchoolFinanceByClass(orgId),
    supabase
      .from('school_classes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .eq('academic_year', academicYear),
  ]);

  const { count: enrolledStudents } = await supabase
    .from('school_students')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('enrollment_status', 'enrolled');

  const { count: pendingEnrollments } = await supabase
    .from('school_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'pending');

  const { data: monthPayments } = await supabase
    .from('school_payments')
    .select('amount')
    .eq('organization_id', orgId)
    .eq('status', 'paid')
    .gte('paid_at', start.toISOString())
    .lte('paid_at', end.toISOString());

  const monthCollectedGnf = (monthPayments ?? []).reduce(
    (s, p) => s + Number(p.amount ?? 0),
    0
  );

  const topPaymentGaps = [...finance.rows]
    .filter((r) => r.enrolledCount > 0 && r.gap < 0)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 5)
    .map((r) => ({
      className: r.className,
      gapGnf: r.gap,
      enrolled: r.enrolledCount,
    }));

  return {
    academicYear,
    enrolledStudents: enrolledStudents ?? 0,
    activeClasses: yearFilter.count ?? 0,
    pendingEnrollments: pendingEnrollments ?? 0,
    monthLabel: label,
    monthCollectedGnf,
    monthPaymentCount: monthPayments?.length ?? 0,
    totalCollectedGnf: finance.totals.collected,
    totalExpectedGnf: finance.totals.expected,
    totalPendingCandidates: finance.totals.pending,
    topPaymentGaps,
  };
}

export function answerSchoolOfflineFaq(
  message: string,
  metrics: SchoolQuickMetrics,
  orgName: string,
  reportPath: string
): string | null {
  const q = normalizeQuestion(message);

  if (
    (/encaiss|recette/.test(q) && /mois|mensuel|ce mois|mensuelle|combien/.test(q)) ||
    /combien.*(encaiss|recu|verse)|encaiss.*(mois|mensuel)/.test(q)
  ) {
    return [
      `**Encaissements — ${metrics.monthLabel}**`,
      `• Montant encaissé : **${formatCurrencyGnf(metrics.monthCollectedGnf)}**`,
      `• Nombre de paiements enregistrés : **${metrics.monthPaymentCount}**`,
      `• Année scolaire de référence : **${metrics.academicYear}**`,
      '',
      `Total cumulé (classes actives ${metrics.academicYear}) : **${formatCurrencyGnf(metrics.totalCollectedGnf)}** encaissé sur **${formatCurrencyGnf(metrics.totalExpectedGnf)}** attendu.`,
      '',
      `Détail : ${reportPath}`,
    ].join('\n');
  }

  if (/candidat|inscription|dossier/.test(q) && /attente|pending|en cours|traiter/.test(q)) {
    return [
      `**Candidatures en attente — ${orgName}**`,
      `• Dossiers d'inscription **pending** : **${metrics.pendingEnrollments}**`,
      `• Candidatures par classe (finances) : **${metrics.totalPendingCandidates}**`,
      `• Élèves déjà inscrits : **${metrics.enrolledStudents}**`,
      '',
      'Traitement : **Établissement → Candidatures**.',
    ].join('\n');
  }

  if (/candidat|inscription|demande/.test(q) && !/attente/.test(q)) {
    return [
      `**Inscriptions & candidatures**`,
      `• Dossiers en attente de traitement : **${metrics.pendingEnrollments}**`,
      `• Élèves inscrits (statut enrolled) : **${metrics.enrolledStudents}**`,
      `• Année scolaire : **${metrics.academicYear}**`,
    ].join('\n');
  }

  if (/financ|tresorer|budget|scolarite|situation/.test(q)) {
    const lines = [
      `**Situation financière — ${metrics.academicYear}**`,
      `• Encaissé (année en cours) : **${formatCurrencyGnf(metrics.totalCollectedGnf)}**`,
      `• Attendu (élèves inscrits × frais classe) : **${formatCurrencyGnf(metrics.totalExpectedGnf)}**`,
      `• Écart global : **${formatCurrencyGnf(metrics.totalCollectedGnf - metrics.totalExpectedGnf)}**`,
      `• Ce mois (${metrics.monthLabel}) : **${formatCurrencyGnf(metrics.monthCollectedGnf)}**`,
    ];
    if (metrics.topPaymentGaps.length > 0) {
      lines.push('', '**Classes avec le plus d’écart (sous-encaissement) :**');
      for (const g of metrics.topPaymentGaps) {
        lines.push(
          `• ${g.className} (${g.enrolled} inscrit(s)) : écart **${formatCurrencyGnf(g.gap)}**`
        );
      }
    }
    lines.push('', `Rapports : ${reportPath}`);
    return lines.join('\n');
  }

  if (/ecart|impay|retard|non pay|sous.?encaiss/.test(q)) {
    if (metrics.topPaymentGaps.length === 0) {
      return [
        '**Écarts de paiement**',
        'Aucun écart notable par classe pour l’année en cours, ou pas encore d’élèves inscrits avec frais définis.',
        `Encaissement total : **${formatCurrencyGnf(metrics.totalCollectedGnf)}**.`,
      ].join('\n');
    }
    const lines = ['**Classes avec écart de paiement** (année ' + metrics.academicYear + ') :'];
    for (const g of metrics.topPaymentGaps) {
      lines.push(`• **${g.className}** : ${formatCurrencyGnf(g.gap)} (${g.enrolled} inscrit(s))`);
    }
    return lines.join('\n');
  }

  if (/eleve|inscrit|effectif|scolarise/.test(q)) {
    return [
      `**Effectifs — ${metrics.academicYear}**`,
      `• Élèves inscrits : **${metrics.enrolledStudents}**`,
      `• Classes actives : **${metrics.activeClasses}**`,
      metrics.activeClasses > 0
        ? `• Moyenne : **${(metrics.enrolledStudents / metrics.activeClasses).toFixed(1)}** élève(s)/classe`
        : '• Créez des classes dans **Formations**.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (/classe|salle|niveau/.test(q)) {
    return [
      `**Classes — ${metrics.academicYear}**`,
      `• Classes actives : **${metrics.activeClasses}**`,
      `• Élèves inscrits : **${metrics.enrolledStudents}**`,
      'Gestion : **Établissement → Formations**.',
    ].join('\n');
  }

  if (/document|pdf|rapport|data factory|fichier|depose/.test(q)) {
    return [
      '**Documents & rapports**',
      '• Déposez vos fichiers dans **Data Factory** (PDF, Word, Excel) pour la recherche interne.',
      `• Rapports structurés : **${reportPath}**`,
      '• KonaAI (assistant IA) sera proposé ultérieurement — rédaction automatique et OCR sur scans.',
    ].join('\n');
  }

  if (/resume|synthese|situation|indicateur|kpi|etat/.test(q)) {
    return [
      `**Synthèse — ${orgName} (${metrics.academicYear})**`,
      `• **${metrics.enrolledStudents}** élève(s) inscrit(s) · **${metrics.activeClasses}** classe(s)`,
      `• **${metrics.pendingEnrollments}** candidature(s) en attente`,
      `• Encaissements ce mois : **${formatCurrencyGnf(metrics.monthCollectedGnf)}**`,
      `• Total encaissé / attendu : **${formatCurrencyGnf(metrics.totalCollectedGnf)}** / **${formatCurrencyGnf(metrics.totalExpectedGnf)}**`,
      '',
      'Posez une question précise (ex. « encaissements ce mois », « candidatures en attente »).',
    ].join('\n');
  }

  return null;
}
