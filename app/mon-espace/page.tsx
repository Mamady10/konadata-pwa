import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { resolvePostAuthDestination } from '@/lib/auth/post-auth-redirect';
import { learnerHasEnrollmentHistory } from '@/lib/auth/learner-enrollments';
import {
  isDirectorOnboardingPath,
  isDirectorOrStaffIntent,
} from '@/lib/auth/account-intent';
import type { AppRole, Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Point d'entrée fiable après connexion (évite le parcours candidat par erreur).
 */
export default async function MonEspacePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  const profile = session.profile;
  const accountIntent = session.user.user_metadata?.account_intent as string | undefined;

  const onboardingPath = (profile as { onboarding_path?: string })?.onboarding_path;
  if (
    (isDirectorOrStaffIntent(accountIntent) || isDirectorOnboardingPath(onboardingPath)) &&
    !profile?.organization_id
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 space-y-4">
            <h1 className="text-xl font-semibold">Compte direction / staff</h1>
            <p className="text-sm text-muted-foreground">
              Votre compte est enregistré comme <strong>directeur ou collaborateur</strong>, mais il
              n&apos;est plus rattaché à une organisation (souvent après une connexion via le parcours
              candidat).
            </p>
            <p className="text-sm text-muted-foreground">
              Rôle actuel : <code className="text-xs bg-muted px-1 rounded">{profile?.role ?? '—'}</code>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/rejoindre?profil=directeur">Saisir mon code d&apos;accès</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/register?mode=create">Créer une organisation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const hasEnrollmentHistory = await learnerHasEnrollmentHistory(supabase, session.user.id);
  const org = profile?.organizations as Organization | null;

  redirect(
    resolvePostAuthDestination({
      organizationId: profile?.organization_id,
      role: profile?.role as AppRole | undefined,
      orgType: getOrgType(org),
      accountIntent,
      onboardingPath,
      hasEnrollmentHistory,
    })
  );
}
