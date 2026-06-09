'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { PhoneOtpPanel } from '@/components/auth/phone-otp-panel';
import { ensureLearnerProfile } from '@/lib/auth/learner-signup';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Mail, Lock, User, GraduationCap, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Inscription candidat / élève uniquement — aucun chemin « créer une organisation ».
 */
export default function RegisterCandidatPage() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [fullName, setFullName] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const fd = new FormData(e.currentTarget);
    const email = (fd.get('email') as string).trim();
    const password = fd.get('password') as string;
    const fullName = (fd.get('full_name') as string).trim();

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

    const { error: rpcError } = await supabase.rpc('ensure_learner_profile');
    if (rpcError) {
      setError(
        `Compte créé mais profil candidat non appliqué : ${rpcError.message}. Appliquez la migration 028 dans Supabase.`
      );
      setLoading(false);
      return;
    }

    let hasSession = Boolean(data.session);
    if (!hasSession) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        hasSession = true;
        await supabase.rpc('ensure_learner_profile');
      }
    }

    if (!hasSession) {
      setInfo(
        `Compte créé. Confirmez votre email si nécessaire, puis connectez-vous : vous serez dirigé vers le choix de votre établissement.`
      );
      setLoading(false);
      return;
    }

    window.location.href = LANDING_LINKS.inscriptionEtablissement;
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
    const supabase = createClient();
    const rpc1 = await ensureLearnerProfile(supabase);
    if (rpc1.error) {
      setError(rpc1.error);
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
    }
    setLoading(false);
    window.location.href = LANDING_LINKS.inscriptionEtablissement;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
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

        <Card className="border-0 shadow-card-hover border-l-4 border-l-cyan-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <GraduationCap className="h-7 w-7 text-cyan-600" />
              Compte candidat / élève
            </CardTitle>
            <CardDescription>
              Vous ne créez pas d&apos;établissement. Après ce formulaire : choix de l&apos;école,
              filière, inscription ou réinscription, puis dépôt des documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 rounded-lg bg-blue-500/10 p-3 text-sm text-blue-800">{info}</div>
            )}
            <AuthMethodToggle value={authMethod} onChange={setAuthMethod} />
            <form
              onSubmit={authMethod === 'email' ? handleSubmit : (e) => e.preventDefault()}
              className="space-y-4"
            >
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
              {authMethod === 'email' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" name="email" type="email" className="pl-9" required autoComplete="email" />
                    </div>
                  </div>
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
                  <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-[#2563EB] border-0" disabled={loading}>
                    {loading ? 'Création…' : 'Créer mon compte candidat'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </form>
            {authMethod === 'phone' && (
              <div className="mt-4 pt-4 border-t border-dashed">
                <p className="text-sm text-muted-foreground mb-3">
                  Pas besoin d&apos;email — vérifiez votre numéro guinéen par SMS ou WhatsApp.
                </p>
                <PhoneOtpPanel
                  purpose="signup"
                  fullName={fullName}
                  accountIntent="learner"
                  submitLabel="Créer mon compte candidat"
                  disabled={loading || !fullName.trim()}
                  onVerified={handlePhoneVerified}
                />
              </div>
            )}
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
