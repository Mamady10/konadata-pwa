import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';

export function AuthBackHome({ className = '' }: { className?: string }) {
  return (
    <Link
      href={`${LANDING_LINKS.home}?accueil=1`}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      Retour à l&apos;accueil
    </Link>
  );
}
