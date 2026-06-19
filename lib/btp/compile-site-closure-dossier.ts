import { createClient } from '@/lib/supabase/server';
import { getDocumentTypeLabel } from '@/lib/documents/sector-document-types';
import {
  compileBtpWeeklySiteReport,
  BTP_WEEKLY_SITE_REPORT_LABEL,
} from '@/lib/btp/compile-weekly-site-report';

export const BTP_SITE_CLOSURE_REPORT_TYPE = 'site_closure';
export const BTP_SITE_CLOSURE_REPORT_LABEL = 'Dossier de clôture chantier';

export interface BtpSiteClosureDossierResult {
  siteName: string;
  periodFrom: string;
  periodTo: string;
  report: string;
  title: string;
  subtitle: string;
  documentCount: number;
  structuredReport: Awaited<ReturnType<typeof compileBtpWeeklySiteReport>>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function compileBtpSiteClosureDossier(params: {
  orgId: string;
  siteId: string;
  closureComment?: string | null;
  orgName?: string | null;
  planningRefSlot?: 1 | 2;
}): Promise<BtpSiteClosureDossierResult> {
  const supabase = await createClient();

  const { data: site, error: siteErr } = await supabase
    .from('btp_sites')
    .select('id, name, start_date, end_date')
    .eq('organization_id', params.orgId)
    .eq('id', params.siteId)
    .maybeSingle();

  if (siteErr) throw new Error(siteErr.message);
  if (!site?.id) throw new Error('Chantier introuvable.');

  const periodFrom = (site.start_date as string | null)?.slice(0, 10) ?? todayIso();
  const endPlanned = (site.end_date as string | null)?.slice(0, 10);
  const periodTo = endPlanned && endPlanned < todayIso() ? endPlanned : todayIso();

  const structuredReport = await compileBtpWeeklySiteReport({
    orgId: params.orgId,
    siteId: params.siteId,
    periodType: 'year',
    periodValue: 'closure',
    customPeriodFrom: periodFrom,
    customPeriodTo: periodTo,
    customPeriodLabel: `Synthèse chantier — ${periodFrom} au ${periodTo}`,
    weeklyComment: params.closureComment ?? null,
    orgName: params.orgName ?? null,
    planningRefSlot: params.planningRefSlot ?? 1,
  });

  const { data: docLinks } = await supabase
    .from('btp_site_documents')
    .select('doc_type, created_at, documents(id, file_name, created_at, mime_type)')
    .eq('organization_id', params.orgId)
    .eq('site_id', params.siteId);

  const docLines: string[] = [];
  for (const row of [...(docLinks ?? [])].sort((a, b) =>
    String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  )) {
    const doc = row.documents as {
      id?: string;
      file_name?: string;
      created_at?: string;
      mime_type?: string;
    } | null;
    if (!doc?.file_name) continue;
    const typeLabel = getDocumentTypeLabel('btp', (row.doc_type as string) || null);
    const date = doc.created_at ? doc.created_at.slice(0, 10) : '—';
    docLines.push(`• [${typeLabel}] ${doc.file_name} (${date})`);
  }

  const siteName = site.name as string;
  const title = `Dossier de clôture — ${siteName}`;
  const subtitle = `${BTP_WEEKLY_SITE_REPORT_LABEL} + pièces jointes`;

  const dossierBlock = [
    '',
    '════════════════════════════════════════',
    'DOSSIER DE CLÔTURE / RÉCEPTION MOA',
    '════════════════════════════════════════',
    '',
    params.closureComment?.trim()
      ? `Commentaire direction :\n${params.closureComment.trim()}\n`
      : '',
    `Période couverte : ${periodFrom} → ${periodTo}`,
    `Pièces archivées sur le chantier : ${docLines.length}`,
    '',
    docLines.length > 0 ? 'Liste des documents :\n' + docLines.join('\n') : 'Aucun document téléversé sur ce chantier.',
    '',
    '— Fin du dossier de clôture —',
  ].join('\n');

  const report = `${structuredReport.report}\n${dossierBlock}`;

  return {
    siteName,
    periodFrom,
    periodTo,
    report,
    title,
    subtitle,
    documentCount: docLines.length,
    structuredReport,
  };
}
