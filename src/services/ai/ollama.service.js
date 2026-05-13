import { env } from "../../config/env.js";

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function toErrorMessage(error, fallback = "Unknown AI provider error") {
  return error instanceof Error ? error.message : String(error || fallback);
}

function normalizeProvider(value) {
  const normalized = String(value || "ollama").trim().toLowerCase();
  if (["fpt", "openai", "openai_compatible", "openai-compatible"].includes(normalized)) return "fpt";
  return "ollama";
}

function normalizeMessages(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(Boolean)
    .map((message) => ({
      role: message?.role || "user",
      content:
        typeof message?.content === "string"
          ? message.content
          : JSON.stringify(message?.content ?? ""),
    }));
}

function mapOpenAiCompatibleOptions(options = {}) {
  const payload = {};
  const temperature = Number(options?.temperature);
  const topP = Number(options?.top_p);
  const maxTokens = Number(options?.num_predict);
  const presencePenalty = Number(options?.presence_penalty);
  const frequencyPenalty = Number(options?.frequency_penalty);

  if (Number.isFinite(temperature)) payload.temperature = temperature;
  if (Number.isFinite(topP)) payload.top_p = topP;
  if (Number.isFinite(maxTokens)) payload.max_tokens = maxTokens;
  if (Number.isFinite(presencePenalty)) payload.presence_penalty = presencePenalty;
  if (Number.isFinite(frequencyPenalty)) payload.frequency_penalty = frequencyPenalty;

  return payload;
}

function resolveOpenAiCompatibleUrl(baseUrl, path) {
  const normalizedBase = trimSlash(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedPath || normalizedPath === "/") return normalizedBase;
  return normalizedBase.toLowerCase().endsWith(normalizedPath.toLowerCase())
    ? normalizedBase
    : `${normalizedBase}${normalizedPath}`;
}

export class OllamaService {
  constructor(config = {}) {
    const aiConfig = env.ai ?? {};
    const provider = normalizeProvider(config.provider ?? aiConfig.provider ?? "ollama");
    const ollamaConfig = env.ai?.ollama ?? {};
    const fptConfig = env.ai?.fpt ?? {};

    this.provider = provider;
    this.baseUrl = trimSlash(
      config.baseUrl ??
        (provider === "fpt" ? fptConfig.baseUrl : ollamaConfig.baseUrl) ??
        (provider === "fpt" ? "https://api.gptcloud.com/aiam/v1" : "http://localhost:11434")
    );
    this.model =
      config.model ??
      (provider === "fpt" ? fptConfig.model : ollamaConfig.model) ??
      (provider === "fpt" ? "" : "qwen3:1.7b");
    this.apiKey = config.apiKey ?? (provider === "fpt" ? fptConfig.apiKey ?? "" : "");
    this.timeoutMs = Number(
      config.timeoutMs ??
        (provider === "fpt" ? fptConfig.timeoutMs : ollamaConfig.timeoutMs) ??
        30000
    );
    this.retryCount = Number(config.retryCount ?? 1);
    this.retryDelayMs = Number(config.retryDelayMs ?? 150);
  }

  get providerLabel() {
    return this.provider === "fpt" ? "FPT AI Factory" : "Ollama";
  }

  buildUrl(path) {
    if (this.provider === "fpt") return resolveOpenAiCompatibleUrl(this.baseUrl, path);
    return `${this.baseUrl}${path}`;
  }

  buildHeaders(payload) {
    const headers = {};
    if (payload) headers["Content-Type"] = "application/json";
    if (this.provider === "fpt" && this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return Object.keys(headers).length ? headers : undefined;
  }

  ensureConfigured() {
    if (this.provider !== "fpt") return;
    if (!this.baseUrl) throw new Error("FPT AI Factory base URL is missing.");
    if (!this.apiKey) throw new Error("FPT AI Factory API key is missing.");
    if (!this.model) throw new Error("FPT AI Factory model is missing.");
  }

  async request(path, payload = null, { method = "POST", timeoutMs = this.timeoutMs, retryCount = this.retryCount } = {}) {
    this.ensureConfigured();
    const url = this.buildUrl(path);
    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: this.buildHeaders(payload),
          body: payload ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const error = new Error(
            `${this.providerLabel} ${method} ${path || url} failed with ${response.status}${body ? `: ${body}` : ""}`
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

    throw new Error(toErrorMessage(lastError, `Unknown ${this.providerLabel} error`));
  }

  async health() {
    if (this.provider === "fpt") {
      if (!this.baseUrl || !this.apiKey || !this.model) {
        return {
          ok: false,
          provider: this.provider,
          model: this.model,
          base_url: this.baseUrl,
          error: "FPT AI Factory configuration is incomplete.",
        };
      }
      return {
        ok: true,
        provider: this.provider,
        model: this.model,
        base_url: this.baseUrl,
        available_models: [],
      };
    }

    try {
      const result = await this.request("/api/tags", null, {
        method: "GET",
        timeoutMs: Math.min(this.timeoutMs, 2500),
        retryCount: 0,
      });
      return {
        ok: true,
        provider: this.provider,
        model: this.model,
        base_url: this.baseUrl,
        available_models: Array.isArray(result?.models) ? result.models.map((item) => item.name).filter(Boolean) : [],
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.provider,
        model: this.model,
        base_url: this.baseUrl,
        error: toErrorMessage(error, `Unknown ${this.providerLabel} error`),
      };
    }
  }

  async generate({ prompt, system = null, model = this.model, format = null, options = {}, timeoutMs = this.timeoutMs } = {}) {
    if (this.provider === "fpt") {
      const messages = [];
      if (system) messages.push({ role: "system", content: String(system) });
      messages.push({ role: "user", content: String(prompt || "") });
      return this.chat({ messages, model, format, options, timeoutMs });
    }

    const payload = {
      model,
      prompt: String(prompt || ""),
      stream: false,
      options,
    };
    if (system) payload.system = system;
    if (format) payload.format = format;

    const result = await this.request("/api/generate", payload, { timeoutMs });
    return {
      text: String(result?.response ?? ""),
      raw: result,
      model,
    };
  }

  async chat({ messages = [], model = this.model, format = null, options = {}, timeoutMs = this.timeoutMs } = {}) {
    if (this.provider === "fpt") {
      const payload = {
        model,
        messages: normalizeMessages(messages),
        stream: false,
        ...mapOpenAiCompatibleOptions(options),
      };

      if (format === "json" && !payload.temperature) payload.temperature = 0;

      const result = await this.request("/chat/completions", payload, { timeoutMs });
      return {
        text: String(result?.choices?.[0]?.message?.content ?? ""),
        raw: result,
        model,
      };
    }

    const payload = {
      model,
      messages,
      stream: false,
      options,
    };
    if (format) payload.format = format;

    const result = await this.request("/api/chat", payload, { timeoutMs });
    return {
      text: String(result?.message?.content ?? ""),
      raw: result,
      model,
    };
  }
}

export function createOllamaService(config = {}) {
  return new OllamaService(config);
}

export const defaultOllamaService = createOllamaService();
