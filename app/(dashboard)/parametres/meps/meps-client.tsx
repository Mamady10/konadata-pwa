'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import { updateMepsSettings } from '@/lib/actions/school-settings';
import {
  MEPS_EDUCATION_LEVELS,
  type SchoolMepsSettings,
} from '@/lib/school/meps-settings';

interface Props {
  initialSettings: SchoolMepsSettings;
  orgName: string;
  loadError?: string;
}

export function MepsSettingsClient({ initialSettings, orgName, loadError }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [msg, setMsg] = useState<string | null>(loadError ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setMsg(null);
    const res = await updateMepsSettings(settings);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else setMsg('Paramètres MEPS enregistrés.');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/parametres">
          <ArrowLeft className="h-4 w-4" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Export MEPS / MEPPSA
        </h1>
        <p className="text-muted-foreground">
          Identifiants officiels de {orgName || 'votre établissement'} pour la fiche statistique
          ministérielle.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identification établissement</CardTitle>
          <CardDescription>
            Ces champs apparaissent en en-tête du CSV exporté depuis Rapports établissement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Code établissement</Label>
            <Input
              value={settings.establishment_code}
              onChange={(e) =>
                setSettings((s) => ({ ...s, establishment_code: e.target.value }))
              }
              placeholder="Ex. GN-CON-042"
            />
          </div>
          <div className="space-y-2">
            <Label>Commune</Label>
            <Input
              value={settings.commune}
              onChange={(e) => setSettings((s) => ({ ...s, commune: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Préfecture</Label>
            <Input
              value={settings.prefecture}
              onChange={(e) => setSettings((s) => ({ ...s, prefecture: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Circonscription scolaire</Label>
            <Input
              value={settings.circonscription}
              onChange={(e) =>
                setSettings((s) => ({ ...s, circonscription: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Niveau d&apos;enseignement</Label>
            <Select
              value={settings.education_level}
              onValueChange={(v) => setSettings((s) => ({ ...s, education_level: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEPS_EDUCATION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button className="bg-[#2563EB]" onClick={handleSave} disabled={loading}>
        <Save className="h-4 w-4" />
        Enregistrer
      </Button>

      {msg && (
        <p
          className={`text-sm ${msg.includes('enregistré') ? 'text-emerald-700' : 'text-destructive'}`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
