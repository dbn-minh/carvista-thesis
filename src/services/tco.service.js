export async function calculateTco(ctx, { profileId, basePrice, years = 5 }) {
  const { TcoRules } = ctx.models;

  const rules = await TcoRules.findAll({ where: { profile_id: profileId } });

  const breakdown = [];
  let total = 0;

  for (const r of rules) {
    let cost = 0;

    if (r.rule_kind === "rate" && r.rate != null) {
      cost = basePrice * Number(r.rate);
    } else if (r.rule_kind === "fixed" && r.fixed_amount != null) {
      cost = Number(r.fixed_amount);
    } else if (r.rule_kind === "formula" && r.formula_json) {
      // minimal formula support: { "per_year_rate": 0.02 } etc.
      const f = r.formula_json;
      if (f.per_year_rate) cost = basePrice * Number(f.per_year_rate) * years;
      else cost = 0;
    }

    breakdown.push({ cost_type: r.cost_type, amount: cost });
    total += cost;
  }

  return { basePrice, years, breakdown, total, final: basePrice + total };
}