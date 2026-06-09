import { gatherBtpReport } from '@/lib/ai/reports/gather-btp';
import { gatherNgoReport } from '@/lib/ai/reports/gather-ngo';
import { gatherSchoolReport } from '@/lib/ai/reports/gather-school';
import { formatCurrencyGnf } from '@/lib/ai/reports/render-report';
import { SCOPE_ALL } from '@/lib/ai/sector-report-types';
import { getPmeDashboard } from '@/lib/actions/pme';
import { getOrganizationKonaScore, getPmeDashboardKpis } from '@/lib/actions/data';
import { chatSectorFromOrgType, type KonaChatSector } from '@/lib/ai/chat/org-sector';
import type { OrganizationType } from '@/types/database';

async function gatherPmeChatContext(orgId: string): Promise<string> {
  const [kpis, dash, score] = await Promise.all([
    getPmeDashboardKpis(orgId),
    getPmeDashboard(orgId),
    getOrganizationKonaScore(orgId),
  ]);

  const lines: string[] = [
    '=== PME — Synthèse organisation ===',
    `Chiffre d'affaires (ventes enregistrées): ${formatCurrencyGnf(kpis.revenue)} (${kpis.totalSales} vente(s))`,
    `Dépenses: ${formatCurrencyGnf(kpis.totalExpenses)}`,
    `Résultat net (CA − dépenses): ${formatCurrencyGnf(kpis.profit)}`,
    `Créances clients: ${formatCurrencyGnf(kpis.receivables)}`,
    `Produits catalogue: ${kpis.totalProducts}, alertes stock bas: ${kpis.lowStockItems}`,
    `Ventes en attente de paiement (échantillon récent): ${dash.pendingSales}`,
  ];

  if (score) {
    lines.push(
      `KonaScore: ${Number(score.global_score).toFixed(0)}/100 (niveau ${score.level})`
    );
  }

  if (dash.recentSales.length > 0) {
    lines.push('', '=== Dernières ventes ===');
    for (const s of dash.recentSales.slice(0, 5)) {
      lines.push(`• ${s.reference} — ${s.client} — ${formatCurrencyGnf(s.total)} — ${s.status} — ${s.date}`);
    }
  }

  if (dash.receivables.length > 0) {
    lines.push('', '=== Créances ===');
    for (const c of dash.receivables.slice(0, 5)) {
      lines.push(`• ${c.name}: ${formatCurrencyGnf(c.balance)}`);
    }
  }

  if (dash.lowStock.length > 0) {
    lines.push('', '=== Stock bas ===');
    for (const p of dash.lowStock.slice(0, 5)) {
      lines.push(`• ${p.name}: ${p.stock} (min ${p.min})`);
    }
  }

  if (dash.recentExpenses.length > 0) {
    lines.push('', '=== Dernières dépenses ===');
    for (const e of dash.recentExpenses.slice(0, 5)) {
      lines.push(`• ${e.category}: ${formatCurrencyGnf(e.amount)} — ${e.date}`);
    }
  }

  return lines.join('\n');
}

export async function gatherOrgChatContext(
  orgId: string,
  orgType: OrganizationType | string,
  userMessage?: string
): Promise<string> {
  const sector = chatSectorFromOrgType(orgType);

  let base: string;
  if (sector === 'etablissement') {
    const gathered = await gatherSchoolReport(orgId, SCOPE_ALL, 'overview');
    base = gathered.contextText;
  } else if (sector === 'ong') {
    const gathered = await gatherNgoReport(orgId, SCOPE_ALL, 'general');
    base = gathered.contextText;
  } else if (sector === 'btp') {
    const gathered = await gatherBtpReport(orgId, SCOPE_ALL, 'general');
    base = gathered.contextText;
  } else if (sector === 'pme') {
    base = await gatherPmeChatContext(orgId);
  } else {
    base = 'Organisation sans module métier actif. Utilisez le tableau de bord global.';
  }

  return appendDocumentBlock(orgId, base, userMessage);
}

async function appendDocumentBlock(
  orgId: string,
  baseContext: string,
  userMessage?: string
): Promise<string> {
  try {
    const { gatherDocumentContextForChat } = await import('@/lib/ai/documents/gather-document-context');
    const docBlock = await gatherDocumentContextForChat(orgId, userMessage);
    return `${baseContext}\n\n${docBlock}`;
  } catch {
    return baseContext;
  }
}
