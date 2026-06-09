"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KonaScore } from "@/types";
import { motion } from "framer-motion";

interface KonaScoreCardProps {
  score: KonaScore;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function KonaScoreCard({ score }: KonaScoreCardProps) {
  const metrics = [
    { label: "Finance", value: score.finance, color: "#2563EB" },
    { label: "Organisation", value: score.organisation, color: "#10B981" },
    { label: "Croissance", value: score.croissance, color: "#F59E0B" },
    { label: "Conformité", value: score.conformite, color: "#8B5CF6" },
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>KonaScore</span>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <div className="text-center">
              <div className="text-xl font-bold">{score.global}</div>
              <div className="text-[10px] opacity-80">/100</div>
            </div>
          </motion.div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((m, i) => (
          <ScoreBar key={m.label} label={m.label} value={m.value} color={m.color} />
        ))}
      </CardContent>
    </Card>
  );
}
