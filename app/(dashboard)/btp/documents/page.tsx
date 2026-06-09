import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpSites } from '@/lib/actions/btp';
import { getBtpDocuments } from '@/lib/actions/storage';
import { getMergedDocumentTypesForCurrentOrg } from '@/lib/actions/org-document-types';
import { canManageAssignments, getMyAssignedBtpSiteIds } from '@/lib/actions/assignments';
import { BtpDocumentsClient } from './documents-client';
export default async function Page() {
  const session = await requireBtpPage('documents');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  const [isDirector, assignedIds] = await Promise.all([
    canManageAssignments(),
    getMyAssignedBtpSiteIds(),
  ]);

  let documents: Awaited<ReturnType<typeof getBtpDocuments>> = [];
  let sites: { id: string; name: string }[] = [];
  let documentTypes = await getMergedDocumentTypesForCurrentOrg('btp').catch(() => []);

  try {
    const [docs, allSites] = await Promise.all([
      getBtpDocuments(orgId),
      getBtpSites(orgId),
    ]);
    documents = docs;
    sites = allSites.map((s) => ({ id: s.id as string, name: s.name as string }));
    if (assignedIds !== null) {
      const allowed = new Set(assignedIds);
      sites = sites.filter((s) => allowed.has(s.id));
    }
  } catch {
    /* migration 022 */
  }

  return (
    <BtpDocumentsClient
      documents={documents}
      sites={sites}
      documentTypes={documentTypes}
      isDirector={isDirector}
      hasAssignments={assignedIds === null || assignedIds.length > 0}
    />
  );
}
