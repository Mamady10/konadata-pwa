import { getSession } from '@/lib/actions/auth';
import { getDocuments } from '@/lib/actions/storage';
import { getOrgIndexedDocumentStats } from '@/lib/actions/document-search';
import { DataFactoryClient } from './data-factory-client';
import { redirect } from 'next/navigation';

export default async function DataFactoryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const orgId = session.profile?.organization_id;
  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Organisation requise</h2>
        <p className="text-muted-foreground mt-2">Liez votre compte à une organisation pour téléverser des documents.</p>
      </div>
    );
  }

  let documents: Awaited<ReturnType<typeof getDocuments>> = [];
  let stats = { indexed: 0, total: 0 };
  try {
    documents = await getDocuments(orgId);
    const s = await getOrgIndexedDocumentStats();
    if (!('error' in s)) stats = s;
  } catch {
    documents = [];
  }

  const rows = documents.map((d) => {
    const ext = d.extracted_data;
    return {
      id: d.id,
      file_name: d.file_name,
      file_size: d.file_size,
      category: d.category,
      status: d.status,
      created_at: d.created_at,
      extraction_status: (ext?.extraction_status as string) ?? null,
      extraction_method: (ext?.extraction_method as string) ?? null,
      extraction_message: (ext?.extraction_message as string) ?? null,
      char_count: typeof ext?.char_count === 'number' ? ext.char_count : null,
      has_search_text: d.indexed,
    };
  });

  return (
    <DataFactoryClient
      initialDocuments={rows}
      indexedCount={stats.indexed}
      totalCount={stats.total}
    />
  );
}
