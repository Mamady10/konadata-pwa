'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  acceptOrganizationDpa,
  setOrganizationKonaAiDisabled,
  type OrgPrivacySettings,
} from '@/lib/actions/org-privacy';
import { DPA_SECTIONS, DPA_TITLE } from '@/lib/legal/dpa';
import { Shield, Bot, FileText, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  canManage: boolean;
  privacy: OrgPrivacySettings | null;
  privacyError?: string;
}

export function ConfidentialiteClient({ canManage, privacy, privacyError }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [aiDisabled, setAiDisabled] = useState(privacy?.konaAiDisabled ?? false);

  function run(action: () => Promise<{ error?: string; success?: boolean }>) {
    startTransition(async () => {
      setMsg(null);
      const res = await action();
      setMsg('error' in res && res.error ? res.error : 'Enregistré.');
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/parametres">
            <ArrowLeft className="h-4 w-4" />
            Paramètres
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Confidentialité &amp; KonaAI
        </h1>
        <p className="text-muted-foreground">
          Isolation des données, désactivation IA et accord de traitement (DPA).
        </p>
      </div>

      {privacyError && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{privacyError}</CardContent>
        </Card>
      )}

      {msg && (
        <p className="text-sm text-muted-foreground">{msg}</p>
      )}

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Désactiver KonaAI (OpenAI)
          </CardTitle>
          <CardDescription>
            Aucun appel externe à OpenAI : pas de chat IA, rapports automatiques ni OCR cloud.
            Les saisies manuelles et tableaux de bord restent disponibles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="kona-ai-disabled" className="font-medium">
                KonaAI désactivé pour mon organisation
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Recommandé si vous ne souhaitez aucun transit de données vers un fournisseur IA.
              </p>
            </div>
            <Switch
              id="kona-ai-disabled"
              checked={aiDisabled}
              disabled={!canManage || pending}
              onCheckedChange={(checked) => {
                setAiDisabled(checked);
                run(() => setOrganizationKonaAiDisabled(checked));
              }}
            />
          </div>
          {!canManage && (
            <p className="text-xs text-muted-foreground mt-3">
              Seul le directeur ou la direction peut modifier ce réglage.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {DPA_TITLE}
              </CardTitle>
              <CardDescription>
                Version {privacy?.currentDpaVersion ?? '2026-06-01'} — sous-traitance KonaData
              </CardDescription>
            </div>
            {privacy?.dpaUpToDate ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Accepté
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                À accepter
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {privacy?.dpaAcceptedAt && (
            <p className="text-xs text-muted-foreground">
              Dernière acceptation :{' '}
              {new Date(privacy.dpaAcceptedAt).toLocaleString('fr-FR')}
              {privacy.dpaVersion && ` (v${privacy.dpaVersion})`}
            </p>
          )}

          <div className="max-h-[420px] overflow-y-auto rounded-lg border bg-muted/20 p-4 space-y-5 text-sm">
            {DPA_SECTIONS.map((section) => (
              <div key={section.id}>
                <h3 className="font-semibold text-foreground">{section.title}</h3>
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-muted-foreground mt-2 leading-relaxed">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {canManage && !privacy?.dpaUpToDate && (
            <Button
              className="bg-[#2563EB]"
              disabled={pending}
              onClick={() => run(() => acceptOrganizationDpa())}
            >
              J&apos;accepte le DPA pour mon organisation
            </Button>
          )}

          {!canManage && !privacy?.dpaUpToDate && (
            <p className="text-sm text-amber-700">
              Le directeur doit accepter le DPA avant toute utilisation de KonaAI.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit technique</CardTitle>
          <CardDescription>
            Vérification automatisée des politiques RLS (équipe technique / CI).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Commande : <code className="bg-muted px-1.5 py-0.5 rounded">npm run audit:rls</code>
          </p>
          <p>
            Contrôle que chaque table avec <code>organization_id</code> a le RLS activé et une
            politique <code>belongs_to_org</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
