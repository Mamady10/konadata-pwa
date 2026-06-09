"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, X, Send, Minimize2, Sparkles, AlertCircle, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { askKonaAI, getKonaAIChatConfig } from "@/lib/actions/kona-ai-chat";
import type { KonaAIChatConfig } from "@/lib/actions/kona-ai-chat";
import {
  generateAndArchiveBulletinFromScan,
  generateAndArchiveProducedDocument,
  getKonaProductionConfig,
} from "@/lib/actions/kona-ai-production";
import type {
  KonaProductionConfig,
  ProductionDocumentKind,
} from "@/lib/actions/kona-ai-production";
import { SCOPE_ALL } from "@/lib/ai/sector-report-types";
import { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

const FALLBACK_SUGGESTIONS = [
  "Résume la situation de mon organisation",
  "Quels sont les principaux indicateurs ?",
];

function renderMessageContent(content: string) {
  return content.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
  );
}

export function KonaAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [config, setConfig] = useState<KonaAIChatConfig | null>(null);
  const [widgetHidden, setWidgetHidden] = useState(true);
  const [production, setProduction] = useState<KonaProductionConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatMode, setChatMode] = useState<"question" | "produce">("question");
  const [produceKind, setProduceKind] = useState<ProductionDocumentKind>("rapport");
  const [produceScope, setProduceScope] = useState(SCOPE_ALL);
  const [produceScanId, setProduceScanId] = useState("");
  const [producing, setProducing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConfig = useCallback(async () => {
    const res = await getKonaAIChatConfig();
    if ("error" in res) {
      setConfigError(res.error);
      setConfig(null);
      setProduction(null);
      setWidgetHidden(true);
      return;
    }
    if (!res.widgetVisible) {
      setWidgetHidden(true);
      setConfig(null);
      setProduction(null);
      setConfigError(null);
      return;
    }
    setWidgetHidden(false);
    setConfigError(null);
    setConfig(res);
    const label = res.assistantLabel;
    const welcome = res.privacyBlockReason
      ? `Bonjour ! **${label}** pour **${res.orgName}**. ${res.privacyBlockReason} Les réponses chiffrées restent disponibles.`
      : res.llmAvailable
        ? `Bonjour ! Je suis **${label}** pour **${res.orgName}** (${res.sectorLabel}). Posez une question ou produisez un **rapport** / **bulletin** selon vos modèles IA.`
        : `Bonjour ! **${label}** pour **${res.orgName}** (${res.sectorLabel}). Réponses chiffrées depuis vos données — sans appel IA externe. Offre : ${res.aiOfferTierLabel}.`;
    setMessages([
      {
        id: "0",
        role: "assistant",
        content: welcome,
        timestamp: new Date(),
      },
    ]);

    if (res.canProduceDocuments) {
      const prod = await getKonaProductionConfig();
      if (!("error" in prod)) {
        setProduction(prod);
        if (prod.scopes[0]) setProduceScope(prod.scopes[0].id);
      } else {
        setProduction(null);
      }
    } else {
      setProduction(null);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const suggestions =
    config?.suggestions?.length ? config.suggestions : FALLBACK_SUGGESTIONS;

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    if (configError) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const history = messages
      .filter((m) => m.id !== "0")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const res = await askKonaAI(text, history);
    setIsTyping(false);

    if ("error" in res) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.error,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleProduce = async () => {
    if (!production || producing || configError) return;

    if (produceKind === "bulletin" && produceScanId) {
      setProducing(true);
      const scanLabel =
        production.scanDocuments.find((s) => s.documentId === produceScanId)?.label ??
        "scan enseignant";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content: `Produire un bulletin depuis le scan : ${scanLabel}`,
          timestamp: new Date(),
        },
      ]);
      const res = await generateAndArchiveBulletinFromScan(produceScanId);
      setProducing(false);
      if ("error" in res) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: res.error,
            timestamp: new Date(),
          },
        ]);
        return;
      }
      const preview = res.content.slice(0, 1200);
      const more = res.content.length > 1200 ? "\n\n… (document tronqué dans le chat)" : "";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `**${res.title}** (scan manuscrit + modèle IA) enregistré.\n\n${preview}${more}\n\n→ ${res.reportPath}`,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const tpl = production.templates.find((t) => t.kind === produceKind);
    if (!tpl?.registered) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Aucun modèle IA enregistré pour « ${produceKind === "bulletin" ? "Bulletin" : "Rapport"} ». Déposez-le dans Paramètres → Modèles IA.`,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setProducing(true);
    const kindLabel = produceKind === "bulletin" ? "Bulletin" : "Rapport";
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: `Générer un ${kindLabel} (${production.scopes.find((s) => s.id === produceScope)?.label ?? "périmètre"})`,
        timestamp: new Date(),
      },
    ]);

    const res = await generateAndArchiveProducedDocument({
      kind: produceKind,
      scopeId: produceScope,
    });

    setProducing(false);

    if ("error" in res) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.error,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const preview = res.content.slice(0, 1200);
    const more = res.content.length > 1200 ? "\n\n… (document tronqué dans le chat)" : "";

    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `**${res.title}** enregistré dans votre organisation.\n\n${preview}${more}\n\n→ Historique complet : ${res.reportPath}`,
        timestamp: new Date(),
      },
    ]);
  };

  const statusBadge = config?.llmAvailable ? (
    <span className="text-[10px] opacity-90">OpenAI</span>
  ) : (
    <span className="text-[10px] opacity-90">FAQ chiffrée</span>
  );

  const panelHeight = chatMode === "produce" && production ? "h-[620px]" : "h-[520px]";

  if (widgetHidden) {
    return null;
  }

  const headerTitle = config?.assistantLabel ?? "Assistant";

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg hover:bg-[#2563EB]/90 transition-colors"
            aria-label={`Ouvrir ${headerTitle}`}
          >
            <Bot className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border bg-background shadow-2xl overflow-hidden w-96",
              isMinimized ? "h-14" : panelHeight
            )}
          >
            <div className="flex items-center justify-between bg-[#2563EB] px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">{headerTitle}</p>
                  <p className="text-[10px] opacity-80 flex gap-1 items-center flex-wrap">
                    {config?.sectorLabel ?? "Assistant"}
                    <span>·</span>
                    {statusBadge}
                    {config && config.documentsTotal > 0 && (
                      <>
                        <span>·</span>
                        <span>{config.documentsIndexed}/{config.documentsTotal} docs</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="rounded p-1 hover:bg-white/10"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {configError && (
                  <div className="mx-4 mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p>{configError}</p>
                  </div>
                )}

                {production && !configError && (
                  <div className="px-3 pt-2 flex gap-1 border-b">
                    <button
                      type="button"
                      onClick={() => setChatMode("question")}
                      className={cn(
                        "flex-1 rounded-t-md py-1.5 text-[11px] font-medium",
                        chatMode === "question"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      Question
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMode("produce")}
                      className={cn(
                        "flex-1 rounded-t-md py-1.5 text-[11px] font-medium flex items-center justify-center gap-1",
                        chatMode === "produce"
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <FileText className="h-3 w-3" />
                      Rapport / Bulletin
                    </button>
                  </div>
                )}

                {chatMode === "produce" && production && !configError ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
                    <p className="text-muted-foreground text-xs">
                      Choisissez le type et le périmètre. Le document suit le modèle IA déposé par la direction et est
                      enregistré dans votre compte.
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type de document</Label>
                      <Select
                        value={produceKind}
                        onValueChange={(v) => setProduceKind(v as ProductionDocumentKind)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {production.kinds.map((k) => (
                            <SelectItem key={k} value={k}>
                              {k === "bulletin" ? "Bulletin" : "Rapport"}
                              {production.templates.find((t) => t.kind === k)?.registered
                                ? ""
                                : " (modèle manquant)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Périmètre</Label>
                      <Select value={produceScope} onValueChange={setProduceScope}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {production.scopes.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {produceKind === "bulletin" && production.scanDocuments.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Ou depuis scan enseignant</Label>
                        <Select
                          value={produceScanId || "__none__"}
                          onValueChange={(v) => setProduceScanId(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Données Supabase uniquement" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Données en base (sans scan)</SelectItem>
                            {production.scanDocuments.map((s) => (
                              <SelectItem key={s.documentId} value={s.documentId}>
                                {s.label}
                                {s.extractionStatus !== "ok" ? " (OCR à relancer)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={handleProduce}
                      disabled={producing}
                    >
                      {producing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Génération…
                        </>
                      ) : (
                        "Générer et enregistrer"
                      )}
                    </Button>
                    <Link
                      href={production.modelsHref}
                      className="text-[11px] text-primary hover:underline block text-center"
                    >
                      Gérer les modèles IA →
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                              msg.role === "user"
                                ? "bg-[#2563EB] text-white rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            )}
                          >
                            {renderMessageContent(msg.content)}
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {messages.length <= 1 && !configError && (
                      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                        {suggestions.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => sendMessage(q)}
                            className="rounded-full border px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}

                    {config?.reportPath && !configError && (
                      <div className="px-4 pb-1">
                        <Link
                          href={config.reportPath}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Historique des rapports →
                        </Link>
                      </div>
                    )}

                    <div className="border-t p-3 flex gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                        placeholder={
                          configError ? "Chat indisponible" : "Posez votre question..."
                        }
                        disabled={!!configError || isTyping}
                        className="flex-1 border-0 bg-muted/50 focus-visible:ring-1"
                      />
                      <Button
                        size="icon"
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || !!configError || isTyping}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
