'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        setChecking(false);
        return;
      }

      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.replace('#', ''));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!sessionError) {
            setReady(true);
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      }
      setChecking(false);
    }

    void initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
        setChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push('/login'), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]">
            <Database className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold">KonaData</span>
        </div>

        <Card className="border-0 shadow-card-hover">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
            <CardDescription>
              Choisissez un mot de passe pour votre compte KonaData
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking && (
              <p className="text-sm text-center text-muted-foreground mb-4">Vérification du lien…</p>
            )}

            {!checking && !ready && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-destructive">
                  Lien expiré ou invalide. Demandez un nouveau lien de réinitialisation.
                </p>
                <Link href="/forgot-password">
                  <Button variant="outline" className="w-full">Renvoyer un lien</Button>
                </Link>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Mot de passe mis à jour — redirection vers la connexion…
              </div>
            )}

            {ready && !success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      className="pl-9"
                      placeholder="Min. 8 caractères"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type="password"
                      className="pl-9"
                      placeholder="Répétez le mot de passe"
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#2563EB] hover:bg-[#2563EB]/90" disabled={loading}>
                  {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
