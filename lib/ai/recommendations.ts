import type { AIRecommendation, Sector } from '@/types/database';

interface SchoolSignals {
  students: number;
  teachers: number;
  classes: number;
  pendingEnrollments: number;
  unpaidPayments: number;
  avgGrade?: number;
}

interface NgoSignals {
  projects: number;
  activeProjects: number;
  beneficiaries: number;
  executionRate: number;
  surveys: number;
}

interface BtpSignals {
  sites: number;
  activeSites: number;
  avgProgress: number;
  fuelAnomalies: number;
  stockAlerts: number;
  delayedSites: number;
}

export function buildSchoolRecommendations(s: SchoolSignals): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  if (s.pendingEnrollments > 0) {
    recs.push({
      id: 'school-enrollments',
      type: 'warning',
      message: `${s.pendingEnrollments} candidature(s) en attente de traitement.`,
      sector: 'etablissement',
    });
  }
  if (s.unpaidPayments > 0) {
    recs.push({
      id: 'school-payments',
      type: 'warning',
      message: `${s.unpaidPayments} paiement(s) non soldé(s) — relancez les familles concernées.`,
      sector: 'etablissement',
    });
  }
  if (s.classes > 0 && s.students / s.classes > 35) {
    recs.push({
      id: 'school-capacity',
      type: 'info',
      message: `Ratio moyen de ${Math.round(s.students / s.classes)} élèves/classe — surveillez la capacité d'accueil.`,
      sector: 'etablissement',
    });
  }
  if (s.teachers === 0 && s.students > 0) {
    recs.push({
      id: 'school-no-teachers',
      type: 'danger',
      message: 'Aucun enseignant enregistré alors que des élèves sont inscrits.',
      sector: 'etablissement',
    });
  }
  if (recs.length === 0) {
    recs.push({
      id: 'school-ok',
      type: 'success',
      message: `Établissement opérationnel : ${s.students} élève(s), ${s.classes} classe(s), ${s.teachers} enseignant(s).`,
      sector: 'etablissement',
    });
  }
  return recs.slice(0, 4);
}

export function buildNgoRecommendations(s: NgoSignals): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  if (s.executionRate < 50 && s.projects > 0) {
    recs.push({
      id: 'ngo-budget',
      type: 'warning',
      message: `Taux d'exécution budgétaire à ${s.executionRate.toFixed(0)}% — priorisez le décaissement des projets actifs.`,
      sector: 'ong',
    });
  }
  if (s.activeProjects < s.projects) {
    recs.push({
      id: 'ngo-inactive',
      type: 'info',
      message: `${s.projects - s.activeProjects} projet(s) non actif(s) — vérifiez leur statut.`,
      sector: 'ong',
    });
  }
  if (s.surveys === 0) {
    recs.push({
      id: 'ngo-surveys',
      type: 'info',
      message: 'Aucun sondage terrain actif — planifiez une enquête de suivi.',
      sector: 'ong',
    });
  }
  if (s.beneficiaries === 0) {
    recs.push({
      id: 'ngo-beneficiaries',
      type: 'danger',
      message: 'Aucun bénéficiaire enregistré — complétez le registre terrain.',
      sector: 'ong',
    });
  }
  if (recs.length === 0) {
    recs.push({
      id: 'ngo-ok',
      type: 'success',
      message: `${s.activeProjects} projet(s) actif(s), ${s.beneficiaries.toLocaleString('fr-FR')} bénéficiaires couverts.`,
      sector: 'ong',
    });
  }
  return recs.slice(0, 4);
}

export function buildBtpRecommendations(s: BtpSignals): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  if (s.fuelAnomalies > 0) {
    recs.push({
      id: 'btp-fuel',
      type: 'danger',
      message: `${s.fuelAnomalies} anomalie(s) carburant détectée(s) — audit urgent sur les chantiers concernés.`,
      sector: 'btp',
    });
  }
  if (s.delayedSites > 0) {
    recs.push({
      id: 'btp-delay',
      type: 'warning',
      message: `${s.delayedSites} chantier(s) en retard — réallouez les équipes ou matériels.`,
      sector: 'btp',
    });
  }
  if (s.stockAlerts > 0) {
    recs.push({
      id: 'btp-stock',
      type: 'warning',
      message: `${s.stockAlerts} article(s) de stock sous le seuil — commandez avant rupture.`,
      sector: 'btp',
    });
  }
  if (s.avgProgress < 50 && s.activeSites > 0) {
    recs.push({
      id: 'btp-progress',
      type: 'info',
      message: `Avancement moyen à ${s.avgProgress.toFixed(0)}% — accélérez le rythme des travaux.`,
      sector: 'btp',
    });
  }
  if (recs.length === 0) {
    recs.push({
      id: 'btp-ok',
      type: 'success',
      message: `${s.activeSites} chantier(s) actif(s), avancement moyen ${s.avgProgress.toFixed(0)}%.`,
      sector: 'btp',
    });
  }
  return recs.slice(0, 4);
}

export function buildPlatformRecommendations(stats: {
  organisations: number;
  utilisateurs: number;
  orgsByType: { type: string; count: number }[];
}): AIRecommendation[] {
  const recs: AIRecommendation[] = [
    {
      id: 'platform-overview',
      type: 'info',
      message: `${stats.organisations} organisation(s) active(s) et ${stats.utilisateurs} utilisateur(s) sur la plateforme.`,
      sector: 'global',
    },
  ];
  for (const row of stats.orgsByType) {
    if (row.count === 0) {
      recs.push({
        id: `platform-empty-${row.type}`,
        type: 'info',
        message: `Aucune entité ${row.type} inscrite — ciblez ce segment pour l'onboarding.`,
        sector: 'global',
      });
    }
  }
  return recs.slice(0, 4);
}

interface PmeSignals {
  revenue: number;
  totalExpenses: number;
  profit: number;
  receivables: number;
  lowStockItems: number;
  pendingSales: number;
}

export function buildPmeRecommendations(s: PmeSignals): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  if (s.lowStockItems > 0) {
    recs.push({
      id: 'pme-stock',
      type: 'warning',
      message: `${s.lowStockItems} article(s) sous le seuil de stock — réapprovisionnez rapidement.`,
      sector: 'pme',
    });
  }
  if (s.receivables > 500000) {
    recs.push({
      id: 'pme-receivables',
      type: 'info',
      message: `Créances clients : ${Math.round(s.receivables).toLocaleString('fr-FR')} GNF — planifiez les relances.`,
      sector: 'pme',
    });
  }
  if (s.pendingSales > 0) {
    recs.push({
      id: 'pme-pending-sales',
      type: 'warning',
      message: `${s.pendingSales} vente(s) en attente de paiement.`,
      sector: 'pme',
    });
  }
  if (s.profit < 0 && s.revenue > 0) {
    recs.push({
      id: 'pme-profit',
      type: 'danger',
      message: 'Dépenses supérieures au chiffre d\'affaires sur la période — analysez vos charges.',
      sector: 'pme',
    });
  }
  if (recs.length === 0) {
    recs.push({
      id: 'pme-ok',
      type: 'success',
      message: `CA ${Math.round(s.revenue).toLocaleString('fr-FR')} GNF — ${s.lowStockItems === 0 ? 'stocks OK' : 'suivi actif'}.`,
      sector: 'pme',
    });
  }
  return recs.slice(0, 4);
}

export type { SchoolSignals, NgoSignals, BtpSignals, PmeSignals };
