'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { getDocumentUrl } from '@/lib/actions/storage';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { revalidatePath } from 'next/cache';
import {
  mergeBulletinStampPatch,
  mergeSchoolBrandingPatch,
  parseBulletinTemplate,
  parseSchoolBranding,
} from '@/lib/school/bulletin-template';
import { prepareBrandingImage } from '@/lib/school/branding-image-prep';
import { processBulletinStampBuffer } from '@/lib/school/stamp-process';
import { hasActiveLlmApi } from '@/lib/integrations/openai';

export interface BulletinBrandingStatus {
  requireLogo: boolean;
  requireStamp: boolean;
  hasLogo: boolean;
  hasStamp: boolean;
  logoFileName: string | null;
  stampFileName: string | null;
  stampProcessMethod: string | null;
  stampAiValidated: boolean | null;
  logoDownloadUrl: string | null;
  stampDownloadUrl: string | null;
  readyForPdf: boolean;
  missing: string[];
}

async function requireDirector() {
  const session = await getSession();
  const caps = getEtablissementCapabilities(session?.profile?.role);
  if (!caps.isDirector) return { error: 'Seul le directeur peut gérer le branding bulletin.' };
  return { ok: true as const };
}

function readUploadFile(formData: FormData, field = 'file'): File | null {
  const entry = formData.get(field);
  if (!entry || typeof entry !== 'object') return null;

  if (entry instanceof File) {
    return entry.size > 0 ? entry : null;
  }

  const blob = entry as Blob & { name?: string };
  if (typeof blob.arrayBuffer !== 'function' || blob.size <= 0) return null;
  const name =
    typeof blob.name === 'string' && blob.name.trim() ? blob.name : 'upload.jpg';
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}

async function persistOrganizationBranding(
  orgId: string,
  patch: {
    settings: Record<string, unknown>;
    logo_url?: string | null;
  }
): Promise<{ error?: string }> {
  const userClient = await createClient();
  const { error: userErr } = await userClient
    .from('organizations')
    .update({
      settings: patch.settings,
      ...(patch.logo_url !== undefined ? { logo_url: patch.logo_url } : {}),
    })
    .eq('id', orgId);

  if (!userErr) return {};

  const service = await createServiceClient();
  const { error: serviceErr } = await service
    .from('organizations')
    .update({
      settings: patch.settings,
      ...(patch.logo_url !== undefined ? { logo_url: patch.logo_url } : {}),
    })
    .eq('id', orgId);

  if (serviceErr) {
    return { error: `${userErr.message} — ${serviceErr.message}` };
  }
  return {};
}

/** Reconstruit le cache PDF si logo/cachet déjà uploadés avant la correction. */
export async function repairBulletinBrandingCache(): Promise<
  { repaired: string[] } | { error: string } | { repaired: [] }
> {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: org, error: loadErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();
  if (loadErr) return { error: loadErr.message };

  const settings = (org?.settings as Record<string, unknown>) ?? null;
  const branding = parseSchoolBranding(settings);
  const tpl = parseBulletinTemplate(settings);
  const repaired: string[] = [];
  let nextSettings = settings;

  if (branding.logo_storage_path && !branding.logo_pdf_cache?.base64) {
    const { data } = await supabase.storage
      .from('documents')
      .download(branding.logo_storage_path);
    if (data) {
      try {
        const prepared = await prepareBrandingImage(Buffer.from(await data.arrayBuffer()), {
          maxDimension: 220,
          preferJpeg: true,
          fileName: branding.logo_storage_path,
        });
        nextSettings = mergeSchoolBrandingPatch(nextSettings, {
          logo_pdf_cache: { base64: prepared.base64, format: prepared.format },
        });
        repaired.push('logo');
      } catch {
        /* ignore */
      }
    }
  }

  if (tpl.stamp?.document_id && !tpl.stamp.pdf_cache?.base64) {
    const { fetchOrgStampForBulletin } = await import('@/lib/school/fetch-org-branding');
    const stamp = await fetchOrgStampForBulletin(supabase, tpl.stamp);
    if (stamp?.base64) {
      const stampMeta = {
        ...tpl.stamp,
        pdf_cache: { base64: stamp.base64, format: stamp.format },
      };
      nextSettings = mergeBulletinStampPatch(nextSettings, stampMeta);
      repaired.push('cachet');
    }
  }

  if (!repaired.length) return { repaired: [] };

  const persist = await persistOrganizationBranding(orgId, { settings: nextSettings });
  if (persist.error) return { error: persist.error };

  revalidatePath('/parametres/bulletin');
  revalidatePath('/etablissement/bulletins');
  return { repaired };
}

export async function getBulletinBrandingStatus(): Promise<BulletinBrandingStatus> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('logo_url, settings')
    .eq('id', orgId)
    .maybeSingle();

  const tpl = parseBulletinTemplate((org?.settings as Record<string, unknown>) ?? null);
  const branding = parseSchoolBranding((org?.settings as Record<string, unknown>) ?? null);

  const hasLogo = Boolean(
    branding.logo_pdf_cache?.base64?.trim() ||
      branding.logo_storage_path?.trim() ||
      (org?.logo_url as string)?.trim()
  );
  const hasStamp = Boolean(tpl.stamp?.pdf_cache?.base64?.trim() || tpl.stamp?.document_id);

  let stampDownloadUrl: string | null = null;
  let stampAiValidated: boolean | null = null;
  if (tpl.stamp?.document_id) {
    const { data: doc } = await supabase
      .from('documents')
      .select('file_path, extracted_data')
      .eq('id', tpl.stamp.document_id)
      .maybeSingle();
    if (doc?.file_path) stampDownloadUrl = await getDocumentUrl(doc.file_path as string);
    const stampImg = (doc?.extracted_data as Record<string, unknown> | undefined)?.stamp_image as
      | { ai_validated?: boolean }
      | undefined;
    if (stampImg?.ai_validated != null) stampAiValidated = Boolean(stampImg.ai_validated);
  }

  let logoDownloadUrl: string | null = null;
  if (branding.logo_storage_path) {
    logoDownloadUrl = await getDocumentUrl(branding.logo_storage_path);
  }

  const missing: string[] = [];
  if (tpl.require_logo && !hasLogo) missing.push('logo');
  if (tpl.require_stamp && !hasStamp) missing.push('cachet');

  return {
    requireLogo: tpl.require_logo,
    requireStamp: tpl.require_stamp,
    hasLogo,
    hasStamp,
    logoFileName: branding.logo_storage_path?.split('/').pop() ?? null,
    stampFileName: tpl.stamp?.file_name ?? null,
    stampProcessMethod: tpl.stamp?.process_method ?? null,
    stampAiValidated,
    logoDownloadUrl,
    stampDownloadUrl,
    readyForPdf: missing.length === 0,
    missing,
  };
}

export async function uploadBulletinLogo(formData: FormData) {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const file = readUploadFile(formData);
  if (!file) {
    return {
      error:
        'Fichier logo non reçu par le serveur. Choisissez l’image puis cliquez « Joindre le logo ».',
    };
  }
  if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
    return { error: 'Logo : formats PNG, JPEG ou WebP uniquement.' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const service = await createServiceClient();
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let prepared;
  try {
    prepared = await prepareBrandingImage(rawBuffer, {
      maxDimension: 220,
      preferJpeg: true,
      fileName: file.name,
    });
  } catch {
    return { error: 'Image logo illisible. Utilisez PNG ou JPEG.' };
  }

  const filePath = `${orgId}/branding/logo_${Date.now()}.jpg`;
  let uploadError = (
    await supabase.storage
      .from('documents')
      .upload(filePath, prepared.buffer, { contentType: 'image/jpeg', upsert: true })
  ).error;

  if (uploadError) {
    uploadError = (
      await service.storage
        .from('documents')
        .upload(filePath, prepared.buffer, { contentType: 'image/jpeg', upsert: true })
    ).error;
  }
  if (uploadError) return { error: `Stockage logo : ${uploadError.message}` };

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  const nextSettings = mergeSchoolBrandingPatch(
    (org?.settings as Record<string, unknown>) ?? null,
    {
      logo_storage_path: filePath,
      logo_pdf_cache: { base64: prepared.base64, format: prepared.format },
    }
  );

  const persist = await persistOrganizationBranding(orgId, {
    settings: nextSettings,
    logo_url: filePath,
  });
  if (persist.error) return { error: `Enregistrement logo : ${persist.error}` };

  revalidatePath('/parametres/bulletin');
  revalidatePath('/etablissement/bulletins');
  return { success: true, fileName: file.name };
}

export async function uploadBulletinStamp(formData: FormData) {
  const auth = await requireDirector();
  if ('error' in auth) return auth;

  const file = readUploadFile(formData);
  if (!file) {
    return {
      error:
        'Fichier cachet non reçu par le serveur. Choisissez l’image puis cliquez « Joindre le cachet ».',
    };
  }
  if (!/\.(png|jpe?g|webp|pdf)$/i.test(file.name)) {
    return { error: 'Cachet : PNG, JPEG ou PDF (scan du cachet).' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const service = await createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processBulletinStampBuffer({
    buffer,
    fileName: file.name,
    mimeType: file.type,
    organizationId: orgId,
  });

  if ('error' in processed) return processed;

  let stampReady;
  try {
    stampReady = await prepareBrandingImage(Buffer.from(processed.base64, 'base64'), {
      maxDimension: 280,
      fileName: file.name,
    });
  } catch {
    return { error: 'Cachet illisible après traitement. Réessayez avec une image PNG nette.' };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const filePath = `${orgId}/branding/stamp_${Date.now()}_${safeName}`;
  const readyPath = `${orgId}/branding/stamp_ready_${Date.now()}.png`;

  let uploadError = (
    await supabase.storage
      .from('documents')
      .upload(filePath, buffer, { contentType: file.type || 'image/jpeg', upsert: false })
  ).error;
  if (uploadError) {
    uploadError = (
      await service.storage
        .from('documents')
        .upload(filePath, buffer, { contentType: file.type || 'image/jpeg', upsert: false })
    ).error;
  }
  if (uploadError) return { error: `Stockage cachet : ${uploadError.message}` };

  let readyUploadError = (
    await supabase.storage
      .from('documents')
      .upload(readyPath, stampReady.buffer, { contentType: 'image/png', upsert: true })
  ).error;
  if (readyUploadError) {
    readyUploadError = (
      await service.storage
        .from('documents')
        .upload(readyPath, stampReady.buffer, { contentType: 'image/png', upsert: true })
    ).error;
  }
  if (readyUploadError) return { error: `Stockage cachet traité : ${readyUploadError.message}` };

  let docErr: { message: string } | null = null;
  let doc: { id: string } | null = null;

  const insertPayload = {
    organization_id: orgId,
    uploaded_by: user?.id,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    mime_type: file.type || 'image/jpeg',
    status: 'archived' as const,
    category: 'school_report' as const,
    tags: ['bulletin_stamp', 'branding'],
    extracted_data: {
      role: 'bulletin_stamp',
      stamp_image: {
        base64: stampReady.base64,
        format: stampReady.format,
        method: processed.method,
        ai_validated: processed.aiValidated ?? null,
        processed_at: new Date().toISOString(),
        processed_storage_path: readyPath,
      },
    },
  };

  const userInsert = await supabase.from('documents').insert(insertPayload).select('id').single();
  doc = userInsert.data;
  docErr = userInsert.error;

  if (docErr || !doc) {
    const serviceInsert = await service.from('documents').insert(insertPayload).select('id').single();
    doc = serviceInsert.data;
    docErr = serviceInsert.error;
  }

  if (docErr || !doc) return { error: docErr?.message ?? 'Erreur document cachet' };

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  const stampMeta = {
    document_id: doc.id as string,
    file_name: file.name,
    processed_at: new Date().toISOString(),
    process_method: processed.method,
    pdf_cache: { base64: stampReady.base64, format: stampReady.format },
  };

  const nextSettings = mergeBulletinStampPatch(
    (org?.settings as Record<string, unknown>) ?? null,
    stampMeta
  );

  const persist = await persistOrganizationBranding(orgId, { settings: nextSettings });
  if (persist.error) return { error: `Enregistrement cachet : ${persist.error}` };

  revalidatePath('/parametres/bulletin');
  revalidatePath('/etablissement/bulletins');

  const methodLabel =
    processed.method === 'vision'
      ? 'validé par KonaAI Vision'
      : processed.method === 'pdf_render'
        ? 'extrait du PDF (sans IA)'
        : 'image directe';

  return {
    success: true,
    fileName: file.name,
    method: processed.method,
    message: `Cachet intégré (${methodLabel}).${!hasActiveLlmApi() && processed.method !== 'direct' ? ' Activez KonaAI pour validation Vision.' : ''}`,
  };
}
