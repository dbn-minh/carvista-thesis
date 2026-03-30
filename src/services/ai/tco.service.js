import { clamp, currencySymbolMap, roundMoney, toRateFraction, pickLatestByKey } from "./_helpers.js";
import { buildConfidence, buildEvidence } from "./contracts.js";
import { buildTcoPresentation } from "./presentation.service.js";
import {
  buildInternalSource,
  fetchOfficialVehicleSignals,
  loadTcoProfileWithRules,
  loadVariantContext,
} from "./source_retrieval.service.js";

const DEFAULT_KM_PER_YEAR = 15000;
const EPA_BASELINE_KM = 24140;
const EMPTY_COSTS = {
  registration_tax: null,
  excise_tax: null,
  vat: null,
  import_duty: null,
  insurance_total: null,
  maintenance_total: null,
  energy_total: null,
  depreciation_total: null,
  other: null,
};

function estimateEnergyCostPerYear({ officialSignals, kmPerYear, currency }) {
  if (!officialSignals?.fuel_economy?.annual_fuel_cost_usd) {
    return { annual_cost: null, assumption: null };
  }

  if (currency !== "USD") {
    return {
      annual_cost: null,
      assumption: "Official fuel cost fallback exists only in USD, so it was not converted automatically for this market.",
    };
  }

  const annualFuelCost = Number(officialSignals.fuel_economy.annual_fuel_cost_usd);
  if (!Number.isFinite(annualFuelCost)) return { annual_cost: null, assumption: null };

  return {
    annual_cost: annualFuelCost * (kmPerYear / EPA_BASELINE_KM),
    assumption: "Energy cost uses the official FuelEconomy.gov annual fuel-cost estimate scaled to the selected yearly distance.",
  };
}

export async function calculateTco(ctx, input) {
  const profile_id = input?.profile_id == null ? null : Number(input.profile_id);
  const market_id = input?.market_id == null ? null : Number(input.market_id);
  const variant_id = input?.variant_id == null ? null : Number(input.variant_id);
  const ownership_years = Number(input?.ownership_years);
  const km_per_year = input?.km_per_year == null ? DEFAULT_KM_PER_YEAR : Number(input.km_per_year);

  if (profile_id != null && !Number.isInteger(profile_id)) throw { status: 400, message: "profile_id must be integer" };
  if (market_id != null && !Number.isInteger(market_id)) throw { status: 400, message: "market_id must be integer" };
  if (variant_id != null && !Number.isInteger(variant_id)) throw { status: 400, message: "variant_id must be integer" };
  if (!Number.isInteger(ownership_years) || ownership_years <= 0 || ownership_years > 10) {
    throw { status: 400, message: "ownership_years must be 1..10" };
  }
  if (!Number.isFinite(km_per_year) || km_per_year <= 0) throw { status: 400, message: "km_per_year invalid" };

  const explicitBasePrice = input?.base_price == null ? null : Number(input.base_price);
  if (explicitBasePrice != null && (!Number.isFinite(explicitBasePrice) || explicitBasePrice <= 0)) {
    throw { status: 400, message: "base_price invalid" };
  }

  const variantContext = variant_id != null ? await loadVariantContext(ctx, { variant_id, market_id: market_id ?? 1 }) : null;
  const resolvedMarketId = market_id ?? variantContext?.variant?.market_id ?? 1;
  const market = await ctx.models.Markets.findByPk(resolvedMarketId).catch(() => null);
  const profileBundle =
    profile_id != null
      ? {
          profile: await ctx.models.TcoProfiles.findByPk(profile_id),
          rules: await ctx.models.TcoRules.findAll({
            where: { profile_id },
            order: [["cost_type", "ASC"], ["created_at", "DESC"]],
          }),
          sources: [buildInternalSource("Country-specific TCO rules from local configuration")],
        }
      : await loadTcoProfileWithRules(ctx, resolvedMarketId);

  const currency = market?.currency_code ?? "USD";
  const currency_symbol = currencySymbolMap[currency] ?? "";
  const base_price =
    explicitBasePrice ??
    Number(variantContext?.variant?.latest_price ?? variantContext?.variant?.msrp_base ?? Number.NaN);

  if (!profileBundle.profile) {
    return {
      status: "partial",
      code: "PROFILE_NOT_FOUND",
      message: `No TCO profile is configured for market ${resolvedMarketId}.`,
      profile_id: null,
      profile_name: null,
      market_id: resolvedMarketId,
      market_name: market?.name ?? null,
      currency,
      currency_symbol,
      base_price: Number.isFinite(base_price) && base_price > 0 ? roundMoney(base_price, currency) : null,
      ownership_years,
      km_per_year,
      costs: { ...EMPTY_COSTS },
      yearly_breakdown: {},
      total_cost: null,
      yearly_cost_avg: null,
      monthly_cost_avg: null,
      rules_applied: [],
      assumptions: [
        "Tax and fee configuration for this market is incomplete, so only a guarded fallback response can be returned.",
      ],
      confidence: buildConfidence(0.22, ["The market tax configuration is incomplete, so TCO cannot be fully grounded."]),
      evidence: buildEvidence({
        verified: [],
        inferred: [],
        estimated: ["No complete market tax profile was available for the selected market."],
      }),
      sources: [...profileBundle.sources],
      caveats: [
        "Registration tax, VAT, excise, import duty, insurance, and depreciation could not be computed because the market rule set is incomplete.",
      ],
    };
  }

  if (!Number.isFinite(base_price) || base_price <= 0) {
    throw { status: 400, message: "base_price invalid and no usable variant price anchor was found" };
  }

  const newestRules = pickLatestByKey(profileBundle.rules, (row) => row.cost_type);
  const assumptions = [];

  function percentOfBase(rateFraction) {
    return base_price * rateFraction;
  }

  function computeRuleCost(costType) {
    const rule = newestRules.get(costType);
    if (!rule) return { value: null, rule: null };

    if (rule.rule_kind === "rate") {
      const fraction = toRateFraction(rule.rate);
      if (fraction == null) return { value: null, rule };
      return { value: percentOfBase(fraction), rule };
    }

    if (rule.rule_kind === "fixed") {
      const amount = Number(rule.fixed_amount);
      return { value: Number.isFinite(amount) ? amount : null, rule };
    }

    if (rule.rule_kind === "formula") {
      const formula = rule.formula_json || {};
      if (costType === "maintenance" && formula.formula === "per_km") {
        const rate = Number(formula.rate);
        return { value: Number.isFinite(rate) ? rate * km_per_year : null, rule };
      }
      return { value: null, rule };
    }

    return { value: null, rule };
  }

  const registration = computeRuleCost("registration_tax");
  const excise = computeRuleCost("excise_tax");
  const vat = computeRuleCost("vat");
  const importDuty = computeRuleCost("import_duty");
  const other = computeRuleCost("other");
  const maintenanceAnnual = computeRuleCost("maintenance");

  let insuranceAnnual = null;
  const insuranceRule = newestRules.get("insurance");
  if (insuranceRule?.rule_kind === "fixed") insuranceAnnual = Number(insuranceRule.fixed_amount);
  if (insuranceRule?.rule_kind === "rate") insuranceAnnual = percentOfBase(toRateFraction(insuranceRule.rate) ?? 0);

  let depreciation_total = null;
  const depreciationByYear = [];
  const depreciationRule = newestRules.get("depreciation");
  if (depreciationRule) {
    const formula = depreciationRule.rule_kind === "formula" ? depreciationRule.formula_json || {} : {};
    const depreciationRate = toRateFraction(formula.rate ?? depreciationRule.rate);
    if (depreciationRate != null) {
      if ((formula.formula || "straight_line") === "declining_balance") {
        for (let year = 1; year <= ownership_years; year += 1) {
          const previous = base_price * Math.pow(1 - depreciationRate, year - 1);
          const current = base_price * Math.pow(1 - depreciationRate, year);
          depreciationByYear.push(previous - current);
        }
        depreciation_total = base_price - base_price * Math.pow(1 - depreciationRate, ownership_years);
      } else {
        const perYear = base_price * depreciationRate;
        for (let year = 0; year < ownership_years; year += 1) depreciationByYear.push(perYear);
        depreciation_total = perYear * ownership_years;
      }
    }
  }

  const officialSignals =
    variantContext != null
      ? await fetchOfficialVehicleSignals({
          ctx,
          variant_id,
          year: variantContext.variant.model_year,
          make: variantContext.variant.make_name,
          model: variantContext.variant.model_name,
        })
      : { fuel_economy: null, recalls: [], sources: [], caveats: [] };

  const explicitEnergyAnnual = input?.energy_cost_per_year == null ? null : Number(input.energy_cost_per_year);
  let energyAnnual = Number.isFinite(explicitEnergyAnnual) ? explicitEnergyAnnual : null;
  if (energyAnnual == null) {
    const fallbackEnergy = estimateEnergyCostPerYear({
      officialSignals,
      kmPerYear: km_per_year,
      currency,
    });
    energyAnnual = fallbackEnergy.annual_cost;
    if (fallbackEnergy.assumption) assumptions.push(fallbackEnergy.assumption);
  } else {
    assumptions.push("Annual energy cost was supplied directly by the caller.");
  }

  if (!Number.isFinite(energyAnnual)) {
    assumptions.push("Energy cost could not be grounded automatically, so it is excluded from the total.");
    energyAnnual = null;
  }

  const insurance_total = insuranceAnnual != null ? insuranceAnnual * ownership_years : null;
  const maintenance_total = maintenanceAnnual.value != null ? maintenanceAnnual.value * ownership_years : null;
  const energy_total = energyAnnual != null ? energyAnnual * ownership_years : null;

  const yearly_breakdown = {};
  for (let year = 1; year <= ownership_years; year += 1) {
    const oneTime =
      year === 1
        ? (registration.value ?? 0) + (excise.value ?? 0) + (vat.value ?? 0) + (importDuty.value ?? 0) + (other.value ?? 0)
        : 0;
    yearly_breakdown[`year_${year}`] =
      oneTime + (insuranceAnnual ?? 0) + (maintenanceAnnual.value ?? 0) + (energyAnnual ?? 0) + (depreciationByYear[year - 1] ?? 0);
  }

  const total_cost =
    base_price +
    (registration.value ?? 0) +
    (excise.value ?? 0) +
    (vat.value ?? 0) +
    (importDuty.value ?? 0) +
    (other.value ?? 0) +
    (insurance_total ?? 0) +
    (maintenance_total ?? 0) +
    (energy_total ?? 0) +
    (depreciation_total ?? 0);
  const yearly_cost_avg = total_cost / ownership_years;
  const monthly_cost_avg = yearly_cost_avg / 12;

  const confidence = buildConfidence(
    clamp(0.48 + (newestRules.size >= 4 ? 0.18 : 0) + (energy_total != null ? 0.12 : 0) + (variantContext ? 0.1 : 0), 0.35, 0.9),
    [
      newestRules.size >= 4 ? "Multiple local tax and ownership rules were configured for the selected market." : "The market rule set is still somewhat thin.",
      energy_total != null ? "Energy cost was grounded rather than omitted." : "Energy cost remains incomplete and reduces confidence.",
      variantContext ? "The estimate is tied to a specific vehicle context." : "The estimate is based on a generic base price rather than a full vehicle context.",
    ]
  );

  const result = {
    profile_id: profileBundle.profile.profile_id,
    profile_name: profileBundle.profile.name,
    market_id: profileBundle.profile.market_id,
    market_name: market?.name ?? null,
    currency,
    currency_symbol,
    base_price: roundMoney(base_price, currency),
    ownership_years,
    km_per_year,
    costs: {
      ...EMPTY_COSTS,
      registration_tax: roundMoney(registration.value, currency),
      excise_tax: roundMoney(excise.value, currency),
      vat: roundMoney(vat.value, currency),
      import_duty: roundMoney(importDuty.value, currency),
      insurance_total: roundMoney(insurance_total, currency),
      maintenance_total: roundMoney(maintenance_total, currency),
      energy_total: roundMoney(energy_total, currency),
      depreciation_total: roundMoney(depreciation_total, currency),
      other: roundMoney(other.value, currency),
    },
    yearly_breakdown: Object.fromEntries(
      Object.entries(yearly_breakdown).map(([key, value]) => [key, roundMoney(value, currency)])
    ),
    total_cost: roundMoney(total_cost, currency),
    yearly_cost_avg: roundMoney(yearly_cost_avg, currency),
    monthly_cost_avg: roundMoney(monthly_cost_avg, currency),
    rules_applied: [...newestRules.values()].map((rule) => ({
      cost_type: rule.cost_type,
      rule_kind: rule.rule_kind,
      rate: rule.rate,
      fixed_amount: rule.fixed_amount,
      formula_json: rule.formula_json,
      applies_to: rule.applies_to,
    })),
    assumptions,
    confidence,
    evidence: buildEvidence({
      verified: [
        "Configured local tax and fee rules were used to compute one-time government costs.",
        variantContext ? "The estimate was tied to a grounded vehicle record." : null,
      ].filter(Boolean),
      inferred: [],
      estimated: [
        energy_total == null ? "Energy cost is excluded because no grounded estimate was available." : null,
        officialSignals.sources.length > 0 && energy_total != null ? "Energy cost uses official EPA-style annual fuel-cost fallback where applicable." : null,
      ].filter(Boolean),
    }),
    sources: [
      buildInternalSource("Local TCO market rules and formulas"),
      ...(variantContext ? variantContext.sources : []),
      ...officialSignals.sources,
    ],
    caveats: [
      "Insurance is formula-based or profile-based, not a live insurer quote.",
      "Registration, VAT, excise, and import-duty treatment remain only as good as the configured market rules.",
      ...officialSignals.caveats,
    ],
  };

  return {
    ...result,
    ...buildTcoPresentation(result),
  };
}
