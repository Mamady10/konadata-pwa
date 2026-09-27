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

    const source = Buffer.from(logo.base64, 'base64');
    const trimmed = await trimLogoMargins(source, logo.format);
    if (trimmed) return trimmed;

    const meta = await sharp(source).metadata();
    if (!meta.width || !meta.height) return null;
    return { ...logo, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** Retire les marges unies autour du logo pour qu'il occupe tout l'espace prévu. */
export async function trimLogoMargins(
  source: Buffer,
  format: 'PNG' | 'JPEG'
): Promise<WeeklyReportImage | null> {
  try {
    const keyed = await removeDarkBackground(source);
    if (keyed) {
      const { data, info } = await sharp(keyed)
        .trim({ threshold: 10 })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      if (info.width >= 8 && info.height >= 8) {
        return { base64: data.toString('base64'), format: 'PNG', width: info.width, height: info.height };
      }
    }

    const pipeline = sharp(source, { failOn: 'none' }).trim({ threshold: 18 });
    const { data, info } =
      format === 'PNG'
        ? await pipeline.png().toBuffer({ resolveWithObject: true })
        : await pipeline.jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height || info.width < 8 || info.height < 8) return null;
    return { base64: data.toString('base64'), format, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/**
 * Fond uni sombre (logo sur fond noir) rendu transparent : le logo se pose directement
 * sur le bandeau du rapport. Les fonds clairs sont conservés pour garder un texte sombre lisible.
 */
async function removeDarkBackground(source: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(source, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width < 8 || height < 8) return null;

  const border: number[][] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 40));
  for (let x = 0; x < width; x += step) {
    border.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y += step) {
    border.push([0, y], [width - 1, y]);
  }
  const samples = border.map(([x, y]) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  });
  if (samples.some((s) => s[3] < 250)) return null;

  const mean = [0, 1, 2].map((c) => samples.reduce((sum, s) => sum + s[c], 0) / samples.length);
  const luminance = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
  if (luminance > 60) return null;
  const spread = Math.max(
    ...samples.map((s) => Math.hypot(s[0] - mean[0], s[1] - mean[1], s[2] - mean[2]))
  );
  if (spread > 40) return null;

  const SOLID_FROM = 70;
  const CLEAR_UNTIL = 28;
  for (let i = 0; i < data.length; i += channels) {
    const dist = Math.hypot(data[i] - mean[0], data[i + 1] - mean[1], data[i + 2] - mean[2]);
    if (dist >= SOLID_FROM) continue;
    const alpha = dist <= CLEAR_UNTIL ? 0 : (dist - CLEAR_UNTIL) / (SOLID_FROM - CLEAR_UNTIL);
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
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
            timeZone: 'UTC',
          }),
        };
      } catch {
        return null;
      }
    })
  );

  return photos.filter((p): p is WeeklyReportPhoto => p != null);
}
