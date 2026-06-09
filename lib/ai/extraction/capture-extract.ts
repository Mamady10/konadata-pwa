import 'server-only';

import { hasActiveLlmApi, queryKonaAI } from '@/lib/integrations/openai';
import { parseCaptureCsv } from '@/lib/ai/extraction/capture-extract-csv';
import type {
  CaptureExtractionPayload,
  CaptureExtractionResult,
} from '@/lib/ai/extraction/capture-extract-types';
import {
  getCaptureStandardById,
  type CaptureStandardTemplate,
} from '@/lib/documents/capture-standard-templates';

const JSON_SCHEMAS: Record<string, string> = {
  grade_sheet:
    '{"className":string|null,"rows":[{"full_name":string,"student_code":string|null,"maths":string|null,"francais":string|null,"anglais":string|null,"svt":string|null,"hist_geo":string|null,"moyenne":string|null}]}',
  class_list:
    '{"rows":[{"full_name":string,"identifier":string|null,"phone":string|null,"email":string|null}]}',
  attendance:
    '{"date":string|null,"rows":[{"full_name":string,"identifier":string|null,"present":string|null,"absent":string|null,"remark":string|null}]}',
  workshop_attendance:
    '{"rows":[{"full_name":string,"identifier":string|null,"phone":string|null,"remark":string|null}]}',
  field_report:
    '{"date":string|null,"location":string|null,"participants":string|null,"activities":string|null,"results":string|null,"difficulties":string|null,"recommendations":string|null}',
  beneficiary_row:
    '{"full_name":string|null,"sex_age":string|null,"phone":string|null,"locality":string|null,"project":string|null,"remarks":string|null}',
  daily_site_report:
    '{"date":string|null,"workforce":string|null,"tasks":string|null,"materials":string|null,"incidents":string|null,"observations":string|null}',
  fuel_sheet:
    '{"rows":[{"date":string|null,"equipment":string|null,"liters":string|null,"meter_index":string|null,"driver":string|null,"remark":string|null}]}',
  delivery_note:
    '{"rows":[{"date":string|null,"supplier":string|null,"material":string|null,"quantity":string|null,"unit":string|null,"received_by":string|null}]}',
  expense_sheet:
    '{"rows":[{"date":string|null,"label":string|null,"amount_gnf":string|null,"payment_mode":string|null,"receipt_ref":string|null}]}',
  purchase_order:
    '{"rows":[{"reference":string|null,"designation":string|null,"quantity":string|null,"unit_price_gnf":string|null,"total_gnf":string|null,"remark":string|null}]}',
  stock_count:
    '{"rows":[{"reference":string|null,"designation":string|null,"quantity_counted":string|null,"unit":string|null,"variance":string|null,"remark":string|null}]}',
};

function kindToShape(kind: CaptureStandardTemplate['kind']): CaptureExtractionPayload['shape'] {
  if (kind === 'grade_sheet') return 'grade_sheet';
  if (kind === 'class_list' || kind === 'attendance' || kind === 'workshop_attendance') return 'person_rows';
  if (kind === 'field_report') return 'field_report';
  if (kind === 'beneficiary_row') return 'beneficiary';
  if (kind === 'daily_site_report') return 'daily_site_report';
  if (kind === 'fuel_sheet') return 'fuel_rows';
  if (kind === 'delivery_note') return 'delivery_rows';
  if (kind === 'expense_sheet') return 'expense_rows';
  if (kind === 'purchase_order') return 'purchase_rows';
  return 'stock_rows';
}

function asString(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  return String(v).trim() || undefined;
}

function buildPayload(
  template: CaptureStandardTemplate,
  parsed: Record<string, unknown>
): CaptureExtractionPayload | null {
  const kind = template.kind;
  if (kind === 'grade_sheet') {
    const list = Array.isArray(parsed.rows) ? parsed.rows : [];
    if (!list.length) return null;
    return {
      shape: 'grade_sheet',
      rows: list.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          full_name: asString(row.full_name) ?? '',
          student_code: asString(row.student_code),
          maths: asString(row.maths),
          francais: asString(row.francais),
          anglais: asString(row.anglais),
          svt: asString(row.svt),
          hist_geo: asString(row.hist_geo),
          moyenne: asString(row.moyenne),
        };
      }),
      meta: asString(parsed.className) ? { class_name: asString(parsed.className) } : undefined,
    };
  }
  if (kind === 'class_list' || kind === 'attendance' || kind === 'workshop_attendance') {
    const list = Array.isArray(parsed.rows) ? parsed.rows : [];
    if (!list.length) return null;
    const meta: Record<string, string> = {};
    const date = asString(parsed.date);
    if (date) meta.date = date;
    return {
      shape: 'person_rows',
      rows: list.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          full_name: asString(row.full_name) ?? '',
          identifier: asString(row.identifier),
          phone: asString(row.phone),
          email: asString(row.email),
          present: asString(row.present),
          absent: asString(row.absent),
          remark: asString(row.remark),
        };
      }),
      meta: Object.keys(meta).length ? meta : undefined,
    };
  }
  if (kind === 'field_report') {
    const fields = {
      date: asString(parsed.date),
      location: asString(parsed.location),
      participants: asString(parsed.participants),
      activities: asString(parsed.activities),
      results: asString(parsed.results),
      difficulties: asString(parsed.difficulties),
      recommendations: asString(parsed.recommendations),
    };
    if (!Object.values(fields).some(Boolean)) return null;
    return { shape: 'field_report', fields };
  }
  if (kind === 'beneficiary_row') {
    const fields = {
      full_name: asString(parsed.full_name),
      sex_age: asString(parsed.sex_age),
      phone: asString(parsed.phone),
      locality: asString(parsed.locality),
      project: asString(parsed.project),
      remarks: asString(parsed.remarks),
    };
    if (!Object.values(fields).some(Boolean)) return null;
    return { shape: 'beneficiary', fields };
  }
  if (kind === 'daily_site_report') {
    const fields = {
      date: asString(parsed.date),
      workforce: asString(parsed.workforce),
      tasks: asString(parsed.tasks),
      materials: asString(parsed.materials),
      incidents: asString(parsed.incidents),
      observations: asString(parsed.observations),
    };
    if (!Object.values(fields).some(Boolean)) return null;
    return { shape: 'daily_site_report', fields };
  }
  const list = Array.isArray(parsed.rows) ? parsed.rows : [];
  if (!list.length) return null;
  const shape = kindToShape(kind);
  return { shape, rows: list as CaptureExtractionPayload['rows'] } as CaptureExtractionPayload;
}

function buildPayloadFromCsv(
  template: CaptureStandardTemplate,
  csvResult: { rows?: unknown[]; fields?: Record<string, string> }
): CaptureExtractionPayload | null {
  const shape = kindToShape(template.kind);
  if (csvResult.fields && (shape === 'field_report' || shape === 'beneficiary' || shape === 'daily_site_report')) {
    return { shape, fields: csvResult.fields as never } as CaptureExtractionPayload;
  }
  if (csvResult.rows?.length) {
    return { shape, rows: csvResult.rows as never } as CaptureExtractionPayload;
  }
  return null;
}

function countPayload(payload: CaptureExtractionPayload): number {
  if ('rows' in payload && Array.isArray(payload.rows)) return payload.rows.length;
  return 1;
}

function wrapResult(
  template: CaptureStandardTemplate,
  payload: CaptureExtractionPayload,
  parse_method: CaptureExtractionResult['parse_method'],
  warnings: string[],
  confidence: number
): CaptureExtractionResult {
  const row_count = countPayload(payload);
  return {
    template_id: template.id,
    kind: template.kind,
    status: row_count > 0 ? (warnings.length ? 'partial' : 'ok') : 'failed',
    parse_method,
    confidence,
    warnings,
    extracted_at: new Date().toISOString(),
    row_count,
    payload,
  };
}

async function parseWithLlm(
  text: string,
  template: CaptureStandardTemplate,
  organizationId: string
): Promise<{ parsed: Record<string, unknown>; warnings: string[] } | null> {
  const schema = JSON_SCHEMAS[template.kind];
  if (!schema) return null;

  const prompt = [
    `Document KonaData : ${template.label}.`,
    template.description,
    'Le texte provient d\'un scan/OCR (écriture manuscrite possible).',
    'Extrayez UNIQUEMENT les informations lisibles — n\'inventez pas de données.',
    'Répondez avec un JSON valide (pas de markdown) conforme à :',
    schema,
  ].join('\n');

  const raw = await queryKonaAI(prompt, text.slice(0, 24_000), {
    organizationId,
    operation: `capture_extract_${template.kind}`,
  });

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return { parsed, warnings: [] };
  } catch {
    return null;
  }
}

export async function extractCaptureStructured(params: {
  templateId: string;
  text: string;
  buffer?: Buffer;
  fileName: string;
  mimeType?: string | null;
  organizationId: string;
}): Promise<CaptureExtractionResult | null> {
  const template = getCaptureStandardById(params.templateId);
  if (!template) return null;

  const warnings: string[] = [];
  const isCsv =
    params.fileName.toLowerCase().endsWith('.csv') ||
    params.mimeType?.includes('csv') ||
    params.mimeType?.includes('spreadsheet');

  if (isCsv && params.buffer) {
    const csv = parseCaptureCsv(params.buffer, template.kind);
    if (csv) {
      const payload = buildPayloadFromCsv(template, csv);
      if (payload) {
        return wrapResult(template, payload, 'csv', [...warnings, ...csv.warnings], 92);
      }
    }
    warnings.push('CSV détecté mais colonnes non reconnues — tentative OCR/IA.');
  }

  if (!params.text.trim()) {
    return {
      template_id: template.id,
      kind: template.kind,
      status: 'failed',
      parse_method: 'heuristic',
      confidence: 0,
      warnings: ['Aucun texte extrait du fichier.'],
      extracted_at: new Date().toISOString(),
      row_count: 0,
      payload: { shape: kindToShape(template.kind), rows: [] } as CaptureExtractionPayload,
    };
  }

  if (hasActiveLlmApi()) {
    const llm = await parseWithLlm(params.text, template, params.organizationId);
    if (llm?.parsed) {
      const payload = buildPayload(template, llm.parsed);
      if (payload) {
        return wrapResult(template, payload, 'llm', llm.warnings, 78);
      }
      warnings.push('KonaAI n\'a pas structuré de lignes exploitables.');
    } else {
      warnings.push('Structuration KonaAI impossible — analyse locale.');
    }
  } else {
    warnings.push('KonaAI indisponible — déposez un CSV KonaData ou activez l\'API LLM.');
  }

  if (params.buffer && !isCsv) {
    const csvTry = parseCaptureCsv(params.buffer, template.kind);
    if (csvTry) {
      const payload = buildPayloadFromCsv(template, csvTry);
      if (payload) return wrapResult(template, payload, 'csv', warnings, 70);
    }
  }

  return {
    template_id: template.id,
    kind: template.kind,
    status: 'failed',
    parse_method: 'heuristic',
    confidence: 0,
    warnings,
    extracted_at: new Date().toISOString(),
    row_count: 0,
    payload:
      template.kind === 'field_report' || template.kind === 'beneficiary_row' || template.kind === 'daily_site_report'
        ? ({ shape: kindToShape(template.kind), fields: {} } as CaptureExtractionPayload)
        : ({ shape: kindToShape(template.kind), rows: [] } as CaptureExtractionPayload),
  };
}
