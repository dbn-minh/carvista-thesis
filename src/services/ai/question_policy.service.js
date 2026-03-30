function isAnswered(profile, key) {
  return profile?.[key] != null;
}

function basePriority(question) {
  return question.required ? 40 : 10;
}

function questionPriority(question, profile = {}) {
  let score = basePriority(question);

  if (question.key === "budget_max") {
    score += 60;
  }

  if (question.key === "passenger_count") {
    if (profile.preferred_body_type === "suv" || profile.preferred_body_type === "mpv") score += 18;
    if (profile.environment === "rural") score += 10;
  }

  if (question.key === "environment") {
    if (profile.preferred_body_type != null || profile.preferred_fuel_type != null) score += 18;
  }

  if (question.key === "long_trip_habit") {
    if (profile.environment === "mixed" || profile.environment === "city") score += 16;
    if (profile.preferred_fuel_type === "ev" || profile.preferred_fuel_type === "hybrid") score += 10;
  }

  if (question.key === "preferred_body_type") {
    if ((profile.passenger_count ?? 0) >= 5) score += 18;
    if (profile.environment === "rural") score += 12;
  }

  if (question.key === "preferred_fuel_type") {
    if (profile.environment === "city") score += 16;
    if (profile.long_trip_habit === "frequent") score += 12;
  }

  if (question.key === "new_vs_used") {
    if (profile.budget_max != null) score += 18;
    if (profile.personality === "premium") score += 10;
  }

  if (question.key === "maintenance_sensitivity") {
    if (profile.preferred_fuel_type === "ev" || profile.preferred_fuel_type === "phev") score += 18;
    if (profile.long_trip_habit === "frequent") score += 10;
  }

  if (question.key === "brand_openness") {
    if (profile.preferred_body_type != null || profile.preferred_fuel_type != null) score += 12;
    if (profile.personality === "premium") score += 14;
  }

  return score;
}

export function pickNextDiscoveryQuestion(profile, questions, mode = "required") {
  const candidates = (questions ?? [])
    .filter((question) => (mode === "required" ? question.required : !question.required))
    .filter((question) => !isAnswered(profile, question.key));

  if (!candidates.length) return null;

  return candidates
    .map((question) => ({
      question,
      priority: questionPriority(question, profile),
    }))
    .sort((left, right) => right.priority - left.priority)[0]?.question ?? null;
}
