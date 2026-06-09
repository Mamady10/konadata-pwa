import { getSession } from '@/lib/actions/auth';
import { getDirectorTemplateSector, getOrganizationAiTemplatesForCurrentOrg } from '@/lib/actions/document-templates';
import { canManageAssignments } from '@/lib/actions/assignments';
import { ModelesIaClient } from './modeles-client';
import { redirect } from 'next/navigation';
import type { Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import type { TemplateSector } from '@/lib/ai/document-template-purposes';
import { getCaptureStandardsForSector } from '@/lib/documents/capture-standard-templates';
import { hasActiveLlmApi } from '@/lib/integrations/openai';
import { resolveAssistantNavVisible } from '@/lib/ai/chat/assistant-nav-server';

export default async function ModelesIaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const navVisible = await resolveAssistantNavVisible();
  if (!navVisible) {
    redirect('/parametres');
  }

  const canManage = await canManageAssignments();
  if (!canManage) {
    redirect('/parametres');
  }

  const org = session.profile?.organizations as Organization | null;
  const sector = (await getDirectorTemplateSector()) as TemplateSector | null;

  if (!sector) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center max-w-lg">
        <h2 className="text-lg font-semibold">Organisation non reconnue</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Les modèles IA sont disponibles pour les organisations École, ONG, BTP et PME.
        </p>
      </div>
    );
  }

  const { purposes, templates } = await getOrganizationAiTemplatesForCurrentOrg(sector);
  const captureTemplates = getCaptureStandardsForSector(sector);

  const orgType = getOrgType(org);
  const orgTypeLabel =
    orgType === 'school'
      ? 'Établissement'
      : orgType === 'ngo'
        ? 'ONG'
        : orgType === 'btp'
          ? 'BTP'
          : 'PME';

  return (
    <ModelesIaClient
      orgName={org?.name ?? 'Organisation'}
      sector={sector}
      orgTypeLabel={orgTypeLabel}
      purposes={purposes}
      templates={templates}
      captureTemplates={captureTemplates}
      hasOpenAiKey={hasActiveLlmApi()}
    />
  );
}
