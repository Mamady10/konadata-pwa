import { notFound } from 'next/navigation';
import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { canManageAssignments } from '@/lib/actions/assignments';
import { getMergedDocumentTypesForCurrentOrg } from '@/lib/actions/org-document-types';
import {
  getBtpSiteDetail,
  getBtpSiteDocuments,
} from '@/lib/actions/btp-site-detail';
import { BtpSiteDetailClient } from './site-detail-client';

interface Props {
  params: Promise<{ siteId: string }>;
}

export default async function BtpSiteDetailPage({ params }: Props) {
  const { siteId } = await params;
  await requireBtpPage('chantiers');

  const [site, documents, isDirector] = await Promise.all([
    getBtpSiteDetail(siteId),
    getBtpSiteDocuments(siteId),
    canManageAssignments(),
  ]);

  if (!site) notFound();

  const documentTypes = await getMergedDocumentTypesForCurrentOrg('btp').catch(() => []);

  return (
    <BtpSiteDetailClient
      site={site}
      documents={documents.map((d) => ({
        id: d.id,
        file_name: d.file_name,
        doc_type_label: d.doc_type_label,
        created_at: d.created_at,
      }))}
      documentTypes={documentTypes.map((t) => ({ id: t.id, label: t.label }))}
      isDirector={isDirector}
      canUpload={site.status !== 'completed'}
    />
  );
}
