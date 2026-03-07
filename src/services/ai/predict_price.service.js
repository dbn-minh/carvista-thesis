// src/services/ai/predict_price.service.js
import { clamp, roundMoney } from "./_helpers.js";

function linearRegression(xs, ys) {
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxx = xs.reduce((a, b) => a + b * b, 0);
    const sxy = ys.reduce((a, _, i) => a + xs[i] * ys[i], 0);
    const denom = n * sxx - sx * sx;
    const slope = denom ? (n * sxy - sx * sy) / denom : 0;
    const intercept = (sy - slope * sx) / n;
    return { slope, intercept };
}

function computeVolatility(prices) {
    // pct returns
    if (prices.length < 3) return null;
    const rets = [];
    for (let i = 1; i < prices.length; i++) {
        const a = prices[i - 1];
        const b = prices[i];
        if (a > 0) rets.push((b - a) / a);
    }
    if (rets.length < 2) return null;
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const varS = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);
    return Math.sqrt(varS);
}

export async function predictPrice(ctx, input) {
    const variant_id = Number(input?.variant_id);
    const market_id = Number(input?.market_id);
    const price_type = input?.price_type ?? "avg_market";
    const horizon_months = input?.horizon_months == null ? 6 : Number(input.horizon_months);

    if (!Number.isInteger(variant_id)) throw { status: 400, message: "variant_id must be integer (BIGINT ok)" };
    if (!Number.isInteger(market_id)) throw { status: 400, message: "market_id must be integer" };
    if (!Number.isInteger(horizon_months) || horizon_months < 1 || horizon_months > 24)
        throw { status: 400, message: "horizon_months must be 1..24" };

    const { VariantPriceHistory, Markets } = ctx.models;

    const market = await Markets.findByPk(market_id);
    const currency = market?.currency_code ?? "USD";

    const rows = await VariantPriceHistory.findAll({
        where: { variant_id, market_id, price_type },
        order: [["captured_at", "ASC"]],
        limit: 200,
    });

    const history_points = rows.length;
    if (history_points < 8) {
        return {
            variant_id,
            market_id,
            currency,
            price_type,
            history_points,
            last_price: null,
            horizon_months,
            predicted_price: null,
            predicted_min: null,
            predicted_max: null,
            trend_slope: null,
            volatility: null,
            confidence_score: 0,
            notes: "insufficient_history: need at least 8 points",
        };
    }

    const window = rows.slice(-12);
    const t0 = new Date(window[0].captured_at).getTime();
    const monthMs = 1000 * 60 * 60 * 24 * 30.44;

    const xs = window.map((r) => (new Date(r.captured_at).getTime() - t0) / monthMs);
    const ys = window.map((r) => Number(r.price));

    const { slope } = linearRegression(xs, ys);

    const last = window[window.length - 1];
    const last_price = Number(last.price);
    const last_x = xs[xs.length - 1];

    const predicted_price_raw = last_price + slope * horizon_months;
    const predicted_price = Math.max(0, predicted_price_raw);

    const vol = computeVolatility(ys);
    const volatility = vol == null ? 0.05 : clamp(vol, 0, 0.25);

    const predicted_min = Math.max(0, predicted_price * (1 - volatility));
    const predicted_max = Math.max(predicted_min, predicted_price * (1 + volatility));

    // confidence: more points + lower volatility => higher
    const pointsFactor = clamp(window.length / 12, 0, 1);
    const volFactor = 1 - clamp(volatility / 0.25, 0, 1);
    const confidence_score = clamp(0.15 + 0.55 * pointsFactor + 0.30 * volFactor, 0, 1);

    return {
        variant_id,
        market_id,
        currency,
        price_type,
        history_points,
        last_price: roundMoney(last_price, currency),
        horizon_months,
        predicted_price: roundMoney(predicted_price, currency),
        predicted_min: roundMoney(predicted_min, currency),
        predicted_max: roundMoney(predicted_max, currency),
        trend_slope: slope, // raw slope per month unit
        volatility,
        confidence_score,
        notes: `regression_window=${window.length} last_x=${last_x.toFixed(2)}`,
    };
}