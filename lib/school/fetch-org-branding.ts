import 'server-only';



import type { SupabaseClient } from '@supabase/supabase-js';

import type { OrgLogoImage } from '@/lib/school/fetch-org-logo';

import { fetchOrgLogoForPdf } from '@/lib/school/fetch-org-logo';

import type { BrandingPdfCache, BulletinStampFile } from '@/lib/school/bulletin-template';

import { prepareBrandingImage } from '@/lib/school/branding-image-prep';



const MAX_BYTES = 2_000_000;



export interface OrgStampImage extends OrgLogoImage {

  processMethod?: string | null;

}



function cacheToImage(cache: BrandingPdfCache | null | undefined): OrgLogoImage | null {

  if (!cache?.base64?.trim()) return null;

  return {

    base64: cache.base64.trim(),

    format: cache.format === 'JPEG' ? 'JPEG' : 'PNG',

  };

}



function bufferToImage(buffer: Buffer, filePath: string): OrgLogoImage | null {

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;

  const lower = filePath.toLowerCase();

  const format: 'PNG' | 'JPEG' =

    lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')

      ? 'JPEG'

      : 'PNG';

  return {

    base64: buffer.toString('base64'),

    format,

  };

}



async function downloadStorageImage(

  supabase: SupabaseClient,

  filePath: string

): Promise<OrgLogoImage | null> {

  const { data, error } = await supabase.storage.from('documents').download(filePath);

  if (!error && data) {

    const buffer = Buffer.from(await data.arrayBuffer());

    const direct = bufferToImage(buffer, filePath);

    if (direct) return direct;

  }



  const { data: signed } = await supabase.storage

    .from('documents')

    .createSignedUrl(filePath, 300);

  if (!signed?.signedUrl) return null;



  try {

    const res = await fetch(signed.signedUrl, { cache: 'no-store' });

    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());

    if (buffer.byteLength === 0) return null;



    try {

      const prepared = await prepareBrandingImage(buffer, {

        maxDimension: 512,

        preferJpeg: /\.jpe?g$/i.test(filePath),

      });

      return {

        base64: prepared.base64,

        format: prepared.format,

      };

    } catch {

      return bufferToImage(buffer, filePath);

    }

  } catch {

    return null;

  }

}



export async function fetchOrgLogoForBulletin(

  supabase: SupabaseClient,

  logoUrl: string | null | undefined,

  logoStoragePath: string | null | undefined,

  logoPdfCache?: BrandingPdfCache | null

): Promise<OrgLogoImage | null> {

  const fromCache = cacheToImage(logoPdfCache);

  if (fromCache) return fromCache;



  if (logoStoragePath?.trim()) {

    const fromStorage = await downloadStorageImage(supabase, logoStoragePath.trim());

    if (fromStorage) return fromStorage;

  }

  return fetchOrgLogoForPdf(logoUrl);

}



export async function fetchOrgStampForBulletin(

  supabase: SupabaseClient,

  stampMeta: BulletinStampFile | null | undefined

): Promise<OrgStampImage | null> {

  const fromSettingsCache = cacheToImage(stampMeta?.pdf_cache);

  if (fromSettingsCache) {

    return { ...fromSettingsCache, processMethod: stampMeta?.process_method ?? 'direct' };

  }



  const stampDocumentId = stampMeta?.document_id;

  if (!stampDocumentId?.trim()) return null;



  const { data: doc } = await supabase

    .from('documents')

    .select('file_path, extracted_data, mime_type')

    .eq('id', stampDocumentId.trim())

    .maybeSingle();



  if (!doc) return null;



  const extracted = (doc.extracted_data as Record<string, unknown> | undefined)?.stamp_image as

    | {

        base64?: string;

        format?: string;

        method?: string;

        processed_storage_path?: string;

      }

    | undefined;



  if (extracted?.base64 && extracted.format) {

    return {

      base64: extracted.base64,

      format: extracted.format === 'JPEG' ? 'JPEG' : 'PNG',

      processMethod: (extracted.method as string) ?? null,

    };

  }



  const processedPath = extracted?.processed_storage_path?.trim();

  if (processedPath) {

    const img = await downloadStorageImage(supabase, processedPath);

    if (img) return { ...img, processMethod: (extracted?.method as string) ?? 'direct' };

  }



  const filePath = doc.file_path as string | undefined;

  if (!filePath) return null;



  const img = await downloadStorageImage(supabase, filePath);

  if (!img) return null;

  return { ...img, processMethod: 'direct' };

}


