"use client";

import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color?: string;
  index?: number;
}

export function KpiCard({ title, value, change, icon: Icon, color = "bg-blue-500", index = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="hover:shadow-card-hover transition-shadow duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {change !== undefined && (
                <div className={cn("flex items-center gap-1 text-xs font-medium", change >= 0 ? "text-emerald-600" : "text-red-500")}>
                  {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {change >= 0 ? "+" : ""}{change}%
                </div>
              )}
            </div>
            <div className={cn("rounded-xl p-3", color)}>
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
