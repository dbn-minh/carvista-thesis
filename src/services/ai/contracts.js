import { z } from "zod";

export const sourceSchema = z.object({
  provider: z.string().min(1),
  type: z.enum(["internal_db", "official_api", "configured_feed", "web"]),
  title: z.string().min(1),
  url: z.string().url().nullable().optional(),
  retrieved_at: z.string().min(1),
  trust: z.enum(["high", "medium", "low"]).default("medium"),
  note: z.string().nullable().optional(),
});

export const confidenceSchema = z.object({
  score: z.number().min(0).max(1),
  label: z.string().min(1),
  rationale: z.array(z.string()).default([]),
});

export const evidenceBucketSchema = z.object({
  verified: z.array(z.string()).default([]),
  inferred: z.array(z.string()).default([]),
  estimated: z.array(z.string()).default([]),
});

const insightCardSchema = z.object({
  title: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
  description: z.string().min(1),
});

const narrativeSchema = z.object({
  title: z.string().min(1),
  assistant_message: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  insight_cards: z.array(insightCardSchema).default([]),
  confidence: confidenceSchema,
  evidence: evidenceBucketSchema,
  sources: z.array(sourceSchema).default([]),
  caveats: z.array(z.string()).default([]),
  freshness_note: z.string().nullable().optional(),
});

function normalizeUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

export function confidenceLabel(score) {
  if (score >= 0.82) return "High confidence";
  if (score >= 0.64) return "Good confidence";
  if (score >= 0.42) return "Moderate confidence";
  return "Low confidence";
}

export function buildConfidence(score, rationale = []) {
  const normalized = Math.max(0, Math.min(1, Number(score) || 0));
  return confidenceSchema.parse({
    score: normalized,
    label: confidenceLabel(normalized),
    rationale: rationale.filter(Boolean),
  });
}

export function buildSource(input) {
  return sourceSchema.parse({
    provider: input.provider,
    type: input.type,
    title: input.title,
    url: normalizeUrl(input.url),
    retrieved_at: input.retrieved_at ?? new Date().toISOString(),
    trust: input.trust ?? "medium",
    note: input.note ?? null,
  });
}

export function mergeSources(...groups) {
  const seen = new Set();
  const merged = [];

  for (const group of groups.flat()) {
    if (!group) continue;
    const source = buildSource(group);
    const key = [source.provider, source.type, source.title, source.url ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(source);
  }

  return merged;
}

export function buildEvidence({ verified = [], inferred = [], estimated = [] } = {}) {
  return evidenceBucketSchema.parse({
    verified: verified.filter(Boolean),
    inferred: inferred.filter(Boolean),
    estimated: estimated.filter(Boolean),
  });
}

export function summarizeFreshness(sources) {
  if (!sources?.length) return null;

  const timestamps = sources
    .map((source) => Date.parse(source.retrieved_at))
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) return null;

  const latest = new Date(Math.max(...timestamps));
  return `Sources checked through ${latest.toISOString().slice(0, 10)}.`;
}

export function buildNarrativeEnvelope(input) {
  return narrativeSchema.parse({
    title: input.title,
    assistant_message: input.assistant_message,
    highlights: input.highlights ?? [],
    insight_cards: input.insight_cards ?? [],
    confidence: input.confidence,
    evidence: input.evidence,
    sources: input.sources ?? [],
    caveats: input.caveats ?? [],
    freshness_note: input.freshness_note ?? summarizeFreshness(input.sources ?? []),
  });
}

export const aiNarrativeSchema = narrativeSchema;
