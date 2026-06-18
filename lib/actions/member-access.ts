'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/actions/auth';
import { canDirectorResetMemberCredentials } from '@/lib/auth/member-credentials-policy';
import { createServiceClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export async function setMemberAccessActive(formData: FormData) {
  const session = await getSession();
  if (!session?.profile?.organization_id) {
    return { error: 'Non authentifié ou organisation manquante.' };
  }

  const actorRole = session.profile.role as AppRole | undefined;
  const actorId = session.user.id;
  const orgId = session.profile.organization_id as string;

  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  const activeRaw = String(formData.get('active') ?? '').trim();
  if (!targetUserId) return { error: 'Utilisateur cible manquant.' };
  if (activeRaw !== 'true' && activeRaw !== 'false') {
    return { error: 'Action invalide.' };
  }
  const active = activeRaw === 'true';

  const service = await createServiceClient();
  const { data: target, error: loadErr } = await service
    .from('profiles')
    .select('id, organization_id, role, full_name, is_active')
    .eq('id', targetUserId)
    .maybeSingle();

  if (loadErr) return { error: loadErr.message };
  if (!target?.id) return { error: 'Utilisateur introuvable.' };
  if (target.organization_id !== orgId) {
    return { error: 'Cet utilisateur n\'appartient pas à votre organisation.' };
  }

  const targetRole = target.role as AppRole;
  if (!canDirectorResetMemberCredentials(actorRole, targetRole, actorId, targetUserId)) {
    return {
      error: active
        ? 'Vous ne pouvez pas réactiver ce compte.'
        : 'Vous ne pouvez pas bloquer ce compte. Seul le directeur peut gérer les responsables ; le directeur adjoint uniquement le staff.',
    };
  }

  if (active === target.is_active) {
    return {
      success: true,
      message: active ? 'Compte déjà actif.' : 'Compte déjà bloqué.',
    };
  }

  const { error: updateErr } = await service
    .from('profiles')
    .update({ is_active: active })
    .eq('id', targetUserId);

  if (updateErr) return { error: updateErr.message };

  revalidatePath('/utilisateurs');
  return {
    success: true,
    message: active
      ? `Accès réactivé pour ${target.full_name}.`
      : `Accès bloqué pour ${target.full_name}. La personne ne pourra plus se connecter.`,
  };
}
