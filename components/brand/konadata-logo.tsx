import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const KONADATA_WORDMARK_SRC = '/brand/konadata-wordmark.png';
export const KONADATA_ICON_SRC = '/brand/konadata-icon.png';

type KonaDataLogoVariant = 'wordmark' | 'icon';

interface KonaDataLogoProps {
  variant?: KonaDataLogoVariant;
  href?: string;
  className?: string;
  /** Hauteur affichée en px */
  height?: number;
  priority?: boolean;
}

export function KonaDataLogo({
  variant = 'wordmark',
  href,
  className,
  height = 40,
  priority = false,
}: KonaDataLogoProps) {
  const isWordmark = variant === 'wordmark';
  const src = isWordmark ? KONADATA_WORDMARK_SRC : KONADATA_ICON_SRC;
  const intrinsicWidth = isWordmark ? 640 : 512;
  const intrinsicHeight = isWordmark ? 160 : 512;

  const image = (
    <Image
      src={src}
      alt="KonaData"
      width={intrinsicWidth}
      height={intrinsicHeight}
      priority={priority}
      className={cn('w-auto object-contain', className)}
      style={{ height, width: 'auto', maxWidth: isWordmark ? height * 4 : height }}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center">
        {image}
      </Link>
    );
  }

  return image;
}
