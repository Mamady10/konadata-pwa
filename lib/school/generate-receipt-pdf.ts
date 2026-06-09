import { jsPDF } from 'jspdf';
import type { PaymentReceipt } from '@/lib/school/payment-receipt';
import { formatReceiptDate, paymentKindLabel } from '@/lib/school/payment-receipt';
import { CONFIRMATION_SOURCE_LABELS } from '@/lib/school/student-payments';
function formatAmountGnf(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} GNF`;
}

function line(doc: jsPDF, y: number, text: string, opts?: { bold?: boolean; size?: number }) {
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  doc.setFontSize(opts?.size ?? 10);
  doc.text(text, 14, y);
}

export function generateReceiptPdfBuffer(receipt: PaymentReceipt): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('REÇU DE PAIEMENT', 14, 14);
  doc.setFontSize(9);
  doc.text(receipt.organization_name, 14, 22);

  doc.setTextColor(30, 41, 59);
  y = 38;

  line(doc, y, `N° reçu : ${receipt.receipt_number ?? '—'}`, { bold: true, size: 12 });
  y += 8;
  line(doc, y, `Code vérification : ${receipt.receipt_verification_code ?? '—'}`);
  y += 6;
  line(doc, y, `Émis le : ${formatReceiptDate(receipt.receipt_issued_at ?? receipt.paid_at)}`);
  y += 10;

  line(doc, y, 'ÉLÈVE', { bold: true });
  y += 6;
  line(doc, y, `Nom : ${receipt.student_name}`);
  y += 5;
  if (receipt.student_matricule) {
    line(doc, y, `Matricule : ${receipt.student_matricule}`);
    y += 5;
  }
  if (receipt.class_name) {
    line(doc, y, `Classe : ${receipt.class_name}`);
    y += 5;
  }
  if (receipt.academic_year) {
    line(doc, y, `Année scolaire : ${receipt.academic_year}`);
    y += 5;
  }
  y += 4;

  line(doc, y, 'DÉTAIL DU RÈGLEMENT', { bold: true });
  y += 6;
  line(doc, y, `Objet : ${paymentKindLabel(receipt.payment_kind)}`);
  y += 5;
  line(doc, y, `Montant : ${formatAmountGnf(receipt.amount_gnf)}`, { bold: true, size: 11 });
  y += 5;
  if (receipt.reference) {
    line(doc, y, `Référence transaction : ${receipt.reference}`);
    y += 5;
  }
  if (receipt.provider_payment_id) {
    line(doc, y, `ID Orange Money : ${receipt.provider_payment_id}`);
    y += 5;
  }
  if (receipt.confirmation_source) {
    line(doc, y, `Confirmation : ${CONFIRMATION_SOURCE_LABELS[receipt.confirmation_source]}`);
    y += 5;
  }
  line(doc, y, `Date paiement : ${formatReceiptDate(receipt.paid_at)}`);
  y += 8;

  if (receipt.balance && receipt.payment_kind === 'tuition') {
    line(doc, y, 'SITUATION SCOLARITÉ', { bold: true });
    y += 6;
    line(doc, y, `Total annuel : ${formatAmountGnf(receipt.balance.total_due_gnf)}`);
    y += 5;
    line(doc, y, `Total payé : ${formatAmountGnf(receipt.balance.paid_gnf)}`);
    y += 5;
    line(doc, y, `Reste à payer : ${formatAmountGnf(receipt.balance.remaining_gnf)}`);
    y += 8;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, 196, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const footer = [
    receipt.organization_city ? `${receipt.organization_city}` : null,
    receipt.organization_phone ? `Tél. ${receipt.organization_phone}` : null,
    receipt.organization_email ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (footer) doc.text(footer, 14, y);
  y += 5;
  doc.text(
    `Document généré par ${receipt.issued_by} — valable comme preuve de paiement.`,
    14,
    y
  );

  const buf = doc.output('arraybuffer');
  return new Uint8Array(buf);
}
