'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ClipboardList, Save } from 'lucide-react';
import { updateNgoSurveySettings } from '@/lib/actions/ngo-survey-settings';
import {
  DEFAULT_NGO_SURVEY_SETTINGS,
  type NgoSurveySettings,
} from '@/lib/ngo/survey-settings';

interface Props {
  initialSettings: NgoSurveySettings;
  loadError?: string;
  orgName: string;
}

export function SondagesOngSettingsClient({ initialSettings, loadError, orgName }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [msg, setMsg] = useState<string | null>(loadError ?? null);
  const [loading, setLoading] = useState(false);

  function patch(partial: Partial<NgoSurveySettings>) {
    setSettings((s) => ({ ...s, ...partial }));
  }

  async function handleSave() {
    setLoading(true);
    setMsg(null);
    const res = await updateNgoSurveySettings(settings);
    setLoading(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setMsg('Paramètres sondages enregistrés.');
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/parametres">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Sondages ONG
          </h1>
          <p className="text-muted-foreground">
            {orgName} — programmation et collecte terrain des enquêtes.
          </p>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Module enquêtes
            <Badge variant={settings.enabled ? 'default' : 'secondary'}>
              {settings.enabled ? 'Activé par KonaData' : 'Désactivé par KonaData'}
            </Badge>
          </CardTitle>
          <CardDescription>
            L&apos;activation du module sondages et du forfait est gérée par KonaData. Contactez le support pour toute modification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Statut actuel</p>
            <p className="mt-1">
              Sondages : <strong>{settings.enabled ? 'autorisés' : 'suspendus'}</strong>
              {' · '}
              Devis CEO avant activation : <strong>{settings.require_survey_payment ? 'oui' : 'non'}</strong>
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">GPS obligatoire</p>
              <p className="text-sm text-muted-foreground">Les agents doivent partager leur position.</p>
            </div>
            <Switch
              checked={settings.require_gps}
              onCheckedChange={(v) => patch({ require_gps: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Collecte hors-ligne (PWA)</p>
              <p className="text-sm text-muted-foreground">Prévu pour le terrain sans réseau stable.</p>
            </div>
            <Switch
              checked={settings.allow_offline_collection}
              onCheckedChange={(v) => patch({ allow_offline_collection: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Clôture auto à l&apos;objectif</p>
              <p className="text-sm text-muted-foreground">
                Ferme le sondage quand le nombre de réponses cible est atteint.
              </p>
            </div>
            <Switch
              checked={settings.auto_close_when_target_reached}
              onCheckedChange={(v) => patch({ auto_close_when_target_reached: v })}
            />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="font-medium">Facturation campagne (hors abonnement)</p>
            <p className="text-sm text-muted-foreground">
              Chaque sondage fait l&apos;objet d&apos;un devis validé par le CEO KonaData. L&apos;ONG ne peut pas modifier cette règle.
            </p>
            <p className="text-sm">
              Devis CEO obligatoire avant activation :{' '}
              <Badge variant="outline">{settings.require_survey_payment ? 'Oui' : 'Non'}</Badge>
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <p className="font-medium">Sécurité participation en ligne</p>
            <p className="text-sm text-muted-foreground">
              Sans compte participant : OTP téléphone, un appareil = une réponse, limites IP et alertes
              anomalies.
            </p>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Une participation par appareil</p>
                <p className="text-xs text-muted-foreground">Cookie + empreinte navigateur.</p>
              </div>
              <Switch
                checked={settings.one_per_device}
                onCheckedChange={(v) => patch({ one_per_device: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Vérification OTP téléphone</p>
                <p className="text-xs text-muted-foreground">SMS ou WhatsApp avant le formulaire.</p>
              </div>
              <Switch
                checked={settings.require_phone_otp}
                onCheckedChange={(v) => patch({ require_phone_otp: v })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Canal OTP</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={settings.otp_channel}
                  onChange={(e) =>
                    patch({ otp_channel: e.target.value as 'sms' | 'whatsapp' })
                  }
                >
                  <option value="sms">SMS (Twilio)</option>
                  <option value="whatsapp">WhatsApp Business</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device_lock_days">Verrou appareil (jours)</Label>
                <Input
                  id="device_lock_days"
                  type="number"
                  min={1}
                  max={365}
                  value={settings.device_lock_days}
                  onChange={(e) =>
                    patch({
                      device_lock_days: Math.min(365, Math.max(1, Number(e.target.value) || 30)),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate_otp">Max demandes OTP / IP / h</Label>
                <Input
                  id="rate_otp"
                  type="number"
                  min={1}
                  max={100}
                  value={settings.rate_limit_otp_per_ip_hour}
                  onChange={(e) =>
                    patch({
                      rate_limit_otp_per_ip_hour: Math.min(
                        100,
                        Math.max(1, Number(e.target.value) || 5)
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate_submit">Max soumissions / IP / h</Label>
                <Input
                  id="rate_submit"
                  type="number"
                  min={1}
                  max={500}
                  value={settings.rate_limit_submit_per_ip_hour}
                  onChange={(e) =>
                    patch({
                      rate_limit_submit_per_ip_hour: Math.min(
                        500,
                        Math.max(1, Number(e.target.value) || 30)
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anomaly_min">Alerte : réponses / minute</Label>
                <Input
                  id="anomaly_min"
                  type="number"
                  min={5}
                  max={500}
                  value={settings.anomaly_responses_per_minute}
                  onChange={(e) =>
                    patch({
                      anomaly_responses_per_minute: Math.min(
                        500,
                        Math.max(5, Number(e.target.value) || 20)
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anomaly_zone">Alerte : même choix + zone</Label>
                <Input
                  id="anomaly_zone"
                  type="number"
                  min={3}
                  max={200}
                  value={settings.anomaly_same_choice_zone_count}
                  onChange={(e) =>
                    patch({
                      anomaly_same_choice_zone_count: Math.min(
                        200,
                        Math.max(3, Number(e.target.value) || 15)
                      ),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default_region">Région par défaut</Label>
              <Input
                id="default_region"
                value={settings.default_region ?? ''}
                onChange={(e) => patch({ default_region: e.target.value || null })}
                placeholder="Ex. Conakry"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_active">Sondages actifs max.</Label>
              <Input
                id="max_active"
                type="number"
                min={1}
                max={50}
                value={settings.max_active_surveys}
                onChange={(e) =>
                  patch({ max_active_surveys: Math.min(50, Math.max(1, Number(e.target.value) || 5)) })
                }
              />
            </div>
          </div>

          {msg && (
            <p
              className={`text-sm rounded-lg px-3 py-2 ${
                msg.includes('enregistr') || msg.includes('Migration')
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : 'text-destructive bg-destructive/10'
              }`}
            >
              {msg}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={loading} className="bg-[#2563EB]">
              <Save className="h-4 w-4 mr-1" />
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSettings(DEFAULT_NGO_SURVEY_SETTINGS)}>
              Réinitialiser
            </Button>
            <Button variant="outline" asChild>
              <Link href="/ong/sondages">Voir les sondages</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
