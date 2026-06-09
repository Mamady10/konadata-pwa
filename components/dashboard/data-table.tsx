"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  title,
  columns,
  data,
  className,
}: DataTableProps<T>) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {columns.map((col) => (
                  <th key={String(col.key)} className="pb-3 pr-4 font-medium text-muted-foreground">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="py-3 pr-4">
                      {col.render
                        ? col.render(item)
                        : String(item[col.key as keyof T] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors: Record<string, string> = {
    Admis: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    "En attente": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Refusé: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    "En cours": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "En retard": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Succès: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    Échec: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Normal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    Alerte: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Dépassé: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Actif: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    Inactif: "bg-muted text-muted-foreground",
  };

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", colors[status] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}
