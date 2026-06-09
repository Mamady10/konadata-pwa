'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, GraduationCap, PlayCircle, Upload } from 'lucide-react';
import { STUDENT_IMPORT_TEMPLATE_CSV } from '@/lib/school/student-import';

interface Props {
  hasClasses: boolean;
  hasStudents: boolean;
  compact?: boolean;
}

export function SchoolStarterPack({ hasClasses, hasStudents, compact }: Props) {
  if (hasStudents && hasClasses) return null;

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF', STUDENT_IMPORT_TEMPLATE_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-liste-classe-konadata.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className={compact ? 'border-dashed' : 'border-primary/20 bg-primary/[0.02]'}>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Pack démarrage — 5 minutes
        </CardTitle>
        <CardDescription>
          Classes → tarifs scolarité → import liste → paiements familles. Suivez la checklist sur ce
          tableau de bord.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {!hasClasses && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/etablissement/formations">1. Créer une classe</Link>
          </Button>
        )}
        {hasClasses && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/parametres/annee-scolaire">2. Tarifs & année scolaire</Link>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={downloadTemplate}>
          <Download className="h-3 w-3 mr-1" />
          Modèle liste vierge
        </Button>
        <Button size="sm" className="bg-[#2563EB]" asChild>
          <Link href="/etablissement/etudiants/import">
            <Upload className="h-3 w-3 mr-1" />
            Importer ma liste
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/parametres/paiements-eleves">
            <PlayCircle className="h-3 w-3 mr-1" />
            Paiements familles
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
