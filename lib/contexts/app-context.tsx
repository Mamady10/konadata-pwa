'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { AppUser, Organization, Sector, AppRole } from '@/types/database';
import { getOrgType, sectorFromOrgType } from '@/types/database';

interface AppContextType {
  user: AppUser | null;
  sector: Sector;
  setSector: (sector: Sector) => void;
  organization: Organization | null;
  organizations: Organization[];
  setOrganization: (org: Organization) => void;
  /** Directeur + offre IA active (ou CEO). */
  assistantNavVisible: boolean;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export interface AppProviderInitialProfile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  organization: Organization | null;
  assistantNavVisible?: boolean;
}

function profileToAppUser(profile: AppProviderInitialProfile): AppUser {
  return {
    id: profile.id,
    name: profile.full_name || profile.email,
    email: profile.email,
    role: profile.role,
    organization: profile.organization,
    avatar: undefined,
  };
}

function sectorFromProfile(profile: AppProviderInitialProfile | null): Sector {
  if (!profile?.organization) return 'global';
  const orgType = getOrgType(profile.organization);
  return orgType ? sectorFromOrgType(orgType) : 'global';
}

export function AppProvider({
  children,
  initialProfile = null,
}: {
  children: ReactNode;
  initialProfile?: AppProviderInitialProfile | null;
}) {
  const [user, setUser] = useState<AppUser | null>(() =>
    initialProfile ? profileToAppUser(initialProfile) : null
  );
  const [organization, setOrganizationState] = useState<Organization | null>(
    () => initialProfile?.organization ?? null
  );
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sector, setSector] = useState<Sector>(() => sectorFromProfile(initialProfile));
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [assistantNavVisible, setAssistantNavVisible] = useState(
    () => initialProfile?.assistantNavVisible ?? false
  );
  const [loading, setLoading] = useState(!initialProfile);

  const refreshUser = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setUser(null);
        setOrganizationState(null);
        return;
      }

      const authUser = session.user;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, organization_id')
        .eq('id', authUser.id)
        .single();

      if (profileError || !profile) {
        setUser({
          id: authUser.id,
          name: authUser.email?.split('@')[0] ?? 'Utilisateur',
          email: authUser.email ?? '',
          role: 'candidate' as AppRole,
          organization: null,
        });
        setAssistantNavVisible(false);
        return;
      }

      let org: Organization | null = null;
      if (profile.organization_id) {
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .single();
        org = (orgRow as Organization | null) ?? null;
      }

      const appUser: AppUser = {
        id: profile.id,
        name: profile.full_name || profile.email,
        email: profile.email,
        role: profile.role as AppRole,
        organization: org,
        avatar: profile.avatar_url ?? undefined,
      };
      setUser(appUser);
      setOrganizationState(org);
      const orgType = getOrgType(org);
      if (orgType) {
        setSector(sectorFromOrgType(orgType));
      }

      const { resolveAssistantNavVisible } = await import('@/lib/ai/chat/assistant-nav-server');
      setAssistantNavVisible(await resolveAssistantNavVisible());
    } catch {
      setUser(null);
      setOrganizationState(null);
      setAssistantNavVisible(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    refreshUser();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        refreshUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshUser]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const setOrganization = (org: Organization) => {
    setOrganizationState(org);
    setSector(sectorFromOrgType(getOrgType(org)));
  };
  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <AppContext.Provider
      value={{
        user,
        sector,
        setSector,
        organization,
        organizations,
        setOrganization,
        assistantNavVisible,
        darkMode,
        toggleDarkMode,
        sidebarOpen,
        setSidebarOpen,
        loading,
        refreshUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
