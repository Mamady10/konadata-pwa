import Link from 'next/link';
import {
  getNgoSurveyDetail,
  updateNgoSurveyStatus,
  setNgoSurveyAgents,
  sendNgoSurveyParticipationLink,
} from '@/lib/actions/ngo-surveys';
import { sendNgoSurveyPaymentEmail } from '@/lib/actions/ngo-survey-billing';
import { surveyStatusLabel } from '@/lib/sector/status-labels';
import { COLLECTION_MODE_LABELS } from '@/lib/ngo/survey-settings';
import { isOngDirector } from '@/lib/ong/ong-access';
import { requireOngPage } from '@/lib/ong/require-ong-page';
import { SondageDetailClient } from './sondage-detail-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SondageDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await requireOngPage('sondages');
  const isDirector = isOngDirector(session.profile?.role);

  const { survey, stats, responses, assignedAgents, availableStaff, securityAlerts, charge, error } =
    await getNgoSurveyDetail(id);

  if (error || !survey) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error ?? 'Sondage introuvable'}</p>
        <Link href="/ong/sondages" className="text-primary underline text-sm">
          Retour aux sondages
        </Link>
      </div>
    );
  }

  const statsObj = (stats ?? {}) as {
    response_count?: number;
    target_responses?: number | null;
    progress_pct?: number | null;
    by_region?: { label: string; count: number }[];
    by_choice?: { label: string; count: number }[];
    question_id?: string;
    assigned_agents?: number;
  };

  const questions = survey.questions;
  const firstQid = statsObj.question_id ?? questions[0]?.id ?? 'q1';
  const expectedOptions = questions[0]?.options ?? [];
  const rawByChoice = Array.isArray(statsObj.by_choice) ? statsObj.by_choice : [];
  const countMap = new Map(rawByChoice.map((c) => [c.label, c.count]));
  const byChoice = [
    ...expectedOptions.map((label) => ({
      label,
      count: countMap.get(label) ?? 0,
    })),
    ...rawByChoice.filter((c) => !expectedOptions.includes(c.label)),
  ];

  const collectionModeRaw = survey.collection_mode as string;
  const allowsOnlineParticipation = collectionModeRaw !== 'field_agent';
  const publicToken = (survey.public_token as string) ?? null;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const participationUrl =
    publicToken && allowsOnlineParticipation
      ? `${appUrl}/participation-ong/${publicToken}`
      : null;
  const directorEmail =
    (session.profile?.email as string | undefined) ??
    (session.user?.email as string | undefined) ??
    null;

  return (
    <SondageDetailClient
      survey={{
        id: survey.id as string,
        title: survey.title as string,
        description: (survey.description as string) ?? null,
        status: surveyStatusLabel(survey.status as string),
        rawStatus: survey.status as string,
        region: (survey.region as string) ?? null,
        projectName: (survey.project_name as string) ?? null,
        startsAt: survey.starts_at as string | null,
        endsAt: survey.ends_at as string | null,
        targetResponses: survey.target_responses as number | null,
        collectionMode:
          COLLECTION_MODE_LABELS[
            survey.collection_mode as keyof typeof COLLECTION_MODE_LABELS
          ] ?? String(survey.collection_mode),
        questions: survey.questions,
        publicToken,
        allowsOnlineParticipation,
      }}
      participationUrl={participationUrl}
      directorEmail={directorEmail}
      stats={{
        responseCount: Number(statsObj.response_count ?? 0),
        targetResponses: statsObj.target_responses ?? null,
        progressPct: statsObj.progress_pct ?? null,
        byRegion: Array.isArray(statsObj.by_region) ? statsObj.by_region : [],
        byChoice,
        assignedAgents: Number(statsObj.assigned_agents ?? 0),
      }}
      responses={(responses ?? []).map((r) => {
        const answers = (r.answers as Record<string, unknown>) ?? {};
        const raw = answers[firstQid];
        const answer =
          typeof raw === 'boolean' ? (raw ? 'Oui' : 'Non') : String(raw ?? '—');
        return {
          id: r.id as string,
          locality: (r.locality as string) ?? '—',
          answer,
          createdAt: new Date(r.created_at as string).toLocaleString('fr-FR'),
        };
      })}
      assignedAgents={(assignedAgents ?? []).map((a) => {
        const row = a as { profiles?: { id?: string; full_name?: string; email?: string } | null };
        const p = row.profiles;
        return {
          id: p?.id ?? '',
          name: p?.full_name ?? p?.email ?? 'Agent',
        };
      })}
      availableStaff={(availableStaff ?? []).map((s) => ({
        id: s.id as string,
        name: (s.full_name as string) ?? (s.email as string) ?? 'Staff',
      }))}
      isDirector={isDirector}
      onActivate={updateNgoSurveyStatus}
      onClose={updateNgoSurveyStatus}
      onAssignAgents={setNgoSurveyAgents}
      onSendParticipationLink={sendNgoSurveyParticipationLink}
      onSendPaymentEmail={sendNgoSurveyPaymentEmail}
      charge={
        charge
          ? (() => {
              const breakdown = (charge.breakdown ?? {}) as Record<string, unknown>;
              return {
                status: charge.status as string,
                amountGnf: Number(charge.amount_gnf ?? 0),
                paymentToken: (charge.payment_token as string) ?? null,
                targetResponses: Number(charge.target_responses ?? 0),
                ceoNotes: (charge.ceo_notes as string) ?? null,
                isRevision: Number(breakdown.revision_count ?? 0) > 0,
                previousAmountGnf:
                  breakdown.previous_amount_gnf != null
                    ? Number(breakdown.previous_amount_gnf)
                    : null,
              };
            })()
          : null
      }
      securityAlerts={(securityAlerts ?? []).map((a) => {
        const d = (a.details as Record<string, unknown>) ?? {};
        const type = a.alert_type as string;
        let message = type;
        if (type === 'spike_per_minute') {
          message = `${d.count_last_minute ?? '?'} réponses en 1 min (seuil ${d.threshold ?? '?'})`;
        } else if (type === 'same_choice_zone') {
          message = `${d.count ?? '?'}× « ${d.choice ?? '?'} » à ${d.locality ?? '?'}`;
        }
        return {
          id: a.id as string,
          severity: (a.severity as string) ?? 'warning',
          message,
          createdAt: new Date(a.created_at as string).toLocaleString('fr-FR'),
        };
      })}
    />
  );
}
