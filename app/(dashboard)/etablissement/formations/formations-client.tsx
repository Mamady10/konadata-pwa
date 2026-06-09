'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/dashboard/data-table';
import {
  backfillEducationLevelBands,
  createClass,
  createClassesFromPresets,
  createSubject,
  createSubjectsFromPresets,
  createTeacher,
  importClassesFromCsv,
  importClassesFromRows,
  setClassActive,
  setSubjectActive,
  updateClass,
  updateClassTuition,
  updateSubject,
} from '@/lib/actions/school';
import { personName, personEmail } from '@/lib/school/person-utils';
import {
  downloadClassImportTemplate,
  parseClassImportFile,
} from '@/lib/school/class-import-file';
import { PageLoadErrors } from '@/components/school/page-load-errors';
import { Plus, AlertCircle, Award, LayoutGrid, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { SchoolFinanceOverview } from '@/lib/actions/school';
import {
  EDUCATION_LEVEL_BANDS,
  educationLevelBandLabel,
  type EducationLevelBand,
} from '@/lib/school/grading-period-settings';
import {
  classPresetsForBand,
  subjectPresetsForBand,
  LEVEL_SUGGESTIONS,
  SUBJECT_NAME_SUGGESTIONS,
  periodTypeLabelForBand,
  resolveClassEducationBand,
  type EducationLevelBandFilter,
} from '@/lib/school/education-level-catalog';

interface Props {
  classes: Array<Record<string, unknown>>;
  subjects: Array<Record<string, unknown>>;
  teachers: Array<Record<string, unknown>>;
  canManageCatalog: boolean;
  isTeacher: boolean;
  hasAssignments: boolean;
  teachingPairs?: { className: string; subjectName: string }[];
  readOnlyOverview?: boolean;
  classOverview?: SchoolFinanceOverview | null;
  orgDefaultTuitionGnf?: number;
  academicYear?: string;
  loadErrors?: string[];
}

export function FormationsClient({
  classes,
  subjects,
  teachers,
  canManageCatalog,
  isTeacher,
  hasAssignments,
  teachingPairs = [],
  readOnlyOverview,
  classOverview,
  orgDefaultTuitionGnf = 1_500_000,
  academicYear,
  loadErrors = [],
}: Props) {
  const router = useRouter();
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);
  const [tab, setTab] = useState('classes');
  const [tuitionMsg, setTuitionMsg] = useState<string | null>(null);
  const [bandFilter, setBandFilter] = useState<EducationLevelBandFilter>('all');
  const [newClassBand, setNewClassBand] = useState<EducationLevelBand>('college');
  const [newClassLevel, setNewClassLevel] = useState('');
  const [newSubjectBand, setNewSubjectBand] = useState<EducationLevelBand>('college');
  const [presetBand, setPresetBand] = useState<EducationLevelBand>('college');
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const [subjectPresetBand, setSubjectPresetBand] = useState<EducationLevelBand>('college');
  const [selectedSubjectPresetIds, setSelectedSubjectPresetIds] = useState<Set<string>>(new Set());
  const [subjectPresetLoading, setSubjectPresetLoading] = useState(false);
  const [subjectPresetMsg, setSubjectPresetMsg] = useState<string | null>(null);
  const [importCsv, setImportCsv] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  const editingClass = useMemo(
    () => (editingClassId ? classes.find((c) => c.id === editingClassId) : null),
    [classes, editingClassId]
  );
  const editingSubject = useMemo(
    () => (editingSubjectId ? subjects.find((s) => s.id === editingSubjectId) : null),
    [subjects, editingSubjectId]
  );
  const [editClassBand, setEditClassBand] = useState<EducationLevelBand>('college');
  const [editSubjectBand, setEditSubjectBand] = useState<EducationLevelBand>('college');

  useEffect(() => {
    if (editingClass) {
      const band = resolveClassEducationBand(
        (editingClass.education_level_band as EducationLevelBand) || null,
        (editingClass.level as string) || null
      );
      setEditClassBand(band);
    }
  }, [editingClass]);

  useEffect(() => {
    if (editingSubject) {
      const band = (editingSubject.education_level_band as EducationLevelBand) || 'college';
      setEditSubjectBand(band);
    }
  }, [editingSubject]);

  const filteredClasses = useMemo(() => {
    if (bandFilter === 'all') return classes;
    return classes.filter((c) => {
      const band = resolveClassEducationBand(
        (c.education_level_band as EducationLevelBand) || null,
        (c.level as string) || null
      );
      return band === bandFilter;
    });
  }, [classes, bandFilter]);

  const filteredSubjects = useMemo(() => {
    if (bandFilter === 'all') return subjects;
    return subjects.filter((s) => {
      const band = (s.education_level_band as EducationLevelBand) || null;
      if (!band) return false;
      return band === bandFilter;
    });
  }, [subjects, bandFilter]);

  async function handleCreateClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await createClass(fd);
    if (res.error) setCatalogMsg(res.error);
    else {
      setCatalogMsg('Classe créée.');
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleCreateSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await createSubject(fd);
    if (res.error) setCatalogMsg(res.error);
    else {
      setCatalogMsg('Matière créée.');
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleCreateTeacher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await createTeacher(fd);
    if (res.error) setCatalogMsg(res.error);
    else {
      setCatalogMsg('Enseignant créé.');
      e.currentTarget.reset();
      router.refresh();
    }
  }

  useEffect(() => {
    if (bandFilter !== 'all') {
      setNewClassBand(bandFilter);
      setNewSubjectBand(bandFilter);
      setPresetBand(bandFilter);
      setSubjectPresetBand(bandFilter);
    }
  }, [bandFilter]);

  const subjectPresets = useMemo(() => subjectPresetsForBand(subjectPresetBand), [subjectPresetBand]);

  useEffect(() => {
    setSelectedSubjectPresetIds(new Set());
  }, [subjectPresetBand]);

  const existingClassNames = useMemo(() => {
    return new Set(
      classes
        .filter((c) => !academicYear || c.academic_year === academicYear)
        .map((c) => String(c.name).trim().toLowerCase())
    );
  }, [classes, academicYear]);

  const classPresets = useMemo(() => classPresetsForBand(presetBand), [presetBand]);

  useEffect(() => {
    setSelectedPresetIds(new Set());
  }, [presetBand]);

  function togglePreset(id: string, exists: boolean) {
    if (exists) return;
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllAvailablePresets() {
    const available = classPresets
      .filter((p) => !existingClassNames.has(p.name.trim().toLowerCase()))
      .map((p) => p.id);
    setSelectedPresetIds(new Set(available));
  }

  async function handleCreateSubjectPresets() {
    if (selectedSubjectPresetIds.size === 0) {
      setSubjectPresetMsg('Sélectionnez au moins une matière.');
      return;
    }
    setSubjectPresetLoading(true);
    setSubjectPresetMsg(null);
    const res = await createSubjectsFromPresets({
      educationLevelBand: subjectPresetBand,
      presetIds: [...selectedSubjectPresetIds],
    });
    setSubjectPresetLoading(false);
    if (res.error) setSubjectPresetMsg(res.error);
    else {
      setSubjectPresetMsg(res.message ?? `${res.created} matière(s) créée(s).`);
      setSelectedSubjectPresetIds(new Set());
      router.refresh();
    }
  }

  async function handleImportClasses() {
    if (!importCsv.trim()) {
      setImportMsg('Collez un CSV (nom;palier;niveau;filière) ou choisissez un fichier Excel.');
      return;
    }
    setImportMsg(null);
    setImportLoading(true);
    const res = await importClassesFromCsv(importCsv);
    setImportLoading(false);
    if (res.error) setImportMsg(res.error);
    else {
      setImportMsg(res.message ?? 'Import terminé.');
      setImportCsv('');
      router.refresh();
    }
  }

  async function handleImportClassFile(file: File) {
    setImportMsg(null);
    setImportFileName(file.name);
    setImportLoading(true);
    const parsed = await parseClassImportFile(file);
    const parseIssues = [...parsed.errors, ...parsed.warnings];
    if (!parsed.rows.length) {
      setImportLoading(false);
      setImportMsg(parseIssues.join(' · ') || 'Aucune classe valide dans le fichier.');
      return;
    }
    const res = await importClassesFromRows(parsed.rows, parseIssues);
    setImportLoading(false);
    if (res.error) setImportMsg(res.error);
    else {
      setImportMsg(res.message ?? 'Import terminé.');
      setImportFileName(null);
      router.refresh();
    }
  }

  async function handleCreatePresets() {
    if (selectedPresetIds.size === 0) {
      setPresetMsg('Sélectionnez au moins un modèle.');
      return;
    }
    setPresetLoading(true);
    setPresetMsg(null);
    const res = await createClassesFromPresets({
      educationLevelBand: presetBand,
      presetIds: [...selectedPresetIds],
    });
    setPresetLoading(false);
    if (res.error) setPresetMsg(res.error);
    else {
      setPresetMsg(res.message ?? `${res.created} classe(s) créée(s).`);
      setSelectedPresetIds(new Set());
      router.refresh();
    }
  }

  const bandFilterButtons = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={bandFilter === 'all' ? 'default' : 'outline'}
        onClick={() => setBandFilter('all')}
      >
        Tous les paliers
      </Button>
      {EDUCATION_LEVEL_BANDS.map((band) => (
        <Button
          key={band.id}
          type="button"
          size="sm"
          variant={bandFilter === band.id ? 'default' : 'outline'}
          onClick={() => setBandFilter(band.id)}
        >
          {band.label}
        </Button>
      ))}
    </div>
  );

  if (readOnlyOverview && classOverview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Classes & effectifs</h1>
          <p className="text-muted-foreground">
            Vue synthétique pour le suivi financier (lecture seule)
            {academicYear ? ` — année ${academicYear}` : ''}
          </p>
        </div>
        <DataTable
          title="Répartition par classe"
          data={classOverview.rows.map((r) => ({
            id: r.classId,
            classe: r.className,
            niveau: r.level || '—',
            inscrits: r.enrolledCount,
            candidatures: r.pendingCandidates,
            capacite: r.capacity,
            frais: r.tuitionFeeGnf,
            attendu: r.expectedAmount,
          }))}
          columns={[
            { key: 'classe', label: 'Classe' },
            { key: 'niveau', label: 'Niveau' },
            { key: 'inscrits', label: 'Inscrits' },
            { key: 'candidatures', label: 'Candidatures en attente' },
            { key: 'capacite', label: 'Capacité' },
            {
              key: 'frais',
              label: 'Frais / élève',
              render: (i) => formatCurrency(i.frais as number),
            },
            {
              key: 'attendu',
              label: 'Recettes attendues',
              render: (i) => formatCurrency(i.attendu as number),
            },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Frais par défaut organisation : {formatCurrency(orgDefaultTuitionGnf)}
        </p>
      </div>
    );
  }

  if (isTeacher && !canManageCatalog) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mes classes assignées</h1>
          <p className="text-muted-foreground">
            Consultez vos classes et saisissez les notes depuis Résultats.
          </p>
        </div>

        {!hasAssignments && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Aucune classe ne vous est encore assignée. Demandez au directeur de configurer vos
            assignations dans Utilisateurs.
          </div>
        )}

        {hasAssignments && (
          <>
            <DataTable
              title="Mes cours (classe × matière)"
              data={teachingPairs.map((p, i) => ({
                id: String(i),
                classe: p.className,
                matiere: p.subjectName,
              }))}
              columns={[
                { key: 'classe', label: 'Classe' },
                { key: 'matiere', label: 'Matière' },
              ]}
            />
            <Button asChild className="bg-[#2563EB]">
              <Link href="/etablissement/resultats">
                <Award className="h-4 w-4 mr-2" />
                Saisir les notes
              </Link>
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageLoadErrors errors={loadErrors} />
      {catalogMsg && <p className="text-sm text-muted-foreground">{catalogMsg}</p>}
      <div>
        <h1 className="text-2xl font-bold">Classes, Matières & Enseignants</h1>
        <p className="text-muted-foreground">
          Organisez le catalogue par palier (primaire, collège, lycée, université) pour aligner
          automatiquement les périodes de notation
          {academicYear ? ` — classes ${academicYear}` : ''}
        </p>
      </div>

      {canManageCatalog && bandFilterButtons}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="classes">Classes ({filteredClasses.length})</TabsTrigger>
          {canManageCatalog && (
            <>
              <TabsTrigger value="subjects">Matières ({filteredSubjects.length})</TabsTrigger>
              <TabsTrigger value="teachers">Enseignants ({teachers.length})</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="classes" className="mt-6 space-y-4">
          {canManageCatalog && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                  Ajout rapide — modèles de classes
                </CardTitle>
                <CardDescription>
                  Créez en une fois les classes courantes du palier{' '}
                  <strong>{educationLevelBandLabel(presetBand)}</strong> ({periodTypeLabelForBand(presetBand)}
                  ). Les classes déjà présentes pour {academicYear ?? "l'année en cours"} sont ignorées.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bandFilter === 'all' && (
                  <div className="space-y-2 max-w-sm">
                    <Label>Palier des modèles</Label>
                    <Select
                      value={presetBand}
                      onValueChange={(v) => setPresetBand(v as EducationLevelBand)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDUCATION_LEVEL_BANDS.map((band) => (
                          <SelectItem key={band.id} value={band.id}>
                            {band.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {classPresets.map((preset) => {
                    const exists = existingClassNames.has(preset.name.trim().toLowerCase());
                    const checked = selectedPresetIds.has(preset.id);
                    return (
                      <label
                        key={preset.id}
                        className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                          exists
                            ? 'opacity-60 cursor-not-allowed bg-muted/30'
                            : 'cursor-pointer hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                          checked={exists || checked}
                          disabled={exists || presetLoading}
                          onChange={() => togglePreset(preset.id, exists)}
                        />
                        <span className="min-w-0">
                          <span className="font-medium block">{preset.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {preset.level}
                            {preset.program ? ` · ${preset.program}` : ''}
                          </span>
                          {exists && (
                            <Badge variant="secondary" className="mt-1 text-[10px]">
                              Déjà créée
                            </Badge>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllAvailablePresets}
                    disabled={presetLoading}
                  >
                    Tout sélectionner (disponibles)
                  </Button>
                  <Button
                    type="button"
                    className="bg-[#2563EB]"
                    size="sm"
                    onClick={() => void handleCreatePresets()}
                    disabled={presetLoading || selectedPresetIds.size === 0}
                  >
                    <Plus className="h-4 w-4" />
                    {presetLoading
                      ? 'Création…'
                      : `Créer ${selectedPresetIds.size} classe(s)`}
                  </Button>
                </div>
                {presetMsg && <p className="text-sm text-muted-foreground">{presetMsg}</p>}
              </CardContent>
            </Card>
          )}
          {canManageCatalog && (
            <Card>
              <CardHeader>
                <CardTitle>Ajouter une classe</CardTitle>
                <CardDescription>
                  Le palier détermine les périodes de notation ({periodTypeLabelForBand(newClassBand)}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => void handleCreateClass(e)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <input type="hidden" name="education_level_band" value={newClassBand} />
                  <div className="space-y-2 lg:col-span-3">
                    <Label>Palier *</Label>
                    <Select
                      value={newClassBand}
                      onValueChange={(v) => {
                        setNewClassBand(v as EducationLevelBand);
                        setNewClassLevel('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDUCATION_LEVEL_BANDS.map((band) => (
                          <SelectItem key={band.id} value={band.id}>
                            {band.label} — {periodTypeLabelForBand(band.id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Nom *</Label><Input name="name" required placeholder="3ème A" /></div>
                  <div className="space-y-2">
                    <Label>Niveau (détail)</Label>
                    <Select
                      value={newClassLevel || '__custom__'}
                      onValueChange={(v) => setNewClassLevel(v === '__custom__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir ou saisir ci-dessous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom__">Saisie libre</SelectItem>
                        {LEVEL_SUGGESTIONS[newClassBand].map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>
                            {lvl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      name="level"
                      value={newClassLevel}
                      onChange={(e) => setNewClassLevel(e.target.value)}
                      placeholder={LEVEL_SUGGESTIONS[newClassBand][0]}
                    />
                  </div>
                  <div className="space-y-2"><Label>Département</Label><Input name="department" placeholder="Sciences" /></div>
                  <div className="space-y-2"><Label>Filière</Label><Input name="program" placeholder="Général" /></div>
                  <div className="space-y-2"><Label>Capacité</Label><Input name="capacity" type="number" defaultValue="40" /></div>
                  <div className="space-y-2">
                    <Label>Frais scolarité (GNF)</Label>
                    <Input
                      name="tuition_fee_gnf"
                      type="number"
                      min={0}
                      placeholder={`Défaut : ${orgDefaultTuitionGnf}`}
                    />
                  </div>
                  <Button type="submit" className="bg-[#2563EB] lg:col-span-3"><Plus className="h-4 w-4" /> Créer</Button>
                </form>
                {tuitionMsg && <p className="text-sm text-muted-foreground">{tuitionMsg}</p>}
              </CardContent>
            </Card>
          )}
          {canManageCatalog && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Import Excel / CSV — classes
                </CardTitle>
                <CardDescription>
                  Colonnes : nom, palier, niveau, filière, département, capacité. Palier : primaire, college,
                  lycee, universite.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadClassImportTemplate('xlsx')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Modèle Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadClassImportTemplate('csv')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Modèle CSV
                  </Button>
                  <label>
                    <Button type="button" variant="outline" size="sm" asChild disabled={importLoading}>
                      <span>
                        <Upload className="h-4 w-4 mr-1" />
                        Choisir fichier
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      disabled={importLoading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImportClassFile(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {importFileName && (
                  <p className="text-sm text-muted-foreground">
                    Fichier : <strong>{importFileName}</strong>
                    {importLoading ? ' — import en cours…' : ''}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Ou collez un CSV ci-dessous :</p>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={importCsv}
                  onChange={(e) => setImportCsv(e.target.value)}
                  placeholder={'nom;palier;niveau;filière;département;capacité'}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-[#2563EB]"
                    size="sm"
                    disabled={importLoading}
                    onClick={() => void handleImportClasses()}
                  >
                    {importLoading ? 'Import…' : 'Importer le CSV collé'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importLoading}
                    onClick={() =>
                      void backfillEducationLevelBands().then((r) =>
                        setImportMsg(r.message ?? r.error ?? 'Terminé')
                      )
                    }
                  >
                    Rétro-remplir paliers
                  </Button>
                </div>
                {importMsg && <p className="text-sm text-muted-foreground">{importMsg}</p>}
              </CardContent>
            </Card>
          )}
          {canManageCatalog && editingClass && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle>Modifier la classe</CardTitle>
                <CardDescription>{String(editingClass.name)}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set('education_level_band', editClassBand);
                    const res = await updateClass(editingClassId!, fd);
                    setEditMsg(res.error ?? 'Classe mise à jour');
                    if (!res.error) {
                      setEditingClassId(null);
                      router.refresh();
                    }
                  }}
                >
                  <div className="space-y-2 lg:col-span-3">
                    <Label>Palier *</Label>
                    <Select value={editClassBand} onValueChange={(v) => setEditClassBand(v as EducationLevelBand)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EDUCATION_LEVEL_BANDS.map((band) => (
                          <SelectItem key={band.id} value={band.id}>{band.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input name="name" required defaultValue={String(editingClass.name)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Niveau</Label>
                    <Input name="level" defaultValue={String(editingClass.level ?? '')} list={`edit-level-${editClassBand}`} />
                    <datalist id={`edit-level-${editClassBand}`}>
                      {LEVEL_SUGGESTIONS[editClassBand].map((lvl) => (
                        <option key={lvl} value={lvl} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>Capacité</Label>
                    <Input name="capacity" type="number" defaultValue={String(editingClass.capacity ?? 40)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Département</Label>
                    <Input name="department" defaultValue={String(editingClass.department ?? '')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Filière</Label>
                    <Input name="program" defaultValue={String(editingClass.program ?? '')} />
                  </div>
                  <div className="flex flex-wrap gap-2 lg:col-span-3">
                    <Button type="submit" size="sm" className="bg-[#2563EB]">Enregistrer</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingClassId(null)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
          {editMsg && tab === 'classes' && (
            <p className="text-sm text-muted-foreground">{editMsg}</p>
          )}
          <DataTable title="Classes" data={filteredClasses.map((c) => {
            const fee = c.tuition_fee_gnf != null ? Number(c.tuition_fee_gnf) : orgDefaultTuitionGnf;
            const band = resolveClassEducationBand(
              (c.education_level_band as EducationLevelBand) || null,
              (c.level as string) || null
            );
            return {
              id: c.id,
              name: c.name,
              palier: educationLevelBandLabel(band),
              periodes: periodTypeLabelForBand(band),
              level: c.level || '—',
              department: (c.department as string) || '—',
              program: (c.program as string) || '—',
              annee: c.academic_year,
              capacite: c.capacity,
              frais: fee,
              fraisLabel: formatCurrency(fee),
            };
          })} columns={[
            { key: 'name', label: 'Classe' },
            { key: 'palier', label: 'Palier' },
            { key: 'periodes', label: 'Périodes' },
            { key: 'level', label: 'Niveau' },
            { key: 'department', label: 'Département' },
            { key: 'program', label: 'Filière' },
            { key: 'annee', label: 'Année' },
            { key: 'capacite', label: 'Capacité' },
            { key: 'fraisLabel', label: 'Frais / élève' },
            {
              key: 'edit',
              label: 'Modifier',
              render: (item) => (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditMsg(null);
                    setEditingClassId(item.id as string);
                  }}
                >
                  Modifier
                </Button>
              ),
            },
            {
              key: 'archive',
              label: 'Archiver',
              render: (item) => (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void setClassActive(item.id as string, false).then((r) => {
                      setCatalogMsg(r.error ?? 'Classe archivée');
                      if (!r.error) router.refresh();
                    })
                  }
                >
                  Archiver
                </Button>
              ),
            },
            {
              key: 'frais_edit',
              label: 'Modifier frais',
              render: (item) => (
                <form
                  className="flex gap-1 items-center"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const val = Number(fd.get('fee'));
                    const res = await updateClassTuition(item.id as string, val);
                    setTuitionMsg(res.error ?? 'Frais mis à jour');
                  }}
                >
                  <Input name="fee" type="number" className="h-8 w-28" defaultValue={item.frais as number} />
                  <Button type="submit" size="sm" variant="outline">OK</Button>
                </form>
              ),
            },
          ]} />
        </TabsContent>

        {canManageCatalog && (
          <>
            <TabsContent value="subjects" className="mt-6 space-y-4">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    Ajout rapide — matières par palier
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bandFilter === 'all' && (
                    <Select value={subjectPresetBand} onValueChange={(v) => setSubjectPresetBand(v as EducationLevelBand)}>
                      <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EDUCATION_LEVEL_BANDS.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {subjectPresets.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={selectedSubjectPresetIds.has(p.id)}
                          onChange={() => {
                            setSelectedSubjectPresetIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                        />
                        <span>{p.name}{p.code ? ` (${p.code})` : ''}</span>
                      </label>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#2563EB]"
                    disabled={subjectPresetLoading || selectedSubjectPresetIds.size === 0}
                    onClick={() => void handleCreateSubjectPresets()}
                  >
                    Créer {selectedSubjectPresetIds.size} matière(s)
                  </Button>
                  {subjectPresetMsg && <p className="text-sm text-muted-foreground">{subjectPresetMsg}</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ajouter une matière</CardTitle>
                  <CardDescription>
                    Associez chaque matière à un palier pour la saisie des notes et les bulletins.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => void handleCreateSubject(e)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="education_level_band" value={newSubjectBand} />
                    <div className="space-y-2 lg:col-span-4">
                      <Label>Palier *</Label>
                      <Select
                        value={newSubjectBand}
                        onValueChange={(v) => setNewSubjectBand(v as EducationLevelBand)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDUCATION_LEVEL_BANDS.map((band) => (
                            <SelectItem key={band.id} value={band.id}>
                              {band.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <Input
                        name="name"
                        required
                        list={`subject-suggestions-${newSubjectBand}`}
                        placeholder={SUBJECT_NAME_SUGGESTIONS[newSubjectBand][0]}
                      />
                      <datalist id={`subject-suggestions-${newSubjectBand}`}>
                        {SUBJECT_NAME_SUGGESTIONS[newSubjectBand].map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-2"><Label>Code</Label><Input name="code" placeholder="MATH" /></div>
                    <div className="space-y-2"><Label>Coefficient</Label><Input name="coefficient" type="number" defaultValue="1" step="0.5" /></div>
                    <div className="flex items-end lg:col-span-4">
                      <Badge variant="secondary">{periodTypeLabelForBand(newSubjectBand)}</Badge>
                    </div>
                    <Button type="submit" className="bg-[#2563EB] lg:col-span-4"><Plus className="h-4 w-4" /> Créer</Button>
                  </form>
                </CardContent>
              </Card>
              {editingSubject && (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle>Modifier la matière</CardTitle>
                    <CardDescription>{String(editingSubject.name)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        fd.set('education_level_band', editSubjectBand);
                        const res = await updateSubject(editingSubjectId!, fd);
                        setEditMsg(res.error ?? 'Matière mise à jour');
                        if (!res.error) {
                          setEditingSubjectId(null);
                          router.refresh();
                        }
                      }}
                    >
                      <div className="space-y-2 lg:col-span-4">
                        <Label>Palier *</Label>
                        <Select
                          value={editSubjectBand}
                          onValueChange={(v) => setEditSubjectBand(v as EducationLevelBand)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EDUCATION_LEVEL_BANDS.map((band) => (
                              <SelectItem key={band.id} value={band.id}>{band.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nom *</Label>
                        <Input name="name" required defaultValue={String(editingSubject.name)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input name="code" defaultValue={String(editingSubject.code ?? '')} />
                      </div>
                      <div className="space-y-2">
                        <Label>Coefficient</Label>
                        <Input
                          name="coefficient"
                          type="number"
                          step="0.5"
                          defaultValue={String(editingSubject.coefficient ?? 1)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 lg:col-span-4">
                        <Button type="submit" size="sm" className="bg-[#2563EB]">Enregistrer</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingSubjectId(null)}>
                          Annuler
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
              {editMsg && tab === 'subjects' && (
                <p className="text-sm text-muted-foreground">{editMsg}</p>
              )}
              <DataTable title="Matières" data={filteredSubjects.map((s) => {
                const band = (s.education_level_band as EducationLevelBand) || null;
                return {
                  id: s.id,
                  name: s.name,
                  palier: band ? educationLevelBandLabel(band) : '—',
                  code: s.code || '—',
                  coef: s.coefficient,
                };
              })} columns={[
                { key: 'name', label: 'Matière' },
                { key: 'palier', label: 'Palier' },
                { key: 'code', label: 'Code' },
                { key: 'coef', label: 'Coef.' },
                {
                  key: 'edit',
                  label: 'Modifier',
                  render: (item) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditMsg(null);
                        setEditingSubjectId(item.id as string);
                      }}
                    >
                      Modifier
                    </Button>
                  ),
                },
                {
                  key: 'archive',
                  label: 'Archiver',
                  render: (item) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void setSubjectActive(item.id as string, false).then((r) => {
                          setCatalogMsg(r.error ?? 'Matière archivée');
                          if (!r.error) router.refresh();
                        })
                      }
                    >
                      Archiver
                    </Button>
                  ),
                },
              ]} />
            </TabsContent>

            <TabsContent value="teachers" className="mt-6 space-y-4">
              <Card>
                <CardHeader><CardTitle>Ajouter un enseignant</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={(e) => void handleCreateTeacher(e)} className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Nom *</Label><Input name="full_name" required /></div>
                    <div className="space-y-2"><Label>Spécialité</Label><Input name="specialty" /></div>
                    <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" /></div>
                    <div className="space-y-2"><Label>Téléphone</Label><Input name="phone" /></div>
                    <Button type="submit" className="bg-[#2563EB] sm:col-span-2"><Plus className="h-4 w-4" /> Créer</Button>
                  </form>
                </CardContent>
              </Card>
              <DataTable title="Enseignants" data={teachers.map((t) => ({
                id: t.id, name: personName(t), specialty: t.specialty || '—', email: personEmail(t),
              }))} columns={[
                { key: 'name', label: 'Nom' }, { key: 'specialty', label: 'Spécialité' }, { key: 'email', label: 'Email' },
              ]} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
