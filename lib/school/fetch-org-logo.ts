/** Télécharge le logo établissement pour insertion dans un PDF jsPDF. */

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;

export interface OrgLogoImage {
  base64: string;
  format: 'PNG' | 'JPEG';
}

export async function fetchOrgLogoForPdf(
  url: string | null | undefined
): Promise<OrgLogoImage | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(trimmed, { signal: controller.signal, cache: 'force-cache' });
    clearTimeout(timer);

    if (!res.ok) return null;

    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;

    let format: 'PNG' | 'JPEG' | null = null;
    if (contentType.includes('jpeg') || contentType.includes('jpg') || /\.jpe?g(\?|$)/i.test(trimmed)) {
      format = 'JPEG';
    } else if (contentType.includes('png') || /\.png(\?|$)/i.test(trimmed)) {
      format = 'PNG';
    } else if (contentType.includes('image/')) {
      format = 'PNG';
    }
    if (!format) return null;

    return {
      base64: Buffer.from(buffer).toString('base64'),
      format,
    };
  } catch {
    return null;
  }
}
