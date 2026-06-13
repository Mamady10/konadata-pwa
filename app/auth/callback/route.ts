import { NextResponse } from 'next/server';
import {
  exchangeAuthLinkParams,
  safeAuthRedirectPath,
} from '@/lib/auth/exchange-auth-link';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = safeAuthRedirectPath(searchParams.get('next'), '/rejoindre');

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
  }

  // Réinitialisation mot de passe : PKCE doit s'échanger dans le navigateur (cookies).
  if (next === '/reset-password' || type === 'recovery') {
    const passthrough = new URL(`${origin}/auth/confirm`);
    searchParams.forEach((value, key) => passthrough.searchParams.set(key, value));
    if (!passthrough.searchParams.has('next')) {
      passthrough.searchParams.set('next', '/reset-password');
    }
    return NextResponse.redirect(passthrough.toString());
  }

  const result = await exchangeAuthLinkParams({ code, tokenHash, type });

  if (result.ok) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  console.error('[auth/callback]', result.error);
  return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
}
