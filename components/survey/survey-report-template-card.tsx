'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  uploadOrganizationAiTemplate,
  removeOrganizationAiTemplate,
} from '@/lib/actions/document-templates';
import { NGO_SURVEY_REPORT_PURPOSE } from '@/lib/ai/document-template-purposes';
import { CheckCircle2, FileText, Trash2, Upload } from 'lucide-react';

export interface SurveyReportTemplateInfo {
  id: string;
  label: string;
  fileName: string;
  notes: string | null;
}

interface Props {
  template: SurveyReportTemplateInfo | null;
}

export function SurveyReportTemplateCard({ template }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set('sector', 'ngo');
    formData.set('purpose', NGO_SURVEY_REPORT_PURPOSE);
    const result = await uploadOrganizationAiTemplate(formData);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setMessage('Modèle enregistré. Les prochains rapports KonaAI suivront cette structure.');
    router.refresh();
  }

  async function handleRemove() {
    if (!template || !confirm('Supprimer le modèle de rapport de sondage ?')) return;
    setLoading(true);
    setError(null);
    const result = await removeOrganizationAiTemplate(template.id);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setMessage('Modèle supprimé.');
    router.refresh();
  }

  return (
    <Card className="border-[#2563EB]/25">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#2563EB]" />
          Modèle de rapport organisation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Déposez un exemple de rapport validé par votre direction. KonaAI adaptera la structure,
          les rubriques et le ton de chaque rapport de sondage à ce modèle.
        </p>

        {template ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">{template.label}</span>
                <Badge variant="secondary" className="text-xs">
                  Actif
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Fichier : {template.fileName}</p>
              {template.notes && (
                <p className="text-xs text-muted-foreground">Consignes : {template.notes}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleRemove}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Supprimer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-dashed p-3">
            <div className="space-y-1">
              <Label htmlFor="survey-template-file">Fichier modèle (PDF, Word, Excel, image)</Label>
              <Input
                id="survey-template-file"
                name="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="survey-template-notes">Consignes (optionnel)</Label>
              <Input
                id="survey-template-notes"
                name="notes"
                placeholder="Ex. inclure une section méthodologie et recommandations bailleur"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="bg-[#2563EB]" disabled={loading}>
              <Upload className="h-4 w-4 mr-1" />
              {loading ? 'Envoi…' : 'Joindre le modèle'}
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <p className="text-xs text-muted-foreground">
          Vous pouvez aussi gérer tous les modèles dans{' '}
          <Link href="/parametres/modeles" className="text-primary underline">
            Paramètres → Modèles IA
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
