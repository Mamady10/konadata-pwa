'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Mail, Lock, User, Building2, ArrowRight, AlertCircle, KeyRound, GraduationCap } from 'lucide-react';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { PhoneOtpPanel } from '@/components/auth/phone-otp-panel';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { completeOrganizationRegistration } from '@/lib/actions/org-registration';
import { ORG_REGISTRATION_SUCCESS_PATH } from '@/lib/org/org-registration-shared';
import { createClient } from '@/lib/supabase/client';
import { redeemAccessCodeClient } from '@/lib/auth/redeem-access-code-client';
import { ORG_TYPE_LABELS, type OrganizationType } from '@/types/database';
import {
  clearPendingAccessCode,
  getPendingAccessCode,
  homeForOrgType,
} from '@/lib/auth/join-flow';
import { ensureLearnerProfile } from '@/lib/auth/learner-signup';
import { OrgRegistrationFields } from '@/components/auth/org-registration-fields';

type RegisterMode = 'create' | 'join' | 'learner';

function modeFromSearchParams(params: { get: (key: string) => string | null }): RegisterMode {
  const m = params.get('mode');
  if (m === 'join') return 'join';
  if (m === 'learner') return 'learner';
  if (m === 'create') return 'create';
  return 'create';
}

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orgType, setOrgType] = useState<OrganizationType>('school');
  const [mode, setMode] = useState<RegisterMode>(() => modeFromSearchParams(searchParams));
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [fullName, setFullName] = useState('');
  const formElRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    setMode(modeFromSearchParams(searchParams));
    setPendingCode(getPendingAccessCode());
  }, [searchParams]);

  function setRegisterMode(next: RegisterMode) {
    setMode(next);
    const href =
      next === 'join'
        ? LANDING_LINKS.registerJoin
        : next === 'learner'
          ? LANDING_LINKS.registerLearner
          : LANDING_LINKS.registerOrganization;
    router.replace(href);
  }

  async function finishJoinAfterAuth(name: string) {
    const pendingCode = getPendingAccessCode();
    if (!pendingCode) {
      setError('Code d\'accès manquant. Retournez sur /rejoindre pour le saisir.');
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
    }
    const result = await redeemAccessCodeClient(pendingCode);
    if (result.error) {
      setError(result.error);
      return;
    }
    clearPendingAccessCode();
    window.location.href = homeForOrgType(result.organizationType);
  }

  async function finishLearnerAfterAuth(name: string) {
    const supabase = createClient();
    const rpc1 = await ensureLearnerProfile(supabase);
    if (rpc1.error) {
      setError(rpc1.error);
      return;
    }
    if (name) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
      }
    }
    window.location.href = LANDING_LINKS.inscriptionEtablissement;
  }

  async function finishOrganizationAfterAuth(form: HTMLFormElement, name: string) {
    const supabase = createClient();
    const formData = new FormData(form);
    formData.set('organization_type', orgType);
    formData.set('full_name', name);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) formData.set('email', user.email);
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user?.id ?? '')
      .maybeSingle();
    if (profile?.phone && !formData.get('declared_phone')) {
      formData.set('declared_phone', profile.phone as string);
    }

    const result = await completeOrganizationRegistration(formData);
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    if ('success' in result && result.success) {
      window.location.href = result.redirectTo;
    }
  }

  function accountIntentForMode(m: RegisterMode): string {
    if (m === 'learner') return 'learner';
    if (m === 'join') return 'staff';
    return 'director';
  }

  async function handlePhoneVerified() {
    setError(null);
    setLoading(true);
    const name = fullName.trim();
    if (!name) {
      setError('Indiquez votre nom complet.');
      setLoading(false);
      return;
    }
    const effectiveMode =
      searchParams.get('mode') === 'learner' ? 'learner' : mode;

    try {
      if (effectiveMode === 'join') {
        await finishJoinAfterAuth(name);
        return;
      }
      if (effectiveMode === 'learner') {
        await finishLearnerAfterAuth(name);
        return;
      }
      if (effectiveMode === 'create') {
        const form = formElRef.current;
        if (!form) {
          setError('Formulaire introuvable.');
          return;
        }
        await finishOrganizationAfterAuth(form, name);
      }
    } finally {
      setLoading(false);
    }
  }

  async function completeJoinWithCode(email: string, password: string, fullName: string) {
    const pendingCode = getPendingAccessCode();
    if (!pendingCode) {
      setError('Code d\'accès manquant. Retournez sur /rejoindre pour le saisir.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_intent: 'staff' },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/rejoindre`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id);
    }

    let hasSession = Boolean(data.session);

    if (!hasSession) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) hasSession = true;
    }

    if (!hasSession) {
      setInfo(
        `Compte créé pour ${email}. Un email de confirmation Supabase a peut-être été envoyé — cliquez le lien avant de vous connecter.`
      );
      setLoading(false);
      return;
    }

    const result = await redeemAccessCodeClient(pendingCode);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    clearPendingAccessCode();
    window.location.href = homeForOrgType(result.organizationType);
  }

  async function completeLearnerSignUp(email: string, password: string, fullName: string) {
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_intent: 'learner' },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(LANDING_LINKS.inscriptionEtablissement)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const rpc1 = await ensureLearnerProfile(supabase);
    if (rpc1.error) {
      setError(rpc1.error);
      setLoading(false);
      return;
    }

    let hasSession = Boolean(data.session);
    if (!hasSession) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        hasSession = true;
        await ensureLearnerProfile(supabase);
      }
    }

    if (!hasSession) {
      setInfo(
        `Compte candidat créé pour ${email}. Confirmez l’email si demandé, puis connectez-vous — vous serez guidé vers le choix de votre établissement.`
      );
      setLoading(false);
      return;
    }

    window.location.href = LANDING_LINKS.inscriptionEtablissement;
  }

  async function completeOrganizationCreate(
    email: string,
    password: string,
    fullName: string,
    form: HTMLFormElement
  ) {
    const supabase = createClient();
    const formData = new FormData(form);
    formData.set('organization_type', orgType);
    formData.set('email', email);
    formData.set('full_name', fullName);

    const billingNext = ORG_REGISTRATION_SUCCESS_PATH;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_intent: 'director' },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(billingNext)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    let hasSession = Boolean(data.session);
    if (!hasSession) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setInfo(
          `Compte créé pour ${email}. Si Supabase demande une confirmation par email, cliquez le lien reçu puis reconnectez-vous — vous accéderez ensuite à Paramètres → Facturation en attente d’analyse KonaData.`
        );
        return;
      }
      hasSession = true;
    }

    const result = await completeOrganizationRegistration(formData);
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    if ('success' in result && result.success) {
      window.location.href = result.redirectTo;
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).trim();
    const password = formData.get('password') as string;
    const fullName = formData.get('full_name') as string;
    const effectiveMode =
      searchParams.get('mode') === 'learner' ? 'learner' : mode;

    if (effectiveMode === 'join') {
      await completeJoinWithCode(email, password, fullName);
      return;
    }

    if (effectiveMode === 'learner') {
      await completeLearnerSignUp(email, password, fullName);
      return;
    }

    if (effectiveMode === 'create') {
      await completeOrganizationCreate(email, password, fullName, e.currentTarget);
      setLoading(false);
      return;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <div className="mb-6">
          <AuthBackHome />
        </div>
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Link href={LANDING_LINKS.home} className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]">
              <Database className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold">KonaData</span>
          </Link>
        </div>

        <Card className="border-0 shadow-card-hover">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {mode === 'create'
                ? 'Créer une organisation'
                : mode === 'learner'
                  ? 'Compte candidat / élève'
                  : 'Créer mon compte'}
            </CardTitle>
            <CardDescription>
              {mode === 'create'
                ? 'Dossier complet pour analyse KonaData — accès module après validation du tarif et paiement'
                : mode === 'learner'
                  ? 'Ensuite vous choisirez votre établissement, filière et déposerez votre dossier'
                  : 'Compte collaborateur avec le code reçu de votre responsable'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
              <Button
                type="button"
                variant={mode === 'learner' ? 'default' : 'outline'}
                className="flex-1 text-xs sm:text-sm"
                onClick={() => setRegisterMode('learner')}
              >
                <GraduationCap className="h-4 w-4" />
                Candidat / élève
              </Button>
              <Button
                type="button"
                variant={mode === 'create' ? 'default' : 'outline'}
                className="flex-1 text-xs sm:text-sm"
                onClick={() => setRegisterMode('create')}
              >
                <Building2 className="h-4 w-4" />
                Organisation
              </Button>
              <Button
                type="button"
                variant={mode === 'join' ? 'default' : 'outline'}
                className="flex-1 text-xs sm:text-sm"
                onClick={() => setRegisterMode('join')}
              >
                <KeyRound className="h-4 w-4" />
                Code staff
              </Button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 rounded-lg bg-blue-500/10 p-3 text-sm text-blue-800">
                {info}
              </div>
            )}
            {mode === 'join' && pendingCode && (
              <div className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 font-mono text-center">
                Code : {pendingCode}
              </div>
            )}
            <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />
            <form
              ref={formElRef}
              onSubmit={authMethod === 'email' ? handleSubmit : (e) => e.preventDefault()}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="full_name"
                    name="full_name"
                    className="pl-9"
                    placeholder="Amadou Diallo"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              {mode === 'create' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organisation</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="organization" name="organization" className="pl-9" placeholder="Institut Supérieur de Conakry" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Type d&apos;organisation</Label>
                    <Select value={orgType} onValueChange={(v) => setOrgType(v as OrganizationType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(ORG_TYPE_LABELS) as [OrganizationType, string][]).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <OrgRegistrationFields
                    orgType={orgType}
                    hideDeclaredPhone={authMethod === 'phone'}
                  />
                </>
              )}
              {authMethod === 'email' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" name="email" type="email" className="pl-9" placeholder="vous@organisation.gn" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="password" name="password" type="password" className="pl-9" placeholder="Min. 8 caractères" minLength={8} required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={loading}>
                    {loading
                      ? 'Création...'
                      : mode === 'join'
                        ? 'Créer et rejoindre'
                        : mode === 'learner'
                          ? 'Créer mon compte'
                          : 'Créer mon organisation'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </form>
            {authMethod === 'phone' && (
              <div className="mt-4 pt-4 border-t border-dashed">
                <p className="text-sm text-muted-foreground mb-3">
                  Vérifiez votre numéro par SMS ou WhatsApp — pas besoin d&apos;adresse email.
                </p>
                <PhoneOtpPanel
                  purpose="signup"
                  fullName={fullName}
                  accountIntent={accountIntentForMode(mode)}
                  submitLabel={
                    mode === 'join'
                      ? 'Créer et rejoindre'
                      : mode === 'learner'
                        ? 'Créer mon compte'
                        : 'Créer mon organisation'
                  }
                  disabled={loading || !fullName.trim()}
                  onVerified={handlePhoneVerified}
                />
              </div>
            )}
            {mode === 'join' && (
              <p className="mt-4 text-xs text-center text-muted-foreground">
                Code pas encore saisi ?{' '}
                <Link href={LANDING_LINKS.rejoindre} className="text-primary underline">
                  Entrer mon code d&apos;accès
                </Link>
              </p>
            )}
            {mode === 'learner' && (
              <p className="mt-4 text-xs text-center text-muted-foreground">
                Déjà un compte ?{' '}
                <Link href={LANDING_LINKS.inscriptionEtablissement} className="text-primary underline">
                  Continuer mon inscription
                </Link>
              </p>
            )}
            {mode === 'create' && (
              <p className="mt-4 text-xs text-center text-muted-foreground">
                Vous êtes candidat ?{' '}
                <Link href={LANDING_LINKS.registerLearner} className="text-primary underline">
                  Inscription élève
                </Link>
              </p>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link href={LANDING_LINKS.login} className="text-primary font-medium hover:underline">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
