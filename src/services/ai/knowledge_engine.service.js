import { buildConfidence, buildEvidence, buildNarrativeEnvelope } from "./contracts.js";
import {
  combineKnowledgeSources,
  fetchOfficialVehicleSignals,
  loadVariantContext,
  searchVariantsByText,
} from "./source_retrieval.service.js";

function detectKnowledgeTopic(message) {
  const normalized = String(message || "").toLowerCase();
  if (/\b(safe|safety|recall)\b/i.test(normalized)) return "safety";
  if (/\b(reliable|reliability|maintenance|repair|bao duong|ben)\b/i.test(normalized)) return "reliability";
  if (/\b(city|urban|commute|daily)\b/i.test(normalized)) return "city_fit";
  if (/\b(highway|road trip|weekend trip|long trip)\b/i.test(normalized)) return "trip_fit";
  if (/\b(fuel economy|mpg|range|efficiency|tiet kiem)\b/i.test(normalized)) return "efficiency";
  if (/\b(feature|technology|comfort|space|practical)\b/i.test(normalized)) return "practicality";
  return "overview";
}

function parseReliabilitySignal(context) {
  const avgRating = Number(context.review_summary?.avg_rating);
  if (Number.isFinite(avgRating) && avgRating >= 4.2) return "strong";
  if (Number.isFinite(avgRating) && avgRating >= 3.5) return "steady";
  if (Number.isFinite(avgRating)) return "mixed";
  return "unknown";
}

function buildDirectAnswer(topic, context, official) {
  const variant = context.variant;
  const label = variant.label;
  const recallCount = official.recalls.length;
  const fuel = official.fuel_economy;
  const reliabilitySignal = parseReliabilitySignal(context);

  if (topic === "safety") {
    if (recallCount > 0) {
      return `${label} has ${recallCount} recall record(s) returned by NHTSA for this year and model lookup, so I would treat safety diligence as important rather than optional.`;
    }
    return `${label} does not show a current NHTSA recall result from the official lookup I ran, but that does not automatically guarantee zero safety risk across every trim or market.`;
  }

  if (topic === "efficiency") {
    if (fuel?.combined_mpg) {
      return `${label} is rated around ${fuel.combined_mpg} mpg combined on the official FuelEconomy.gov profile, which gives us a verified starting point for running costs.`;
    }
    return `${label} does not have a verified official fuel-economy profile from the fallback source I checked, so efficiency needs to be estimated from drivetrain and body style instead.`;
  }

  if (topic === "city_fit") {
    const cityFriendly =
      ["sedan", "hatchback", "cuv"].includes(variant.body_type) || ["hybrid", "ev"].includes(variant.fuel_type);
    return cityFriendly
      ? `${label} looks reasonably well suited to city driving thanks to its ${variant.body_type || "body style"} layout and ${variant.fuel_type || "current"} powertrain.`
      : `${label} can still work in the city, but its format is less naturally city-friendly than smaller or more efficient alternatives.`;
  }

  if (topic === "trip_fit") {
    const tripFriendly = ["gasoline", "diesel", "hybrid"].includes(variant.fuel_type) || Number(variant.seats) >= 5;
    return tripFriendly
      ? `${label} looks usable for highway or weekend travel, especially if you care about flexibility and quick refueling.`
      : `${label} may need a closer look for long-trip use, especially if charging, cabin space, or luggage flexibility matters to you.`;
  }

  if (topic === "reliability") {
    if (reliabilitySignal === "strong") {
      return `${label} currently looks encouraging on internal user sentiment, but I would still separate owner satisfaction from true long-term durability.`;
    }
    if (reliabilitySignal === "mixed") {
      return `${label} has a mixed reliability signal from the data on hand, so I would not oversell it without checking maintenance history and trim-specific issues.`;
    }
    return `${label} does not yet have enough local reliability evidence for a hard verdict, so any recommendation here should stay cautious.`;
  }

  return `${label} looks like a credible option, but the best verdict depends on whether you care most about comfort, cost, reliability, or day-to-day practicality.`;
}

function buildKnowledgeCards(context, official) {
  const variant = context.variant;
  const fuel = official.fuel_economy;
  return [
    {
      title: "Vehicle",
      value: variant.label,
      description: `${variant.body_type || "Body pending"} · ${variant.fuel_type || "Fuel pending"} · ${variant.transmission || "Transmission pending"}`,
    },
    fuel?.combined_mpg
      ? {
          title: "Official efficiency",
          value: `${fuel.combined_mpg} mpg combined`,
          description: `FuelEconomy.gov also lists ${fuel.city_mpg} city / ${fuel.highway_mpg} highway mpg.`,
        }
      : {
          title: "Efficiency status",
          value: "No official fallback match",
          description: "Official fuel economy data could not be matched automatically for this vehicle lookup.",
        },
    {
      title: "Market signal",
      value: variant.latest_price ?? variant.msrp_base ?? "Price pending",
      description:
        variant.latest_price != null
          ? "Latest internal market snapshot available."
          : "No current market snapshot was available, so only list price/MSRP context is known.",
    },
  ].filter(Boolean);
}

export async function answerVehicleQuestion(ctx, input) {
  const focusVariantId = Number.isInteger(Number(input?.focus_variant_id)) ? Number(input.focus_variant_id) : null;
  let context = focusVariantId ? await loadVariantContext(ctx, { variant_id: focusVariantId, market_id: input.market_id ?? 1 }) : null;

  if (!context) {
    const matches = await searchVariantsByText(ctx, input.message, 3);
    const suggestionText = matches.length
      ? matches
          .map((item) => [item.model_year, item.make_name, item.model_name, item.trim_name].filter(Boolean).join(" "))
          .join("; ")
      : null;

    return buildNarrativeEnvelope({
      title: "Vehicle clarification needed",
      assistant_message: suggestionText
        ? `I can answer that properly once I know the exact car. The closest matches I found are: ${suggestionText}.`
        : "I can help, but I need a clearer vehicle reference first. Give me the make, model, year, or open a vehicle detail page before asking.",
      highlights: ["No single vehicle could be grounded confidently from the current message."],
      insight_cards: [],
      confidence: buildConfidence(0.22, ["The message did not resolve to a single grounded vehicle record."]),
      evidence: buildEvidence({
        verified: [],
        inferred: [],
        estimated: [],
      }),
      sources: [],
      caveats: ["The assistant intentionally avoided guessing the exact car."],
    });
  }

  const official = await fetchOfficialVehicleSignals({
    year: context.variant.model_year,
    make: context.variant.make_name,
    model: context.variant.model_name,
  });

  const topic = detectKnowledgeTopic(input.message);
  const assistantMessage = buildDirectAnswer(topic, context, official);
  const verified = [
    `${context.variant.label} is grounded to a local catalog record.`,
    context.variant.latest_price != null ? "Current local market price data exists." : null,
    official.fuel_economy?.combined_mpg ? "Official fuel economy data was retrieved from FuelEconomy.gov." : null,
    official.recalls.length > 0 ? `Official NHTSA recall lookup returned ${official.recalls.length} item(s).` : null,
  ].filter(Boolean);
  const inferred = [
    topic === "city_fit" ? "City suitability is inferred from body style and powertrain." : null,
    topic === "trip_fit" ? "Long-trip suitability is inferred from body style, seats, and drivetrain context." : null,
    topic === "reliability" ? "Reliability guidance is inferred from review signal plus available official context." : null,
  ].filter(Boolean);
  const estimated = [
    official.fuel_economy?.combined_mpg ? null : "Fuel economy had to remain qualitative because no official fallback match was found.",
  ].filter(Boolean);

  return buildNarrativeEnvelope({
    title: "CarVista expert answer",
    assistant_message: assistantMessage,
    highlights: [
      context.review_summary?.avg_rating != null
        ? `Internal review rating: ${context.review_summary.avg_rating.toFixed(1)} / 5`
        : "Internal review history is limited for this vehicle.",
      official.recalls.length > 0
        ? `${official.recalls.length} official recall item(s) surfaced from NHTSA.`
        : "No official recall item surfaced in the current NHTSA lookup.",
    ],
    insight_cards: buildKnowledgeCards(context, official),
    confidence: buildConfidence(
      official.sources.length > 0 ? 0.74 : 0.58,
      [
        "The answer is grounded to a resolved vehicle record.",
        official.sources.length > 0 ? "Official external sources were available." : "Official fallback data was partially unavailable.",
      ]
    ),
    evidence: buildEvidence({ verified, inferred, estimated }),
    sources: combineKnowledgeSources(context, official),
    caveats: [
      "Trim-specific features can vary by region and package.",
      ...official.caveats,
    ],
  });
}
