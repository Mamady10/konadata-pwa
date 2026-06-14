'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, ArrowRight, AlertCircle, Phone } from 'lucide-react';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { phoneToSyntheticEmail } from '@/lib/auth/phone-email';
import { normalizeGuineaPhone } from '@/lib/survey/phone';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrganizationType } from '@/types/database';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import { ensureLearnerProfile } from '@/lib/auth/learner-signup';
import type { AppRole } from '@/types/database';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { KonaDataLogo } from '@/components/brand/konadata-logo';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';

interface LoginFormProps {
  /** Affiché après déconnexion depuis « Changer de compte ». */
  accountSwitched?: boolean;
}

export default function LoginForm({ accountSwitched = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect') || '';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixingLearner, setFixingLearner] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
      window.location.replace(`/reset-password${hash}`);
      return;
    }
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      window.location.replace(`/auth/confirm?code=${encodeURIComponent(code)}&next=/reset-password`);
    }
  }, []);

  async function handleResetToLearnerPath() {
    setFixingLearner(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Connectez-vous d’abord, ou créez un compte sur la page Candidat / élève.');
      setFixingLearner(false);
      return;
    }
    const { error: rpcError } = await ensureLearnerProfile(supabase);
    if (rpcError) {
      setError(
        rpcError + ' — exécutez la migration 028 dans Supabase (voir sql-editor/028).'
      );
      setFixingLearner(false);
      return;
    }
    window.location.href = LANDING_LINKS.inscriptionEtablissement;
  }

  async function handlePhoneSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const phoneRaw = String(formData.get('phone') ?? '').trim();
      const password = String(formData.get('password') ?? '');
      const phoneE164 = normalizeGuineaPhone(phoneRaw);
      if (!phoneE164) {
        setError('Numéro invalide. Format : 6XX XX XX XX (Guinée).');
        return;
      }

      const supabase = createClient();
      const email = phoneToSyntheticEmail(phoneE164);
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(
          authError.message.toLowerCase().includes('invalid login')
            ? 'Numéro ou mot de passe incorrect. Utilisez « Mot de passe oublié » si besoin.'
            : authError.message
        );
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id, role, onboarding_path, organizations(type)')
          .eq('id', user.id)
          .single();

        const accountIntent = user.user_metadata?.account_intent as string | undefined;
        const orgType = (profile?.organizations as { type?: OrganizationType } | null)?.type;
        const hasEnrollmentHistory = await learnerHasEnrollmentHistory(supabase, user.id);
        const destination = resolvePostAuthDestination({
          organizationId: profile?.organization_id,
          role: profile?.role as AppRole | undefined,
          orgType,
          accountIntent,
          onboardingPath: profile?.onboarding_path as string | undefined,
          redirectParam,
          hasEnrollmentHistory,
        });

        router.refresh();
        window.location.replace(destination);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).trim();
    const password = formData.get('password') as string;

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        setError(
          'Compte non confirmé. Utilisez « Mot de passe oublié » pour recevoir un lien par email.'
        );
      } else if (msg.includes('invalid login credentials')) {
        setError(
          'Email ou mot de passe incorrect. Utilisez « Mot de passe oublié » pour réinitialiser.'
        );
      } else {
        setError(authError.message);
      }
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      let { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role, onboarding_path, organizations(type)')
        .eq('id', user.id)
        .single();

      const accountIntent = user.user_metadata?.account_intent as string | undefined;

      const orgType = (profile?.organizations as { type?: OrganizationType } | null)?.type;
      const hasEnrollmentHistory = await learnerHasEnrollmentHistory(supabase, user.id);
      const destination = resolvePostAuthDestination({
        organizationId: profile?.organization_id,
        role: profile?.role as AppRole | undefined,
        orgType,
        accountIntent,
        onboardingPath: profile?.onboarding_path as string | undefined,
        redirectParam,
        hasEnrollmentHistory,
      });

      router.refresh();
      window.location.replace(destination);
      return;
    }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A192F] relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB]/20 to-transparent" />
        <div className="relative z-10 max-w-md">
          <div className="mb-8">
            <KonaDataLogo href={`${LANDING_LINKS.home}?accueil=1`} variant="wordmark" height={48} priority />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Gérez vos données avec intelligence
          </h1>
          <p className="text-white/60 text-lg leading-relaxed">
            Plateforme SaaS multi-tenant pour établissements, ONG, BTP et PME — sécurisée par Supabase.
          </p>
          <div className="mt-8 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm text-emerald-400 font-medium">IA Connectée — KonaAI actif</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-4">
            <AuthBackHome />
          </div>
          <div className="lg:hidden flex items-center justify-center mb-8">
            <KonaDataLogo href={`${LANDING_LINKS.home}?accueil=1`} variant="wordmark" height={36} />
          </div>

          <Card className="border-0 shadow-card-hover">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Connexion</CardTitle>
              <CardDescription>Accédez à votre espace KonaData</CardDescription>
            </CardHeader>
            <CardContent>
              {accountSwitched && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  Session précédente fermée. Connectez-vous avec le compte souhaité.
                </div>
              )}
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />
              {authMethod === 'phone' ? (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-phone">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-phone" name="phone" type="tel" placeholder="6XX XX XX XX" className="pl-9" required autoComplete="tel" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-phone-password">Mot de passe</Label>
                      <Link href={LANDING_LINKS.forgotPassword} className="text-xs text-primary hover:underline">
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-phone-password" name="password" type="password" placeholder="••••••••" className="pl-9" required autoComplete="current-password" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={loading}>
                    {loading ? 'Connexion...' : 'Se connecter'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" name="email" type="email" placeholder="director@isc.gn" className="pl-9" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Link href={LANDING_LINKS.forgotPassword} className="text-xs text-primary hover:underline">
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" name="password" type="password" placeholder="••••••••" className="pl-9" required />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={loading}>
                  {loading ? 'Connexion...' : 'Se connecter'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
              )}
              <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
                <p>
                  Direction ?{' '}
                  <Link href={LANDING_LINKS.registerOrganization} className="text-primary font-medium hover:underline">
                    Créer une organisation
                  </Link>
                </p>
                <p>
                  Candidat / élève ?{' '}
                  <Link href={LANDING_LINKS.registerLearner} className="text-primary font-medium hover:underline">
                    Inscription en ligne
                  </Link>
                </p>
                <p>
                  Collaborateur ?{' '}
                  <Link href={LANDING_LINKS.rejoindre} className="text-primary font-medium hover:underline">
                    Code d&apos;accès
                  </Link>
                </p>
                <p className="pt-2 border-t border-dashed">
                  <button
                    type="button"
                    className="text-primary font-medium hover:underline text-left"
                    disabled={fixingLearner}
                    onClick={handleResetToLearnerPath}
                  >
                    {fixingLearner
                      ? 'Correction…'
                      : 'Je suis candidat/élève mais je vois le tableau Direction → corriger'}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
