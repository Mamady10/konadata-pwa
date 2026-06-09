'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Image,
  File,
  Sparkles,
  CheckCircle,
  Loader2,
  AlertCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { uploadDocument } from '@/lib/actions/storage';
import { searchOrgDocuments, reindexDocument } from '@/lib/actions/document-search';
import { DocumentFileActions } from '@/components/documents/document-file-actions';
import { extractRosterFromStoredDocument } from '@/lib/actions/ai-document-extract';
import type { DocumentSearchHit } from '@/lib/actions/document-search';

const acceptedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png', '.tiff'];

const CATEGORY_LABELS: Record<string, string> = {
  school_report: 'Établissement',
  ngo_report: 'ONG',
  invoice: 'Finance',
  delivery_note: 'BTP',
  cv: 'RH',
  questionnaire: 'ONG',
  other: 'Général',
};

const METHOD_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  xlsx: 'Excel',
  csv: 'CSV',
  vision: 'OCR IA',
  plain: 'Texte',
};

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'tiff', 'gif'].includes(ext || '')) return Image;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return FileSpreadsheet;
  if (['pdf', 'doc', 'docx'].includes(ext || '')) return FileText;
  return File;
}

export interface DocRow {
  id: string;
  file_name: string;
  file_size: number | null;
  category: string | null;
  status: string;
  created_at: string;
  extraction_status: string | null;
  extraction_method: string | null;
  extraction_message: string | null;
  char_count: number | null;
  has_search_text: boolean;
}

interface UploadItem {
  id: string;
  name: string;
  size: string;
  status: 'processing' | 'completed' | 'error';
  category?: string;
  indexNote?: string;
  error?: string;
}

interface Props {
  initialDocuments: DocRow[];
  indexedCount: number;
  totalCount: number;
}

function indexBadge(doc: DocRow) {
  if (doc.has_search_text) {
    const method = doc.extraction_method
      ? METHOD_LABELS[doc.extraction_method] ?? doc.extraction_method
      : 'Indexé';
    return (
      <Badge variant="success" className="text-[10px]">
        {method} · {(doc.char_count ?? 0).toLocaleString('fr-FR')} car.
      </Badge>
    );
  }
  if (doc.extraction_status === 'failed' || doc.status === 'error') {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Non indexé
      </Badge>
    );
  }
  if (doc.extraction_message) {
    return (
      <Badge variant="outline" className="text-[10px] max-w-[140px] truncate" title={doc.extraction_message}>
        {doc.extraction_message}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      En attente
    </Badge>
  );
}

export function DataFactoryClient({
  initialDocuments,
  indexedCount,
  totalCount,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>(initialDocuments);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<DocumentSearchHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [rosterPreview, setRosterPreview] = useState<{
    docName: string;
    count: number;
    className?: string | null;
    sample: string[];
  } | null>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    for (const [index, file] of Array.from(files).entries()) {
      const tempId = `${Date.now()}-${index}`;
      setUploads((prev) => [
        {
          id: tempId,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          status: 'processing',
        },
        ...prev,
      ]);

      const fd = new FormData();
      fd.set('file', file);
      const result = await uploadDocument(fd);

      if (result.error) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId ? { ...u, status: 'error', error: result.error } : u
          )
        );
      } else if (result.data) {
        const doc = result.data as {
          id: string;
          file_name: string;
          file_size: number | null;
          category: string | null;
          status: string;
          created_at: string;
        };
        const indexing = result.indexing as { charCount?: number; message?: string } | undefined;
        const row: DocRow = {
          id: doc.id,
          file_name: doc.file_name,
          file_size: doc.file_size,
          category: doc.category,
          status: doc.status,
          created_at: doc.created_at,
          extraction_status: indexing && (indexing.charCount ?? 0) > 20 ? 'ok' : 'partial',
          extraction_method: null,
          extraction_message: indexing?.message ?? null,
          char_count: indexing?.charCount ?? null,
          has_search_text: (indexing?.charCount ?? 0) > 20,
        };
        setDocuments((prev) => [row, ...prev]);
        const indexNote =
          (indexing?.charCount ?? 0) > 20
            ? `Indexé (${indexing?.charCount?.toLocaleString('fr-FR')} car.)`
            : indexing?.message ?? 'Stocké sans texte';
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId
              ? {
                  ...u,
                  status: 'completed',
                  category: CATEGORY_LABELS[doc.category ?? 'other'] ?? 'Général',
                  indexNote,
                }
              : u
          )
        );
      }
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  async function handleSearch() {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError('Au moins 2 caractères.');
      setSearchHits(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const res = await searchOrgDocuments(q);
    setSearching(false);
    if ('error' in res) {
      setSearchError(res.error);
      setSearchHits(null);
    } else {
      setSearchHits(res);
    }
  }

  async function handleExtractRoster(docId: string, docName: string) {
    setExtractingId(docId);
    setSearchError(null);
    const res = await extractRosterFromStoredDocument(docId);
    setExtractingId(null);
    if ('error' in res) {
      setSearchError(res.error);
      setRosterPreview(null);
      return;
    }
    const rows = res.roster?.rows ?? [];
    setRosterPreview({
      docName,
      count: rows.length,
      className: res.roster?.detectedClassName,
      sample: rows.slice(0, 8).map((r) => r.full_name),
    });
  }

  async function handleReindex(docId: string) {
    setReindexingId(docId);
    const res = await reindexDocument(docId);
    setReindexingId(null);
    if ('error' in res) {
      setSearchError(res.error);
      return;
    }
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              has_search_text: res.charCount > 20,
              char_count: res.charCount,
              extraction_status: res.ok ? 'ok' : 'partial',
              extraction_message: res.message ?? null,
              status: res.ok ? 'archived' : d.status,
            }
          : d
      )
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Data Factory</h1>
          <Badge variant="success">Supabase Storage</Badge>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {indexedCount}/{totalCount} indexés pour KonaAI
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          PDF (y compris scans), Word, Excel et photos : OCR KonaAI Vision à l&apos;upload.
          Bouton « Extraire liste » pour structurer élèves, bénéficiaires ou personnel selon votre secteur.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Rechercher dans vos documents indexés…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching} className="shrink-0">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Rechercher
          </Button>
        </CardContent>
      </Card>

      {searchError && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" /> {searchError}
        </p>
      )}

      {rosterPreview && (
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="p-4 text-sm space-y-2">
            <p className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Liste extraite — {rosterPreview.docName}
            </p>
            <p>
              {rosterPreview.count} personne(s) détectée(s)
              {rosterPreview.className ? ` · ${rosterPreview.className}` : ''}
            </p>
            {rosterPreview.sample.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Ex. : {rosterPreview.sample.join(', ')}
                {rosterPreview.count > rosterPreview.sample.length ? '…' : ''}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Établissement : importez via Étudiants → Importer. ONG/BTP : utilisez ces noms dans vos modules métier.
            </p>
          </CardContent>
        </Card>
      )}

      {searchHits && searchHits.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Résultats ({searchHits.length})</h3>
          {searchHits.map((h) => (
            <Card key={h.documentId} className="p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-sm">{h.fileName}</p>
                <DocumentFileActions documentId={h.documentId} fileName={h.fileName} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">{h.snippet}</p>
            </Card>
          ))}
        </div>
      )}

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={{ scale: isDragging ? 1.02 : 1 }}
      >
        <Card
          className={`border-2 border-dashed transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 px-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-6">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Glissez-déposez vos documents</h3>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
              Le texte est extrait automatiquement pour alimenter KonaAI (recherche + chat).
            </p>
            <label>
              <Button asChild className="bg-[#2563EB] hover:bg-[#2563EB]/90 cursor-pointer">
                <span>
                  <Upload className="h-4 w-4" /> Parcourir les fichiers
                </span>
              </Button>
              <input
                type="file"
                multiple
                accept={acceptedTypes.join(',')}
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
            </label>
          </CardContent>
        </Card>
      </motion.div>

      {uploads.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Uploads récents</h3>
          {uploads.map((doc) => {
            const Icon = getFileIcon(doc.name);
            return (
              <Card key={doc.id} className="p-4">
                <div className="flex items-center gap-4">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.size}
                      {doc.indexNote ? ` · ${doc.indexNote}` : ''}
                    </p>
                  </div>
                  {doc.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {doc.status === 'completed' && (
                    <>
                      <Badge variant="success">{doc.category}</Badge>
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </>
                  )}
                  {doc.status === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-4 w-4" /> {doc.error}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Documents ({documents.length})</h3>
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.file_name);
            return (
              <Card key={doc.id} className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '—'} ·{' '}
                      {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {indexBadge(doc)}
                  <Badge variant="secondary">
                    {CATEGORY_LABELS[doc.category ?? 'other'] ?? doc.category}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={extractingId === doc.id}
                    onClick={() => handleExtractRoster(doc.id, doc.file_name)}
                  >
                    {extractingId === doc.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Extraire liste
                  </Button>
                  {!doc.has_search_text && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={reindexingId === doc.id}
                      onClick={() => handleReindex(doc.id)}
                    >
                      {reindexingId === doc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Réindexer
                    </Button>
                  )}
                  <DocumentFileActions documentId={doc.id} fileName={doc.file_name} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
