import type { CaptureTemplateKind } from '@/lib/documents/capture-standard-templates';

export type CaptureParseMethod = 'llm' | 'csv' | 'heuristic';
export type CaptureExtractionStatus = 'ok' | 'partial' | 'failed';

export interface CaptureExtractionBase {
  template_id: string;
  kind: CaptureTemplateKind;
  status: CaptureExtractionStatus;
  parse_method: CaptureParseMethod;
  confidence: number;
  warnings: string[];
  extracted_at: string;
  row_count: number;
}

export interface CaptureGradeSheetRow {
  full_name: string;
  student_code?: string;
  maths?: string;
  francais?: string;
  anglais?: string;
  svt?: string;
  hist_geo?: string;
  moyenne?: string;
}

export interface CapturePersonRow {
  full_name: string;
  identifier?: string;
  phone?: string;
  email?: string;
  present?: string;
  absent?: string;
  remark?: string;
}

export interface CaptureFieldReport {
  date?: string;
  location?: string;
  participants?: string;
  activities?: string;
  results?: string;
  difficulties?: string;
  recommendations?: string;
}

export interface CaptureBeneficiaryFields {
  full_name?: string;
  sex_age?: string;
  phone?: string;
  locality?: string;
  project?: string;
  remarks?: string;
}

export interface CaptureDailySiteReport {
  date?: string;
  workforce?: string;
  tasks?: string;
  materials?: string;
  incidents?: string;
  observations?: string;
}

export interface CaptureFuelRow {
  date?: string;
  equipment?: string;
  liters?: string;
  meter_index?: string;
  driver?: string;
  remark?: string;
}

export interface CaptureDeliveryRow {
  date?: string;
  supplier?: string;
  material?: string;
  quantity?: string;
  unit?: string;
  received_by?: string;
}

export interface CaptureExpenseRow {
  date?: string;
  label?: string;
  amount_gnf?: string;
  payment_mode?: string;
  receipt_ref?: string;
}

export interface CapturePurchaseRow {
  reference?: string;
  designation?: string;
  quantity?: string;
  unit_price_gnf?: string;
  total_gnf?: string;
  remark?: string;
}

export interface CaptureStockRow {
  reference?: string;
  designation?: string;
  quantity_counted?: string;
  unit?: string;
  variance?: string;
  remark?: string;
}

export type CaptureExtractionPayload =
  | { shape: 'grade_sheet'; rows: CaptureGradeSheetRow[]; meta?: { class_name?: string } }
  | { shape: 'person_rows'; rows: CapturePersonRow[]; meta?: Record<string, string> }
  | { shape: 'field_report'; fields: CaptureFieldReport }
  | { shape: 'beneficiary'; fields: CaptureBeneficiaryFields }
  | { shape: 'daily_site_report'; fields: CaptureDailySiteReport }
  | { shape: 'fuel_rows'; rows: CaptureFuelRow[] }
  | { shape: 'delivery_rows'; rows: CaptureDeliveryRow[] }
  | { shape: 'expense_rows'; rows: CaptureExpenseRow[] }
  | { shape: 'purchase_rows'; rows: CapturePurchaseRow[] }
  | { shape: 'stock_rows'; rows: CaptureStockRow[] };

export interface CaptureExtractionResult extends CaptureExtractionBase {
  payload: CaptureExtractionPayload;
}
