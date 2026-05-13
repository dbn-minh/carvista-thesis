import { env } from "../../config/env.js";

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizePath(value, fallback = "/chat/completions") {
  const normalized = String(value || fallback).trim();
  if (!normalized) return fallback;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown OpenAI-compatible error");
}

function normalizeMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.content === "string") return item.content;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildCompletionPayload({ messages, model, options = {} }) {
  const payload = {
    model,
    messages: (messages ?? []).map((message) => ({
      role: message?.role || "user",
      content: normalizeMessageContent(message?.content),
    })),
    stream: false,
  };

  if (options.temperature != null) payload.temperature = Number(options.temperature);
  if (options.top_p != null) payload.top_p = Number(options.top_p);
  if (options.presence_penalty != null) {
    payload.presence_penalty = Number(options.presence_penalty);
  }
  if (options.frequency_penalty != null) {
    payload.frequency_penalty = Number(options.frequency_penalty);
  }
  if (options.num_predict != null) {
    const maxTokens = Number(options.num_predict);
    if (Number.isFinite(maxTokens) && maxTokens > 0) payload.max_tokens = maxTokens;
  }

  return payload;
}

export class OpenAiCompatibleService {
  constructor(config = {}) {
    const providerConfig = env.ai?.openaiCompatible ?? {};
    this.baseUrl = trimSlash(config.baseUrl ?? providerConfig.baseUrl ?? "");
    this.apiKey = String(config.apiKey ?? providerConfig.apiKey ?? "");
    this.model = String(config.model ?? providerConfig.model ?? "");
    this.timeoutMs = Number(config.timeoutMs ?? providerConfig.timeoutMs ?? 30000);
    this.retryCount = Number(config.retryCount ?? 1);
    this.retryDelayMs = Number(config.retryDelayMs ?? 150);
    this.chatCompletionsPath = normalizePath(
      config.chatCompletionsPath ?? providerConfig.chatCompletionsPath,
    );
  }

  assertConfigured() {
    if (!this.baseUrl) {
      throw new Error("AI_BASE_URL is not configured for the OpenAI-compatible provider.");
    }
    if (!this.apiKey) {
      throw new Error("AI_API_KEY is not configured for the OpenAI-compatible provider.");
    }
    if (!this.model) {
      throw new Error("AI_MODEL is not configured for the OpenAI-compatible provider.");
    }
  }

  async request(
    path,
    payload = null,
    {
      method = "POST",
      timeoutMs = this.timeoutMs,
      retryCount = this.retryCount,
    } = {},
  ) {
    this.assertConfigured();

    const url = `${this.baseUrl}${normalizePath(path, this.chatCompletionsPath)}`;
    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(payload ? { "Content-Type": "application/json" } : {}),
          },
          body: payload ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const error = new Error(
            `OpenAI-compatible ${method} ${path} failed with ${response.status}${body ? `: ${body}` : ""}`,
          );
          error.status = response.status;
          throw error;
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        const status = Number(error?.status);
        const isTransient = !status || TRANSIENT_STATUS_CODES.has(status);
        if (attempt >= retryCount || !isTransient) break;
        await sleep(this.retryDelayMs * (attempt + 1));
      }
    }

    throw new Error(toErrorMessage(lastError));
  }

  async health() {
    if (!this.baseUrl || !this.apiKey || !this.model) {
      return {
        ok: false,
        model: this.model,
        base_url: this.baseUrl,
        error: "Missing AI provider configuration.",
      };
    }

    try {
      const result = await this.request(
        this.chatCompletionsPath,
        buildCompletionPayload({
          model: this.model,
          messages: [{ role: "user", content: "ping" }],
          options: { temperature: 0, num_predict: 1 },
        }),
        {
          timeoutMs: Math.min(this.timeoutMs, 4000),
          retryCount: 0,
        },
      );

      return {
        ok: true,
        model: this.model,
        base_url: this.baseUrl,
        response_id: result?.id ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        model: this.model,
        base_url: this.baseUrl,
        error: toErrorMessage(error),
      };
    }
  }

  async generate({
    prompt,
    system = null,
    model = this.model,
    format = null,
    options = {},
    timeoutMs = this.timeoutMs,
  } = {}) {
    const messages = [];
    const jsonGuardrail = "Return valid JSON only. Do not include markdown fences.";
    if (system) {
      messages.push({
        role: "system",
        content: format === "json" ? `${String(system)}\n\n${jsonGuardrail}` : String(system),
      });
    } else if (format === "json") {
      messages.push({ role: "system", content: jsonGuardrail });
    }
    messages.push({ role: "user", content: String(prompt || "") });

    const result = await this.request(
      this.chatCompletionsPath,
      buildCompletionPayload({ messages, model, options }),
      { timeoutMs },
    );

    return {
      text: normalizeMessageContent(result?.choices?.[0]?.message?.content),
      raw: result,
      model,
    };
  }

  async chat({
    messages = [],
    model = this.model,
    format = null,
    options = {},
    timeoutMs = this.timeoutMs,
  } = {}) {
    const normalizedMessages = [...messages];
    if (format === "json") {
      normalizedMessages.unshift({
        role: "system",
        content: "Return valid JSON only. Do not include markdown fences.",
      });
    }

    const result = await this.request(
      this.chatCompletionsPath,
      buildCompletionPayload({ messages: normalizedMessages, model, options }),
      { timeoutMs },
    );

    return {
      text: normalizeMessageContent(result?.choices?.[0]?.message?.content),
      raw: result,
      model,
    };
  }
}

export function createOpenAiCompatibleService(config = {}) {
  return new OpenAiCompatibleService(config);
}
