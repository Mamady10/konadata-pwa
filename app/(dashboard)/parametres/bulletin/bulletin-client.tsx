'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Download,
  FileText,
  ImageIcon,
  RefreshCw,
  Save,
  Sparkles,
  Stamp,
  Upload,
} from 'lucide-react';
import {
  updateBulletinDefaultExamTypes,
  updateBulletinTemplate,
  updateGradingPeriodByLevel,
} from '@/lib/actions/school-settings';
import { BULLETIN_EXAM_TYPE_PRESETS } from '@/lib/school/bulletin-exam-types';
import {
  getBulletinBlankPreviewPdf,
  syncBulletinStyleFromReference,
  uploadBulletinReferenceTemplate,
  type BulletinReferenceInfo,
} from '@/lib/actions/bulletin-reference';
import {
  getBulletinBrandingStatus,
  uploadBulletinLogo,
  uploadBulletinStamp,
  type BulletinBrandingStatus,
} from '@/lib/actions/bulletin-branding';
import {
  applyBulletinPreset,
  BULLETIN_LAYOUT_PRESETS,
  type BulletinLayoutPresetId,
} from '@/lib/school/bulletin-presets';
import type { SchoolBulletinTemplate, GradingPeriodPolicyByLevel } from '@/lib/school/school-org-settings';
import {
  EDUCATION_LEVEL_BANDS,
  switchGradingPeriodMode,
  type EducationLevelBand,
  type GradingPeriodMode,
} from '@/lib/school/grading-period-settings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarRange } from 'lucide-react';

interface Props {
  initialTemplate: SchoolBulletinTemplate;
  initialGradingByLevel: GradingPeriodPolicyByLevel;
  initialDefaultExamTypes: string[];
  reference: BulletinReferenceInfo;
  branding: BulletinBrandingStatus;
  loadError?: string;
}

function downloadBase64(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulletinTemplateClient({
  initialTemplate,
  initialGradingByLevel,
  initialDefaultExamTypes,
  reference,
  branding: initialBranding,
  loadError,
}: Props) {
  const router = useRouter();
  const [tpl, setTpl] = useState(initialTemplate);
  const [gradingByLevel, setGradingByLevel] = useState(initialGradingByLevel);
  const [activeLevelBand, setActiveLevelBand] = useState<EducationLevelBand>('college');
  const [defaultExamTypes, setDefaultExamTypes] = useState<Set<string>>(
    () => new Set(initialDefaultExamTypes)
  );
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingExamTypes, setSavingExamTypes] = useState(false);
  const [refInfo, setRefInfo] = useState(reference);
  const [branding, setBranding] = useState(initialBranding);
  const [msg, setMsg] = useState<string | null>(loadError ?? null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  useEffect(() => {
    setBranding(initialBranding);
  }, [initialBranding]);

  async function refreshBrandingFromServer() {
    const fresh = await getBulletinBrandingStatus();
    setBranding(fresh);
    return fresh;
  }

  const activePolicy = gradingByLevel[activeLevelBand];

  function handlePeriodModeChange(mode: GradingPeriodMode) {
    setGradingByLevel((prev) => ({
      ...prev,
      [activeLevelBand]: switchGradingPeriodMode(prev[activeLevelBand], mode),
    }));
  }

  function updatePeriodRequired(periodId: string, value: number) {
    setGradingByLevel((prev) => {
      const policy = prev[activeLevelBand];
      return {
        ...prev,
        [activeLevelBand]: {
          ...policy,
          periods: policy.periods.map((period) =>
            period.period_id === periodId
              ? {
                  ...period,
                  required_evaluations_per_subject: Math.max(1, Math.min(20, value)),
                }
              : period
          ),
        },
      };
    });
  }

  async function handleSaveGradingPolicy() {
    setSavingPolicy(true);
    setMsg(null);
    const res = await updateGradingPeriodByLevel(gradingByLevel);
    setSavingPolicy(false);
    if (res.error) setMsg(res.error);
    else setMsg('Périodes par niveau enregistrées.');
  }

  function toggleDefaultExamType(type: string) {
    setDefaultExamTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleSaveDefaultExamTypes() {
    setSavingExamTypes(true);
    setMsg(null);
    const res = await updateBulletinDefaultExamTypes([...defaultExamTypes]);
    setSavingExamTypes(false);
    if (res.error) setMsg(res.error);
    else setMsg('Types d\'évaluation par défaut enregistrés.');
  }

  function handleApplyPreset(presetId: BulletinLayoutPresetId) {
    setTpl((current) => applyBulletinPreset(current, presetId));
    setMsg(`Modèle « ${BULLETIN_LAYOUT_PRESETS.find((p) => p.id === presetId)?.label} » appliqué — enregistrez pour conserver.`);
  }

  async function handleSave() {
    setLoading(true);
    setMsg(null);
    const res = await updateBulletinTemplate(tpl);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else {
      setMsg('Modèle bulletin enregistré.');
      setBranding((b) => {
        const missing: string[] = [];
        if (tpl.require_logo && !b.hasLogo) missing.push('logo');
        if (tpl.require_stamp && !b.hasStamp) missing.push('cachet');
        return {
          ...b,
          requireLogo: tpl.require_logo,
          requireStamp: tpl.require_stamp,
          missing,
          readyForPdf: missing.length === 0,
        };
      });
    }
  }

  async function handleUploadReference(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await uploadBulletinReferenceTemplate(fd);
    setUploading(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    if ('warning' in res && res.warning) {
      setMsg(res.warning);
    } else {
      setMsg('Modèle joint et style synchronisé — les PDF suivront ce bulletin.');
      if ('template' in res && res.template) setTpl(res.template);
    }
    router.refresh();
    (e.target as HTMLFormElement).reset();
  }

  async function handleSyncStyle() {
    setLoading(true);
    setMsg(null);
    const res = await syncBulletinStyleFromReference();
    setLoading(false);
    if ('error' in res && res.error) setMsg(res.error);
    else {
      setTpl(res.template);
      setRefInfo((r) => ({ ...r, syncedAt: res.template.reference?.synced_at ?? null }));
      setMsg('Style repris depuis le fichier modèle.');
    }
  }

  async function handlePreviewPdf() {
    setLoading(true);
    const res = await getBulletinBlankPreviewPdf();
    setLoading(false);
    if ('error' in res && res.error) setMsg(res.error);
    else downloadBase64(res.base64, res.fileName);
  }

  async function submitLogoFile(file: File) {
    setUploadingLogo(true);
    setMsg(null);
    const fd = new FormData();
    fd.set('file', file);
    const res = await uploadBulletinLogo(fd);
    setUploadingLogo(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    const fresh = await refreshBrandingFromServer();
    if (!fresh.hasLogo) {
      setMsg('Échec : le logo n’a pas été enregistré côté serveur. Réessayez.');
      return;
    }
    setMsg('Logo enregistré — il apparaîtra sur les bulletins PDF.');
    router.refresh();
  }

  async function submitStampFile(file: File) {
    setUploadingStamp(true);
    setMsg(null);
    const fd = new FormData();
    fd.set('file', file);
    const res = await uploadBulletinStamp(fd);
    setUploadingStamp(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    const fresh = await refreshBrandingFromServer();
    if (!fresh.hasStamp) {
      setMsg('Échec : le cachet n’a pas été enregistré côté serveur. Réessayez.');
      return;
    }
    setMsg(res.message ?? 'Cachet intégré sur les bulletins PDF.');
    router.refresh();
  }

  async function handleUploadLogo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement)?.files?.[0];
    if (!file) {
      setMsg('Choisissez un fichier logo, puis cliquez « Joindre le logo ».');
      return;
    }
    await submitLogoFile(file);
    e.currentTarget.reset();
  }

  async function handleUploadStamp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement)?.files?.[0];
    if (!file) {
      setMsg('Choisissez un fichier cachet, puis cliquez « Joindre le cachet ».');
      return;
    }
    await submitStampFile(file);
    e.currentTarget.reset();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/parametres">
          <ArrowLeft className="h-4 w-4" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" />
          Modèle bulletin
        </h1>
        <p className="text-muted-foreground">
          Joignez le bulletin officiel de votre établissement : les téléchargements (élève, ZIP,
          portail famille) reprennent sa mise en page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            Périodes & notes requises
          </CardTitle>
          <CardDescription>
            Primaire et collège : trimestres en général. Lycée et université : semestres. Le type est
            déduit du champ « niveau » de chaque classe (Formations). 0/20 compte comme note saisie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {EDUCATION_LEVEL_BANDS.map((band) => (
              <Button
                key={band.id}
                type="button"
                size="sm"
                variant={activeLevelBand === band.id ? 'default' : 'outline'}
                onClick={() => setActiveLevelBand(band.id)}
              >
                {band.label}
              </Button>
            ))}
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Type de période — {EDUCATION_LEVEL_BANDS.find((b) => b.id === activeLevelBand)?.label}</Label>
            <Select
              value={activePolicy.mode}
              onValueChange={(v) => handlePeriodModeChange(v as GradingPeriodMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semester">Semestres (S1, S2, S3)</SelectItem>
                <SelectItem value="trimester">Trimestres (T1, T2, T3)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {activePolicy.periods.map((period) => (
              <div
                key={period.period_id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <span className="font-medium text-sm min-w-[120px]">{period.label}</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`req-${period.period_id}`} className="text-xs text-muted-foreground">
                    Notes requises / matière
                  </Label>
                  <Input
                    id={`req-${period.period_id}`}
                    type="number"
                    min={1}
                    max={20}
                    className="w-20 h-8"
                    value={period.required_evaluations_per_subject}
                    onChange={(e) =>
                      updatePeriodRequired(period.period_id, Number(e.target.value))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => void handleSaveGradingPolicy()} disabled={savingPolicy}>
            <Save className="h-4 w-4" />
            {savingPolicy ? 'Enregistrement…' : 'Enregistrer les périodes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Types de notes pour les bulletins</CardTitle>
          <CardDescription>
            Présélection à la génération des bulletins. Le directeur peut ajuster le choix par classe
            et par période. Aucune case cochée ici = toutes les évaluations saisies sont prises en compte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BULLETIN_EXAM_TYPE_PRESETS.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/40 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={defaultExamTypes.has(type)}
                  onChange={() => toggleDefaultExamType(type)}
                />
                {type}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDefaultExamTypes(new Set(BULLETIN_EXAM_TYPE_PRESETS))}
            >
              Tout sélectionner
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDefaultExamTypes(new Set())}
            >
              Toutes les notes (aucun filtre)
            </Button>
          </div>
          <Button onClick={() => void handleSaveDefaultExamTypes()} disabled={savingExamTypes}>
            <Save className="h-4 w-4" />
            {savingExamTypes ? 'Enregistrement…' : 'Enregistrer les types par défaut'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modèle de mise en page</CardTitle>
          <CardDescription>
            {BULLETIN_LAYOUT_PRESETS.length} designs disponibles — chaque établissement peut adopter
            un style et des couleurs distincts (sans IA).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {BULLETIN_LAYOUT_PRESETS.map((preset) => {
            const active = (tpl.layout_preset ?? 'meps_band') === preset.id;
            const swatch = preset.template.primary_color ?? '2563EB';
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.id)}
                className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm">{preset.label}</span>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border"
                    style={{ backgroundColor: `#${swatch}` }}
                    aria-hidden
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {preset.description}
                </p>
                {active && (
                  <Badge variant="outline" className="mt-2 border-primary/40 text-primary">
                    Sélectionné
                  </Badge>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className={branding.readyForPdf ? 'border-emerald-500/30' : 'border-amber-500/40'}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Logo et cachet officiels
          </CardTitle>
          <CardDescription>
            Obligatoires pour télécharger les bulletins PDF. Le cachet est extrait automatiquement
            (image directe ou PDF, avec validation KonaAI si activée).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            1) Choisissez le fichier — 2) Cliquez <strong>Joindre le logo</strong> ou{' '}
            <strong>Joindre le cachet</strong> (la sélection seule ne suffit pas).
          </p>
          {msg && (
            <p
              className={`text-sm rounded-md px-3 py-2 ${
                msg.includes('enregistré') ||
                msg.includes('intégré') ||
                msg.includes('Logo') ||
                msg.includes('Cachet')
                  ? 'text-emerald-800 bg-emerald-500/10'
                  : 'text-red-800 bg-red-500/10'
              }`}
            >
              {msg}
            </p>
          )}
          {!branding.readyForPdf && (
            <p className="text-sm text-amber-900 bg-amber-500/10 rounded-md px-3 py-2">
              Éléments manquants :{' '}
              {branding.missing.map((m) => (m === 'logo' ? 'logo' : 'cachet')).join(', ')}.
              Les téléchargements PDF sont bloqués tant que le branding n&apos;est pas complet.
            </p>
          )}
          {branding.readyForPdf && (
            <p className="text-sm text-emerald-800 bg-emerald-500/10 rounded-md px-3 py-2">
              Branding complet — les bulletins peuvent être exportés.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-medium">Logo établissement</Label>
                {branding.hasLogo ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-800">
                    Joint
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-800">
                    Requis
                  </Badge>
                )}
              </div>
              {branding.logoFileName && (
                <p className="text-xs text-muted-foreground truncate">{branding.logoFileName}</p>
              )}
              {branding.logoDownloadUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={branding.logoDownloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Voir le logo
                  </a>
                </Button>
              )}
              <form onSubmit={handleUploadLogo} className="space-y-2 pt-1">
                <Input name="file" type="file" accept=".png,.jpg,.jpeg,.webp" required={!branding.hasLogo} />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  disabled={uploadingLogo}
                >
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? 'Envoi…' : 'Joindre le logo'}
                </Button>
              </form>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-medium flex items-center gap-1">
                  <Stamp className="h-3.5 w-3.5" />
                  Cachet officiel
                </Label>
                {branding.hasStamp ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-800">
                    Intégré
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-800">
                    Requis
                  </Badge>
                )}
              </div>
              {branding.stampFileName && (
                <p className="text-xs text-muted-foreground truncate">{branding.stampFileName}</p>
              )}
              {branding.stampProcessMethod && (
                <p className="text-xs text-muted-foreground">
                  Extraction :{' '}
                  {branding.stampProcessMethod === 'vision'
                    ? 'KonaAI Vision'
                    : branding.stampProcessMethod === 'pdf_render'
                      ? 'PDF (sans IA)'
                      : 'image directe'}
                  {branding.stampAiValidated === true && ' · validé'}
                </p>
              )}
              {branding.stampDownloadUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={branding.stampDownloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Voir le fichier source
                  </a>
                </Button>
              )}
              <form onSubmit={handleUploadStamp} className="space-y-2 pt-1">
                <Input
                  name="file"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  required={!branding.hasStamp}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                  disabled={uploadingStamp}
                >
                  <Upload className="h-4 w-4" />
                  {uploadingStamp ? 'Extraction…' : 'Joindre le cachet'}
                </Button>
              </form>
              <p className="text-[11px] text-muted-foreground">
                PNG/JPEG : intégration directe. PDF : 1ère page rendue sans IA. KonaAI valide le
                cachet si activé.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-violet-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Fichier modèle de référence
          </CardTitle>
          <CardDescription>
            PDF ou Word du bulletin type (vide ou exemple). KonaData adapte les nouveaux bulletins
            générés depuis les notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {refInfo.hasReference ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="border-violet-500/40">
                {refInfo.fileName}
              </Badge>
              {refInfo.syncedAt && (
                <span className="text-muted-foreground text-xs">
                  Style synchronisé le{' '}
                  {new Date(refInfo.syncedAt).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-800 bg-amber-500/10 rounded-md px-3 py-2">
              Aucun modèle joint — les PDF utilisent uniquement les réglages ci-dessous.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {refInfo.downloadUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={refInfo.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Télécharger le modèle joint
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncStyle}
              disabled={loading || !refInfo.hasReference}
            >
              <RefreshCw className="h-4 w-4" />
              Resynchroniser le style
            </Button>
            <Button variant="outline" size="sm" onClick={handlePreviewPdf} disabled={loading}>
              <FileText className="h-4 w-4" />
              Aperçu PDF (exemple)
            </Button>
          </div>

          <form onSubmit={handleUploadReference} className="space-y-3 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="bulletin-ref-file">Remplacer ou joindre un modèle</Label>
              <Input
                id="bulletin-ref-file"
                name="file"
                type="file"
                accept=".pdf,.doc,.docx"
                required={!refInfo.hasReference}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulletin-ref-notes">Consignes direction (optionnel)</Label>
              <Input
                id="bulletin-ref-notes"
                name="notes"
                placeholder="Ex. reprendre le bandeau bleu et la formule MEPS en pied de page"
                defaultValue={refInfo.notes ?? ''}
              />
            </div>
            <Button type="submit" disabled={uploading} className="bg-violet-600 hover:bg-violet-700">
              <Upload className="h-4 w-4" />
              {uploading ? 'Envoi…' : 'Joindre le modèle bulletin'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">En-tête PDF</CardTitle>
          <CardDescription>
            Personnalisez le modèle choisi ci-dessus (titre, couleur, pied de page).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Titre principal</Label>
            <Input
              value={tpl.header_title}
              onChange={(e) => setTpl((t) => ({ ...t, header_title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Sous-titre (vide = nom établissement)</Label>
            <Input
              value={tpl.header_subtitle}
              onChange={(e) => setTpl((t) => ({ ...t, header_subtitle: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Couleur bandeau (hex sans #)</Label>
            <Input
              value={tpl.primary_color}
              onChange={(e) => setTpl((t) => ({ ...t, primary_color: e.target.value }))}
              placeholder="2563EB"
              className="font-mono max-w-[140px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contenu affiché</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={tpl.show_rank}
              onCheckedChange={(v) => setTpl((t) => ({ ...t, show_rank: v }))}
            />
            <Label>Afficher le rang dans la classe</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={tpl.show_appreciation}
              onCheckedChange={(v) => setTpl((t) => ({ ...t, show_appreciation: v }))}
            />
            <Label>Afficher l&apos;appréciation</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={tpl.show_coefficients}
              onCheckedChange={(v) => setTpl((t) => ({ ...t, show_coefficients: v }))}
            />
            <Label>Afficher les coefficients</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={tpl.show_all_subjects}
              onCheckedChange={(v) => setTpl((t) => ({ ...t, show_all_subjects: v }))}
            />
            <Label>Lister toutes les matières du catalogue (— si non noté)</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={tpl.show_evaluation_details}
              onCheckedChange={(v) => setTpl((t) => ({ ...t, show_evaluation_details: v }))}
            />
            <Label>Détail par évaluation sur le PDF (une ligne par type de note)</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={tpl.require_logo}
              onCheckedChange={(v) => setTpl((t) => ({ ...t, require_logo: v }))}
            />
            <Label>Logo obligatoire pour export PDF</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={tpl.require_stamp}
              onCheckedChange={(v) => setTpl((t) => ({ ...t, require_stamp: v }))}
            />
            <Label>Cachet obligatoire pour export PDF</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pied de page</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Texte pied de page</Label>
            <Input
              value={tpl.footer_text}
              onChange={(e) => setTpl((t) => ({ ...t, footer_text: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Libellé signature direction</Label>
            <Input
              value={tpl.director_signature_label}
              onChange={(e) =>
                setTpl((t) => ({ ...t, director_signature_label: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Button className="bg-[#2563EB]" onClick={handleSave} disabled={loading}>
        <Save className="h-4 w-4" />
        Enregistrer les réglages
      </Button>

      {msg && (
        <p
          className={`text-sm ${
            msg.includes('enregistré') ||
            msg.includes('synchronisé') ||
            msg.includes('joint') ||
            msg.includes('repris') ||
            msg.includes('intégré') ||
            msg.includes('Logo') ||
            msg.includes('Cachet') ||
            msg.includes('complet') ||
            msg.includes('appliqué') ||
            msg.includes('Modèle')
              ? 'text-emerald-700'
              : 'text-destructive'
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
