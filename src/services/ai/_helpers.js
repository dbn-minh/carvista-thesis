// src/services/ai/_helpers.js
export const currencySymbolMap = {
    VND: "₫",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    SGD: "S$",
};

export function roundMoney(amount, currency) {
    if (amount == null) return null;
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;

    if (currency === "VND") return Math.round(n / 1000) * 1000;
    if (currency === "JPY") return Math.round(n);
    return Math.round(n * 100) / 100;
}

export function toRateFraction(rateVal) {
    // DB khuyến nghị rate dạng fraction (0.10 = 10%)
    // tolerant parse: nếu > 1 coi như percent => /100
    if (rateVal == null) return null;
    const r = Number(rateVal);
    if (!Number.isFinite(r)) return null;
    return r > 1 ? r / 100 : r;
}

export function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

export function pickLatestByKey(rows, keyFn) {
    // rows should already be sorted DESC by created_at (or captured_at)
    const map = new Map();
    for (const r of rows) {
        const k = keyFn(r);
        if (!map.has(k)) map.set(k, r);
    }
    return map;
}