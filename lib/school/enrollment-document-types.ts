export interface EnrollmentDocumentTypeOption {
  id: string;
  label: string;
  hint?: string;
}

export const ENROLLMENT_DOCUMENT_TYPES: EnrollmentDocumentTypeOption[] = [
  { id: 'id_card', label: 'Pièce d\'identité', hint: 'CNI, passeport' },
  { id: 'birth_certificate', label: 'Acte de naissance' },
  { id: 'report_card_prev', label: 'Bulletin / relevé précédent' },
  { id: 'photo', label: 'Photo d\'identité' },
  { id: 'payment_proof', label: 'Justificatif de paiement' },
  { id: 'medical', label: 'Certificat médical' },
  { id: 'other', label: 'Autre document' },
];

export function getEnrollmentDocumentLabel(id: string | null | undefined): string {
  if (!id) return 'Document';
  return ENROLLMENT_DOCUMENT_TYPES.find((t) => t.id === id)?.label ?? id;
}
