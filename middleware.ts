import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { updateSession } = await import('@/lib/supabase/middleware');
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|sw.js|offline.html|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
