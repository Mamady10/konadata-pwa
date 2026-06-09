"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Bot, Sparkles, MessageSquare, BarChart3, FileSearch, Zap, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { KonaAIChatConfig } from "@/lib/actions/kona-ai-chat";

const capabilities = [
  { icon: BarChart3, title: "Analyse financière", desc: "Encaissements, budgets, KPIs de votre organisation" },
  { icon: MessageSquare, title: "Rapports intelligents", desc: "Synthèses générées depuis Supabase (module Rapports)" },
  { icon: FileSearch, title: "Recherche documentaire", desc: "Data Factory : OCR scans + extraction de listes (élèves, bénéficiaires…)" },
  { icon: Zap, title: "Alertes métier", desc: "Retards chantiers, stocks, candidatures en attente" },
];

type Props = {
  config: KonaAIChatConfig | null;
  configError: string | null;
};

export function AnalysteIAView({ config, configError }: Props) {
  const llm = config?.llmAvailable ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {config?.assistantLabel ?? 'Assistant'} — {config?.llmAvailable ? 'KonaAI' : 'données'}
        </h1>
        <p className="text-muted-foreground">
          {config?.widgetVisible === false
            ? 'Réservé aux directeurs — l’assistant KonaAI arrive dans une prochaine version (V1 = plateforme sans IA).'
            : `Connecté aux données de ${config?.orgName ?? 'votre organisation'}`}
        </p>
      </div>

      {config && !config.widgetVisible && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Le chat flottant n&apos;est pas affiché : offre actuelle{' '}
            <strong>{config.aiOfferTierLabel}</strong>. Contactez KonaData pour activer un palier avec
            assistant KonaAI (bientôt disponible).
          </CardContent>
        </Card>
      )}

      {configError && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex gap-3 text-sm text-amber-900">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{configError}</p>
          </CardContent>
        </Card>
      )}

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#2563EB] mb-6">
              <Bot className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{config?.assistantLabel ?? 'Assistant'}</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-4">
              {config?.widgetVisible
                ? (
                  <>
                    Chat flottant (directeur, offre IA active). Sans API : <strong>Assistant données</strong> répond
                    avec des chiffres précis (encaissements, candidatures…). Avec OpenAI + DPA : <strong>KonaAI</strong>{' '}
                    en langage naturel. Onglet Rapport / Bulletin pour documents structurés.
                  </>
                )
                : (
                  <>
                    Activez une offre IA (hors Essentiel) sur votre contrat KonaData pour débloquer l&apos;assistant
                    direction.
                  </>
                )}
            </p>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {llm
                    ? 'KonaAI — OpenAI actif'
                    : config?.widgetVisible
                      ? 'Assistant données — FAQ chiffrée (sans appel externe)'
                      : 'Non disponible pour ce compte'}
                </span>
              </div>
              {config && (
                <p className="text-xs text-muted-foreground">
                  Secteur : {config.sectorLabel}
                  {config.reportPath && (
                    <>
                      {' '}
                      ·{' '}
                      <Link href={config.reportPath} className="text-primary hover:underline">
                        Rapports détaillés
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((cap, index) => (
          <motion.div
            key={cap.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-card-hover transition-shadow h-full">
              <CardContent className="p-6">
                <cap.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold">{cap.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cap.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {config && config.suggestions.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Exemples pour votre organisation</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {config.suggestions.map((q) => (
                <div
                  key={q}
                  className="rounded-lg border p-3 text-sm text-muted-foreground"
                >
                  &ldquo;{q}&rdquo;
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Cliquez sur une suggestion dans le chat flottant pour l&apos;envoyer.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
