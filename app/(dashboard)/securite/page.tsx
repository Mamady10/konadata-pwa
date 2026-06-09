"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, StatusBadge } from "@/components/dashboard/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  historiqueConnexions,
  alertesSecurite,
  activitesUtilisateurs,
  journalSysteme,
} from "@/lib/mock-data";
import { Shield, AlertTriangle, Activity, ScrollText } from "lucide-react";

const severiteColors: Record<string, string> = {
  Moyenne: "warning",
  Haute: "destructive",
  Critique: "destructive",
};

const niveauColors: Record<string, string> = {
  INFO: "success",
  WARN: "warning",
  ERROR: "destructive",
};

export default function SecuritePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sécurité</h1>
        <p className="text-muted-foreground">Surveillance, alertes et journal d&apos;activité</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Connexions aujourd'hui", value: "47", icon: Shield, color: "text-blue-500" },
          { label: "Alertes actives", value: "3", icon: AlertTriangle, color: "text-amber-500" },
          { label: "Activités (24h)", value: "156", icon: Activity, color: "text-emerald-500" },
          { label: "Événements système", value: "12", icon: ScrollText, color: "text-violet-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="connexions">
        <TabsList>
          <TabsTrigger value="connexions">Historique connexions</TabsTrigger>
          <TabsTrigger value="alertes">Alertes</TabsTrigger>
          <TabsTrigger value="activites">Activités utilisateurs</TabsTrigger>
          <TabsTrigger value="journal">Journal système</TabsTrigger>
        </TabsList>

        <TabsContent value="connexions" className="mt-6">
          <DataTable
            title="Historique des connexions"
            data={historiqueConnexions}
            columns={[
              { key: "utilisateur", label: "Utilisateur" },
              { key: "ip", label: "Adresse IP" },
              { key: "date", label: "Date" },
              { key: "statut", label: "Statut", render: (item) => <StatusBadge status={item.statut as string} /> },
            ]}
          />
        </TabsContent>

        <TabsContent value="alertes" className="mt-6">
          <div className="space-y-3">
            {alertesSecurite.map((alerte) => (
              <Card key={alerte.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alerte.type}</span>
                      <Badge variant={severiteColors[alerte.severite] as "warning" | "destructive"}>{alerte.severite}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alerte.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{alerte.date}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activites" className="mt-6">
          <DataTable
            title="Activités utilisateurs"
            data={activitesUtilisateurs}
            columns={[
              { key: "utilisateur", label: "Utilisateur" },
              { key: "action", label: "Action" },
              { key: "module", label: "Module" },
              { key: "date", label: "Date" },
            ]}
          />
        </TabsContent>

        <TabsContent value="journal" className="mt-6">
          <div className="space-y-2">
            {journalSysteme.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Badge variant={niveauColors[entry.niveau] as "success" | "warning" | "destructive"} className="w-16 justify-center text-[10px]">
                    {entry.niveau}
                  </Badge>
                  <span className="text-sm flex-1">{entry.message}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
