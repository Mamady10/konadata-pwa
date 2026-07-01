'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LucideIcon, Download, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { downloadTextAsPdf, formatReportItemAsText } from '@/lib/reports/download-text-as-pdf';

export interface ReportListItem {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
}

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  items: ReportListItem[];
  emptyMessage?: string;
  connected?: boolean;
  /** Export PDF de toute la liste en un seul fichier */
  showBulkPdf?: boolean;
}

export function ReportItemsList({
  title,
  description,
  icon: Icon,
  items,
  emptyMessage,
  connected,
  showBulkPdf = true,
}: Props) {
  async function exportOne(item: ReportListItem) {
    await downloadTextAsPdf({
      title: item.title,
      content: formatReportItemAsText(item),
      metaLine: `${title} — KonaData`,
    });
  }

  async function exportAll() {
    const body = items
      .map((item, i) => `--- ${i + 1}. ${item.title} ---\n${formatReportItemAsText(item)}`)
      .join('\n\n');
    await downloadTextAsPdf({
      title: `${title} — synthèse`,
      content: body || 'Aucune donnée.',
      metaLine: description,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        {showBulkPdf && items.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => void exportAll()}>
            <Download className="h-4 w-4 mr-1" />
            Tout exporter en PDF
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={`Rechercher dans ${title.toLowerCase()}...`} className="pl-9" readOnly aria-hidden />
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className="hover:shadow-card-hover transition-shadow h-full">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full justify-start text-xs"
                    onClick={() => void exportOne(item)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    PDF
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{emptyMessage ?? 'Aucune donnée disponible'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
