'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import { TuitionInstallmentsCard } from '@/components/school/tuition-installments-card';
import { EnrollmentDocumentLink } from '@/components/school/enrollment-document-link';
import { formatCurrency } from '@/lib/utils';
import type { TuitionBalance, TuitionInstallment } from '@/lib/school/student-payments';
import { ArrowLeft, Download, FileStack, MessageCircle, Phone, UserRound } from 'lucide-react';
import { getReportCardPdfBase64 } from '@/lib/actions/report-cards';
import { normalizeGuineaPhone } from '@/lib/survey/phone';

interface DossierProps {
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    matricule: string | null;
    status: string;
    className: string | null;
    classId: string | null;
  };
  guardian: {
    enrollmentId: string;
    name: string | null;
    phone: string | null;
    relation: string | null;
    smsConsent: boolean;
    academicYear: string;
  } | null;
  documents: Array<{
    id: string;
    enrollmentId: string | null;
    fileName: string;
    filePath: string | null;
    docType: string;
    docTypeLabel: string;
    date: string;
  }>;
  enrollments: Array<{
    id: string;
    status: string;
    academicYear: string;
    date: string;
    className: string;
    guardianName: string | null;
    guardianPhone: string | null;
    guardianRelation: string | null;
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
  balance: TuitionBalance | null;
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
    guardian,
    documents,
    enrollments,
    payments,
    bulletins,
    balance,
    tuitionInstallments,
    canRecordPayments,
  } = dossier;

  const guardianE164 = guardian?.phone ? normalizeGuineaPhone(guardian.phone) : null;
  const guardianWa = guardianE164
    ? `https://wa.me/${guardianE164.replace(/\D/g, '')}`
    : null;

  async function downloadBulletin(cardId: string) {
    const res = await getReportCardPdfBase64(cardId);
    if ('error' in res && res.error) return;
    if (!('base64' in res) || !res.base64 || !res.fileName) return;
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
            <CardTitle className="text-sm">Dossier élève</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>{student.email || '—'}</p>
            {student.phone && <p>{student.phone}</p>}
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

        <Card className="md:col-span-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" />
              Tuteur / responsable
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {guardian ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-base">{guardian.name || 'Non renseigné'}</p>
                    {guardian.relation && (
                      <p className="text-muted-foreground">Lien : {guardian.relation}</p>
                    )}
                    <p className="font-mono">{guardian.phone || '—'}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline" className="text-xs">
                        Année {guardian.academicYear}
                      </Badge>
                      {guardian.smsConsent ? (
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-200">
                          Notifications WhatsApp/SMS acceptées
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pas de consentement notifications
                        </Badge>
                      )}
                    </div>
                  </div>
                  {guardian.phone && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={`tel:${guardian.phone}`}>
                          <Phone className="h-3.5 w-3.5 mr-1" />
                          Appeler
                        </a>
                      </Button>
                      {guardianWa && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={guardianWa} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5 mr-1" />
                            WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  <Link
                    href="/etablissement/candidatures"
                    className="text-primary underline"
                  >
                    Ouvrir la candidature complète
                  </Link>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Aucun tuteur renseigné sur les inscriptions de cet élève.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
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

      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileStack className="h-4 w-4 text-primary" />
              Documents du dossier ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <EnrollmentDocumentLink fileName={doc.fileName} filePath={doc.filePath} />
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.docTypeLabel} · {doc.date}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {enrollments.length > 0 && (
        <DataTable
          title="Historique inscription"
          data={enrollments.map((e) => ({
            id: e.id,
            annee: e.academicYear,
            classe: e.className,
            tuteur: e.guardianName || '—',
            telephone: e.guardianPhone || '—',
            lien: e.guardianRelation || '—',
            date: e.date,
            statut: statusLabels[e.status] || e.status,
          }))}
          columns={[
            { key: 'annee', label: 'Année' },
            { key: 'classe', label: 'Classe' },
            { key: 'tuteur', label: 'Tuteur' },
            { key: 'telephone', label: 'Téléphone' },
            { key: 'lien', label: 'Lien' },
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
