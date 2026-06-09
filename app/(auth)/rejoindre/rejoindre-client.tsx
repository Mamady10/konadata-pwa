'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrganizationType } from '@/types/database';
import {
  clearPendingAccessCode,
  getPendingAccessCode,
  homeForOrgType,
  setPendingAccessCode,
} from '@/lib/auth/join-flow';
import { redeemAccessCodeClient } from '@/lib/auth/redeem-access-code-client';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';

interface Props {
  isLoggedIn: boolean;
  userEmail?: string;
}

export function RejoindreClient({ isLoggedIn, userEmail }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [authenticated, setAuthenticated] = useState(isLoggedIn);
  const [email, setEmail] = useState(userEmail ?? '');

  useEffect(() => {
    const pending = getPendingAccessCode();
    if (pending) setCode(pending);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthenticated(true);
        setEmail(user.email ?? '');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session?.user));
      if (session?.user?.email) setEmail(session.user.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function tryRedeem(accessCode: string) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await redeemAccessCodeClient(accessCode);
      if (result.error) {
        setError(result.error);
        return;
      }

      clearPendingAccessCode();
      setSuccess(`Accès validé — ${result.organizationName ?? 'Organisation'}`);
      setTimeout(() => {
        window.location.href = homeForOrgType(result.organizationType as OrganizationType);
      }, 800);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('Saisissez le code d\'accès fourni par votre responsable.');
      return;
    }

    if (!authenticated) {
      setPendingAccessCode(normalized);
      router.push(LANDING_LINKS.registerJoin);
      return;
    }

    await tryRedeem(normalized);
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

        <Card className="border-0 shadow-card-hover">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <KeyRound className="h-6 w-6 text-primary" />
              Rejoindre une organisation
            </CardTitle>
            <CardDescription>
              Code au format <span className="font-mono">KONA-XXXX-XXXX</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            {!authenticated ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Pas encore de compte ? Saisissez le code puis cliquez <strong>Créer mon compte</strong>.
                <br />
                Déjà inscrit ?{' '}
                <Link href={`${LANDING_LINKS.login}?redirect=%2Frejoindre`} className="text-primary underline font-medium">
                  Connectez-vous d&apos;abord
                </Link>
              </div>
            ) : (
              <div className="mb-4 space-y-2 text-center text-sm">
                <p className="text-muted-foreground">
                  Connecté : <strong>{email}</strong>
                </p>
                <p className="text-muted-foreground">
                  Saisissez le code <span className="font-mono">KONA-…</span> fourni par votre
                  établissement, ou créez une organisation si vous êtes directeur.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code d&apos;accès *</Label>
                <Input
                  id="code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="KONA-A1B2-C3D4"
                  className="uppercase tracking-widest font-mono text-center bg-white"
                  autoComplete="off"
                  required
                  readOnly={false}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90"
                disabled={submitting}
              >
                {submitting
                  ? 'Validation…'
                  : authenticated
                    ? 'Valider mon accès'
                    : 'Créer mon compte avec ce code'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {authenticated && (
              <Button
                type="button"
                variant="ghost"
                className="w-full mt-2 text-xs"
                onClick={() => {
                  clearPendingAccessCode();
                  setCode('');
                  setError(null);
                }}
              >
                Effacer et saisir un autre code
              </Button>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {authenticated ? (
                <>
                  <Link href="/mon-espace" className="text-primary font-medium hover:underline">
                    Mon espace
                  </Link>
                  {' · '}
                  <Link
                    href={LANDING_LINKS.loginSwitchAccount}
                    className="text-primary font-medium hover:underline"
                  >
                    Changer de compte
                  </Link>
                  {' · '}
                  <Link
                    href={LANDING_LINKS.registerOrganization}
                    className="text-primary font-medium hover:underline"
                  >
                    Créer une organisation
                  </Link>
                </>
              ) : (
                <>
                  Vous créez une organisation ?{' '}
                  <Link
                    href={LANDING_LINKS.registerOrganization}
                    className="text-primary font-medium hover:underline"
                  >
                    Inscription direction
                  </Link>
                  {' · '}
                  <Link
                    href={`${LANDING_LINKS.login}?redirect=%2Frejoindre`}
                    className="text-primary font-medium hover:underline"
                  >
                    Connexion
                  </Link>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
