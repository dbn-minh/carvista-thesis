import { resolveMarketByText, searchVariantsByText } from "./source_retrieval.service.js";

const FOCUS_REFERENCE_PATTERN = /\b(this car|this vehicle|this one|that car|that vehicle|that one|current car|current vehicle|xe nay|xe do|mau nay|mau do)\b/i;

function extractVariantIds(message) {
  const match = String(message || "").match(/\[(\s*\d+\s*(,\s*\d+\s*)+)\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

function vehicleLabelFromRow(row) {
  return [row?.model_year, row?.make_name, row?.model_name, row?.trim_name].filter(Boolean).join(" ");
}

function buildClarification(intent, missing_fields, message, context_updates = {}) {
  return {
    ok: false,
    clarification: {
      intent,
      missing_fields,
      message,
      context_updates,
    },
  };
}

function uniqueIntegers(values) {
  return [...new Set((values ?? []).filter((value) => Number.isInteger(value)))];
}

async function resolveVehicleByMention(ctx, mention) {
  if (!mention) return null;
  const matches = await searchVariantsByText(ctx, mention, 3);
  const best = matches[0] ?? null;
  if (!best) return null;
  return {
    variant_id: best.variant_id,
    label: vehicleLabelFromRow(best),
  };
}

function filterContextMentions(mentions, focusLabel) {
  const normalizedFocus = String(focusLabel || "").trim().toLowerCase();
  return (mentions ?? []).filter((mention) => String(mention || "").trim().toLowerCase() !== normalizedFocus);
}

function hasExplicitVehicleMentions(entities, context) {
  const mentions = filterContextMentions(entities?.vehicles, context.focus_variant_label);
  return mentions.length > 0 && !FOCUS_REFERENCE_PATTERN.test(String(context.message || ""));
}

async function resolvePrimaryVehicle(ctx, entities, context) {
  const explicitMentions = filterContextMentions(entities.vehicles, context.focus_variant_label);
  if (explicitMentions[0]) {
    return resolveVehicleByMention(ctx, explicitMentions[0]);
  }

  if (Number.isInteger(context.focus_variant_id)) {
    return {
      variant_id: context.focus_variant_id,
      label: context.focus_variant_label ?? null,
    };
  }

  const vehicleMention = filterContextMentions(entities.vehicles, context.focus_variant_label)[0] ?? null;
  return resolveVehicleByMention(ctx, vehicleMention);
}

async function resolveSecondaryCompareVehicle(ctx, entities, context) {
  const candidateIds = uniqueIntegers(context.compare_variant_ids);
  if (candidateIds.length >= 2) {
    return {
      variant_id: candidateIds[1],
      label: null,
    };
  }

  const filteredMentions = filterContextMentions(entities.vehicles, context.focus_variant_label);
  const secondMention = filteredMentions[0] ?? entities.vehicles[1] ?? null;
  return resolveVehicleByMention(ctx, secondMention);
}

async function resolveMarketContext(ctx, entities, context) {
  if (Number.isInteger(context.market_id)) {
    return {
      market_id: context.market_id,
      market_name: context.market_name ?? context.country ?? null,
    };
  }

  const country = entities.country ?? context.country ?? null;
  if (!country) return null;

  const market = await resolveMarketByText(ctx, country);
  if (!market) return null;

  return {
    market_id: market.market_id,
    market_name: market.name,
    country: market.name,
  };
}

async function validateCompareRequest(ctx, intentResult, context) {
  const explicitIds = extractVariantIds(context.message);
  if (explicitIds.length >= 2) {
    return {
      ok: true,
      payload: {
        variant_ids: explicitIds.slice(0, 5),
        market_id: context.market_id ?? 1,
        buyer_profile: context.advisor_profile,
      },
      context_updates: {
        compare_variant_ids: explicitIds.slice(0, 5),
      },
    };
  }

  const explicitMentions = filterContextMentions(intentResult.entities.vehicles, context.focus_variant_label);
  if (explicitMentions.length >= 2) {
    const resolvedVehicles = await Promise.all(explicitMentions.slice(0, 2).map((mention) => resolveVehicleByMention(ctx, mention)));
    const variantIds = uniqueIntegers(resolvedVehicles.map((vehicle) => vehicle?.variant_id));
    if (variantIds.length >= 2) {
      const [left, right] = resolvedVehicles;
      return {
        ok: true,
        payload: {
          variant_ids: variantIds.slice(0, 5),
          market_id: context.market_id ?? 1,
          buyer_profile: context.advisor_profile,
        },
        context_updates: {
          compare_variant_ids: variantIds.slice(0, 5),
          ...(left?.variant_id ? { focus_variant_id: left.variant_id } : {}),
          ...(left?.label ? { focus_variant_label: left.label } : {}),
        },
      };
    }
  }

  if (explicitMentions.length === 1 && Number.isInteger(context.focus_variant_id)) {
    const right = await resolveVehicleByMention(ctx, explicitMentions[0]);
    const variantIds = uniqueIntegers([context.focus_variant_id, right?.variant_id]).slice(0, 5);
    if (variantIds.length >= 2) {
      return {
        ok: true,
        payload: {
          variant_ids: variantIds,
          market_id: context.market_id ?? 1,
          buyer_profile: context.advisor_profile,
        },
        context_updates: {
          compare_variant_ids: variantIds,
          focus_variant_id: context.focus_variant_id,
          ...(context.focus_variant_label ? { focus_variant_label: context.focus_variant_label } : {}),
        },
      };
    }
  }

  const left = await resolvePrimaryVehicle(ctx, intentResult.entities, context);
  const right = await resolveSecondaryCompareVehicle(ctx, intentResult.entities, {
    ...context,
    compare_variant_ids:
      explicitMentions.length > 0
        ? left?.variant_id != null
          ? [left.variant_id]
          : []
        : left?.variant_id != null
          ? [left.variant_id, ...(context.compare_variant_ids ?? []).slice(1)]
          : context.compare_variant_ids,
  });

  const variantIds = uniqueIntegers([
    left?.variant_id,
    right?.variant_id,
    ...(hasExplicitVehicleMentions(intentResult.entities, context) ? [] : context.compare_variant_ids ?? []),
  ]).slice(0, 5);
  if (variantIds.length < 2) {
    return buildClarification(
      "compare_car",
      ["vehicles"],
      Number.isInteger(context.focus_variant_id)
        ? "I have the current vehicle loaded. Tell me the second car you want to compare against it."
        : "I can compare cars once I know both vehicles. Tell me the two cars you want to compare, or open a vehicle detail page first.",
      {
        ...(left?.variant_id ? { compare_variant_ids: [left.variant_id] } : {}),
      }
    );
  }

  return {
    ok: true,
    payload: {
      variant_ids: variantIds,
      market_id: context.market_id ?? 1,
      buyer_profile: context.advisor_profile,
    },
    context_updates: {
      compare_variant_ids: variantIds,
      ...(left?.variant_id ? { focus_variant_id: left.variant_id } : {}),
      ...(left?.label ? { focus_variant_label: left.label } : {}),
    },
  };
}

async function validateVehicleLookup(ctx, intent, intentResult, context) {
  const explicitIds = extractVariantIds(context.message);
  const explicitId = explicitIds[0] ?? null;
  const vehicle = explicitId != null ? { variant_id: explicitId, label: null } : await resolvePrimaryVehicle(ctx, intentResult.entities, context);
  if (!Number.isInteger(vehicle?.variant_id)) {
    return buildClarification(
      intent,
      ["vehicle"],
      "Tell me exactly which vehicle you mean. A make, model, and year is enough, or you can open a vehicle detail page first."
    );
  }

  return {
    ok: true,
    payload: {
      variant_id: vehicle.variant_id,
      market_id: context.market_id ?? 1,
      horizon_months: intentResult.entities.ownership_period_years ?? 6,
    },
    context_updates: {
      focus_variant_id: vehicle.variant_id,
      ...(vehicle.label ? { focus_variant_label: vehicle.label } : {}),
    },
  };
}

async function validateTcoRequest(ctx, intentResult, context) {
  const market = await resolveMarketContext(ctx, intentResult.entities, context);
  if (!market?.market_id) {
    return buildClarification(
      "calculate_tco",
      ["country"],
      "Which country or market should I use for the ownership-cost estimate?",
      {}
    );
  }

  const vehicle = await resolvePrimaryVehicle(ctx, intentResult.entities, context);
  if (!Number.isInteger(vehicle?.variant_id)) {
    return buildClarification(
      "calculate_tco",
      ["vehicle"],
      "Which vehicle should I calculate ownership cost for? Tell me the make, model, and year, or open the vehicle detail page first.",
      {
        market_id: market.market_id,
        market_name: market.market_name ?? null,
        country: market.country ?? market.market_name ?? null,
      }
    );
  }

  return {
    ok: true,
    payload: {
      market_id: market.market_id,
      variant_id: vehicle.variant_id,
      base_price: intentResult.entities.budget ?? context.base_price ?? undefined,
      ownership_years: intentResult.entities.ownership_period_years ?? context.ownership_period_years ?? 5,
      km_per_year: intentResult.entities.annual_mileage_km ?? context.annual_mileage_km ?? null,
    },
    context_updates: {
      market_id: market.market_id,
      market_name: market.market_name ?? null,
      country: market.country ?? market.market_name ?? null,
      focus_variant_id: vehicle.variant_id,
      ...(vehicle.label ? { focus_variant_label: vehicle.label } : {}),
    },
  };
}

export async function validateAndResolveRequest(ctx, intentResult, context = {}) {
  const workingContext = {
    ...context,
    message: context.message ?? "",
  };

  if (intentResult.intent === "compare_car") {
    return validateCompareRequest(ctx, intentResult, workingContext);
  }

  if (intentResult.intent === "predict_vehicle_value" || intentResult.intent === "market_trend_analysis") {
    return validateVehicleLookup(ctx, intentResult.intent, intentResult, workingContext);
  }

  if (intentResult.intent === "calculate_tco") {
    return validateTcoRequest(ctx, intentResult, workingContext);
  }

  return {
    ok: true,
    payload: {},
    context_updates: {},
  };
}
