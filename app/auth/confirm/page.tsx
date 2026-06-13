'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EmailOtpType } from '@supabase/supabase-js';

function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/reset-password';
}

/**
 * Échange côté navigateur (PKCE) — requis pour les liens « mot de passe oublié » :
 * le code_verifier est dans les cookies du même navigateur qui a demandé l'email.
 */
function AuthConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Validation du lien en cours…');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function run() {
      const supabase = createClient();
      const nextParam = safeNext(searchParams.get('next'));
      const code = searchParams.get('code');
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as EmailOtpType,
          token_hash: tokenHash,
        });
        if (error) {
          setMessage('Lien invalide ou expiré. Demandez un nouveau lien.');
          setTimeout(() => router.replace('/forgot-password?error=link_expired'), 2500);
          return;
        }
        router.replace(type === 'recovery' ? '/reset-password' : nextParam);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage('Lien invalide ou expiré. Demandez un nouveau lien.');
          setTimeout(() => router.replace('/forgot-password?error=link_expired'), 2500);
          return;
        }
        router.replace(nextParam);
        return;
      }

      const hash = window.location.hash.replace(/^#/, '');
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const hashType = params.get('type');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setMessage('Lien invalide ou expiré. Demandez un nouveau lien.');
            setTimeout(() => router.replace('/forgot-password?error=link_expired'), 2500);
            return;
          }
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          router.replace(hashType === 'recovery' ? '/reset-password' : nextParam);
          return;
        }
      }

      setMessage('Lien incomplet. Demandez un nouveau email.');
      setTimeout(() => router.replace('/forgot-password'), 2500);
    }

    void run();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement…</div>}>
      <AuthConfirmInner />
    </Suspense>
  );
}
