export type OrganizationType = 'school' | 'ngo' | 'btp' | 'business';

export type AppRole =
  | 'platform_admin'
  | 'org_admin'
  | 'deputy_director'
  | 'registrar'
  | 'teacher'
  | 'student'
  | 'candidate'
  | 'accountant'
  | 'ngo_staff'
  | 'btp_staff'
  | 'pme_staff';

/** @deprecated use AppRole */
export type UserRole = AppRole;
export type DocumentStatus = 'uploading' | 'processing' | 'classified' | 'archived' | 'error';
export type DocumentCategory =
  | 'school_report' | 'invoice' | 'delivery_note' | 'cv' | 'questionnaire'
  | 'ngo_report' | 'expense_report' | 'fuel_report' | 'other';

export type KonaScoreLevel = 'excellent' | 'good' | 'average' | 'risky';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  /** compat ancien schéma */
  organization_type?: OrganizationType;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function getOrgType(org: Organization | null | undefined): OrganizationType | undefined {
  const raw = (org?.type ?? org?.organization_type) as string | undefined;
  if (!raw) return undefined;
  if (raw === 'construction') return 'btp';
  if (raw === 'university') return 'school';
  if (raw === 'business') return 'business';
  if (raw === 'school' || raw === 'ngo' || raw === 'btp' || raw === 'business') return raw as OrganizationType;
  return undefined;
}

export interface Profile {
  id: string;
  organization_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: AppRole;  is_active: boolean;
  avatar_url: string | null;
  metadata: Record<string, unknown>;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KonaScoreSnapshot {
  id: string;
  organization_id: string;
  financial_health: number;
  data_quality: number;
  activity_regularity: number;
  operations_history: number;
  global_score: number;
  level: KonaScoreLevel;
  details: Record<string, unknown>;
  calculated_at: string;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Organization> & { name: string; type: OrganizationType };
        Update: Partial<Organization>;
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; full_name: string; email: string };
        Update: Partial<Profile>;
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          uploaded_by: string | null;
          file_name: string;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          status: DocumentStatus;
          category: DocumentCategory | null;
          ai_confidence: number | null;
          extracted_data: Record<string, unknown>;
          tags: string[];
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      konascore_snapshots: {
        Row: KonaScoreSnapshot;
        Insert: Partial<KonaScoreSnapshot> & { organization_id: string };
        Update: Partial<KonaScoreSnapshot>;
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          details: Record<string, unknown>;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          title: string;
          message: string;
          type: string;
          is_read: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Functions: {
      calculate_konascore: {
        Args: { p_org_id: string };
        Returns: KonaScoreSnapshot;
      };
      get_user_organization_id: { Args: Record<string, never>; Returns: string };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      log_audit: {
        Args: {
          p_action: string;
          p_resource_type?: string;
          p_resource_id?: string;
          p_details?: Record<string, unknown>;
        };
        Returns: string;
      };
    };
  };
}

// Legacy compatibility with existing UI
export type Sector = 'global' | 'etablissement' | 'ong' | 'btp' | 'pme';

export const ORG_TYPE_TO_SECTOR: Record<string, Sector> = {
  school: 'etablissement',
  ngo: 'ong',
  btp: 'btp',
  university: 'etablissement',
  construction: 'btp',
  business: 'pme',
};

export function sectorFromOrgType(type: OrganizationType | string | undefined): Sector {
  if (!type) return 'global';
  return ORG_TYPE_TO_SECTOR[type] ?? 'global';
}

export const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Admin KonaData',
  org_admin: 'Directeur',
  deputy_director: 'Directeur Adjoint',
  registrar: 'Responsable Scolarité',
  accountant: 'Comptable',
  teacher: 'Enseignant',
  student: 'Élève',
  candidate: 'Candidat',
  ngo_staff: 'Staff ONG',
  btp_staff: 'Staff BTP',
  pme_staff: 'Staff PME',
  super_admin: 'Super Admin',
  director: 'Directeur',
};

export const ORG_TYPE_LABELS: Record<OrganizationType, string> = {
  school: 'Établissement scolaire',
  ngo: 'ONG',
  btp: 'BTP / Industries',
  business: 'PME / Commerce',
};
export const KONASCORE_LEVEL_LABELS: Record<KonaScoreLevel, string> = {
  excellent: 'Excellent',
  good: 'Bon',
  average: 'Moyen',
  risky: 'Risqué',
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  organization: Organization | null;
  avatar?: string;
}

export const SECTOR_LABELS: Record<Sector, string> = {
  global: 'Global',
  etablissement: 'Établissement',
  ong: 'ONG',
  btp: 'BTP',
  pme: 'PME',
};
// ─── UI / Legacy types (mock + components) ───────────────────

export interface KpiCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: string;
  color?: string;
}

export interface AIRecommendation {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  sector?: Sector;
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected';
  icon: string;
}

export interface Report {
  id: string;
  title: string;
  type: 'pdf' | 'excel' | 'word';
  date: string;
  sector: Sector;
  size: string;
}

export interface KonaScore {
  finance: number;
  organisation: number;
  croissance: number;
  conformite: number;
  global: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface DocumentUpload {
  id: string;
  name: string;
  type: string;
  detectedCategory: string;
  size: string;
  status: 'processing' | 'completed' | 'error';
}
