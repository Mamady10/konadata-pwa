import { getPmeDocuments } from '@/lib/actions/storage';
import { getCaptureStandardsForSector } from '@/lib/documents/capture-standard-templates';
import { createClient } from '@/lib/supabase/server';
import { requirePmePage } from '@/lib/pme/require-pme-page';
import { PmeDocumentsClient } from './documents-client';

export default async function Page() {
  const session = await requirePmePage('documents');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  let customTypes: Array<{ code: string; label: string; hint: string | null }> = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('organization_document_types')
      .select('code, label, hint')
      .eq('organization_id', orgId)
      .eq('sector', 'pme')
      .eq('is_active', true);
    customTypes = (data ?? []) as typeof customTypes;
  } catch {
    /* table absente en production */
  }

  const captureTypes = getCaptureStandardsForSector('pme').map((t) => ({
    id: t.id,
    label: `${t.label} (KonaData)`,
    hint: t.hint,
  }));

  const documentTypes = [
    ...captureTypes,
    ...(customTypes ?? []).map((r) => ({
      id: r.code as string,
      label: r.label as string,
      hint: (r.hint as string) || undefined,
    })),
  ];

  let documents: Awaited<ReturnType<typeof getPmeDocuments>> = [];
  try {
    documents = await getPmeDocuments(orgId);
  } catch {
    /* table documents */
  }

  return <PmeDocumentsClient documents={documents} documentTypes={documentTypes} />;
}
