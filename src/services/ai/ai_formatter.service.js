function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric);
}

function formatMoney(value, currency = "") {
  const rendered = formatNumber(value);
  return rendered ? `${rendered}${currency ? ` ${currency}` : ""}` : null;
}

function formatRange(range) {
  if (!range) return null;
  const min = formatMoney(range.min, range.currency);
  const midpoint = formatMoney(range.midpoint, range.currency);
  const max = formatMoney(range.max, range.currency);
  return {
    min,
    midpoint,
    max,
    sentence:
      midpoint && min && max
        ? `${midpoint}, with a realistic range from ${min} to ${max}`
        : midpoint || min || max || null,
  };
}

function pickHighlights(list, count = 2) {
  return Array.isArray(list) ? list.filter(Boolean).slice(0, count) : [];
}

function pickScoreLeader(vehicles, scoreKey) {
  const candidates = Array.isArray(vehicles)
    ? vehicles.filter((item) => Number.isFinite(item?.scores?.[scoreKey]))
    : [];
  if (!candidates.length) return null;
  return candidates.slice().sort((left, right) => right.scores[scoreKey] - left.scores[scoreKey])[0];
}

function trimInsight(value, maxLength = 96) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[|]+/g, ", ");
  if (!text) return null;
  const normalized = text.replace(/[.]+$/g, "");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function lowerFirst(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function formatFocusedComparison(structuredResult, turnContext = {}) {
  const vehicles = structuredResult.vehicles ?? [];
  const dimension = turnContext.follow_up_dimension;
  if (!dimension) return null;

  const leaders = {
    resale_value: pickScoreLeader(vehicles, "resale_score"),
    ownership_cost: pickScoreLeader(vehicles, "maintenance_score"),
    safety: pickScoreLeader(vehicles, "safety_score"),
    comfort: pickScoreLeader(vehicles, "comfort_score"),
    technology: pickScoreLeader(vehicles, "technology_score"),
    performance: pickScoreLeader(vehicles, "performance_score"),
    practicality: pickScoreLeader(vehicles, "practicality_score"),
    efficiency: pickScoreLeader(vehicles, "efficiency_score"),
  };

  const leader = leaders[dimension] ?? null;
  const runnerUp = leader ? vehicles.find((item) => item.name !== leader.name) ?? null : null;
  const reasonMap = {
    resale_value: "resale outlook",
    ownership_cost: "ownership cost and maintenance burden",
    safety: "safety confidence",
    comfort: "comfort and day-to-day refinement",
    technology: "technology and cabin features",
    performance: "performance and response",
    practicality: "space and practical usability",
    efficiency: "fuel or energy efficiency",
  };
  const reasonLabel = reasonMap[dimension] ?? "this dimension";

  if (!leader) return null;

  const leaderReason = trimInsight(leader.pros?.[0]) || trimInsight(structuredResult.recommendation?.reason);
  const runnerUpReason = trimInsight(runnerUp?.pros?.[0]);

  return {
    final_answer: [
      `For ${reasonLabel}, ${leader.name} has the clearer edge.`,
      leaderReason ? `Main reason: ${leaderReason}.` : null,
      runnerUp?.name
        ? `${runnerUp.name} is the better alternative only if you care more about ${lowerFirst(runnerUpReason || "its specific strengths")}.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    concise_summary: `${reasonLabel}: ${leader.name}`,
  };
}

function formatComparison(structuredResult, turnContext = {}) {
  const focused = formatFocusedComparison(structuredResult, turnContext);
  if (focused) return focused;

  const winner = structuredResult.recommendation?.winner;
  const reason = structuredResult.recommendation?.reason;
  const vehicles = structuredResult.vehicles ?? [];
  const runnerUp = vehicles.find((item) => item.name !== winner) ?? null;
  const practicalityLeader = pickScoreLeader(vehicles, "practicality_score")?.name;
  const comfortLeader = pickScoreLeader(vehicles, "comfort_score")?.name;
  const resaleLeader = pickScoreLeader(vehicles, "resale_score")?.name;
  const efficiencyLeader = pickScoreLeader(vehicles, "efficiency_score")?.name;
  const winnerPros = pickHighlights(vehicles.find((item) => item.name === winner)?.pros);
  const winnerCons = pickHighlights(vehicles.find((item) => item.name === winner)?.cons, 1);
  const runnerUpPros = pickHighlights(runnerUp?.pros, 1);
  const headlineReason = trimInsight(reason) || trimInsight(winnerPros[0]) || trimInsight(winnerCons[0]);
  const alternativeReason =
    trimInsight(runnerUpPros[0]) ||
    (runnerUp?.name && practicalityLeader === runnerUp.name ? "extra practicality" : null) ||
    (runnerUp?.name && comfortLeader === runnerUp.name ? "extra comfort" : null) ||
    (runnerUp?.name && resaleLeader === runnerUp.name ? "stronger resale" : null) ||
    (runnerUp?.name && efficiencyLeader === runnerUp.name ? "better efficiency" : null);

  return {
    final_answer: [
      winner ? `${winner} is the better overall pick.` : "I could not produce a trustworthy winner yet.",
      headlineReason ? `Why: ${headlineReason}.` : null,
      runnerUp?.name
        ? `${runnerUp.name} is the better alternative if you care more about ${lowerFirst(alternativeReason || "its specific strengths")}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
    concise_summary: winner ? `Verdict: ${winner}` : "Verdict unavailable",
  };
}

function formatValuation(structuredResult) {
  const range = formatRange(structuredResult.current_fair_value_range);
  const factors = pickHighlights(structuredResult.factors, 3);
  const confidence = structuredResult.confidence?.label ?? "Unspecified confidence";

  if (!range?.sentence) {
    return {
      final_answer:
        "I could not ground a fair-value estimate strongly enough to give you a trustworthy pricing band yet.",
      concise_summary: "Fair value unavailable",
    };
  }

  const sentences = [
    `The best grounded fair-value estimate is ${range.sentence}.`,
    `${confidence}.`,
  ];

  if (factors.length > 0) {
    sentences.push(`The main pricing drivers are ${factors.join(", ")}.`);
  }

  sentences.push("Treat this as a pricing range, not a fake exact number.");

  return {
    final_answer: sentences.join(" ").trim(),
    concise_summary: range.midpoint ? `Fair value midpoint: ${range.midpoint}` : "Fair value available",
  };
}

function formatForecast(structuredResult) {
  const range = formatRange(structuredResult.forecast_range);
  const factors = pickHighlights(structuredResult.factors, 3);
  const confidence = structuredResult.confidence?.label ?? "Confidence not specified";
  const scarcity = structuredResult.scarcity_signal ? `Scarcity signal: ${structuredResult.scarcity_signal}.` : null;

  if (!range?.sentence) {
    return {
      final_answer:
        "I can describe the market direction, but the current evidence is not strong enough to express a reliable future value band yet.",
      concise_summary: scarcity || "Forecast limited",
    };
  }

  return {
    final_answer: [
      `The current market outlook points to ${range.sentence} over the selected forecast horizon.`,
      scarcity,
      factors.length > 0 ? `The biggest forecast drivers are ${factors.join(", ")}.` : null,
      `${confidence}.`,
      "Use the trend direction and confidence more than the exact midpoint.",
    ]
      .filter(Boolean)
      .join(" "),
    concise_summary: scarcity || `Forecast midpoint: ${range.midpoint || "available"}`,
  };
}

function formatTco(structuredResult) {
  const totals = structuredResult.totals;
  const assumptions = structuredResult.assumptions ?? [];
  const total = formatMoney(totals?.total, totals?.currency);
  const monthly = formatMoney(totals?.monthly_average, totals?.currency);
  const yearly = formatMoney(totals?.yearly_average, totals?.currency);
  const basePrice = formatMoney(structuredResult.one_time_costs?.base_price, totals?.currency);
  const registrationTax = formatMoney(structuredResult.one_time_costs?.registration_tax, totals?.currency);
  const insurance = formatMoney(structuredResult.recurring_costs?.insurance_total, totals?.currency);
  const maintenance = formatMoney(structuredResult.recurring_costs?.maintenance_total, totals?.currency);

  if (!total) {
    const missingTaxConfig = assumptions.some((item) => /tax|market|configuration|rule/i.test(item.label));
    return {
      final_answer:
        missingTaxConfig
          ? "I’m missing enough market tax and fee data to produce a full ownership-cost estimate for that vehicle right now. If you confirm the country and vehicle, I can still guide you with the safest partial estimate available."
          : "I could not build a complete ownership-cost estimate yet because too many required TCO inputs are still missing.",
      concise_summary: "TCO unavailable",
    };
  }

  return {
    final_answer: [
      `Your estimated ownership cost over ${totals.ownership_years} year(s) is about ${total}.`,
      monthly ? `That works out to roughly ${monthly} per month` : null,
      yearly ? `or ${yearly} per year.` : null,
      basePrice ? `Purchase base used: ${basePrice}.` : null,
      registrationTax ? `Registration tax estimate: ${registrationTax}.` : null,
      insurance || maintenance
        ? `Recurring cost drivers include ${[insurance ? `insurance at ${insurance}` : null, maintenance ? `maintenance at ${maintenance}` : null]
            .filter(Boolean)
            .join(" and ")}.`
        : null,
      "This is an ownership estimate, so the assumptions matter as much as the final total.",
    ]
      .filter(Boolean)
      .join(" "),
    concise_summary: `TCO total: ${total}`,
  };
}

function formatKnowledge(structuredResult) {
  const highlights = pickHighlights(structuredResult.highlights, 3);
  return {
    final_answer:
      highlights.length > 0
        ? `${structuredResult.direct_answer} Key points: ${highlights.join("; ")}.`
        : structuredResult.direct_answer,
    concise_summary: structuredResult.topic ? `Topic: ${structuredResult.topic}` : null,
  };
}

function formatRecommendation(structuredResult) {
  const top = structuredResult.ranked_vehicles?.[0];
  const second = structuredResult.ranked_vehicles?.[1];

  if (!top) {
    return {
      final_answer: "I do not have enough grounded buyer-profile detail yet to recommend the right car confidently.",
      concise_summary: "Recommendation unavailable",
    };
  }

  return {
    final_answer: [
      `Top pick: ${top.name}${top.fit_label ? ` (${top.fit_label.toLowerCase()})` : ""}.`,
      top.reasons.length > 0 ? `Why it fits: ${top.reasons.slice(0, 2).join("; ")}.` : null,
      top.caveats?.length > 0 ? `Watch-out: ${top.caveats[0]}.` : null,
      second
        ? `Alternative: ${second.name}${second.why_this_over_alternatives ? ` if you care more about ${second.why_this_over_alternatives.replace(/^looks better if you care more about /, "")}` : second.reasons?.[0] ? ` if you want ${second.reasons[0]}` : ""}.`
        : null,
      structuredResult.profile_summary ? `Profile used: ${structuredResult.profile_summary}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    concise_summary: `Top recommendation: ${top.name}`,
  };
}

export function formatFinalAnswer({ intent, structured_result, policy_response, turn_context = {} }) {
  if (policy_response?.final_answer) {
    return {
      final_answer: policy_response.final_answer,
      concise_summary: policy_response.follow_up ?? null,
    };
  }

  if (!structured_result) {
    return {
      final_answer: "I need a bit more information before I can give you a grounded automotive answer.",
      concise_summary: null,
    };
  }

  if (intent === "compare_car") return formatComparison(structured_result, turn_context);
  if (intent === "predict_vehicle_value") return formatValuation(structured_result);
  if (intent === "market_trend_analysis") return formatForecast(structured_result);
  if (intent === "calculate_tco") return formatTco(structured_result);
  if (intent === "vehicle_general_qa") return formatKnowledge(structured_result);
  if (intent === "recommend_car") return formatRecommendation(structured_result);

  return {
    final_answer: "I can help best with vehicle questions, comparison, pricing, forecasting, and ownership costs.",
    concise_summary: null,
  };
}
