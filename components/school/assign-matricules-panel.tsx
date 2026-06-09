'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Hash, Sparkles } from 'lucide-react';
import {
  assignMatriculesBulk,
  type MatriculeAssignClassBreakdown,
} from '@/lib/actions/student-matricules';

interface Props {
  total: number;
  assignable: number;
  byClass: MatriculeAssignClassBreakdown[];
  compact?: boolean;
}

export function AssignMatriculesPanel({ total, assignable, byClass, compact }: Props) {
  const router = useRouter();
  const [classFilter, setClassFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (total <= 0) return null;

  const filteredAssignable =
    classFilter === 'all'
      ? assignable
      : byClass.find((c) => c.classId === classFilter)?.assignable ?? 0;

  const noClassCount = byClass.find((c) => c.classId === null)?.count ?? 0;

  async function handleAssign() {
    const target =
      classFilter === 'all'
        ? null
        : classFilter === '__none__'
          ? null
          : classFilter;

    if (classFilter !== 'all' && classFilter !== '__none__' && filteredAssignable === 0) {
      setMsg('Aucun élève assignable dans cette classe.');
      return;
    }

    const label =
      classFilter === 'all'
        ? `${assignable} élève(s) avec une classe`
        : `${filteredAssignable} élève(s) dans la classe sélectionnée`;

    if (
      !window.confirm(
        `Attribuer un code élève KonaData à ${label} ?\n\nLes codes déjà présents ne seront pas modifiés.`
      )
    ) {
      return;
    }

    setLoading(true);
    setMsg(null);
    const res = await assignMatriculesBulk(target);
    setLoading(false);

    if ('error' in res) {
      setMsg(res.error);
      return;
    }

    const parts = [`${res.assigned} code(s) attribué(s)`];
    if (res.skipped_no_class > 0) {
      parts.push(`${res.skipped_no_class} sans classe (à rattacher d'abord)`);
    }
    if (res.skipped_race > 0) {
      parts.push(`${res.skipped_race} déjà traité(s) entre-temps`);
    }
    setMsg(parts.join(' · '));
    router.refresh();
  }

  const assignableClasses = byClass.filter((c) => c.classId && c.assignable > 0);

  return (
    <Card className={compact ? 'border-violet-500/40 bg-violet-500/5' : 'border-violet-500/40'}>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className={`flex items-center gap-2 ${compact ? 'text-base' : ''}`}>
          <Hash className="h-4 w-4 text-violet-600" />
          {total} élève{total !== 1 ? 's' : ''} sans code KonaData
        </CardTitle>
        <CardDescription>
          {assignable > 0 ? (
            <>
              {assignable} peuvent recevoir un code maintenant (classe renseignée).
              {noClassCount > 0 && (
                <> {noClassCount} sans classe — rattachez-les avant attribution.</>
              )}
            </>
          ) : (
            <>Rattachez chaque élève à une classe, puis attribuez les codes.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {assignableClasses.length > 0 && (
          <div className="space-y-1 min-w-[200px]">
            <p className="text-xs text-muted-foreground">Périmètre</p>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes ({assignable})</SelectItem>
                {assignableClasses.map((c) => (
                  <SelectItem key={c.classId!} value={c.classId!}>
                    {c.className} ({c.assignable})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          className="bg-violet-600 hover:bg-violet-600/90"
          disabled={loading || filteredAssignable === 0}
          onClick={handleAssign}
        >
          <Sparkles className="h-4 w-4" />
          {loading ? 'Attribution…' : 'Attribuer les codes élève'}
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/parametres/codes-eleves">Format des codes</Link>
        </Button>
        {msg && <p className="text-sm w-full text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
