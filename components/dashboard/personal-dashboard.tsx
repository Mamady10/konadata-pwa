'use client';

import Link from 'next/link';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { FileText, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

import type {
  PersonalDashboardLink,
  PersonalDashboardResourceRow,
} from '@/lib/sector/personal-dashboard-types';

export type { PersonalDashboardLink, PersonalDashboardResourceRow };

export interface PersonalDashboardProps {
  orgName: string;
  title: string;
  userName: string;
  scopeNote?: string;
  highlights: { label: string; value: string }[];
  links: PersonalDashboardLink[];
  resources?: PersonalDashboardResourceRow[];
  resourcesTitle?: string;
  emptyAssignmentMessage?: string;
}

export function PersonalDashboard({
  orgName,
  title,
  userName,
  scopeNote = "Aucune statistique globale de l'organisation n'est affichée sur cet espace.",
  highlights,
  links,
  resources,
  resourcesTitle = 'Mes affectations',
  emptyAssignmentMessage,
}: PersonalDashboardProps) {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">
          {orgName} — Bonjour {userName}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{scopeNote}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {highlights.map((h, i) => (
          <KpiCard key={h.label} title={h.label} value={h.value} icon={FileText} color="bg-blue-500" index={i} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{link.label}</p>
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>

      {resources && resources.length > 0 && (
        <DataTable
          title={resourcesTitle}
          data={resources.map((r) => ({
            id: r.id,
            nom: r.name,
            detail: r.meta ?? '—',
            statut: r.status ?? '—',
          }))}
          columns={[
            { key: 'nom', label: 'Nom' },
            { key: 'detail', label: 'Détail' },
            {
              key: 'statut',
              label: 'Statut',
              render: (item) => <StatusBadge status={item.statut as string} />,
            },
          ]}
        />
      )}

      {emptyAssignmentMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
          {emptyAssignmentMessage}
        </div>
      )}
    </div>
  );
}
