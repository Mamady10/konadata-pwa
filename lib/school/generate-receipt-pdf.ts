import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { PaymentReceipt } from '@/lib/school/payment-receipt';
import { formatReceiptDate, paymentKindLabel } from '@/lib/school/payment-receipt';
import { CONFIRMATION_SOURCE_LABELS } from '@/lib/school/student-payments';
import { amountInWordsGnf } from '@/lib/btp/quotes/amount-in-words';

type RGB = [number, number, number];

const BLUE: RGB = [37, 99, 235];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const GREEN: RGB = [5, 150, 105];

const METHOD_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  bank_transfer: 'Virement bancaire',
  cash: 'Espèces',
  other: 'Autre',
};

/** jsPDF (helvetica) ne sait pas afficher l'espace fine insécable produite par Intl. */
function formatAmountGnf(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(amount).replace(/[\u202F\u00A0]/g, ' ')} GNF`;
}

function pdfText(s: string): string {
  return s.replace(/[\u202F\u00A0]/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...');
}

export async function generateReceiptPdfBuffer(
  receipt: PaymentReceipt,
  verifyUrl?: string
): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 16;
  const W = pageW - M * 2;
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const draw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (style: 'normal' | 'bold', size: number) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  // En-tête
  fill(BLUE);
  doc.rect(0, 0, pageW, 38, 'F');
  color([255, 255, 255]);
  font('bold', 8);
  doc.text('REÇU OFFICIEL DE PAIEMENT', M, 12);
  font('bold', 17);
  doc.text(pdfText(receipt.organization_name), M, 21);
  font('normal', 9);
  const contact = [receipt.organization_city, receipt.organization_phone && `Tél. ${receipt.organization_phone}`]
    .filter(Boolean)
    .join('  ·  ');
  if (contact) doc.text(pdfText(contact), M, 28);

  const boxW = 62;
  fill([255, 255, 255]);
  doc.roundedRect(pageW - M - boxW, 9, boxW, 20, 2.5, 2.5, 'F');
  color(MUTED);
  font('normal', 7.5);
  doc.text('N° DE REÇU', pageW - M - boxW + 5, 16);
  color(INK);
  font('bold', 12.5);
  doc.text(receipt.receipt_number ?? '—', pageW - M - boxW + 5, 24);

  // Ligne émission / vérification / statut
  let y = 50;
  const meta: [string, string][] = [
    ["Date d'émission", formatReceiptDate(receipt.receipt_issued_at ?? receipt.paid_at)],
    ['Code de vérification', receipt.receipt_verification_code ?? '—'],
  ];
  meta.forEach(([k, v], i) => {
    const x = M + i * 70;
    color(MUTED);
    font('normal', 8);
    doc.text(k, x, y);
    color(INK);
    font('bold', 10.5);
    doc.text(pdfText(v), x, y + 5.5);
  });
  fill([209, 250, 229]);
  doc.roundedRect(pageW - M - 26, y - 4.5, 26, 10, 5, 5, 'F');
  color(GREEN);
  font('bold', 10);
  doc.text('PAYÉ', pageW - M - 13, y + 2.2, { align: 'center' });
  y += 14;

  // Cartes Élève / Règlement
  const cardW = (W - 6) / 2;
  const rows = (items: [string, string | null | undefined][]) => items.filter((r): r is [string, string] => !!r[1]);
  const student = rows([
    ['Matricule', receipt.student_matricule],
    ['Classe', receipt.class_name],
    ['Année scolaire', receipt.academic_year],
  ]);
  const payment = rows([
    ['Objet', paymentKindLabel(receipt.payment_kind)],
    ['Mode', receipt.payment_method ? METHOD_LABELS[receipt.payment_method] ?? receipt.payment_method : null],
    ['Référence', receipt.reference],
    ['ID Orange Money', receipt.provider_payment_id],
    ['Confirmation', receipt.confirmation_source ? CONFIRMATION_SOURCE_LABELS[receipt.confirmation_source] : null],
  ]);
  const cardH = 14 + Math.max(student.length + 1, payment.length) * 6.2;
  const card = (x: number, title: string, headline: string | null, items: [string, string][]) => {
    draw(LINE);
    doc.setLineWidth(0.35);
    fill([248, 250, 252]);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');
    color(BLUE);
    font('bold', 8);
    doc.text(title, x + 5, y + 7);
    let cy = y + 14;
    if (headline) {
      color(INK);
      font('bold', 11.5);
      doc.text(pdfText(headline), x + 5, cy);
      cy += 6.2;
    }
    for (const [k, v] of items) {
      color(MUTED);
      font('normal', 9);
      doc.text(`${k} :`, x + 5, cy);
      color(INK);
      font('bold', 9);
      const lines = doc.splitTextToSize(pdfText(v), cardW - 40);
      doc.text(lines[0], x + 35, cy);
      cy += 6.2;
    }
  };
  card(M, 'ÉLÈVE', receipt.student_name, student);
  card(M + cardW + 6, 'RÈGLEMENT', null, payment);
  y += cardH + 8;

  // Montant
  fill([239, 246, 255]);
  draw([191, 219, 254]);
  doc.roundedRect(M, y, W, 30, 3, 3, 'FD');
  fill(BLUE);
  doc.rect(M, y, 2.2, 30, 'F');
  color(MUTED);
  font('normal', 8.5);
  doc.text('MONTANT REÇU', M + 8, y + 8);
  color(BLUE);
  font('bold', 22);
  doc.text(formatAmountGnf(receipt.amount_gnf), M + 8, y + 18.5);
  color(INK);
  font('normal', 8.5);
  const words = doc.splitTextToSize(
    pdfText(`Arrêté le présent reçu à la somme de : ${amountInWordsGnf(receipt.amount_gnf)}.`),
    W - 16
  );
  doc.text(words[0], M + 8, y + 25.5);
  color(MUTED);
  font('normal', 8);
  doc.text(pdfText(`Payé le ${formatReceiptDate(receipt.paid_at)}`), pageW - M - 6, y + 8, { align: 'right' });
  y += 38;

  // Situation de scolarité
  if (receipt.balance && receipt.payment_kind === 'tuition') {
    const b = receipt.balance;
    color(INK);
    font('bold', 10.5);
    doc.text('Situation de la scolarité', M, y);
    y += 7;
    const cols: [string, number, RGB][] = [
      ['Total annuel', b.total_due_gnf, INK],
      ['Total payé', b.paid_gnf, GREEN],
      ['Reste à payer', b.remaining_gnf, b.remaining_gnf > 0 ? [220, 38, 38] : GREEN],
    ];
    const colW = W / 3;
    cols.forEach(([k, v, c], i) => {
      color(MUTED);
      font('normal', 8.5);
      doc.text(k, M + i * colW, y);
      color(c);
      font('bold', 12);
      doc.text(formatAmountGnf(v), M + i * colW, y + 6.5);
    });
    y += 11;
    const ratio = b.total_due_gnf > 0 ? Math.min(1, b.paid_gnf / b.total_due_gnf) : 0;
    fill(LINE);
    doc.roundedRect(M, y, W, 3, 1.5, 1.5, 'F');
    if (ratio > 0) {
      fill(GREEN);
      doc.roundedRect(M, y, Math.max(3, W * ratio), 3, 1.5, 1.5, 'F');
    }
    color(MUTED);
    font('normal', 8);
    doc.text(`${Math.round(ratio * 100)} % de la scolarité réglée`, M, y + 8);
    y += 16;
  }

  // Vérification (QR) + mentions
  draw(LINE);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + W, y);
  y += 7;
  const qrSize = 30;
  if (verifyUrl) {
    try {
      const qr = await QRCode.toDataURL(verifyUrl, { width: 240, margin: 1 });
      doc.addImage(qr, 'PNG', pageW - M - qrSize, y, qrSize, qrSize);
      color(MUTED);
      font('normal', 7);
      doc.text("Scannez pour vérifier l'authenticité", pageW - M - qrSize / 2, y + qrSize + 4, { align: 'center' });
    } catch {
      /* QR facultatif */
    }
  }
  color(INK);
  font('bold', 9);
  doc.text('Authenticité', M, y + 4);
  color(MUTED);
  font('normal', 8.5);
  const note = doc.splitTextToSize(
    pdfText(
      `Ce reçu atteste du paiement enregistré par l'établissement via ${receipt.issued_by}. ` +
        `Son authenticité se vérifie avec le QR code ou le code de vérification ${receipt.receipt_verification_code ?? ''}. ` +
        'Conservez-le avec votre preuve de paiement (Orange Money, MTN MoMo, virement).'
    ),
    W - qrSize - 12
  );
  doc.text(note, M, y + 10);

  // Pied de page
  const pageH = doc.internal.pageSize.getHeight();
  const footer = [receipt.organization_city, receipt.organization_phone && `Tél. ${receipt.organization_phone}`, receipt.organization_email]
    .filter(Boolean)
    .join('  ·  ');
  draw(LINE);
  doc.line(M, pageH - 18, M + W, pageH - 18);
  color(MUTED);
  font('normal', 7.5);
  if (footer) doc.text(pdfText(footer), M, pageH - 12);
  doc.text(`Document généré par ${receipt.issued_by} - valable comme preuve de paiement.`, M, pageH - 7.5);

  return new Uint8Array(doc.output('arraybuffer'));
}
