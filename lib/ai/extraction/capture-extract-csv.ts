import type { CaptureTemplateKind } from '@/lib/documents/capture-standard-templates';
import type {
  CaptureBeneficiaryFields,
  CaptureDailySiteReport,
  CaptureDeliveryRow,
  CaptureExpenseRow,
  CaptureFieldReport,
  CaptureFuelRow,
  CaptureGradeSheetRow,
  CapturePersonRow,
  CapturePurchaseRow,
  CaptureStockRow,
} from '@/lib/ai/extraction/capture-extract-types';

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if ((ch === ';' || ch === ',') && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0]).map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  );
  const rows = lines.slice(1).map((l) => parseCsvLine(l));
  return { headers, rows };
}

function col(row: string[], headers: string[], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const idx = headers.indexOf(key);
    if (idx >= 0 && row[idx]?.trim()) return row[idx].trim();
  }
  return undefined;
}

function nonEmptyRows<T>(rows: T[], isEmpty: (r: T) => boolean): T[] {
  return rows.filter((r) => !isEmpty(r));
}

export function parseCaptureCsv(
  buffer: Buffer,
  kind: CaptureTemplateKind
): { rows?: unknown[]; fields?: Record<string, string>; warnings: string[] } | null {
  const text = buffer.toString('utf8');
  const { headers, rows } = parseCsvText(text);
  if (!headers.length) return null;

  const warnings: string[] = [];

  switch (kind) {
    case 'grade_sheet': {
      const known = new Set([
        'nom',
        'full_name',
        'name',
        'code_eleve',
        'matricule',
        'student_code',
        'maths',
        'math',
        'francais',
        'anglais',
        'english',
        'svt',
        'hist_geo',
        'histoire',
        'moyenne',
        'average',
      ]);
      const parsed: CaptureGradeSheetRow[] = nonEmptyRows(
        rows.map((r) => {
          const row: CaptureGradeSheetRow & Record<string, string | undefined> = {
            full_name: col(r, headers, 'nom', 'full_name', 'name') ?? '',
            student_code: col(r, headers, 'code_eleve', 'matricule', 'student_code'),
            maths: col(r, headers, 'maths', 'math'),
            francais: col(r, headers, 'francais', 'francais'),
            anglais: col(r, headers, 'anglais', 'english'),
            svt: col(r, headers, 'svt'),
            hist_geo: col(r, headers, 'hist_geo', 'histoire'),
            moyenne: col(r, headers, 'moyenne', 'average'),
          };
          headers.forEach((h, i) => {
            if (known.has(h)) return;
            const val = r[i]?.trim();
            if (val) row[h] = val;
          });
          return row;
        }),
        (r) => !r.full_name
      );
      return parsed.length ? { rows: parsed, warnings } : null;
    }
    case 'class_list':
    case 'attendance':
    case 'workshop_attendance': {
      const parsed: CapturePersonRow[] = nonEmptyRows(
        rows.map((r) => ({
          full_name: col(r, headers, 'nom', 'full_name', 'name') ?? '',
          identifier: col(r, headers, 'code_eleve', 'matricule', 'identifiant', 'identifier'),
          phone: col(r, headers, 'telephone', 'phone', 'tel'),
          email: col(r, headers, 'email', 'mail'),
          present: col(r, headers, 'present'),
          absent: col(r, headers, 'absent'),
          remark: col(r, headers, 'remarque', 'remark'),
        })),
        (r) => !r.full_name
      );
      return parsed.length ? { rows: parsed, warnings } : null;
    }
    case 'field_report': {
      const r = rows[0] ?? [];
      const fields: CaptureFieldReport = {
        date: col(r, headers, 'date'),
        location: col(r, headers, 'lieu', 'location'),
        participants: col(r, headers, 'participants'),
        activities: col(r, headers, 'activites', 'activities'),
        results: col(r, headers, 'resultats', 'results'),
        difficulties: col(r, headers, 'difficultes', 'difficulties'),
        recommendations: col(r, headers, 'recommandations', 'recommendations'),
      };
      return { fields, warnings };
    }
    case 'beneficiary_row': {
      const r = rows[0] ?? [];
      const fields: CaptureBeneficiaryFields = {
        full_name: col(r, headers, 'nom', 'full_name'),
        sex_age: col(r, headers, 'sexe_age', 'sex_age'),
        phone: col(r, headers, 'telephone', 'phone'),
        locality: col(r, headers, 'localite', 'locality'),
        project: col(r, headers, 'projet', 'project'),
        remarks: col(r, headers, 'remarques', 'remarks'),
      };
      return { fields, warnings };
    }
    case 'daily_site_report': {
      const r = rows[0] ?? [];
      const fields: CaptureDailySiteReport = {
        date: col(r, headers, 'date'),
        workforce: col(r, headers, 'effectif', 'workforce'),
        tasks: col(r, headers, 'travaux', 'tasks'),
        materials: col(r, headers, 'materiels', 'materials'),
        incidents: col(r, headers, 'incidents'),
        observations: col(r, headers, 'observations'),
      };
      return { fields, warnings };
    }
    case 'fuel_sheet': {
      const parsed: CaptureFuelRow[] = nonEmptyRows(
        rows.map((r) => ({
          date: col(r, headers, 'date'),
          equipment: col(r, headers, 'engin', 'equipment'),
          liters: col(r, headers, 'litres', 'liters'),
          meter_index: col(r, headers, 'index', 'meter_index'),
          driver: col(r, headers, 'chauffeur', 'driver'),
          remark: col(r, headers, 'observation', 'remark'),
        })),
        (r) => !r.date && !r.equipment && !r.liters
      );
      return parsed.length ? { rows: parsed, warnings } : null;
    }
    case 'delivery_note': {
      const parsed: CaptureDeliveryRow[] = nonEmptyRows(
        rows.map((r) => ({
          date: col(r, headers, 'date'),
          supplier: col(r, headers, 'fournisseur', 'supplier'),
          material: col(r, headers, 'materiau', 'material'),
          quantity: col(r, headers, 'quantite', 'quantity'),
          unit: col(r, headers, 'unite', 'unit'),
          received_by: col(r, headers, 'recu_par', 'received_by'),
        })),
        (r) => !r.supplier && !r.material
      );
      return parsed.length ? { rows: parsed, warnings } : null;
    }
    case 'expense_sheet': {
      const parsed: CaptureExpenseRow[] = nonEmptyRows(
        rows.map((r) => ({
          date: col(r, headers, 'date'),
          label: col(r, headers, 'libelle', 'label'),
          amount_gnf: col(r, headers, 'montant_gnf', 'montant', 'amount_gnf'),
          payment_mode: col(r, headers, 'mode_paiement', 'payment_mode'),
          receipt_ref: col(r, headers, 'justificatif', 'receipt_ref'),
        })),
        (r) => !r.label && !r.amount_gnf
      );
      return parsed.length ? { rows: parsed, warnings } : null;
    }
    case 'purchase_order': {
      const parsed: CapturePurchaseRow[] = nonEmptyRows(
        rows.map((r) => ({
          reference: col(r, headers, 'reference', 'ref'),
          designation: col(r, headers, 'designation'),
          quantity: col(r, headers, 'quantite', 'quantity'),
          unit_price_gnf: col(r, headers, 'prix_unitaire_gnf', 'unit_price'),
          total_gnf: col(r, headers, 'total_gnf', 'total'),
          remark: col(r, headers, 'remarque', 'remark'),
        })),
        (r) => !r.designation
      );
      return parsed.length ? { rows: parsed, warnings } : null;
    }
    case 'stock_count': {
      const parsed: CaptureStockRow[] = nonEmptyRows(
        rows.map((r) => ({
          reference: col(r, headers, 'reference', 'ref'),
          designation: col(r, headers, 'designation'),
          quantity_counted: col(r, headers, 'quantite_comptee', 'quantity'),
          unit: col(r, headers, 'unite', 'unit'),
          variance: col(r, headers, 'ecart', 'variance'),
          remark: col(r, headers, 'observation', 'remark'),
        })),
        (r) => !r.designation && !r.reference
      );
      return parsed.length ? { rows: parsed, warnings } : null;
    }
    default:
      return null;
  }
}
