'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { createStudent } from '@/lib/actions/school';
import { personName, personEmail } from '@/lib/school/person-utils';
import { PageLoadErrors } from '@/components/school/page-load-errors';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Download, Plus, Upload, User } from 'lucide-react';
import { exportStudentMatriculesCsv } from '@/lib/actions/student-matricules';

const statusLabels: Record<string, string> = {
  pending: 'En attente', admitted: 'Admis', enrolled: 'Inscrit',
  rejected: 'Refusé', graduated: 'Diplômé', withdrawn: 'Retiré',
};

interface Props {
  students: Array<Record<string, unknown>>;
  classes: Array<{ id: string; name: string }>;
  canManage: boolean;
  readOnly?: boolean;
  withoutMatriculeCount?: number;
  loadErrors?: string[];
}

export function EtudiantsClient({
  students,
  classes,
  canManage,
  readOnly,
  withoutMatriculeCount = 0,
  loadErrors = [],
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('enrolled');

  async function handleCreate(formData: FormData) {
    formData.set('class_id', classId);
    formData.set('enrollment_status', status);
    const res = await createStudent(formData);
    if (res.error) {
      setFormMsg(res.error);
      return;
    }
    setFormMsg('Élève créé.');
    setShowForm(false);
    router.refresh();
  }

  async function handleExportCodes() {
    setExporting(true);
    setFormMsg(null);
    const res = await exportStudentMatriculesCsv();
    setExporting(false);
    if ('error' in res && res.error) {
      setFormMsg(res.error);
      return;
    }
    const blob = new Blob(['\uFEFF', res.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = students.map((s) => ({
    id: s.id as string,
    nom: personName(s),
    matricule: (s.matricule as string) || '—',
    classe: ((s.school_classes as { name?: string })?.name) || '—',
    sansClasse: s.enrollment_status === 'enrolled' && !s.class_id,
    email: personEmail(s),
    statut: statusLabels[s.enrollment_status as string] || String(s.enrollment_status),
  }));

  return (
    <div className="space-y-6">
      <PageLoadErrors errors={loadErrors} />
      {formMsg && <p className="text-sm text-muted-foreground">{formMsg}</p>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{readOnly ? 'Effectifs élèves' : 'Élèves / Étudiants'}</h1>
          <p className="text-muted-foreground">
            {rows.length} élève{rows.length !== 1 ? 's' : ''} — {readOnly ? 'vue comptable (lecture seule)' : 'gestion scolarité'}
            {withoutMatriculeCount > 0 && (
              <> · {withoutMatriculeCount} sans code élève — utilisez le panneau ci-dessus ou l&apos;import</>
            )}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/etablissement/etudiants/import">
                <Upload className="h-4 w-4" /> Importer (Excel, PDF scan, photo…)
              </Link>
            </Button>
            <Button variant="outline" onClick={handleExportCodes} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? 'Export…' : 'Codes élèves (CSV)'}
            </Button>
            <Button onClick={() => setShowForm(!showForm)} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
              <Plus className="h-4 w-4" /> Ajouter un élève
            </Button>
          </div>
        )}
      </div>

      {canManage && showForm && (
        <Card>
          <CardHeader><CardTitle>Nouvel élève</CardTitle></CardHeader>
          <CardContent>
            <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nom complet *</Label><Input name="full_name" required /></div>
              <div className="space-y-2"><Label>Matricule</Label><Input name="matricule" /></div>
              <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input name="phone" /></div>
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="bg-[#2563EB]">Enregistrer</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <DataTable
        title="Liste des élèves"
        data={rows}
        columns={[
          { key: 'nom', label: 'Nom' },
          {
            key: 'matricule',
            label: 'Code élève',
            render: (item) =>
              item.matricule === '—' ? (
                <span className="text-amber-700 text-xs font-medium">À attribuer</span>
              ) : (
                <span className="font-mono text-xs">{item.matricule as string}</span>
              ),
          },
          {
            key: 'classe',
            label: 'Classe',
            render: (item) => (
              <div className="flex flex-col gap-1">
                <span>{String(item.classe)}</span>
                {item.sansClasse ? (
                  <Badge variant="warning" className="w-fit text-[10px]">
                    Sans classe
                  </Badge>
                ) : null}
              </div>
            ),
          },
          { key: 'email', label: 'Email' },
          { key: 'statut', label: 'Statut', render: (item) => <StatusBadge status={item.statut as string} /> },
          {
            key: 'fiche',
            label: 'Fiche',
            render: (item) => (
              <Button size="sm" variant="ghost" className="h-7" asChild>
                <Link href={`/etablissement/etudiants/${item.id}`}>
                  <User className="h-3 w-3 mr-1" />
                  Dossier
                </Link>
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
