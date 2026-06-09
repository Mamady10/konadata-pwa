'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { uploadPmeDocument, type PmeDocumentRow } from '@/lib/actions/storage';
import { CaptureExtractionView } from '@/components/documents/capture-extraction-view';
import { reRunCaptureExtraction } from '@/lib/actions/capture-extraction';
import { FileStack, Upload } from 'lucide-react';

interface DocTypeOption {
  id: string;
  label: string;
  hint?: string;
}

interface Props {
  documents: PmeDocumentRow[];
  documentTypes: DocTypeOption[];
}

export function PmeDocumentsClient({ documents, documentTypes }: Props) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedType = documentTypes.find((t) => t.id === documentType);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!documentType) {
      setError('Choisissez le type de document avant de téléverser.');
      return;
    }

    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('document_type', documentType);

    const result = await uploadPmeDocument(fd);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">
          Modèles KonaData (dépenses, commandes, inventaire) — extraction structurée après scan ou CSV.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Téléverser un document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>Type de document *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir le type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType?.hint && (
              <p className="text-xs text-muted-foreground">{selectedType.hint}</p>
            )}
          </div>
          <label>
            <Button asChild disabled={loading || !documentType} className="cursor-pointer">
              <span>
                <Upload className="h-4 w-4" />
                {loading ? 'Envoi…' : 'Choisir le fichier'}
              </span>
            </Button>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
              onChange={handleUpload}
              disabled={loading || !documentType}
            />
          </label>
        </CardContent>
      </Card>

      {documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <FileStack className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Badge className="bg-violet-500/10 text-violet-800 border-violet-200">
                  {doc.doc_type_label}
                </Badge>
                {doc.captureExtraction && (
                  <Badge variant="outline" className="text-emerald-800 border-emerald-300">
                    Structuré
                  </Badge>
                )}
              </div>
              {doc.captureExtraction && (
                <CaptureExtractionView
                  extraction={doc.captureExtraction}
                  documentId={doc.id}
                  compact
                  onReExtract={reRunCaptureExtraction}
                />
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            Aucun document PME — téléchargez un modèle vierge dans Paramètres → Modèles, puis déposez-le ici.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
