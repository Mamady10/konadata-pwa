import { NextResponse } from 'next/server';
import {
  exchangeAuthLinkParams,
  safeAuthRedirectPath,
} from '@/lib/auth/exchange-auth-link';

/** Échange serveur des liens email (code PKCE ou token_hash) — cookies posés avant redirect. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = safeAuthRedirectPath(searchParams.get('next'), '/reset-password');

  if (!code && !tokenHash) {
    return NextResponse.next();
  }

  const result = await exchangeAuthLinkParams({ code, tokenHash, type });

  if (result.ok) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  console.error('[auth/confirm]', result.error);
  return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
}
