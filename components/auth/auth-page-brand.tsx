import { KonaDataLogo } from '@/components/brand/konadata-logo';
import { KONADATA_TAGLINE } from '@/lib/brand/konadata-brand';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { cn } from '@/lib/utils';

interface AuthPageBrandProps {
  className?: string;
  height?: number;
  /** Affiche le slogan sous le logo (défaut : oui). */
  showTagline?: boolean;
}

/** Logo wordmark KonaData en tête des pages d'authentification. */
export function AuthPageBrand({
  className,
  height = 40,
  showTagline = true,
}: AuthPageBrandProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 mb-8', className)}>
      <KonaDataLogo href={LANDING_LINKS.home} variant="wordmark" height={height} />
      {showTagline && (
        <p className="text-xs font-medium tracking-wide text-muted-foreground">{KONADATA_TAGLINE}</p>
      )}
    </div>
  );
}
