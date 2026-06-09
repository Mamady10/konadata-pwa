'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, StatusBadge } from '@/components/dashboard/data-table';
import {
  submitEnrollmentDossier,
  updateEnrollmentStatus,
  type EnrollmentDocumentRow,
} from '@/lib/actions/school';
import { EnrollmentDocumentLink } from '@/components/school/enrollment-document-link';
import { uploadDocument } from '@/lib/actions/storage';
import { ENROLLMENT_DOCUMENT_TYPES } from '@/lib/school/enrollment-document-types';
import { personName } from '@/lib/school/person-utils';
import { DocumentAiGuidance } from '@/components/documents/document-ai-guidance';
import { DirectorAiModelsLink } from '@/components/documents/director-ai-models-link';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Check, X, FileStack, Send } from 'lucide-react';
import { StudentPaymentButton } from '@/components/school/student-payment-button';
import { LearnerEnrollmentFeesCard } from '@/components/school/learner-enrollment-fees-card';
import {
  buildEnrollmentFeeBreakdown,
  canPayTuitionForEnrollment,
  classFromEnrollment,
} from '@/lib/school/enrollment-fees';
import type { StudentPaymentSettings } from '@/lib/school/student-payments';
import type { StudentPaymentKind } from '@/lib/school/student-payments';
import { formatCurrency } from '@/lib/utils';
import { ReenrollmentCodesPanel } from '@/components/school/reenrollment-codes-panel';
import { ENROLLMENT_UPLOAD_ACCEPT } from '@/lib/school/enrollment-upload';

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  admitted: 'Admis',
  enrolled: 'Inscrit',
  rejected: 'Refusé',
};

const requestTypeLabels: Record<string, string> = {
  new: 'Inscription',
  reenrollment: 'Réinscription',
};

type RequestFilter = 'all' | 'new' | 'reenrollment';

interface ReenrollmentCodeRow {
  id: string;
  code: string;
  legacy_reference: string | null;
  is_active: boolean;
  used_at: string | null;
  created_at: string;
}

interface Props {
  enrollments: Array<Record<string, unknown>>;
  classes: Array<{ id: string; name: string }>;
  documents: EnrollmentDocumentRow[];
  canManage: boolean;
  canApplySelf: boolean;
  canCreateRequest?: boolean;
  canSubmitDocuments?: boolean;
  canViewDocuments: boolean;
  isDirector?: boolean;
  reenrollmentCodes?: ReenrollmentCodeRow[];
  loadErrors?: string[];
  organizationName?: string;
  reenrollmentCodeExample?: string;
  studentPaymentSettings?: StudentPaymentSettings | null;
  paymentSettingsByOrg?: Record<string, StudentPaymentSettings>;
  orgTuitionDefaults?: Record<string, number>;
}

export function CandidaturesClient({
  enrollments,
  classes,
  documents,
  canManage,
  canApplySelf,
  canCreateRequest = false,
  canSubmitDocuments = false,
  canViewDocuments,
  isDirector,
  reenrollmentCodes = [],
  loadErrors = [],
  organizationName,
  reenrollmentCodeExample,
  studentPaymentSettings = null,
  paymentSettingsByOrg = {},
  orgTuitionDefaults = {},
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadEnrollmentId, setUploadEnrollmentId] = useState('');
  const [docType, setDocType] = useState('');
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all');
  const [enrollModal, setEnrollModal] = useState<{
    enrollmentId: string;
    classId: string;
    applicantName: string;
  } | null>(null);

  const showNewRequestButton = canCreateRequest;
  const showDocumentUpload = canSubmitDocuments;

  const matchesRequestFilter = (rt: string | null | undefined) => {
    if (requestFilter === 'all') return true;
    return (rt || 'new') === requestFilter;
  };

  const myActiveEnrollment = useMemo(() => {
    if (uploadEnrollmentId) {
      return enrollments.find((e) => e.id === uploadEnrollmentId) ?? null;
    }
    const pending = enrollments.filter((e) => (e.status as string) === 'pending');
    return pending[0] ?? enrollments[0] ?? null;
  }, [enrollments, uploadEnrollmentId]);

  useEffect(() => {
    if (!canApplySelf || canManage) return;
    const id = myActiveEnrollment?.id as string | undefined;
    if (id && !uploadEnrollmentId) setUploadEnrollmentId(id);
  }, [canApplySelf, canManage, myActiveEnrollment, uploadEnrollmentId]);
  function settingsForOrg(orgId: string | undefined): StudentPaymentSettings | null {
    if (!orgId) return studentPaymentSettings;
    return paymentSettingsByOrg[orgId] ?? studentPaymentSettings;
  }

  function studentIdFromEnrollment(e: Record<string, unknown>): string | null {
    const direct = e.student_id as string | undefined;
    if (direct) return direct;
    const nested = e.school_students as { id?: string } | { id?: string }[] | null;
    if (Array.isArray(nested)) return nested[0]?.id ?? null;
    return nested?.id ?? null;
  }

  function paymentKindForEnrollment(
    requestType: string,
    status: string,
    settings: StudentPaymentSettings | null | undefined,
    studentId: string | null
  ): StudentPaymentKind | null {
    if (!settings?.enabled || !studentId) return null;
    const rt = requestType || 'new';
    if (['pending', 'admitted', 'enrolled'].includes(status)) {
      if (rt === 'reenrollment' && settings.allow_reenrollment_payment) {
        return 'reenrollment';
      }
      if (rt === 'new' && settings.allow_enrollment_payment) {
        return 'enrollment';
      }
    }
    return null;
  }

  const anyOnlinePaymentEnabled = Object.values(paymentSettingsByOrg).some((s) => s.enabled);
  const enrollmentOrgIds = useMemo(
    () =>
      [
        ...new Set(
          enrollments
            .map((e) => e.organization_id as string | undefined)
            .filter((id): id is string => Boolean(id))
        ),
      ],
    [enrollments]
  );

  const title =
    canApplySelf && !canManage
      ? 'Mon inscription / réinscription'
      : canViewDocuments && !canManage
        ? 'Dossiers inscription & réinscription'
        : 'Candidatures & Inscriptions';

  function enrollmentClassId(e: Record<string, unknown>): string {
    return (e.class_id as string) || '';
  }

  function openEnrollModal(item: Record<string, unknown>) {
    const eid = item.id as string;
    const enrollment = filteredEnrollments.find((e) => e.id === eid);
    const prefill = enrollment ? enrollmentClassId(enrollment) : '';
    setEnrollModal({
      enrollmentId: eid,
      classId: prefill || (classes[0]?.id ?? ''),
      applicantName: String(item.nom),
    });
  }

  async function handleStatus(
    id: string,
    status: string,
    options?: { classId?: string | null }
  ) {
    setLoading(true);
    setMessage(null);
    const result = await updateEnrollmentStatus(id, status, {
      classId: options?.classId,
    });
    if ('error' in result) setMessage(result.error);
    else {
      const labels: Record<string, string> = {
        admitted: 'Demande validée (admis). L’élève verra le statut dans son compte.',
        enrolled: 'Inscription confirmée. L’élève verra le statut dans son compte.',
        rejected: 'Demande refusée. L’élève en sera informé dans son compte.',
      };
      setMessage(labels[status] ?? 'Statut mis à jour.');
      router.refresh();
    }
    setLoading(false);
  }

  async function handleFinalizeDossier(enrollmentId: string) {
    setLoading(true);
    setMessage(null);
    const result = await submitEnrollmentDossier(enrollmentId);
    if ('error' in result) setMessage(result.error);
    else {
      setMessage('Dossier transmis à l’établissement. La scolarité peut maintenant le traiter.');
      router.refresh();
    }
    setLoading(false);
  }

  async function handleUpload(enrollmentId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!docType) {
      setMessage('Choisissez le type de document avant de téléverser.');
      return;
    }
    const fd = new FormData();
    fd.set('file', file);
    fd.set('enrollment_id', enrollmentId);
    fd.set('doc_type', docType);
    const result = await uploadDocument(fd);
    if ('error' in result) setMessage(result.error ?? 'Erreur de téléversement');
    else {
      setMessage('Document téléversé');
      router.refresh();
    }
    e.target.value = '';
  }

  const docsByEnrollment = documents.reduce<Record<string, EnrollmentDocumentRow[]>>((acc, d) => {
    if (!d.enrollmentId) return acc;
    const list = acc[d.enrollmentId] ?? [];
    list.push(d);
    acc[d.enrollmentId] = list;
    return acc;
  }, {});

  const filteredEnrollments = enrollments.filter((e) =>
    matchesRequestFilter(e.request_type as string)
  );

  const filteredDocuments = documents.filter((d) =>
    matchesRequestFilter(d.requestType)
  );

  const rows = filteredEnrollments.map((e) => {
    const orgId = e.organization_id as string | undefined;
    const { name: className } = classFromEnrollment(e);
    const rowSettings = orgId ? paymentSettingsByOrg[orgId] : undefined;
    const fees = buildEnrollmentFeeBreakdown(
      e,
      rowSettings,
      orgId ? (orgTuitionDefaults[orgId] ?? 1_500_000) : 1_500_000
    );
    return {
    id: e.id as string,
    orgId,
    studentId: studentIdFromEnrollment(e),
    className: className || '—',
    tuitionFeeGnf: fees.tuitionFeeGnf,
    rawRequestType: (e.request_type as string) || 'new',
    nom: (e.applicant_name as string) || personName(e.school_students as Record<string, unknown>) || '—',
    typeDemande: requestTypeLabels[(e.request_type as string) || 'new'] || '—',
    niveau: (e.study_level as string) || '—',
    departement: (e.department as string) || '—',
    filiere: (e.program as string) || '—',
    codeReinscription: (e.reenrollment_verification_code as string) || '—',
    codeVerifie: e.reenrollment_code_verified ? 'Oui' : (e.request_type === 'reenrollment' ? 'À vérifier' : '—'),
    etablissement: ((e.organizations as { name?: string })?.name) || '—',
    classe:
      className && ['admitted', 'enrolled'].includes(fees.status)
        ? className
        : ((e.school_classes as { name?: string })?.name) || '—',
    sansClasse:
      fees.status === 'enrolled' && !className && !(e.school_classes as { name?: string })?.name,
    enrollmentClassId: (e.class_id as string) || '',
    annee: e.academic_year as string,
    date: new Date(e.created_at as string).toLocaleDateString('fr-FR'),
    statut: statusLabels[e.status as string] || String(e.status),
    rawStatus: e.status as string,
    docCount: (docsByEnrollment[e.id as string] ?? []).length,
    dossierDepose: e.dossier_submitted_at
      ? new Date(e.dossier_submitted_at as string).toLocaleDateString('fr-FR')
      : '—',
    dossierSoumis: Boolean(e.dossier_submitted_at),
    showTuition: canPayTuitionForEnrollment(fees.status, className, rowSettings),
  };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">
            {canManage
              ? 'Analysez les dossiers, les pièces jointes et validez les admissions'
              : canViewDocuments && !canManage
                ? 'Consultez les pièces déposées par les candidats (inscription / réinscription)'
                : 'Consultez vos demandes par établissement. Vous pouvez en créer plusieurs pour le même établissement.'}
          </p>
          {isDirector && (
            <DirectorAiModelsLink hint="dossier inscription et bulletin pour les pièces déposées" />
          )}
        </div>
        {showNewRequestButton && (
          <Button asChild className="bg-[#2563EB] hover:bg-[#2563EB]/90">
            <Link href="/inscription-etablissement?nouvelle=1">
              <Plus className="h-4 w-4" />
              Nouvelle demande (même établissement possible)
            </Link>
          </Button>
        )}
      </div>

      {organizationName && canManage && (
        <p className="text-sm text-muted-foreground">
          Établissement affiché : <strong>{organizationName}</strong> — seules les demandes rattachées à
          cet établissement apparaissent ici.
        </p>
      )}

      {loadErrors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive space-y-1">
          {loadErrors.map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{message}</div>
      )}

      {canManage && studentPaymentSettings && !studentPaymentSettings.enabled && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          Les paiements en ligne (inscription, réinscription, scolarité) sont désactivés.{' '}
          <Link href="/parametres/paiements-eleves" className="text-primary font-medium underline">
            Configurer les paiements élèves
          </Link>
        </div>
      )}

      {canApplySelf && !canManage && !anyOnlinePaymentEnabled && enrollmentOrgIds.length > 0 && (
        <div className="rounded-lg border border-muted p-3 text-sm text-muted-foreground">
          L&apos;établissement n&apos;a pas encore activé les paiements en ligne (inscription /
          scolarité). Réglez vos frais auprès de la scolarité ou attendez l&apos;activation par le
          directeur.
        </div>
      )}

      {(canManage || canViewDocuments) && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all' as const, label: 'Toutes les demandes' },
              { id: 'new' as const, label: 'Inscriptions' },
              { id: 'reenrollment' as const, label: 'Réinscriptions' },
            ] as const
          ).map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={requestFilter === tab.id ? 'default' : 'outline'}
              className={requestFilter === tab.id ? 'bg-[#2563EB]' : ''}
              onClick={() => setRequestFilter(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      )}

      {canApplySelf && !canManage && myActiveEnrollment && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Dossier sélectionné</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {filteredEnrollments.length > 1 && (
              <div className="space-y-2">
                <Label>Dossier actif pour les pièces jointes</Label>
                <Select
                  value={uploadEnrollmentId || (myActiveEnrollment.id as string)}
                  onValueChange={setUploadEnrollmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un dossier" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEnrollments.map((e) => (
                      <SelectItem key={e.id as string} value={e.id as string}>
                        {((e.organizations as { name?: string })?.name) || 'Établissement'} —{' '}
                        {requestTypeLabels[(e.request_type as string) || 'new']} —{' '}
                        {statusLabels[e.status as string]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p>
              <strong>Établissement :</strong>{' '}
              {((myActiveEnrollment.organizations as { name?: string })?.name) || '—'}
            </p>
            <p>
              <strong>Demande :</strong>{' '}
              {requestTypeLabels[(myActiveEnrollment.request_type as string) || 'new']}
            </p>
            <p>
              <strong>Classe :</strong>{' '}
              {['admitted', 'enrolled'].includes((myActiveEnrollment.status as string) || '')
                ? classFromEnrollment(myActiveEnrollment).name || '—'
                : ((myActiveEnrollment.school_classes as { name?: string })?.name) || '—'}
            </p>
            {(myActiveEnrollment.study_level as string) && (
              <p>
                <strong>Parcours :</strong>{' '}
                {[myActiveEnrollment.study_level, myActiveEnrollment.department, myActiveEnrollment.program]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <p>
              <strong>Statut :</strong>{' '}
              <StatusBadge status={statusLabels[(myActiveEnrollment.status as string) || 'pending'] || 'En attente'} />
            </p>
            {(myActiveEnrollment.status as string) === 'admitted' && (
              <p className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                Votre inscription a été <strong>validée</strong> par l&apos;établissement.
              </p>
            )}
            {(myActiveEnrollment.status as string) === 'enrolled' && (
              <p className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                Vous êtes <strong>inscrit(e)</strong> pour cette année scolaire.
              </p>
            )}
            {(myActiveEnrollment.status as string) === 'rejected' && (
              <p className="text-red-800 bg-red-50 border border-red-200 rounded-lg p-2">
                Votre demande a été <strong>refusée</strong>. Contactez la scolarité pour plus d&apos;informations.
              </p>
            )}
            {myActiveEnrollment.dossier_submitted_at ? (
              <p className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                Dossier transmis le{' '}
                {new Date(myActiveEnrollment.dossier_submitted_at as string).toLocaleString('fr-FR')}.
                La scolarité, le directeur et le comptable peuvent consulter vos pièces.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Déposez chaque pièce ci-dessous, puis cliquez sur « Finaliser mon dossier » pour notifier
                l&apos;établissement.
              </p>
            )}
            {(myActiveEnrollment.status as string) === 'pending' &&
              !myActiveEnrollment.dossier_submitted_at &&
              (docsByEnrollment[myActiveEnrollment.id as string] ?? []).length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#2563EB]"
                  disabled={loading}
                  onClick={() =>
                    handleFinalizeDossier(
                      (uploadEnrollmentId || myActiveEnrollment.id) as string
                    )
                  }
                >
                  <Send className="h-4 w-4" />
                  Finaliser mon dossier
                </Button>
              )}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <ReenrollmentCodesPanel
          codes={reenrollmentCodes}
          codeExample={reenrollmentCodeExample}
        />
      )}

      {canApplySelf &&
        !canManage &&
        myActiveEnrollment &&
        studentIdFromEnrollment(myActiveEnrollment) && (
          <LearnerEnrollmentFeesCard
            enrollment={myActiveEnrollment}
            settings={settingsForOrg(myActiveEnrollment.organization_id as string | undefined)}
            orgDefaultTuitionGnf={
              orgTuitionDefaults[myActiveEnrollment.organization_id as string] ?? 1_500_000
            }
            studentId={studentIdFromEnrollment(myActiveEnrollment)!}
          />
        )}

      {(canViewDocuments || canApplySelf) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileStack className="h-4 w-4" />
              Documents des candidatures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage && !showDocumentUpload && (
              <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">
                Consultation seule : les pièces sont déposées par le candidat ou l&apos;élève sur son
                espace. Vous pouvez valider ou refuser les dossiers dans le tableau ci-dessous.
              </p>
            )}
            {showDocumentUpload && (
            <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
              <div className="space-y-2">
                <Label>Type de pièce *</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue placeholder="Type de document" /></SelectTrigger>
                  <SelectContent>
                    {ENROLLMENT_DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            )}
            {showDocumentUpload && myActiveEnrollment && (
              <div className="flex flex-wrap items-center gap-2">
                <Label className="sr-only">Téléverser une pièce</Label>
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                  <Upload className="h-4 w-4" />
                  Ajouter une pièce au dossier
                  <input
                    type="file"
                    className="hidden"
                    accept={ENROLLMENT_UPLOAD_ACCEPT}
                    disabled={!docType}
                    onChange={(e) => handleUpload(myActiveEnrollment.id as string, e)}
                  />
                </label>
                {!docType && (
                  <span className="text-xs text-muted-foreground">Sélectionnez d&apos;abord le type de pièce.</span>
                )}
              </div>
            )}
            {filteredEnrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {requestFilter === 'all'
                  ? 'Aucune demande pour le moment.'
                  : 'Aucune demande pour ce filtre.'}
              </p>
            ) : canManage || canViewDocuments ? (
              <div className="space-y-6">
                {filteredEnrollments.map((e) => {
                  const eid = e.id as string;
                  const docs = docsByEnrollment[eid] ?? [];
                  const rt = (e.request_type as string) || 'new';
                  const st = (e.status as string) || 'pending';
                  const { name: clsName } = classFromEnrollment(e);
                  const submittedAt = e.dossier_submitted_at as string | undefined;
                  return (
                    <div key={eid} className="rounded-lg border p-4 space-y-3">
                      <div className="text-sm font-medium">
                        {(e.applicant_name as string) || 'Candidat'}
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          — {((e.organizations as { name?: string })?.name) || 'Établissement'} —{' '}
                          {requestTypeLabels[rt]} — {statusLabels[st]}
                        </span>
                        {['admitted', 'enrolled'].includes(st) && clsName && (
                          <span className="block text-emerald-800 font-medium mt-1">
                            Classe acceptée : {clsName}
                          </span>
                        )}
                        {!clsName && st === 'pending' && (
                          <span className="block text-muted-foreground font-normal text-xs mt-1">
                            Classe : non assignée
                          </span>
                        )}
                        {submittedAt && (
                          <span className="block text-xs text-emerald-700 font-normal mt-1">
                            Dossier finalisé le {new Date(submittedAt).toLocaleString('fr-FR')}
                          </span>
                        )}
                      </div>
                      {docs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucune pièce jointe pour ce dossier.</p>
                      ) : (
                      <ul className="space-y-3 text-sm">
                        {docs.map((d) => (
                          <li key={d.id} className="border-b pb-3 last:border-0">
                            <div className="flex justify-between gap-2">
                              <EnrollmentDocumentLink fileName={d.fileName} filePath={d.filePath} />
                              <span className="text-muted-foreground shrink-0">{d.docTypeLabel}</span>
                            </div>
                            {d.aiAdaptation && (
                              <DocumentAiGuidance adaptation={d.aiAdaptation} compact />
                            )}
                          </li>
                        ))}
                      </ul>
                      )}
                    </div>
                  );
                })}
                {canApplySelf &&
                  !canManage &&
                  filteredDocuments.map((d) => (
                    <div key={d.id} className="border-b pb-3 text-sm last:border-0">
                      <div className="flex justify-between gap-2">
                        <EnrollmentDocumentLink fileName={d.fileName} filePath={d.filePath} />
                        <span className="text-muted-foreground shrink-0">{d.docTypeLabel}</span>
                      </div>
                      {d.aiAdaptation && <DocumentAiGuidance adaptation={d.aiAdaptation} compact />}
                    </div>
                  ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <DataTable
        title={
          canManage
            ? `Candidatures (${rows.length})`
            : canViewDocuments && !canManage
              ? `Demandes (${rows.length})`
              : `Mes demandes (${rows.length})`
        }
        data={rows}
        columns={[
          ...(canApplySelf && !canManage
            ? [{ key: 'etablissement', label: 'Établissement' }]
            : [{ key: 'nom', label: 'Candidat' }]),
          ...(canManage || (canViewDocuments && !canManage)
            ? [{ key: 'typeDemande', label: 'Demande' }]
            : []),
          ...(canManage
            ? [
                { key: 'niveau', label: 'Niveau' },
                { key: 'departement', label: 'Département' },
                { key: 'filiere', label: 'Filière' },
                {
                  key: 'codeReinscription',
                  label: 'Code réinscr.',
                  render: (item: Record<string, unknown>) =>
                    item.codeReinscription !== '—' ? (
                      <span className="font-mono text-xs">{String(item.codeReinscription)}</span>
                    ) : (
                      '—'
                    ),
                },
                { key: 'codeVerifie', label: 'Code OK' },
              ]
            : []),
          {
            key: 'classe',
            label: 'Classe',
            render: (item: Record<string, unknown>) => (
              <div className="flex flex-col gap-1">
                {['admitted', 'enrolled'].includes(item.rawStatus as string) &&
                item.className &&
                item.className !== '—' ? (
                  <span className="font-medium text-emerald-800">{String(item.className)}</span>
                ) : (
                  <span>{String(item.classe)}</span>
                )}
                {item.sansClasse ? (
                  <Badge variant="warning" className="w-fit text-[10px]">
                    Sans classe
                  </Badge>
                ) : null}
              </div>
            ),
          },
          ...(canApplySelf && !canManage
            ? [
                {
                  key: 'tuitionFeeGnf',
                  label: 'Scolarité',
                  render: (item: Record<string, unknown>) =>
                    item.showTuition ? (
                      <span className="text-xs font-medium">
                        {formatCurrency(Number(item.tuitionFeeGnf))}
                      </span>
                    ) : (
                      '—'
                    ),
                },
              ]
            : []),
          { key: 'annee', label: 'Année' },
          { key: 'date', label: 'Date' },
          { key: 'statut', label: 'Statut', render: (item) => <StatusBadge status={item.statut as string} /> },
          {
            key: 'docCount',
            label: 'Pièces',
            render: (item) => (canViewDocuments || canManage ? String(item.docCount) : '—'),
          },
          ...(canManage || (canViewDocuments && !canManage)
            ? [
                {
                  key: 'dossierDepose',
                  label: 'Dossier déposé',
                  render: (item: Record<string, unknown>) =>
                    item.dossierSoumis ? (
                      <span className="text-emerald-700 text-xs">{String(item.dossierDepose)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">En cours</span>
                    ),
                },
              ]
            : []),
          {
            key: 'actions',
            label: 'Actions',
            render: (item) => {
              const eid = item.id as string;
              if (canManage) {
                return (
                  <div className="flex gap-1 items-center">
                    {item.rawStatus === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-emerald-700 border-emerald-200"
                          disabled={loading}
                          onClick={() => handleStatus(eid, 'admitted')}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-700 border-red-200"
                          disabled={loading}
                          onClick={() => handleStatus(eid, 'rejected')}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Refuser
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={loading}
                          onClick={() => openEnrollModal(item)}
                        >
                          Inscrire
                        </Button>
                      </>
                    )}
                  </div>
                );
              }
              if (canApplySelf) {
                const rowSettings = settingsForOrg(item.orgId as string | undefined);
                const rowStudentId = item.studentId as string | null;
                const payKind = paymentKindForEnrollment(
                  item.rawRequestType as string,
                  item.rawStatus as string,
                  rowSettings,
                  rowStudentId
                );
                const enrollmentFee =
                  item.rawRequestType === 'reenrollment'
                    ? rowSettings?.enrollment_reenrollment_fee_gnf
                    : rowSettings?.enrollment_new_fee_gnf;
                return (
                  <div className="flex flex-col gap-1 items-start">
                    {payKind && rowSettings && rowStudentId && (
                      <StudentPaymentButton
                        studentId={rowStudentId}
                        enrollmentId={eid}
                        kind={payKind}
                        settings={rowSettings}
                        amountGnf={Number(enrollmentFee ?? 0)}
                        compact
                      />
                    )}
                    {item.showTuition && rowSettings && rowStudentId && (
                      <StudentPaymentButton
                        studentId={rowStudentId}
                        enrollmentId={eid}
                        kind="tuition"
                        settings={rowSettings}
                        amountGnf={Number(item.tuitionFeeGnf ?? 0)}
                        compact
                      />
                    )}
                    {item.rawStatus === 'pending' && (
                      <label className="cursor-pointer text-xs text-primary flex items-center gap-1">
                        <Upload className="h-3 w-3" />
                        <input
                          type="file"
                          className="hidden"
                          accept={ENROLLMENT_UPLOAD_ACCEPT}
                          disabled={!docType}
                          onChange={(e) => handleUpload(eid, e)}
                        />
                        Pièce
                      </label>
                    )}
                  </div>
                );
              }
              return <span className="text-xs text-muted-foreground">—</span>;
            },
          },
        ]}
      />

      {enrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle>Confirmer la classe</CardTitle>
              <p className="text-sm text-muted-foreground">
                Inscription de <strong>{enrollModal.applicantName}</strong> — choisissez ou
                confirmez la classe d&apos;affectation.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select
                  value={enrollModal.classId}
                  onValueChange={(v) =>
                    setEnrollModal((m) => (m ? { ...m, classId: v } : m))
                  }
                >
                  <SelectTrigger>
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
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEnrollModal(null)}>
                  Annuler
                </Button>
                <Button
                  className="bg-[#2563EB]"
                  disabled={loading || !enrollModal.classId}
                  onClick={async () => {
                    await handleStatus(enrollModal.enrollmentId, 'enrolled', {
                      classId: enrollModal.classId,
                    });
                    setEnrollModal(null);
                  }}
                >
                  Confirmer l&apos;inscription
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
