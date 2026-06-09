'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/dashboard/data-table';
import { importSchoolStudentsBatch } from '@/lib/actions/school';
import { previewStudentImportWithAi } from '@/lib/actions/school-student-import-ai';
import {
  MAX_STUDENT_IMPORT_ROWS,
  STUDENT_IMPORT_TEMPLATE_CSV,
  type StudentImportRow,
} from '@/lib/school/student-import';
import { previewImportMatricules } from '@/lib/actions/student-matricules';
import type { StudentMatriculeSettings } from '@/lib/school/student-matricules';
import { ArrowLeft, Download, FileSpreadsheet, Hash, Sparkles, Upload } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Props {
  classes: Array<{ id: string; name: string; capacity?: number }>;
  matriculeSettings: StudentMatriculeSettings;
}

export function ImportElevesClient({ classes, matriculeSettings }: Props) {
  const router = useRouter();
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<'enrolled' | 'pending'>('enrolled');
  const [rawRows, setRawRows] = useState<StudentImportRow[]>([]);
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [fileMatriculeLines, setFileMatriculeLines] = useState<Set<number>>(new Set());
  const [autoGenerate, setAutoGenerate] = useState(matriculeSettings.auto_generate_on_import);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [detectedClass, setDetectedClass] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [sendSmsToGuardians, setSendSmsToGuardians] = useState(false);

  const selectedClass = classes.find((c) => c.id === classId);

  useEffect(() => {
    if (!autoGenerate || !classId || !rawRows.length) {
      setRows(rawRows);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    previewImportMatricules(classId, rawRows).then((res) => {
      if (cancelled) return;
      setPreviewing(false);
      if (res.error) {
        setWarnings((w) => (w.includes(res.error!) ? w : [...w, res.error!]));
        setRows(rawRows);
        return;
      }
      setRows(res.rows);
    });
    return () => {
      cancelled = true;
    };
  }, [autoGenerate, classId, rawRows]);

  const previewRows = useMemo(
    () =>
      rows.slice(0, 15).map((r) => ({
        id: String(r.sourceLine),
        ligne: r.sourceLine,
        nom: r.full_name,
        matricule: r.matricule || (autoGenerate ? '…' : '—'),
        matricule_hint: fileMatriculeLines.has(r.sourceLine)
          ? 'fichier'
          : r.matricule && autoGenerate
            ? 'konadata'
            : '',
        email: r.email || '—',
        telephone: r.phone || '—',
      })),
    [rows, autoGenerate, fileMatriculeLines]
  );

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF', STUDENT_IMPORT_TEMPLATE_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-import-eleves.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setUsedAi(false);
    setDetectedClass(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await previewStudentImportWithAi(fd);
      if ('error' in res) {
        setRawRows([]);
        setRows([]);
        setFileMatriculeLines(new Set());
        setWarnings([res.error]);
        setFileName(file.name);
        return;
      }
      setFileName(res.fileName);
      setRawRows(res.rows);
      setFileMatriculeLines(
        new Set(res.rows.filter((r) => r.matricule?.trim()).map((r) => r.sourceLine))
      );
      setWarnings(res.warnings);
      setUsedAi(res.usedAi);
      setDetectedClass(res.detectedClassName ?? null);
      if (res.detectedClassName && !classId) {
        const match = classes.find((c) =>
          c.name.toLowerCase().includes(res.detectedClassName!.toLowerCase())
        );
        if (match) setClassId(match.id);
      }
      if (res.rows.length > MAX_STUDENT_IMPORT_ROWS) {
        setWarnings((w) => [
          ...w,
          `Seules les ${MAX_STUDENT_IMPORT_ROWS} premières lignes seront importées.`,
        ]);
      }
    } catch (err) {
      setRawRows([]);
      setRows([]);
      setFileMatriculeLines(new Set());
      setWarnings([err instanceof Error ? err.message : 'Erreur de lecture du fichier']);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }

  async function handleImport() {
    if (!classId) {
      setMsg('Choisissez la classe de destination.');
      return;
    }
    if (!rawRows.length) {
      setMsg('Chargez un fichier avec au moins un élève.');
      return;
    }
    setLoading(true);
    setMsg(null);
    const batch = rawRows.slice(0, MAX_STUDENT_IMPORT_ROWS).map((r) => ({
      ...r,
      matricule: fileMatriculeLines.has(r.sourceLine) ? r.matricule : undefined,
    }));
    const res = await importSchoolStudentsBatch(classId, batch, status, {
      autoGenerateMatricules: autoGenerate,
      sendSmsToGuardians,
    });
    setLoading(false);
    if ('error' in res) {
      setMsg(res.error);
      return;
    }
    const parts = [
      `${res.created} créé(s)`,
      res.updated ? `${res.updated} mis à jour` : null,
      res.matricules_assigned ? `${res.matricules_assigned} code(s) élève attribué(s)` : null,
      res.sms_sent ? `${res.sms_sent} SMS tuteur envoyé(s)` : null,
      res.skipped ? `${res.skipped} ignoré(s)` : null,
    ].filter(Boolean);
    setMsg(`Import terminé : ${parts.join(', ')}.`);
    setImportDone(true);
    if (res.errors.length) {
      setWarnings(
        res.errors.slice(0, 10).map((e) => `Ligne ${e.line} : ${e.message}`)
      );
    }
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {importDone && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prochaines étapes</CardTitle>
            <CardDescription>
              Votre liste est en place — enchaînez la mise en route pédagogique.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/etablissement/formations">Matières & enseignants</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/utilisateurs/assignations">Assigner les enseignants</Link>
            </Button>
            <Button size="sm" className="bg-[#2563EB]" asChild>
              <Link href="/etablissement/resultats">Saisir les notes</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/etablissement/etudiants">
            <ArrowLeft className="h-4 w-4" />
            Retour aux élèves
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="h-7 w-7 text-primary" />
          Importer des élèves par classe
        </h1>
        <p className="text-muted-foreground">
          CSV, Excel, PDF (y compris scans) et photos (JPG, PNG…) — KonaAI Vision lit les registres manuscrits ou scannés.
          {' '}
          <Link href="/parametres/modeles" className="text-primary underline">
            Modèles vierges optimisés manuscrit
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Classe et statut</CardTitle>
          <CardDescription>
            Tous les élèves du fichier seront rattachés à cette classe. Par défaut ils sont
            comptés comme <strong>inscrits</strong> (effectif + facturation plateforme).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Classe *</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.capacity ? ` (cap. ${c.capacity})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Statut après import</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'enrolled' | 'pending')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enrolled">Inscrit (recommandé)</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Codes élève KonaData</CardTitle>
          <CardDescription>
            La plupart des établissements n&apos;ont pas de matricule interne — seul le{' '}
            <strong>nom</strong> suffit. KonaData attribue un code unique par élève, stable pour
            les paiements et reçus.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
            <div>
              <p className="text-sm font-medium">Générer les codes manquants</p>
              <p className="text-xs text-muted-foreground">
                Format : {matriculeSettings.format === 'org_year_seq' ? 'établissement' : 'classe'}
                -année-numéro
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/parametres/codes-eleves">
              <Hash className="h-4 w-4" />
              Paramètres format
            </Link>
          </Button>
        </CardContent>
      </Card>

      {status === 'enrolled' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SMS aux tuteurs (optionnel)</CardTitle>
            <CardDescription>
              Colonnes <code className="text-xs">tuteur</code>, <code className="text-xs">telephone_tuteur</code>,{' '}
              <code className="text-xs">consentement_sms</code> — ou téléphone élève comme contact.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Switch checked={sendSmsToGuardians} onCheckedChange={setSendSmsToGuardians} />
            <p className="text-sm">Envoyer matricule + lien suivi-scolarite après import</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Fichier</CardTitle>
          <CardDescription>
            Première ligne = en-têtes. Colonnes :{' '}
            <code className="text-xs">nom</code> (obligatoire),{' '}
            <code className="text-xs">matricule</code> (optionnel),{' '}
            <code className="text-xs">email</code>, <code className="text-xs">telephone</code>,{' '}
            <code className="text-xs">tuteur</code>, <code className="text-xs">telephone_tuteur</code>.
            Scans et photos : KonaAI Vision.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            Modèle CSV
          </Button>
          <Label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-md bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#2563EB]/90">
              <Upload className="h-4 w-4" />
              {loading ? 'Analyse…' : 'Choisir fichier'}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.tiff,image/*,application/pdf"
              className="hidden"
              disabled={loading}
              onChange={onFileChange}
            />
          </Label>
          {fileName && (
            <span className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
              {fileName} — {rows.length} élève(s)
              {usedAi && (
                <span className="inline-flex items-center gap-1 text-violet-700 text-xs font-medium">
                  <Sparkles className="h-3 w-3" />
                  KonaAI Vision
                </span>
              )}
              {detectedClass && (
                <span className="text-xs">Classe détectée : {detectedClass}</span>
              )}
            </span>
          )}
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-1">
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <DataTable
          title={`Aperçu (${Math.min(15, rows.length)} / ${rows.length})${previewing ? ' — calcul des codes…' : ''}`}
          data={previewRows}
          columns={[
            { key: 'ligne', label: 'Ligne' },
            { key: 'nom', label: 'Nom' },
            {
              key: 'matricule',
              label: matriculeSettings.display_label,
              render: (row: { matricule: string; matricule_hint?: string }) => (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                  {row.matricule}
                  {row.matricule_hint === 'konadata' && (
                    <span className="inline-flex items-center gap-0.5 text-violet-700 font-sans font-medium">
                      <Sparkles className="h-3 w-3" />
                      KonaData
                    </span>
                  )}
                </span>
              ),
            },
            { key: 'email', label: 'Email' },
            { key: 'telephone', label: 'Téléphone' },
          ]}
        />
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <Button
          className="bg-[#2563EB]"
          disabled={loading || previewing || !rawRows.length || !classId}
          onClick={handleImport}
        >
          Importer dans {selectedClass?.name ?? 'la classe'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Code ou nom déjà connu → mise à jour sans changer l&apos;identifiant existant. Max{' '}
          {MAX_STUDENT_IMPORT_ROWS} lignes.
        </p>
      </div>

      {msg && <p className="text-sm font-medium">{msg}</p>}
    </div>
  );
}
