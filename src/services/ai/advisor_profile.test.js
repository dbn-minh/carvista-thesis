import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePreferenceProfile,
  pickNextDiscoveryQuestion,
  pickNextDiscoveryQuestions,
  extractAdvisorProfilePatch,
} from "./advisor_profile.service.js";

test("advisor profile normalization derives aliases and priority weights", () => {
  const profile = normalizePreferenceProfile({
    primary_use_cases: ["family", "road_trip"],
    budget_target: 900000000,
    budget_ceiling: 1000000000,
    regular_passenger_count: 5,
    preferred_body_types: ["SUV"],
    preferred_fuel_types: ["Hybrid"],
    safety_priority: 0.95,
    comfort_priority: 0.82,
  });

  assert.equal(profile.budget_max, 1000000000);
  assert.equal(profile.passenger_count, 5);
  assert.equal(profile.preferred_body_type, "suv");
  assert.equal(profile.preferred_fuel_type, "hybrid");
  assert.equal(profile.data_confidence_level, "medium");
  assert.ok(profile.inferred_priority_weights.safety_fit > profile.inferred_priority_weights.brand_emotional_fit);
});

test("advisor question policy prefers missing high-information questions first", () => {
  const nextQuestion = pickNextDiscoveryQuestion({
    primary_use_cases: ["daily_commute"],
  });

  assert.equal(nextQuestion?.key, "budget_range");
});

test("advisor question policy can group a few missing questions without asking everything", () => {
  const nextQuestions = pickNextDiscoveryQuestions(
    {
      primary_use_cases: ["daily_commute"],
    },
    undefined,
    "required",
    3
  );

  assert.deepEqual(
    nextQuestions.map((question) => question.key),
    ["budget_range", "passenger_setup", "driving_conditions"]
  );
});

test("advisor profile extraction can infer practical needs from natural language", () => {
  const patch = extractAdvisorProfilePatch(
    "I need a family SUV for city use, around 900 million VND, mostly for 5 people with kids, and safety matters most.",
    null,
    {}
  );

  assert.ok(patch.primary_use_cases.includes("family"));
  assert.ok(patch.primary_use_cases.includes("city_driving") || patch.primary_use_cases.includes("daily_commute"));
  assert.equal(patch.budget_target, 900000000);
  assert.equal(patch.regular_passenger_count, 5);
  assert.equal(patch.child_present, true);
  assert.ok(patch.preferred_body_types.includes("suv"));
  assert.ok(patch.safety_priority >= 0.9);
});

test("advisor profile extraction understands Vietnamese buying needs", () => {
  const patch = extractAdvisorProfilePatch(
    "Toi mua xe cho gia dinh 5 nguoi, di pho o Ha Noi, ngan sach khoang 900 trieu, uu tien an toan va tiet kiem xang, thich SUV.",
    null,
    {}
  );

  assert.ok(patch.primary_use_cases.includes("family"));
  assert.ok(patch.primary_use_cases.includes("city_driving") || patch.primary_use_cases.includes("daily_commute"));
  assert.equal(patch.budget_target, 900000000);
  assert.equal(patch.regular_passenger_count, 5);
  assert.equal(patch.city_vs_highway_ratio, "mostly_city");
  assert.ok(patch.preferred_body_types.includes("suv"));
  assert.ok(patch.safety_priority >= 0.9);
  assert.ok(patch.fuel_saving_priority >= 0.9);
});
