'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { AuthPageBrand } from '@/components/auth/auth-page-brand';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Lock, User, Building2, ArrowRight, AlertCircle, KeyRound, GraduationCap, Phone } from 'lucide-react';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { SignupOtpSection, useSignupOtp } from '@/components/auth/signup-otp-section';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { completeOrganizationRegistration } from '@/lib/actions/org-registration';
import { createClient } from '@/lib/supabase/client';
import { redeemAccessCodeClient } from '@/lib/auth/redeem-access-code-client';
import { ORG_TYPE_LABELS, formatStartingPriceGnf, type OrganizationType } from '@/types/database';
import {
  clearPendingAccessCode,
  getPendingAccessCode,
  homeForOrgType,
} from '@/lib/auth/join-flow';
import { ensureLearnerProfile } from '@/lib/auth/learner-signup';
import { OrgRegistrationFields } from '@/components/auth/org-registration-fields';
import {
  ACCOUNT_PHONE_FIELD_HINT,
  ACCOUNT_PHONE_FIELD_LABEL,
} from '@/lib/auth/phone-field-copy';
import { normalizeGuineaPhone } from '@/lib/survey/phone';
import {
  isDirectorOnboardingPath,
  isDirectorOrStaffIntent,
} from '@/lib/auth/account-intent';

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
  const [acceptCgu, setAcceptCgu] = useState(false);
  /** Compte déjà créé (OTP ok) mais organisation jamais finalisée. */
  const [resumeOrg, setResumeOrg] = useState(false);
  const [resumeContact, setResumeContact] = useState<string | null>(null);
  const formElRef = useRef<HTMLFormElement | null>(null);
  const signupOtp = useSignupOtp();

  useEffect(() => {
    setMode(modeFromSearchParams(searchParams));
    setPendingCode(getPendingAccessCode());
  }, [searchParams]);

  useEffect(() => {
    signupOtp.resetOtp();
  }, [authMethod]);

  useEffect(() => {
    if (mode !== 'create') {
      setResumeOrg(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, full_name, phone, email, onboarding_path')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled || profile?.organization_id) return;

      const intent = user.user_metadata?.account_intent as string | undefined;
      const forceResume = searchParams.get('resume') === '1';
      if (
        !forceResume &&
        !isDirectorOrStaffIntent(intent) &&
        !isDirectorOnboardingPath(profile?.onboarding_path as string | undefined)
      ) {
        return;
      }
      if (intent === 'staff' && !forceResume) return;

      setResumeOrg(true);
      const name = (profile?.full_name as string | undefined)?.trim();
      if (name) setFullName(name);
      setResumeContact(
        (user.email as string | undefined) ||
          (profile?.email as string | undefined) ||
          (profile?.phone as string | undefined) ||
          null
      );
      setInfo(
        'Votre compte est déjà créé. Finalisez le dossier de votre organisation ci-dessous pour ouvrir l’accès.'
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, searchParams]);

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

  async function finishOrganizationAfterAuth(formData: FormData, name: string) {
    const supabase = createClient();
    formData.set('organization_type', orgType);
    formData.set('full_name', name);
    if (acceptCgu) formData.set('accept_cgu', 'on');

    const phoneRaw = String(formData.get('phone') ?? formData.get('declared_phone') ?? '').trim();
    const phoneE164 = normalizeGuineaPhone(phoneRaw);
    if (phoneE164) formData.set('declared_phone', phoneE164);

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) formData.set('email', user.email);
    if (!formData.get('declared_phone')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user?.id ?? '')
        .maybeSingle();
      if (profile?.phone) {
        formData.set('declared_phone', profile.phone as string);
      }
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!resumeOrg) setInfo(null);

    // Snapshot avant tout await — e.currentTarget devient null après.
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get('password') ?? '');
    const name = String(formData.get('full_name') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const effectiveMode =
      searchParams.get('mode') === 'learner' ? 'learner' : mode;

    try {
      if (resumeOrg && effectiveMode === 'create') {
        await finishOrganizationAfterAuth(formData, name);
        return;
      }

      if (signupOtp.step === 'form') {
        const ok = await signupOtp.requestOtp({
          method: authMethod,
          phone,
          email,
        });
        if (!ok && signupOtp.otpError) setError(signupOtp.otpError);
        return;
      }

      const signup = await signupOtp.completeSignup({
        method: authMethod,
        password,
        fullName: name,
        accountIntent: accountIntentForMode(effectiveMode),
      });
      if ('error' in signup) {
        setError(signup.error);
        return;
      }

      if (effectiveMode === 'join') {
        await finishJoinAfterAuth(name);
        return;
      }
      if (effectiveMode === 'learner') {
        await finishLearnerAfterAuth(name);
        return;
      }
      if (effectiveMode === 'create') {
        await finishOrganizationAfterAuth(formData, name);
      }
    } catch {
      setError(
        'Une erreur est survenue après la création du compte. Reconnectez-vous puis finalisez le dossier organisation — vos identifiants existent déjà.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
        <div className="mb-6">
          <AuthBackHome />
        </div>
        <AuthPageBrand />

        <Card className="border-0 shadow-card-hover">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {resumeOrg
                ? 'Finaliser votre organisation'
                : mode === 'create'
                  ? 'Créer une organisation'
                  : mode === 'learner'
                    ? 'Compte candidat / élève'
                    : 'Créer mon compte'}
            </CardTitle>
            <CardDescription>
              {resumeOrg
                ? 'Votre compte existe déjà — il manquait seulement le dossier organisation.'
                : mode === 'create'
                  ? 'Dossier complet pour analyse KonaData — accès module après validation du tarif et paiement'
                  : mode === 'learner'
                    ? 'Ensuite vous choisirez votre établissement, filière et déposerez votre dossier'
                    : 'Compte collaborateur avec le code reçu de votre responsable'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!resumeOrg && (
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
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 rounded-lg bg-blue-500/10 p-3 text-sm text-blue-800">
                {info}
                {resumeContact ? (
                  <span className="block mt-1 text-xs opacity-90">Compte : {resumeContact}</span>
                ) : null}
              </div>
            )}
            {mode === 'join' && pendingCode && (
              <div className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-800 font-mono text-center">
                Code : {pendingCode}
              </div>
            )}
            {!resumeOrg && <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />}
            <form ref={formElRef} onSubmit={handleSubmit} className="space-y-4">
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
                    <p className="text-xs font-medium text-primary">
                      {formatStartingPriceGnf(orgType)}
                      <span className="text-muted-foreground font-normal">
                        {' '}— tarif indicatif, montant final validé par KonaData.
                      </span>
                    </p>
                  </div>
                  <OrgRegistrationFields
                    orgType={orgType}
                    hideDeclaredPhone={!resumeOrg && authMethod === 'phone'}
                  />
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      name="accept_cgu"
                      checked={acceptCgu}
                      onChange={(e) => setAcceptCgu(e.target.checked)}
                      className="mt-1"
                      required
                    />
                    <span>
                      J&apos;accepte les{' '}
                      <Link href="/legal/cgu" className="text-primary underline" target="_blank">
                        conditions générales d&apos;utilisation
                      </Link>{' '}
                      et la{' '}
                      <Link href="/legal/confidentialite" className="text-primary underline" target="_blank">
                        politique de confidentialité
                      </Link>
                      .
                    </span>
                  </label>
                </>
              )}
              {!resumeOrg &&
                (authMethod === 'email' ? (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" name="email" type="email" className="pl-9" placeholder="vous@organisation.gn" required />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="phone">{ACCOUNT_PHONE_FIELD_LABEL}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="phone" name="phone" type="tel" className="pl-9" placeholder="6XX XX XX XX" required autoComplete="tel" />
                    </div>
                    <p className="text-xs text-muted-foreground">{ACCOUNT_PHONE_FIELD_HINT}</p>
                  </div>
                ))}
              {!resumeOrg && (
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" name="password" type="password" className="pl-9" placeholder="Min. 8 caractères" minLength={8} required autoComplete="new-password" />
                  </div>
                </div>
              )}
              {!resumeOrg && (
                <SignupOtpSection
                  method={authMethod}
                  step={signupOtp.step}
                  channel={signupOtp.channel}
                  onChannelChange={signupOtp.setChannel}
                  otpCode={signupOtp.otpCode}
                  onOtpCodeChange={signupOtp.setOtpCode}
                  maskedContact={signupOtp.maskedContact}
                  devCode={signupOtp.devCode}
                  error={signupOtp.otpError}
                  loading={signupOtp.otpLoading || loading}
                  onChangeContact={signupOtp.resetOtp}
                />
              )}
              <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={loading || signupOtp.otpLoading}>
                {loading || signupOtp.otpLoading
                  ? 'Traitement…'
                  : resumeOrg
                    ? 'Enregistrer mon organisation'
                    : signupOtp.step === 'form'
                      ? authMethod === 'phone'
                        ? 'Recevoir le code WhatsApp / SMS'
                        : 'Recevoir le code par email'
                      : mode === 'join'
                        ? 'Créer et rejoindre'
                        : mode === 'learner'
                          ? 'Créer mon compte'
                          : 'Créer mon organisation'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
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
            {mode === 'create' && !resumeOrg && (
              <p className="mt-4 text-xs text-center text-muted-foreground">
                Vous êtes candidat ?{' '}
                <Link href={LANDING_LINKS.registerLearner} className="text-primary underline">
                  Inscription élève
                </Link>
                {' · '}
                Compte déjà créé sans organisation ?{' '}
                <Link href={LANDING_LINKS.login} className="text-primary underline">
                  Se connecter pour finaliser
                </Link>
              </p>
            )}
            {!resumeOrg && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Déjà un compte ?{' '}
                <Link href={LANDING_LINKS.login} className="text-primary font-medium hover:underline">
                  Se connecter
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
