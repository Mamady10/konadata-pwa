export interface BtpDashboardData {
  kpis: {
    chantiers: number;
    chantiersActifs: number;
    consommationCarburant: number;
    heuresMachines: number;
    tauxAvancement: number;
    personnel: number;
    alertesStock: number;
  };
  chantiersActifs: Array<{
    id: string;
    nom: string;
    avancement: number;
    retard: number;
    statut: string;
  }>;
  derniersBons: Array<{ id: string; type: string; fournisseur: string; date: string }>;
  planifieRealise: Array<{ semaine: string; planifie: number; realise: number }>;
  consommationCarburant: Array<{ mois: string; litres: number }>;
  effectifsChantier: Array<{ chantier: string; effectif: number }>;
  alertesCarburant: Array<{ chantier: string; consommation: string; seuil: string }>;
}
