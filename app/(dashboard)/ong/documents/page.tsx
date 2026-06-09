import { getNgoProjects } from '@/lib/actions/ngo';
import { getNgoDocuments } from '@/lib/actions/storage';
import { getMergedDocumentTypesForCurrentOrg } from '@/lib/actions/org-document-types';
import { canManageAssignments, getMyAssignedNgoProjectIds } from '@/lib/actions/assignments';
import { DocumentsClient } from './documents-client';
import { requireOngPage } from '@/lib/ong/require-ong-page';

export default async function Page() {
  const session = await requireOngPage('documents');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  const [isDirector, assignedIds] = await Promise.all([
    canManageAssignments(),
    getMyAssignedNgoProjectIds(),
  ]);

  let documents: Awaited<ReturnType<typeof getNgoDocuments>> = [];
  let projects: { id: string; name: string }[] = [];
  let documentTypes = await getMergedDocumentTypesForCurrentOrg('ngo').catch(() => []);

  try {
    const [docs, allProjects] = await Promise.all([
      getNgoDocuments(orgId),
      getNgoProjects(orgId),
    ]);
    documents = docs;
    projects = allProjects.map((p) => ({ id: p.id as string, name: p.name as string }));
    if (assignedIds !== null) {
      const allowed = new Set(assignedIds);
      projects = projects.filter((p) => allowed.has(p.id));
    }
  } catch {
    /* migration 016 */
  }

  return (
    <DocumentsClient
      documents={documents}
      projects={projects}
      documentTypes={documentTypes}
      isDirector={isDirector}
      hasAssignments={assignedIds === null || assignedIds.length > 0}
    />
  );
}
