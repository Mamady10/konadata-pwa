"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { KonaAIChat } from "@/components/kona-ai/chat-widget";
import { useApp } from "@/lib/contexts/app-context";

const LOADING_TIMEOUT_MS = 15_000;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useApp();
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setForceShow(false);
      return;
    }
    const t = setTimeout(() => setForceShow(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading && !forceShow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-background">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement KonaData...</p>
        </div>
      </div>
    );
  }

  if (loading && forceShow) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
        <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Connexion lente ou session expirée. Si l&apos;écran reste vide, ouvrez{' '}
          <a href="/login" className="font-medium underline">/login</a> ou videz le cache du navigateur (Ctrl+Shift+Suppr).
        </div>
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
        <KonaAIChat />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
      <KonaAIChat />
    </div>
  );
}
