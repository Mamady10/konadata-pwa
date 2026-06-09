"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/contexts/app-context";
import { Sector } from "@/types";
import type { AppRole } from "@/types/database";
import { filterBtpNav } from "@/lib/btp/btp-access";
import { filterPmeNav } from "@/lib/pme/pme-access";
import { filterOngNav } from "@/lib/ong/ong-access";
import { filterEtablissementNav } from "@/lib/school/etablissement-access";
import {
  ASSISTANT_NAV_HREF,
  AI_MODELS_NAV_HREF,
} from "@/lib/ai/chat/assistant-access";
import {
  LayoutDashboard,
  Database,
  FileText,
  Plug,
  Building2,
  Users,
  Shield,
  Bot,
  Settings,
  GraduationCap,
  Heart,
  HardHat,
  ClipboardList,
  BookOpen,
  CreditCard,
  Award,
  CalendarDays,
  FolderKanban,
  MapPin,
  FileStack,
  Truck,
  Fuel,
  Receipt,
  TrendingUp,
  X,
  Store,
  ShoppingCart,
  Package,
  Wallet,
  UserCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const PLATFORM_ONLY = new Set(["/organisations", "/connecteurs", "/securite"]);

const globalNav: NavItem[] = [
  { label: "Tableau de Bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Data Factory", href: "/data-factory", icon: Database },
  { label: "Rapports", href: "/rapports", icon: FileText },
  { label: "Connecteurs", href: "/connecteurs", icon: Plug },
  { label: "Organisations", href: "/organisations", icon: Building2 },
  { label: "Utilisateurs", href: "/utilisateurs", icon: Users },
  { label: "Sécurité", href: "/securite", icon: Shield },
  { label: "Analyste IA", href: "/analyste-ia", icon: Bot },
  { label: "Paramètres", href: "/parametres", icon: Settings },
];

const DIRECTOR_ROLES = new Set<AppRole>(['org_admin', 'deputy_director', 'platform_admin']);

function isDirectorRole(role: AppRole | string | undefined): boolean {
  if (!role) return false;
  if (DIRECTOR_ROLES.has(role as AppRole)) return true;
  return ['director', 'country_director', 'project_director', 'super_admin'].includes(
    String(role)
  );
}
const DIRECTOR_TOOL_HREFS = new Set([
  '/utilisateurs',
  '/utilisateurs/assignations',
  '/btp/assignations',
  '/ong/assignations',
]);

function assignationsHref(sector: Exclude<Sector, 'global'> | null): string {
  if (sector === 'btp') return '/btp/assignations';
  if (sector === 'ong') return '/utilisateurs/assignations';
  return '/utilisateurs/assignations';
}

function assignationsIcon(sector: Exclude<Sector, 'global'> | null): React.ElementType {
  if (sector === 'btp') return HardHat;
  if (sector === 'ong') return FolderKanban;
  return GraduationCap;
}

const sectorTools: NavItem[] = [
  { label: "Data Factory", href: "/data-factory", icon: Database },
  { label: "Modèles IA", href: "/parametres/modeles", icon: Bot },
  { label: "Utilisateurs", href: "/utilisateurs", icon: Users },
  { label: "Assignations", href: "/utilisateurs/assignations", icon: GraduationCap },
  { label: "Paramètres", href: "/parametres", icon: Settings },
];

const sectorNav: Record<Exclude<Sector, "global">, NavItem[]> = {
  etablissement: [
    { label: "Dashboard", href: "/etablissement", icon: LayoutDashboard },
    { label: "Candidatures", href: "/etablissement/candidatures", icon: ClipboardList },
    { label: "Étudiants", href: "/etablissement/etudiants", icon: GraduationCap },
    { label: "Formations", href: "/etablissement/formations", icon: BookOpen },
    { label: "Paiements", href: "/etablissement/paiements", icon: CreditCard },
    { label: "Résultats", href: "/etablissement/resultats", icon: Award },
    { label: "Bulletins", href: "/etablissement/bulletins", icon: FileText },
    { label: "Vie scolaire", href: "/etablissement/vie-scolaire", icon: CalendarDays },
    { label: "Rapports", href: "/etablissement/rapports", icon: FileStack },
  ],
  ong: [
    { label: "Dashboard", href: "/ong", icon: LayoutDashboard },
    { label: "Projets", href: "/ong/projets", icon: FolderKanban },
    { label: "Sondages", href: "/ong/sondages", icon: ClipboardList },
    { label: "Bénéficiaires", href: "/ong/beneficiaires", icon: Heart },
    { label: "Cartographie", href: "/ong/cartographie", icon: MapPin },
    { label: "Rapports", href: "/ong/rapports", icon: FileText },
    { label: "Documents", href: "/ong/documents", icon: FileStack },
  ],
  btp: [
    { label: "Dashboard", href: "/btp", icon: LayoutDashboard },
    { label: "Chantiers", href: "/btp/chantiers", icon: HardHat },
    { label: "Personnel", href: "/btp/personnel", icon: Users },
    { label: "Matériels", href: "/btp/materiels", icon: Truck },
    { label: "Carburant", href: "/btp/carburant", icon: Fuel },
    { label: "Bons", href: "/btp/bons", icon: Receipt },
    { label: "Avancement", href: "/btp/avancement", icon: TrendingUp },
    { label: "Documents", href: "/btp/documents", icon: FileStack },
    { label: "Rapports", href: "/btp/rapports", icon: FileText },
  ],
  pme: [
    { label: "Dashboard", href: "/pme", icon: LayoutDashboard },
    { label: "Ventes", href: "/pme/ventes", icon: ShoppingCart },
    { label: "Achats", href: "/pme/achats", icon: Receipt },
    { label: "Dépenses", href: "/pme/depenses", icon: Wallet },
    { label: "Stocks", href: "/pme/stocks", icon: Package },
    { label: "Clients", href: "/pme/clients", icon: UserCircle },
    { label: "Fournisseurs", href: "/pme/fournisseurs", icon: Truck },
    { label: "Documents", href: "/pme/documents", icon: FileStack },
    { label: "Rapports", href: "/pme/rapports", icon: FileText },
  ],
};

const sectorIcons: Record<Exclude<Sector, "global">, React.ElementType> = {
  etablissement: GraduationCap,
  ong: Heart,
  btp: HardHat,
  pme: Store,
};

const sectorLabels: Record<Exclude<Sector, "global">, string> = {
  etablissement: "Établissement",
  ong: "ONG",
  btp: "BTP",
  pme: "PME",
};

const sectorHome: Record<Exclude<Sector, "global">, string> = {
  etablissement: "/etablissement",
  ong: "/ong",
  btp: "/btp",
  pme: "/pme",
};

function pathSector(pathname: string): Exclude<Sector, "global"> | null {
  if (pathname.startsWith("/etablissement")) return "etablissement";
  if (pathname.startsWith("/ong")) return "ong";
  if (pathname.startsWith("/btp")) return "btp";
  if (pathname.startsWith("/pme")) return "pme";
  return null;
}

function filterAiNavItems(items: NavItem[], assistantNavVisible: boolean): NavItem[] {
  let out = items.filter((item) => {
    if (item.href === ASSISTANT_NAV_HREF || item.href === AI_MODELS_NAV_HREF) {
      return assistantNavVisible;
    }
    return true;
  });

  if (
    assistantNavVisible &&
    !out.some((item) => item.href === ASSISTANT_NAV_HREF)
  ) {
    const settingsIdx = out.findIndex((item) => item.href === '/parametres');
    const analysteItem: NavItem = {
      label: 'Analyste IA',
      href: ASSISTANT_NAV_HREF,
      icon: Bot,
    };
    if (settingsIdx >= 0) {
      out = [...out.slice(0, settingsIdx), analysteItem, ...out.slice(settingsIdx)];
    } else {
      out = [...out, analysteItem];
    }
  }

  return out;
}

function resolveToolNav(
  isSectorContext: boolean,
  isDirector: boolean,
  pathname: string,
  sector: Exclude<Sector, 'global'> | null,
  assistantNavVisible: boolean
): NavItem[] {
  const onDirectorPages =
    pathname.startsWith('/utilisateurs') ||
    pathname.startsWith('/btp/assignations') ||
    pathname.startsWith('/ong');

  if (isDirector && (isSectorContext || onDirectorPages)) {
    const tools = isSectorContext
      ? sectorTools
      : sectorTools.filter((item) => DIRECTOR_TOOL_HREFS.has(item.href));
    const filtered = filterAiNavItems(tools, assistantNavVisible);
    if (!isSectorContext) return filtered;
    const AssignIcon = assignationsIcon(sector);
    return filtered.map((item) => {
      if (item.href === '/utilisateurs/assignations') {
        return {
          ...item,
          href: assignationsHref(sector),
          icon: AssignIcon,
        };
      }
      return item;
    });
  }

  if (!isSectorContext) return [];

  if (isDirector) return filterAiNavItems(sectorTools, assistantNavVisible);

  return filterAiNavItems(
    sectorTools.filter((item) => !DIRECTOR_TOOL_HREFS.has(item.href)),
    assistantNavVisible
  );
}

function filterGlobalNav(role: AppRole | undefined, assistantNavVisible: boolean): NavItem[] {
  const isPlatformAdmin = role === "platform_admin";
  return filterAiNavItems(
    globalNav.filter((item) => {
      if (PLATFORM_ONLY.has(item.href)) return isPlatformAdmin;
      return true;
    }),
    assistantNavVisible || isPlatformAdmin
  );
}

function filterSectorNav(
  role: AppRole | string | undefined,
  sector: Exclude<Sector, 'global'>,
  items: NavItem[]
): NavItem[] {
  if (sector === 'etablissement') {
    return filterEtablissementNav(role, items);
  }
  if (sector === 'ong') {
    return filterOngNav(role, items);
  }
  if (sector === 'btp') {
    return filterBtpNav(role, items);
  }
  if (sector === 'pme') {
    return filterPmeNav(role, items);
  }
  return items;
}

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sector: userSector, user, assistantNavVisible } = useApp();

  const routeSector = pathSector(pathname);
  const effectiveSector =
    routeSector ?? (userSector !== "global" ? userSector : null);

  const isSectorContext = effectiveSector !== null;
  const SectorIcon = isSectorContext ? sectorIcons[effectiveSector] : null;

  const isDirector = isDirectorRole(user?.role);

  const mainNav = isSectorContext
    ? filterSectorNav(user?.role, effectiveSector, sectorNav[effectiveSector])
    : filterGlobalNav(user?.role, assistantNavVisible);

  const toolNav = resolveToolNav(
    isSectorContext,
    isDirector,
    pathname,
    effectiveSector,
    assistantNavVisible
  );

  const logoHref = isSectorContext ? sectorHome[effectiveSector] : "/dashboard";

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-[#0A192F] text-white transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-white/10">
          <Link href={logoHref} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]">
              <Database className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">KonaData</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-4 mt-4">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400">Supabase connecté</span>
          </div>
        </div>

        {isSectorContext && SectorIcon && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <SectorIcon className="h-4 w-4 text-[#2563EB]" />
            <span className="text-xs font-medium text-white/70">
              Module {sectorLabels[effectiveSector]}
            </span>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          <ul className="space-y-1">
            {mainNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#2563EB] text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {toolNav.length > 0 && (
            <>
              <p className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Outils
              </p>
              <ul className="space-y-1">
                {toolNav.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-[#2563EB] text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="text-[10px] text-white/30 text-center">KonaData v1.0 — Guinée</p>
        </div>
      </aside>
    </>
  );
}
