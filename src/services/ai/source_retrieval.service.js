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

  return rows;
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
        order: [["captured_at", "ASC"]],
        limit: 36,
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

    return {
      variant: {
        ...variant,
        label: [variant.model_year, variant.make_name, variant.model_name, variant.trim_name].filter(Boolean).join(" "),
      },
      spec: spec?.toJSON() ?? null,
      kv: kvRows.map((row) => row.toJSON()),
      reviews: reviews.map((row) => row.toJSON()),
      review_summary: {
        avg_rating: averageRating,
        review_count: reviewStats.count,
      },
      price_history: historyRows.map((row) => row.toJSON()),
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

export async function fetchOfficialVehicleSignals({ year, make, model }) {
  if (!year || !make || !model) {
    return {
      fuel_economy: null,
      recalls: [],
      sources: [],
      caveats: [],
    };
  }

  return withCache("official_vehicle_signals", { year, make, model }, async () => {
    const sources = [];
    const caveats = [];
    let fuelEconomy = null;
    let recalls = [];

    try {
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

    try {
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
