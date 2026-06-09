import 'server-only';

import sharp from 'sharp';

export interface PreparedBrandingImage {
  buffer: Buffer;
  base64: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

function rawBufferFallback(
  input: Buffer,
  fileName?: string,
  preferJpeg?: boolean
): PreparedBrandingImage {
  const jpeg =
    preferJpeg || /\.jpe?g$/i.test(fileName ?? '') || extOf(fileName ?? '') === 'jpg';
  return {
    buffer: input,
    base64: input.toString('base64'),
    format: jpeg ? 'JPEG' : 'PNG',
    width: 0,
    height: 0,
  };
}

/** Normalise logo/cachet pour jsPDF : taille raisonnable, format compatible. */
export async function prepareBrandingImage(
  input: Buffer,
  options: { maxDimension: number; preferJpeg?: boolean; fileName?: string }
): Promise<PreparedBrandingImage> {
  if (!input.byteLength) {
    throw new Error('Fichier vide');
  }

  try {
    const pipeline = sharp(input, { failOn: 'none' }).rotate().resize({
      width: options.maxDimension,
      height: options.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (options.preferJpeg) {
      const buffer = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      const meta = await sharp(buffer).metadata();
      return {
        buffer,
        base64: buffer.toString('base64'),
        format: 'JPEG',
        width: meta.width ?? options.maxDimension,
        height: meta.height ?? options.maxDimension,
      };
    }

    const buffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
    const meta = await sharp(buffer).metadata();
    return {
      buffer,
      base64: buffer.toString('base64'),
      format: 'PNG',
      width: meta.width ?? options.maxDimension,
      height: meta.height ?? options.maxDimension,
    };
  } catch {
    return rawBufferFallback(input, options.fileName, options.preferJpeg);
  }
}
