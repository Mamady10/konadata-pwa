'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  importBtpPlanningRefMsProject,
  previewBtpMsProjectXml,
  saveBtpPlanningRefConfig,
  setBtpDefaultPlanningRefSlot,
} from '@/lib/actions/btp-planning-ref';
import { PLANNING_SOURCE_LABELS } from '@/lib/btp/planning-ref';
import type { BtpSitePlanningRef } from '@/lib/btp/planning-ref';
import type { BtpSiteMilestoneInput, PlanningRefSlot, PlanningSourceType } from '@/lib/btp/site-baseline-types';
import { CalendarRange, FileUp, Loader2, Plus, Star, Trash2 } from 'lucide-react';

const EMPTY_MILESTONE: BtpSiteMilestoneInput = {
  label: '',
  targetPhysicalPct: 25,
  plannedDate: '',
};

interface Props {
  siteId: string;
  siteName: string;
  slot: PlanningRefSlot;
  refData?: BtpSitePlanningRef | null;
  isDefaultRef: boolean;
  canManage: boolean;
}

export function BtpPlanningRefEditor({
  siteId,
  siteName,
  slot,
  refData,
  isDefaultRef,
  canManage,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(refData?.label ?? `Référence ${slot}`);
  const [sourceType, setSourceType] = useState<PlanningSourceType>(refData?.sourceType ?? 'linear');
  const [milestones, setMilestones] = useState<BtpSiteMilestoneInput[]>(
    refData?.milestones?.length
      ? refData.milestones
      : [{ ...EMPTY_MILESTONE, label: 'Phase 1', targetPhysicalPct: 30 }]
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [xmlPreview, setXmlPreview] = useState<string | null>(null);

  if (!canManage) {
    if (!refData) return null;
    return (
      <Badge variant="outline" className="text-[10px]">
        Ref {slot} : {PLANNING_SOURCE_LABELS[refData.sourceType]}
      </Badge>
    );
  }

  async function handleSave() {
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('slot', String(slot));
    fd.set('label', label);
    fd.set('source_type', sourceType);
    if (sourceType === 'milestones') {
      fd.set(
        'milestones_json',
        JSON.stringify(milestones.filter((m) => m.label.trim() && m.plannedDate))
      );
    }
    const result = await saveBtpPlanningRefConfig(fd);
    setLoading(false);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    router.refresh();
    setOpen(false);
  }

  async function handleXmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set('file', file);
    const preview = await previewBtpMsProjectXml(fd);
    setLoading(false);
    if ('error' in preview) {
      setError(preview.error ?? 'XML invalide.');
      setXmlPreview(null);
      return;
    }
    setXmlPreview(`${preview.preview.taskCount} tâches · ${preview.preview.projectTitle}`);
    e.target.value = '';
  }

  async function handleXmlImport() {
    if (!pendingFile) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('slot', String(slot));
    fd.set('label', label);
    fd.set('file', pendingFile);
    const result = await importBtpPlanningRefMsProject(fd);
    setLoading(false);
    if ('error' in result) {
      setError(result.error ?? 'Import impossible.');
      return;
    }
    setSourceType('ms_project');
    setPendingFile(null);
    setXmlPreview(null);
    router.refresh();
    setOpen(false);
  }

  async function handleSetDefault() {
    setLoading(true);
    await setBtpDefaultPlanningRefSlot(siteId, slot);
    setLoading(false);
    router.refresh();
  }

  const summary = refData
    ? refData.sourceType === 'ms_project'
      ? `MS Project · ${refData.tasks.length} tâches`
      : refData.sourceType === 'milestones'
        ? `${refData.milestones.length} jalon(s)`
        : 'Dates début / fin'
    : 'Non configuré';

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
          <CalendarRange className="h-3.5 w-3.5" />
          Ref {slot}
        </Button>
        <Badge variant="secondary" className="text-[10px]">
          {summary}
        </Badge>
        {isDefaultRef && (
          <Badge className="text-[10px] bg-amber-500/15 text-amber-800 border-amber-200" variant="outline">
            Défaut saisie
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-blue-200/50 bg-muted/20 p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-primary">
          {siteName} — Référence {slot}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="space-y-2">
        <Label className="text-xs">Libellé de la référence</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Type de planning</Label>
        <Select value={sourceType} onValueChange={(v) => setSourceType(v as PlanningSourceType)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linear">{PLANNING_SOURCE_LABELS.linear}</SelectItem>
            <SelectItem value="milestones">{PLANNING_SOURCE_LABELS.milestones}</SelectItem>
            <SelectItem value="ms_project">{PLANNING_SOURCE_LABELS.ms_project}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sourceType === 'milestones' && (
        <div className="space-y-2 rounded border bg-background p-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-semibold">Jalons</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setMilestones((m) => [...m, { ...EMPTY_MILESTONE }])}
            >
              <Plus className="h-3 w-3" /> Jalon
            </Button>
          </div>
          {milestones.map((m, i) => (
            <div key={i} className="grid gap-1.5 sm:grid-cols-[1fr_72px_120px_auto] items-end">
              <Input
                placeholder="Phase"
                value={m.label}
                className="h-8 text-xs"
                onChange={(e) => {
                  const next = [...milestones];
                  next[i] = { ...next[i], label: e.target.value };
                  setMilestones(next);
                }}
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={m.targetPhysicalPct}
                className="h-8 text-xs"
                onChange={(e) => {
                  const next = [...milestones];
                  next[i] = { ...next[i], targetPhysicalPct: Number(e.target.value) };
                  setMilestones(next);
                }}
              />
              <Input
                type="date"
                value={m.plannedDate}
                className="h-8 text-xs"
                onChange={(e) => {
                  const next = [...milestones];
                  next[i] = { ...next[i], plannedDate: e.target.value };
                  setMilestones(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMilestones((list) => list.filter((_, j) => j !== i))}
                disabled={milestones.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {sourceType === 'ms_project' && (
        <div className="space-y-2 rounded border bg-background p-2">
          <p className="text-xs text-muted-foreground">
            MS Project → Fichier → Exporter → XML
          </p>
          {refData?.sourceType === 'ms_project' && (
            <p className="text-xs">
              Actuel : {refData.projectTitle ?? '—'} ({refData.tasks.length} tâches)
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={handleXmlFile}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full h-8"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            Choisir XML
          </Button>
          {xmlPreview && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{xmlPreview}</p>
              <Button type="button" size="sm" className="w-full h-8 bg-[#2563EB]" onClick={handleXmlImport}>
                Importer ce fichier
              </Button>
            </div>
          )}
        </div>
      )}

      {sourceType === 'linear' && (
        <p className="text-xs text-muted-foreground rounded border bg-background p-2">
          Avancement planifié réparti linéairement entre les dates de début et fin du chantier.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {sourceType !== 'ms_project' && (
          <Button type="button" size="sm" className="bg-[#2563EB]" disabled={loading} onClick={handleSave}>
            Enregistrer
          </Button>
        )}
        {!isDefaultRef && (
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={handleSetDefault}>
            <Star className="h-3.5 w-3.5" /> Référence par défaut (saisie)
          </Button>
        )}
      </div>
    </div>
  );
}
