"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { connecteurs } from "@/lib/mock-data";
import {
  MessageCircle,
  Mail,
  Smartphone,
  Fuel,
  Plug,
  CheckCircle,
  XCircle,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";

const iconMap: Record<string, React.ElementType> = {
  "message-circle": MessageCircle,
  mail: Mail,
  smartphone: Smartphone,
  fuel: Fuel,
  plug: Plug,
};

export default function ConnecteursPage() {
  const connected = connecteurs.filter((c) => c.status === "connected").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connecteurs</h1>
          <p className="text-muted-foreground">
            {connected}/{connecteurs.length} connecteurs actifs
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {connecteurs.map((connector, index) => {
          const Icon = iconMap[connector.icon] || Plug;
          const isConnected = connector.status === "connected";

          return (
            <motion.div
              key={connector.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-card-hover transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant={isConnected ? "success" : "secondary"} className="gap-1">
                      {isConnected ? (
                        <><CheckCircle className="h-3 w-3" /> Connecté</>
                      ) : (
                        <><XCircle className="h-3 w-3" /> Déconnecté</>
                      )}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-lg">{connector.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">{connector.description}</p>
                  <Button
                    variant={isConnected ? "outline" : "default"}
                    size="sm"
                    className={!isConnected ? "bg-[#2563EB] hover:bg-[#2563EB]/90" : ""}
                  >
                    <Settings className="h-3 w-3" />
                    {isConnected ? "Configurer" : "Connecter"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Integration info */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Plug className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold">Intégrations prévues</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Structure préparée pour Supabase, OpenAI et WhatsApp Business API.
            Les connecteurs pourront être activés via la configuration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
