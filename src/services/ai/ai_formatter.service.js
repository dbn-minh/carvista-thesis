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

function formatComparison(structuredResult) {
  const winner = structuredResult.recommendation?.winner;
  const reason = structuredResult.recommendation?.reason;
  const vehicles = structuredResult.vehicles ?? [];
  const runnerUp = vehicles.find((item) => item.name !== winner) ?? null;
  const practicalityLeader = pickScoreLeader(vehicles, "practicality_score")?.name;
  const comfortLeader = pickScoreLeader(vehicles, "comfort_score")?.name;
  const resaleLeader = pickScoreLeader(vehicles, "resale_score")?.name;
  const winnerPros = pickHighlights(vehicles.find((item) => item.name === winner)?.pros);
  const runnerUpPros = pickHighlights(runnerUp?.pros, 1);

  const sentences = [];
  if (winner) {
    sentences.push(`${winner} is the stronger overall choice here.`);
  } else {
    sentences.push("I could not produce a trustworthy comparison winner yet.");
  }
  if (reason) {
    sentences.push(reason);
  }
  if (winnerPros.length > 0) {
    sentences.push(`Its biggest strengths in this comparison are ${winnerPros.join(" and ")}.`);
  }
  if (runnerUp?.name) {
    sentences.push(
      `${runnerUp.name} still makes sense if you care more about ${runnerUpPros[0] || "its specific strengths"}.`
    );
  }

  const tradeOffs = [
    practicalityLeader ? `Practicality edge: ${practicalityLeader}` : null,
    comfortLeader ? `Comfort edge: ${comfortLeader}` : null,
    resaleLeader ? `Resale edge: ${resaleLeader}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (tradeOffs) {
    sentences.push(tradeOffs + ".");
  }

  return {
    final_answer: sentences.join(" ").trim(),
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
      `${top.name} looks like the strongest fit for the profile you shared.`,
      top.reasons.length > 0 ? `The main reasons are that it ${top.reasons.join(", ")}.` : null,
      second ? `A close alternative is ${second.name} if you want a slightly different balance.` : null,
      structuredResult.profile_summary ? `Current profile used: ${structuredResult.profile_summary}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    concise_summary: `Top recommendation: ${top.name}`,
  };
}

export function formatFinalAnswer({ intent, structured_result, policy_response }) {
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

  if (intent === "compare_car") return formatComparison(structured_result);
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
