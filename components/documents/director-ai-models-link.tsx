import Link from 'next/link';

interface Props {
  hint?: string;
}

export function DirectorAiModelsLink({
  hint = 'définissez un exemple par type pour guider l\'adaptation automatique',
}: Props) {
  return (
    <p className="text-sm mt-2">
      <Link href="/parametres/modeles" className="text-primary underline">
        Modèles IA
      </Link>
      {' '}
      — {hint}.
    </p>
  );
}
