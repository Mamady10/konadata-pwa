"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/contexts/app-context";
import { SECTOR_LABELS, Sector } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Bell, Menu, Moon, Sun, GraduationCap, Heart, HardHat, Globe, Store, LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/types/database";

const sectorOptions: { value: Sector; label: string; icon: React.ElementType }[] = [
  { value: "global", label: "Global", icon: Globe },
  { value: "etablissement", label: "Établissement", icon: GraduationCap },
  { value: "ong", label: "ONG", icon: Heart },
  { value: "btp", label: "BTP", icon: HardHat },
  { value: "pme", label: "PME", icon: Store },
];

const sectorRoutes: Record<Sector, string> = {
  global: "/dashboard",
  etablissement: "/etablissement",
  ong: "/ong",
  btp: "/btp",
  pme: "/pme",
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, sector, setSector, darkMode, toggleDarkMode, setSidebarOpen, organization } = useApp();

  const userSector = sector !== "global" ? sector : null;
  const isPlatformAdmin = user?.role === "platform_admin";

  const availableSectorOptions = isPlatformAdmin
    ? sectorOptions
    : userSector
    ? sectorOptions.filter((opt) => opt.value === userSector || opt.value === "global")
    : sectorOptions.filter((opt) => opt.value === "global");

  useEffect(() => {
    if (pathname.startsWith("/etablissement")) setSector("etablissement");
    else if (pathname.startsWith("/ong")) setSector("ong");
    else if (pathname.startsWith("/btp")) setSector("btp");
    else if (pathname.startsWith("/pme")) setSector("pme");
  }, [pathname, setSector]);

  const handleSectorChange = (value: Sector) => {
    setSector(value);
    router.push(sectorRoutes[value]);
  };

  const displayName = user?.name ?? organization?.name ?? "Utilisateur";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Organization name */}
      <div className="hidden md:block">
        <p className="text-sm font-semibold">{organization?.name ?? user?.organization?.name ?? "KonaData"}</p>
        <p className="text-xs text-muted-foreground">{SECTOR_LABELS[sector]}</p>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Recherche globale..."
          className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Sector selector — masqué si un seul secteur disponible */}
        {availableSectorOptions.length > 1 && (
          <Select value={sector} onValueChange={(v) => handleSectorChange(v as Sector)}>
            <SelectTrigger className="w-[160px] hidden sm:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableSectorOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Dark mode toggle */}
        <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            3
          </span>
        </Button>

        {/* User profile */}
        <div className="flex items-center gap-2 pl-2 border-l">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:block">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.role ? ROLE_LABELS[user.role] : user?.email ?? organization?.name}
            </p>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="icon" type="submit" title="Déconnexion">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
