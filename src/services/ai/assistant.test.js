import assert from "node:assert/strict";
import test from "node:test";
import { orchestrateChatRequest } from "./chat_orchestrator.service.js";
import { chatAdvisor } from "./car_advisor_chat.service.js";
import { mapAiChatErrorToResponse } from "./error_mapper.service.js";
import { classifyIntent } from "./intent_classifier.service.js";
import { classifyConversationRoute } from "./conversation_orchestrator.service.js";
import { classifyConversationTurn } from "./conversation_state.service.js";
import { compareVariants } from "./compare_variants.service.js";
import { generateComparisonInsight } from "./ai_insight.service.js";
import {
  fetchOfficialVehicleSignals,
  loadListingMarketSignals,
  loadVariantContext,
  normalizeVariantPriceHistoryRows,
} from "./source_retrieval.service.js";
import { recommendCars } from "./recommendation.service.js";
import { calculateTco } from "./tco.service.js";
import { predictPrice } from "./predict_price.service.js";

process.env.NODE_ENV = "test";

const menuXml = `<?xml version="1.0" encoding="UTF-8"?><menuItems><menuItem><text>Auto</text><value>42015</value></menuItem></menuItems>`;
const vehicleXml = `<?xml version="1.0" encoding="UTF-8"?><vehicle><comb08>34</comb08><city08>29</city08><highway08>41</highway08><fuelCost08>1300</fuelCost08><fuelType1>Regular Gasoline</fuelType1><drive>Front-Wheel Drive</drive><VClass>Midsize Cars</VClass></vehicle>`;
const recallsPayload = {
  results: [
    {
      NHTSACampaignNumber: "23V865000",
      Component: "AIR BAGS",
      Summary: "Sample recall summary",
      Consequence: "Sample consequence",
      Remedy: "Sample remedy",
    },
  ],
};

function mockFetchFactory() {
  return async function mockFetch(url) {
    const value = String(url);
    if (value.includes("menu/options")) {
      return { ok: true, text: async () => menuXml };
    }
    if (value.includes("/vehicle/")) {
      return { ok: true, text: async () => vehicleXml };
    }
    if (value.includes("recallsByVehicle")) {
      return { ok: true, text: async () => JSON.stringify(recallsPayload) };
    }
    throw new Error(`Unexpected URL: ${value}`);
  };
}

function extractPolicyPayload(prompt) {
  const match = String(prompt || "").match(/policy_insight_payload_json:\s*([\s\S]*?)\nemergency_fallback_text:/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function policyInsightSummary(payload, callCount = 1) {
  const message = String(payload.userMessage || "");
  if (/iphone/i.test(message)) {
    return callCount > 1
      ? "If you mean iPhone as a device choice, compare camera, battery, storage, repair cost, and how long you plan to keep it. For CarVista, the useful vehicle angle is phone integration: Apple CarPlay, infotainment responsiveness, wireless charging, and cabin connectivity. CarVista Advisor's main job is helping you choose, compare, price, and evaluate vehicles, so I can use those tech preferences when recommending cars."
      : "For iPhone buying, start with the practical fit: budget, battery life, camera needs, storage, and whether you prefer a compact or large screen. If this connects to your car search, iPhone users usually care about Apple CarPlay, wireless charging, infotainment quality, and cabin connectivity. CarVista Advisor's main purpose is vehicle recommendations, comparison, pricing, and ownership guidance, so I can translate those tech needs into a better car shortlist.";
  }
  if (/ocr/i.test(message)) {
    return "A compact OCR prototype in Python can use OpenCV for cleanup and pytesseract for text extraction: import cv2; import pytesseract; img = cv2.imread('document.jpg'); gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); text = pytesseract.image_to_string(gray). For a real app, add preprocessing, confidence checks, and field validation. If the OCR target is vehicle-related, the same flow can read VINs, license plates, window stickers, invoices, or service records. CarVista Advisor's main purpose is helping users choose, compare, price, and evaluate vehicles, so OCR output can later support recommendations and ownership-cost analysis.";
  }
  if (/python|code/i.test(message)) {
    return "Here is a tiny Python-style example: def normalize_text(value): return ' '.join(str(value).strip().split()).lower(). You can adapt that pattern before sending text into OCR, search, or classification logic. If the code is for a vehicle workflow, it can help clean VIN data, estimate payments, compare fuel costs, or prepare listing information. CarVista Advisor's main purpose is vehicle recommendations, comparison, pricing, and ownership guidance, so I can connect the script to car-shopping decisions afterward.";
  }
  if (/saas|crm|software|startup|b2b/i.test(message)) {
    return "A practical B2B SaaS product idea is a lightweight CRM that captures leads, tracks follow-ups, scores prospects, and summarizes next actions for a small sales team. The MVP could include contact records, pipeline stages, reminders, email templates, and a simple dashboard. If this is automotive-adjacent, the same idea could become dealership CRM, fleet lead tracking, inventory follow-up, or auto-sales workflow software. CarVista Advisor's main purpose is helping users choose, compare, price, and evaluate vehicles, so I can connect business tooling back to vehicle recommendations or dealership workflows when needed.";
  }
  if (/asdf|qwer|random/i.test(message)) {
    return "I'm not sure what you are looking for yet. Share a vehicle use case, budget, body type, fuel preference, or must-have features and I will help narrow down options. My main goal is to help you find and compare the right vehicle.";
  }
  return "I can help best with vehicle recommendations, comparisons, pricing, and ownership costs. What car-shopping decision should we focus on?";
}

function buildPolicyInsightOllama() {
  const calls = [];
  return {
    provider: "fpt",
    apiKey: "test-key",
    model: "Qwen3:32B",
    calls,
    async generate(request) {
      calls.push(request);
      const payload = extractPolicyPayload(request.prompt);
      return {
        text: JSON.stringify({
          summary: policyInsightSummary(payload, calls.length),
          reasons: [],
          caveats: [],
          advice: "",
        }),
      };
    },
  };
}

test("conversation router distinguishes vehicle advice from off-topic chat", () => {
  assert.equal(classifyConversationRoute("How reliable is this car on long trips?", { focus_variant_id: 7 }), "vehicle_question");
  assert.equal(classifyConversationRoute("What is the weather today?"), "off_topic");
  assert.equal(classifyConversationRoute("Who won the World Cup?"), "off_topic");
  assert.equal(classifyConversationRoute("Give me a PRoduct B2B SaaS"), "off_topic");
  assert.equal(classifyConversationRoute("Recommend a CRM for my startup"), "off_topic");
  assert.equal(classifyConversationRoute("I need software for my dealership"), "ambiguous_automotive_business");
  assert.equal(classifyConversationRoute("asdf qwer random"), "low_signal");
  assert.equal(classifyConversationRoute("Compare these two cars for me"), "compare");
});

test("advisor delegates off-topic policy wording to Qwen insight", async () => {
  const ollama = buildPolicyInsightOllama();
  const ctx = { services: { ollama } };
  const product = await orchestrateChatRequest(ctx, { message: "Give me a PRoduct B2B SaaS" });
  assert.equal(product.intent, "out_of_scope");
  assert.equal(product.needs_clarification, true);
  assert.equal(product.meta.aiUsed, true);
  assert.equal(product.structured_result?.classification?.intent, "OFF_TOPIC_BRIDGEABLE");
  assert.equal(product.structured_result?.classification?.topicCategory, "saas/software/business_tools");
  assert.equal(product.result_confidence?.label, "Needs clarification");
  assert.match(product.final_answer, /B2B SaaS|CRM|MVP|pipeline/i);
  assert.match(product.final_answer, /dealership|fleet|auto-sales|vehicle/i);
  assert.match(product.final_answer, /CarVista Advisor's main purpose|choose, compare, price, and evaluate vehicles/i);

  const crm = await orchestrateChatRequest(ctx, { message: "Recommend a CRM for my startup" });
  assert.equal(crm.intent, "out_of_scope");
  assert.equal(crm.result_confidence?.label, "Needs clarification");
  assert.match(crm.final_answer, /CRM|pipeline|follow-ups|sales team/i);
  assert.match(crm.final_answer, /dealership|fleet|auto-sales|vehicle/i);
});

test("advisor lets Qwen answer common off-topic prompts before bridging back", async () => {
  const ollama = buildPolicyInsightOllama();
  const ctx = { services: { ollama } };

  const phone = await orchestrateChatRequest(ctx, { message: "iphone" });
  assert.equal(phone.intent, "out_of_scope");
  assert.equal(phone.result_confidence?.label, "Needs clarification");
  assert.match(phone.final_answer, /iPhone/i);
  assert.match(phone.final_answer, /battery|camera|storage|screen/i);
  assert.match(phone.final_answer, /CarPlay|infotainment|wireless charging|phone integration|connectivity/i);

  const code = await orchestrateChatRequest(ctx, { message: "give me python code" });
  assert.equal(code.intent, "out_of_scope");
  assert.match(code.final_answer, /def normalize_text|Python-style|code/i);
  assert.match(code.final_answer, /VIN|payment|fuel|vehicle data/i);

  const python = await orchestrateChatRequest(ctx, { message: "Python" });
  assert.equal(python.intent, "out_of_scope");
  assert.equal(python.meta.aiUsed, true);
  assert.doesNotMatch(python.final_answer, /I can help best with car recommendations/i);
  assert.match(python.final_answer, /def normalize_text|Python-style|code/i);

  const ocr = await orchestrateChatRequest(ctx, { message: "\u0110ua toi mot doan python code de OCR" });
  assert.equal(ocr.intent, "out_of_scope");
  assert.match(ocr.final_answer, /OCR/i);
  assert.match(ocr.final_answer, /pytesseract|cv2|image_to_string/i);
  assert.match(ocr.final_answer, /VIN|license plates|window stickers|invoices|service records/i);
});

test("advisor answers automotive-business prompts and clarifies low-signal prompts", async () => {
  const ollama = buildPolicyInsightOllama();
  const ctx = { services: { ollama } };
  const dealership = await orchestrateChatRequest(ctx, { message: "I need software for my dealership" });
  assert.equal(dealership.intent, "out_of_scope");
  assert.equal(dealership.needs_clarification, true);
  assert.equal(dealership.meta.aiUsed, true);
  assert.equal(dealership.structured_result?.classification?.intent, "AUTOMOTIVE_ADJACENT");
  assert.match(dealership.final_answer, /dealership|fleet|auto-sales|vehicle/i);
  assert.match(dealership.final_answer, /CRM|MVP|dashboard|pipeline/i);
  assert.match(dealership.final_answer, /CarVista Advisor's main purpose|choose, compare, price, and evaluate vehicles/i);
  assert.equal(dealership.result_confidence?.label, "Needs clarification");

  const nonsense = await orchestrateChatRequest(ctx, { message: "asdf qwer random" });
  assert.equal(nonsense.intent, "unknown");
  assert.equal(nonsense.needs_clarification, true);
  assert.equal(nonsense.structured_result?.classification?.intent, "LOW_SIGNAL_OR_NONSENSE");
  assert.match(nonsense.final_answer, /not sure|unclear/i);
  assert.match(nonsense.final_answer, /use case|budget|body type|fuel/i);
  assert.equal(nonsense.result_confidence?.label, "Needs clarification");

  const carRequest = classifyIntent("Need an SUV for family use under 40k", {});
  assert.equal(carRequest.intent, "recommend_car");
  assert.equal(carRequest.needs_clarification, false);

  const lowMaintenanceRequest = classifyIntent("Need an SUV for family use under 40k, low maintenance", {});
  assert.equal(lowMaintenanceRequest.intent, "recommend_car");
  assert.equal(lowMaintenanceRequest.needs_clarification, false);
});

test("repeated off-topic prompts can vary when Qwen insight is available", async () => {
  const ollama = buildPolicyInsightOllama();
  const ctx = { services: { ollama } };

  const first = await orchestrateChatRequest(ctx, { message: "iphone" });
  const second = await orchestrateChatRequest(ctx, { message: "iphone" });

  assert.equal(first.meta.aiUsed, true);
  assert.equal(second.meta.aiUsed, true);
  assert.notEqual(first.final_answer, second.final_answer);
});

test("conversation turn routes car-shopping requests away from off-topic state", () => {
  const message = "de xuat xe cho toi";
  const preview = classifyIntent(message, { market_id: 1, advisor_profile: {} });
  const turn = classifyConversationTurn({
    message,
    pendingFlow: { intent: "out_of_scope", missing_fields: [] },
    previewIntent: preview.intent,
    previewEntities: preview.entities,
    activeTopic: { intent: "out_of_scope" },
    conversationState: { active_intent: "out_of_scope" },
  });

  assert.equal(preview.intent, "recommend_car");
  assert.equal(turn.turn_type, "new_topic");
  assert.equal(turn.effective_intent, "recommend_car");
  assert.equal(turn.should_preserve_topic, false);
  assert.equal(turn.should_clear_stale_result, true);
  assert.deepEqual(turn.notes, ["policy_to_vehicle_task_handoff"]);
});

test("chat advisor returns to catalog recommendations with listing links after an off-topic detour", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 700;
  const ollama = buildPolicyInsightOllama();
  const ctx = {
    services: { ollama },
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 7,
              model_year: 2024,
              trim_name: "Hybrid Premium",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 35000,
              model_name: "Corolla Cross",
              make_name: "Toyota",
              latest_price: 34000,
              active_listing_count: 2,
            },
            {
              variant_id: 9,
              model_year: 2024,
              trim_name: "Touring",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 33000,
              model_name: "Civic",
              make_name: "Honda",
              latest_price: 33000,
              active_listing_count: 1,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews")) {
          return [[
            { variant_id: 7, avg_rating: 4.6, review_count: 12 },
            { variant_id: 9, avg_rating: 4.1, review_count: 7 },
          ]];
        }

        if (sql.includes("FROM vehicle_market_signals")) {
          return [[
            {
              variant_id: 7,
              active_listing_count: 2,
              avg_asking_price: 34000,
              price_spread_pct: 0.07,
              scarcity_score: 0.62,
              data_confidence: 0.83,
            },
          ]];
        }

        throw new Error(`Unexpected SQL in off-topic handoff test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: ++sessionIdCounter,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
      Listings: {
        async findAll() {
          return [
            { listing_id: 101, variant_id: 7 },
            { listing_id: 102, variant_id: 7 },
            { listing_id: 205, variant_id: 9 },
          ];
        },
      },
      VariantImages: {
        async findAll() {
          return [
            { variant_id: 7, url: "/images/corolla-cross.jpg", sort_order: 0 },
            { variant_id: 9, url: "/images/civic.jpg", sort_order: 0 },
          ];
        },
      },
    },
  };

  const detour = await chatAdvisor(ctx, {
    user_id: 42,
    message: "iphone",
    context: { market_id: 1 },
  });
  assert.equal(detour.intent, "out_of_scope");
  assert.equal(detour.needs_clarification, true);

  const recommendation = await chatAdvisor(ctx, {
    session_id: detour.session_id,
    user_id: 42,
    message: "Need an SUV for family use under 40k, low maintenance",
    context: { market_id: 1 },
  });

  assert.equal(recommendation.intent, "recommend_car");
  assert.equal(recommendation.needs_clarification, false);
  assert.equal(recommendation.meta?.turn_type, "new_topic");
  assert.equal(recommendation.meta?.context_transition?.preserve_topic, false);
  assert.equal(recommendation.structured_result?.recommendation_mode, "backend_catalog_ranked");
  assert.equal(recommendation.cards[0]?.href, "/catalog/7");
  assert.ok(recommendation.cards[0]?.action?.payload?.url?.includes("/catalog/7"));
  assert.ok(recommendation.structured_result?.ranked_vehicles?.[0]?.links?.related_listings_url?.includes("variantId=7"));
  assert.deepEqual(recommendation.structured_result?.ranked_vehicles?.[0]?.links?.related_listing_ids, [101, 102]);
  assert.equal(sessions[0].context_json.conversation_state.active_intent, "recommend_car");
  assert.deepEqual(sessions[0].context_json.conversation_state.referenced_listing_ids, [101, 102, 205]);
});

test("intent classifier reuses stored advisor profile budget for recommendation routing", () => {
  const result = classifyIntent("I want a family SUV", {
    advisor_profile: { budget_max: 900000000 },
  });

  assert.equal(result.intent, "recommend_car");
  assert.equal(result.entities.budget, 900000000);
  assert.equal(result.needs_clarification, false);
});

test("conversation turn classifier binds pending clarification replies before treating them as new requests", () => {
  const turn = classifyConversationTurn({
    message: "BMW X5",
    pendingFlow: {
      intent: "compare_car",
      missing_fields: ["vehicles"],
    },
    previewIntent: "unknown",
    previewEntities: {
      vehicles: ["BMW X5"],
      country: null,
      budget: null,
      ownership_period_years: null,
      annual_mileage_km: null,
    },
    activeTopic: {
      intent: "compare_car",
      focus_variant_id: 7,
      compare_variant_ids: [7],
    },
    conversationState: {
      active_intent: "compare_car",
      referenced_vehicle_ids: [7],
    },
    hasVehicleMentions: true,
  });

  assert.equal(turn.turn_type, "clarification_response");
  assert.equal(turn.bind_pending_flow, true);
  assert.equal(turn.effective_intent, "compare_car");
});

test("conversation turn classifier keeps resale follow-ups inside the active comparison topic", () => {
  const turn = classifyConversationTurn({
    message: "What about resale value?",
    previewIntent: "predict_vehicle_value",
    previewEntities: {
      vehicles: [],
      country: null,
      budget: null,
      ownership_period_years: null,
      annual_mileage_km: null,
    },
    activeTopic: {
      intent: "compare_car",
      focus_variant_id: 7,
      compare_variant_ids: [7, 9],
    },
    conversationState: {
      active_intent: "compare_car",
      referenced_vehicle_ids: [7, 9],
    },
  });

  assert.equal(turn.turn_type, "follow_up");
  assert.equal(turn.effective_intent, "compare_car");
  assert.equal(turn.follow_up_dimension, "resale_value");
});

test("conversation turn classifier detects skill switches that stay linked to the same vehicle topic", () => {
  const turn = classifyConversationTurn({
    message: "Now calculate TCO for the X5 in Vietnam",
    previewIntent: "calculate_tco",
    previewEntities: {
      vehicles: ["BMW X5"],
      country: "Vietnam",
      budget: null,
      ownership_period_years: null,
      annual_mileage_km: null,
    },
    activeTopic: {
      intent: "recommend_car",
      focus_variant_id: 2,
    },
    conversationState: {
      active_intent: "recommend_car",
      referenced_vehicle_ids: [2, 3, 4],
    },
    hasVehicleMentions: true,
  });

  assert.equal(turn.turn_type, "skill_switch_same_topic");
  assert.equal(turn.effective_intent, "calculate_tco");
});

test("conversation turn classifier detects task replacement for compare flows", () => {
  const turn = classifyConversationTurn({
    message: "Actually compare Civic and Corolla instead",
    previewIntent: "compare_car",
    previewEntities: {
      vehicles: ["Honda Civic", "Toyota Corolla"],
      country: null,
      budget: null,
      ownership_period_years: null,
      annual_mileage_km: null,
    },
    activeTopic: {
      intent: "compare_car",
      focus_variant_id: 7,
      compare_variant_ids: [7, 9],
    },
    conversationState: {
      active_intent: "compare_car",
      referenced_vehicle_ids: [7, 9],
    },
    hasVehicleMentions: true,
  });

  assert.equal(turn.turn_type, "task_replacement");
  assert.equal(turn.should_replace_active_task, true);
  assert.equal(turn.should_clear_stale_result, true);
});

test("official fallback retrieval parses FuelEconomy.gov and NHTSA payloads", async () => {
  const originalFetch = global.fetch;
  global.fetch = mockFetchFactory();

  try {
    const result = await fetchOfficialVehicleSignals({
      year: 2020,
      make: "Toyota",
      model: "Camry",
    });

    assert.equal(result.fuel_economy.combined_mpg, 34);
    assert.equal(result.fuel_economy.city_mpg, 29);
    assert.equal(result.recalls.length, 1);
    assert.equal(result.sources.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("official stored signals accept Date objects in retrieved_at without breaking TCO sources", async () => {
  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM vehicle_fuel_economy_snapshots")) {
          return [[
            {
              combined_mpg: 33,
              city_mpg: 28,
              highway_mpg: 39,
              annual_fuel_cost_usd: 1350,
              fuel_type: "Gasoline",
              drive: "FWD",
              class_name: "Compact SUV",
              provider_key: "internal_marketplace",
              source_type: "internal_marketplace",
              title: "Persisted fuel snapshot",
              url: null,
              trust_level: "high",
              retrieved_at: new Date("2026-04-12T01:23:45.000Z"),
              notes: null,
            },
          ]];
        }
        if (sql.includes("FROM vehicle_recall_snapshots")) {
          return [[
            {
              campaign_number: "24V000001",
              component: "BRAKES",
              summary: "Sample recall",
              consequence: "Reduced braking performance",
              remedy: "Dealer inspection",
              provider_key: "nhtsa",
              source_type: "official_api",
              title: "Persisted recall snapshot",
              url: "https://example.com/recall",
              trust_level: "high",
              retrieved_at: new Date("2026-04-11T10:00:00.000Z"),
              notes: null,
            },
          ]];
        }
        return [[]];
      },
    },
  };

  const result = await fetchOfficialVehicleSignals({
    ctx,
    variant_id: 9,
    year: 2023,
    make: "Hyundai",
    model: "Tucson",
  });

  assert.equal(result.fuel_economy.combined_mpg, 33);
  assert.equal(result.recalls.length, 1);
  assert.equal(result.sources.length, 2);
  assert.match(result.sources[0].retrieved_at, /^2026-04-12T01:23:45.000Z$/);
});

test("normalizeVariantPriceHistoryRows keeps the latest window and removes same-day source duplicates", () => {
  const rows = [
    { price_id: 1, captured_at: "2026-01-01T00:00:00.000Z", price: "1000000000.00", source: "local_seed_history_v1" },
    { price_id: 2, captured_at: "2026-02-01T00:00:00.000Z", price: "980000000.00", source: "local_seed_history_v1" },
    { price_id: 3, captured_at: "2026-03-01T00:00:00.000Z", price: "960000000.00", source: "local_seed_history_v1" },
    { price_id: 4, captured_at: "2026-03-01T00:00:00.000Z", price: "910000000.00", source: "internal_marketplace_rollup" },
    { price_id: 5, captured_at: "2026-04-01T00:00:00.000Z", price: "940000000.00", source: "local_seed_history_v1" },
    { price_id: 6, captured_at: "2026-04-01T00:00:00.000Z", price: "920000000.00", source: "bootstrap_seed_rollup" },
  ];

  const normalized = normalizeVariantPriceHistoryRows(rows, { limit: 3 });

  assert.deepEqual(
    normalized.map((row) => row.captured_at),
    [
      "2026-02-01T00:00:00.000Z",
      "2026-03-01T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z",
    ]
  );
  assert.equal(normalized[1].source, "internal_marketplace_rollup");
  assert.equal(normalized[1].price, "910000000.00");
  assert.equal(normalized[2].source, "bootstrap_seed_rollup");
  assert.equal(normalized[2].price, "920000000.00");
});

test("loadVariantContext uses the latest canonical price history window for downstream pricing", async () => {
  const variantRow = {
    variant_id: 9,
    model_id: 10,
    model_year: 2023,
    trim_name: "1.6 Turbo",
    body_type: "suv",
    fuel_type: "gasoline",
    engine: "1.6T",
    transmission: "AT",
    drivetrain: "FWD",
    seats: 5,
    doors: 5,
    msrp_base: 1100000000,
    model_name: "Tucson",
    make_name: "Hyundai",
    latest_price: 1234567890,
  };

  const historyRows = Array.from({ length: 40 }, (_, index) => {
    const capturedAt = new Date(Date.UTC(2023, index, 1)).toISOString();
    return {
      toJSON: () => ({
        price_id: index + 1,
        variant_id: 9,
        market_id: 1,
        price_type: "avg_market",
        price: String(1300000000 - index * 10000000),
        captured_at: capturedAt,
        source: "local_seed_history_v1",
      }),
    };
  });

  historyRows.push({
    toJSON: () => ({
      price_id: 999,
      variant_id: 9,
      market_id: 1,
      price_type: "avg_market",
      price: "905000000",
      captured_at: new Date(Date.UTC(2026, 3, 1)).toISOString(),
      source: "internal_marketplace_rollup",
    }),
  });

  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) return [[variantRow]];
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    models: {
      VariantSpecs: { findOne: async () => null },
      VariantSpecKv: { findAll: async () => [] },
      CarReviews: { findAll: async () => [] },
      VariantPriceHistory: { findAll: async () => historyRows },
    },
  };

  const context = await loadVariantContext(ctx, { variant_id: 9, market_id: 1 });

  assert.equal(context.price_history.length, 36);
  assert.equal(context.price_history[0].captured_at, new Date(Date.UTC(2023, 4, 1)).toISOString());
  assert.equal(context.price_history.at(-1)?.captured_at, new Date(Date.UTC(2026, 3, 1)).toISOString());
  assert.equal(context.price_history.at(-1)?.source, "internal_marketplace_rollup");
  assert.equal(context.variant.latest_price, 905000000);
});

test("compare engine returns source-aware verdict with buyer-profile fit", async () => {
  const originalFetch = global.fetch;
  global.fetch = mockFetchFactory();

  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv") && sql.includes("WHERE cv.variant_id IN")) {
          return [[
            {
              variant_id: 1,
              model_id: 10,
              model_year: 2024,
              trim_name: "Urban Hybrid",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              doors: 5,
              msrp_base: 980000000,
              model_name: "Crossline",
              make_name: "Toyota",
            },
            {
              variant_id: 2,
              model_id: 11,
              model_year: 2024,
              trim_name: "Sport Sedan",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "2.0T",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              doors: 4,
              msrp_base: 1040000000,
              model_name: "Velocity",
              make_name: "Honda",
            },
          ]];
        }

        if (sql.includes("FROM car_reviews")) {
          return [[
            { variant_id: 1, avg_rating: 4.5, review_count: 8 },
            { variant_id: 2, avg_rating: 3.8, review_count: 6 },
          ]];
        }

        if (sql.includes("FROM variant_price_history")) {
          return [[
            { variant_id: 1, price: 950000000 },
            { variant_id: 2, price: 1020000000 },
          ]];
        }

        throw new Error(`Unexpected SQL path: ${sql}`);
      },
    },
    models: {
      VariantSpecs: {
        async findAll() {
          return [
            { variant_id: 1, toJSON: () => ({ power_hp: 220, safety_rating: 5 }) },
            { variant_id: 2, toJSON: () => ({ power_hp: 250, safety_rating: 4 }) },
          ];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
    },
  };

  try {
     const result = await compareVariants(ctx, {
      variant_ids: [1, 2],
      market_id: 1,
      buyer_profile: {
        environment: "city",
        long_trip_habit: "frequent",
        preferred_body_type: "suv",
        preferred_fuel_type: "hybrid",
        budget_max: 1000000000,
        passenger_count: 4,
      },
    });

     assert.equal(result.title, "AI comparison verdict");
     assert.equal(result.recommended_variant_id, 1);
     assert.equal(result.meta.aiUsed, false);
     assert.equal(result.meta.fallbackUsed, true);
     assert.equal(typeof result.aiInsight.summary, "string");
     assert.ok(result.confidence.score > 0.5);
     assert.ok(result.sources.length >= 2);
     assert.ok(result.items[0].scores.use_case_fit_score >= 0);
     assert.ok(result.items[0].scores.comfort_score >= 0);
     assert.ok(result.items[0].scores.resale_score >= 0);
     assert.match(result.assistant_message, /stronger overall case|better all-round buy/i);
     assert.match(result.assistant_message, /saved budget|saved priorities/i);
     assert.ok(!/overall\s+\d+(\.\d+)?/i.test(result.assistant_message));
     assert.ok(!/recall history deserves/i.test(result.assistant_message));
     assert.ok(result.items.every((item) => item.cons.every((entry) => !/lookup returned/i.test(entry))));
    } finally {
     global.fetch = originalFetch;
   }
});

test("AI insight service falls back when the LLM provider fails", async () => {
  const insight = await generateComparisonInsight(
    {
      structuredResult: {
        recommended_variant_id: 1,
        recommendation_reason: "Winner selected by backend score.",
        items: [
          {
            variant_id: 1,
            year: 2024,
            make: "Toyota",
            model: "Crossline",
            trim: "Urban Hybrid",
            pros: ["Efficient daily use."],
            cons: [],
            scores: { final_score: 88 },
          },
        ],
        caveats: ["Market coverage is partial."],
      },
      presentation: {
        title: "AI comparison verdict",
        assistant_message: "Toyota Crossline is the backend-selected winner.",
        highlights: ["Toyota Crossline: efficient daily use"],
      },
    },
    {
      ollama: {
        provider: "fpt",
        model: "Qwen3-32B",
        apiKey: "test-key",
        async generate() {
          throw new Error("provider timeout");
        },
      },
    }
  );

  assert.equal(insight.meta.aiUsed, false);
  assert.equal(insight.meta.fallbackUsed, true);
  assert.match(insight.aiInsight.summary, /backend-selected winner/i);
});

test("chat orchestrator returns clarification envelope for incomplete TCO requests", async () => {
  const result = await orchestrateChatRequest(
    { sequelize: {}, models: {} },
    {
      message: "Can you estimate TCO for this?",
      context: { market_id: 1 },
    }
  );

  assert.equal(result.intent, "calculate_tco");
  assert.equal(result.needs_clarification, true);
  assert.match(result.final_answer, /ownership cost/i);
  assert.deepEqual(result.meta.services_used, ["IntentClassifier", "RequestRouter"]);
});

test("chat orchestrator returns policy envelope for out-of-scope chat", async () => {
  const result = await orchestrateChatRequest(
    { sequelize: {}, models: {} },
    {
      message: "Tell me a random recipe for dinner",
      context: {},
    }
  );

  assert.equal(result.intent, "out_of_scope");
  assert.equal(result.needs_clarification, false);
  assert.equal(result.meta.route_service, "ConversationPolicyService");
  assert.equal(result.meta.aiFallbackUsed, true);
  assert.equal(result.result_confidence?.label, "Out of scope");
  assert.match(result.final_answer, /AI model is unavailable/i);
  assert.doesNotMatch(result.final_answer, /I can help best with car recommendations/i);
});

test("recommendation service returns deep links into vehicle detail and related listings", async () => {
  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 7,
              model_year: 2024,
              trim_name: "Hybrid Premium",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 980000000,
              model_name: "Corolla Cross",
              make_name: "Toyota",
              latest_price: 955000000,
            },
            {
              variant_id: 9,
              model_year: 2024,
              trim_name: "Touring",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 910000000,
              model_name: "Civic",
              make_name: "Honda",
              latest_price: 905000000,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews")) {
          return [[
            { variant_id: 7, avg_rating: 4.6, review_count: 12 },
            { variant_id: 9, avg_rating: 4.1, review_count: 7 },
          ]];
        }

        if (sql.includes("FROM vehicle_market_signals")) {
          return [[
            {
              variant_id: 7,
              active_listing_count: 4,
              avg_asking_price: 955000000,
              price_spread_pct: 0.07,
              scarcity_score: 0.62,
              data_confidence: 0.83,
            },
            {
              variant_id: 9,
              active_listing_count: 2,
              avg_asking_price: 910000000,
              price_spread_pct: 0.16,
              scarcity_score: 0.28,
              data_confidence: 0.71,
            },
          ]];
        }

        throw new Error(`Unexpected SQL in recommendation link test: ${sql}`);
      },
    },
    models: {
      Listings: {
        async findAll() {
          return [
            { listing_id: 101, variant_id: 7 },
            { listing_id: 102, variant_id: 7 },
            { listing_id: 205, variant_id: 9 },
          ];
        },
      },
      VariantImages: {
        async findAll() {
          return [
            { variant_id: 7, url: "/images/corolla-cross.jpg", sort_order: 0 },
            { variant_id: 9, url: "/images/civic.jpg", sort_order: 0 },
          ];
        },
      },
    },
  };

  const result = await recommendCars(ctx, {
    profile: {
      budget_max: 1000000000,
      preferred_body_type: "suv",
      preferred_fuel_type: "hybrid",
      environment: "city",
    },
    market_id: 1,
  });

  assert.equal(result.intent, "recommend_car");
  assert.ok(result.ranked_vehicles[0].links?.detail_page_url?.includes("/catalog/7"));
  assert.ok(result.ranked_vehicles[0].links?.related_listings_url?.includes("/listings?mode=match&variantId=7"));
  assert.deepEqual(result.ranked_vehicles[0].links?.related_listing_ids, [101, 102]);
  assert.equal(result.ranked_vehicles[0].thumbnail_url, "/images/corolla-cross.jpg");
  assert.ok(result.ranked_vehicles[0].reasons.some((reason) => /owner sentiment|market/i.test(reason)));
  assert.ok(result.ranked_vehicles[0].market_summary?.includes("live-style"));
});

test("recommendation service prioritizes exotic catalog matches for high-budget performance profiles", async () => {
  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 183,
              model_year: 2024,
              trim_name: "Competition xDrive",
              body_type: "coupe",
              fuel_type: "gasoline",
              engine: "3.0L",
              transmission: "8-Speed Automatic",
              drivetrain: "AWD",
              seats: 4,
              msrp_base: 4250000000,
              model_name: "M4",
              make_name: "BMW",
              latest_price: 3706839139,
            },
            {
              variant_id: 175,
              model_year: 2021,
              trim_name: "Base",
              body_type: "coupe",
              fuel_type: "gasoline",
              engine: "3.9L V8",
              transmission: "7-Speed Dual-Clutch",
              drivetrain: "RWD",
              seats: 2,
              msrp_base: 18900000000,
              model_name: "F8 Tributo",
              make_name: "Ferrari",
              latest_price: 12180856840,
            },
            {
              variant_id: 178,
              model_year: 2020,
              trim_name: "Coupe",
              body_type: "coupe",
              fuel_type: "gasoline",
              engine: "4.0L V8",
              transmission: "7-Speed Dual-Clutch",
              drivetrain: "RWD",
              seats: 2,
              msrp_base: 18200000000,
              model_name: "720S",
              make_name: "McLaren",
              latest_price: 11684876144,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews") || sql.includes("FROM vehicle_market_signals")) {
          return [[]];
        }

        throw new Error(`Unexpected SQL in exotic recommendation test: ${sql}`);
      },
    },
    models: {
      Listings: {
        async findAll() {
          return [];
        },
      },
      VariantSpecs: {
        async findAll() {
          return [
            { variant_id: 183, power_hp: 523 },
            { variant_id: 175, power_hp: 710 },
            { variant_id: 178, power_hp: 710 },
          ];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
      VariantImages: {
        async findAll() {
          return [];
        },
      },
    },
  };

  const result = await recommendCars(ctx, {
    profile: {
      primary_use_cases: ["lifestyle"],
      preferred_body_types: ["coupe"],
      budget_target: 20000000000,
      budget_ceiling: 20000000000,
      performance_priority: 0.95,
      tradeoff_preferences: ["performance_over_reliability"],
      emotional_motivators: ["sporty_identity"],
    },
    market_id: 1,
  });

  assert.match(result.ranked_vehicles[0].name, /Ferrari|McLaren/);
  assert.doesNotMatch(result.ranked_vehicles[0].name, /BMW M4/);
  assert.ok(result.ranked_vehicles[0].reasons.some((reason) => /performance|supercar/i.test(reason)));
});

test("recommendation service can use open-budget flagship positioning without a numeric ceiling", async () => {
  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 183,
              model_year: 2024,
              trim_name: "Competition xDrive",
              body_type: "coupe",
              fuel_type: "gasoline",
              engine: "3.0L",
              transmission: "8-Speed Automatic",
              drivetrain: "AWD",
              seats: 4,
              msrp_base: 4250000000,
              model_name: "M4",
              make_name: "BMW",
              latest_price: 3706839139,
            },
            {
              variant_id: 175,
              model_year: 2021,
              trim_name: "Base",
              body_type: "coupe",
              fuel_type: "gasoline",
              engine: "3.9L V8",
              transmission: "7-Speed Dual-Clutch",
              drivetrain: "RWD",
              seats: 2,
              msrp_base: 18900000000,
              model_name: "F8 Tributo",
              make_name: "Ferrari",
              latest_price: 12180856840,
            },
            {
              variant_id: 178,
              model_year: 2020,
              trim_name: "Coupe",
              body_type: "coupe",
              fuel_type: "gasoline",
              engine: "4.0L V8",
              transmission: "7-Speed Dual-Clutch",
              drivetrain: "RWD",
              seats: 2,
              msrp_base: 18200000000,
              model_name: "720S",
              make_name: "McLaren",
              latest_price: 11684876144,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews") || sql.includes("FROM vehicle_market_signals")) {
          return [[]];
        }

        throw new Error(`Unexpected SQL in open-budget flagship test: ${sql}`);
      },
    },
    models: {
      Listings: {
        async findAll() {
          return [];
        },
      },
      VariantSpecs: {
        async findAll() {
          return [
            { variant_id: 183, power_hp: 523 },
            { variant_id: 175, power_hp: 710 },
            { variant_id: 178, power_hp: 710 },
          ];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
      VariantImages: {
        async findAll() {
          return [];
        },
      },
    },
  };

  const result = await recommendCars(ctx, {
    profile: {
      primary_use_cases: ["lifestyle"],
      preferred_body_types: ["coupe"],
      budget_mode: "open",
      budget_flexibility: "open",
      price_positioning: "flagship",
      style_intent: "halo",
      performance_priority: 0.95,
      tradeoff_preferences: ["performance_over_reliability"],
      emotional_motivators: ["sporty_identity"],
    },
    market_id: 1,
  });

  assert.match(result.profile_summary, /open budget/i);
  assert.match(result.profile_summary, /flagship positioning/i);
  assert.match(result.ranked_vehicles[0].name, /Ferrari/);
  assert.ok(result.ranked_vehicles[0].reasons.some((reason) => /flagship end of the current catalog/i.test(reason)));
});

test("recommendation service honors excluded body styles while keeping the shortlist grounded in catalog data", async () => {
  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 7,
              model_year: 2024,
              trim_name: "Hybrid Premium",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 980000000,
              model_name: "Corolla Cross",
              make_name: "Toyota",
              latest_price: 955000000,
            },
            {
              variant_id: 11,
              model_year: 2024,
              trim_name: "Premium",
              body_type: "mpv",
              fuel_type: "gasoline",
              engine: "1.5L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 7,
              msrp_base: 990000000,
              model_name: "Xpander",
              make_name: "Mitsubishi",
              latest_price: 985000000,
            },
            {
              variant_id: 9,
              model_year: 2024,
              trim_name: "Touring",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 910000000,
              model_name: "Civic",
              make_name: "Honda",
              latest_price: 905000000,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews") || sql.includes("FROM vehicle_market_signals")) {
          return [[]];
        }

        throw new Error(`Unexpected SQL in exclusion shortlist test: ${sql}`);
      },
    },
    models: {
      Listings: {
        async findAll() {
          return [];
        },
      },
      VariantSpecs: {
        async findAll() {
          return [];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
      VariantImages: {
        async findAll() {
          return [];
        },
      },
    },
  };

  const result = await recommendCars(ctx, {
    profile: {
      primary_use_cases: ["family"],
      rejected_body_types: ["suv"],
      body_type_requirement: "open",
      budget_target: 1000000000,
      budget_ceiling: 1000000000,
      tradeoff_preferences: ["balanced"],
    },
    market_id: 1,
  });

  assert.match(result.profile_summary, /avoid suv/i);
  assert.doesNotMatch(result.ranked_vehicles[0].body_type ?? "", /^suv$/i);
  assert.ok(result.ranked_vehicles.every((vehicle) => vehicle.body_type !== "suv"));
});

test("listing signal loader prefers persisted market snapshots before live listing queries", async () => {
  let liveListingReads = 0;
  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM vehicle_market_signals")) {
          return [[
            {
              active_listing_count: 4,
              avg_asking_price: 955000000,
              median_asking_price: 948000000,
              min_asking_price: 925000000,
              max_asking_price: 989000000,
              avg_mileage_km: 18200,
              price_spread_pct: 0.066,
              data_confidence: 0.81,
              provider_key: "internal_marketplace",
              source_type: "internal_marketplace",
              title: "Persisted marketplace rollup",
              url: null,
              trust_level: "high",
              retrieved_at: new Date("2026-04-12T03:30:00.000Z"),
              notes: "Generated from listing aggregation",
            },
          ]];
        }
        return [[]];
      },
    },
    models: {
      Markets: {
        async findByPk() {
          return { market_id: 1, country_code: "VN" };
        },
      },
      Listings: {
        async findAll() {
          liveListingReads += 1;
          return [];
        },
      },
    },
  };

  const result = await loadListingMarketSignals(ctx, { variant_id: 7, market_id: 1 });

  assert.equal(result.item_count, 4);
  assert.equal(result.average_asking_price, 955000000);
  assert.equal(result.data_confidence, 0.81);
  assert.equal(result.sources.length, 1);
  assert.match(result.sources[0].retrieved_at, /^2026-04-12T03:30:00.000Z$/);
  assert.equal(liveListingReads, 0);
});

test("chat advisor preserves frontend contract while using layered orchestration", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 1;

  const ctx = {
    sequelize: {},
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const response = await chatAdvisor(ctx, {
    user_id: 42,
    message: "hello there",
    context: { market_id: 1 },
  });

  assert.equal(response.intent, "small_talk");
  assert.equal(typeof response.answer, "string");
  assert.ok(Array.isArray(response.follow_up_questions));
  assert.equal(typeof response.meta?.route_service, "string");
  assert.equal(messages.length, 3);
  assert.equal(messages[0].role, "user");
  assert.equal(messages[1].role, "tool");
  assert.equal(messages[2].role, "assistant");
});

test("chat advisor asks one buyer-profile question at a time before recommending", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 70;

  const ctx = {
    sequelize: {},
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const response = await chatAdvisor(ctx, {
    user_id: 42,
    message: "I need a car for daily commute",
    context: { market_id: 1 },
  });

  assert.equal(response.intent, "recommend_car");
  assert.equal(response.needs_clarification, true);
  assert.equal(response.structured_result, null);
  assert.deepEqual(response.meta?.missing_fields, ["passenger_setup"]);
  assert.equal(response.follow_up_questions.length, 1);
  assert.equal(response.follow_up_questions[0], "What type of vehicle do you prefer?");
  assert.match(response.answer, /daily commuting/i);
  assert.match(response.answer, /What type of vehicle do you prefer\?/);
  assert.doesNotMatch(response.answer, /What is your budget range\?/);
  assert.doesNotMatch(response.answer, /Still needed|Moderate confidence|You can answer all|1\./i);
  assert.equal(response.cards.length, 0);
  assert.equal(messages.length, 2);
  assert.deepEqual(sessions[0].context_json.pending_flow.missing_fields, response.meta.missing_fields);
});

test("chat advisor accepts niche performance use cases instead of repeating the same question", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 71;

  const ctx = {
    sequelize: {},
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const response = await chatAdvisor(ctx, {
    user_id: 42,
    message: "for drifting",
    context: { market_id: 1 },
  });

  assert.equal(response.intent, "recommend_car");
  assert.equal(response.needs_clarification, true);
  assert.deepEqual(response.meta?.missing_fields, ["passenger_setup"]);
  assert.equal(response.follow_up_questions[0], "What type of vehicle do you prefer?");
  assert.match(response.answer, /fun or performance driving/i);
  assert.match(response.answer, /What type of vehicle do you prefer\?/);
  assert.doesNotMatch(response.answer, /Still needed|Moderate confidence|You can answer all|1\./i);
  assert.ok(response.advisor_profile.primary_use_cases.includes("lifestyle"));
  assert.ok(response.advisor_profile.performance_priority >= 0.9);
});

test("chat advisor answers an interruption and repeats the pending buyer-profile question", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 72;

  const ctx = {
    sequelize: {},
    services: {
      ollama: {
        async generate(request) {
          const prompt = String(request?.prompt || "");
          if (prompt.includes("Convert the latest customer reply")) {
            const replyMatch = prompt.match(/Customer reply:\s*(".*")/);
            const customerReply = replyMatch ? JSON.parse(replyMatch[1]) : "";
            return {
              text: JSON.stringify({
                use_case: /iphone/i.test(customerReply) || /family/i.test(customerReply) ? "family" : null,
                vehicle_type: null,
                seat_count: null,
                budget_min: null,
                budget_max: null,
                ownership_preference: null,
                is_unsure: false,
              }),
            };
          }
          if (prompt.includes("next_missing_field")) {
            return {
              text: JSON.stringify({
                answer: "Got it, family use. What type of vehicle do you prefer?",
              }),
            };
          }
          if (prompt.includes("policy_insight_payload_json")) {
            const payload = extractPolicyPayload(prompt);
            return {
              text: JSON.stringify({
                summary: policyInsightSummary(payload),
                reasons: [],
                caveats: [],
                advice: "",
              }),
            };
          }
          if (prompt.includes("pending_advisor_question")) {
            if (/iphone 17/i.test(prompt)) {
              const asksUseCase = /what will you mainly use/i.test(prompt);
              return {
                text: JSON.stringify({
                  answer: asksUseCase
                    ? "For iPhone 17, I would look at battery, camera, storage, and how well it fits your daily workflow. For your car search, that tech preference can map to Apple CarPlay, infotainment quality, wireless charging, and cabin connectivity. CarVista Advisor focuses on vehicle recommendations, comparisons, pricing, and ownership costs, so what will you mainly use the vehicle for?"
                    : "For iPhone 17, I would look at battery, camera, storage, and how well it fits your daily workflow. For your car search, that tech preference can map to Apple CarPlay, infotainment quality, wireless charging, and cabin connectivity. CarVista Advisor focuses on vehicle recommendations, comparisons, pricing, and ownership costs, so what type of vehicle do you prefer?",
                }),
              };
            }
            if (/world cup/i.test(prompt)) {
              return {
                text: JSON.stringify({
                  answer:
                    "Argentina won the 2022 World Cup after a 3-3 final against France and a penalty shootout. CarVista Advisor is best for vehicle recommendations, comparisons, pricing, and ownership costs, so I can bring us back to your search now: what type of vehicle do you prefer?",
                }),
              };
            }
            return {
              text: JSON.stringify({
                answer:
                  "A regular hybrid can run briefly on electric power, while a plug-in hybrid has a larger battery you can charge for more electric-only driving. Bringing this back to your search, what type of vehicle do you prefer?",
              }),
            };
          }
          return { text: JSON.stringify({ answer: "" }) };
        },
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const first = await chatAdvisor(ctx, {
    user_id: 42,
    message: "Recommend me a car",
    context: { market_id: 1 },
  });

  assert.equal(first.intent, "recommend_car");
  assert.equal(first.follow_up_questions[0], "What will you mainly use the vehicle for?");

  const phoneDetour = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "iphone 17",
    context: { market_id: 1 },
  });

  assert.equal(phoneDetour.intent, "out_of_scope");
  assert.equal(phoneDetour.needs_clarification, true);
  assert.match(phoneDetour.answer, /CarVista Advisor/i);
  assert.match(phoneDetour.answer, /iPhone 17|battery|camera|storage|infotainment/i);
  assert.match(phoneDetour.answer, /what will you mainly use the vehicle for\?/i);
  assert.equal(phoneDetour.confidence?.label, "Needs clarification");
  assert.equal(sessions[0].context_json.pending_question_key, "primary_use_cases");
  assert.deepEqual(sessions[0].context_json.advisor_profile.primary_use_cases, []);

  const familyStep = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "Family use",
    context: { market_id: 1 },
  });

  assert.equal(familyStep.intent, "recommend_car");
  assert.equal(familyStep.follow_up_questions[0], "What type of vehicle do you prefer?");
  assert.equal(sessions[0].context_json.pending_question_key, "passenger_setup");

  const second = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "Explain the difference between hybrid and plug-in hybrid",
    context: { market_id: 1 },
  });

  assert.equal(second.intent, "vehicle_general_qa");
  assert.equal(second.needs_clarification, true);
  assert.match(second.answer, /regular hybrid|plug-?in hybrid/i);
  assert.match(second.answer, /what type of vehicle do you prefer\?/i);
  assert.deepEqual(second.follow_up_questions, ["What type of vehicle do you prefer?"]);
  assert.equal(sessions[0].context_json.pending_question_key, "passenger_setup");
  assert.equal(sessions[0].context_json.conversation_state.pending_clarification.intent, "recommend_car");
  assert.equal(sessions[0].context_json.conversation_state.pending_clarification.field, "passenger_setup");
  assert.equal(sessions[0].context_json.active_topic.intent, "recommend_car");
  assert.deepEqual(sessions[0].context_json.advisor_profile.preferred_fuel_types, []);

  const third = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "Who won the World Cup?",
    context: { market_id: 1 },
  });

  assert.equal(third.intent, "out_of_scope");
  assert.equal(third.needs_clarification, true);
  assert.match(third.answer, /Argentina won the 2022 World Cup/i);
  assert.match(third.answer, /what type of vehicle do you prefer\?/i);
  assert.equal(third.confidence?.label, "Out of scope");
  assert.equal(sessions[0].context_json.pending_question_key, "passenger_setup");
});

test("chat advisor completes the guided recommendation flow in four short steps", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 75;

  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 7,
              model_year: 2024,
              trim_name: "Hybrid Premium",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 980000000,
              model_name: "Corolla Cross",
              make_name: "Toyota",
              latest_price: 955000000,
            },
            {
              variant_id: 11,
              model_year: 2024,
              trim_name: "Premium",
              body_type: "mpv",
              fuel_type: "gasoline",
              engine: "1.5L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 7,
              msrp_base: 990000000,
              model_name: "Xpander",
              make_name: "Mitsubishi",
              latest_price: 985000000,
            },
            {
              variant_id: 9,
              model_year: 2024,
              trim_name: "Touring",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 910000000,
              model_name: "Civic",
              make_name: "Honda",
              latest_price: 905000000,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews") || sql.includes("FROM vehicle_market_signals")) {
          return [[]];
        }

        throw new Error(`Unexpected SQL in guided recommendation flow test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
      Listings: {
        async findAll() {
          return [];
        },
      },
      VariantSpecs: {
        async findAll() {
          return [];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
      VariantImages: {
        async findAll() {
          return [
            { variant_id: 7, url: "/images/corolla-cross.jpg", sort_order: 0 },
            { variant_id: 11, url: "/images/xpander.jpg", sort_order: 0 },
            { variant_id: 9, url: "/images/civic.jpg", sort_order: 0 },
          ];
        },
      },
    },
  };

  const first = await chatAdvisor(ctx, {
    user_id: 42,
    message: "Family use",
    context: { market_id: 1 },
  });
  assert.equal(first.follow_up_questions.length, 1);
  assert.equal(first.follow_up_questions[0], "What type of vehicle do you prefer?");
  assert.equal(first.cards.length, 0);

  const second = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "SUV",
    context: { market_id: 1 },
  });
  assert.equal(second.follow_up_questions.length, 1);
  assert.equal(second.follow_up_questions[0], "What is your budget range?");
  assert.equal(second.cards.length, 0);

  const third = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "Under 1 billion",
    context: { market_id: 1 },
  });
  assert.equal(third.follow_up_questions.length, 1);
  assert.equal(third.follow_up_questions[0], "Do you prefer durability and low maintenance, or stronger performance and a sportier feel?");
  assert.equal(third.cards.length, 0);

  const final = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "faster is better",
    context: { market_id: 1 },
  });

  assert.equal(final.needs_clarification, false);
  assert.equal(final.follow_up_questions.length, 0);
  assert.match(final.answer, /Based on your needs, these are the best matches for you\./);
  assert.ok(final.cards.length >= 2);
  assert.ok(final.cards.length <= 3);
  assert.ok(final.cards.every((card) => card.image_url));
  assert.ok(final.cards.every((card) => card.href?.startsWith("/catalog/")));
  assert.ok(final.cards.every((card) => card.action?.type === "open_vehicle_detail"));
  assert.ok(final.advisor_profile.performance_priority >= 0.9);
  assert.ok(final.advisor_profile.tradeoff_preferences.includes("performance_over_reliability"));
  assert.ok(messages.length >= 8);

  const restart = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "recommend more",
    context: { market_id: 1 },
  });

  assert.equal(restart.needs_clarification, true);
  assert.equal(restart.follow_up_questions[0], "What will you mainly use the vehicle for?");
  assert.equal(restart.cards.length, 0);
  assert.equal(restart.advisor_profile.primary_use_cases.length, 0);
  assert.match(restart.answer, /What will you mainly use the vehicle for\?/);
});

test("chat advisor treats natural flagship budget language as a valid budget answer", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 140;

  const ctx = {
    sequelize: {
      async query(sql) {
        throw new Error(`Unexpected SQL in flagship budget clarification test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const first = await chatAdvisor(ctx, {
    user_id: 42,
    message: "Family use",
    context: { market_id: 1 },
  });
  const second = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "SUV",
    context: { market_id: 1 },
  });
  const third = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "the most expensive one",
    context: { market_id: 1 },
  });

  assert.equal(second.follow_up_questions[0], "What is your budget range?");
  assert.equal(third.follow_up_questions[0], "Do you prefer durability and low maintenance, or stronger performance and a sportier feel?");
  assert.equal(third.advisor_profile.budget_mode, "open");
  assert.equal(third.advisor_profile.price_positioning, "flagship");
  assert.doesNotMatch(third.answer, /What is your budget range\?/);
  assert.doesNotMatch(third.answer, /budget around 0/i);
});

test("chat advisor treats negative body-style replies as exclusions instead of positive preference", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 145;

  const ctx = {
    sequelize: {
      async query(sql) {
        throw new Error(`Unexpected SQL in body exclusion clarification test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const first = await chatAdvisor(ctx, {
    user_id: 42,
    message: "racing",
    context: { market_id: 1 },
  });
  const second = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "anything except SUV",
    context: { market_id: 1 },
  });

  assert.equal(second.follow_up_questions[0], "What is your budget range?");
  assert.match(second.answer, /stay away from SUV/i);
  assert.deepEqual(second.advisor_profile.rejected_body_types, ["suv"]);
  assert.deepEqual(second.advisor_profile.preferred_body_types, []);
  assert.equal(second.advisor_profile.body_type_requirement, "open");
  assert.doesNotMatch(second.answer, /leaning toward an SUV/i);
});

test("chat advisor accepts flexible natural budget phrasing and moves to the tradeoff question", async () => {
  const sessions = [];
  let sessionIdCounter = 146;

  const ctx = {
    sequelize: {
      async query(sql) {
        throw new Error(`Unexpected SQL in flexible budget clarification test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          return payload;
        },
      },
    },
  };

  const first = await chatAdvisor(ctx, {
    user_id: 42,
    message: "Mostly for commuting to work.",
    context: { market_id: 1 },
  });
  const second = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "Maybe a hatchback or sedan.",
    context: { market_id: 1 },
  });
  const third = await chatAdvisor(ctx, {
    session_id: first.session_id,
    user_id: 42,
    message: "I can stretch a bit for the right car.",
    context: { market_id: 1 },
  });

  assert.equal(first.follow_up_questions[0], "What type of vehicle do you prefer?");
  assert.equal(second.follow_up_questions[0], "What is your budget range?");
  assert.equal(third.follow_up_questions[0], "Do you prefer durability and low maintenance, or stronger performance and a sportier feel?");
  assert.equal(third.advisor_profile.budget_mode, "flexible");
  assert.equal(third.advisor_profile.budget_flexibility, "flexible");
  assert.doesNotMatch(third.answer, /What is your budget range\?/);
});

test("chat advisor clears prior performance profile when user asks for a new family car", async () => {
  const sessions = [
    {
      session_id: 91,
      user_id: 42,
      context_json: {
        market_id: 1,
        advisor_profile: {
          primary_use_cases: ["lifestyle"],
          preferred_body_types: ["coupe"],
          regular_passenger_count: 2,
          budget_target: 20000000000,
          budget_ceiling: 20000000000,
          performance_priority: 0.95,
          tradeoff_preferences: ["performance_over_reliability"],
        },
        active_topic: { intent: "recommend_car" },
        conversation_state: {
          active_intent: "recommend_car",
          active_topic: { intent: "recommend_car" },
          active_entities: { market_id: 1 },
          pending_clarification: null,
        },
      },
      async update(next) {
        Object.assign(this, next);
      },
    },
  ];
  const messages = [];

  const ctx = {
    sequelize: {},
    models: {
      AiChatSessions: {
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const response = await chatAdvisor(ctx, {
    session_id: 91,
    user_id: 42,
    message: "okay now i need a family car",
    context: { market_id: 1 },
  });

  assert.equal(response.intent, "recommend_car");
  assert.equal(response.needs_clarification, true);
  assert.equal(response.meta?.advisor_restart, true);
  assert.deepEqual(response.advisor_profile.primary_use_cases, ["family"]);
  assert.deepEqual(response.advisor_profile.preferred_body_types, []);
  assert.equal(response.advisor_profile.budget_ceiling, null);
  assert.equal(response.advisor_profile.performance_priority, 0);
  assert.deepEqual(response.advisor_profile.tradeoff_preferences, []);
  assert.equal(response.follow_up_questions[0], "What type of vehicle do you prefer?");
  assert.doesNotMatch(response.answer, /Ferrari|Lamborghini|McLaren/i);
  assert.equal(response.cards.length, 0);
});

test("chat advisor can return a concise shortlist when the user declines more intake questions", async () => {
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 80;

  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 7,
              model_year: 2024,
              trim_name: "Hybrid Premium",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 980000000,
              model_name: "Corolla Cross",
              make_name: "Toyota",
              latest_price: 955000000,
            },
            {
              variant_id: 9,
              model_year: 2024,
              trim_name: "Touring",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 910000000,
              model_name: "Civic",
              make_name: "Honda",
              latest_price: 905000000,
            },
            {
              variant_id: 11,
              model_year: 2024,
              trim_name: "Premium",
              body_type: "mpv",
              fuel_type: "gasoline",
              engine: "1.5L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 7,
              msrp_base: 990000000,
              model_name: "Xpander",
              make_name: "Mitsubishi",
              latest_price: 985000000,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews") || sql.includes("FROM vehicle_market_signals")) {
          return [[]];
        }

        throw new Error(`Unexpected SQL in temporary shortlist test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
      Listings: {
        async findAll() {
          return [];
        },
      },
      VariantSpecs: {
        async findAll() {
          return [];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
      VariantImages: {
        async findAll() {
          return [
            { variant_id: 7, url: "/images/corolla-cross.jpg", sort_order: 0 },
            { variant_id: 9, url: "/images/civic.jpg", sort_order: 0 },
            { variant_id: 11, url: "/images/xpander.jpg", sort_order: 0 },
          ];
        },
      },
    },
  };

  const response = await chatAdvisor(ctx, {
    user_id: 42,
    message: "I need a family SUV under 1 billion for 5 people. Don't ask more, just recommend.",
    context: { market_id: 1 },
  });

  assert.equal(response.intent, "recommend_car");
  assert.equal(response.needs_clarification, false);
  assert.ok(response.structured_result.ranked_vehicles.length >= 3);
  const recommendationCard = response.cards.find((card) => card.title.includes("Corolla Cross"));
  assert.equal(recommendationCard?.image_url, "/images/corolla-cross.jpg");
  assert.equal(recommendationCard?.href, "/catalog/7");
  assert.equal(recommendationCard?.action?.type, "open_vehicle_detail");
  assert.match(response.answer, /closest matches currently available in our catalog/i);
  assert.doesNotMatch(response.answer, /Why it fits:|Watch-out:|Best for:/);
  assert.equal(response.follow_up_questions.length, 0);
  assert.equal(response.meta?.missing_fields.length, 0);
});

test("chat orchestrator formats recommendation shortlists with reasons caveats and buyer fit", async () => {
  const buyerProfile = {
    primary_use_cases: ["family", "daily_commute"],
    budget_max: 1000000000,
    regular_passenger_count: 4,
    tradeoff_preferences: ["reliability_over_performance"],
    city_vs_highway_ratio: "mostly_city",
    safety_priority: 0.95,
    fuel_saving_priority: 0.9,
  };
  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 7,
              model_year: 2024,
              trim_name: "Hybrid Premium",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 980000000,
              model_name: "Corolla Cross",
              make_name: "Toyota",
              latest_price: 955000000,
            },
            {
              variant_id: 9,
              model_year: 2024,
              trim_name: "Touring",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 910000000,
              model_name: "Civic",
              make_name: "Honda",
              latest_price: 905000000,
            },
            {
              variant_id: 11,
              model_year: 2024,
              trim_name: "Premium",
              body_type: "mpv",
              fuel_type: "gasoline",
              engine: "1.5L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 7,
              msrp_base: 990000000,
              model_name: "Xpander",
              make_name: "Mitsubishi",
              latest_price: 985000000,
            },
          ]];
        }

        if (sql.includes("FROM car_reviews") || sql.includes("FROM vehicle_market_signals")) {
          return [[]];
        }

        throw new Error(`Unexpected SQL in recommendation formatter test: ${sql}`);
      },
    },
    models: {
      Listings: {
        async findAll() {
          return [];
        },
      },
      VariantSpecs: {
        async findAll() {
          return [];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
      VariantImages: {
        async findAll() {
          return [
            { variant_id: 7, url: "/images/corolla-cross.jpg", sort_order: 0 },
            { variant_id: 9, url: "/images/civic.jpg", sort_order: 0 },
            { variant_id: 11, url: "/images/xpander.jpg", sort_order: 0 },
          ];
        },
      },
    },
  };

  const result = await orchestrateChatRequest(ctx, {
    message: "Recommend cars for me",
    context: {
      market_id: 1,
      advisor_profile: buyerProfile,
      budget: buyerProfile.budget_max,
    },
    advisor_profile: buyerProfile,
  });

  assert.equal(result.intent, "recommend_car");
  assert.equal(result.needs_clarification, false);
  assert.ok(result.structured_result.ranked_vehicles.length >= 3);
  assert.match(result.final_answer, /Based on your needs, these are the best matches for you\./);
  assert.match(result.final_answer, /Corolla Cross/);
  assert.doesNotMatch(result.final_answer, /Why it fits:|Watch-out:|Best for:|Next step:/);
});

test("chat orchestrator uses backend structured result before the final advisor LLM response", async () => {
  let seenPrompt = "";
  const buyerProfile = {
    primary_use_cases: ["family"],
    budget_max: 1000000000,
    preferred_body_type: "suv",
  };
  const ctx = {
    services: {
      ollama: {
        provider: "fpt",
        model: "Qwen3-32B",
        apiKey: "test-key",
        async generate(request) {
          seenPrompt = request.prompt;
          return {
            text: JSON.stringify({
              answer: "I would start with the Toyota Corolla Cross because it is the backend-ranked family SUV fit.",
              reasons: ["Backend ranking placed Corolla Cross first for the saved family profile."],
              caveats: [],
              advice: "Open the vehicle detail page before checking listings.",
            }),
          };
        },
      },
    },
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv")) {
          return [[
            {
              variant_id: 7,
              model_year: 2024,
              trim_name: "Hybrid Premium",
              body_type: "suv",
              fuel_type: "hybrid",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              msrp_base: 980000000,
              model_name: "Corolla Cross",
              make_name: "Toyota",
              latest_price: 955000000,
            },
          ]];
        }
        if (sql.includes("FROM car_reviews") || sql.includes("FROM vehicle_market_signals")) {
          return [[]];
        }
        throw new Error(`Unexpected SQL in advisor insight test: ${sql}`);
      },
    },
    models: {
      Listings: { async findAll() { return []; } },
      VariantSpecs: { async findAll() { return []; } },
      VariantSpecKv: { async findAll() { return []; } },
      VariantImages: { async findAll() { return []; } },
    },
  };

  const result = await orchestrateChatRequest(ctx, {
    message: "Recommend a family SUV under 1 billion",
    context: {
      market_id: 1,
      advisor_profile: buyerProfile,
      budget: buyerProfile.budget_max,
    },
    advisor_profile: buyerProfile,
  });

  assert.equal(result.intent, "recommend_car");
  assert.match(result.final_answer, /backend-ranked family SUV/i);
  assert.match(seenPrompt, /structured_backend_result_json/);
  assert.match(seenPrompt, /Corolla Cross/);
  assert.equal(result.meta.aiUsed, true);
  assert.equal(result.structured_result.aiInsight.reasons[0], "Backend ranking placed Corolla Cross first for the saved family profile.");
});

test("chat orchestrator lets Qwen suggest vehicles when local catalog has no matches", async () => {
  let seenPrompt = "";
  const buyerProfile = {
    primary_use_cases: ["family"],
    budget_max: 40000,
    preferred_body_types: ["suv"],
  };
  const ctx = {
    services: {
      ollama: {
        provider: "fpt",
        model: "Qwen3-32B",
        apiKey: "test-key",
        async generate(request) {
          seenPrompt = request.prompt;
          return {
            text: JSON.stringify({
              answer:
                "I do not see matching local catalog candidates in the backend result, so as general market suggestions I would look at the Toyota RAV4, Honda CR-V, Mazda CX-5, and Subaru Forester for a family SUV under about 40k. These are not confirmed CarVista inventory, but they are sensible outside-catalog options to compare for space, reliability, fuel economy, and safety.",
              reasons: ["The backend explicitly allowed general vehicle suggestions because catalog coverage was empty."],
              caveats: ["General suggestions are not confirmed local inventory."],
              advice: "Check availability and local pricing before deciding.",
            }),
          };
        },
      },
    },
    sequelize: {
      async query(sql) {
        if (
          sql.includes("FROM car_variants cv") ||
          sql.includes("FROM car_reviews") ||
          sql.includes("FROM vehicle_market_signals")
        ) {
          return [[]];
        }
        throw new Error(`Unexpected SQL in empty catalog recommendation test: ${sql}`);
      },
    },
    models: {
      Listings: { async findAll() { return []; } },
      VariantSpecs: { async findAll() { return []; } },
      VariantSpecKv: { async findAll() { return []; } },
      VariantImages: { async findAll() { return []; } },
    },
  };

  const result = await orchestrateChatRequest(ctx, {
    message: "Need an SUV for family use under 40k, maybe a RAV4",
    context: {
      market_id: 1,
      advisor_profile: buyerProfile,
      budget: buyerProfile.budget_max,
    },
    advisor_profile: buyerProfile,
  });

  assert.equal(result.intent, "recommend_car");
  assert.equal(result.needs_clarification, false);
  assert.equal(result.structured_result.catalog_coverage, "no_catalog_matches");
  assert.equal(result.structured_result.general_vehicle_suggestions_allowed, true);
  assert.equal(result.meta.aiUsed, true);
  assert.match(seenPrompt, /general_vehicle_suggestions_allowed/);
  assert.match(seenPrompt, /Need an SUV for family use under 40k/);
  assert.match(result.final_answer, /RAV4|CR-V|CX-5|Forester/i);
  assert.match(result.final_answer, /not confirmed CarVista inventory|outside-catalog/i);
});

test("chat advisor binds short clarification replies to the pending compare flow", async () => {
  const originalFetch = global.fetch;
  global.fetch = mockFetchFactory();
  const sessions = [
    {
      session_id: 9,
      user_id: 7,
      context_json: {
        market_id: 1,
        focus_variant_id: 1,
        focus_variant_label: "2024 Honda Civic RS",
        advisor_profile: {
          budget_max: 1200000000,
          preferred_body_type: "suv",
        },
        pending_flow: {
          id: "flow_compare_1",
          intent: "compare_car",
          status: "clarifying",
          missing_fields: ["vehicles"],
          context_snapshot: {
            market_id: 1,
            focus_variant_id: 1,
            focus_variant_label: "2024 Honda Civic RS",
            advisor_profile: {
              budget_max: 1200000000,
              preferred_body_type: "suv",
            },
          },
        },
      },
      async update(next) {
        Object.assign(this, next);
      },
    },
  ];
  const messages = [];

  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("CONCAT_WS(' ', cv.model_year")) {
          return [[
            {
              variant_id: 2,
              model_year: 2024,
              trim_name: "xDrive40i",
              body_type: "suv",
              fuel_type: "gasoline",
              msrp_base: 3900000000,
              model_name: "X5",
              make_name: "BMW",
            },
          ]];
        }

        if (sql.includes("FROM car_variants cv") && sql.includes("WHERE cv.variant_id IN")) {
          return [[
            {
              variant_id: 1,
              model_id: 10,
              model_year: 2024,
              trim_name: "RS",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              doors: 4,
              msrp_base: 950000000,
              model_name: "Civic",
              make_name: "Honda",
            },
            {
              variant_id: 2,
              model_id: 11,
              model_year: 2024,
              trim_name: "xDrive40i",
              body_type: "suv",
              fuel_type: "gasoline",
              engine: "3.0T",
              transmission: "AT",
              drivetrain: "AWD",
              seats: 5,
              doors: 5,
              msrp_base: 3900000000,
              model_name: "X5",
              make_name: "BMW",
            },
          ]];
        }

        if (sql.includes("FROM car_reviews")) {
          return [[
            { variant_id: 1, avg_rating: 4.4, review_count: 10 },
            { variant_id: 2, avg_rating: 4.6, review_count: 7 },
          ]];
        }

        if (sql.includes("FROM variant_price_history")) {
          return [[
            { variant_id: 1, price: 930000000 },
            { variant_id: 2, price: 3800000000 },
          ]];
        }

        throw new Error(`Unexpected SQL in clarification test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
      VariantSpecs: {
        async findAll() {
          return [
            { variant_id: 1, toJSON: () => ({ power_hp: 180, safety_rating: 5 }) },
            { variant_id: 2, toJSON: () => ({ power_hp: 375, safety_rating: 5 }) },
          ];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
    },
  };

  try {
    const response = await chatAdvisor(ctx, {
      session_id: 9,
      user_id: 7,
      message: "BMW X5 2024",
      context: {},
    });

    assert.equal(response.intent, "compare_car");
    assert.equal(response.meta?.route_service, "ComparisonService");
    assert.equal(response.needs_clarification, false);
    assert.ok(response.answer.toLowerCase().includes("bmw x5") || response.cards.some((card) => card.title.includes("BMW")));
  } finally {
    global.fetch = originalFetch;
  }
});

test("chat advisor keeps compare follow-ups inside the same pair and focuses the answer on resale", async () => {
  const originalFetch = global.fetch;
  global.fetch = mockFetchFactory();
  const sessions = [
    {
      session_id: 17,
      user_id: 5,
      context_json: {
        market_id: 1,
        focus_variant_id: 1,
        focus_variant_label: "2024 Honda Civic RS",
        compare_variant_ids: [1, 2],
        active_topic: {
          intent: "compare_car",
          focus_variant_id: 1,
          compare_variant_ids: [1, 2],
          market_id: 1,
        },
        conversation_state: {
          active_topic: {
            intent: "compare_car",
            focus_variant_id: 1,
            compare_variant_ids: [1, 2],
            market_id: 1,
          },
          active_intent: "compare_car",
          referenced_vehicle_ids: [1, 2],
          active_entities: {
            focus_variant_id: 1,
            focus_variant_label: "2024 Honda Civic RS",
            compare_variant_ids: [1, 2],
            market_id: 1,
          },
          active_flow_id: "flow_compare_followup",
        },
      },
      async update(next) {
        Object.assign(this, next);
      },
    },
  ];
  const messages = [];

  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv") && sql.includes("WHERE cv.variant_id IN")) {
          return [[
            {
              variant_id: 1,
              model_id: 10,
              model_year: 2024,
              trim_name: "RS",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "1.5T",
              transmission: "CVT",
              drivetrain: "FWD",
              seats: 5,
              doors: 4,
              msrp_base: 950000000,
              model_name: "Civic",
              make_name: "Honda",
            },
            {
              variant_id: 2,
              model_id: 11,
              model_year: 2024,
              trim_name: "Premium",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "2.0L",
              transmission: "AT",
              drivetrain: "FWD",
              seats: 5,
              doors: 4,
              msrp_base: 980000000,
              model_name: "Mazda3",
              make_name: "Mazda",
            },
          ]];
        }

        if (sql.includes("FROM car_reviews")) {
          return [[
            { variant_id: 1, avg_rating: 4.5, review_count: 12 },
            { variant_id: 2, avg_rating: 4.1, review_count: 7 },
          ]];
        }

        if (sql.includes("FROM variant_price_history")) {
          return [[
            { variant_id: 1, price: 930000000 },
            { variant_id: 2, price: 970000000 },
          ]];
        }

        throw new Error(`Unexpected SQL in compare follow-up test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
      VariantSpecs: {
        async findAll() {
          return [
            { variant_id: 1, toJSON: () => ({ power_hp: 180, safety_rating: 5 }) },
            { variant_id: 2, toJSON: () => ({ power_hp: 191, safety_rating: 5 }) },
          ];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
    },
  };

  try {
    const response = await chatAdvisor(ctx, {
      session_id: 17,
      user_id: 5,
      message: "What about resale value?",
      context: {},
    });

    assert.equal(response.intent, "compare_car");
    assert.equal(response.meta?.turn_type, "follow_up");
    assert.match(response.answer.toLowerCase(), /resale/);
    assert.ok((response.answer || "").length < 320);
    assert.ok((response.cards || []).every((card) => !String(card.value || "").includes("Variant #")));
    assert.deepEqual(sessions[0].context_json.compare_variant_ids, [1, 2]);
    assert.equal(sessions[0].context_json.conversation_state.last_user_turn_type, "follow_up");
  } finally {
    global.fetch = originalFetch;
  }
});

test("chat advisor uses provided compare context for fresh follow-up sessions without asking for a second car", async () => {
  const originalFetch = global.fetch;
  global.fetch = mockFetchFactory();
  const sessions = [];
  const messages = [];
  let sessionIdCounter = 41;

  const ctx = {
    sequelize: {
      async query(sql) {
        if (sql.includes("FROM car_variants cv") && sql.includes("WHERE cv.variant_id IN")) {
          return [[
            {
              variant_id: 1,
              model_id: 21,
              model_year: 2024,
              trim_name: "Competition xDrive",
              body_type: "coupe",
              fuel_type: "gasoline",
              engine: "3.0L Twin Turbo",
              transmission: "AT",
              drivetrain: "AWD",
              seats: 4,
              doors: 2,
              msrp_base: 3706839139,
              model_name: "M4",
              make_name: "BMW",
            },
            {
              variant_id: 2,
              model_id: 22,
              model_year: 2012,
              trim_name: "328i",
              body_type: "sedan",
              fuel_type: "gasoline",
              engine: "2.0L Turbo",
              transmission: "AT",
              drivetrain: "RWD",
              seats: 5,
              doors: 4,
              msrp_base: 220118176,
              model_name: "3 Series",
              make_name: "BMW",
            },
          ]];
        }

        if (sql.includes("FROM car_reviews")) {
          return [[
            { variant_id: 1, avg_rating: 4.8, review_count: 18 },
            { variant_id: 2, avg_rating: 4.2, review_count: 11 },
          ]];
        }

        if (sql.includes("FROM variant_price_history")) {
          return [[
            { variant_id: 1, price: 3650000000 },
            { variant_id: 2, price: 235000000 },
          ]];
        }

        throw new Error(`Unexpected SQL in compare-context follow-up test: ${sql}`);
      },
    },
    models: {
      AiChatSessions: {
        async create(payload) {
          const row = {
            session_id: sessionIdCounter++,
            ...payload,
            async update(next) {
              Object.assign(this, next);
            },
          };
          sessions.push(row);
          return row;
        },
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
      VariantSpecs: {
        async findAll() {
          return [
            { variant_id: 1, toJSON: () => ({ power_hp: 503, safety_rating: 5 }) },
            { variant_id: 2, toJSON: () => ({ power_hp: 240, safety_rating: 4 }) },
          ];
        },
      },
      VariantSpecKv: {
        async findAll() {
          return [];
        },
      },
    },
  };

  try {
    const response = await chatAdvisor(ctx, {
      user_id: 8,
      message: "Which is better for a family of 5?",
      context: {
        market_id: 1,
        focus_variant_id: 1,
        focus_variant_label: "2024 BMW M4 Competition xDrive",
        compare_variant_ids: [1, 2],
        compare_variant_labels: ["2024 BMW M4 Competition xDrive", "2012 BMW 3 Series 328i"],
      },
    });

    assert.equal(response.intent, "compare_car");
    assert.equal(response.needs_clarification, false);
    assert.equal(response.meta?.route_service, "ComparisonService");
    assert.doesNotMatch(response.answer.toLowerCase(), /second car|second vehicle|tell me/i);
    assert.ok((response.answer || "").length < 320);
    assert.ok((response.cards || []).every((card) => !String(card.value || "").includes("Variant #")));
    assert.deepEqual(sessions[0].context_json.compare_variant_ids, [1, 2]);
    assert.equal(messages[0].role, "user");
  } finally {
    global.fetch = originalFetch;
  }
});

test("chat advisor treats ambiguous referential replies as clarification instead of leaking stale context", async () => {
  const sessions = [
    {
      session_id: 31,
      user_id: 11,
      context_json: {
        market_id: 1,
        active_topic: {
          intent: "recommend_car",
          market_id: 1,
        },
        conversation_state: {
          active_topic: {
            intent: "recommend_car",
            market_id: 1,
          },
          active_intent: "recommend_car",
          referenced_vehicle_ids: [],
          active_entities: {
            focus_variant_id: null,
            focus_variant_label: null,
            compare_variant_ids: [],
            market_id: 1,
          },
          active_flow_id: "flow_reco_1",
        },
      },
      async update(next) {
        Object.assign(this, next);
      },
    },
  ];
  const messages = [];

  const ctx = {
    sequelize: {},
    models: {
      AiChatSessions: {
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const response = await chatAdvisor(ctx, {
    session_id: 31,
    user_id: 11,
    message: "What about this one?",
    context: {},
  });

  assert.equal(response.needs_clarification, true);
  assert.equal(response.meta?.turn_type, "ambiguous");
  assert.match(response.answer, /which vehicle|tell me the car/i);
  assert.equal(sessions[0].context_json.conversation_state.pending_clarification.intent, "recommend_car");
});

test("chat advisor resets stale compare context when the user asks a new general automotive question", async () => {
  const sessions = [
    {
      session_id: 21,
      user_id: 9,
      context_json: {
        market_id: 1,
        focus_variant_id: 7,
        focus_variant_label: "2024 Toyota Corolla Cross Hybrid Premium",
        compare_variant_ids: [7, 9],
        active_topic: {
          intent: "compare_car",
          focus_variant_id: 7,
          compare_variant_ids: [7, 9],
          market_id: 1,
        },
      },
      async update(next) {
        Object.assign(this, next);
      },
    },
  ];
  const messages = [];

  const ctx = {
    sequelize: {},
    models: {
      AiChatSessions: {
        async findByPk(id) {
          return sessions.find((item) => item.session_id === id) ?? null;
        },
      },
      AiChatMessages: {
        async create(payload) {
          messages.push(payload);
          return payload;
        },
      },
    },
  };

  const response = await chatAdvisor(ctx, {
    session_id: 21,
    user_id: 9,
    message: "Explain the difference between hybrid and plug-in hybrid",
    context: {},
  });

  assert.equal(response.intent, "vehicle_general_qa");
  assert.match(response.answer, /plug-?in hybrid|phev/i);
  assert.equal(sessions[0].context_json.active_topic.intent, "vehicle_general_qa");
  assert.deepEqual(sessions[0].context_json.compare_variant_ids, []);
  assert.equal(sessions[0].context_json.focus_variant_id, null);
});

test("price outlook response includes aiInsight while numeric forecast stays backend-calculated if Qwen fails", async () => {
  const originalFetch = global.fetch;
  global.fetch = mockFetchFactory();

  const variantRow = {
    variant_id: 901,
    model_id: 9010,
    model_year: 2022,
    trim_name: "Market Test",
    body_type: "suv",
    fuel_type: "gasoline",
    engine: "2.0L",
    transmission: "AT",
    drivetrain: "FWD",
    seats: 5,
    doors: 5,
    msrp_base: 1000000000,
    model_name: "Insight",
    make_name: "CarVista",
    latest_price: 880000000,
  };
  const historyRows = Array.from({ length: 8 }, (_, index) => ({
    toJSON: () => ({
      price_id: index + 1,
      variant_id: 901,
      market_id: 1,
      price_type: "avg_market",
      price: String(960000000 - index * 10000000),
      captured_at: new Date(Date.UTC(2025, index, 1)).toISOString(),
      source: "local_seed_history_v1",
    }),
  }));

  const ctx = {
    services: {
      ollama: {
        provider: "fpt",
        model: "Qwen3-32B",
        apiKey: "test-key",
        async generate() {
          throw new Error("Qwen unavailable");
        },
      },
    },
    sequelize: {
      async query(sql) {
        if (sql.includes("WHERE cv.variant_id = :variant_id")) {
          return [[variantRow]];
        }
        if (sql.includes("WHERE cv.model_id = :model_id")) {
          return [[
            {
              variant_id: 902,
              model_id: 9010,
              model_year: 2021,
              trim_name: "Comparable",
              body_type: "suv",
              fuel_type: "gasoline",
              msrp_base: 980000000,
              latest_price: 870000000,
              model_name: "Insight",
              make_name: "CarVista",
            },
          ]];
        }
        return [[]];
      },
    },
    models: {
      Markets: {
        async findByPk() {
          return { market_id: 1, name: "Vietnam", country_code: "VN", currency_code: "VND" };
        },
      },
      VariantSpecs: { async findOne() { return null; } },
      VariantSpecKv: { async findAll() { return []; } },
      CarReviews: { async findAll() { return []; } },
      VariantPriceHistory: { async findAll() { return historyRows; } },
      Listings: { async findAll() { return []; } },
    },
  };

  try {
    const result = await predictPrice(ctx, {
      variant_id: 901,
      market_id: 1,
      horizon_months: 6,
    });

    assert.equal(typeof result.predicted_price, "number");
    assert.equal(result.meta.aiUsed, false);
    assert.equal(result.meta.fallbackUsed, true);
    assert.match(result.aiInsight.summary, /AI explanation was unavailable|best current estimate/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test("TCO response includes aiInsight while totals stay backend-calculated if Qwen fails", async () => {
  const ctx = {
    services: {
      ollama: {
        provider: "fpt",
        model: "Qwen3-32B",
        apiKey: "test-key",
        async generate() {
          throw new Error("Qwen unavailable");
        },
      },
    },
    models: {
      Markets: {
        async findByPk() {
          return { market_id: 1, name: "Vietnam", currency_code: "VND" };
        },
      },
      TcoProfiles: {
        async findOne() {
          return { profile_id: 1, name: "Vietnam demo profile", market_id: 1 };
        },
      },
      TcoRules: {
        async findAll() {
          return [
            { cost_type: "registration_tax", rule_kind: "rate", rate: 0.1, fixed_amount: null, formula_json: null, applies_to: "vehicle" },
            { cost_type: "vat", rule_kind: "rate", rate: 0.1, fixed_amount: null, formula_json: null, applies_to: "vehicle" },
            { cost_type: "insurance", rule_kind: "fixed", rate: null, fixed_amount: 12000000, formula_json: null, applies_to: "vehicle" },
            { cost_type: "maintenance", rule_kind: "formula", rate: null, fixed_amount: null, formula_json: { formula: "per_km", rate: 900 }, applies_to: "vehicle" },
            { cost_type: "depreciation", rule_kind: "formula", rate: null, fixed_amount: null, formula_json: { formula: "straight_line", rate: 0.1 }, applies_to: "vehicle" },
          ];
        },
      },
    },
  };

  const result = await calculateTco(ctx, {
    market_id: 1,
    base_price: 1000000000,
    ownership_years: 3,
    km_per_year: 12000,
  });

  assert.equal(typeof result.total_cost, "number");
  assert.equal(result.costs.vat, 100000000);
  assert.equal(result.meta.aiUsed, false);
  assert.equal(result.meta.fallbackUsed, true);
  assert.match(result.aiInsight.summary, /drive-away|ownership|AI explanation was unavailable/i);
});

test("tco service returns a partial safe result when market tax config is missing", async () => {
  const ctx = {
    models: {
      Markets: {
        async findByPk() {
          return { market_id: 1, name: "Vietnam", currency_code: "VND" };
        },
      },
      TcoProfiles: {
        async findOne() {
          return null;
        },
      },
      TcoRules: {
        async findAll() {
          return [];
        },
      },
    },
  };

  const result = await calculateTco(ctx, {
    market_id: 1,
    base_price: 1000000000,
    ownership_years: 5,
  });

  assert.equal(result.status, "partial");
  assert.equal(result.code, "PROFILE_NOT_FOUND");
  assert.equal(result.costs.registration_tax, null);
  assert.equal(result.total_cost, null);
});

test("error mapper converts raw backend exceptions into friendly chat fallback", () => {
  const response = mapAiChatErrorToResponse({
    error: new TypeError("Cannot read properties of undefined (reading 'registration_tax')"),
    intent: "calculate_tco",
    session_id: 3,
    advisor_profile: {},
    market_id: 1,
    flow_id: "flow_tco_error",
  });

  assert.equal(response.intent, "calculate_tco");
  assert.match(response.answer, /ownership cost|tax data/i);
  assert.ok(!response.answer.includes("registration_tax"));
  assert.equal(response.needs_clarification, true);
});
