'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';

function AuthConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Validation du lien en cours…');

  useEffect(() => {
    async function run() {
      const supabase = createClient();
      const code = searchParams.get('code');
      const nextParam = searchParams.get('next');
      const hash = window.location.hash.replace(/^#/, '');

      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setMessage('Lien invalide ou expiré. Demandez un nouveau lien.');
            setTimeout(() => router.replace('/forgot-password'), 2500);
            return;
          }
          router.replace(type === 'recovery' ? '/reset-password' : '/rejoindre');
          return;
        }
      }

      if (code) {
        const next = nextParam ?? '/rejoindre';
        router.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
        return;
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
