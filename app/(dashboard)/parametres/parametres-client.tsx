'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/contexts/app-context';
import { updateProfile } from '@/lib/actions/profile';
import { ROLE_LABELS, ORG_TYPE_LABELS } from '@/types/database';
import type { OrganizationType } from '@/types/database';
import type { AiQuotaStatus } from '@/lib/actions/ai-quota';
import { AI_CREDIT_COSTS } from '@/lib/ai/quota/credit-costs';
import Link from 'next/link';
import {
  Save,
  Moon,
  Bell,
  Globe,
  Shield,
  CheckCircle2,
  Sparkles,
  CreditCard,
  GraduationCap,
  FileText,
  Building2,
  Hash,
  ClipboardList,
  Bot,
  Eye,
  Zap,
  CalendarRange,
} from 'lucide-react';
import { useActionState } from 'react';

interface Props {
  phone?: string | null;
  isPlatformAdmin?: boolean;
  canManageTemplates?: boolean;
  canManageBilling?: boolean;
  canManageStudentPayments?: boolean;
  canManageMatricules?: boolean;
  canManageBulletinTemplate?: boolean;
  canManageNgoSurveys?: boolean;
  aiQuota?: AiQuotaStatus | null;
  aiQuotaError?: string;
  konaAiDisabled?: boolean;
  dpaUpToDate?: boolean;
  canManagePrivacy?: boolean;
}

function QuotaBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const depleted = total > 0 && used >= total;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {used} / {total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            depleted ? 'bg-destructive' : pct > 85 ? 'bg-amber-500' : 'bg-[#2563EB]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ParametresClient({
  phone,
  isPlatformAdmin,
  canManageTemplates,
  canManageBilling,
  canManageStudentPayments,
  canManageMatricules,
  canManageBulletinTemplate,
  canManageNgoSurveys,
  aiQuota,
  aiQuotaError,
  konaAiDisabled,
  dpaUpToDate,
  canManagePrivacy,
}: Props) {
  const { darkMode, toggleDarkMode, user, organization, refreshUser } = useApp();
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await updateProfile(formData);
      if (result.success) await refreshUser();
      return result;
    },
    null
  );

  const orgType = (organization?.type ?? organization?.organization_type) as OrganizationType | undefined;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          {isPlatformAdmin && !organization
            ? 'Compte CEO KonaData — gestion plateforme'
            : 'Configuration de votre compte et de la plateforme'}
        </p>
      </div>

      {isPlatformAdmin && !organization && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Espace CEO KonaData
            </CardTitle>
            <CardDescription>
              Votre compte n&apos;est rattaché à aucune école ou organisation. Les réglages
              d&apos;établissement (facturation, bulletins, paiements élèves) se gèrent depuis le
              compte directeur de chaque organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild className="bg-[#2563EB]">
              <Link href="/organisations">Gérer les organisations</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Tableau de bord plateforme</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageNgoSurveys && (
        <Card className="border-teal-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-teal-600" />
              Sondages terrain (ONG)
            </CardTitle>
            <CardDescription>
              Programmer des enquêtes, assigner des agents et suivre les réponses par région.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-teal-600/40">
              <Link href="/parametres/sondages-ong">Configurer les sondages ONG</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageBulletinTemplate && orgType === 'school' && (
        <Card className="border-primary/30 bg-primary/[0.02]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              Parcours directeur — scolarité
            </CardTitle>
            <CardDescription>
              Ordre recommandé : classes → tarifs année → paiements familles → import élèves. L&apos;abonnement
              KonaData (plateforme) est distinct des frais versés par les familles.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/parametres/annee-scolaire">1. Année scolaire & tarifs</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/parametres/paiements-eleves">2. Paiements élèves</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/etablissement/formations">3. Classes & frais</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/etablissement/paiements">4. Journal encaissements</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageMatricules && (
        <Card className="border-violet-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-violet-600" />
              Codes élève KonaData
            </CardTitle>
            <CardDescription>
              Format des identifiants générés à l&apos;import et export pour les familles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-violet-600/40">
              <Link href="/parametres/codes-eleves">Configurer les codes élève</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageBulletinTemplate && (
        <Card className="border-indigo-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-indigo-600" />
              Année scolaire
            </CardTitle>
            <CardDescription>
              Clôturer l&apos;année en cours et ouvrir le cycle suivant (classes, candidatures,
              bulletins).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-indigo-600/40">
              <Link href="/parametres/annee-scolaire">Gérer les années scolaires</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageBulletinTemplate && (
        <Card className="border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Modèle bulletin PDF
            </CardTitle>
            <CardDescription>
              Joignez votre bulletin officiel (PDF/Word) et personnalisez la mise en page des
              téléchargements depuis les notes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-blue-600/40">
              <Link href="/parametres/bulletin">Personnaliser le bulletin</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageBulletinTemplate && (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              Export MEPS / MEPPSA
            </CardTitle>
            <CardDescription>
              Code établissement, commune, préfecture et circonscription pour le CSV ministériel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-emerald-600/40">
              <Link href="/parametres/meps">Configurer l&apos;export MEPS</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageStudentPayments && (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              Paiements élèves (scolarité)
            </CardTitle>
            <CardDescription>
              Activer les frais d&apos;inscription, de réinscription et de scolarité payables en ligne
              par les familles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-emerald-600/40">
              <Link href="/parametres/paiements-eleves">Configurer les paiements élèves</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!(isPlatformAdmin && !organization) && (
      <Card className="border-slate-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-600" />
            Confidentialité &amp; KonaAI
          </CardTitle>
          <CardDescription>
            Désactiver l&apos;IA externe, accepter le DPA et consulter les crédits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {konaAiDisabled && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900">
              KonaAI est <strong>désactivé</strong> pour votre organisation — aucun appel OpenAI.
            </div>
          )}
          {!dpaUpToDate && !konaAiDisabled && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              Acceptez le DPA avant d&apos;utiliser KonaAI (chat, rapports, OCR).
            </div>
          )}
          <Button asChild variant="outline">
            <Link href="/parametres/confidentialite">
              <Shield className="h-4 w-4" />
              Confidentialité, DPA &amp; toggle IA
            </Link>
          </Button>
        </CardContent>
      </Card>
      )}

      {!(isPlatformAdmin && !organization) && (
      <Card className="border-violet-500/30">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-600" />
                Crédits KonaAI
              </CardTitle>
              <CardDescription>
                Quota mensuel OpenAI de votre organisation (chat, rapports, OCR manuscrit).
              </CardDescription>
            </div>
            {aiQuota && (
              <Badge
                variant="secondary"
                className={
                  aiQuota.tier === 'premium' || aiQuota.tier === 'platform'
                    ? 'bg-violet-500/10 text-violet-700 border-violet-200'
                    : aiQuota.tier === 'trial'
                      ? 'bg-sky-500/10 text-sky-700 border-sky-200'
                      : aiQuota.tier === 'essentiel'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                }
              >
                {aiQuota.tierLabel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiQuotaError && (
            <p className="text-sm text-destructive">
              Impossible de charger le quota : {aiQuotaError}
            </p>
          )}
          {!aiQuotaError && !aiQuota && (
            <p className="text-sm text-muted-foreground">Quota non disponible.</p>
          )}
          {konaAiDisabled && (
            <p className="text-sm text-muted-foreground">
              Quota affiché à titre informatif — KonaAI est coupé au niveau organisation.
            </p>
          )}
          {aiQuota && (
            <>
              {aiQuota.description && (
                <p className="text-sm text-muted-foreground">{aiQuota.description}</p>
              )}
              {aiQuota.creditsTotal === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Votre offre actuelle est <strong>Essentiel (sans IA)</strong>. L&apos;assistant
                  KonaAI (chat, rapports automatiques, OCR) sera proposé dans une prochaine version.
                </div>
              ) : (
                <>
                  <QuotaBar
                    used={aiQuota.creditsUsed}
                    total={aiQuota.creditsTotal}
                    label={`Crédits — période ${aiQuota.period}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    <Zap className="inline h-3 w-3 mr-1" />
                    {aiQuota.creditsRemaining} crédit{aiQuota.creditsRemaining !== 1 ? 's' : ''}{' '}
                    restant{aiQuota.creditsRemaining !== 1 ? 's' : ''}
                    {aiQuota.bonusCredits > 0 && ` (dont ${aiQuota.bonusCredits} bonus CEO)`}
                  </p>
                  {aiQuota.maxRequestsPerDay > 0 && (
                    <QuotaBar
                      used={aiQuota.requestsToday}
                      total={aiQuota.maxRequestsPerDay}
                      label="Requêtes aujourd'hui"
                    />
                  )}
                  {aiQuota.visionEnabled && aiQuota.visionPagesLimit > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        Pages OCR / Vision ce mois : {aiQuota.visionPagesUsed} /{' '}
                        {aiQuota.visionPagesLimit}
                      </div>
                      <QuotaBar
                        used={aiQuota.visionPagesUsed}
                        total={aiQuota.visionPagesLimit}
                        label="Pages Vision"
                      />
                    </div>
                  )}
                  {!aiQuota.visionEnabled && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Eye className="h-3 w-3" />
                      OCR manuscrit (Vision) non inclus dans cette offre.
                    </p>
                  )}
                </>
              )}
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Coût par action</p>
                <p>
                  Chat {AI_CREDIT_COSTS.chat} · Index document {AI_CREDIT_COSTS.document_index} ·
                  Bulletin scanné {AI_CREDIT_COSTS.parse_bulletin} · Page Vision{' '}
                  {AI_CREDIT_COSTS.vision_page} · Modèle IA {AI_CREDIT_COSTS.template_adapt} ·
                  Rapport {AI_CREDIT_COSTS.report}
                </p>
                <p className="italic">
                  Ex. bulletin manuscrit complet ≈ {AI_CREDIT_COSTS.vision_page} (scan) +{' '}
                  {AI_CREDIT_COSTS.parse_bulletin} (lecture) + {AI_CREDIT_COSTS.report} (production)
                  = {AI_CREDIT_COSTS.vision_page + AI_CREDIT_COSTS.parse_bulletin + AI_CREDIT_COSTS.report}{' '}
                  crédits
                </p>
              </div>
              {canManageBilling && aiQuota.creditsTotal === 0 && (
                <Button asChild variant="outline" className="border-violet-600/40">
                  <Link href="/parametres/facturation">Activer KonaAI — voir facturation</Link>
                </Button>
              )}
              {canManageBilling &&
                aiQuota.creditsTotal > 0 &&
                aiQuota.creditsRemaining < aiQuota.creditsTotal * 0.15 && (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/parametres/facturation">Voir la facturation</Link>
                  </Button>
                )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {canManageBilling && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-600" />
              Facturation KonaData
            </CardTitle>
            <CardDescription>
              {orgType === 'school'
                ? 'Abonnement plateforme annuel (forfait + élèves inscrits). Scolarité élèves : réglages séparés.'
                : 'Abonnement mensuel pour accéder au module (BTP, ONG ou PME).'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/parametres/facturation">Gérer la facturation</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageTemplates && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Modèles IA pour vos documents
            </CardTitle>
            <CardDescription>
              Types standards ou types personnalisés par organisation — joignez un modèle IA par type
              pour guider vos équipes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-[#2563EB]">
              <Link href="/parametres/modeles">Configurer les modèles</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Profil</CardTitle>
              <CardDescription>Informations de votre compte Supabase</CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
              Supabase connecté
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input id="full_name" name="full_name" defaultValue={user?.name ?? ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ''} disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" defaultValue={phone ?? ''} placeholder="+224 622 00 00 00" />
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Input value={user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '—'} disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Input
                value={
                  organization?.name
                    ? `${organization.name}${orgType ? ` (${ORG_TYPE_LABELS[orgType] ?? orgType})` : ''}`
                    : '—'
                }
                disabled
              />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state?.success && (
              <p className="text-sm text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Profil enregistré
              </p>
            )}
            <Button type="submit" className="bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={pending}>
              <Save className="h-4 w-4" />
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apparence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Mode sombre</p>
                <p className="text-sm text-muted-foreground">Basculer entre thème clair et sombre</p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Alertes email', desc: 'Recevoir les alertes par email', default: true },
            { label: 'Notifications push', desc: 'Notifications dans le navigateur', default: true },
            { label: 'Rapports hebdomadaires', desc: 'Résumé hebdomadaire par email', default: false },
          ].map((notif) => (
            <div key={notif.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{notif.label}</p>
                  <p className="text-xs text-muted-foreground">{notif.desc}</p>
                </div>
              </div>
              <Switch defaultChecked={notif.default} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intégrations</CardTitle>
          <CardDescription>Services connectés à KonaData</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: 'Supabase', desc: 'Base de données et authentification — actif', icon: Shield, active: true },
            { name: 'OpenAI', desc: 'Intelligence artificielle KonaAI', icon: Globe, active: false },
            { name: 'WhatsApp API', desc: 'Notifications WhatsApp Business', icon: Bell, active: false },
          ].map((integration) => (
            <div key={integration.name}>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <integration.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.desc}</p>
                  </div>
                </div>
                <Badge variant={integration.active ? 'default' : 'outline'}>
                  {integration.active ? 'Connecté' : 'À configurer'}
                </Badge>
              </div>
              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
