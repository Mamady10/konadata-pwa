'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { uploadNgoProjectDocument, type NgoDocumentRow } from '@/lib/actions/storage';
import type { SectorDocumentTypeOption } from '@/lib/documents/sector-document-types';
import { DocumentAiGuidance } from '@/components/documents/document-ai-guidance';
import { CaptureExtractionView } from '@/components/documents/capture-extraction-view';
import { DirectorAiModelsLink } from '@/components/documents/director-ai-models-link';
import { reRunCaptureExtraction } from '@/lib/actions/capture-extraction';
import { AlertCircle, FileStack, Search, Upload } from 'lucide-react';

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  documents: NgoDocumentRow[];
  projects: ProjectOption[];
  documentTypes: SectorDocumentTypeOption[];
  isDirector: boolean;
  hasAssignments: boolean;
}

const ALL_FILTER = '__all__';

export function DocumentsClient({
  documents,
  projects,
  documentTypes,
  isDirector,
  hasAssignments,
}: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [filterProject, setFilterProject] = useState(ALL_FILTER);
  const [filterType, setFilterType] = useState(ALL_FILTER);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedType = documentTypes.find((t) => t.id === documentType);
  const customTypeIds = useMemo(
    () => new Set(documentTypes.filter((t) => t.id.startsWith('custom_')).map((t) => t.id)),
    [documentTypes]
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!projectId) {
      setError('Sélectionnez un projet.');
      return;
    }
    if (!documentType) {
      setError('Choisissez le type de document avant de téléverser.');
      return;
    }

    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('project_id', projectId);
    fd.set('document_type', documentType);

    const result = await uploadNgoProjectDocument(fd);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
    e.target.value = '';
  }

  const canUpload = isDirector || hasAssignments;

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (filterProject !== ALL_FILTER && doc.project_id !== filterProject) return false;
      if (filterType !== ALL_FILTER && doc.doc_type !== filterType) return false;
      if (q) {
        const hay = `${doc.file_name} ${doc.project_name ?? ''} ${doc.doc_type_label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [documents, filterProject, filterType, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">
          {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} affiché
          {filteredDocuments.length !== 1 ? 's' : ''}
          {!isDirector && hasAssignments && ' — vos projets assignés'}
        </p>
        {isDirector && (
          <DirectorAiModelsLink hint="définissez un exemple par type de rapport pour guider l'adaptation automatique" />
        )}
      </div>

      {!hasAssignments && !isDirector && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Aucun projet assigné. Demandez au directeur vos assignations dans Utilisateurs.
        </div>
      )}

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
          <p className="text-sm text-muted-foreground">
            Indiquez d&apos;abord le type de fichier : cela facilite le tri, les rapports IA et la recherche
            pour la direction.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label>Type de document *</Label>
              <Select value={documentType} onValueChange={setDocumentType} disabled={!canUpload}>
                <SelectTrigger><SelectValue placeholder="Choisir le type" /></SelectTrigger>
                <SelectContent>
                  {documentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                      {customTypeIds.has(t.id) ? ' (organisation)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType?.hint && (
                <p className="text-xs text-muted-foreground">{selectedType.hint}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Projet *</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!canUpload}>
                <SelectTrigger><SelectValue placeholder="Choisir le projet" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label>
            <Button
              asChild
              disabled={loading || !canUpload || !projectId || !documentType}
              className="bg-[#2563EB] cursor-pointer"
            >
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
              disabled={loading || !canUpload || !projectId || !documentType}
            />
          </label>
        </CardContent>
      </Card>

      {(isDirector || documents.length > 3) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Rechercher
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label>Mot-clé</Label>
              <Input
                placeholder="Nom fichier, projet…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Projet</Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Tous les projets</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Tous les types</SelectItem>
                  {documentTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                      {customTypeIds.has(t.id) ? ' (organisation)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredDocuments.length > 0 ? (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <FileStack className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.project_name ?? '—'} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Badge className="bg-violet-500/10 text-violet-800 border-violet-200">
                  {doc.doc_type_label}
                </Badge>
                {doc.aiAdaptation && (
                  <Badge variant="outline" className="text-primary border-primary/30">
                    IA
                  </Badge>
                )}
                {doc.captureExtraction && (
                  <Badge variant="outline" className="text-emerald-800 border-emerald-300">
                    Structuré
                  </Badge>
                )}
              </div>
              {doc.aiAdaptation && (
                <DocumentAiGuidance adaptation={doc.aiAdaptation} compact />
              )}
              {doc.captureExtraction && (
                <CaptureExtractionView
                  extraction={doc.captureExtraction}
                  documentId={doc.id}
                  compact
                  projects={projects}
                  defaultProjectId={doc.project_id}
                  onReExtract={reRunCaptureExtraction}
                />
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground">
            Aucun document pour ces critères.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
