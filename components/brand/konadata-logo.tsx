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

interface KonaDataWordmarkProps {
  /** Taille du texte en px (le nom occupe toute cette hauteur). */
  size?: number;
  /** Fond sombre (texte clair) ou fond clair (texte foncé). */
  tone?: 'onDark' | 'onLight';
  href?: string;
  className?: string;
  /** Affiche l'icône avant le texte (défaut : oui). */
  withIcon?: boolean;
  priority?: boolean;
}

/**
 * Wordmark KonaData en VRAIE typographie (texte, pas image) : le nom est écrit
 * en grands caractères gras et se dimensionne librement via `size`, pour un
 * rendu imposant et net à toutes les tailles.
 */
export function KonaDataWordmark({
  size = 30,
  tone = 'onDark',
  href,
  className,
  withIcon = true,
  priority = false,
}: KonaDataWordmarkProps) {
  const konaColor = tone === 'onDark' ? '#FFFFFF' : '#0A192F';
  const dataColor = tone === 'onDark' ? '#38BDF8' : '#2563EB';
  const iconPx = Math.round(size * 1.15);

  const content = (
    <span className={cn('inline-flex items-center', className)} style={{ gap: Math.round(size * 0.28) }}>
      {withIcon && (
        <Image
          src={KONADATA_ICON_SRC}
          alt=""
          width={512}
          height={512}
          priority={priority}
          className="object-contain"
          style={{ height: iconPx, width: iconPx }}
        />
      )}
      <span
        className="font-extrabold leading-none whitespace-nowrap"
        style={{ fontSize: size, letterSpacing: '-0.02em' }}
      >
        <span style={{ color: konaColor }}>Kona</span>
        <span style={{ color: dataColor }}>Data</span>
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center">
        {content}
      </Link>
    );
  }

  return content;
}
