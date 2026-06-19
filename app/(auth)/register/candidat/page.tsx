'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { ensureLearnerProfile } from '@/lib/auth/learner-signup';
import { SignupOtpSection, useSignupOtp } from '@/components/auth/signup-otp-section';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { AuthPageBrand } from '@/components/auth/auth-page-brand';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import {
  ACCOUNT_PHONE_FIELD_HINT,
  ACCOUNT_PHONE_FIELD_LABEL,
} from '@/lib/auth/phone-field-copy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, User, GraduationCap, ArrowRight, AlertCircle, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Inscription candidat / élève uniquement — aucun chemin « créer une organisation ».
 */
export default function RegisterCandidatPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [fullName, setFullName] = useState('');
  const signupOtp = useSignupOtp();

  useEffect(() => {
    signupOtp.resetOtp();
  }, [authMethod]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData(e.currentTarget);
      const password = String(fd.get('password') ?? '');
      const name = String(fd.get('full_name') ?? '').trim();
      const phone = String(fd.get('phone') ?? '').trim();
      const email = String(fd.get('email') ?? '').trim();

      if (signupOtp.step === 'form') {
        const ok = await signupOtp.requestOtp({ method: authMethod, phone, email });
        if (!ok && signupOtp.otpError) setError(signupOtp.otpError);
        return;
      }

      const signup = await signupOtp.completeSignup({
        method: authMethod,
        password,
        fullName: name,
        accountIntent: 'learner',
      });
      if ('error' in signup) {
        setError(signup.error);
        return;
      }

      const supabase = createClient();
      const rpc1 = await ensureLearnerProfile(supabase);
      if (rpc1.error) {
        setError('Compte créé mais profil candidat non appliqué. Contactez le support.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
      }

      window.location.href = LANDING_LINKS.inscriptionEtablissement;
    } catch {
      setError('Une erreur inattendue est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="mb-6">
          <AuthBackHome />
        </div>
        <AuthPageBrand />

        <Card className="border-0 shadow-card-hover border-l-4 border-l-cyan-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <GraduationCap className="h-7 w-7 text-cyan-600" />
              Compte candidat / élève
            </CardTitle>
            <CardDescription>
              Inscription en une étape — ensuite choix de l&apos;école, filière et dépôt du dossier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="full_name"
                    name="full_name"
                    className="pl-9"
                    required
                    placeholder="Votre nom"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              {authMethod === 'email' ? (
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" name="email" type="email" className="pl-9" required autoComplete="email" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="phone">{ACCOUNT_PHONE_FIELD_LABEL} *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="phone" name="phone" type="tel" className="pl-9" required autoComplete="tel" placeholder="6XX XX XX XX" />
                  </div>
                  <p className="text-xs text-muted-foreground">{ACCOUNT_PHONE_FIELD_HINT}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    className="pl-9"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
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
              <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-[#2563EB] border-0" disabled={loading || signupOtp.otpLoading}>
                {loading || signupOtp.otpLoading
                  ? 'Traitement…'
                  : signupOtp.step === 'form'
                    ? authMethod === 'phone'
                      ? 'Recevoir le code WhatsApp / SMS'
                      : 'Recevoir le code par email'
                    : 'Créer mon compte candidat'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Déjà inscrit ?{' '}
              <Link href={LANDING_LINKS.login} className="text-primary font-medium hover:underline">
                Se connecter
              </Link>
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Vous êtes directeur ou staff ?{' '}
              <Link href={LANDING_LINKS.registerOrganization} className="underline">
                Créer une organisation
              </Link>
              {' · '}
              <Link href={LANDING_LINKS.registerJoin} className="underline">
                Code staff
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
