'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { DataTable, StatusBadge } from '@/components/dashboard/data-table';

import { recordPayment, type SchoolFinanceOverview } from '@/lib/actions/school';

import { formatCurrency } from '@/lib/utils';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { StaffPaymentLinkPanel } from '@/components/school/staff-payment-link-panel';
import { StaffStudentTuitionPanel } from '@/components/school/staff-student-tuition-panel';
import { exportPaymentsCsv, getPaymentsForExport } from '@/lib/actions/tuition-finance';
import type { TuitionDebtorRow } from '@/lib/school/tuition-debtors';
import {
  downloadCsvExport,
  downloadDebtorsExcel,
  downloadPaymentsExcel,
} from '@/lib/school/tuition-finance-export-file';
import { PageLoadErrors } from '@/components/school/page-load-errors';
import {
  DEFAULT_STUDENT_PAYMENT_SETTINGS,
  PAYMENT_KIND_LABELS,
  formatStaffPaymentEnrollmentLabel,
  suggestedStaffPaymentAmount,
  type StaffPaymentEnrollmentOption,
  type StudentPaymentKind,
  type StudentPaymentSettings,
} from '@/lib/school/student-payments';

const ALL_CLASSES = '__all__';



const methodLabels: Record<string, string> = {

  orange_money: 'Orange Money',

  mtn_momo: 'MTN MoMo',

  bank_transfer: 'Virement',

  cash: 'Espèces',

  other: 'Autre',

};

const statusLabels: Record<string, string> = {

  pending: 'En attente',

  paid: 'Payé',

  partial: 'Partiel',

  overdue: 'Impayé',

};



interface Props {

  payments: Array<Record<string, unknown>>;

  students: Array<{ id: string; full_name: string; matricule?: string }>;

  classes: Array<{ id: string; name: string }>;

  canRecord: boolean;

  viewByClass: boolean;

  financeOverview: SchoolFinanceOverview | null;

  minPaymentGnf?: number;
  paymentSettings?: StudentPaymentSettings | null;
  enrollments?: StaffPaymentEnrollmentOption[];
  academicYear?: string;
  debtors?: TuitionDebtorRow[];
  canViewDebtors?: boolean;
  loadErrors?: string[];
  debtorsLoadError?: string | null;
}

const debtorAlertBadge: Record<
  TuitionDebtorRow['alertStatus'],
  { label: string; className: string }
> = {
  overdue: { label: 'Retard', className: 'bg-amber-100 text-amber-900' },
  due_soon: { label: 'Bientôt', className: 'bg-blue-100 text-blue-800' },
  unpaid: { label: 'Impayé', className: 'bg-muted text-muted-foreground' },
};



export function PaiementsClient({

  payments,

  students,

  classes,

  canRecord,

  viewByClass,

  financeOverview,

  minPaymentGnf = 100_000,
  paymentSettings = null,
  enrollments = [],
  academicYear,
  debtors = [],
  canViewDebtors = false,
  loadErrors = [],
  debtorsLoadError = null,
}: Props) {
  const router = useRouter();
  const settings = paymentSettings ?? DEFAULT_STUDENT_PAYMENT_SETTINGS;

  const [tab, setTab] = useState('payments');
  const [debtorClassFilter, setDebtorClassFilter] = useState(ALL_CLASSES);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [paymentKind, setPaymentKind] = useState<StudentPaymentKind>('tuition');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState(PAYMENT_KIND_LABELS.tuition);
  const [method, setMethod] = useState('cash');
  const [filterClass, setFilterClass] = useState(ALL_CLASSES);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const availableKinds = useMemo(() => {
    const kinds: StudentPaymentKind[] = [];
    if (settings.allow_tuition_payment) kinds.push('tuition');
    if (settings.allow_enrollment_payment) kinds.push('enrollment');
    if (settings.allow_reenrollment_payment) kinds.push('reenrollment');
    return kinds.length ? kinds : (['tuition'] as StudentPaymentKind[]);
  }, [settings]);

  const dossiersForForm = useMemo(() => {
    if (!studentId || paymentKind === 'tuition') return [];
    return enrollments.filter((e) => {
      if (e.studentId !== studentId) return false;
      if (paymentKind === 'enrollment') return (e.requestType || 'new') === 'new';
      return e.requestType === 'reenrollment';
    });
  }, [enrollments, studentId, paymentKind]);

  useEffect(() => {
    if (!availableKinds.includes(paymentKind)) {
      setPaymentKind(availableKinds[0]);
    }
  }, [availableKinds, paymentKind]);

  useEffect(() => {
    if (paymentKind === 'tuition') {
      setEnrollmentId('');
      setDescription(PAYMENT_KIND_LABELS.tuition);
      return;
    }
    setDescription(PAYMENT_KIND_LABELS[paymentKind]);
    setEnrollmentId((current) => {
      if (dossiersForForm.length === 1) return dossiersForForm[0].id;
      if (current && dossiersForForm.some((d) => d.id === current)) return current;
      return '';
    });
  }, [paymentKind, dossiersForForm]);

  useEffect(() => {
    if (paymentKind === 'tuition') {
      setAmount('');
      return;
    }
    const suggested = suggestedStaffPaymentAmount(paymentKind, settings);
    if (suggested > 0) setAmount(String(suggested));
  }, [paymentKind, settings]);

  async function handlePay(formData: FormData) {
    setFormError(null);
    if (!studentId) {
      setFormError('Choisissez un élève.');
      return;
    }
    if (paymentKind !== 'tuition' && !enrollmentId) {
      setFormError('Choisissez le dossier d\'inscription ou de réinscription.');
      return;
    }

    formData.set('student_id', studentId);
    formData.set('enrollment_id', enrollmentId);
    formData.set('payment_kind', paymentKind);
    formData.set('payment_method', method);
    formData.set('status', 'paid');
    formData.set('description', description);
    formData.set('amount', amount);

    setFormLoading(true);
    const res = await recordPayment(formData);
    setFormLoading(false);

    if (res.error) {
      setFormError(res.error);
      return;
    }

    setShowForm(false);
    setStudentId('');
    setEnrollmentId('');
    setAmount('');
    setPaymentKind(availableKinds[0] ?? 'tuition');
    setDescription(PAYMENT_KIND_LABELS[availableKinds[0] ?? 'tuition']);
    setMethod('cash');
    router.refresh();
  }



  const filteredPayments = useMemo(() => {

    if (filterClass === ALL_CLASSES) return payments;

    return payments.filter((p) => p.class_id === filterClass);

  }, [payments, filterClass]);

  const filteredDebtors = useMemo(() => {
    if (debtorClassFilter === ALL_CLASSES) return debtors;
    return debtors.filter((d) => d.classId === debtorClassFilter);
  }, [debtors, debtorClassFilter]);

  const debtorTotals = useMemo(() => {
    const remaining = filteredDebtors.reduce((s, d) => s + d.remainingGnf, 0);
    const overdueCount = filteredDebtors.filter((d) => d.alertStatus === 'overdue').length;
    return { count: filteredDebtors.length, remaining, overdueCount };
  }, [filteredDebtors]);

  // Créances = scolarité attendue − encaissée (élèves inscrits), pour rester
  // cohérent avec « Attendu total » / « Encaissé total » de la carte Prévisions.
  const receivableTotal = useMemo(() => {
    if (!financeOverview) return debtorTotals.remaining;
    if (debtorClassFilter === ALL_CLASSES) {
      return Math.max(0, financeOverview.totals.expected - financeOverview.totals.collected);
    }
    const row = financeOverview.rows.find((r) => r.classId === debtorClassFilter);
    return row ? Math.max(0, row.expectedAmount - row.collectedAmount) : debtorTotals.remaining;
  }, [financeOverview, debtorClassFilter, debtorTotals.remaining]);

  async function handleExportDebtorsExcel() {
    if (!filteredDebtors.length) {
      setExportMsg('Aucun impayé à exporter.');
      return;
    }
    setExportLoading(true);
    setExportMsg(null);
    await downloadDebtorsExcel(filteredDebtors);
    setExportLoading(false);
    setExportMsg(`${filteredDebtors.length} ligne(s) exportée(s) en Excel.`);
  }

  function handleExportDebtorsCsv() {
    if (!filteredDebtors.length) {
      setExportMsg('Aucun impayé à exporter.');
      return;
    }
    const header =
      'Matricule;Élève;Classe;Téléphone tuteur;Total dû;Payé;Reste;Alerte;Prochaine échéance';
    const lines = filteredDebtors.map((d) =>
      [
        d.matricule ?? '',
        d.studentName.replace(/;/g, ','),
        d.className.replace(/;/g, ','),
        d.guardianPhone ?? '',
        d.totalDueGnf.toFixed(0),
        d.paidGnf.toFixed(0),
        d.remainingGnf.toFixed(0),
        d.alertLabel.replace(/;/g, ','),
        d.nextDueDate ? new Date(d.nextDueDate).toLocaleDateString('fr-FR') : '',
      ].join(';')
    );
    const csv = [header, ...lines].join('\n');
    const base64 = btoa(unescape(encodeURIComponent(csv)));
    downloadCsvExport(
      base64,
      `impayes_scolarite_${new Date().toISOString().slice(0, 10)}.csv`
    );
    setExportMsg(`${filteredDebtors.length} impayé(s) exporté(s) en CSV.`);
  }

  async function handleExportPaymentsExcel() {
    setExportLoading(true);
    setExportMsg(null);
    const res = await getPaymentsForExport();
    setExportLoading(false);
    if (res.error) setExportMsg(res.error);
    else if (!res.rows.length) setExportMsg('Aucun paiement à exporter.');
    else {
      await downloadPaymentsExcel(res.rows);
      setExportMsg(`${res.rows.length} paiement(s) exporté(s) en Excel.`);
    }
  }

  async function handleExportPaymentsCsv() {
    setExportLoading(true);
    setExportMsg(null);
    const res = await exportPaymentsCsv();
    setExportLoading(false);
    if (res.error) setExportMsg(res.error);
    else if (res.base64 && res.fileName) {
      downloadCsvExport(res.base64, res.fileName);
      setExportMsg(`${res.count} paiement(s) exporté(s) en CSV.`);
    }
  }



  const rows = filteredPayments.map((p) => ({
    id: p.id as string,
    etudiant: (p.student_name as string) || '—',
    classe: (p.class_name as string) || '—',
    montant: Number(p.amount),
    type: PAYMENT_KIND_LABELS[p.payment_kind as StudentPaymentKind] || String(p.payment_kind || 'tuition'),
    mode: methodLabels[p.payment_method as string] || String(p.payment_method),
    statut: statusLabels[p.status as string] || String(p.status),
    date: p.paid_at ? new Date(p.paid_at as string).toLocaleDateString('fr-FR') : '—',
    receipt_number: (p.receipt_number as string) || null,
    payment_token: (p.payment_token as string) || null,
  }));



  const classTotals = useMemo(() => {

    const map = new Map<string, number>();

    for (const p of payments) {

      if (p.status !== 'paid' && p.status !== 'partial') continue;

      const cid = (p.class_id as string) || 'none';

      map.set(cid, (map.get(cid) ?? 0) + Number(p.amount ?? 0));

    }

    return map;

  }, [payments]);



  return (

    <div className="space-y-6">
      <PageLoadErrors errors={loadErrors} />
      {debtorsLoadError && (
        <p className="text-sm text-destructive">Impayés : {debtorsLoadError}</p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">

        <div>

          <h1 className="text-2xl font-bold">

            {canRecord ? 'Paiements des frais' : 'Paiements par classe'}

          </h1>

          <p className="text-muted-foreground">

            {canRecord

              ? 'Enregistrement et suivi des encaissements'

              : 'Consultation des paiements pour valider les inscriptions'}

            {academicYear ? ` — année ${academicYear}` : ''}

          </p>

        </div>

        <div className="flex flex-wrap gap-2">
          {canViewDebtors && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportLoading}
                onClick={() => void handleExportPaymentsExcel()}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Export encaissements Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportLoading}
                onClick={() => void handleExportDebtorsExcel()}
              >
                <Download className="h-4 w-4 mr-1" />
                Export impayés Excel
              </Button>
            </>
          )}
          {canRecord && (
            <Button onClick={() => setShowForm(!showForm)} className="bg-[#2563EB] hover:bg-[#2563EB]/90">
              <Plus className="h-4 w-4" /> Enregistrer un paiement
            </Button>
          )}
        </div>

      </div>

      {exportMsg && <p className="text-sm text-muted-foreground">{exportMsg}</p>}

      {canRecord && students.length > 0 && (
        <StaffPaymentLinkPanel
          students={students}
          minPaymentGnf={minPaymentGnf}
          paymentSettings={settings}
          enrollments={enrollments}
        />
      )}

      {financeOverview && (

        <Card className="border-primary/20">

          <CardHeader>

            <CardTitle className="text-base">Prévisions vs encaissements</CardTitle>

            <p className="text-sm text-muted-foreground">

              Frais de scolarité de référence : {formatCurrency(financeOverview.tuitionFeeGnf)} / élève inscrit

            </p>

          </CardHeader>

          <CardContent className="space-y-4">

            <div className="grid gap-3 sm:grid-cols-4">

              <div className="rounded-lg border p-3">

                <p className="text-xs text-muted-foreground">Inscrits (établissement)</p>

                <p className="text-xl font-bold">{financeOverview.totals.enrolled}</p>

              </div>

              <div className="rounded-lg border p-3">

                <p className="text-xs text-muted-foreground">Attendu total</p>

                <p className="text-xl font-bold">{formatCurrency(financeOverview.totals.expected)}</p>

              </div>

              <div className="rounded-lg border p-3">

                <p className="text-xs text-muted-foreground">Encaissé total</p>

                <p className="text-xl font-bold text-emerald-700">

                  {formatCurrency(financeOverview.totals.collected)}

                </p>

              </div>

              <div className="rounded-lg border p-3">

                <p className="text-xs text-muted-foreground">Écart</p>

                <p

                  className={`text-xl font-bold ${

                    financeOverview.totals.gap >= 0 ? 'text-emerald-700' : 'text-amber-700'

                  }`}

                >

                  {formatCurrency(financeOverview.totals.gap)}

                </p>

              </div>

            </div>

            <DataTable

              title="Par classe"

              data={financeOverview.rows.map((r) => ({

                id: r.classId,

                classe: r.className,

                inscrits: r.enrolledCount,

                candidatures: r.pendingCandidates,

                capacite: r.capacity,

                attendu: r.expectedAmount,

                encaisse: r.collectedAmount,

                ecart: r.gap,

              }))}

              columns={[

                { key: 'classe', label: 'Classe' },

                { key: 'inscrits', label: 'Inscrits' },

                { key: 'candidatures', label: 'Candidatures' },

                { key: 'capacite', label: 'Capacité' },

                {

                  key: 'attendu',

                  label: 'Attendu',

                  render: (i) => formatCurrency(i.attendu as number),

                },

                {

                  key: 'encaisse',

                  label: 'Encaissé',

                  render: (i) => formatCurrency(i.encaisse as number),

                },

                {

                  key: 'ecart',

                  label: 'Écart',

                  render: (i) => formatCurrency(i.ecart as number),

                },

              ]}

            />

          </CardContent>

        </Card>

      )}



      {viewByClass && classes.length > 0 && (

        <div className="space-y-2 max-w-xs">

          <Label>Filtrer par classe</Label>

          <Select value={filterClass} onValueChange={setFilterClass}>

            <SelectTrigger><SelectValue /></SelectTrigger>

            <SelectContent>

              <SelectItem value={ALL_CLASSES}>Toutes les classes</SelectItem>

              {classes.map((c) => (

                <SelectItem key={c.id} value={c.id}>

                  {c.name}

                  {classTotals.has(c.id) ? ` — ${formatCurrency(classTotals.get(c.id)!)}` : ''}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        </div>

      )}



      {canRecord && showForm && (

        <Card>

          <CardHeader>
            <CardTitle>Nouveau paiement au guichet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Scolarité, inscription ou réinscription — espèces ou autre mode.
            </p>
          </CardHeader>

          <CardContent>

            <form action={handlePay} className="grid gap-4 sm:grid-cols-2">

              <div className="space-y-2">

                <Label>Élève *</Label>

                <Select
                  value={studentId}
                  onValueChange={(v) => {
                    setStudentId(v);
                    setEnrollmentId('');
                  }}
                >

                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>

                  <SelectContent>

                    {students.map((s) => (

                      <SelectItem key={s.id} value={s.id}>

                        {s.full_name} {s.matricule ? `(${s.matricule})` : ''}

                      </SelectItem>

                    ))}

                  </SelectContent>

                </Select>

              </div>

              <div className="space-y-2">
                <Label>Type de frais *</Label>
                <Select
                  value={paymentKind}
                  onValueChange={(v) => setPaymentKind(v as StudentPaymentKind)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableKinds.map((k) => (
                      <SelectItem key={k} value={k}>
                        {PAYMENT_KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentKind !== 'tuition' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Dossier *</Label>
                  <Select value={enrollmentId} onValueChange={setEnrollmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir le dossier" />
                    </SelectTrigger>
                    <SelectContent>
                      {dossiersForForm.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {formatStaffPaymentEnrollmentLabel(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {studentId && dossiersForForm.length === 0 && (
                    <p className="text-xs text-amber-700">
                      Aucun dossier {paymentKind === 'enrollment' ? 'd\'inscription' : 'de réinscription'}{' '}
                      en cours pour cet élève.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Montant (GNF) *</Label>
                <Input
                  name="amount"
                  type="number"
                  min={paymentKind === 'tuition' ? minPaymentGnf : 1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">

                <Label>Mode de paiement</Label>

                <Select value={method} onValueChange={setMethod}>

                  <SelectTrigger><SelectValue /></SelectTrigger>

                  <SelectContent>

                    {Object.entries(methodLabels).map(([k, v]) => (

                      <SelectItem key={k} value={k}>{v}</SelectItem>

                    ))}

                  </SelectContent>

                </Select>

              </div>

              <div className="space-y-2"><Label>Référence</Label><Input name="reference" placeholder="N° reçu ou transaction" /></div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Input
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <StaffStudentTuitionPanel studentId={studentId} paymentSettings={settings} />

              {formError && (
                <p className="text-sm text-destructive sm:col-span-2">{formError}</p>
              )}

              <Button
                type="submit"
                className="bg-[#2563EB] sm:col-span-2"
                disabled={formLoading}
              >
                {formLoading ? 'Enregistrement…' : 'Enregistrer le paiement'}
              </Button>

            </form>

          </CardContent>

        </Card>

      )}



      {canViewDebtors && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Élèves avec solde restant</p>
              <p className="text-2xl font-bold">{debtorTotals.count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Créances totales</p>
              <p className="text-2xl font-bold text-amber-700">
                {formatCurrency(receivableTotal)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Retards de tranche</p>
              <p className="text-2xl font-bold">{debtorTotals.overdueCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="payments">Encaissements</TabsTrigger>
          {canViewDebtors && (
            <TabsTrigger value="debtors">
              Impayés
              {debtors.length > 0 ? (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {debtors.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="payments" className="mt-4 space-y-4">
          {canViewDebtors && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={exportLoading}
                onClick={() => void handleExportPaymentsCsv()}
              >
                Export CSV encaissements
              </Button>
            </div>
          )}
          <DataTable
            title="Historique des paiements"
            data={rows}
            columns={[
              { key: 'etudiant', label: 'Élève' },
              { key: 'classe', label: 'Classe' },
              {
                key: 'montant',
                label: 'Montant',
                render: (item) => formatCurrency(item.montant as number),
              },
              { key: 'type', label: 'Type' },
              { key: 'mode', label: 'Mode' },
              {
                key: 'statut',
                label: 'Statut',
                render: (item) => <StatusBadge status={item.statut as string} />,
              },
              { key: 'date', label: 'Date' },
              {
                key: 'receipt_number',
                label: 'Reçu',
                render: (item) =>
                  item.payment_token && item.statut === 'Payé' ? (
                    <a
                      href={`/recu-scolarite/${item.payment_token as string}`}
                      className="text-primary text-xs underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(item.receipt_number as string) || 'Voir'}
                    </a>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        </TabsContent>

        {canViewDebtors && (
          <TabsContent value="debtors" className="mt-4 space-y-4">
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Recouvrement scolarité
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {debtorTotals.count} élève(s) avec solde restant
                  {debtorTotals.overdueCount > 0
                    ? ` — ${debtorTotals.overdueCount} en retard de tranche`
                    : ''}
                  {debtorTotals.remaining > 0
                    ? ` — total ${formatCurrency(debtorTotals.remaining)}`
                    : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {classes.length > 0 && (
                  <div className="space-y-2 max-w-xs">
                    <Label>Filtrer par classe</Label>
                    <Select value={debtorClassFilter} onValueChange={setDebtorClassFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_CLASSES}>Toutes les classes</SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={exportLoading || !filteredDebtors.length}
                    onClick={() => void handleExportDebtorsExcel()}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={exportLoading}
                    onClick={() => void handleExportDebtorsCsv()}
                  >
                    CSV
                  </Button>
                </div>
                <DataTable
                  title="Liste des impayés"
                  data={filteredDebtors.map((d) => ({
                    id: d.studentId,
                    matricule: d.matricule || '—',
                    etudiant: d.studentName,
                    classe: d.className,
                    tuteur: d.guardianPhone || '—',
                    total: d.totalDueGnf,
                    paye: d.paidGnf,
                    reste: d.remainingGnf,
                    alerte: d.alertLabel,
                    alertStatus: d.alertStatus,
                    echeance: d.nextDueDate
                      ? new Date(d.nextDueDate).toLocaleDateString('fr-FR')
                      : '—',
                  }))}
                  columns={[
                    { key: 'matricule', label: 'Matricule' },
                    {
                      key: 'etudiant',
                      label: 'Élève',
                      render: (item) => (
                        <Link
                          href={`/etablissement/etudiants/${item.id as string}`}
                          className="text-primary underline"
                        >
                          {item.etudiant as string}
                        </Link>
                      ),
                    },
                    { key: 'classe', label: 'Classe' },
                    { key: 'tuteur', label: 'Tuteur' },
                    {
                      key: 'reste',
                      label: 'Reste',
                      render: (item) => formatCurrency(item.reste as number),
                    },
                    {
                      key: 'alerte',
                      label: 'Alerte',
                      render: (item) => {
                        const st = item.alertStatus as TuitionDebtorRow['alertStatus'];
                        const badge = debtorAlertBadge[st];
                        return (
                          <Badge variant="secondary" className={`text-xs ${badge.className}`}>
                            {badge.label} — {item.alerte as string}
                          </Badge>
                        );
                      },
                    },
                    { key: 'echeance', label: 'Échéance' },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

    </div>

  );

}

