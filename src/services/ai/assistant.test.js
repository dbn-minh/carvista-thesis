import assert from "node:assert/strict";
import test from "node:test";
import { orchestrateChatRequest } from "./chat_orchestrator.service.js";
import { chatAdvisor } from "./car_advisor_chat.service.js";
import { mapAiChatErrorToResponse } from "./error_mapper.service.js";
import { classifyIntent } from "./intent_classifier.service.js";
import { classifyConversationRoute } from "./conversation_orchestrator.service.js";
import { classifyConversationTurn } from "./conversation_state.service.js";
import { compareVariants } from "./compare_variants.service.js";
import { fetchOfficialVehicleSignals, loadListingMarketSignals } from "./source_retrieval.service.js";
import { recommendCars } from "./recommendation.service.js";
import { calculateTco } from "./tco.service.js";

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

test("conversation router distinguishes vehicle advice from off-topic chat", () => {
  assert.equal(classifyConversationRoute("How reliable is this car on long trips?", { focus_variant_id: 7 }), "vehicle_question");
  assert.equal(classifyConversationRoute("What is the weather today?"), "off_topic");
  assert.equal(classifyConversationRoute("Compare these two cars for me"), "compare");
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
     assert.ok(result.confidence.score > 0.5);
     assert.ok(result.sources.length >= 2);
     assert.ok(result.items[0].scores.use_case_fit_score >= 0);
      assert.ok(result.items[0].scores.comfort_score >= 0);
      assert.ok(result.items[0].scores.resale_score >= 0);
   } finally {
    global.fetch = originalFetch;
  }
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
  assert.match(result.final_answer, /cars|vehicle/i);
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
  assert.ok(result.ranked_vehicles[0].links?.related_listings_url?.includes("/listings?variantId=7"));
  assert.deepEqual(result.ranked_vehicles[0].links?.related_listing_ids, [101, 102]);
  assert.ok(result.ranked_vehicles[0].reasons.some((reason) => /owner sentiment|market/i.test(reason)));
  assert.ok(result.ranked_vehicles[0].market_summary?.includes("live-style"));
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
              retrieved_at: new Date().toISOString(),
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
