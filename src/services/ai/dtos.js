import { z } from "zod";
import { confidenceSchema, evidenceBucketSchema, sourceSchema } from "./contracts.js";

export const vehicleRefSchema = z.object({
  variant_id: z.number().int().nullable().optional(),
  raw: z.string().min(1),
  normalized: z.string().min(1),
});

export const intentResultSchema = z.object({
  intent: z.enum([
    "compare_car",
    "predict_vehicle_value",
    "calculate_tco",
    "vehicle_general_qa",
    "recommend_car",
    "market_trend_analysis",
    "small_talk",
    "out_of_scope",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    vehicles: z.array(z.string()).default([]),
    country: z.string().nullable().default(null),
    budget: z.number().nullable().default(null),
    ownership_period_years: z.number().nullable().default(null),
    annual_mileage_km: z.number().nullable().default(null),
    market_id: z.number().nullable().default(null),
    focus_variant_id: z.number().nullable().default(null),
  }),
  needs_clarification: z.boolean(),
  missing_fields: z.array(z.string()).default([]),
});

const assumptionSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["verified", "estimated", "inferred"]),
});

export const compareResultSchema = z.object({
  intent: z.literal("compare_car"),
  summary: z.object({
    best_overall: z.string().nullable(),
    best_for: z.record(z.string(), z.string()).default({}),
  }),
  vehicles: z.array(
    z.object({
      variant_id: z.number().int().nullable().optional(),
      name: z.string(),
      pros: z.array(z.string()).default([]),
      cons: z.array(z.string()).default([]),
      scores: z.record(z.string(), z.number()).default({}),
    })
  ),
  recommendation: z.object({
    winner: z.string().nullable(),
    reason: z.string().nullable(),
  }),
  confidence: confidenceSchema,
  assumptions: z.array(assumptionSchema).default([]),
  sources: z.array(sourceSchema).default([]),
});

export const valuationResultSchema = z.object({
  intent: z.literal("predict_vehicle_value"),
  variant_id: z.number().int().nullable().optional(),
  vehicle: z.string().nullable(),
  current_fair_value_range: z.object({
    min: z.number().nullable(),
    midpoint: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string(),
  }),
  confidence: confidenceSchema,
  factors: z.array(z.string()).default([]),
  assumptions: z.array(assumptionSchema).default([]),
  sources: z.array(sourceSchema).default([]),
});

export const forecastResultSchema = z.object({
  intent: z.literal("market_trend_analysis"),
  variant_id: z.number().int().nullable().optional(),
  vehicle: z.string().nullable(),
  horizon_months: z.number().int(),
  forecast_range: z.object({
    min: z.number().nullable(),
    midpoint: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string(),
  }),
  scarcity_signal: z.string().nullable(),
  confidence: confidenceSchema,
  factors: z.array(z.string()).default([]),
  assumptions: z.array(assumptionSchema).default([]),
  sources: z.array(sourceSchema).default([]),
});

export const tcoResultSchema = z.object({
  intent: z.literal("calculate_tco"),
  vehicle: z.string().nullable(),
  country: z.string().nullable(),
  one_time_costs: z.record(z.string(), z.number().nullable()).default({}),
  recurring_costs: z.record(z.string(), z.number().nullable()).default({}),
  totals: z.object({
    ownership_years: z.number().int(),
    total: z.number().nullable(),
    yearly_average: z.number().nullable(),
    monthly_average: z.number().nullable(),
    currency: z.string(),
  }),
  confidence: confidenceSchema,
  assumptions: z.array(assumptionSchema).default([]),
  sources: z.array(sourceSchema).default([]),
});

export const knowledgeResultSchema = z.object({
  intent: z.literal("vehicle_general_qa"),
  variant_id: z.number().int().nullable().optional(),
  topic: z.string(),
  direct_answer: z.string(),
  highlights: z.array(z.string()).default([]),
  confidence: confidenceSchema,
  assumptions: z.array(assumptionSchema).default([]),
  sources: z.array(sourceSchema).default([]),
});

export const recommendationResultSchema = z.object({
  intent: z.literal("recommend_car"),
  ranked_vehicles: z.array(
    z.object({
      variant_id: z.number().int().nullable().optional(),
      name: z.string(),
      score: z.number(),
      reasons: z.array(z.string()).default([]),
    })
  ),
  profile_summary: z.string(),
  confidence: confidenceSchema,
  assumptions: z.array(assumptionSchema).default([]),
  sources: z.array(sourceSchema).default([]),
});

export const chatEnvelopeSchema = z.object({
  flow_id: z.string().min(1).nullable().optional(),
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  needs_clarification: z.boolean(),
  structured_result: z.record(z.string(), z.unknown()).nullable(),
  final_answer: z.string(),
  context_updates: z.record(z.string(), z.unknown()).default({}),
  result_confidence: confidenceSchema.nullable().optional(),
  evidence: evidenceBucketSchema.nullable().optional(),
  sources: z.array(sourceSchema).default([]),
  caveats: z.array(z.string()).default([]),
  freshness_note: z.string().nullable().optional(),
  meta: z.object({
    services_used: z.array(z.string()).default([]),
    sources_used: z.array(z.string()).default([]),
    fallback_used: z.boolean().default(false),
    latency_ms: z.number().nonnegative().default(0),
    route_service: z.string().nullable().optional(),
    missing_fields: z.array(z.string()).default([]),
    validation_status: z.string().nullable().optional(),
  }),
});
