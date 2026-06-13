'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Mail, ArrowLeft, Send, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AuthBackHome } from '@/components/auth/auth-back-home';
import { AuthMethodToggle, type AuthMethod } from '@/components/auth/auth-method-toggle';
import { PhonePasswordRecoveryPanel } from '@/components/auth/phone-password-recovery-panel';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';

function mapResetEmailError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && m.includes('email')) {
    return 'Adresse email invalide ou compte créé par téléphone. Utilisez l’onglet Téléphone.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Trop de demandes. Réessayez dans quelques minutes.';
  }
  return message;
}

export function ForgotPasswordPageContent() {
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<AuthMethod>('phone');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('error') === 'link_expired') {
      setError(
        'Le lien a expiré ou a déjà été utilisé. Demandez un nouveau lien et ouvrez-le dans les 60 minutes.'
      );
    }
  }, [searchParams]);

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).trim().toLowerCase();

    if (isSyntheticPhoneEmail(email)) {
      setError(
        'Ce compte a été créé avec un numéro de téléphone, pas un email. Utilisez l’onglet Téléphone (WhatsApp/SMS).'
      );
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(mapResetEmailError(resetError.message));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6">
          <AuthBackHome />
        </div>
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]">
            <Database className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold">KonaData</span>
        </div>

        <Card className="border-0 shadow-card-hover">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
            <CardDescription>
              {method === 'email'
                ? sent
                  ? 'Un email de réinitialisation a été envoyé à votre adresse.'
                  : 'Recevez un lien sécurisé par email'
                : 'Recevez un code par WhatsApp ou SMS, puis choisissez un nouveau mot de passe'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthMethodToggle value={method} onChange={setMethod} />

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {method === 'phone' ? (
              <PhonePasswordRecoveryPanel />
            ) : sent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Send className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Ouvrez le lien reçu (vérifiez les spams) pour définir un nouveau mot de passe.
                </p>
                <Link href={LANDING_LINKS.login}>
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email du compte</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      className="pl-9"
                      placeholder="vous@organisation.gn"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={loading}>
                  {loading ? 'Envoi…' : 'Envoyer le lien par email'}
                  <Send className="h-4 w-4" />
                </Button>
                <Link href={LANDING_LINKS.login} className="block text-center text-sm text-primary hover:underline">
                  <ArrowLeft className="inline h-3 w-3 mr-1" />
                  Retour à la connexion
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
