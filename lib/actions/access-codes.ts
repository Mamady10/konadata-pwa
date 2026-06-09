'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { sendAccessCodeEmail } from '@/lib/email/send-access-code';
import type { AppRole, OrganizationType } from '@/types/database';

export interface AccessCodeRow {
  id: string;
  code: string;
  role: AppRole;
  label: string | null;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  recipient_email: string | null;
  emailed_at: string | null;
}

const ACCESS_CODE_COLUMNS_FULL =
  'id, code, role, label, max_uses, uses_count, expires_at, is_active, created_at, recipient_email, emailed_at';
const ACCESS_CODE_COLUMNS_BASE =
  'id, code, role, label, max_uses, uses_count, expires_at, is_active, created_at';

export async function listAccessCodes(): Promise<AccessCodeRow[]> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  let { data, error } = await supabase
    .from('organization_access_codes')
    .select(ACCESS_CODE_COLUMNS_FULL)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error?.message?.includes('recipient_email') || error?.message?.includes('emailed_at')) {
    const retry = await supabase
      .from('organization_access_codes')
      .select(ACCESS_CODE_COLUMNS_BASE)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    recipient_email: (row as AccessCodeRow).recipient_email ?? null,
    emailed_at: (row as AccessCodeRow).emailed_at ?? null,
  })) as AccessCodeRow[];
}

export async function generateAccessCode(formData: FormData) {
  try {
    const supabase = await createClient();
    const role = formData.get('role') as AppRole;
    if (!role) return { error: 'Rôle requis' };

    const label = (formData.get('label') as string) || null;
    const maxUses = Math.max(1, Number(formData.get('max_uses') || 1));
    const expiresDays = Math.max(1, Number(formData.get('expires_days') || 30));
    const recipientEmail = (formData.get('recipient_email') as string)?.trim() || '';

    const { data: code, error } = await supabase.rpc('generate_access_code', {
      p_role: role,
      p_label: label,
      p_max_uses: maxUses,
      p_expires_days: expiresDays,
    });

    if (error) return { error: error.message };
    if (!code || typeof code !== 'string') {
      return { error: 'Le serveur n\'a pas renvoyé de code. Vérifiez les logs Supabase (RPC generate_access_code).' };
    }

    const codeStr = code;
    let orgId: string;
    try {
      orgId = await requireOrgId();
    } catch (e) {
      return {
        error:
          e instanceof Error
            ? e.message
            : 'Organisation introuvable pour ce compte',
      };
    }

    const { data: codeRow } = await supabase
      .from('organization_access_codes')
      .select('id, expires_at')
      .eq('organization_id', orgId)
      .eq('code', codeStr)
      .maybeSingle();

    let emailSent = false;
    let emailWarning: string | undefined;

    if (recipientEmail) {
      try {
        const sendResult = await sendCodeEmailForRow(
          supabase,
          codeStr,
          recipientEmail,
          role,
          codeRow?.id,
          codeRow?.expires_at
        );
        emailSent = sendResult.emailSent;
        emailWarning = sendResult.emailWarning;
      } catch (e) {
        emailWarning =
          e instanceof Error ? e.message : 'Envoi email interrompu (le code est créé)';
      }
    }

    revalidatePath('/utilisateurs');
    return { success: true, code: codeStr, emailSent, emailWarning };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Erreur inattendue lors de la génération du code',
    };
  }
}

export async function sendAccessCodeByEmail(formData: FormData) {
  const codeId = formData.get('code_id') as string;
  const recipientEmail = (formData.get('recipient_email') as string)?.trim();
  if (!codeId || !recipientEmail) return { error: 'Code et email requis' };

  const supabase = await createClient();
  const orgId = await requireOrgId();

  const { data: row, error } = await supabase
    .from('organization_access_codes')
    .select('id, code, role, expires_at')
    .eq('id', codeId)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .single();

  if (error || !row) return { error: 'Code introuvable ou inactif' };

  const sendResult = await sendCodeEmailForRow(supabase, row.code, recipientEmail, row.role as AppRole, row.id, row.expires_at);
  revalidatePath('/utilisateurs');

  if (sendResult.emailWarning) {
    return { success: true, emailSent: false, emailWarning: sendResult.emailWarning };
  }
  return { success: true, emailSent: true };
}

async function sendCodeEmailForRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  code: string,
  recipientEmail: string,
  role: AppRole,
  codeId?: string,
  expiresAt?: string | null
) {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch {
    return { emailSent: false, emailWarning: 'Session ou organisation invalide' };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { emailSent: false, emailWarning: 'Session invalide' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organizations(name, type)')
    .eq('id', user.id)
    .single();

  const org = profile?.organizations as { name?: string; type?: OrganizationType } | null;

  const emailResult = await sendAccessCodeEmail({
    to: recipientEmail,
    code,
    role,
    orgName: org?.name ?? 'Organisation',
    orgType: org?.type ?? 'school',
    expiresAt,
    inviterName: profile?.full_name,
  });

  if (emailResult.ok) {
    if (codeId) {
      const { error: recordErr } = await supabase.rpc('record_access_code_email', {
        p_code_id: codeId,
        p_email: recipientEmail,
      });
      if (recordErr?.message?.includes('record_access_code_email')) {
        // migration 013 non appliquée — le code reste valide
      } else if (recordErr) {
        const { error: updErr } = await supabase
          .from('organization_access_codes')
          .update({
            recipient_email: recipientEmail.toLowerCase(),
            emailed_at: new Date().toISOString(),
          })
          .eq('id', codeId);
        if (updErr && !updErr.message?.includes('recipient_email')) {
          return { emailSent: true, emailWarning: `Email envoyé ; historique non enregistré : ${updErr.message}` };
        }
      }
    } else {
      const { error: updErr } = await supabase
        .from('organization_access_codes')
        .update({
          recipient_email: recipientEmail.toLowerCase(),
          emailed_at: new Date().toISOString(),
        })
        .eq('organization_id', orgId)
        .eq('code', code);
      if (updErr && !updErr.message?.includes('recipient_email')) {
        return { emailSent: true, emailWarning: `Email envoyé ; historique non enregistré : ${updErr.message}` };
      }
    }
    return { emailSent: true };
  }

  return {
    emailSent: false,
    emailWarning: emailResult.error ?? 'Email non envoyé',
  };
}

export async function revokeAccessCode(codeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_access_code', { p_code_id: codeId });
  if (error) return { error: error.message };
  revalidatePath('/utilisateurs');
  return { success: true };
}

export async function redeemAccessCode(code: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code.trim() });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return {
    success: true,
    organizationName: (data as { organization_name?: string })?.organization_name,
    organizationType: (data as { organization_type?: string })?.organization_type,
    role: (data as { role?: string })?.role,
  };
}

export async function getOrgResponsablesCount(orgId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .in('role', ['org_admin', 'deputy_director']);
  if (error) return 0;
  return count ?? 0;
}

export type AccessCodesIssueStatus = {
  allowed: boolean;
  reason?: 'migration_missing' | 'platform_admin' | 'wrong_role' | 'no_org';
  detail?: string;
};

export async function getAccessCodesIssueStatus(): Promise<AccessCodesIssueStatus> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, reason: 'wrong_role' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id, is_active, organizations(name, type)')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return { allowed: false, reason: 'no_org' };
  }

  if (profile.is_active === false) {
    return {
      allowed: false,
      reason: 'wrong_role',
      detail: 'Votre profil est inactif (is_active = false). Réactivez-le dans Supabase → profiles.',
    };
  }

  const { data, error } = await supabase.rpc('can_issue_access_codes');

  if (error) {
    const msg = error.message ?? '';
    if (
      error.code === '42883' ||
      msg.includes('does not exist') ||
      msg.includes('Could not find the function')
    ) {
      return {
        allowed: false,
        reason: 'migration_missing',
        detail: 'Exécutez supabase/sql-editor/012-access-codes-ONLY.sql dans Supabase.',
      };
    }
    return { allowed: false, reason: 'wrong_role', detail: msg };
  }

  if (data) return { allowed: true };

  if (profile.role === 'platform_admin') {
    return { allowed: false, reason: 'platform_admin' };
  }

  const org = profile.organizations as { name?: string; type?: string } | null;
  const roleLabel = profile.role ?? 'inconnu';

  if (!['org_admin', 'deputy_director'].includes(profile.role ?? '')) {
    return {
      allowed: false,
      reason: 'wrong_role',
      detail: `Rôle actuel : « ${roleLabel} ». Il faut org_admin (directeur) ou deputy_director (adjoint). Exécutez FIX-director-profiles.sql si vous utilisez director@isc.gn.`,
    };
  }

  return {
    allowed: false,
    reason: 'wrong_role',
    detail: `Profil ${roleLabel} sur ${org?.name ?? 'organisation'} (type ${org?.type ?? '?'}), mais can_issue_access_codes() = false. Vérifiez que vous n'êtes pas aussi platform_admin.`,
  };
}

/** @deprecated use getAccessCodesIssueStatus */
export async function canIssueAccessCodes(): Promise<boolean> {
  const status = await getAccessCodesIssueStatus();
  return status.allowed;
}
