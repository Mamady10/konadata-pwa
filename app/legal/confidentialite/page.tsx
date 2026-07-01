import Link from 'next/link';
import { DPA_SECTIONS, DPA_TITLE, CURRENT_DPA_VERSION } from '@/lib/legal/dpa';
import { DATA_STORAGE_SECTIONS, DATA_STORAGE_FAQ_TITLE } from '@/lib/legal/data-storage';
import { Button } from '@/components/ui/button';

export default function LegalConfidentialitePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href="/">← Accueil</Link>
          </Button>
          <h1 className="text-3xl font-bold">Confidentialité &amp; données</h1>
          <p className="text-muted-foreground mt-2">KonaData — documentation publique</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{DATA_STORAGE_FAQ_TITLE}</h2>
          {DATA_STORAGE_SECTIONS.map((s) => (
            <div key={s.id} className="space-y-2">
              <h3 className="font-medium">{s.title}</h3>
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-4 border-t pt-8">
          <h2 className="text-xl font-semibold">{DPA_TITLE}</h2>
          <p className="text-sm text-muted-foreground">Version {CURRENT_DPA_VERSION}</p>
          {DPA_SECTIONS.map((s) => (
            <div key={s.id} className="space-y-2">
              <h3 className="font-medium text-sm">{s.title}</h3>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
