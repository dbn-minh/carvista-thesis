export async function compareVariants(ctx, variantIds, marketId) {
  const { CarVariants, VariantSpecs, VariantPriceHistory, CarReviews } = ctx.models;

  const variants = await CarVariants.findAll({ where: { variant_id: variantIds } });

  const specs = await VariantSpecs.findAll({ where: { variant_id: variantIds } });

  let prices = [];
  if (marketId) {
    // latest price per variant
    for (const vid of variantIds) {
      const p = await VariantPriceHistory.findOne({
        where: { variant_id: vid, market_id: marketId },
        order: [["captured_at", "DESC"]],
      });
      prices.push({ variant_id: vid, price: p?.price ?? null });
    }
  }

  // average rating per variant
  const ratings = [];
  for (const vid of variantIds) {
    const rs = await CarReviews.findAll({ where: { variant_id: vid } });
    const avg = rs.length ? rs.reduce((s, x) => s + x.rating, 0) / rs.length : null;
    ratings.push({ variant_id: vid, avg_rating: avg, count: rs.length });
  }

  // simple pros/cons generator
  const specById = new Map(specs.map(s => [s.variant_id, s]));
  const priceById = new Map(prices.map(p => [p.variant_id, p.price]));
  const ratingById = new Map(ratings.map(r => [r.variant_id, r]));

  const items = variants.map(v => {
    const s = specById.get(v.variant_id);
    const pr = priceById.get(v.variant_id);
    const rt = ratingById.get(v.variant_id);
    const pros = [];
    const cons = [];

    if (s?.power_hp >= 250) pros.push("Strong power output");
    if (s?.range_km >= 450) pros.push("Long EV range");
    if (rt?.avg_rating >= 4.0) pros.push("Highly rated by users");

    if (s?.curb_weight_kg >= 2200) cons.push("Heavy curb weight");
    if (rt?.avg_rating != null && rt.avg_rating < 3.0) cons.push("Lower user satisfaction");
    if (pr != null && pr > 80000) cons.push("High market price");

    return {
      variant_id: v.variant_id,
      model_id: v.model_id,
      model_year: v.model_year,
      trim_name: v.trim_name,
      body_type: v.body_type,
      fuel_type: v.fuel_type,
      engine: v.engine,
      transmission: v.transmission,
      drivetrain: v.drivetrain,
      msrp_base: v.msrp_base,
      latest_price: pr,
      rating: rt,
      specs: s ?? null,
      pros,
      cons,
    };
  });

  return { items, recommendation: items.sort((a,b)=> (b.rating?.avg_rating||0)-(a.rating?.avg_rating||0))[0] ?? null };
}

export async function predictPrice(ctx, { variantId, marketId, horizonMonths = 6 }) {
  const { VariantPriceHistory } = ctx.models;
  const rows = await VariantPriceHistory.findAll({
    where: { variant_id: variantId, market_id: marketId },
    order: [["captured_at", "ASC"]],
    limit: 60,
  });

  if (rows.length < 3) {
    return { variantId, marketId, horizonMonths, predicted: null, note: "Not enough history" };
  }

  // simple trend slope using last N points
  const last = rows.slice(-10);
  const y = last.map(r => Number(r.price));
  const x = last.map((_, i) => i);

  // linear regression slope (tiny)
  const n = x.length;
  const sx = x.reduce((a,b)=>a+b,0);
  const sy = y.reduce((a,b)=>a+b,0);
  const sxx = x.reduce((a,b)=>a+b*b,0);
  const sxy = x.reduce((a,_,i)=>a + x[i]*y[i],0);

  const denom = n*sxx - sx*sx;
  const slope = denom ? (n*sxy - sx*sy)/denom : 0;

  const current = y[y.length-1];
  const predicted = current + slope * horizonMonths; // rough
  return { variantId, marketId, horizonMonths, current, slopePerStep: slope, predicted: Math.max(0, predicted) };
}