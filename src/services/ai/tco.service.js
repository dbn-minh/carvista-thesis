// src/services/ai/tco.service.js
import { currencySymbolMap, roundMoney, toRateFraction, pickLatestByKey } from "./_helpers.js";

export async function calculateTco(ctx, input) {
    const profile_id = Number(input?.profile_id);
    const base_price = Number(input?.base_price);
    const ownership_years = Number(input?.ownership_years);
    const km_per_year = input?.km_per_year == null ? null : Number(input.km_per_year);

    if (!Number.isInteger(profile_id)) throw { status: 400, message: "profile_id must be integer" };
    if (!Number.isFinite(base_price) || base_price <= 0) throw { status: 400, message: "base_price invalid" };
    if (!Number.isInteger(ownership_years) || ownership_years <= 0 || ownership_years > 10)
        throw { status: 400, message: "ownership_years must be 1..10" };
    if (km_per_year != null && (!Number.isInteger(km_per_year) || km_per_year <= 0))
        throw { status: 400, message: "km_per_year invalid" };

    const { TcoProfiles, TcoRules, Markets } = ctx.models;

    const profile = await TcoProfiles.findOne({
        where: { profile_id },
        include: [{ model: Markets, as: "market" }],
    });

    if (!profile) {
        return {
            status: "error",
            code: "PROFILE_NOT_FOUND",
            message: `TCO profile không tồn tại: ${profile_id}`,
        };
    }

    const currency = profile.market?.currency_code ?? "USD";
    const currency_symbol = currencySymbolMap[currency] ?? "";

    const rulesAll = await TcoRules.findAll({
        where: { profile_id },
        order: [["cost_type", "ASC"], ["created_at", "DESC"]],
    });

    // pick newest per cost_type
    const newest = pickLatestByKey(rulesAll, (r) => r.cost_type);

    const notes = [];
    const usedKm = km_per_year ?? 15000;
    if (km_per_year == null) notes.push("km_per_year not provided, using default 15,000 km/year.");

    const percentOfBase = (rateFraction) => base_price * rateFraction;

    function computeCost(costType) {
        const r = newest.get(costType);
        if (!r) return { value: null, applied: null };

        if (r.rule_kind === "rate") {
            const frac = toRateFraction(r.rate);
            if (frac == null) return { value: null, applied: r };
            if (Number(r.rate) > 1) notes.push(`rate for ${costType} appears percent; normalized by /100.`);
            return { value: percentOfBase(frac), applied: r };
        }

        if (r.rule_kind === "fixed") {
            const amt = r.fixed_amount == null ? null : Number(r.fixed_amount);
            return { value: Number.isFinite(amt) ? amt : null, applied: r };
        }

        if (r.rule_kind === "formula") {
            const f = r.formula_json || {};
            if (costType === "maintenance" && f.formula === "per_km") {
                const fracOrNum = Number(f.rate);
                if (!Number.isFinite(fracOrNum)) return { value: null, applied: r };
                return { value: fracOrNum * usedKm, applied: r }; // annual
            }
            // for other cost types, formula_json is optional in your schema; keep null if unknown
            return { value: null, applied: r };
        }

        return { value: null, applied: r };
    }

    // One-time taxes
    const registration = computeCost("registration_tax");
    const excise = computeCost("excise_tax");
    const vat = computeCost("vat");
    const importDuty = computeCost("import_duty");
    const other = computeCost("other");

    // insurance annual -> total
    const insuranceRule = newest.get("insurance");
    let insuranceAnnual = null;
    if (insuranceRule) {
        if (insuranceRule.rule_kind === "fixed") insuranceAnnual = insuranceRule.fixed_amount != null ? Number(insuranceRule.fixed_amount) : null;
        if (insuranceRule.rule_kind === "rate") {
            const frac = toRateFraction(insuranceRule.rate);
            if (frac != null) insuranceAnnual = percentOfBase(frac);
            if (Number(insuranceRule.rate) > 1) notes.push("rate for insurance appears percent; normalized by /100.");
        }
        if (insuranceRule.rule_kind === "formula") {
            const f = insuranceRule.formula_json || {};
            if (f.formula === "fixed" && Number.isFinite(Number(f.amount))) insuranceAnnual = Number(f.amount);
        }
    }
    const insurance_total = insuranceAnnual != null ? insuranceAnnual * ownership_years : null;

    // maintenance annual -> total
    const maintenance = computeCost("maintenance");
    const maintenance_total = maintenance.value != null ? maintenance.value * ownership_years : null;

    // depreciation total + yearly
    const depRule = newest.get("depreciation");
    let depreciation_total = null;
    const depreciationByYear = [];
    if (depRule) {
        const f = depRule.rule_kind === "formula" ? (depRule.formula_json || {}) : {};
        const formula = f.formula || "straight_line";
        const frac = toRateFraction(f.rate ?? depRule.rate);
        if (frac == null) {
            depreciation_total = null;
        } else {
            if ((f.rate ?? depRule.rate) > 1) notes.push("rate for depreciation appears percent; normalized by /100.");

            if (formula === "straight_line") {
                const perYear = base_price * frac;
                for (let i = 0; i < ownership_years; i++) depreciationByYear.push(perYear);
                depreciation_total = perYear * ownership_years;
            } else if (formula === "declining_balance") {
                for (let i = 1; i <= ownership_years; i++) {
                    const prev = base_price * Math.pow(1 - frac, i - 1);
                    const curr = base_price * Math.pow(1 - frac, i);
                    depreciationByYear.push(prev - curr);
                }
                depreciation_total = base_price - base_price * Math.pow(1 - frac, ownership_years);
            } else {
                depreciation_total = null;
            }
        }
    }
    if (depreciation_total != null && depreciation_total > base_price) depreciation_total = base_price;

    // yearly breakdown
    const yearly_breakdown = {};
    for (let y = 1; y <= ownership_years; y++) {
        const oneTime =
            y === 1
                ? (registration.value ?? 0) + (excise.value ?? 0) + (vat.value ?? 0) + (importDuty.value ?? 0) + (other.value ?? 0)
                : 0;

        const depY = depreciationByYear[y - 1] ?? 0;
        yearly_breakdown[`year_${y}`] = oneTime + (insuranceAnnual ?? 0) + (maintenance.value ?? 0) + depY;
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
        (depreciation_total ?? 0);

    const yearly_cost_avg = total_cost / ownership_years;

    const rules_applied = [...newest.values()].map((r) => ({
        cost_type: r.cost_type,
        rule_kind: r.rule_kind,
        rate: r.rate,
        fixed_amount: r.fixed_amount,
        formula_json: r.formula_json,
        applies_to: r.applies_to,
    }));

    return {
        profile_id,
        profile_name: profile.name,
        market_id: profile.market_id,
        market_name: profile.market?.name ?? null,
        currency,
        currency_symbol,
        base_price: roundMoney(base_price, currency),
        ownership_years,
        km_per_year: usedKm,
        costs: {
            registration_tax: roundMoney(registration.value, currency),
            excise_tax: roundMoney(excise.value, currency),
            vat: roundMoney(vat.value, currency),
            import_duty: roundMoney(importDuty.value, currency),
            insurance_total: roundMoney(insurance_total, currency),
            maintenance_total: roundMoney(maintenance_total, currency),
            depreciation_total: roundMoney(depreciation_total, currency),
            other: roundMoney(other.value, currency),
        },
        yearly_breakdown: Object.fromEntries(
            Object.entries(yearly_breakdown).map(([k, v]) => [k, roundMoney(v, currency)])
        ),
        total_cost: roundMoney(total_cost, currency),
        yearly_cost_avg: roundMoney(yearly_cost_avg, currency),
        rules_applied,
        notes: notes.join(" "),
    };
}