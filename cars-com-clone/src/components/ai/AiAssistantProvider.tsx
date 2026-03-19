"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircleMore, Scale, SendHorizonal, Sparkles, X } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { aiApi, catalogApi } from "@/lib/carvista-api";
import { hasToken, toCurrency } from "@/lib/api-client";
import type {
  AiCompareResponse,
  AiConfidence,
  AiInsightCard,
  AiSource,
  VariantListItem,
} from "@/lib/types";

type AssistantOptions = {
  prompt?: string;
  marketId?: number;
  variantId?: number;
  variantLabel?: string;
};

type CompareOptions = {
  variantId: number;
  variantLabel: string;
  marketId?: number;
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
  "I need a family SUV for mostly city driving.",
  "I want a fuel-efficient car for daily commuting.",
  "Suggest a practical car for weekend road trips.",
  "Help me understand whether this car fits my needs.",
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

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function InsightCards({ cards }: { cards?: AiInsightCard[] }) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="mt-3 grid gap-3">
      {cards.map((card, index) => (
        <article
          key={`${card.title}-${index}`}
          className="rounded-[22px] border border-cars-gray-light/70 bg-white px-4 py-4 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
            {card.title}
          </p>
          {card.value != null ? (
            <p className="mt-2 break-words text-base font-apercu-bold text-cars-primary">
              {typeof card.value === "number" ? toCurrency(card.value) : String(card.value)}
            </p>
          ) : null}
          <p className="mt-2 break-words text-sm leading-6 text-cars-gray">{card.description}</p>
        </article>
      ))}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: AiConfidence | null }) {
  if (!confidence) return null;

  return (
    <div className="mt-3 inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-cars-primary">
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
    <div className="mt-3 space-y-2 rounded-[18px] bg-cars-off-white px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cars-accent">
        Sources
      </p>
      <div className="space-y-2 text-xs leading-5 text-cars-gray">
        {sources.slice(0, 4).map((source, index) => (
          <div key={`${source.provider}-${source.title}-${index}`}>
            <p className="font-semibold text-cars-primary">
              {source.provider}: {source.title}
            </p>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-cars-accent underline underline-offset-2"
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
    <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
      <p className="font-semibold uppercase tracking-[0.14em] text-amber-900/80">Caveats</p>
      <ul className="mt-2 space-y-1">
        {caveats.slice(0, 3).map((caveat) => (
          <li key={caveat}>- {caveat}</li>
        ))}
      </ul>
    </div>
  );
}

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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
  const [queuedPrompt, setQueuedPrompt] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    setMessages([
      {
        id: buildId("assistant"),
        role: "assistant",
        content:
          "Hi, I am your CarVista advisor. Tell me about your budget, how you drive, and what kind of car you like, and I will guide you through the best fit.",
      },
    ]);
  }, [open, messages.length]);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, sending]);

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

  function ensureAccess(nextPath?: string) {
    const target = nextPath || pathname || "/";
    if (authenticated || hasToken()) return true;
    return false;
  }

  function requestLogin(action: PendingAction, nextPath?: string) {
    setPendingAction(action);
    openAuth({ mode: "login", next: nextPath || pathname || "/" });
  }

  function launchAssistant(options?: AssistantOptions) {
    setOpen(true);
    if (options?.marketId) setMarketId(String(options.marketId));
    setFocusVariantId(options?.variantId ?? null);
    setFocusVariantLabel(options?.variantLabel || "");

    if (options?.prompt) {
      setInput(options.prompt);
      setQueuedPrompt(options.prompt);
    }
  }

  function launchCompare(options: CompareOptions) {
    setCompareState({
      ...emptyCompareState,
      open: true,
      variantId: options.variantId,
      variantLabel: options.variantLabel,
      marketId: options.marketId || Number(marketId) || 1,
    });
  }

  function openAssistant(options?: AssistantOptions) {
    const target = pathname || "/";
    if (!ensureAccess(target)) {
      requestLogin({ type: "assistant", options }, target);
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

    try {
      const response = await aiApi.chat({
        session_id: sessionId || undefined,
        message: text,
        context: {
          market_id: Number(marketId) || 1,
          ...(focusVariantId ? { focus_variant_id: focusVariantId } : {}),
          ...(focusVariantLabel ? { focus_variant_label: focusVariantLabel } : {}),
        },
      });

      setSessionId(response.session_id);
      setMessages((prev) => [
        ...prev,
        {
          id: buildId("assistant"),
          role: "assistant",
          content: response.answer,
          cards: response.cards,
          followUps: response.follow_up_questions,
          confidence: response.confidence ?? null,
          sources: response.sources ?? [],
          caveats: response.caveats ?? [],
          freshnessNote: response.freshness_note ?? null,
        },
      ]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Chat failed.");
    } finally {
      setSending(false);
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
      const result = await aiApi.compare({
        variant_ids: [compareState.variantId, compareState.selectedVariant.variant_id],
        market_id: compareState.marketId,
        price_type: "avg_market",
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

  const contextValue = useMemo<AiAssistantContextValue>(
    () => ({
      openAssistant,
      openCompare,
    }),
    [authenticated, focusVariantId, focusVariantLabel, marketId, pathname]
  );

  return (
    <AiAssistantContext.Provider value={contextValue}>
      {children}

      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
        {open ? (
          <section className="w-[min(92vw,400px)] overflow-hidden rounded-[30px] border border-cars-primary/10 bg-white shadow-[0_24px_80px_rgba(15,45,98,0.22)]">
            <div className="bg-[linear-gradient(135deg,rgba(15,45,98,0.98),rgba(27,76,160,0.92),rgba(95,150,255,0.82))] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                    CarVista advisor
                  </p>
                  <h2 className="mt-1 text-2xl font-apercu-bold">AI concierge</h2>
                  <p className="mt-2 text-sm leading-6 text-white/85">
                    Ask for recommendations, compare cars, forecast pricing, or understand TCO.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3 text-xs text-white/80">
                <label className="font-semibold uppercase tracking-[0.14em]">Market</label>
                <select
                  value={marketId}
                  onChange={(event) => setMarketId(event.target.value)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none"
                >
                  <option value="1" className="text-cars-primary">
                    Market 1
                  </option>
                  <option value="2" className="text-cars-primary">
                    Market 2
                  </option>
                </select>
              </div>

              {focusVariantLabel ? (
                <div className="mt-3 rounded-[18px] bg-white/10 px-3 py-2 text-sm leading-6 text-white/85">
                  Focused vehicle:{" "}
                  <span className="font-semibold text-white">{focusVariantLabel}</span>
                </div>
              ) : null}
            </div>

            <div
              ref={transcriptRef}
              className="max-h-[420px] space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_45%)] px-4 py-4"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] break-words rounded-[24px] rounded-br-md bg-cars-primary px-4 py-3 text-sm leading-6 text-white"
                        : "max-w-[92%] break-words rounded-[24px] rounded-bl-md border border-cars-gray-light/80 bg-white px-4 py-3 text-sm leading-6 text-cars-primary shadow-sm"
                    }
                  >
                    <p>{message.content}</p>
                    <ConfidenceBadge confidence={message.confidence} />
                    <InsightCards cards={message.cards} />
                    <SourceList sources={message.sources} freshnessNote={message.freshnessNote} />
                    <CaveatList caveats={message.caveats} />
                  </div>
                </div>
              ))}

              {sending ? (
                <div className="flex justify-start">
                  <div className="rounded-[24px] rounded-bl-md border border-cars-gray-light/80 bg-white px-4 py-3 text-sm text-cars-gray shadow-sm">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </span>
                  </div>
                </div>
              ) : null}

              {messages.length <= 1 ? (
                <div className="flex flex-wrap gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="rounded-full border border-cars-primary/10 bg-white px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              {chatError ? (
                <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {chatError}
                </div>
              ) : null}
            </div>

            <div className="border-t border-cars-gray-light/70 bg-white px-4 py-4">
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
                  className="min-h-[76px] flex-1 rounded-[22px] border border-cars-gray-light px-4 py-3 text-sm leading-6 text-cars-primary outline-none focus:border-cars-accent"
                  placeholder="Tell the advisor what you need. Example: I need a family SUV for city driving under 1 billion VND."
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
