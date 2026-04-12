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

  assert.equal(nextQuestion?.key, "passenger_setup");
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
    ["passenger_setup", "budget_range", "tradeoff_preferences"]
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

test("advisor profile extraction understands compact English buying needs", () => {
  const patch = extractAdvisorProfilePatch(
    "Family use for 5 people, mostly city driving, around 900 million, safety and fuel economy matter, prefer SUV.",
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

test("advisor profile extraction understands fun and performance driving use cases", () => {
  const patch = extractAdvisorProfilePatch("for drifting", "primary_use_cases", {});

  assert.ok(patch.primary_use_cases.includes("lifestyle"));
  assert.ok(patch.performance_priority >= 0.9);
  assert.ok(patch.tradeoff_preferences.includes("performance_over_reliability"));
});

test("advisor profile extraction treats supercar and race-car needs as performance-first", () => {
  const patch = extractAdvisorProfilePatch("I want a supercar for track days", "primary_use_cases", {});

  assert.ok(patch.primary_use_cases.includes("lifestyle"));
  assert.ok(patch.preferred_body_types.includes("coupe"));
  assert.ok(patch.performance_priority >= 0.9);
  assert.ok(patch.tradeoff_preferences.includes("performance_over_reliability"));
});

test("advisor profile extraction understands durable versus performance tradeoff", () => {
  const durablePatch = extractAdvisorProfilePatch(
    "I prefer durability and low maintenance.",
    null,
    {}
  );
  const performancePatch = extractAdvisorProfilePatch(
    "I prefer stronger performance and a sportier feel.",
    null,
    {}
  );
  const fasterPatch = extractAdvisorProfilePatch("faster is better", "tradeoff_preferences", {});

  assert.ok(durablePatch.tradeoff_preferences.includes("reliability_over_performance"));
  assert.ok(!durablePatch.tradeoff_preferences.includes("performance_over_reliability"));
  assert.ok(durablePatch.reliability_priority >= 0.9);
  assert.ok(performancePatch.tradeoff_preferences.includes("performance_over_reliability"));
  assert.ok(performancePatch.performance_priority >= 0.9);
  assert.ok(fasterPatch.tradeoff_preferences.includes("performance_over_reliability"));
  assert.ok(fasterPatch.performance_priority >= 0.9);
});

test("advisor profile extraction treats unsure answers as open preferences", () => {
  const bodyPatch = extractAdvisorProfilePatch("I'm not sure", "passenger_setup", {});
  const budgetPatch = extractAdvisorProfilePatch("not too expensive", "budget_range", {});
  const tradeoffPatch = extractAdvisorProfilePatch("no preference", "tradeoff_preferences", {});

  assert.equal(bodyPatch.preferred_body_type, "any");
  assert.equal(budgetPatch.budget_flexibility, "low");
  assert.ok(tradeoffPatch.tradeoff_preferences.includes("balanced"));
});

test("advisor profile extraction understands open-budget and flagship language", () => {
  const profile = extractAdvisorProfilePatch(
    "the most expensive one",
    "budget_range",
    {
      primary_use_cases: ["lifestyle"],
      preferred_body_types: ["coupe"],
    }
  );
  const nextQuestion = pickNextDiscoveryQuestion(profile);
  const unlimited = extractAdvisorProfilePatch("unlimited", "budget_range", {});

  assert.equal(profile.budget_mode, "open");
  assert.equal(profile.price_positioning, "flagship");
  assert.equal(profile.style_intent, "halo");
  assert.equal(nextQuestion?.key, "tradeoff_preferences");
  assert.equal(unlimited.budget_mode, "open");
  assert.equal(unlimited.budget_flexibility, "open");
});

test("advisor profile extraction understands exclusions soft seating and must-have features", () => {
  const exclusionPatch = extractAdvisorProfilePatch("anything except SUV", "passenger_setup", {});
  const seatingPatch = extractAdvisorProfilePatch("7 seats would be nice for backup", "passenger_setup", {});
  const featurePatch = extractAdvisorProfilePatch("must have 360 camera and no EV", "must_have_features", {});

  assert.deepEqual(exclusionPatch.rejected_body_types, ["suv"]);
  assert.deepEqual(exclusionPatch.preferred_body_types, []);
  assert.equal(exclusionPatch.body_type_requirement, "open");

  assert.equal(seatingPatch.needs_7_seats, true);
  assert.equal(seatingPatch.seat_requirement, "soft");

  assert.ok(featurePatch.must_have_features.includes("camera_360"));
  assert.ok(featurePatch.deal_breakers.includes("ev_powertrain"));
});

test("advisor profile extraction expands natural English use-case phrases without changing enum outputs", () => {
  const commutePatch = extractAdvisorProfilePatch("Mostly for commuting to work.", "primary_use_cases", {});
  const familyPatch = extractAdvisorProfilePatch("It’s mainly for my family.", "primary_use_cases", {});
  const highwayPatch = extractAdvisorProfilePatch("I do a lot of highway driving.", "primary_use_cases", {});
  const businessPatch = extractAdvisorProfilePatch("Mainly for meeting clients.", "primary_use_cases", {});
  const taxiPatch = extractAdvisorProfilePatch("I’ll mostly use it for ride-hailing.", "primary_use_cases", {});
  const funPatch = extractAdvisorProfilePatch("I want something fun to drive on weekends.", "primary_use_cases", {});

  assert.equal(commutePatch.primary_use_cases[0], "daily_commute");
  assert.equal(familyPatch.primary_use_cases[0], "family");
  assert.equal(highwayPatch.primary_use_cases[0], "road_trip");
  assert.equal(businessPatch.primary_use_cases[0], "business");
  assert.equal(taxiPatch.primary_use_cases[0], "commercial_service");
  assert.equal(funPatch.primary_use_cases[0], "lifestyle");
});

test("advisor profile extraction keeps dominant intent first for mixed use-case answers", () => {
  const mixedCommute = extractAdvisorProfilePatch("A bit of everything, but mostly commuting.", "primary_use_cases", {});
  const mixedFamily = extractAdvisorProfilePatch("Mostly family use, with the occasional road trip.", "primary_use_cases", {});
  const mixedBusiness = extractAdvisorProfilePatch("Mostly for work, but I also want it for long drives.", "primary_use_cases", {});

  assert.equal(mixedCommute.primary_use_cases[0], "daily_commute");
  assert.equal(mixedFamily.primary_use_cases[0], "family");
  assert.ok(mixedFamily.primary_use_cases.includes("road_trip"));
  assert.equal(mixedBusiness.primary_use_cases[0], "business");
  assert.ok(mixedBusiness.primary_use_cases.includes("road_trip"));
});

test("advisor profile extraction expands natural vehicle-type phrases and exclusions safely", () => {
  const sportySedan = extractAdvisorProfilePatch("Probably a sporty sedan.", "passenger_setup", {});
  const compactSuv = extractAdvisorProfilePatch("A compact SUV would be nice.", "passenger_setup", {});
  const hatchOrSedan = extractAdvisorProfilePatch("Maybe a hatchback or sedan.", "passenger_setup", {});
  const avoidCoupes = extractAdvisorProfilePatch("I’d rather avoid coupes.", "passenger_setup", {});
  const peopleCarrier = extractAdvisorProfilePatch("Maybe a people carrier.", "passenger_setup", {});
  const estate = extractAdvisorProfilePatch("I’d actually prefer an estate.", "passenger_setup", {});
  const roadster = extractAdvisorProfilePatch("A roadster would be fun.", "passenger_setup", {});

  assert.equal(sportySedan.preferred_body_type, "sedan");
  assert.equal(compactSuv.preferred_body_type, "suv");
  assert.equal(hatchOrSedan.preferred_body_types[0], "hatchback");
  assert.ok(hatchOrSedan.preferred_body_types.includes("sedan"));
  assert.ok(avoidCoupes.rejected_body_types.includes("coupe"));
  assert.equal(peopleCarrier.preferred_body_type, "mpv");
  assert.equal(estate.preferred_body_type, "wagon");
  assert.equal(roadster.preferred_body_type, "coupe");
});

test("advisor profile extraction expands natural budget language while preserving existing fields", () => {
  const underForty = extractAdvisorProfilePatch("Under 40k.", "budget_range", {});
  const rangeThirtys = extractAdvisorProfilePatch("Around 30 to 35 thousand.", "budget_range", {});
  const nearBillion = extractAdvisorProfilePatch("Somewhere near 1 billion.", "budget_range", {});
  const belowEightHundred = extractAdvisorProfilePatch("I’d like to keep it below 800 million.", "budget_range", {});
  const flexible = extractAdvisorProfilePatch("I can stretch a bit for the right car.", "budget_range", {});
  const financeOnly = extractAdvisorProfilePatch("Monthly payment matters more than sticker price.", "budget_range", {});
  const articleBillion = extractAdvisorProfilePatch("around a billion", "budget_range", {});

  assert.equal(underForty.budget_ceiling, 40000);
  assert.equal(rangeThirtys.budget_target, 32500);
  assert.equal(rangeThirtys.budget_ceiling, 35000);
  assert.equal(nearBillion.budget_target, 1000000000);
  assert.equal(belowEightHundred.budget_ceiling, 800000000);
  assert.equal(flexible.budget_mode, "flexible");
  assert.equal(flexible.budget_flexibility, "flexible");
  assert.equal(financeOnly.payment_method, "finance");
  assert.equal(financeOnly.budget_target, null);
  assert.equal(articleBillion.budget_target, 1000000000);
});
