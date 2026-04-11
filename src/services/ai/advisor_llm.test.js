import assert from "node:assert/strict";
import test from "node:test";
import {
  advisorExtractionToProfilePatch,
  enhanceAdvisorRecommendationWithModel,
  extractAdvisorProfilePatchWithModel,
  formatAdvisorNextQuestionWithModel,
  formatConversationPolicyWithModel,
  formatAdvisorRecommendationWithModel,
  parseModelJson,
} from "./advisor_llm.service.js";
import { OllamaService } from "./ollama.service.js";

test("advisor LLM extraction maps fuzzy customer input into profile fields", async () => {
  const ollama = {
    async generate() {
      return {
        text: JSON.stringify({
          use_case: "family",
          vehicle_type: "SUV",
          seat_count: 7,
          budget_min: null,
          budget_max: 900000000,
          ownership_preference: "durability",
          is_unsure: false,
        }),
      };
    },
  };

  const profile = await extractAdvisorProfilePatchWithModel("family SUV 7 seats under 900m durable", null, {}, { ollama });

  assert.ok(profile.primary_use_cases.includes("family"));
  assert.equal(profile.preferred_body_type, "suv");
  assert.equal(profile.needs_7_seats, true);
  assert.equal(profile.budget_max, 900000000);
  assert.ok(profile.tradeoff_preferences.includes("reliability_over_performance"));
  assert.ok(profile.reliability_priority >= 0.9);
});

test("advisor extraction mapper supports unsure and performance tradeoff outputs", () => {
  const unsurePatch = advisorExtractionToProfilePatch(
    {
      use_case: null,
      vehicle_type: null,
      seat_count: null,
      budget_min: null,
      budget_max: null,
      ownership_preference: null,
      is_unsure: true,
    },
    "passenger_setup"
  );
  const performancePatch = advisorExtractionToProfilePatch({
    use_case: "daily commute",
    vehicle_type: "sedan",
    seat_count: 5,
    budget_min: null,
    budget_max: 1000000000,
    ownership_preference: "sporty",
    is_unsure: false,
  });

  assert.deepEqual(unsurePatch.preferred_body_types, ["any"]);
  assert.deepEqual(performancePatch.primary_use_cases, ["daily_commute"]);
  assert.deepEqual(performancePatch.tradeoff_preferences, ["performance_over_reliability"]);
});

test("advisor extraction mapper treats faster-is-better language as performance-first", () => {
  const patch = advisorExtractionToProfilePatch({
    use_case: null,
    vehicle_type: null,
    seat_count: null,
    budget_min: null,
    budget_max: null,
    ownership_preference: "faster is better",
    is_unsure: false,
  });

  assert.deepEqual(patch.tradeoff_preferences, ["performance_over_reliability"]);
  assert.ok(patch.performance_priority >= 0.9);
});

test("advisor extraction mapper supports open-budget flagship language", () => {
  const patch = advisorExtractionToProfilePatch({
    use_case: null,
    vehicle_type: null,
    seat_count: null,
    seat_need: null,
    budget_min: null,
    budget_max: null,
    budget_mode: "open",
    price_positioning: "most expensive one",
    style_intent: "flagship halo",
    ownership_preference: null,
    is_unsure: false,
  });

  assert.equal(patch.budget_mode, "open");
  assert.equal(patch.price_positioning, "flagship");
  assert.equal(patch.style_intent, "halo");
  assert.equal(patch.budget_flexibility, "open");
  assert.ok(patch.style_priority >= 0.9);
});

test("advisor extraction mapper normalizes drifting into a performance lifestyle use case", () => {
  const patch = advisorExtractionToProfilePatch({
    use_case: "drifting",
    vehicle_type: null,
    seat_count: null,
    budget_min: null,
    budget_max: null,
    ownership_preference: "drifting and track fun",
    is_unsure: false,
  });

  assert.deepEqual(patch.primary_use_cases, ["lifestyle"]);
  assert.deepEqual(patch.tradeoff_preferences, ["performance_over_reliability"]);
});

test("advisor extraction mapper supports exclusions and must-have feature signals", () => {
  const patch = advisorExtractionToProfilePatch(
    {
      use_case: "family",
      vehicle_type: null,
      vehicle_type_requirement: "open",
      body_type_exclusions: ["SUV"],
      fuel_type: null,
      fuel_type_requirement: null,
      fuel_type_exclusions: ["EV"],
      seat_count: 7,
      seat_need: "minimum",
      seat_requirement: "soft",
      budget_min: null,
      budget_max: null,
      budget_mode: null,
      price_positioning: null,
      style_intent: null,
      must_have_features: ["360 camera"],
      nice_to_have_features: ["sunroof"],
      deal_breakers: ["manual_transmission"],
      ownership_preference: null,
      is_unsure: false,
    },
    "passenger_setup"
  );

  assert.deepEqual(patch.primary_use_cases, ["family"]);
  assert.deepEqual(patch.rejected_body_types, ["suv"]);
  assert.equal(patch.body_type_requirement, "open");
  assert.deepEqual(patch.rejected_fuel_types, ["ev"]);
  assert.equal(patch.seat_requirement, "soft");
  assert.ok(patch.must_have_features.includes("camera_360"));
  assert.ok(patch.nice_to_have_features.includes("sunroof"));
  assert.ok(patch.deal_breakers.includes("manual_transmission"));
});

test("advisor extraction mapper normalizes natural body-style and flexible-budget wording", () => {
  const patch = advisorExtractionToProfilePatch({
    use_case: "mostly for commuting to work",
    vehicle_type: "roadster",
    vehicle_type_requirement: "soft",
    body_type_exclusions: ["SUVs"],
    fuel_type: null,
    fuel_type_requirement: null,
    fuel_type_exclusions: null,
    seat_count: null,
    seat_need: null,
    seat_requirement: null,
    budget_min: null,
    budget_max: null,
    budget_mode: "I can stretch a bit",
    price_positioning: null,
    style_intent: null,
    must_have_features: null,
    nice_to_have_features: null,
    deal_breakers: null,
    ownership_preference: null,
    is_unsure: false,
  });

  assert.deepEqual(patch.primary_use_cases, ["daily_commute"]);
  assert.deepEqual(patch.preferred_body_types, ["coupe"]);
  assert.deepEqual(patch.rejected_body_types, ["suv"]);
  assert.equal(patch.budget_mode, "flexible");
  assert.equal(patch.budget_flexibility, "flexible");
});

test("advisor formatter refuses model-invented vehicles outside backend candidates", async () => {
  const structuredResult = {
    profile_summary: "main use: family",
    ranked_vehicles: [
      {
        variant_id: 7,
        name: "2024 Toyota Corolla Cross Hybrid Premium",
        fit_label: "Excellent fit",
        reasons: ["matches your family-focused use case"],
        best_for: ["family"],
        thumbnail_url: "/images/corolla-cross.jpg",
        links: { detail_page_url: "/catalog/7" },
      },
      {
        variant_id: 11,
        name: "2024 Mitsubishi Xpander Premium",
        fit_label: "Strong fit",
        reasons: ["covers your seating requirement"],
        best_for: ["family"],
        thumbnail_url: "/images/xpander.jpg",
        links: { detail_page_url: "/catalog/11" },
      },
    ],
  };
  const ollama = {
    async generate() {
      return {
        text: JSON.stringify({
          intro: "Based on your needs, these are the best matches for you.",
          items: [
            { variant_id: 999, title: "Imaginary Super SUV", reason: "Invented reason" },
          ],
        }),
      };
    },
  };

  const text = await formatAdvisorRecommendationWithModel(structuredResult, {}, { ollama });

  assert.doesNotMatch(text, /Imaginary Super SUV|Invented reason/);
  assert.match(text, /Toyota Corolla Cross/);
  assert.match(text, /Mitsubishi Xpander/);
});

test("advisor formatter can enrich allowed catalog card reasons", async () => {
  const structuredResult = {
    profile_summary: "main use: family, 7-seat flexibility matters",
    ranked_vehicles: [
      {
        variant_id: 11,
        name: "2024 Mitsubishi Xpander Premium",
        body_type: "mpv",
        fuel_type: "gasoline",
        seats: 7,
        latest_price: 985000000,
        fit_label: "Strong fit",
        reasons: ["covers your seating requirement"],
        best_for: ["family"],
        thumbnail_url: "/images/xpander.jpg",
        links: { detail_page_url: "/catalog/11" },
      },
    ],
  };
  const ollama = {
    async generate() {
      return {
        text: JSON.stringify({
          intro: "Based on your family needs, this is the cleanest fit.",
          items: [
            {
              variant_id: 11,
              title: "2024 Mitsubishi Xpander Premium",
              reason: "A practical 7-seat MPV fit for family trips without stretching the budget",
            },
          ],
        }),
      };
    },
  };

  const result = await enhanceAdvisorRecommendationWithModel(structuredResult, {}, { ollama });

  assert.match(result.final_answer, /practical 7-seat MPV/i);
  assert.equal(
    result.structured_result.ranked_vehicles[0].reasons[0],
    "A practical 7-seat MPV fit for family trips without stretching the budget"
  );
});

test("conversation policy formatter uses Ollama for a softer dealership redirect", async () => {
  const ollama = {
    async generate() {
      return {
        text: JSON.stringify({
          answer: "I can't help much with dinner, but I can make choosing your next car painless. Tell me how you'll use it most.",
        }),
      };
    },
  };

  const answer = await formatConversationPolicyWithModel(
    "out_of_scope",
    "What should I cook tonight?",
    { final_answer: "I can help with cars and vehicle ownership." },
    { ollama }
  );

  assert.match(answer, /choosing your next car/i);
  assert.doesNotMatch(answer, /recipe/i);
});

test("advisor question formatter uses Qwen for one concise next question", async () => {
  const ollama = {
    async generate() {
      return {
        text: JSON.stringify({
          answer: "Got it, family use. What type of vehicle do you prefer?",
        }),
      };
    },
  };

  const answer = await formatAdvisorNextQuestionWithModel(
    {
      profile: { primary_use_cases: ["family"] },
      nextQuestion: {
        key: "passenger_setup",
        question: "What type of vehicle do you prefer?",
        examples: ["SUV", "MPV", "7-seater"],
      },
      latestMessage: "family",
      fallback: "Got it, family use. What type of vehicle do you prefer?",
    },
    { ollama }
  );

  assert.equal(answer, "Got it, family use. What type of vehicle do you prefer?");
});

test("advisor question formatter gives Qwen a data goal instead of a fixed script", async () => {
  let seenPrompt = "";
  let seenOptions = null;
  const ollama = {
    async generate(request) {
      seenPrompt = request.prompt;
      seenOptions = request.options;
      return {
        text: JSON.stringify({
          answer: "Budget noted. Should I lean toward something quick and exciting, or easier to own long term?",
        }),
      };
    },
  };

  const answer = await formatAdvisorNextQuestionWithModel(
    {
      profile: { budget_ceiling: 1000000000 },
      nextQuestion: {
        key: "tradeoff_preferences",
        question: "Do you prefer durability and low maintenance, or stronger performance and a sportier feel?",
        examples: ["durability", "performance"],
      },
      latestMessage: "around 1 billion",
      fallback: "Do you prefer durability and low maintenance, or stronger performance and a sportier feel?",
    },
    { ollama }
  );

  assert.match(answer, /quick and exciting/i);
  assert.match(seenPrompt, /data_goal:/);
  assert.doesNotMatch(seenPrompt, /Do not choose another field/);
  assert.ok(seenOptions.temperature >= 0.7);
});

test("advisor question formatter rejects checklist-style model output", async () => {
  const ollama = {
    async generate() {
      return {
        text: JSON.stringify({
          answer: "I still need a few details: 1. What type do you want? 2. What is your budget?",
        }),
      };
    },
  };

  const answer = await formatAdvisorNextQuestionWithModel(
    {
      profile: {},
      nextQuestion: {
        key: "passenger_setup",
        question: "What type of vehicle do you prefer?",
        examples: ["SUV", "MPV", "7-seater"],
      },
      latestMessage: "family",
      fallback: "What type of vehicle do you prefer?",
    },
    { ollama }
  );

  assert.equal(answer, "What type of vehicle do you prefer?");
});

test("advisor JSON parser strips qwen thinking blocks", () => {
  const parsed = parseModelJson('<think>private reasoning</think>\n{"use_case":"family","is_unsure":false}');
  assert.equal(parsed.use_case, "family");
  assert.equal(parsed.is_unsure, false);
});

test("ollama service retries transient local errors and returns generated text", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 503,
        text: async () => "warming up",
      };
    }
    return {
      ok: true,
      json: async () => ({ response: '{"ok":true}' }),
    };
  };

  try {
    const service = new OllamaService({
      baseUrl: "http://localhost:11434",
      model: "qwen3:1.7b",
      timeoutMs: 1000,
      retryCount: 1,
      retryDelayMs: 1,
    });
    const result = await service.generate({ prompt: "hi", format: "json" });
    assert.equal(result.text, '{"ok":true}');
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("ollama health check reports graceful failure", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("Ollama offline");
  };

  try {
    const service = new OllamaService({
      baseUrl: "http://localhost:11434",
      model: "qwen3:1.7b",
      timeoutMs: 1000,
      retryCount: 0,
    });
    const result = await service.health();
    assert.equal(result.ok, false);
    assert.match(result.error, /Ollama offline/);
  } finally {
    global.fetch = originalFetch;
  }
});
