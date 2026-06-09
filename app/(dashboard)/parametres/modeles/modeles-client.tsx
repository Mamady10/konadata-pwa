'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  uploadOrganizationAiTemplate,
  removeOrganizationAiTemplate,
  type OrganizationAiTemplateRow,
} from '@/lib/actions/document-templates';
import {
  createOrgDocumentType,
  deactivateOrgDocumentType,
} from '@/lib/actions/org-document-types';
import { DOCUMENT_CATEGORY_OPTIONS } from '@/lib/documents/org-document-types';
import type { TemplatePurposeDef, TemplateSector } from '@/lib/ai/document-template-purposes';
import type { DocumentCategory } from '@/types/database';
import { CaptureStandardTemplatesPanel } from '@/components/documents/capture-standard-templates-panel';
import type { CaptureStandardTemplate } from '@/lib/documents/capture-standard-templates';
import { Sparkles, Upload, Trash2, FileText, ArrowLeft, CheckCircle2, Plus } from 'lucide-react';

interface Props {
  orgName: string;
  sector: TemplateSector;
  orgTypeLabel: string;
  purposes: TemplatePurposeDef[];
  templates: OrganizationAiTemplateRow[];
  captureTemplates: CaptureStandardTemplate[];
  hasOpenAiKey: boolean;
}

export function ModelesIaClient({
  orgName,
  sector,
  orgTypeLabel,
  purposes,
  templates: initialTemplates,
  captureTemplates,
  hasOpenAiKey,
}: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [typeLabel, setTypeLabel] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [typeCategory, setTypeCategory] = useState<DocumentCategory>('other');
  const [typeHint, setTypeHint] = useState('');
  const [typeLoading, setTypeLoading] = useState(false);

  const customPurposes = useMemo(() => purposes.filter((p) => p.isCustom), [purposes]);
  const capturePurposes = useMemo(() => purposes.filter((p) => p.isCaptureStandard), [purposes]);
  const builtinPurposes = useMemo(
    () => purposes.filter((p) => !p.isCustom && !p.isCaptureStandard),
    [purposes]
  );

  const templateByPurpose = useMemo(() => {
    const map = new Map<string, OrganizationAiTemplateRow>();
    for (const t of templates) map.set(t.purpose, t);
    return map;
  }, [templates]);

  const selectedPurposeDef = purposes.find((p) => p.purpose === purpose);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!purpose) {
      setError('Choisissez le type de modèle.');
      return;
    }
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set('sector', sector);
    formData.set('purpose', purpose);
    const result = await uploadOrganizationAiTemplate(formData);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setMessage('Modèle enregistré. L\'IA s\'alignera sur ce fichier pour les prochains documents.');
    setPurpose('');
    router.refresh();
  }

  async function handleCreateType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!typeLabel.trim()) {
      setError('Indiquez le nom du type de document.');
      return;
    }
    setTypeLoading(true);
    const res = await createOrgDocumentType({
      sector,
      label: typeLabel.trim(),
      description: typeDescription.trim() || undefined,
      category: typeCategory,
      hint: typeHint.trim() || undefined,
    });
    setTypeLoading(false);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setMessage(`Type « ${res.type.label} » créé. Vous pouvez maintenant y joindre un modèle IA.`);
    setPurpose(res.type.purpose);
    setTypeLabel('');
    setTypeDescription('');
    setTypeHint('');
    router.refresh();
  }

  async function handleDeactivateType(customTypeId: string, label: string) {
    if (!confirm(`Désactiver le type « ${label} » ? Les documents déjà classés conservent leur libellé.`)) {
      return;
    }
    const res = await deactivateOrgDocumentType(customTypeId);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setMessage(`Type « ${label} » désactivé.`);
    router.refresh();
  }

  async function handleRemove(templateId: string) {
    if (!confirm('Supprimer ce modèle de référence ?')) return;
    const result = await removeOrganizationAiTemplate(templateId);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setMessage('Modèle supprimé.');
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/parametres"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Paramètres
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Modèles IA — {orgTypeLabel}</h1>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {orgName}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
          Créez vos propres types de documents si la liste standard ne correspond pas à votre
          organisation, puis déposez un modèle IA par type. Lors des uploads et générations, KonaAI
          adaptera le style, la structure et les rubriques en s&apos;inspirant de ce modèle.
        </p>
        {!hasOpenAiKey ? (
          <p className="text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-3">
            <strong>Mode local actif</strong> — sans compte OpenAI, l&apos;application génère des
            consignes structurées à partir de vos modèles et de vos notes. Remplissez bien le champ
            « Consignes pour l&apos;IA » à chaque dépôt. Plus tard, ajoutez{' '}
            <code className="text-xs">OPENAI_API_KEY</code> dans <code className="text-xs">.env.local</code>{' '}
            pour des textes plus détaillés.
          </p>
        ) : (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-3">
            OpenAI est configuré — les consignes sont générées par l&apos;API.
          </p>
        )}
      </div>

      <CaptureStandardTemplatesPanel templates={captureTemplates} />

      <Card className="border-violet-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-violet-600" />
            Créer un type de document (organisation)
          </CardTitle>
          <CardDescription>
            Ex. « Rapport santé maternelle », « Attestation de fréquentation », « Fiche chantier
            hydraulique » — propre à vos données et processus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateType} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nom du type *</Label>
              <Input
                value={typeLabel}
                onChange={(e) => setTypeLabel(e.target.value)}
                placeholder="Ex. Rapport trimestriel partenaires"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description (pour l&apos;IA)</Label>
              <Input
                value={typeDescription}
                onChange={(e) => setTypeDescription(e.target.value)}
                placeholder="Structure attendue, rubriques, public cible…"
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={typeCategory}
                onValueChange={(v) => setTypeCategory(v as DocumentCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Indication upload (optionnel)</Label>
              <Input
                value={typeHint}
                onChange={(e) => setTypeHint(e.target.value)}
                placeholder="Ex. PDF signé par le coordinateur"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" className="border-violet-600/40" disabled={typeLoading}>
                <Plus className="h-4 w-4" />
                {typeLoading ? 'Création…' : 'Créer le type'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {customPurposes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Types personnalisés ({customPurposes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customPurposes.map((p) => (
              <div
                key={p.purpose}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {templateByPurpose.has(p.purpose) ? 'Modèle IA joint' : 'Sans modèle'}
                  </Badge>
                </div>
                {p.customTypeId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    onClick={() => handleDeactivateType(p.customTypeId!, p.label)}
                  >
                    Désactiver
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter ou remplacer un modèle</CardTitle>
          <CardDescription>
            Un modèle par type de document. Remplacer un type écrase l&apos;ancien exemple.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          {message && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              {message}
            </p>
          )}
          <form onSubmit={handleUpload} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Type de document *</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le type de modèle" />
                </SelectTrigger>
                <SelectContent>
                  {builtinPurposes.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Types standards
                      </div>
                      {builtinPurposes.map((p) => (
                        <SelectItem key={p.purpose} value={p.purpose}>
                          {p.label}
                          {templateByPurpose.has(p.purpose) ? ' (déjà défini)' : ''}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {capturePurposes.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        KonaData — optimisé manuscrit
                      </div>
                      {capturePurposes.map((p) => (
                        <SelectItem key={p.purpose} value={p.purpose}>
                          {p.label}
                          {templateByPurpose.has(p.purpose) ? ' (modèle IA joint)' : ''}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {customPurposes.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Votre organisation
                      </div>
                      {customPurposes.map((p) => (
                        <SelectItem key={p.purpose} value={p.purpose}>
                          {p.label}
                          {templateByPurpose.has(p.purpose) ? ' (déjà défini)' : ''}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {selectedPurposeDef && (
                <p className="text-xs text-muted-foreground">{selectedPurposeDef.description}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Fichier modèle *</Label>
              <Input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" required />
              {selectedPurposeDef && (
                <p className="text-xs text-muted-foreground">{selectedPurposeDef.hint}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Consignes pour l&apos;IA (optionnel)</Label>
              <Input
                name="notes"
                placeholder="Ex. mentionner le logo, ton formel, rubrique appréciation obligatoire..."
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="bg-[#2563EB]" disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'Enregistrement...' : 'Enregistrer le modèle'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modèles actifs ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun modèle pour l&apos;instant. Les documents produits ne seront pas alignés sur un
              exemple de référence.
            </p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.label}</p>
                    <p className="text-sm text-muted-foreground truncate">{t.fileName}</p>
                    {t.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.notes}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive shrink-0"
                  onClick={() => handleRemove(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Les types personnalisés apparaissent aussi dans les écrans Documents (ONG, BTP) et guident
        l&apos;adaptation IA après chaque dépôt.
      </p>
    </div>
  );
}
