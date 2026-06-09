'use client';

import type { PaymentExportRow } from '@/lib/actions/tuition-finance';
import type { TuitionDebtorRow } from '@/lib/school/tuition-debtors';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64Csv(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  downloadBlob(new Blob([bytes], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadCsvExport(base64: string, fileName: string) {
  downloadBase64Csv(base64, fileName);
}

export async function downloadDebtorsExcel(debtors: TuitionDebtorRow[]) {
  const XLSX = await import('xlsx');
  const rows = debtors.map((d) => ({
    Matricule: d.matricule ?? '',
    Élève: d.studentName,
    Classe: d.className,
    'Téléphone tuteur': d.guardianPhone ?? '',
    'Total dû (GNF)': d.totalDueGnf,
    'Payé (GNF)': d.paidGnf,
    'Reste (GNF)': d.remainingGnf,
    Alerte: d.alertLabel,
    'Prochaine échéance': d.nextDueDate
      ? new Date(d.nextDueDate).toLocaleDateString('fr-FR')
      : '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Impayés');
  XLSX.writeFile(wb, `impayes_scolarite_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadPaymentsExcel(rows: PaymentExportRow[]) {
  const XLSX = await import('xlsx');
  const sheetRows = rows.map((r) => ({
    Date: r.date,
    Matricule: r.matricule,
    Élève: r.studentName,
    Classe: r.className,
    'Montant (GNF)': r.amountGnf,
    Type: r.paymentKind,
    Mode: r.paymentMethod,
    Statut: r.status,
    'N° reçu': r.receiptNumber,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Encaissements');
  XLSX.writeFile(wb, `encaissements_scolarite_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
