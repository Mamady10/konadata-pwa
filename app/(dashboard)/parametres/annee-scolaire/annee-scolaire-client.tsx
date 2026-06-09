'use client';



import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';

import { Badge } from '@/components/ui/badge';

import { Switch } from '@/components/ui/switch';

import {

  ArrowLeft,

  CalendarRange,

  CheckCircle2,

  Download,

  Lock,

  PlayCircle,

  AlertTriangle,

  KeyRound,

} from 'lucide-react';

import {

  concludeAcademicYear,

  startNewAcademicYear,

  downloadAcademicYearArchive,

  downloadReenrollmentCodesCsv,

  type AcademicYearOverview,

} from '@/lib/actions/academic-year';

import { nextAcademicYearLabel } from '@/lib/school/school-org-settings';

import { AnneeScolaireFees } from './annee-scolaire-fees';

import type { AcademicYearFeeSetup } from '@/lib/actions/academic-year-fees';



interface Props {

  overview: AcademicYearOverview | null;

  loadError?: string;

  canManage: boolean;

  orgName: string;

  feeSetup?: AcademicYearFeeSetup | null;

  feeLoadError?: string;

  feePrepNextYear?: boolean;

}



function formatDate(iso: string) {

  try {

    return new Date(iso).toLocaleDateString('fr-FR', {

      day: 'numeric',

      month: 'long',

      year: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

    });

  } catch {

    return iso;

  }

}



function triggerDownload(fileName: string, content: string, contentType: string) {

  const prefix = contentType.includes('json') ? '' : '\ufeff';

  const blob = new Blob([prefix + content], { type: `${contentType};charset=utf-8` });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = fileName;

  a.click();

  URL.revokeObjectURL(url);

}



export function AnneeScolaireClient({
  overview,
  loadError,
  canManage,
  orgName,
  feeSetup,
  feeLoadError,
  feePrepNextYear,
}: Props) {

  const router = useRouter();

  const [msg, setMsg] = useState<string | null>(loadError ?? null);

  const [loading, setLoading] = useState<'conclude' | 'start' | 'archive' | 'codes' | null>(null);

  const [newYear, setNewYear] = useState(overview?.suggestedNextYear ?? '');

  const [duplicateClasses, setDuplicateClasses] = useState(true);

  const [generateCodes, setGenerateCodes] = useState(true);

  const [localOverview, setLocalOverview] = useState(overview);

  useEffect(() => {
    if (overview) setLocalOverview(overview);
  }, [overview]);

  async function handleConclude() {

    if (!localOverview || !canManage) return;

    const confirmMsg = [

      `Clôturer l'année scolaire ${localOverview.currentYear} ?`,

      '',

      '• Les classes restent actives et consultables',

      '• Un export classé sera enregistré (scolarité, finances, bulletins, notes, classes)',

      '• Vous pourrez télécharger ces archives à tout moment',

      '',

      'Cette action est irréversible.',

    ].join('\n');

    if (!window.confirm(confirmMsg)) return;



    setLoading('conclude');

    setMsg(null);

    const res = await concludeAcademicYear();

    setLoading(null);

    if ('error' in res && res.error) {

      setMsg(res.error);

      return;

    }

    if ('success' in res && res.success) {

      const next = localOverview.suggestedNextYear ?? '';

      if (next) setNewYear(next);

      setMsg(

        `Année ${res.year} clôturée. ${res.archivesCount} export(s) enregistré(s). Ouvrez la nouvelle année pour activer les réinscriptions.`

      );

      setLocalOverview((prev) => (prev ? { ...prev, isCurrentYearConcluded: true } : prev));

      router.refresh();

    }

  }



  async function handleStart() {

    if (!localOverview || !canManage) return;

    const year = newYear.trim();

    if (!year) {

      setMsg('Indiquez la nouvelle année scolaire.');

      return;

    }

    const confirmMsg = [

      `Ouvrir l'année scolaire ${year} ?`,

      duplicateClasses

        ? 'Les classes de l\'année précédente seront recréées pour la nouvelle année (sans élèves).'

        : 'Aucune classe ne sera créée automatiquement — vous pourrez en ajouter dans Formations.',

      generateCodes

        ? 'Des codes permanents seront créés (établissement + nom + chiffres) pour chaque élève inscrit.'

        : 'Aucun code de réinscription ne sera généré automatiquement.',

    ].join('\n');

    if (!window.confirm(confirmMsg)) return;



    setLoading('start');

    setMsg(null);

    const res = await startNewAcademicYear({

      newYear: year,

      duplicateClasses,

      generateReenrollmentCodes: generateCodes,

    });

    setLoading(null);

    if ('error' in res && res.error) {

      setMsg(res.error);

      return;

    }

    if ('success' in res && res.success) {

      const suggested = nextAcademicYearLabel(res.year);

      setLocalOverview({

        currentYear: res.year,

        isCurrentYearConcluded: false,

        suggestedNextYear: suggested,

        concludedYears: localOverview.concludedYears,

        stats: {

          activeClasses: res.classesCreated,

          enrolledStudents: 0,

          pendingEnrollments: 0,

        },

      });

      if (suggested) setNewYear(suggested);

      const parts = [`Année ${res.year} ouverte.`];

      if (res.classesCreated > 0) parts.push(`${res.classesCreated} classe(s) créée(s).`);

      if (res.reenrollmentCodesCreated > 0) {

        parts.push(

          `${res.reenrollmentCodesCreated} code(s) permanent(s) créé(s) — réutilisables chaque année.`

        );

      }

      setMsg(parts.join(' '));

      router.refresh();

    }

  }



  async function handleDownloadArchive(archiveId: string) {

    setLoading('archive');

    const res = await downloadAcademicYearArchive(archiveId);

    setLoading(null);

    if ('error' in res && res.error) {

      setMsg(res.error);

      return;

    }

    if ('fileName' in res) {

      triggerDownload(res.fileName, res.content, res.contentType);

    }

  }



  async function handleDownloadCodes(year: string) {

    setLoading('codes');

    const res = await downloadReenrollmentCodesCsv(year);

    setLoading(null);

    if ('error' in res && res.error) {

      setMsg(res.error);

      return;

    }

    if ('fileName' in res) {

      triggerDownload(res.fileName, res.content, 'text/csv');

    }

  }



  if (!localOverview) {

    return (

      <div className="space-y-6 max-w-3xl">

        <Button asChild variant="ghost" size="sm">

          <Link href="/parametres">

            <ArrowLeft className="h-4 w-4" />

            Paramètres

          </Link>

        </Button>

        <p className="text-destructive">{msg ?? 'Impossible de charger les années scolaires.'}</p>

      </div>

    );

  }



  const { currentYear, isCurrentYearConcluded, stats, concludedYears } = localOverview;



  return (

    <div className="space-y-6 max-w-3xl">

      <Button asChild variant="ghost" size="sm">

        <Link href="/parametres">

          <ArrowLeft className="h-4 w-4" />

          Paramètres

        </Link>

      </Button>



      <div>

        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">

          <CalendarRange className="h-6 w-6 text-indigo-600" />

          Année scolaire

        </h1>

        <p className="text-muted-foreground">

          Clôturer un cycle, archiver les données et préparer la suivante — {orgName}

        </p>

      </div>



      {msg && (

        <div

          className={`rounded-lg border p-3 text-sm ${

            msg.includes('clôturée') || msg.includes('ouverte') || msg.includes('enregistré')

              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900'

              : 'border-destructive/30 bg-destructive/5 text-destructive'

          }`}

        >

          {msg}

        </div>

      )}



      <Card>

        <CardHeader>

          <div className="flex items-start justify-between gap-3">

            <div>

              <CardTitle className="text-base">Année en cours</CardTitle>

              <CardDescription>Référence pour bulletins, candidatures et paiements</CardDescription>

            </div>

            <Badge variant={isCurrentYearConcluded ? 'secondary' : 'default'}>

              {isCurrentYearConcluded ? 'Clôturée — en attente de la suivante' : 'Active'}

            </Badge>

          </div>

        </CardHeader>

        <CardContent className="space-y-4">

          <p className="text-3xl font-semibold tracking-tight">{currentYear}</p>

          <div className="grid grid-cols-3 gap-3 text-sm">

            <div className="rounded-md bg-muted/50 p-3">

              <p className="text-muted-foreground">Classes actives</p>

              <p className="text-xl font-medium">{stats.activeClasses}</p>

            </div>

            <div className="rounded-md bg-muted/50 p-3">

              <p className="text-muted-foreground">Élèves inscrits</p>

              <p className="text-xl font-medium">{stats.enrolledStudents}</p>

            </div>

            <div className="rounded-md bg-muted/50 p-3">

              <p className="text-muted-foreground">Dossiers en attente</p>

              <p className="text-xl font-medium">{stats.pendingEnrollments}</p>

            </div>

          </div>

          {!isCurrentYearConcluded && canManage && (

            <p className="text-xs text-muted-foreground">

              Les classes de {currentYear} restent actives après clôture. Vous pourrez en créer de

              nouvelles pour l&apos;année suivante dans Formations ou via l&apos;étape 2 ci-dessous.

            </p>

          )}

        </CardContent>

      </Card>



      {!canManage && (

        <Card className="border-amber-500/30">

          <CardContent className="pt-6 text-sm text-muted-foreground">

            Seul le directeur peut clôturer une année, télécharger les archives ou en ouvrir une

            nouvelle.

          </CardContent>

        </Card>

      )}



      {canManage && !isCurrentYearConcluded && (

        <Card className="border-amber-500/30">

          <CardHeader>

            <CardTitle className="text-base flex items-center gap-2">

              <Lock className="h-4 w-4 text-amber-600" />

              Étape 1 — Clôturer l&apos;année

            </CardTitle>

            <CardDescription>

              Enregistre les exports classés de {currentYear} (scolarité, finances, bulletins, notes,

              classes). Les classes restent actives et l&apos;historique est conservé.

            </CardDescription>

          </CardHeader>

          <CardContent className="space-y-3">

            {stats.pendingEnrollments > 0 && (

              <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">

                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />

                <p>

                  {stats.pendingEnrollments} candidature(s) encore en attente pour {currentYear}.

                  Traitez-les avant la clôture si possible.

                </p>

              </div>

            )}

            <Button

              variant="outline"

              className="border-amber-600/40"

              onClick={handleConclude}

              disabled={loading !== null}

            >

              <Lock className="h-4 w-4" />

              {loading === 'conclude' ? 'Clôture…' : `Clôturer ${currentYear}`}

            </Button>

          </CardContent>

        </Card>

      )}



      {canManage && isCurrentYearConcluded && (

        <Card className="border-indigo-500/30">

          <CardHeader>

            <CardTitle className="text-base flex items-center gap-2">

              <PlayCircle className="h-4 w-4 text-indigo-600" />

              Étape 2 — Ouvrir la nouvelle année

            </CardTitle>

            <CardDescription>

              Bascule l&apos;année de référence, crée les classes de la nouvelle année et prépare les

              codes permanents de réinscription pour les élèves de {currentYear}.

            </CardDescription>

          </CardHeader>

          <CardContent className="space-y-4">

            <div className="space-y-2">

              <Label htmlFor="new-year">Nouvelle année scolaire</Label>

              <Input

                id="new-year"

                value={newYear}

                onChange={(e) => setNewYear(e.target.value)}

                placeholder="2026-2027"

              />

            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">

              <div className="space-y-0.5">

                <p className="text-sm font-medium">Créer les classes pour la nouvelle année</p>

                <p className="text-xs text-muted-foreground">

                  Reprend les intitulés de {currentYear}. Les anciennes classes restent actives.

                </p>

              </div>

              <Switch checked={duplicateClasses} onCheckedChange={setDuplicateClasses} />

            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">

              <div className="space-y-0.5">

                <p className="text-sm font-medium flex items-center gap-1.5">

                  <KeyRound className="h-3.5 w-3.5" />

                  Codes de réinscription permanents

                </p>

                <p className="text-xs text-muted-foreground">

                  Format établissement + nom + chiffres (ex. LYCKAL-DIALA-2847). Le même code

                  sert pour toutes les réinscriptions futures.

                </p>

              </div>

              <Switch checked={generateCodes} onCheckedChange={setGenerateCodes} />

            </div>

            <p className="text-xs text-muted-foreground">
              Après l&apos;ouverture, mettez à jour les frais et l&apos;échéancier de la nouvelle
              année dans la section « Tarifs &amp; échéancier » ci-dessous.
            </p>

            <Button onClick={handleStart} disabled={loading !== null}>

              <PlayCircle className="h-4 w-4" />

              {loading === 'start' ? 'Ouverture…' : 'Ouvrir la nouvelle année'}

            </Button>

          </CardContent>

        </Card>

      )}



      {canManage && feePrepNextYear && feeSetup && (

        <Card className="border-amber-500/40 bg-amber-500/5">

          <CardContent className="pt-6 text-sm text-amber-950">

            <p className="font-medium">Préparation de la rentrée {feeSetup.year}</p>

            <p className="text-muted-foreground mt-1">

              L&apos;année {currentYear} est clôturée. Vous pouvez déjà fixer les tarifs et

              l&apos;échéancier pour {feeSetup.year} avant d&apos;ouvrir la nouvelle année

              (copie des classes + codes réinscription).

            </p>

          </CardContent>

        </Card>

      )}



      {canManage && feeSetup && (!isCurrentYearConcluded || feePrepNextYear) && (

        <AnneeScolaireFees initialSetup={feeSetup} prepNextYear={feePrepNextYear} />

      )}



      {canManage && (!isCurrentYearConcluded || feePrepNextYear) && feeLoadError && !feeSetup && (

        <Card>

          <CardContent className="pt-6 text-sm text-destructive">

            Impossible de charger les tarifs : {feeLoadError}

          </CardContent>

        </Card>

      )}



      {canManage && !isCurrentYearConcluded && (

        <Card className="border-violet-500/30">

          <CardHeader>

            <CardTitle className="text-base flex items-center gap-2">

              <KeyRound className="h-4 w-4 text-violet-600" />

              Codes de réinscription — {currentYear}

            </CardTitle>

            <CardDescription>

              Téléchargez la liste des codes actifs pour l&apos;année en cours (y compris après

              génération automatique).

            </CardDescription>

          </CardHeader>

          <CardContent>

            <Button

              variant="outline"

              size="sm"

              onClick={() => handleDownloadCodes(currentYear)}

              disabled={loading !== null}

            >

              <Download className="h-4 w-4" />

              {loading === 'codes' ? 'Export…' : 'Télécharger les codes (CSV)'}

            </Button>

          </CardContent>

        </Card>

      )}



      {concludedYears.length > 0 && (

        <Card>

          <CardHeader>

            <CardTitle className="text-base flex items-center gap-2">

              <CheckCircle2 className="h-4 w-4 text-emerald-600" />

              Années clôturées &amp; archives

            </CardTitle>

            <CardDescription>

              Exports enregistrés à la clôture — téléchargeables par le directeur.

            </CardDescription>

          </CardHeader>

          <CardContent className="space-y-4">

            {concludedYears.map((y) => (

              <div key={y.year} className="rounded-lg border p-4 space-y-3">

                <div className="flex items-center justify-between gap-2">

                  <div>

                    <p className="font-medium">{y.year}</p>

                    <p className="text-xs text-muted-foreground">

                      Clôturée le {formatDate(y.concluded_at)}

                    </p>

                  </div>

                </div>

                {y.archives.length > 0 ? (

                  <ul className="grid gap-2 sm:grid-cols-2">

                    {y.archives.map((a) => (

                      <li key={`${y.year}-${a.category}`}>

                        <Button

                          variant="outline"

                          size="sm"

                          className="w-full justify-between h-auto py-2"

                          onClick={() => handleDownloadArchive(a.id)}

                          disabled={loading !== null || !canManage}

                        >

                          <span className="text-left">

                            <span className="block text-sm font-medium">{a.label}</span>

                            <span className="block text-xs text-muted-foreground">

                              {a.row_count} ligne{a.row_count !== 1 ? 's' : ''} — {a.file_name}

                            </span>

                          </span>

                          <Download className="h-4 w-4 shrink-0" />

                        </Button>

                      </li>

                    ))}

                  </ul>

                ) : (

                  <p className="text-sm text-muted-foreground">Aucun export enregistré.</p>

                )}

              </div>

            ))}

          </CardContent>

        </Card>

      )}

    </div>

  );

}


