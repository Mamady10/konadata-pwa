'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createBtpPersonnel } from '@/lib/actions/btp';
import { createBtpLaborEntry, updateBtpLaborEntry, deleteBtpLaborEntry } from '@/lib/actions/btp-financial';
import {
  parseBtpPersonnelImportFile,
  importBtpPersonnelFromList,
  deactivateBtpPersonnel,
  reactivateBtpPersonnel,
} from '@/lib/actions/btp-personnel-import';
import type { BtpPersonnelImportRow } from '@/lib/btp/personnel-import';
import { formatCurrency } from '@/lib/utils';
import { Users, Plus, Search, CalendarDays, Upload, Download, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';

interface Row {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  isActive: boolean;
  payrollSource?: string;
  monthlySalary?: number;
  date?: string;
}

interface Props {
  items: Row[];
  sites: Array<{ id: string; name: string }>;
  laborEntries: Array<{
    id: string;
    siteName: string;
    personName: string;
    workDate: string;
    days: number;
    dailyRate: number;
    amount: number;
  }>;
  personnelForLabor: Array<{ id: string; name: string; dailyRate: number; siteName?: string }>;
  isDirector: boolean;
}

async function downloadPersonnelTemplate() {
  const XLSX = await import('xlsx');
  const rows = [
    ['Nom', 'Salaire mensuel (GNF)', 'Fonction'],
    ['Mamadou Diallo', '4500000', 'Maçon'],
    ['Fatoumata Camara', '5200000', 'Chef équipe'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Personnel');
  XLSX.writeFile(wb, 'modele_personnel_btp.xlsx');
}

export function PersonnelClient({
  items: initialItems,
  sites,
  laborEntries,
  personnelForLabor,
  isDirector,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [showLaborForm, setShowLaborForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('none');
  const [laborSiteId, setLaborSiteId] = useState('');
  const [editingLabor, setEditingLabor] = useState<(typeof laborEntries)[0] | null>(null);
  const [personnelId, setPersonnelId] = useState('');
  const [importSiteId, setImportSiteId] = useState('');
  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [previewRows, setPreviewRows] = useState<BtpPersonnelImportRow[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);

  async function handleCreate(formData: FormData) {
    setError(null);
    formData.set('site_id', siteId);
    const result = await createBtpPersonnel(formData);
    if ('error' in result) {
      setError(result.error ?? 'Enregistrement impossible.');
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleLabor(formData: FormData) {
    setError(null);
    formData.set('site_id', laborSiteId);
    formData.set('personnel_id', personnelId);
    const result = await createBtpLaborEntry(formData);
    if ('error' in result) {
      setError(result.error ?? 'Pointage impossible.');
      return;
    }
    setShowLaborForm(false);
    router.refresh();
  }

  async function handleFileSelect(file: File) {
    setError(null);
    setMessage(null);
    const fd = new FormData();
    fd.set('file', file);
    const result = await parseBtpPersonnelImportFile(fd);
    if ('error' in result) {
      setError(result.error);
      setPreviewRows([]);
      return;
    }
    setPreviewRows(result.rows);
    setImportWarnings(result.warnings);
    setImportFileName(file.name);
  }

  async function confirmImport() {
    if (!previewRows.length) return;
    setImporting(true);
    setError(null);
    const result = await importBtpPersonnelFromList({
      rows: previewRows,
      defaultSiteId: importSiteId || null,
      deactivateMissing,
      fileName: importFileName,
    });
    setImporting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setMessage(
      `${result.imported} créé(s), ${result.updated} mis à jour` +
        (result.deactivated > 0 ? `, ${result.deactivated} retiré(s) de la liste active` : '') +
        '. Les salaires sont intégrés aux finances (MO).'
    );
    setShowImport(false);
    setPreviewRows([]);
    router.refresh();
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Retirer ce collaborateur de la liste active ?')) return;
    setError(null);
    const result = await deactivateBtpPersonnel(id);
    if ('error' in result) {
      setError(result.error ?? 'Action impossible.');
      return;
    }
    router.refresh();
  }

  async function handleReactivate(id: string) {
    setError(null);
    const result = await reactivateBtpPersonnel(id);
    if ('error' in result) {
      setError(result.error ?? 'Action impossible.');
      return;
    }
    router.refresh();
  }

  const items = initialItems.filter((i) =>
    i.title.toLowerCase().includes(query.toLowerCase()) || i.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const activeCount = initialItems.filter((i) => i.isActive).length;
  const payrollTotal = initialItems
    .filter((i) => i.isActive && (i.monthlySalary ?? 0) > 0)
    .reduce((s, i) => s + (i.monthlySalary ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Personnel</h1>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">Supabase connecté</Badge>
          </div>
          <p className="text-muted-foreground">
            {activeCount} actif(s)
            {payrollTotal > 0 && ` — masse salariale liste : ${formatCurrency(payrollTotal)}/mois`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isDirector && (
            <>
              <Button variant="outline" onClick={() => downloadPersonnelTemplate()}>
                <Download className="h-4 w-4" /> Modèle Excel
              </Button>
              <Button variant="outline" onClick={() => { setShowImport(!showImport); setShowForm(false); }}>
                <Upload className="h-4 w-4" /> Importer Excel
              </Button>
            </>
          )}
          <Button onClick={() => setShowForm(!showForm)} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
          <Button variant="outline" onClick={() => setShowLaborForm(!showLaborForm)} disabled={personnelForLabor.length === 0}>
            <CalendarDays className="h-4 w-4" /> Pointage
          </Button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-emerald-800 bg-emerald-500/10 border border-emerald-200 rounded-lg px-4 py-3">{message}</p>
      )}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">{error}</p>
      )}

      {showImport && isDirector && (
        <Card>
          <CardHeader><CardTitle>Importer la liste du personnel (Excel / CSV)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Colonnes attendues : <strong>Nom</strong>, <strong>Salaire mensuel (GNF)</strong>, Fonction (optionnel).
              Les salaires sont cumulés en main d&apos;œuvre dans les finances du chantier assigné.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Chantier pour la masse salariale</Label>
                <Select value={importSiteId || 'none'} onValueChange={(v) => setImportSiteId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un chantier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun (non compté par chantier) —</SelectItem>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={deactivateMissing} onCheckedChange={setDeactivateMissing} id="deact-missing" />
                <Label htmlFor="deact-missing">Retirer les employés importés absents du fichier</Label>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelect(f);
              }}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Choisir un fichier
            </Button>
            {importWarnings.length > 0 && (
              <ul className="text-xs text-amber-800 bg-amber-500/10 rounded-lg p-3 space-y-1">
                {importWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {previewRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Nom</th>
                      <th className="text-right p-2">Salaire/mois</th>
                      <th className="text-left p-2">Fonction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.fullName}</td>
                        <td className="p-2 text-right">{formatCurrency(r.monthlySalary)}</td>
                        <td className="p-2 text-muted-foreground">{r.role ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="bg-emerald-700"
                disabled={!previewRows.length || importing || !importSiteId}
                onClick={() => void confirmImport()}
              >
                {importing ? 'Import…' : `Confirmer (${previewRows.length} ligne(s))`}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowImport(false); setPreviewRows([]); }}>Annuler</Button>
            </div>
            {!importSiteId && previewRows.length > 0 && (
              <p className="text-xs text-amber-700">Sélectionnez un chantier pour intégrer les salaires aux finances.</p>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nouveau collaborateur</CardTitle></CardHeader>
          <CardContent>
            <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nom complet *</Label><Input name="full_name" required /></div>
              <div className="space-y-2"><Label>Rôle *</Label><Input name="role" placeholder="Maçon, Chef d'équipe…" required /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input name="phone" /></div>
              <div className="space-y-2"><Label>Salaire mensuel (GNF)</Label><Input name="monthly_salary" type="number" min="0" /></div>
              <div className="space-y-2"><Label>Taux journalier (GNF)</Label><Input name="daily_rate" type="number" min="0" /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="Chantier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Non assigné —</SelectItem>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]">Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showLaborForm && (
        <Card>
          <CardHeader><CardTitle>Pointage main d&apos;oeuvre</CardTitle></CardHeader>
          <CardContent>
            <form action={handleLabor} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Chantier *</Label>
                <Select value={laborSiteId} onValueChange={setLaborSiteId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Collaborateur *</Label>
                <Select value={personnelId} onValueChange={setPersonnelId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {personnelForLabor.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.dailyRate)}/j
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Date *</Label><Input name="work_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div className="space-y-2"><Label>Jours *</Label><Input name="days" type="number" min="0.5" step="0.5" defaultValue="1" required /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Input name="notes" /></div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" className="bg-[#2563EB]" disabled={!laborSiteId || !personnelId}>Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowLaborForm(false)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {laborEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Derniers pointages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {laborEntries.slice(0, 8).map((e) => (
              <div key={e.id} className="flex flex-wrap justify-between gap-2 text-sm border-b pb-2 last:border-0 items-center">
                <span>{e.personName} — {e.siteName}</span>
                <span className="text-muted-foreground">
                  {new Date(e.workDate).toLocaleDateString('fr-FR')} · {e.days} j · {formatCurrency(e.amount)}
                </span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingLabor(e)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                    if (!confirm('Supprimer ce pointage ?')) return;
                    await deleteBtpLaborEntry(e.id);
                    router.refresh();
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {editingLabor && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Modifier le pointage</CardTitle></CardHeader>
          <CardContent>
            <form
              action={async (formData) => {
                formData.set('id', editingLabor.id);
                const res = await updateBtpLaborEntry(formData);
                if (!('error' in res)) {
                  setEditingLabor(null);
                  router.refresh();
                }
              }}
              className="grid gap-3 sm:grid-cols-3"
            >
              <div className="space-y-2">
                <Label>Date</Label>
                <Input name="work_date" type="date" defaultValue={editingLabor.workDate} />
              </div>
              <div className="space-y-2">
                <Label>Jours</Label>
                <Input name="days" type="number" min="0.5" step="0.5" defaultValue={editingLabor.days} />
              </div>
              <div className="space-y-2">
                <Label>Taux journalier</Label>
                <Input name="daily_rate" type="number" min="0" defaultValue={editingLabor.dailyRate} />
              </div>
              <div className="sm:col-span-3 flex gap-2">
                <Button type="submit" size="sm">Enregistrer</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingLabor(null)}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className={!item.isActive ? 'opacity-60' : undefined}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                        {item.payrollSource === 'import' && (
                          <Badge variant="secondary" className="text-[10px]">Liste Excel</Badge>
                        )}
                        {item.date && <span className="text-[10px] text-muted-foreground">{item.date}</span>}
                      </div>
                    </div>
                    {isDirector && (
                      <div className="flex flex-col gap-1">
                        {item.isActive ? (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDeactivate(item.id)} title="Retirer">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleReactivate(item.id)} title="Réactiver">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun personnel enregistré.</p>
            {isDirector && (
              <p className="text-sm text-muted-foreground mt-2">Importez un fichier Excel ou ajoutez manuellement.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
