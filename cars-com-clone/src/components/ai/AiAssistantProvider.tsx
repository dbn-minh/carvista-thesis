"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, MessageCircleMore, RotateCcw, Scale, SendHorizonal, Sparkles, X } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredAdvisorProfile, setStoredAdvisorProfile } from "@/lib/advisor-profile";
import { aiApi, catalogApi } from "@/lib/carvista-api";
import { hasToken, toCurrency } from "@/lib/api-client";
import { buildCompareHref, buildComparePairLabel, enrichCompareFollowUpMessage } from "@/lib/compare";
import type {
  AiCompareResponse,
  AiConfidence,
  AiInsightCard,
  AiSuggestedAction,
  AiSource,
  VariantListItem,
} from "@/lib/types";

type AssistantOptions = {
  prompt?: string;
  marketId?: number;
  variantId?: number;
  variantLabel?: string;
  compareVariantIds?: number[];
  compareVariantLabels?: string[];
};

type CompareOptions = {
  variantId: number;
  variantLabel: string;
  marketId?: number;
  listingId?: number;
};

type PendingAction =
  | { type: "assistant"; options?: AssistantOptions }
  | { type: "compare"; options: CompareOptions }
  | null;

type ChatBubble = {
  id: string;
  role: "assistant" | "user";
  content: string;
  cards?: AiInsightCard[];
  followUps?: string[];
  confidence?: AiConfidence | null;
  sources?: AiSource[];
  caveats?: string[];
  freshnessNote?: string | null;
  suggestedActions?: AiSuggestedAction[];
};

type CompareContextState = {
  variantIds: number[];
  labels: string[];
};

type CompareState = {
  open: boolean;
  variantId: number | null;
  variantLabel: string;
  marketId: number;
  query: string;
  options: VariantListItem[];
  selectedVariant: VariantListItem | null;
  loading: boolean;
  searching: boolean;
  error: string;
  result: AiCompareResponse | null;
};

type AiAssistantContextValue = {
  openAssistant: (options?: AssistantOptions) => void;
  openCompare: (options: CompareOptions) => void;
};

const starterPrompts = [
  "Family use, 5 seats, under 1 billion.",
  "Daily commute, fuel efficient, mid-range.",
  "Long trips, 7 seats, comfortable.",
  "Taxi use, durable and low maintenance.",
];

const compareStarterPrompts = [
  "Which is better for a family of 5?",
  "Which one is cheaper to own over 5 years?",
  "Which one is better for resale?",
  "Give me the pros and cons only.",
];

const emptyCompareState: CompareState = {
  open: false,
  variantId: null,
  variantLabel: "",
  marketId: 1,
  query: "",
  options: [],
  selectedVariant: null,
  loading: false,
  searching: false,
  error: "",
  result: null,
};

const emptyCompareContext: CompareContextState = {
  variantIds: [],
  labels: [],
};

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function isProfileProgressCard(card: AiInsightCard) {
  const title = String(card.title || "").trim().toLowerCase();
  const value = String(card.value || "").trim().toLowerCase();

  return (
    title === "buyer profile" ||
    title === "profile so far" ||
    value.includes("answers saved")
  );
}

function sanitizeInsightCards(cards?: AiInsightCard[]) {
  if (!cards || cards.length === 0) return [];
  return cards.filter((card) => !isProfileProgressCard(card));
}

function isVehicleRecommendationCard(card: AiInsightCard) {
  return card.action?.type === "open_vehicle_detail" || String(card.href || "").startsWith("/catalog/");
}

function removeVehicleRecommendationMessages(messages: ChatBubble[]) {
  return messages.filter(
    (message) =>
      message.role !== "assistant" ||
      !(message.cards ?? []).some((card) => isVehicleRecommendationCard(card))
  );
}

function normalizeFollowUpText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?!.\s]+$/g, "")
    .trim();
}

function sanitizeFollowUps(questions?: string[], answer?: string) {
  const normalizedAnswer = normalizeFollowUpText(answer);
  return (questions ?? [])
    .filter(Boolean)
    .filter((question) => {
      const normalizedQuestion = normalizeFollowUpText(question);
      return normalizedQuestion && !normalizedAnswer.includes(normalizedQuestion);
    })
    .slice(0, 2);
}

function InsightCards({
  cards,
  onAction,
}: {
  cards?: AiInsightCard[];
  onAction?: (action: AiSuggestedAction) => void;
}) {
  const visibleCards = sanitizeInsightCards(cards);
  if (visibleCards.length === 0) return null;

  return (
    <div className="mt-3 grid gap-3">
      {visibleCards.map((card, index) => {
        const action =
          card.action ||
          (card.href
            ? {
                type: "open_vehicle_detail",
                payload: { url: card.href, label: card.title },
              }
            : null);
        const handleCardClick = action && onAction ? () => onAction(action) : null;
        const content = (
          <div key={`${card.title}-${index}-content`}>
            <div className="flex gap-3">
              {card.image_url ? (
                <img
                  src={card.image_url}
                  alt={card.title}
                  className="h-16 w-20 shrink-0 rounded-[8px] object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                  {card.title}
                </p>
                {card.value != null ? (
                  <p className="mt-2 break-words text-base font-apercu-bold text-cars-primary dark:text-white/92">
                    {typeof card.value === "number" ? toCurrency(card.value) : String(card.value)}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-2 break-words text-sm leading-6 text-cars-gray dark:text-white/68">{card.description}</p>
          </div>
        );

        return handleCardClick ? (
          <button
            key={`${card.title}-${index}`}
            type="button"
            onClick={handleCardClick}
            className="rounded-[22px] border border-cars-gray-light/70 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-cars-accent/40 hover:bg-cars-off-white dark:border-white/10 dark:bg-[#0f182c] dark:hover:border-[#7da7ff]/40 dark:hover:bg-[#15223a]"
          >
            {content}
          </button>
        ) : (
          <article
            key={`${card.title}-${index}`}
            className="rounded-[22px] border border-cars-gray-light/70 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-[#0f182c]"
          >
            {content}
          </article>
        );
      })}
    </div>
  );
}

function FollowUpList({ questions }: { questions?: string[] }) {
  const visibleQuestions = sanitizeFollowUps(questions);
  if (visibleQuestions.length === 0) return null;

  return (
    <div className="mt-3 rounded-[18px] bg-cars-off-white px-3 py-3 text-xs leading-5 text-cars-gray dark:bg-[#111c31] dark:text-white/68">
      <p className="font-semibold uppercase tracking-[0.14em] text-cars-accent dark:text-[#7da7ff]">Next</p>
      {visibleQuestions.map((question) => (
        <p key={question} className="mt-2 break-words text-cars-primary dark:text-white/88">
          {question}
        </p>
      ))}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: AiConfidence | null }) {
  if (!confidence) return null;

  return (
    <div className="mt-3 inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-cars-primary dark:bg-[#182844] dark:text-white/88">
      {confidence.label}
    </div>
  );
}

function SourceList({
  sources,
  freshnessNote,
}: {
  sources?: AiSource[];
  freshnessNote?: string | null;
}) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-[18px] bg-cars-off-white px-3 py-3 dark:bg-[#111c31]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cars-accent">
        Sources
      </p>
      <div className="space-y-2 text-xs leading-5 text-cars-gray dark:text-white/68">
        {sources.slice(0, 4).map((source, index) => (
          <div key={`${source.provider}-${source.title}-${index}`}>
            <p className="font-semibold text-cars-primary dark:text-white/88">
              {source.provider}: {source.title}
            </p>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-cars-accent underline underline-offset-2 dark:text-[#7da7ff]"
              >
                {source.url}
              </a>
            ) : null}
          </div>
        ))}
        {freshnessNote ? <p>{freshnessNote}</p> : null}
      </div>
    </div>
  );
}

function CaveatList({ caveats }: { caveats?: string[] }) {
  if (!caveats || caveats.length === 0) return null;

  return (
    <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-[#2c2112] dark:text-amber-100">
      <p className="font-semibold uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-100/80">Caveats</p>
      <ul className="mt-2 space-y-1">
        {caveats.slice(0, 3).map((caveat) => (
          <li key={caveat}>- {caveat}</li>
        ))}
      </ul>
    </div>
  );
}

function getActionLabel(action: AiSuggestedAction) {
  const payloadLabel = action.payload?.label;
  if (typeof payloadLabel === "string" && payloadLabel.trim()) return payloadLabel;

  switch (action.type) {
    case "open_vehicle_detail":
      return "Open vehicle detail";
    case "open_related_listings":
      return "Browse related listings";
    case "open_compare_modal":
      return "Open compare";
    default:
      return null;
  }
}

function getRenderableActions(actions?: AiSuggestedAction[]) {
  return (actions ?? []).filter((action) =>
    ["open_vehicle_detail", "open_related_listings", "open_compare_modal"].includes(action.type)
  );
}

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, openAuth } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [marketId, setMarketId] = useState("1");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [compareState, setCompareState] = useState<CompareState>(emptyCompareState);
  const [chatError, setChatError] = useState("");
  const [focusVariantId, setFocusVariantId] = useState<number | null>(null);
  const [focusVariantLabel, setFocusVariantLabel] = useState("");
  const [compareContext, setCompareContext] = useState<CompareContextState>(emptyCompareContext);
  const [queuedPrompt, setQueuedPrompt] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const conversationVersionRef = useRef(0);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    const hasComparePair = compareContext.labels.length >= 2;
    const comparePairLabel = hasComparePair
      ? buildComparePairLabel(compareContext.labels)
      : null;
    setMessages([
      {
        id: buildId("assistant"),
        role: "assistant",
        content: hasComparePair
          ? `I have ${comparePairLabel} loaded and ready to compare. Ask about family use, resale, ownership cost, comfort, or tell me what matters most to you.`
          : "What will you mainly use the vehicle for? Taxi, daily commute, family use, business, or long trips?",
      },
    ]);
  }, [compareContext.labels, messages.length, open]);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  });

  useEffect(() => {
    if (!authenticated || !pendingAction) return;

    const action = pendingAction;
    setPendingAction(null);

    if (action.type === "assistant") {
      launchAssistant(action.options);
      return;
    }

    launchCompare(action.options);
  }, [authenticated, pendingAction]);

  useEffect(() => {
    if (!open || !queuedPrompt || sending) return;

    const prompt = queuedPrompt;
    setQueuedPrompt("");
    void sendMessage(prompt);
  }, [open, queuedPrompt, sending]);

  useEffect(() => {
    if (open) return;
    setQueuedPrompt("");
  }, [open]);

  function handleSuggestedAction(action: AiSuggestedAction) {
    const payload = action.payload ?? {};
    const payloadUrl = typeof payload.url === "string" && payload.url.trim() ? payload.url : null;

    if (action.type === "open_vehicle_detail" || action.type === "open_related_listings") {
      if (!payloadUrl) return;
      setOpen(false);
      router.push(payloadUrl);
      return;
    }

    if (action.type === "open_compare_modal") {
      const variantId = Number(payload.variant_id ?? focusVariantId);
      if (!Number.isFinite(variantId)) return;
      launchCompare({
        variantId,
        variantLabel: focusVariantLabel || "Selected vehicle",
        marketId: Number(marketId) || 1,
      });
    }
  }

  function ensureAccess(nextPath?: string) {
    const target = nextPath || pathname || "/";
    if (authenticated || hasToken()) return true;
    return false;
  }

  function requestLogin(action: PendingAction, nextPath?: string) {
    setPendingAction(action);
    openAuth({ mode: "login", next: nextPath || pathname || "/" });
  }

  function resetConversationState({ clearProfile = false }: { clearProfile?: boolean } = {}) {
    conversationVersionRef.current += 1;
    setSessionId(null);
    setMessages([]);
    setInput("");
    setQueuedPrompt("");
    setChatError("");
    setSending(false);
    if (clearProfile) {
      setStoredAdvisorProfile({});
    }
  }

  function launchAssistant(options?: AssistantOptions) {
    const nextCompareVariantIds = (options?.compareVariantIds ?? []).filter((value) =>
      Number.isInteger(value)
    );
    const nextCompareVariantLabels = (options?.compareVariantLabels ?? [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const isCompareLaunch = nextCompareVariantIds.length >= 2;
    const contextChanged =
      (options?.variantId ?? null) !== focusVariantId ||
      nextCompareVariantIds.join(",") !== compareContext.variantIds.join(",");

    setOpen(true);
    if (options?.marketId) setMarketId(String(options.marketId));
    setFocusVariantId(options?.variantId ?? null);
    setFocusVariantLabel(options?.variantLabel || "");
    setCompareContext({
      variantIds: nextCompareVariantIds,
      labels: nextCompareVariantLabels,
    });

    if (isCompareLaunch || contextChanged) {
      resetConversationState();
    }

    if (options?.prompt) {
      setInput(options.prompt);
      setQueuedPrompt(options.prompt);
    }
  }

  function startNewConversation() {
    resetConversationState({ clearProfile: true });
  }

  function launchCompare(options: CompareOptions) {
    setOpen(false);
    router.push(
      buildCompareHref({
        leftVariantId: options.variantId,
        leftVariantLabel: options.variantLabel,
        leftListingId: options.listingId,
        marketId: options.marketId || Number(marketId) || 1,
      })
    );
  }

  function openAssistant(options?: AssistantOptions) {
    const target = pathname || "/";
    if (!ensureAccess(target)) {
      requestLogin({ type: "assistant", options }, target);
      return;
    }

    if (open && !options) {
      setOpen(false);
      return;
    }

    launchAssistant(options);
  }

  function openCompare(options: CompareOptions) {
    const target = pathname || `/catalog/${options.variantId}`;
    if (!ensureAccess(target)) {
      requestLogin({ type: "compare", options }, target);
      return;
    }

    launchCompare(options);
  }

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || sending) return;
    if (!ensureAccess(pathname || "/")) {
      requestLogin(
        {
          type: "assistant",
          options: {
            prompt: text,
            marketId: Number(marketId) || 1,
            variantId: focusVariantId ?? undefined,
            variantLabel: focusVariantLabel || undefined,
          },
        },
        pathname || "/"
      );
      return;
    }

    setChatError("");
    setMessages((prev) => [...prev, { id: buildId("user"), role: "user", content: text }]);
    setInput("");
    setSending(true);
    const requestVersion = conversationVersionRef.current;

    try {
      const compareAwareText =
        compareContext.variantIds.length >= 2
          ? enrichCompareFollowUpMessage(text, compareContext.labels)
          : text;
      const response = await aiApi.chat({
        session_id: sessionId || undefined,
        message: compareAwareText,
        context: {
          market_id: Number(marketId) || 1,
          ...(focusVariantId ? { focus_variant_id: focusVariantId } : {}),
          ...(focusVariantLabel ? { focus_variant_label: focusVariantLabel } : {}),
          ...(compareContext.variantIds.length >= 2
            ? {
                compare_variant_ids: compareContext.variantIds,
                compare_variant_labels: compareContext.labels,
              }
            : {}),
        },
      });

      if (requestVersion !== conversationVersionRef.current) return;

      setSessionId(response.session_id);
      setStoredAdvisorProfile(response.advisor_profile ?? {});
      setMessages((prev) => {
        const baseMessages = response.meta?.advisor_restart
          ? removeVehicleRecommendationMessages(prev)
          : prev;
        return [
          ...baseMessages,
          {
            id: buildId("assistant"),
            role: "assistant",
            content: response.answer,
            cards: sanitizeInsightCards(response.cards),
            followUps: sanitizeFollowUps(response.follow_up_questions, response.answer),
            confidence: response.confidence ?? null,
            sources: response.sources ?? [],
            caveats: response.caveats ?? [],
            freshnessNote: response.freshness_note ?? null,
            suggestedActions: response.suggested_actions ?? [],
          },
        ];
      });
    } catch (error) {
      if (requestVersion !== conversationVersionRef.current) return;
      setChatError(error instanceof Error ? error.message : "Chat failed.");
    } finally {
      if (requestVersion === conversationVersionRef.current) {
        setSending(false);
      }
    }
  }

  useEffect(() => {
    if (!compareState.open || compareState.query.trim().length < 2) {
      setCompareState((prev) => ({ ...prev, options: [], searching: false }));
      return;
    }

    let cancelled = false;

    async function searchVariants() {
      setCompareState((prev) => ({ ...prev, searching: true, error: "" }));

      try {
        const response = await catalogApi.variants({ q: compareState.query.trim() });
        if (cancelled) return;
        setCompareState((prev) => ({
          ...prev,
          searching: false,
          options: response.items
            .filter((item) => item.variant_id !== prev.variantId)
            .slice(0, 8),
        }));
      } catch (error) {
        if (cancelled) return;
        setCompareState((prev) => ({
          ...prev,
          searching: false,
          error: error instanceof Error ? error.message : "Could not search variants.",
        }));
      }
    }

    searchVariants();

    return () => {
      cancelled = true;
    };
  }, [compareState.open, compareState.query]);

  async function runCompare() {
    if (!compareState.variantId || !compareState.selectedVariant) return;

    setCompareState((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const advisorProfile = getStoredAdvisorProfile();
      const result = await aiApi.compare({
        variant_ids: [compareState.variantId, compareState.selectedVariant.variant_id],
        market_id: compareState.marketId,
        price_type: "avg_market",
        buyer_profile: advisorProfile,
      });

      setCompareState((prev) => ({
        ...prev,
        loading: false,
        result,
      }));
    } catch (error) {
      setCompareState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Compare failed.",
      }));
    }
  }

  const contextValue: AiAssistantContextValue = {
    openAssistant,
    openCompare,
  };

  const activeStarterPrompts =
    compareContext.labels.length >= 2 ? compareStarterPrompts : starterPrompts;

  return (
    <AiAssistantContext.Provider value={contextValue}>
      {children}

      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
        {open ? (
          <section className="w-[min(92vw,400px)] overflow-hidden rounded-[30px] border border-cars-primary/10 bg-white shadow-[0_24px_80px_rgba(15,45,98,0.22)] dark:border-white/10 dark:bg-[#091222] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="bg-[linear-gradient(135deg,rgba(15,45,98,0.98),rgba(27,76,160,0.92),rgba(95,150,255,0.82))] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-apercu-bold">CarVista Advisor</h2>
                  <p className="mt-2 text-sm leading-6 text-white/85">
                    Ask for recommendations, compare cars, forecast pricing, or understand TCO.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {focusVariantLabel ? (
                <div className="mt-3 rounded-[18px] bg-white/10 px-3 py-2 text-sm leading-6 text-white/85">
                  Focused vehicle:{" "}
                  <span className="font-semibold text-white">{focusVariantLabel}</span>
                </div>
              ) : null}
              {compareContext.labels.length >= 2 ? (
                <div className="mt-3 rounded-[18px] bg-white/10 px-3 py-2 text-sm leading-6 text-white/85">
                  Comparing:{" "}
                  <span className="font-semibold text-white">
                    {buildComparePairLabel(compareContext.labels)}
                  </span>
                </div>
              ) : null}
            </div>

            <div
              ref={transcriptRef}
              className="max-h-[420px] space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_45%)] px-4 py-4 dark:bg-[linear-gradient(180deg,#0b1424_0%,#091222_45%)]"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] break-words rounded-[24px] rounded-br-md bg-cars-primary px-4 py-3 text-sm leading-6 text-white dark:bg-[#18376f]"
                        : "max-w-[92%] break-words rounded-[24px] rounded-bl-md border border-cars-gray-light/80 bg-white px-4 py-3 text-sm leading-6 text-cars-primary shadow-sm dark:border-white/10 dark:bg-[#101a2d] dark:text-white/88"
                    }
                  >
                    <p>{message.content}</p>
                    <ConfidenceBadge confidence={message.confidence} />
                    <InsightCards cards={message.cards} onAction={handleSuggestedAction} />
                    <SourceList sources={message.sources} freshnessNote={message.freshnessNote} />
                    <CaveatList caveats={message.caveats} />
                    <FollowUpList questions={message.followUps} />
                    {message.role === "assistant" && getRenderableActions(message.suggestedActions).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getRenderableActions(message.suggestedActions).map((action, index) => {
                          const label = getActionLabel(action);
                          if (!label) return null;
                          return (
                            <button
                              key={`${action.type}-${index}`}
                              type="button"
                              onClick={() => handleSuggestedAction(action)}
                              className="rounded-full border border-cars-primary/15 px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-cars-off-white dark:border-white/10 dark:text-white/88 dark:hover:bg-[#16223a]"
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {sending ? (
                <div className="flex justify-start">
                  <div className="rounded-[24px] rounded-bl-md border border-cars-gray-light/80 bg-white px-4 py-3 text-sm text-cars-gray shadow-sm dark:border-white/10 dark:bg-[#101a2d] dark:text-white/68">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </span>
                  </div>
                </div>
              ) : null}

              {messages.length <= 1 ? (
                <div className="flex flex-wrap gap-2">
                  {activeStarterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="rounded-full border border-cars-primary/10 bg-white px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-cars-off-white dark:border-white/10 dark:bg-[#101a2d] dark:text-white/88 dark:hover:bg-[#16223a]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              {chatError ? (
                <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-[#2a1318] dark:text-red-200">
                  {chatError}
                </div>
              ) : null}
            </div>

            <div className="border-t border-cars-gray-light/70 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#091222]">
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  className="min-h-[76px] flex-1 rounded-[22px] border border-cars-gray-light px-4 py-3 text-sm leading-6 text-cars-primary outline-none focus:border-cars-accent dark:border-white/10 dark:bg-[#101a2d] dark:text-white/90 dark:placeholder:text-white/38 dark:focus:border-[#7da7ff]"
                  placeholder="Example: Family use, SUV, under 1 billion."
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={sending || input.trim().length === 0}
                  className="flex h-[76px] w-[60px] items-center justify-center rounded-[22px] bg-cars-primary text-white disabled:opacity-60"
                >
                  <SendHorizonal className="h-5 w-5" />
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => openAssistant()}
          className="group inline-flex items-center gap-3 rounded-full bg-cars-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(15,45,98,0.24)] transition-transform hover:-translate-y-0.5 hover:bg-cars-primary-light"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
            <MessageCircleMore className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">Ask CarVista AI</span>
          <Sparkles className="h-4 w-4 text-white/75" />
        </button>
      </div>

      <Dialog
        open={compareState.open}
        onOpenChange={(isOpen) =>
          setCompareState((prev) => ({
            ...emptyCompareState,
            open: isOpen,
            variantId: isOpen ? prev.variantId : null,
            variantLabel: isOpen ? prev.variantLabel : "",
            marketId: isOpen ? prev.marketId : Number(marketId) || 1,
          }))
        }
      >
        {compareState.open ? (
          <DialogContent className="max-h-[88vh] max-w-[920px] overflow-y-auto rounded-[30px] border border-cars-primary/10 bg-white p-0 shadow-[0_24px_80px_rgba(15,45,98,0.18)]">
            <DialogTitle className="sr-only">Compare vehicles with CarVista AI</DialogTitle>
            <DialogDescription className="sr-only">
              Choose another variant and review the AI comparison summary.
            </DialogDescription>

            <div className="border-b border-cars-gray-light/70 bg-[linear-gradient(135deg,rgba(15,45,98,0.98),rgba(27,76,160,0.92),rgba(95,150,255,0.82))] px-6 py-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Compare with AI
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold">
                Find the better fit, not just the better spec sheet
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
                Keep the current car as your baseline, then search and pick a second variant to
                compare value, practicality, and ownership signals.
              </p>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-4">
                <div className="rounded-[26px] bg-cars-off-white px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                    Baseline vehicle
                  </p>
                  <h3 className="mt-3 text-xl font-apercu-bold text-cars-primary">
                    {compareState.variantLabel}
                  </h3>
                </div>

                <div className="rounded-[26px] border border-cars-gray-light/70 px-5 py-5">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                    Search second variant
                  </label>
                  <input
                    value={compareState.query}
                    onChange={(event) =>
                      setCompareState((prev) => ({
                        ...prev,
                        query: event.target.value,
                        result: null,
                      }))
                    }
                    placeholder="Type make, model, or trim"
                    className="mt-3 h-12 w-full rounded-full border border-cars-gray-light px-4 text-sm text-cars-primary outline-none focus:border-cars-accent"
                  />

                  {compareState.searching ? (
                    <p className="mt-3 text-sm text-cars-gray">Searching variants...</p>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {compareState.options.map((item) => {
                      const label = `${item.make_name} ${item.model_name} ${item.trim_name || ""}`.trim();
                      const active = compareState.selectedVariant?.variant_id === item.variant_id;
                      return (
                        <button
                          key={item.variant_id}
                          type="button"
                          onClick={() =>
                            setCompareState((prev) => ({
                              ...prev,
                              selectedVariant: item,
                            }))
                          }
                          className={
                            active
                              ? "w-full rounded-[22px] border border-cars-accent bg-[#eef4ff] px-4 py-3 text-left"
                              : "w-full rounded-[22px] border border-cars-gray-light/70 px-4 py-3 text-left transition-colors hover:bg-cars-off-white"
                          }
                        >
                          <p className="font-semibold text-cars-primary">{label}</p>
                          <p className="mt-1 text-sm text-cars-gray">
                            {item.model_year} - {item.body_type || "Body pending"} - {item.fuel_type || "Fuel pending"}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => void runCompare()}
                    disabled={!compareState.selectedVariant || compareState.loading}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {compareState.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scale className="h-4 w-4" />
                    )}
                    Compare now
                  </button>

                  {compareState.error ? (
                    <p className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {compareState.error}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                {compareState.result ? (
                  <>
                    <div className="rounded-[26px] border border-cars-gray-light/70 bg-white px-5 py-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        AI verdict
                      </p>
                      <h3 className="mt-3 text-2xl font-apercu-bold text-cars-primary">
                        {compareState.result.title}
                      </h3>
                      <ConfidenceBadge confidence={compareState.result.confidence} />
                      <p className="mt-3 break-words text-sm leading-7 text-cars-gray">
                        {compareState.result.assistant_message}
                      </p>
                      {compareState.result.highlights?.length ? (
                        <ul className="mt-4 space-y-2 text-sm text-cars-primary">
                          {compareState.result.highlights.map((highlight) => (
                            <li key={highlight} className="rounded-[18px] bg-cars-off-white px-4 py-3">
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <InsightCards cards={compareState.result.insight_cards} />
                    <SourceList
                      sources={compareState.result.sources}
                      freshnessNote={compareState.result.freshness_note}
                    />
                    <CaveatList caveats={compareState.result.caveats} />

                    <div className="rounded-[26px] border border-cars-gray-light/70 px-5 py-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        Compared variants
                      </p>
                      <div className="mt-4 grid gap-3">
                        {compareState.result.items.map((item) => (
                          <article key={item.variant_id} className="rounded-[22px] bg-cars-off-white px-4 py-4">
                            <p className="text-lg font-apercu-bold text-cars-primary">
                              {[item.make, item.model, item.trim].filter(Boolean).join(" ")}
                            </p>
                            <p className="mt-2 text-sm text-cars-gray">
                              {item.year} - {item.body_type || "Body pending"} - {item.fuel_type || "Fuel pending"}
                            </p>
                            <div className="mt-4 grid gap-2 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                                  Pros
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-cars-primary">
                                  {(item.pros || []).slice(0, 3).map((pro) => (
                                    <li key={pro}>- {pro}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                                  Watch-outs
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-cars-primary">
                                  {(item.cons || []).slice(0, 3).map((con) => (
                                    <li key={con}>- {con}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full min-h-[320px] items-center justify-center rounded-[26px] border border-dashed border-cars-primary/20 bg-cars-off-white px-8 text-center text-sm leading-7 text-cars-gray">
                    Search for a second vehicle, then run the comparison to see a clean AI verdict
                    instead of a raw JSON payload.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </AiAssistantContext.Provider>
  );
}

export function useAiAssistant() {
  const value = useContext(AiAssistantContext);
  if (!value) {
    throw new Error("useAiAssistant must be used within AiAssistantProvider");
  }
  return value;
}
