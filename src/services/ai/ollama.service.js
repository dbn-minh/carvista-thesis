import { env } from "../../config/env.js";

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown Ollama error");
}

export class OllamaService {
  constructor(config = {}) {
    const ollamaConfig = env.ai?.ollama ?? {};
    this.baseUrl = trimSlash(config.baseUrl ?? ollamaConfig.baseUrl ?? "http://localhost:11434");
    this.model = config.model ?? ollamaConfig.model ?? "qwen3:1.7b";
    this.timeoutMs = Number(config.timeoutMs ?? ollamaConfig.timeoutMs ?? 30000);
    this.retryCount = Number(config.retryCount ?? 1);
    this.retryDelayMs = Number(config.retryDelayMs ?? 150);
  }

  async request(path, payload = null, { method = "POST", timeoutMs = this.timeoutMs, retryCount = this.retryCount } = {}) {
    const url = `${this.baseUrl}${path}`;
    let lastError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: payload ? { "Content-Type": "application/json" } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const error = new Error(`Ollama ${method} ${path} failed with ${response.status}${body ? `: ${body}` : ""}`);
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
    try {
      const result = await this.request("/api/tags", null, {
        method: "GET",
        timeoutMs: Math.min(this.timeoutMs, 2500),
        retryCount: 0,
      });
      return {
        ok: true,
        model: this.model,
        base_url: this.baseUrl,
        available_models: Array.isArray(result?.models) ? result.models.map((item) => item.name).filter(Boolean) : [],
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

  async generate({ prompt, system = null, model = this.model, format = null, options = {}, timeoutMs = this.timeoutMs } = {}) {
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
