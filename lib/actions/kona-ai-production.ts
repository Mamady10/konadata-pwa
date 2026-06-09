'use server';

import { canManageAssignments } from '@/lib/actions/assignments';
import { saveAiGeneratedReport } from '@/lib/actions/ai-report-archive';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { getOrganizationAiTemplates } from '@/lib/actions/document-templates';
import {
  productionKindLabel,
  templatePurposeForKind,
  templateSectorFromOrgType,
  type ProductionDocumentKind,
} from '@/lib/ai/production/document-kind';

export type { ProductionDocumentKind };
import { generateProducedDocument } from '@/lib/ai/production/generate-produced-document';
import { SCOPE_ALL } from '@/lib/ai/sector-report-types';
import { getOrgType } from '@/types/database';
import type { TemplateSector } from '@/lib/ai/document-template-purposes';
import { getClasses } from '@/lib/actions/school';
import { getNgoProjects } from '@/lib/actions/ngo';
import { getBtpSites } from '@/lib/actions/btp';
import { revalidatePath } from 'next/cache';

export type ProductionScopeOption = { id: string; label: string };

export type ProductionTemplateStatus = {
  kind: ProductionDocumentKind;
  purpose: string;
  label: string;
  registered: boolean;
};

export type GradeScanOption = {
  documentId: string;
  label: string;
  extractionStatus: string;
};

export type KonaProductionConfig = {
  canProduce: boolean;
  sector: TemplateSector | null;
  kinds: ProductionDocumentKind[];
  scopes: ProductionScopeOption[];
  templates: ProductionTemplateStatus[];
  modelsHref: string;
  /** Bulletins manuscrits déposés par les enseignants (école). */
  scanDocuments: GradeScanOption[];
};

async function requireDirector(): Promise<{ error: string } | { ok: true }> {
  const ok = await canManageAssignments();
  if (!ok) {
    return { error: 'La production de documents est réservée aux directeurs.' };
  }
  return { ok: true };
}

async function loadOrg(): Promise<
  | { error: string }
  | { orgId: string; orgName: string; orgType: string; sector: TemplateSector }
> {
  const session = await getSession();
  if (!session?.profile?.organization_id) {
    return {
      error:
        'Aucune organisation liée à ce compte. Rejoignez votre structure via /rejoindre ou utilisez un compte directeur.',
    };
  }

  const org = session.profile.organizations as {
    name?: string;
    type?: string;
  } | null;

  const orgType = getOrgType(org as Parameters<typeof getOrgType>[0]) ?? org?.type ?? 'school';
  const sector = templateSectorFromOrgType(orgType);
  if (!sector) {
    return { error: 'KonaAI production n\'est pas disponible pour ce type d\'organisation.' };
  }

  return {
    orgId: session.profile.organization_id,
    orgName: org?.name?.trim() || 'Mon organisation',
    orgType,
    sector,
  };
}

async function loadScopes(
  orgId: string,
  sector: TemplateSector
): Promise<ProductionScopeOption[]> {
  const allLabel =
    sector === 'school'
      ? 'Tout l\'établissement'
      : sector === 'ngo'
        ? 'Tous les projets'
        : 'Tous les chantiers';

  const all: ProductionScopeOption[] = [{ id: SCOPE_ALL, label: allLabel }];

  if (sector === 'school') {
    const classes = await getClasses(orgId);
    return [
      ...all,
      ...classes.map((c) => ({ id: c.id as string, label: c.name as string })),
    ];
  }
  if (sector === 'ngo') {
    const projects = await getNgoProjects(orgId);
    return [
      ...all,
      ...projects.map((p) => ({ id: p.id as string, label: p.name as string })),
    ];
  }
  const sites = await getBtpSites(orgId);
  return [
    ...all,
    ...sites.map((s) => ({ id: s.id as string, label: s.name as string })),
  ];
}

export async function getKonaProductionConfig(): Promise<
  KonaProductionConfig | { error: string }
> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const loaded = await loadOrg();
  if ('error' in loaded) return loaded;

  const kinds: ProductionDocumentKind[] =
    loaded.sector === 'school' ? ['rapport', 'bulletin'] : ['rapport'];

  const templates = await getOrganizationAiTemplates(loaded.orgId, loaded.sector);
  const templateStatuses: ProductionTemplateStatus[] = kinds.map((kind) => {
    const purposeRes = templatePurposeForKind(loaded.sector, kind);
    const purpose = 'error' in purposeRes ? '' : purposeRes.purpose;
    const row = templates.find((t) => t.purpose === purpose);
    return {
      kind,
      purpose,
      label: row?.label ?? productionKindLabel(kind),
      registered: Boolean(row),
    };
  });

  const scopes = await loadScopes(loaded.orgId, loaded.sector);

  let scanDocuments: GradeScanOption[] = [];
  if (loaded.sector === 'school') {
    const { listGradeScanDocumentsForDirector } = await import(
      '@/lib/actions/grade-scan-production'
    );
    const scans = await listGradeScanDocumentsForDirector();
    if (Array.isArray(scans)) {
      scanDocuments = scans.map((s) => ({
        documentId: s.documentId,
        label: `${s.studentName ?? s.fileName} — ${s.className} (${s.examType})`,
        extractionStatus: s.extractionStatus,
      }));
    }
  }

  return {
    canProduce: true,
    sector: loaded.sector,
    kinds,
    scopes,
    templates: templateStatuses,
    modelsHref: '/parametres/modeles',
    scanDocuments,
  };
}

export type GenerateProducedDocumentResult =
  | { error: string }
  | {
      content: string;
      usedLlm: boolean;
      title: string;
      archiveId: string;
      reportPath: string;
    };

function revalidateAfterProduction(sector: TemplateSector, kind: ProductionDocumentKind) {
  if (sector === 'school') {
    revalidatePath('/etablissement/rapports');
    if (kind === 'bulletin') revalidatePath('/etablissement/bulletins');
  }
  if (sector === 'ngo') revalidatePath('/ong/rapports');
  if (sector === 'btp') revalidatePath('/btp/rapports');
}

export async function generateAndArchiveProducedDocument(params: {
  kind: ProductionDocumentKind;
  scopeId?: string;
}): Promise<GenerateProducedDocumentResult> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  if (params.kind !== 'rapport' && params.kind !== 'bulletin') {
    return { error: 'Type invalide : choisissez rapport ou bulletin.' };
  }

  const loaded = await loadOrg();
  if ('error' in loaded) return loaded;

  const orgId = await requireOrgId();
  if (orgId !== loaded.orgId) return { error: 'Session organisation invalide.' };

  const generated = await generateProducedDocument({
    orgId: loaded.orgId,
    orgName: loaded.orgName,
    sector: loaded.sector,
    kind: params.kind,
    scopeId: params.scopeId,
  });

  if ('error' in generated) return generated;

  const saved = await saveAiGeneratedReport({
    sector: loaded.sector,
    scopeId: generated.scopeId,
    scopeLabel: generated.scopeLabel,
    reportType: generated.templatePurpose,
    reportTypeLabel: generated.reportTypeLabel,
    title: generated.title,
    subtitle: generated.subtitle,
    content: generated.content,
    usedLlm: generated.usedLlm,
  });

  if ('error' in saved) return saved;

  revalidateAfterProduction(loaded.sector, params.kind);

  const reportPath =
    loaded.sector === 'school'
      ? '/etablissement/rapports'
      : loaded.sector === 'ngo'
        ? '/ong/rapports'
        : '/btp/rapports';

  return {
    content: generated.content,
    usedLlm: generated.usedLlm,
    title: generated.title,
    archiveId: saved.id,
    reportPath,
  };
}

export async function generateAndArchiveBulletinFromScan(
  documentId: string
): Promise<GenerateProducedDocumentResult> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const { generateAndArchiveBulletinFromScan: produce } = await import(
    '@/lib/actions/grade-scan-production'
  );
  const res = await produce(documentId);
  if ('error' in res) return res;

  return {
    content: res.content,
    usedLlm: res.usedLlm,
    title: res.title,
    archiveId: res.archiveId,
    reportPath: res.reportPath,
  };
}
