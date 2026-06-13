'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Liens legacy avec #access_token dans le hash (navigateur uniquement). */
function AuthConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Validation du lien en cours…');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    async function run() {
      const code = searchParams.get('code');
      const tokenHash = searchParams.get('token_hash');
      const nextParam = searchParams.get('next') ?? '/reset-password';

      if (code || tokenHash) {
        handled.current = true;
        const qs = new URLSearchParams();
        if (code) qs.set('code', code);
        if (tokenHash) qs.set('token_hash', tokenHash);
        const type = searchParams.get('type');
        if (type) qs.set('type', type);
        qs.set('next', nextParam.startsWith('/') ? nextParam : '/reset-password');
        window.location.replace(`/auth/callback?${qs.toString()}`);
        return;
      }

      const hash = window.location.hash.replace(/^#/, '');
      if (!hash || !hash.includes('access_token')) {
        setMessage('Lien incomplet. Demandez un nouveau email.');
        setTimeout(() => router.replace('/forgot-password'), 2500);
        return;
      }

      handled.current = true;
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (!accessToken || !refreshToken) {
        setMessage('Lien incomplet. Demandez un nouveau email.');
        setTimeout(() => router.replace('/forgot-password'), 2500);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setMessage('Lien invalide ou expiré. Demandez un nouveau lien.');
        setTimeout(() => router.replace('/forgot-password'), 2500);
        return;
      }

      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      router.replace(type === 'recovery' ? '/reset-password' : nextParam);
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
