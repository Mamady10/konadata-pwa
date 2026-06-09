"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

interface SectorPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  items?: { id: string | number; title: string; subtitle: string; status: string; date?: string }[];
  emptyMessage?: string;
  connected?: boolean;
}

export function SectorPage({ title, description, icon: Icon, items = [], emptyMessage, connected }: SectorPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {connected && (
              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
                Supabase connecté
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button className="bg-[#2563EB] hover:bg-[#2563EB]/90">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={`Rechercher dans ${title.toLowerCase()}...`} className="pl-9" />
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                        {item.date && <span className="text-[10px] text-muted-foreground">{item.date}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{emptyMessage || "Aucune donnée disponible"}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
