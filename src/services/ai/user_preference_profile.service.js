function toNumber(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeText(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

function setIfPresent(target, key, value) {
  if (value == null || value === "") return;
  target[key] = value;
}

export function normalizePreferenceProfile(profile = {}) {
  const normalized = {};

  const budget = toNumber(profile.budget_max);
  const passengers = toNumber(profile.passenger_count);

  setIfPresent(normalized, "budget_max", budget != null && budget > 0 ? budget : null);
  setIfPresent(normalized, "passenger_count", passengers != null && passengers > 0 ? Math.round(passengers) : null);
  setIfPresent(normalized, "environment", normalizeText(profile.environment));
  setIfPresent(normalized, "long_trip_habit", normalizeText(profile.long_trip_habit));
  setIfPresent(normalized, "preferred_body_type", normalizeText(profile.preferred_body_type));
  setIfPresent(normalized, "preferred_fuel_type", normalizeText(profile.preferred_fuel_type));
  setIfPresent(normalized, "maintenance_sensitivity", normalizeText(profile.maintenance_sensitivity));
  setIfPresent(normalized, "personality", normalizeText(profile.personality));
  setIfPresent(normalized, "brand_openness", normalizeText(profile.brand_openness));
  setIfPresent(normalized, "new_vs_used", normalizeText(profile.new_vs_used));

  return normalized;
}

export function parsePreferenceProfileQuery(query = {}) {
  return normalizePreferenceProfile({
    budget_max: query.budget_max ?? query.budgetMax,
    passenger_count: query.passenger_count ?? query.passengerCount,
    environment: query.environment,
    long_trip_habit: query.long_trip_habit ?? query.longTripHabit,
    preferred_body_type: query.preferred_body_type ?? query.preferredBodyType,
    preferred_fuel_type: query.preferred_fuel_type ?? query.preferredFuelType,
    maintenance_sensitivity: query.maintenance_sensitivity ?? query.maintenanceSensitivity,
    personality: query.personality,
    brand_openness: query.brand_openness ?? query.brandOpenness,
    new_vs_used: query.new_vs_used ?? query.newVsUsed,
  });
}

export function summarizePreferenceProfile(profile = {}) {
  return [
    profile?.budget_max ? `budget around ${profile.budget_max}` : null,
    profile?.environment ? `${profile.environment} driving` : null,
    profile?.preferred_body_type ? `${profile.preferred_body_type} preference` : null,
    profile?.preferred_fuel_type ? `${profile.preferred_fuel_type} preference` : null,
    profile?.long_trip_habit ? `${profile.long_trip_habit} trip cadence` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
