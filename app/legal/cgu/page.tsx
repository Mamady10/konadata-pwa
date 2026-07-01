import Link from 'next/link';
import { CGU_SECTIONS, CGU_TITLE, CURRENT_CGU_VERSION } from '@/lib/legal/cgu';
import { Button } from '@/components/ui/button';

export default function LegalCguPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href="/">← Accueil</Link>
          </Button>
          <h1 className="text-3xl font-bold">{CGU_TITLE}</h1>
          <p className="text-muted-foreground mt-2">Version {CURRENT_CGU_VERSION}</p>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          {CGU_SECTIONS.map((s) => (
            <section key={s.id}>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
