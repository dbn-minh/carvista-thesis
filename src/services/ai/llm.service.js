import { env } from "../../config/env.js";
import { createOpenAiCompatibleService } from "./openai_compatible.service.js";
import { createOllamaService } from "./ollama.service.js";

export function normalizeLlmProvider(value) {
  const normalized = String(value || "ollama")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "ollama" || normalized === "local") {
    return "ollama";
  }

  if (
    normalized === "fpt" ||
    normalized === "openai" ||
    normalized === "openai_compatible" ||
    normalized === "openai-compatible"
  ) {
    return "openai_compatible";
  }

  return normalized;
}

export function createLlmService(config = {}) {
  const provider = normalizeLlmProvider(config.provider ?? env.ai?.provider);

  switch (provider) {
    case "ollama":
      return createOllamaService(config);
    case "openai_compatible":
      return createOpenAiCompatibleService(config);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

export const defaultLlmService = createLlmService();
