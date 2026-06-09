'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, BadgeCheck, Download, Hash, Save } from 'lucide-react';
import {
  exportStudentMatriculesCsv,
  updateStudentMatriculeSettings,
} from '@/lib/actions/student-matricules';
import {
  DEFAULT_STUDENT_MATRICULE_SETTINGS,
  matriculeFormatExample,
  type MatriculeFormat,
  type StudentMatriculeSettings,
} from '@/lib/school/student-matricules';

interface Props {
  initialSettings: StudentMatriculeSettings;
  loadError?: string;
  orgName: string;
}

export function CodesElevesClient({ initialSettings, loadError, orgName }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [msg, setMsg] = useState<string | null>(loadError ?? null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  function patch(partial: Partial<StudentMatriculeSettings>) {
    setSettings((s) => ({ ...s, ...partial }));
  }

  async function handleSave() {
    setLoading(true);
    setMsg(null);
    const res = await updateStudentMatriculeSettings(settings);
    setLoading(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setMsg('Réglages enregistrés. Les prochains imports utiliseront ce format.');
  }

  async function handleExport() {
    setExporting(true);
    setMsg(null);
    const res = await exportStudentMatriculesCsv();
    setExporting(false);
    if ('error' in res) {
      setMsg(res.error);
      return;
    }
    const blob = new Blob(['\uFEFF', res.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Export téléchargé — chaque code correspond à l’élève indiqué dans le fichier.');
  }

  const example = matriculeFormatExample(settings);

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/parametres">
          <ArrowLeft className="h-4 w-4" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Hash className="h-7 w-7 text-primary" />
          Codes élève KonaData
        </h1>
        <p className="text-muted-foreground">
          {orgName} — identifiants stables pour paiements, reçus et portail familles.
        </p>
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" />
            Cohérence des données
          </CardTitle>
          <CardDescription>
            Chaque code est enregistré une seule fois sur la fiche élève (<code>school_students.matricule</code>).
            Une fois attribué, il reste lié au même élève dans les paiements, reçus et le portail{' '}
            <Link href="/payer-scolarite" className="text-primary underline">
              /payer-scolarite
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Génération à l&apos;import</CardTitle>
          <CardDescription>
            Si la liste ne contient pas de matricule, KonaData attribue automatiquement un code unique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Générer les codes manquants à l&apos;import</Label>
              <p className="text-xs text-muted-foreground">Recommandé pour les établissements sans matricule interne.</p>
            </div>
            <Switch
              checked={settings.auto_generate_on_import}
              onCheckedChange={(v) => patch({ auto_generate_on_import: v })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={settings.format}
                onValueChange={(v) => patch({ format: v as MatriculeFormat })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class_year_seq">Classe + année + numéro (ex. 6A-26-001)</SelectItem>
                  <SelectItem value="org_year_seq">Établissement + année + numéro (ex. LYC-KAL-26-001)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Longueur du numéro</Label>
              <Select
                value={String(settings.seq_pad)}
                onValueChange={(v) => patch({ seq_pad: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 chiffres (01…99)</SelectItem>
                  <SelectItem value="3">3 chiffres (001…999)</SelectItem>
                  <SelectItem value="4">4 chiffres</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {settings.format === 'org_year_seq' && (
            <div className="space-y-2">
              <Label>Préfixe établissement</Label>
              <Input
                value={settings.org_prefix ?? ''}
                onChange={(e) => patch({ org_prefix: e.target.value || null })}
                placeholder="LYC-KAL"
              />
              <p className="text-xs text-muted-foreground">
                Laisser vide pour utiliser les premières lettres du nom de l&apos;établissement.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Libellé affiché aux familles</Label>
            <Input
              value={settings.display_label}
              onChange={(e) => patch({ display_label: e.target.value })}
            />
          </div>

          <p className="text-sm rounded-md bg-muted p-3">
            Exemple pour la prochaine attribution : <strong className="font-mono">{example}</strong>
          </p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={loading} className="bg-[#2563EB]">
              <Save className="h-4 w-4" />
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettings(DEFAULT_STUDENT_MATRICULE_SETTINGS)}
            >
              Réinitialiser le format
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Élèves déjà enregistrés sans code</CardTitle>
          <CardDescription>
            Si des élèves ont été ajoutés avant l&apos;activation des codes automatiques, attribuez-les
            en masse depuis la liste élèves ou le tableau de bord établissement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/etablissement/etudiants">Attribuer les codes en masse</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export pour les familles</CardTitle>
          <CardDescription>
            Téléchargez la liste nom + code élève par classe — à afficher en classe ou envoyer aux parents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Export…' : 'Exporter les codes élèves (CSV)'}
          </Button>
        </CardContent>
      </Card>

      {msg && <p className="text-sm font-medium">{msg}</p>}
    </div>
  );
}
