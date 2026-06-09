import { Sector, KonaScore, AIRecommendation, Connector, Report } from "@/types";

// ─── Global Dashboard ───────────────────────────────────────────
export const globalKpis = {
  organisations: 47,
  utilisateurs: 1284,
  documents: 15632,
  rapports: 892,
};

export const konaScore: KonaScore = {
  finance: 85,
  organisation: 92,
  croissance: 78,
  conformite: 88,
  global: 86,
};

export const globalChartData = [
  { month: "Jan", documents: 1200, rapports: 45 },
  { month: "Fév", documents: 1450, rapports: 52 },
  { month: "Mar", documents: 1680, rapports: 61 },
  { month: "Avr", documents: 1920, rapports: 68 },
  { month: "Mai", documents: 2100, rapports: 74 },
  { month: "Jun", documents: 2350, rapports: 82 },
];

// ─── Établissement ──────────────────────────────────────────────
export const etablissementKpis = {
  candidats: 342,
  etudiants: 1287,
  tauxPaiement: 78.5,
  montantEncaisse: 485000000,
};

export const inscriptionsEvolution = [
  { mois: "Sep", inscriptions: 120 },
  { mois: "Oct", inscriptions: 185 },
  { mois: "Nov", inscriptions: 210 },
  { mois: "Déc", inscriptions: 95 },
  { mois: "Jan", inscriptions: 340 },
  { mois: "Fév", inscriptions: 280 },
];

export const paiementsEvolution = [
  { mois: "Sep", montant: 45000000 },
  { mois: "Oct", montant: 72000000 },
  { mois: "Nov", montant: 68000000 },
  { mois: "Déc", montant: 35000000 },
  { mois: "Jan", montant: 95000000 },
  { mois: "Fév", montant: 85000000 },
];

export const filiereRepartition = [
  { name: "Informatique", value: 320 },
  { name: "Gestion", value: 280 },
  { name: "Droit", value: 195 },
  { name: "Médecine", value: 245 },
  { name: "Ingénierie", value: 247 },
];

export const dernieresInscriptions = [
  { id: 1, nom: "Fatoumata Camara", filiere: "Informatique", date: "28/05/2026", statut: "Admis" },
  { id: 2, nom: "Ibrahima Bah", filiere: "Gestion", date: "27/05/2026", statut: "En attente" },
  { id: 3, nom: "Mariama Sow", filiere: "Droit", date: "27/05/2026", statut: "Admis" },
  { id: 4, nom: "Alpha Condé", filiere: "Ingénierie", date: "26/05/2026", statut: "Refusé" },
  { id: 5, nom: "Aissatou Barry", filiere: "Médecine", date: "26/05/2026", statut: "Admis" },
];

export const paiementsRecents = [
  { id: 1, etudiant: "Ousmane Keita", montant: 2500000, date: "30/05/2026", mode: "Orange Money" },
  { id: 2, etudiant: "Hawa Diallo", montant: 1800000, date: "29/05/2026", mode: "MTN MoMo" },
  { id: 3, etudiant: "Mohamed Sylla", montant: 3200000, date: "29/05/2026", mode: "Virement" },
  { id: 4, etudiant: "Kadiatou Touré", montant: 1500000, date: "28/05/2026", mode: "Orange Money" },
];

export const etudiantsEnAttente = [
  { id: 1, nom: "Sekou Bangoura", filiere: "Informatique", jours: 15 },
  { id: 2, nom: "Fanta Camara", filiere: "Gestion", jours: 8 },
  { id: 3, nom: "Lamine Diallo", filiere: "Droit", jours: 22 },
];

export const etablissementAI: AIRecommendation[] = [
  { id: "1", message: "25 étudiants n'ont pas encore payé", type: "warning", sector: "etablissement" },
  { id: "2", message: "Les inscriptions ont augmenté de 15%", type: "success", sector: "etablissement" },
  { id: "3", message: "Le taux de réussite est de 82%", type: "info", sector: "etablissement" },
];

// ─── ONG ────────────────────────────────────────────────────────
export const ongKpis = {
  projets: 24,
  beneficiaires: 8450,
  budgetTotal: 12500000000,
  tauxExecution: 67.3,
};

export const budgetPrevuRealise = [
  { trimestre: "T1", prevu: 3200000000, realise: 2850000000 },
  { trimestre: "T2", prevu: 3500000000, realise: 3100000000 },
  { trimestre: "T3", prevu: 3800000000, realise: 2400000000 },
  { trimestre: "T4", prevu: 2000000000, realise: 890000000 },
];

export const repartitionGeographique = [
  { region: "Conakry", beneficiaires: 2100 },
  { region: "Labé", beneficiaires: 1850 },
  { region: "Kankan", beneficiaires: 1420 },
  { region: "N'Zérékoré", beneficiaires: 1680 },
  { region: "Kindia", beneficiaires: 1400 },
];

export const progressionProjets = [
  { mois: "Jan", termines: 2, enCours: 8 },
  { mois: "Fév", termines: 3, enCours: 9 },
  { mois: "Mar", termines: 4, enCours: 10 },
  { mois: "Avr", termines: 5, enCours: 11 },
  { mois: "Mai", termines: 6, enCours: 12 },
];

export const projetsActifs = [
  { id: 1, nom: "Projet Eau Potable", region: "Labé", budget: 850000000, avancement: 45, statut: "En retard" },
  { id: 2, nom: "Éducation Rurale", region: "Kankan", budget: 620000000, avancement: 72, statut: "En cours" },
  { id: 3, nom: "Santé Communautaire", region: "Conakry", budget: 1200000000, avancement: 88, statut: "En cours" },
  { id: 4, nom: "Agriculture Durable", region: "Kindia", budget: 450000000, avancement: 35, statut: "En cours" },
];

export const localitesCouvertes = [
  { id: 1, localite: "Labé Centre", projets: 3, beneficiaires: 450 },
  { id: 2, localite: "Kankan Ville", projets: 2, beneficiaires: 380 },
  { id: 3, localite: "Matoto", projets: 4, beneficiaires: 620 },
  { id: 4, localite: "Mamou", projets: 1, beneficiaires: 210 },
];

export const ongAI: AIRecommendation[] = [
  { id: "1", message: "Le projet Eau est en retard", type: "danger", sector: "ong" },
  { id: "2", message: "Les besoins sont plus élevés à Labé", type: "warning", sector: "ong" },
  { id: "3", message: "Les données de Kankan sont incomplètes", type: "info", sector: "ong" },
];

// ─── BTP ────────────────────────────────────────────────────────
export const btpKpis = {
  chantiers: 12,
  consommationCarburant: 45800,
  heuresMachines: 3240,
  tauxAvancement: 64.2,
};

export const planifieRealise = [
  { semaine: "S1", planifie: 15, realise: 12 },
  { semaine: "S2", planifie: 18, realise: 16 },
  { semaine: "S3", planifie: 20, realise: 14 },
  { semaine: "S4", planifie: 22, realise: 20 },
  { semaine: "S5", planifie: 25, realise: 18 },
  { semaine: "S6", planifie: 28, realise: 24 },
];

export const consommationCarburant = [
  { mois: "Jan", litres: 6200 },
  { mois: "Fév", litres: 7100 },
  { mois: "Mar", litres: 6800 },
  { mois: "Avr", litres: 8200 },
  { mois: "Mai", litres: 9100 },
  { mois: "Jun", litres: 8400 },
];

export const effectifsChantier = [
  { chantier: "Route RN1", effectif: 45 },
  { chantier: "Pont Kaloum", effectif: 32 },
  { chantier: "Bâtiment ISC", effectif: 28 },
  { chantier: "Voirie Matam", effectif: 38 },
];

export const chantiersActifs = [
  { id: 1, nom: "Route RN1 - Labé", avancement: 72, budget: 4500000000, retard: 0 },
  { id: 2, nom: "Pont Kaloum", avancement: 45, budget: 8200000000, retard: 7 },
  { id: 3, nom: "Bâtiment ISC", avancement: 88, budget: 2100000000, retard: 0 },
  { id: 4, nom: "Voirie Matam", avancement: 56, budget: 1800000000, retard: 3 },
];

export const derniersBons = [
  { id: 1, type: "Bon de livraison", fournisseur: "Guicement SA", montant: 45000000, date: "30/05/2026" },
  { id: 2, type: "Bon de commande", fournisseur: "Cimenterie", montant: 78000000, date: "29/05/2026" },
  { id: 3, type: "Bon carburant", fournisseur: "Total Guinée", montant: 12500000, date: "28/05/2026" },
];

export const alertesCarburant = [
  { id: 1, chantier: "Pont Kaloum", consommation: "+35%", seuil: "Dépassé" },
  { id: 2, chantier: "Route RN1", consommation: "+12%", seuil: "Normal" },
  { id: 3, chantier: "Voirie Matam", consommation: "+28%", seuil: "Alerte" },
];

export const btpAI: AIRecommendation[] = [
  { id: "1", message: "Suspicion de surconsommation carburant", type: "danger", sector: "btp" },
  { id: "2", message: "Retard de 7 jours sur chantier Pont Kaloum", type: "warning", sector: "btp" },
  { id: "3", message: "Stock ciment inférieur au seuil", type: "warning", sector: "btp" },
];

// ─── Connecteurs ────────────────────────────────────────────────
export const connecteurs: Connector[] = [
  { id: "1", name: "WhatsApp", description: "Notifications et collecte via WhatsApp Business API", status: "connected", icon: "message-circle" },
  { id: "2", name: "Email", description: "Envoi automatique de rapports et alertes par email", status: "connected", icon: "mail" },
  { id: "3", name: "Paiement Mobile Money", description: "Orange Money, MTN MoMo, integration paiements", status: "connected", icon: "smartphone" },
  { id: "4", name: "IoT Carburant", description: "Capteurs IoT pour suivi consommation carburant", status: "disconnected", icon: "fuel" },
  { id: "5", name: "API Externes", description: "Connexion aux systèmes tiers et APIs gouvernementales", status: "connected", icon: "plug" },
];

// ─── Rapports ─────────────────────────────────────────────────────
export const rapports: Report[] = [
  { id: "1", title: "Rapport mensuel inscriptions", type: "pdf", date: "01/05/2026", sector: "etablissement", size: "2.4 MB" },
  { id: "2", title: "Bilan financier Q1", type: "excel", date: "15/04/2026", sector: "global", size: "1.8 MB" },
  { id: "3", title: "Rapport projet Eau", type: "word", date: "20/05/2026", sector: "ong", size: "3.1 MB" },
  { id: "4", title: "Avancement chantiers", type: "pdf", date: "28/05/2026", sector: "btp", size: "4.2 MB" },
  { id: "5", title: "Synthèse bénéficiaires", type: "excel", date: "25/05/2026", sector: "ong", size: "1.2 MB" },
  { id: "6", title: "Bulletins semestre 1", type: "pdf", date: "10/02/2026", sector: "etablissement", size: "8.5 MB" },
];

// ─── Sécurité ─────────────────────────────────────────────────────
export const historiqueConnexions = [
  { id: 1, utilisateur: "Amadou Diallo", ip: "196.28.45.12", date: "30/05/2026 09:15", statut: "Succès" },
  { id: 2, utilisateur: "Fatoumata Camara", ip: "196.28.45.89", date: "30/05/2026 08:42", statut: "Succès" },
  { id: 3, utilisateur: "Ibrahima Bah", ip: "41.223.12.45", date: "29/05/2026 22:18", statut: "Échec" },
  { id: 4, utilisateur: "Mariama Sow", ip: "196.28.45.33", date: "29/05/2026 17:05", statut: "Succès" },
];

export const alertesSecurite = [
  { id: 1, type: "Tentative connexion", message: "3 tentatives échouées pour ibrahima.bah@", severite: "Moyenne", date: "29/05/2026" },
  { id: 2, type: "Accès inhabituel", message: "Connexion depuis IP non reconnue", severite: "Haute", date: "28/05/2026" },
  { id: 3, type: "Modification données", message: "Suppression massive de 15 enregistrements", severite: "Critique", date: "27/05/2026" },
];

export const activitesUtilisateurs = [
  { id: 1, utilisateur: "Amadou Diallo", action: "Génération rapport PDF", module: "Rapports", date: "30/05/2026 10:30" },
  { id: 2, utilisateur: "Fatoumata Camara", action: "Import document Excel", module: "Data Factory", date: "30/05/2026 09:45" },
  { id: 3, utilisateur: "Ibrahima Bah", action: "Modification profil étudiant", module: "Établissement", date: "29/05/2026 16:20" },
];

export const journalSysteme = [
  { id: 1, niveau: "INFO", message: "Sauvegarde automatique effectuée", date: "30/05/2026 03:00" },
  { id: 2, niveau: "WARN", message: "Espace disque à 78%", date: "29/05/2026 12:00" },
  { id: 3, niveau: "INFO", message: "Mise à jour connecteur WhatsApp", date: "28/05/2026 08:00" },
  { id: 4, niveau: "ERROR", message: "Timeout API Mobile Money", date: "27/05/2026 14:32" },
];

// ─── KonaAI responses ─────────────────────────────────────────────
export const konaAIResponses: Record<string, string> = {
  default: "Je suis KonaAI, votre assistant intelligent. Posez-moi des questions sur vos données, vos chantiers, vos inscriptions ou vos projets.",
  encaisse: "Ce mois-ci, vous avez encaissé **85 000 000 GNF**, soit une augmentation de 12% par rapport au mois dernier. 142 paiements ont été enregistrés via Orange Money et MTN MoMo.",
  carburant: "Le chantier **Pont Kaloum** consomme le plus de carburant avec **2 450 litres** ce mois, soit 35% au-dessus de la moyenne. Une alerte de surconsommation a été générée.",
  candidats: "Sur les **342 candidats** inscrits cette année, **218 ont été admis** (63.7%), **89 sont en attente** de décision et **35 ont été refusés**.",
  "projet eau": "Le **Projet Eau Potable** à Labé est actuellement à **45% d'avancement** avec un budget de 850M GNF. Il accuse un retard de 3 semaines sur le planning initial. Les principaux blocages concernent l'approvisionnement en tuyaux.",
};

export function getAIRecommendations(sector: Sector): AIRecommendation[] {
  switch (sector) {
    case "etablissement":
      return etablissementAI;
    case "ong":
      return ongAI;
    case "btp":
      return btpAI;
    default:
      return [...etablissementAI.slice(0, 1), ...ongAI.slice(0, 1), ...btpAI.slice(0, 1)];
  }
}

export function getKonaAIResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("encaiss") || q.includes("paiement") || q.includes("montant")) return konaAIResponses.encaisse;
  if (q.includes("carburant") || q.includes("consomm")) return konaAIResponses.carburant;
  if (q.includes("candidat") || q.includes("admis")) return konaAIResponses.candidats;
  if (q.includes("projet eau") || q.includes("eau")) return konaAIResponses["projet eau"];
  return konaAIResponses.default;
}
