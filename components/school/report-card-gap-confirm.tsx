'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GradeGapReport } from '@/lib/school/grade-gaps';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  gapSummary: string;
  gapReport: GradeGapReport | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ReportCardGapConfirm({
  open,
  title,
  message,
  gapSummary,
  gapReport,
  loading,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>{message}</p>
          {gapReport && (
            <p className="text-muted-foreground">
              {gapReport.totalMissingSlots} case(s) vide(s) · {gapReport.studentsWithGaps} élève(s)
              · {gapReport.requiredPerSubject} note(s) requise(s) par matière
            </p>
          )}
          <p className="text-xs rounded-lg bg-muted/60 p-3 border">
            La note <strong>0/20</strong> est incluse dans la moyenne. Seules les cases non saisies
            sont signalées ci-dessous.
          </p>
          {gapSummary && (
            <pre className="whitespace-pre-wrap text-xs rounded-lg border bg-amber-500/5 p-3 font-sans">
              {gapSummary}
            </pre>
          )}
          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Annuler
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? '…' : 'Continuer quand même'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
