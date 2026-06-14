import { KonaDataLogo } from '@/components/brand/konadata-logo';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { cn } from '@/lib/utils';

interface AuthPageBrandProps {
  className?: string;
  height?: number;
}

/** Logo wordmark KonaData en tête des pages d'authentification. */
export function AuthPageBrand({ className, height = 40 }: AuthPageBrandProps) {
  return (
    <div className={cn('flex justify-center mb-8', className)}>
      <KonaDataLogo href={LANDING_LINKS.home} variant="wordmark" height={height} />
    </div>
  );
}
