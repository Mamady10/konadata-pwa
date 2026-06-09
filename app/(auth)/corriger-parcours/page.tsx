'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureLearnerProfile } from '@/lib/auth/learner-signup';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Loader2 } from 'lucide-react';
import Link from 'next/link';

/** Corrige un compte créé par erreur en directeur → parcours candidat. */
export default function CorrigerParcoursPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'auth' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('auth');
        return;
      }
      const { error } = await ensureLearnerProfile(supabase);
      if (error) {
        setStatus('error');
        setMessage(error);
        return;
      }
      setStatus('ok');
      window.setTimeout(() => {
        window.location.href = LANDING_LINKS.inscriptionEtablissement;
      }, 1200);
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Parcours candidat / élève
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {status === 'loading' && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Correction du profil en cours…
            </p>
          )}
          {status === 'ok' && (
            <p className="text-emerald-700">
              Profil corrigé. Redirection vers le choix de votre établissement…
            </p>
          )}
          {status === 'auth' && (
            <>
              <p>Connectez-vous ou créez un compte candidat.</p>
              <Button asChild className="w-full bg-[#2563EB]">
                <Link href={LANDING_LINKS.registerLearner}>Créer un compte candidat</Link>
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <p className="text-destructive">{message}</p>
              <p className="text-muted-foreground text-xs">
                Appliquez la migration <code>028_ensure_learner_profile.sql</code> dans Supabase.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
