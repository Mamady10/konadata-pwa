'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Check } from 'lucide-react';
import { assignStudentClass, type UnassignedEnrolledStudent } from '@/lib/actions/school';

interface Props {
  students: UnassignedEnrolledStudent[];
  classes: { id: string; name: string }[];
  canReassign: boolean;
}

export function UnassignedStudentsCard({ students, classes, canReassign }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const pending = students.filter((s) => !doneIds.has(s.id));
  if (students.length === 0) return null;

  async function handleAssign(studentId: string) {
    const classId = selection[studentId];
    if (!classId) return;
    setSavingId(studentId);
    setError(null);
    const res = await assignStudentClass(studentId, classId);
    setSavingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDoneIds((prev) => new Set(prev).add(studentId));
    router.refresh();
  }

  return (
    <Card className="border-amber-500/40 bg-amber-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Élèves inscrits sans classe active ({pending.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ces élèves inscrits ne sont rattachés à aucune classe active de l&apos;année en
          cours : leur scolarité est comptée dans « Autres inscrits » mais pas dans une
          classe. Affectez-les pour fiabiliser le suivi financier par classe.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {pending.length === 0 ? (
          <p className="text-sm text-emerald-700 flex items-center gap-1">
            <Check className="h-4 w-4" /> Tous les élèves ont été affectés.
          </p>
        ) : (
          pending.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.reason === 'inactive_class'
                    ? `Classe hors année en cours : ${s.currentClassName ?? '—'}`
                    : 'Aucune classe'}
                </p>
              </div>
              {canReassign ? (
                <>
                  <Select
                    value={selection[s.id] ?? ''}
                    onValueChange={(v) => setSelection((prev) => ({ ...prev, [s.id]: v }))}
                  >
                    <SelectTrigger className="h-9 w-52">
                      <SelectValue placeholder="Choisir une classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#2563EB]"
                    disabled={!selection[s.id] || savingId === s.id}
                    onClick={() => void handleAssign(s.id)}
                  >
                    {savingId === s.id ? 'Affectation…' : 'Affecter'}
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Réservé à la gestion des élèves
                </span>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
