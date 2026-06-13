import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function exchangeAuthLinkParams(params: {
  code?: string | null;
  tokenHash?: string | null;
  type?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  if (params.tokenHash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      type: params.type as EmailOtpType,
      token_hash: params.tokenHash,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return { ok: false, error: 'Lien incomplet' };
}

export function safeAuthRedirectPath(next: string | null, fallback = '/reset-password'): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return fallback;
}
