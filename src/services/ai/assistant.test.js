import assert from "node:assert/strict";
import test from "node:test";
import { orchestrateChatRequest } from "./chat_orchestrator.service.js";
import { chatAdvisor } from "./car_advisor_chat.service.js";
import { mapAiChatErrorToResponse } from "./error_mapper.service.js";
import { classifyIntent } from "./intent_classifier.service.js";
import { classifyConversationRoute } from "./conversation_orchestrator.service.js";
import { compareVariants } from "./compare_variants.service.js";
import { fetchOfficialVehicleSignals } from "./source_retrieval.service.js";
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
