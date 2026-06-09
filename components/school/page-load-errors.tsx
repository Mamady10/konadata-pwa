interface Props {
  errors: string[];
}

export function PageLoadErrors({ errors }: Props) {
  if (!errors.length) return null;
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-1">
      <p className="text-sm font-medium text-destructive">Certaines données n&apos;ont pas pu être chargées</p>
      <ul className="text-sm text-destructive/90 list-disc pl-5 space-y-0.5">
        {errors.map((err) => (
          <li key={err}>{err}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground pt-1">
        Si le message mentionne une colonne manquante, appliquez les migrations Supabase 088 à 091.
      </p>
    </div>
  );
}
