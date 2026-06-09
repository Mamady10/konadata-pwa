'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { TuitionInstallmentsCard } from '@/components/school/tuition-installments-card';
import { formatCurrency } from '@/lib/utils';
import type { TuitionInstallment } from '@/lib/school/student-payments';
import { ArrowLeft, Download } from 'lucide-react';
import { getReportCardPdfBase64 } from '@/lib/actions/report-cards';

interface DossierProps {
  student: {
    id: string;
    name: string;
    email: string;
    matricule: string | null;
    status: string;
    className: string | null;
    classId: string | null;
  };
  enrollments: Array<{
    id: string;
    status: string;
    academicYear: string;
    date: string;
    className: string;
    guardianName: string | null;
    guardianPhone: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    kind: string;
    method: string;
    date: string;
  }>;
  bulletins: Array<{
    id: string;
    semester: string;
    academicYear: string;
    average: number | null;
    rank: number | null;
    status: string;
    date: string;
  }>;
  balance: {
    total_due_gnf: number;
    paid_gnf: number;
    remaining_gnf: number;
    fully_paid?: boolean;
    academic_year?: string;
  } | null;
  tuitionInstallments: TuitionInstallment[];
  canRecordPayments: boolean;
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  admitted: 'Admis',
  enrolled: 'Inscrit',
  rejected: 'Refusé',
};

export function StudentDossierClient({ dossier }: { dossier: DossierProps }) {
  const {
    student,
    enrollments,
    payments,
    bulletins,
    balance,
    tuitionInstallments,
    canRecordPayments,
  } = dossier;

  async function downloadBulletin(cardId: string) {
    const res = await getReportCardPdfBase64(cardId);
    if ('error' in res && res.error) return;
    if (!res.base64 || !res.fileName) return;
    const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/etablissement/etudiants">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <p className="text-muted-foreground text-sm">
            {student.matricule || 'Sans matricule'} · {student.className || 'Sans classe'} ·{' '}
            {statusLabels[student.status] || student.status}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dossier</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>{student.email || '—'}</p>
            {!student.classId && student.status === 'enrolled' && (
              <Badge variant="warning">Sans classe</Badge>
            )}
            <p className="text-muted-foreground pt-2">
              <Link href="/etablissement/candidatures" className="text-primary underline">
                Voir candidatures
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scolarité</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {balance ? (
              tuitionInstallments.length > 0 ? (
                <TuitionInstallmentsCard
                  installments={tuitionInstallments}
                  balance={balance}
                />
              ) : (
                <div className="space-y-1">
                  <p>Total : {formatCurrency(balance.total_due_gnf)}</p>
                  <p>Payé : {formatCurrency(balance.paid_gnf)}</p>
                  <p className="font-medium">Reste : {formatCurrency(balance.remaining_gnf)}</p>
                </div>
              )
            ) : (
              <p className="text-muted-foreground">Aucun solde calculé</p>
            )}
            {canRecordPayments && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/etablissement/paiements">Enregistrer un paiement</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bulletins</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{bulletins.length} bulletin(s)</p>
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link href="/etablissement/bulletins">Tous les bulletins</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {enrollments.length > 0 && (
        <DataTable
          title="Historique inscription"
          data={enrollments.map((e) => ({
            id: e.id,
            annee: e.academicYear,
            classe: e.className,
            tuteur: e.guardianName || '—',
            telephone: e.guardianPhone || '—',
            date: e.date,
            statut: statusLabels[e.status] || e.status,
          }))}
          columns={[
            { key: 'annee', label: 'Année' },
            { key: 'classe', label: 'Classe' },
            { key: 'tuteur', label: 'Tuteur' },
            { key: 'telephone', label: 'Téléphone' },
            { key: 'date', label: 'Date' },
            { key: 'statut', label: 'Statut', render: (i) => <StatusBadge status={i.statut as string} /> },
          ]}
        />
      )}

      {payments.length > 0 && (
        <DataTable
          title="Paiements"
          data={payments.map((p) => ({
            id: p.id,
            montant: formatCurrency(p.amount),
            type: p.kind,
            methode: p.method,
            date: p.date,
            statut: p.status,
          }))}
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'montant', label: 'Montant' },
            { key: 'type', label: 'Type' },
            { key: 'methode', label: 'Méthode' },
            { key: 'statut', label: 'Statut', render: (i) => <StatusBadge status={i.statut as string} /> },
          ]}
        />
      )}

      {bulletins.length > 0 && (
        <DataTable
          title="Bulletins"
          data={bulletins.map((b) => ({
            id: b.id,
            periode: `${b.semester} ${b.academicYear}`,
            moyenne: b.average != null ? b.average.toFixed(2) : '—',
            rang: b.rank ?? '—',
            statut: b.status === 'final' ? 'Définitif' : 'Provisoire',
            date: b.date,
          }))}
          columns={[
            { key: 'periode', label: 'Période' },
            { key: 'moyenne', label: 'Moyenne' },
            { key: 'rang', label: 'Rang' },
            { key: 'statut', label: 'Statut' },
            { key: 'date', label: 'Date' },
            {
              key: 'pdf',
              label: 'PDF',
              render: (item) => (
                <Button size="sm" variant="ghost" onClick={() => downloadBulletin(item.id as string)}>
                  <Download className="h-3 w-3" />
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
