import { buildSource, mergeSources } from "./contracts.js";

const CACHE_TTL_MS = 1000 * 60 * 30;
const responseCache = new Map();

function cacheKey(prefix, payload) {
  return `${prefix}:${JSON.stringify(payload)}`;
}

async function withCache(prefix, payload, loader, ttlMs = CACHE_TTL_MS) {
  const key = cacheKey(prefix, payload);
  const hit = responseCache.get(key);
  if (hit && hit.expires_at > Date.now()) return hit.value;

  const value = await loader();
  responseCache.set(key, {
    value,
    expires_at: Date.now() + ttlMs,
  });
  return value;
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractXmlValue(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? xmlDecode(match[1]).trim() : null;
}

function extractXmlValues(xml, tag) {
  return [...String(xml || "").matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi"))].map((match) =>
    xmlDecode(match[1]).trim()
  );
}

function toNumberOrNull(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const PRICE_HISTORY_SOURCE_PRIORITIES = new Map([
  ["internal_marketplace_rollup", 400],
  ["bootstrap_seed_rollup", 300],
  ["local_seed_history_v1", 200],
]);

function priceHistorySourcePriority(source) {
  return PRICE_HISTORY_SOURCE_PRIORITIES.get(String(source || "").trim().toLowerCase()) ?? 100;
}

function normalizePriceHistoryRow(row) {
  if (!row) return null;
  const plain = typeof row.toJSON === "function" ? row.toJSON() : row;
  if (!plain?.captured_at) return null;

  const capturedAt = new Date(plain.captured_at);
  if (Number.isNaN(capturedAt.getTime())) return null;

  return {
    ...plain,
    captured_at: capturedAt.toISOString(),
  };
}

export function normalizeVariantPriceHistoryRows(rows, { limit = null } = {}) {
  const bestRowByTimestamp = new Map();

  for (const row of rows ?? []) {
    const normalized = normalizePriceHistoryRow(row);
    if (!normalized) continue;

    const key = normalized.captured_at;
    const existing = bestRowByTimestamp.get(key);
    if (!existing) {
      bestRowByTimestamp.set(key, normalized);
      continue;
    }

    const incomingPriority = priceHistorySourcePriority(normalized.source);
    const existingPriority = priceHistorySourcePriority(existing.source);
    const incomingId = Number(normalized.price_id ?? 0);
    const existingId = Number(existing.price_id ?? 0);

    if (incomingPriority > existingPriority || (incomingPriority === existingPriority && incomingId > existingId)) {
      bestRowByTimestamp.set(key, normalized);
    }
  }

  const ordered = [...bestRowByTimestamp.values()].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at)
  );

  return limit != null && ordered.length > limit ? ordered.slice(-limit) : ordered;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "CarVistaAI/1.0",
        accept: "application/json, text/xml, application/xml, text/plain",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

async function safeQuery(ctx, sql, replacements = {}) {
  try {
    const [rows] = await ctx.sequelize.query(sql, { replacements });
    return rows;
  } catch {
    return [];
  }
}

export function buildInternalSource(title, note = null) {
  return buildSource({
    provider: "CarVista DB",
    type: "internal_db",
    title,
    trust: "high",
    note,
  });
}

export async function searchVariantsByText(ctx, query, limit = 5) {
  const normalized = String(query || "").trim();
  if (!normalized) return [];

  const sql = `
    SELECT
      cv.variant_id,
      cv.model_year,
      cv.trim_name,
      cv.body_type,
      cv.fuel_type,
      cv.msrp_base,
      cm.name AS model_name,
      mk.name AS make_name
    FROM car_variants cv
    JOIN car_models cm ON cm.model_id = cv.model_id
    JOIN car_makes mk ON mk.make_id = cm.make_id
    WHERE CONCAT_WS(' ', cv.model_year, mk.name, cm.name, cv.trim_name, cv.body_type, cv.fuel_type) LIKE :query
    ORDER BY cv.model_year DESC, mk.name, cm.name
    LIMIT :limit
  `;

  const [rows] = await ctx.sequelize.query(sql, {
    replacements: {
      query: `%${normalized}%`,
      limit: Number(limit),
    },
  });

  const aliasRows = await safeQuery(
    ctx,
    `
      SELECT
        cv.variant_id,
        cv.model_year,
        cv.trim_name,
        cv.body_type,
        cv.fuel_type,
        cv.msrp_base,
        cm.name AS model_name,
        mk.name AS make_name
      FROM vehicle_market_aliases vma
      JOIN car_variants cv ON cv.variant_id = vma.variant_id
      JOIN car_models cm ON cm.model_id = cv.model_id
      JOIN car_makes mk ON mk.make_id = cm.make_id
      WHERE vma.alias_name LIKE :query
      ORDER BY cv.model_year DESC, mk.name, cm.name
      LIMIT :limit
    `,
    {
      query: `%${normalized}%`,
      limit: Number(limit),
    }
  );

  const merged = new Map();
  [...rows, ...aliasRows].forEach((row) => {
    if (!merged.has(row.variant_id)) merged.set(row.variant_id, row);
  });
  return [...merged.values()].slice(0, limit);
}

const MARKET_ALIASES = new Map([
  ["vietnam", "VN"],
  ["viet nam", "VN"],
  ["vn", "VN"],
  ["united states", "US"],
  ["usa", "US"],
  ["us", "US"],
  ["singapore", "SG"],
  ["sg", "SG"],
  ["united kingdom", "GB"],
  ["uk", "GB"],
]);

export async function resolveMarketByText(ctx, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return null;

  const countryCode = MARKET_ALIASES.get(normalized) ?? normalized.slice(0, 2).toUpperCase();
  const sql = `
    SELECT market_id, country_code, currency_code, name
    FROM markets
    WHERE LOWER(name) LIKE :query
       OR UPPER(country_code) = :country_code
    ORDER BY market_id ASC
    LIMIT 3
  `;

  const [rows] = await ctx.sequelize.query(sql, {
    replacements: {
      query: `%${normalized}%`,
      country_code: countryCode,
    },
  });

  return rows[0] ?? null;
}

export async function loadVariantContext(ctx, { variant_id, market_id = 1 }) {
  return withCache("variant_context", { variant_id, market_id }, async () => {
    const sql = `
      SELECT
        cv.variant_id,
        cv.model_id,
        cv.model_year,
        cv.trim_name,
        cv.body_type,
        cv.fuel_type,
        cv.engine,
        cv.transmission,
        cv.drivetrain,
        cv.seats,
        cv.doors,
        cv.msrp_base,
        cm.name AS model_name,
        mk.name AS make_name,
        latest.price AS latest_price
      FROM car_variants cv
      JOIN car_models cm ON cm.model_id = cv.model_id
      JOIN car_makes mk ON mk.make_id = cm.make_id
      LEFT JOIN (
        SELECT x.variant_id, x.price
        FROM variant_price_history x
        JOIN (
          SELECT variant_id, MAX(captured_at) AS max_captured_at
          FROM variant_price_history
          WHERE market_id = :market_id AND price_type = 'avg_market'
          GROUP BY variant_id
        ) latest_source
          ON latest_source.variant_id = x.variant_id
         AND latest_source.max_captured_at = x.captured_at
        WHERE x.market_id = :market_id AND x.price_type = 'avg_market'
      ) latest ON latest.variant_id = cv.variant_id
      WHERE cv.variant_id = :variant_id
      LIMIT 1
    `;

    const [variantRows] = await ctx.sequelize.query(sql, {
      replacements: { variant_id, market_id },
    });
    const variant = variantRows[0] ?? null;
    if (!variant) return null;

    const { VariantSpecs, VariantSpecKv, CarReviews, VariantPriceHistory } = ctx.models;

    const [spec, kvRows, reviews, historyRows] = await Promise.all([
      VariantSpecs.findOne({ where: { variant_id } }),
      VariantSpecKv.findAll({
        where: { variant_id },
        order: [["created_at", "DESC"]],
        limit: 40,
      }),
      CarReviews.findAll({
        where: { variant_id },
        order: [["created_at", "DESC"]],
        limit: 12,
      }),
      VariantPriceHistory.findAll({
        where: { variant_id, market_id, price_type: "avg_market" },
        order: [["captured_at", "DESC"], ["price_id", "DESC"]],
        limit: 120,
      }),
    ]);

    const reviewStats = reviews.reduce(
      (acc, review) => {
        const rating = Number(review.rating);
        if (Number.isFinite(rating)) {
          acc.sum += rating;
          acc.count += 1;
        }
        return acc;
      },
      { sum: 0, count: 0 }
    );

    const averageRating = reviewStats.count > 0 ? reviewStats.sum / reviewStats.count : null;
    const priceHistory = normalizeVariantPriceHistoryRows(historyRows, { limit: 36 });
    const latestHistoryPrice =
      priceHistory.length > 0 ? toNumberOrNull(priceHistory[priceHistory.length - 1]?.price) : null;

    return {
      variant: {
        ...variant,
        latest_price: latestHistoryPrice ?? variant.latest_price,
        label: [variant.model_year, variant.make_name, variant.model_name, variant.trim_name].filter(Boolean).join(" "),
      },
      spec: spec?.toJSON() ?? null,
      kv: kvRows.map((row) => row.toJSON()),
      reviews: reviews.map((row) => row.toJSON()),
      review_summary: {
        avg_rating: averageRating,
        review_count: reviewStats.count,
      },
      price_history: priceHistory,
      sources: [
        buildInternalSource("Vehicle identity and catalog specs"),
        buildInternalSource("Structured variant specification tables"),
        buildInternalSource("Internal review and price history tables"),
      ],
    };
  });
}

export async function loadComparableMarketContext(ctx, { variant, market_id = 1, limit = 8 }) {
  if (!variant?.model_id) return { items: [], sources: [] };

  const sql = `
    SELECT
      cv.variant_id,
      cv.model_year,
      cv.trim_name,
      cv.body_type,
      cv.fuel_type,
      cv.msrp_base,
      latest.price AS latest_price,
      cm.name AS model_name,
      mk.name AS make_name
    FROM car_variants cv
    JOIN car_models cm ON cm.model_id = cv.model_id
    JOIN car_makes mk ON mk.make_id = cm.make_id
    LEFT JOIN (
      SELECT x.variant_id, x.price
      FROM variant_price_history x
      JOIN (
        SELECT variant_id, MAX(captured_at) AS max_captured_at
        FROM variant_price_history
        WHERE market_id = :market_id AND price_type = 'avg_market'
        GROUP BY variant_id
      ) latest_source
        ON latest_source.variant_id = x.variant_id
       AND latest_source.max_captured_at = x.captured_at
      WHERE x.market_id = :market_id AND x.price_type = 'avg_market'
    ) latest ON latest.variant_id = cv.variant_id
    WHERE cv.model_id = :model_id
      AND cv.variant_id <> :variant_id
    ORDER BY cv.model_year DESC
    LIMIT :limit
  `;

  const [rows] = await ctx.sequelize.query(sql, {
    replacements: {
      market_id,
      model_id: variant.model_id,
      variant_id: variant.variant_id,
      limit: Number(limit),
    },
  });

  return {
    items: rows,
    sources: [buildInternalSource("Comparable variants from local market history")],
  };
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function normalizeSourceType(value) {
  if (value === "internal_marketplace" || value === "seed") return "internal_db";
  if (value === "manual") return "configured_feed";
  return value ?? "configured_feed";
}

function buildStoredSource(row, fallbackTitle) {
  return buildSource({
    provider: row?.provider_key ?? "CarVista ingestion",
    type: normalizeSourceType(row?.source_type),
    title: row?.title ?? fallbackTitle,
    url: row?.url ?? null,
    trust: row?.trust_level ?? "high",
    retrieved_at: row?.retrieved_at ?? new Date().toISOString(),
    note: row?.notes ?? null,
  });
}

async function loadStoredMarketSignal(ctx, { variant_id, market_id }) {
  const rows = await safeQuery(
    ctx,
    `
      SELECT
        vms.*,
        sr.provider_key,
        sr.source_type,
        sr.title,
        sr.url,
        sr.trust_level,
        sr.retrieved_at,
        sr.notes
      FROM vehicle_market_signals vms
      LEFT JOIN source_references sr ON sr.source_reference_id = vms.source_reference_id
      WHERE vms.variant_id = :variant_id
        AND vms.market_id = :market_id
      ORDER BY vms.snapshot_date DESC, vms.created_at DESC
      LIMIT 1
    `,
    { variant_id, market_id }
  );

  return rows[0] ?? null;
}

export async function loadListingMarketSignals(ctx, { variant_id, market_id = 1, limit = 20 }) {
  const storedSignal = await loadStoredMarketSignal(ctx, { variant_id, market_id });
  if (storedSignal) {
    return {
      item_count: Number(storedSignal.active_listing_count ?? 0),
      average_asking_price: toNumberOrNull(storedSignal.avg_asking_price),
      median_asking_price: toNumberOrNull(storedSignal.median_asking_price),
      min_asking_price: toNumberOrNull(storedSignal.min_asking_price),
      max_asking_price: toNumberOrNull(storedSignal.max_asking_price),
      avg_mileage_km: toNumberOrNull(storedSignal.avg_mileage_km),
      price_spread_pct: toNumberOrNull(storedSignal.price_spread_pct),
      data_confidence: toNumberOrNull(storedSignal.data_confidence),
      items: [],
      sources: [buildStoredSource(storedSignal, "Persisted marketplace signal snapshot")],
    };
  }

  const market = await ctx.models.Markets.findByPk(market_id).catch(() => null);
  const countryCode = market?.country_code ?? null;

  const { Listings } = ctx.models;
  const where = {
    variant_id,
    status: "active",
  };
  if (countryCode) {
    where.location_country_code = countryCode;
  }

  const listings = await Listings.findAll({
    where,
    attributes: ["listing_id", "asking_price", "mileage_km", "location_city", "created_at"],
    order: [["created_at", "DESC"]],
    limit,
  });

  const items = listings.map((row) => row.toJSON());
  const askingPrices = items.map((item) => Number(item.asking_price));

  return {
    item_count: items.length,
    average_asking_price: average(askingPrices),
    median_asking_price: askingPrices.length ? askingPrices.slice().sort((a, b) => a - b)[Math.floor(askingPrices.length / 2)] : null,
    min_asking_price: askingPrices.length ? Math.min(...askingPrices) : null,
    max_asking_price: askingPrices.length ? Math.max(...askingPrices) : null,
    avg_mileage_km: average(items.map((item) => Number(item.mileage_km)).filter((value) => Number.isFinite(value))),
    price_spread_pct:
      askingPrices.length > 1
        ? (Math.max(...askingPrices) - Math.min(...askingPrices)) / average(askingPrices)
        : null,
    data_confidence: items.length >= 6 ? 0.82 : items.length >= 3 ? 0.66 : items.length >= 1 ? 0.48 : 0.22,
    items,
    sources:
      items.length > 0
        ? [buildInternalSource("Live marketplace listing signals for this variant")]
        : [],
  };
}

async function loadStoredOfficialSignals(ctx, { variant_id }) {
  const [fuelRows, recallRows] = await Promise.all([
    safeQuery(
      ctx,
      `
        SELECT
          vfes.*,
          sr.provider_key,
          sr.source_type,
          sr.title,
          sr.url,
          sr.trust_level,
          sr.retrieved_at,
          sr.notes
        FROM vehicle_fuel_economy_snapshots vfes
        LEFT JOIN source_references sr ON sr.source_reference_id = vfes.source_reference_id
        WHERE vfes.variant_id = :variant_id
        ORDER BY vfes.created_at DESC
        LIMIT 1
      `,
      { variant_id }
    ),
    safeQuery(
      ctx,
      `
        SELECT
          vrs.*,
          sr.provider_key,
          sr.source_type,
          sr.title,
          sr.url,
          sr.trust_level,
          sr.retrieved_at,
          sr.notes
        FROM vehicle_recall_snapshots vrs
        LEFT JOIN source_references sr ON sr.source_reference_id = vrs.source_reference_id
        WHERE vrs.variant_id = :variant_id
        ORDER BY vrs.created_at DESC
        LIMIT 20
      `,
      { variant_id }
    ),
  ]);

  const fuelRow = fuelRows[0] ?? null;
  const fuelEconomy = fuelRow
    ? {
        combined_mpg: toNumberOrNull(fuelRow.combined_mpg),
        city_mpg: toNumberOrNull(fuelRow.city_mpg),
        highway_mpg: toNumberOrNull(fuelRow.highway_mpg),
        annual_fuel_cost_usd: toNumberOrNull(fuelRow.annual_fuel_cost_usd),
        fuel_type: fuelRow.fuel_type ?? null,
        drive: fuelRow.drive ?? null,
        class_name: fuelRow.class_name ?? null,
      }
    : null;

  return {
    fuel_economy: fuelEconomy,
    recalls: recallRows.map((row) => ({
      campaign_number: row.campaign_number,
      component: row.component,
      summary: row.summary,
      consequence: row.consequence,
      remedy: row.remedy,
    })),
    sources: [
      ...(fuelRow ? [buildStoredSource(fuelRow, "Persisted fuel-economy snapshot")] : []),
      ...(recallRows[0] ? [buildStoredSource(recallRows[0], "Persisted recall snapshot")] : []),
    ],
  };
}

export async function fetchOfficialVehicleSignals({ ctx = null, variant_id = null, year, make, model }) {
  if (!year || !make || !model) {
    return {
      fuel_economy: null,
      recalls: [],
      sources: [],
      caveats: [],
    };
  }

  return withCache("official_vehicle_signals", { variant_id, year, make, model }, async () => {
    const storedSignals =
      ctx && Number.isInteger(variant_id)
        ? await loadStoredOfficialSignals(ctx, { variant_id })
        : { fuel_economy: null, recalls: [], sources: [] };

    const sources = [...(storedSignals.sources ?? [])];
    const caveats = [];
    let fuelEconomy = storedSignals.fuel_economy ?? null;
    let recalls = storedSignals.recalls ?? [];

    if (!fuelEconomy) try {
      const menuUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/menu/options?year=${encodeURIComponent(
        year
      )}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
      const menuXml = await fetchText(menuUrl);
      const optionIds = extractXmlValues(menuXml, "value");
      const firstId = optionIds[0];

      if (firstId) {
        const detailUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/${encodeURIComponent(firstId)}`;
        const detailXml = await fetchText(detailUrl);
        fuelEconomy = {
          combined_mpg: toNumberOrNull(extractXmlValue(detailXml, "comb08")),
          city_mpg: toNumberOrNull(extractXmlValue(detailXml, "city08")),
          highway_mpg: toNumberOrNull(extractXmlValue(detailXml, "highway08")),
          annual_fuel_cost_usd: toNumberOrNull(extractXmlValue(detailXml, "fuelCost08")),
          fuel_type: extractXmlValue(detailXml, "fuelType1"),
          drive: extractXmlValue(detailXml, "drive"),
          class_name: extractXmlValue(detailXml, "VClass"),
        };
        sources.push(
          buildSource({
            provider: "FuelEconomy.gov",
            type: "official_api",
            title: `Official fuel economy profile for ${year} ${make} ${model}`,
            url: detailUrl,
            trust: "high",
          })
        );
      }
    } catch {
      caveats.push("Official FuelEconomy.gov data was unavailable for this lookup.");
    }

    if (recalls.length === 0) try {
      const recallUrl = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(
        make
      )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
      const recallPayload = await fetchJson(recallUrl);
      recalls = Array.isArray(recallPayload?.results)
        ? recallPayload.results.slice(0, 5).map((item) => ({
            campaign_number: item.NHTSACampaignNumber,
            component: item.Component,
            summary: item.Summary,
            consequence: item.Consequence,
            remedy: item.Remedy,
          }))
        : [];

      sources.push(
        buildSource({
          provider: "NHTSA",
          type: "official_api",
          title: `Official safety recall lookup for ${year} ${make} ${model}`,
          url: recallUrl,
          trust: "high",
        })
      );
    } catch {
      caveats.push("Official NHTSA recall data was unavailable for this lookup.");
    }

    return {
      fuel_economy: fuelEconomy,
      recalls,
      sources,
      caveats,
    };
  });
}

export async function loadTcoProfileWithRules(ctx, market_id) {
  const { TcoProfiles, TcoRules } = ctx.models;
  const profile = await TcoProfiles.findOne({
    where: { market_id },
    order: [["profile_id", "ASC"]],
  });

  if (!profile) {
    return {
      profile: null,
      rules: [],
      sources: [],
    };
  }

  const rules = await TcoRules.findAll({
    where: { profile_id: profile.profile_id },
    order: [["cost_type", "ASC"], ["created_at", "DESC"]],
  });

  return {
    profile,
    rules,
    sources: [buildInternalSource("Country-specific TCO rules from local configuration")],
  };
}

export function combineKnowledgeSources(...groups) {
  return mergeSources(...groups.flatMap((group) => group?.sources ?? []));
}
