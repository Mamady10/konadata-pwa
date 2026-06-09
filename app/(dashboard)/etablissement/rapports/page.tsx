import { getDocuments } from '@/lib/actions/storage';
import { parseDocumentAiAdaptation } from '@/lib/ai/template-adaptation-types';
import { parseCaptureExtraction } from '@/lib/ai/extraction/capture-extraction-parse';
import { getCaptureStandardsForSector } from '@/lib/documents/capture-standard-templates';
import { listAiGeneratedReports } from '@/lib/actions/ai-report-archive';
import type { AiGeneratedReportRow } from '@/lib/actions/ai-report-archive';

import { createClient } from '@/lib/supabase/server';

import { getSchoolFinanceByClass, getClasses } from '@/lib/actions/school';

import { RapportsEtablissementClient } from './rapports-client';

import { redirect } from 'next/navigation';

import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';

import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';



export default async function RapportsEtablissementPage() {

  const session = await requireEtablissementPage('rapports');

  const caps = getEtablissementCapabilities(session.profile?.role);

  const orgId = session.profile?.organization_id;

  if (!orgId) redirect('/etablissement');



  const supabase = await createClient();



  const [documents, students, payments, reportCards, financeOverview, classRows] = await Promise.all([

    getDocuments(orgId, { limit: 50 }).catch(() => []),

    supabase

      .from('school_students')

      .select('id', { count: 'exact', head: true })

      .eq('organization_id', orgId)

      .eq('enrollment_status', 'enrolled'),

    supabase.from('school_payments').select('amount, status').eq('organization_id', orgId),

    supabase

      .from('school_report_cards')

      .select('id', { count: 'exact', head: true })

      .eq('organization_id', orgId),

    caps.viewFinanceStats ? getSchoolFinanceByClass(orgId).catch(() => null) : Promise.resolve(null),
    getClasses(orgId).catch(() => []),
  ]);



  const paymentRows = payments.data ?? [];

  const amountCollected = paymentRows

    .filter((p) => p.status === 'paid')

    .reduce((s, p) => s + Number(p.amount), 0);



  let reportHistory: AiGeneratedReportRow[] = [];
  if (caps.generateReportCards) {
    const hist = await listAiGeneratedReports('school');
    reportHistory = 'error' in hist ? [] : hist;
  }

  const captureTypes = getCaptureStandardsForSector('school').map((t) => ({
    id: t.id,
    label: t.label,
    hint: t.hint,
  }));

  const docRows = documents.map((d) => {
    const extracted = d.extracted_data;
    return {
      id: d.id,
      title: d.file_name,
      type: d.mime_type?.includes('pdf') ? 'PDF' : 'Fichier',
      size: d.file_size ? `${(Number(d.file_size) / 1024 / 1024).toFixed(1)} MB` : '—',
      date: new Date(d.created_at).toLocaleDateString('fr-FR'),
      category: String(d.category ?? 'other'),
      documentType: (extracted?.document_type as string) ?? null,
      status: 'Archivé',
      aiAdaptation: parseDocumentAiAdaptation(extracted),
      captureExtraction: parseCaptureExtraction(extracted),
    };
  });



  return (

    <RapportsEtablissementClient
      documents={docRows}
      captureDocumentTypes={captureTypes}
      financeOverview={financeOverview}
      showFinance={caps.viewFinanceStats}
      isDirector={caps.generateReportCards}
      canUploadCapture={caps.manageStudents}
      classes={(classRows ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
      }))}
      reportHistory={reportHistory}
      stats={{

        totalStudents: students.count ?? 0,

        totalPayments: paymentRows.length,

        amountCollected,

        reportCards: reportCards.count ?? 0,

      }}

    />

  );

}

