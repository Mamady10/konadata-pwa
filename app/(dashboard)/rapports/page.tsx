"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rapports } from "@/lib/mock-data";
import { SECTOR_LABELS, Report } from "@/types";
import { downloadTextAsPdf } from "@/lib/reports/download-text-as-pdf";
import { FileText, FileSpreadsheet, Download, Share2, Plus, FileType } from "lucide-react";
import { motion } from "framer-motion";

const typeIcons = {
  pdf: FileText,
  excel: FileSpreadsheet,
  word: FileType,
};

const typeColors = {
  pdf: "text-red-500 bg-red-50 dark:bg-red-950/30",
  excel: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  word: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
};

function ReportCard({ report }: { report: Report }) {
  const Icon = typeIcons[report.type];

  async function handleDownload() {
    await downloadTextAsPdf({
      title: report.title,
      content: [
        `Secteur : ${SECTOR_LABELS[report.sector]}`,
        `Type : ${report.type.toUpperCase()}`,
        `Date : ${report.date}`,
        `Taille : ${report.size}`,
        '',
        'Document de démonstration KonaData.',
      ].join('\n'),
      metaLine: 'Rapports — KonaData',
    });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="hover:shadow-card-hover transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${typeColors[report.type]}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{report.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] uppercase">{report.type}</Badge>
                <Badge variant="outline" className="text-[10px]">{SECTOR_LABELS[report.sector]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{report.date} — {report.size}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => void handleDownload()}>
              <Download className="h-3 w-3" />
              Télécharger PDF
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              <Share2 className="h-3 w-3" />
              Partager
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function RapportsPage() {
  const pdfReports = rapports.filter((r) => r.type === "pdf");
  const excelReports = rapports.filter((r) => r.type === "excel");
  const wordReports = rapports.filter((r) => r.type === "word");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports</h1>
          <p className="text-muted-foreground">Générez, téléchargez et partagez vos rapports</p>
        </div>
        <Button className="bg-[#2563EB] hover:bg-[#2563EB]/90">
          <Plus className="h-4 w-4" />
          Générer un rapport
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tous ({rapports.length})</TabsTrigger>
          <TabsTrigger value="pdf">PDF ({pdfReports.length})</TabsTrigger>
          <TabsTrigger value="excel">Excel ({excelReports.length})</TabsTrigger>
          <TabsTrigger value="word">Word ({wordReports.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rapports.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        </TabsContent>
        <TabsContent value="pdf" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pdfReports.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        </TabsContent>
        <TabsContent value="excel" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {excelReports.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        </TabsContent>
        <TabsContent value="word" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wordReports.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
