'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  BarChart3,
  Sparkles,
  Trash2,
  RotateCcw,
  MapPin,
  Database,
  FileText,
  Wand2,
} from 'lucide-react';
import {
  ChartCard,
  KonaPieChart,
  KonaBarChart,
  KonaAreaChart,
} from '@/components/dashboard/charts';
import { SurveyGpsMap } from '@/components/survey/survey-gps-map';
import { AiReportDiffusion } from '@/components/ai/ai-report-diffusion';
import {
  SurveyReportTemplateCard,
  type SurveyReportTemplateInfo,
} from '@/components/survey/survey-report-template-card';
import type { SurveyAnalyticsPayload } from '@/lib/actions/ngo-survey-analytics';
import {
  autoCleanSurveyDuplicates,
  excludeSurveyResponse,
  restoreSurveyResponse,
  generateNgoSurveyAiReport,
  askNgoSurveyAi,
} from '@/lib/actions/ngo-survey-analytics';

const AI_SUGGESTIONS = [
  'Quelle option domine et dans quelles localités ?',
  'Y a-t-il des anomalies ou biais territoriaux ?',
  'Résume les tendances pour un rapport bailleur.',
  'Quelles zones sont sous-représentées ?',
];

interface Props {
  analytics: SurveyAnalyticsPayload;
  isDirector: boolean;
  surveyReportTemplate: SurveyReportTemplateInfo | null;
}

export function SurveyAnalyticsClient({
  analytics,
  isDirector,
  surveyReportTemplate,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  const filteredByDay = analytics.byDay.filter((d) => {
    if (periodFrom && d.day < periodFrom) return false;
    if (periodTo && d.day > periodTo) return false;
    return true;
  });

  const pieData = analytics.stats.byChoice.map((c) => ({
    name: c.label,
    value: c.count,
  }));

  const regionBar = analytics.stats.byRegion.map((r) => ({
    locality: r.label.length > 18 ? `${r.label.slice(0, 16)}…` : r.label,
    count: r.count,
  }));

  const daySeries = filteredByDay.map((d) => ({
    day: d.day.slice(5),
    responses: d.count,
  }));

  const visibleResponses = analytics.responses.filter(
    (r) => showExcluded || !r.isExcluded
  );

  async function handleAutoClean() {
    if (!confirm('Exclure automatiquement les doublons détectés (garde la réponse la plus ancienne) ?')) {
      return;
    }
    setLoading(true);
    setMsg(null);
    const res = await autoCleanSurveyDuplicates(analytics.surveyId);
    setLoading(false);
    if ('error' in res) {
      setMsg(res.error ?? 'Erreur');
      return;
    }
    setMsg(`${'excludedCount' in res ? res.excludedCount : 0} doublon(s) exclu(s).`);
    router.refresh();
  }

  async function handleExclude(id: string) {
    setLoading(true);
    const res = await excludeSurveyResponse(id, 'Exclu manuellement');
    setLoading(false);
    if ('error' in res) setMsg(res.error ?? 'Erreur');
    else router.refresh();
  }

  async function handleRestore(id: string) {
    setLoading(true);
    const res = await restoreSurveyResponse(id);
    setLoading(false);
    if ('error' in res) setMsg(res.error ?? 'Erreur');
    else router.refresh();
  }

  async function handleGenerateReport() {
    setLoading(true);
    setMsg(null);
    const res = await generateNgoSurveyAiReport(analytics.surveyId);
    setLoading(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    if ('report' in res) {
      setAiReport(res.report);
      const endNote =
        res.campaignEndsAt != null
          ? ` Accès campagne jusqu'au ${new Date(res.campaignEndsAt).toLocaleDateString('fr-FR')} (15 jours après ce rapport).`
          : '';
      const templateNote =
        'templateUsed' in res && res.templateUsed && res.templateFileName
          ? ` Aligné sur le modèle « ${res.templateFileName} ».`
          : '';
      setMsg(
        (res.usedLlm ? 'Rapport IA généré et archivé.' : 'Rapport local généré (sans LLM).') +
          templateNote +
          endNote
      );
    }
  }

  async function handleAskAi(q?: string) {
    const question = (q ?? aiQuestion).trim();
    if (!question) return;
    setLoading(true);
    setAiAnswer(null);
    const res = await askNgoSurveyAi(analytics.surveyId, question);
    setLoading(false);
    if ('error' in res && res.error) {
      setMsg(res.error);
      return;
    }
    if ('content' in res) setAiAnswer(res.content);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href={`/ong/sondages/${analytics.surveyId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour au sondage
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#2563EB]" />
            Analytiques — {analytics.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Données nettoyées, graphiques, cartographie et KonaAI
          </p>
        </div>
        <Badge variant="secondary">{analytics.status}</Badge>
      </div>

      {msg && <p className="text-sm bg-muted rounded-lg px-3 py-2">{msg}</p>}

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Période du rapport (réponses / jour)</p>
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="w-auto" />
              <span className="text-muted-foreground self-center">→</span>
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="w-auto" />
              {(periodFrom || periodTo) && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPeriodFrom(''); setPeriodTo(''); }}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Réponses valides</p>
            <p className="text-2xl font-bold">{analytics.stats.responseCount}</p>
            {analytics.stats.excludedCount > 0 && (
              <p className="text-xs text-amber-700">{analytics.stats.excludedCount} exclue(s)</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Objectif</p>
            <p className="text-2xl font-bold">
              {analytics.stats.targetResponses ?? '—'}
              {analytics.stats.progressPct != null && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({analytics.stats.progressPct} %)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Qualité GPS</p>
            <p className="text-2xl font-bold">{analytics.quality.withGps}</p>
            <p className="text-xs text-muted-foreground">
              sur {analytics.quality.valid} valides
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Doublons détectés</p>
            <p className="text-2xl font-bold">{analytics.quality.duplicateGroups}</p>
            {analytics.quality.alerts > 0 && (
              <p className="text-xs text-amber-700">{analytics.quality.alerts} alerte(s)</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="data">Données</TabsTrigger>
          <TabsTrigger value="map">Cartographie</TabsTrigger>
          <TabsTrigger value="ai">KonaAI</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Répartition des réponses (QCM)">
              {pieData.length ? (
                <KonaPieChart data={pieData} />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnée</p>
              )}
            </ChartCard>
            <ChartCard title="Réponses par localité">
              {regionBar.length ? (
                <KonaBarChart
                  data={regionBar}
                  xKey="locality"
                  bars={[{ key: 'count', color: '#2563EB', name: 'Réponses' }]}
                />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune localité</p>
              )}
            </ChartCard>
          </div>
          {daySeries.length > 1 && (
            <ChartCard title="Collecte dans le temps">
              <KonaAreaChart
                data={daySeries}
                xKey="day"
                areas={[{ key: 'responses', color: '#10B981', name: 'Réponses / jour' }]}
              />
            </ChartCard>
          )}
          {analytics.crossTab.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Croisement choix × localité</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Choix</th>
                      <th className="py-2 pr-4">Localité</th>
                      <th className="py-2">Nombre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.crossTab.slice(0, 25).map((row, i) => (
                      <tr key={i} className="border-b border-muted/50">
                        <td className="py-2 pr-4">{row.choice}</td>
                        <td className="py-2 pr-4">{row.locality}</td>
                        <td className="py-2 font-medium">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="data" className="space-y-4 mt-4">
          {isDirector && (
            <Card className="border-[#2563EB]/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Nettoyage des données
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Les réponses exclues restent en base mais ne comptent plus dans les statistiques.
                  Le nettoyage automatique conserve la réponse la plus ancienne de chaque groupe de
                  doublons (téléphone, appareil, même réponse + localité).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-[#2563EB]"
                    disabled={loading || analytics.quality.duplicateGroups === 0}
                    onClick={handleAutoClean}
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    Nettoyer les doublons
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExcluded((v) => !v)}
                  >
                    {showExcluded ? 'Masquer exclues' : 'Afficher exclues'}
                  </Button>
                </div>
                {analytics.duplicateGroups.length > 0 && (
                  <div className="text-xs space-y-2 pt-2 border-t">
                    <p className="font-medium">Groupes de doublons ({analytics.duplicateGroups.length})</p>
                    {analytics.duplicateGroups.slice(0, 5).map((g, i) => (
                      <p key={i} className="text-muted-foreground">
                        {g.matchType} — {g.members.length} réponses
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Réponses ({visibleResponses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Localité</th>
                    <th className="py-2 pr-3">Réponse</th>
                    <th className="py-2 pr-3">GPS</th>
                    {isDirector && <th className="py-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleResponses.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-muted/50 ${r.isExcluded ? 'opacity-50' : ''}`}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2 pr-3">{r.locality}</td>
                      <td className="py-2 pr-3">{r.answer}</td>
                      <td className="py-2 pr-3">{r.hasGps ? 'Oui' : '—'}</td>
                      {isDirector && (
                        <td className="py-2">
                          {r.isExcluded ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={loading}
                              onClick={() => handleRestore(r.id)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={loading}
                              onClick={() => handleExclude(r.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Cartographie des réponses GPS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SurveyGpsMap points={analytics.mapPoints} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 mt-4">
          {!isDirector ? (
            <p className="text-sm text-muted-foreground">
              KonaAI réservé à la direction ONG.
            </p>
          ) : (
            <>
              <SurveyReportTemplateCard template={surveyReportTemplate} />

              <Card className="border-violet-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-600" />
                    Rapport automatique
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Génère un rapport structuré à partir des données nettoyées (choix, localités,
                    qualité, tendances). Si un modèle organisation est joint ci-dessus, KonaAI
                    reproduit sa structure et son ton. Archivé dans Rapports ONG.
                  </p>
                  <Button
                    className="bg-violet-600 hover:bg-violet-700"
                    disabled={loading}
                    onClick={handleGenerateReport}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Générer le rapport KonaAI
                  </Button>
                  {aiReport && (
                    <div className="space-y-2">
                      <pre className="text-xs whitespace-pre-wrap bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                        {aiReport}
                      </pre>
                      <AiReportDiffusion
                        title={`Rapport sondage — ${analytics.title}`}
                        content={aiReport}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Questions sur ce sondage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {AI_SUGGESTIONS.map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-1.5"
                        disabled={loading}
                        onClick={() => {
                          setAiQuestion(s);
                          handleAskAi(s);
                        }}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      placeholder="Ex. Quelle commune a le plus voté pour l'option A ?"
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                    />
                    <Button disabled={loading} onClick={() => handleAskAi()}>
                      Analyser
                    </Button>
                  </div>
                  {aiAnswer && (
                    <div className="space-y-2">
                      <div className="text-sm bg-muted rounded-lg p-4 whitespace-pre-wrap">
                        {aiAnswer}
                      </div>
                      <AiReportDiffusion
                        title={`Analyse KonaAI — ${analytics.title}`}
                        content={aiAnswer}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
