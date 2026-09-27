import 'server-only';

import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOrgLogoForBulletin } from '@/lib/school/fetch-org-branding';
import { parseSchoolBranding } from '@/lib/school/bulletin-template';
import type { WeeklyReportImage, WeeklyReportPhoto } from '@/lib/btp/weekly-report-export-types';

export const MAX_REPORT_PHOTOS = 6;
const PHOTO_MAX_DIMENSION = 1000;
const PHOTO_MAX_SOURCE_BYTES = 15_000_000;

export interface ReportPhotoSource {
  filePath: string;
  fileName: string;
  createdAt: string;
}

export async function loadOrgLogoForReport(
  supabase: SupabaseClient,
  orgId: string
): Promise<WeeklyReportImage | null> {
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_url, settings')
      .eq('id', orgId)
      .maybeSingle();
    if (!org) return null;

    const branding = parseSchoolBranding((org.settings as Record<string, unknown>) ?? null);
    const logo = await fetchOrgLogoForBulletin(
      supabase,
      org.logo_url as string | null,
      branding.logo_storage_path,
      branding.logo_pdf_cache
    );
    if (!logo) return null;

    const meta = await sharp(Buffer.from(logo.base64, 'base64')).metadata();
    if (!meta.width || !meta.height) return null;
    return { ...logo, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

function captionFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  return base || 'Photo du chantier';
}

/** Photos compressées en JPEG pour rester légères dans le PDF / PowerPoint. */
export async function loadSitePhotosForReport(
  supabase: SupabaseClient,
  sources: ReportPhotoSource[]
): Promise<WeeklyReportPhoto[]> {
  const recent = [...sources]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_REPORT_PHOTOS)
    .reverse();

  const photos = await Promise.all(
    recent.map(async (src): Promise<WeeklyReportPhoto | null> => {
      try {
        const { data, error } = await supabase.storage.from('documents').download(src.filePath);
        if (error || !data || data.size === 0 || data.size > PHOTO_MAX_SOURCE_BYTES) return null;
        const input = Buffer.from(await data.arrayBuffer());
        const { data: buffer, info } = await sharp(input, { failOn: 'none' })
          .rotate()
          .resize({
            width: PHOTO_MAX_DIMENSION,
            height: PHOTO_MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 70, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
        return {
          base64: buffer.toString('base64'),
          format: 'JPEG',
          width: info.width,
          height: info.height,
          caption: captionFromFileName(src.fileName),
          dateLabel: new Date(src.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        };
      } catch {
        return null;
      }
    })
  );

  return photos.filter((p): p is WeeklyReportPhoto => p != null);
}
