'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/actions/auth';
import { validatePassword } from '@/lib/auth/password-policy';
import { canDirectorResetMemberCredentials } from '@/lib/auth/member-credentials-policy';
import {
  adminUpdatePhoneAccountCredentials,
  updateAuthUserPassword,
} from '@/lib/auth/phone-account';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';
import { normalizeGuineaPhone } from '@/lib/survey/phone';
import { createServiceClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export async function adminResetMemberCredentials(formData: FormData) {
  const session = await getSession();
  if (!session?.profile?.organization_id) {
    return { error: 'Non authentifié ou organisation manquante.' };
  }

  const actorRole = session.profile.role as AppRole | undefined;
  const actorId = session.user.id;
  const orgId = session.profile.organization_id as string;

  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  const newPhoneRaw = String(formData.get('new_phone') ?? '').trim();
  const newPassword = String(formData.get('new_password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (!targetUserId) return { error: 'Utilisateur cible manquant.' };
  if (newPassword !== confirmPassword) {
    return { error: 'Les mots de passe ne correspondent pas.' };
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return { error: passwordError };

  const service = await createServiceClient();
  const { data: target, error: loadErr } = await service
    .from('profiles')
    .select('id, organization_id, role, email, phone, full_name, is_active')
    .eq('id', targetUserId)
    .maybeSingle();

  if (loadErr) return { error: loadErr.message };
  if (!target?.id) return { error: 'Utilisateur introuvable.' };
  if (target.organization_id !== orgId) {
    return { error: 'Cet utilisateur n\'appartient pas à votre organisation.' };
  }
  if (target.is_active === false) {
    return { error: 'Compte inactif — réactivation requise avant secours.' };
  }

  const targetRole = target.role as AppRole;
  if (!canDirectorResetMemberCredentials(actorRole, targetRole, actorId, targetUserId)) {
    return {
      error:
        'Vous ne pouvez pas réinitialiser ce compte. Seul le directeur peut secourir les responsables ; le directeur adjoint uniquement le staff.',
    };
  }

  const isPhoneAccount =
    isSyntheticPhoneEmail(target.email as string) || Boolean((target.phone as string | null)?.trim());

  if (isPhoneAccount) {
    if (!newPhoneRaw) {
      return { error: 'Saisissez le nouveau numéro WhatsApp actif du collaborateur.' };
    }
    const newPhoneE164 = normalizeGuineaPhone(newPhoneRaw);
    if (!newPhoneE164) {
      return { error: 'Numéro invalide. Format Guinée : 6XX XX XX XX.' };
    }

    const result = await adminUpdatePhoneAccountCredentials({
      userId: targetUserId,
      newPhoneE164,
      newPassword,
    });
    if ('error' in result) return { error: result.error };

    revalidatePath('/utilisateurs');
    return {
      success: true,
      message: `Compte de ${target.full_name} mis à jour. Communiquez le mot de passe temporaire en personne.`,
      maskedPhone: newPhoneE164.replace(/(\+224\d{2})\d+(\d{2})/, '$1*****$2'),
    };
  }

  const updated = await updateAuthUserPassword(targetUserId, newPassword);
  if ('error' in updated) return { error: updated.error };

  revalidatePath('/utilisateurs');
  return {
    success: true,
    message: `Mot de passe réinitialisé pour ${target.full_name} (compte email).`,
  };
}
