"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { AIRecommendation } from "@/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const typeConfig = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", badge: "default" as const },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", badge: "warning" as const },
  success: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", badge: "success" as const },
  danger: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", badge: "destructive" as const },
};

interface AIRecommendationsProps {
  recommendations: AIRecommendation[];
  title?: string;
}

export function AIRecommendations({ recommendations, title = "Recommandations IA" }: AIRecommendationsProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, index) => {
          const config = typeConfig[rec.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn("flex items-start gap-3 rounded-lg p-3", config.bg)}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
              <p className="flex-1 text-sm">{rec.message}</p>
              <Badge variant={config.badge} className="shrink-0 text-[10px]">
                IA
              </Badge>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
