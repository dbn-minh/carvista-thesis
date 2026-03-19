export function routeIntent(intentResult) {
  const { intent } = intentResult;

  const routes = {
    compare_car: { service: "ComparisonService", formatter: "comparison" },
    predict_vehicle_value: { service: "ValuationService", formatter: "valuation" },
    market_trend_analysis: { service: "ForecastService", formatter: "forecast" },
    calculate_tco: { service: "TCOService", formatter: "tco" },
    vehicle_general_qa: { service: "VehicleKnowledgeService", formatter: "knowledge" },
    recommend_car: { service: "RecommendationService", formatter: "recommendation" },
    small_talk: { service: "ConversationPolicyService", formatter: "small_talk" },
    out_of_scope: { service: "ConversationPolicyService", formatter: "out_of_scope" },
    unknown: { service: "ConversationPolicyService", formatter: "unknown" },
  };

  return routes[intent] ?? routes.unknown;
}
