'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LandingDashboardMockup } from '@/components/marketing/landing-dashboard-mockup';
import { SECTOR_SKETCHES } from '@/components/marketing/landing-sector-sketches';
import {
  LANDING_BRAND,
  LANDING_FEATURES,
  LANDING_SECTORS,
  LANDING_STEPS,
  LANDING_HERO_PILLS,
  LANDING_TRUST_PARTNERS,
  LANDING_AI_STRIP,
} from '@/lib/marketing/landing-content';
import { LANDING_LINKS } from '@/lib/marketing/landing-links';
import { KONADATA_CONTACT, whatsAppUrl } from '@/lib/marketing/contact';
import {
  ArrowRight,
  ClipboardList,
  Database,
  Shield,
  Layers,
  Sparkles,
  Wifi,
  CheckCircle2,
  Mail,
  MessageCircle,
  Zap,
  TrendingUp,
  ScanLine,
  FileText,
  Globe,
} from 'lucide-react';

const PILL_ICONS = {
  shield: Shield,
  layers: Layers,
  sparkles: Sparkles,
  wifi: Wifi,
} as const;

const AI_STRIP_ICONS = {
  zap: Zap,
  trending: TrendingUp,
  scan: ScanLine,
  file: FileText,
} as const;

const NAV_ANCHORS = [
  { href: '#secteurs', label: 'Secteurs' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#contact', label: 'Contact' },
] as const;

interface PublicLandingProps {
  /** Affiche un bandeau si l’utilisateur est déjà connecté (?accueil=1). */
  showLoggedInHint?: boolean;
}

export function PublicLanding({ showLoggedInHint = false }: PublicLandingProps) {
  const [contactLoading, setContactLoading] = useState(false);
  const [contactMsg, setContactMsg] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  async function handleContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setContactLoading(true);
    setContactMsg(null);
    setContactError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          organization: fd.get('organization'),
          message: fd.get('message'),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setContactError(json.error || 'Envoi impossible. Réessayez plus tard.');
      } else {
        setContactMsg('Message reçu. Nous vous recontacterons rapidement.');
        e.currentTarget.reset();
      }
    } catch {
      setContactError('Connexion impossible. Vérifiez votre réseau.');
    }
    setContactLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0A192F] text-white overflow-x-hidden scroll-smooth">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute top-1/3 -left-32 h-[400px] w-[400px] rounded-full bg-[#2563EB]/15 blur-[90px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0A192F]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href={LANDING_LINKS.home} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-[#2563EB]">
              <Database className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold">
              <span className="text-cyan-400">{LANDING_BRAND.logoAccent}</span>
              {LANDING_BRAND.logoRest}
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            {NAV_ANCHORS.map((a) => (
              <a key={a.href} href={a.href} className="hover:text-white transition-colors">
                {a.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60">
              <Globe className="h-3 w-3" />
              FR
            </div>
            <Button variant="ghost" size="sm" className="text-white/80 hidden sm:inline-flex" asChild>
              <Link href={LANDING_LINKS.loginStaff}>Connexion</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/25 bg-white/5 text-white hidden md:inline-flex text-xs sm:text-sm"
              asChild
            >
              <Link href={LANDING_LINKS.registerOrganization}>Créer une organisation</Link>
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-cyan-500 to-[#2563EB] border-0 text-xs sm:text-sm"
              asChild
            >
              <a href={LANDING_LINKS.contact}>Démo</a>
            </Button>
          </div>
        </div>
      </header>

      {/* ——— Une seule page : hero plein écran + bloc unique en dessous ——— */}
      <main className="relative pt-[57px]">
        {showLoggedInHint && (
          <div className="border-b border-cyan-500/30 bg-cyan-500/15 px-4 py-2.5 text-center text-sm text-cyan-100">
            Vous êtes connecté.{' '}
            <Link href="/mon-espace" className="font-medium underline hover:text-white">
              Accéder à mon espace
            </Link>
            {' · '}
            <Link href={LANDING_LINKS.loginStaff} className="underline hover:text-white">
              Connexion (autre compte)
            </Link>
            {' · '}
            <Link href={LANDING_LINKS.loginLearner} className="underline hover:text-white">
              Espace candidat / élève
            </Link>
          </div>
        )}
        {/* Hero = 1er écran */}
        <section className="relative min-h-[calc(100dvh-57px)] flex flex-col justify-center px-4 py-8">
          <div className="mx-auto w-full max-w-7xl grid lg:grid-cols-2 gap-8 lg:gap-10 items-center flex-1">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                IA CONNECTÉE
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-[2.5rem] font-bold leading-[1.12]">
                {LANDING_BRAND.heroPrefix}{' '}
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                  {LANDING_BRAND.heroHighlight}
                </span>{' '}
                {LANDING_BRAND.heroSuffix}
              </h1>
              <p className="mt-4 text-sm sm:text-base text-white/65 leading-relaxed max-w-lg">
                {LANDING_BRAND.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-[#2563EB] border-0 h-11"
                  asChild
                >
                  <Link href={LANDING_LINKS.registerOrganization}>
                    Créer une organisation
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-teal-400/40 bg-teal-500/10 text-white h-11"
                  asChild
                >
                  <Link href={LANDING_LINKS.registerSurveyOnly}>
                    Sondage uniquement
                    <ClipboardList className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white h-11"
                  asChild
                >
                  <Link href={LANDING_LINKS.registerLearner}>Candidat / élève</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white h-11 hidden sm:inline-flex"
                  asChild
                >
                  <Link href={LANDING_LINKS.registerJoin}>Compte staff</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white h-11"
                  asChild
                >
                  <Link href={LANDING_LINKS.loginStaff}>Se connecter</Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white/70 hover:text-white h-11"
                  asChild
                >
                  <Link href={LANDING_LINKS.rejoindre}>J&apos;ai un code</Link>
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                {LANDING_HERO_PILLS.map((p) => {
                  const Icon = PILL_ICONS[p.icon];
                  return (
                    <span key={p.label} className="flex items-center gap-1.5 text-[11px] text-white/50">
                      <Icon className="h-3.5 w-3.5 text-cyan-400/80" />
                      {p.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="relative pb-12 lg:pb-0 scale-[0.92] sm:scale-100 origin-center">
              <LandingDashboardMockup />
            </div>
          </div>

          <div className="mx-auto w-full max-w-7xl mt-auto pt-6 border-t border-white/10">
            <p className="text-center text-[10px] uppercase tracking-widest text-white/35 mb-3">
              Ils nous font confiance
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-4 sm:gap-x-10">
              {LANDING_TRUST_PARTNERS.map((partner) =>
                'logo' in partner && partner.logo ? (
                  <div
                    key={partner.name}
                    className="flex h-10 sm:h-12 items-center justify-center rounded-lg bg-white/95 px-3 py-1.5 shadow-sm"
                    title={partner.name}
                  >
                    <Image
                      src={partner.logo}
                      alt={partner.logoAlt ?? partner.name}
                      width={120}
                      height={40}
                      className="h-7 sm:h-8 w-auto max-w-[110px] sm:max-w-[130px] object-contain object-center"
                    />
                  </div>
                ) : (
                  <span
                    key={partner.name}
                    className="text-xs sm:text-sm font-semibold text-white/30"
                  >
                    {partner.name}
                  </span>
                )
              )}
            </div>
          </div>
        </section>

        {/* Bloc unique : tout le reste sur la même page (scroll continu) */}
        <section className="relative z-10 rounded-t-[2rem] sm:rounded-t-[2.5rem] bg-gradient-to-b from-slate-50 via-blue-50/40 to-teal-50/30 text-slate-900 shadow-[0_-20px_60px_rgba(0,0,0,0.35)] overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            aria-hidden
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, rgba(37,99,235,0.08) 0%, transparent 45%), radial-gradient(circle at 85% 60%, rgba(20,184,166,0.1) 0%, transparent 40%), radial-gradient(circle at 50% 90%, rgba(139,92,246,0.06) 0%, transparent 35%)',
            }}
          />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-14 space-y-14 sm:space-y-16">
            {/* Secteurs */}
            <div id="secteurs" className="scroll-mt-24">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <h2 className="text-xl sm:text-2xl font-bold">
                  Une plateforme.{' '}
                  <span className="bg-gradient-to-r from-cyan-600 to-[#2563EB] bg-clip-text text-transparent">
                    Des solutions par secteur.
                  </span>
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {LANDING_SECTORS.map((s) => {
                  const Sketch = SECTOR_SKETCHES[s.id];
                  return (
                    <Card
                      key={s.id}
                      className={`border shadow-md rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5 ${s.cardBg} ${s.cardBorder}`}
                    >
                      <CardHeader className="pb-1 p-5">
                        <div
                          className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${s.iconBg} text-white mb-3 shadow-md`}
                        >
                          <Sketch className="h-8 w-8" />
                        </div>
                        <CardTitle className="text-lg">{s.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 pt-0">
                        <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                        <Link
                          href={s.href}
                          className={`inline-flex items-center gap-1 mt-3 text-sm font-semibold ${s.accent} hover:opacity-80 transition-opacity`}
                        >
                          Découvrir <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* IA strip — intégré dans le même bloc */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl bg-[#0A192F] p-6 sm:p-8 text-white">
              {LANDING_AI_STRIP.map((item) => {
                const Icon = AI_STRIP_ICONS[item.icon];
                return (
                  <div key={item.title} className="flex flex-col items-center text-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-cyan-400" />
                    </div>
                    <p className="text-[11px] sm:text-xs font-medium text-white/85">{item.title}</p>
                  </div>
                );
              })}
            </div>

            {/* Fonctionnalités + étapes côte à côte sur grand écran */}
            <div id="fonctionnalites" className="scroll-mt-24 grid lg:grid-cols-2 gap-10 lg:gap-12">
              <div>
                <h2 className="text-xl font-bold mb-6">Fonctionnalités clés</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {LANDING_FEATURES.map((f) => (
                    <div
                      key={f.title}
                      className="rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${f.iconBg} mb-2`}>
                        <Sparkles className={`h-4 w-4 ${f.iconColor}`} />
                      </div>
                      <h3 className="font-semibold text-sm">{f.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold mb-6">Premiers pas</h2>
                <div className="space-y-5">
                  {LANDING_STEPS.map((s) => (
                    <div key={s.step} className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-[#2563EB] text-sm font-bold text-white">
                        {s.step}
                      </span>
                      <div>
                        <h3 className="font-semibold">{s.title}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button className="bg-[#2563EB]" size="sm" asChild>
                    <Link href={LANDING_LINKS.registerOrganization}>Créer une organisation</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={LANDING_LINKS.registerLearner}>Candidat / élève</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={LANDING_LINKS.loginLearner}>Connexion</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={LANDING_LINKS.rejoindre}>Code d&apos;accès</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Contact — fin de la même page */}
            <div id="contact" className="scroll-mt-24 grid lg:grid-cols-2 gap-8 items-start pb-4">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/50 to-teal-50/40 p-6 shadow-sm">
                <h2 className="text-xl sm:text-2xl font-bold mb-3">Demander une démo</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Direction ou partenaire — nous répondons sous 48 h. Rapports IA disponibles en mode
                  local, sans OpenAI.
                </p>
                <div className="flex flex-wrap gap-3 mb-5">
                  {LANDING_SECTORS.slice(0, 3).map((s) => {
                    const Sketch = SECTOR_SKETCHES[s.id];
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${s.cardBorder} ${s.cardBg}`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.iconBg} text-white`}>
                          <Sketch className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{s.title}</span>
                      </div>
                    );
                  })}
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Création d&apos;organisation ou code d&apos;invitation
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    École, ONG, BTP — un lien, une plateforme
                  </li>
                </ul>
                <div className="mt-6 space-y-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                  <p className="text-xs font-semibold text-emerald-800 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp direct
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {KONADATA_CONTACT.whatsapp.map((w) => (
                      <a
                        key={w.waMe}
                        href={whatsAppUrl(w.waMe, 'Bonjour KonaData — je souhaite une démo.')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                      >
                        {w.display}
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ou écrivez à{' '}
                    <a href={`mailto:${KONADATA_CONTACT.email}`} className="text-primary underline">
                      {KONADATA_CONTACT.email}
                    </a>
                  </p>
                </div>
              </div>
              <Card className="shadow-lg border border-slate-200/80 rounded-xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#2563EB]" />
                    Formulaire
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleContact} className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-name" className="text-xs">Nom *</Label>
                        <Input id="contact-name" name="name" required className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-email" className="text-xs">Email *</Label>
                        <Input id="contact-email" name="email" type="email" required className="h-9" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-org" className="text-xs">Organisation</Label>
                      <Input id="contact-org" name="organization" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-message" className="text-xs">Message *</Label>
                      <textarea
                        id="contact-message"
                        name="message"
                        required
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    {contactError && <p className="text-xs text-destructive">{contactError}</p>}
                    {contactMsg && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5">
                        {contactMsg}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 to-[#2563EB] border-0"
                      disabled={contactLoading}
                    >
                      {contactLoading ? 'Envoi…' : 'Envoyer'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          <footer className="relative border-t border-slate-200/80 bg-gradient-to-r from-white via-blue-50/30 to-teal-50/20 py-6 px-4">
            <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} {LANDING_BRAND.name}</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <Link href={LANDING_LINKS.registerOrganization} className="hover:text-[#2563EB]">
                  Créer une organisation
                </Link>
                <Link href={LANDING_LINKS.registerSurveyOnly} className="hover:text-[#2563EB]">
                  Sondage uniquement
                </Link>
                <Link href={LANDING_LINKS.registerLearner} className="hover:text-[#2563EB]">
                  Candidat / élève
                </Link>
                <Link href={LANDING_LINKS.registerJoin} className="hover:text-[#2563EB]">
                  Compte staff
                </Link>
                <Link href={LANDING_LINKS.loginLearner} className="hover:text-[#2563EB]">
                  Connexion
                </Link>
                <Link href={LANDING_LINKS.rejoindre} className="hover:text-[#2563EB]">Code d&apos;accès</Link>
              </div>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
