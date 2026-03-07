// src/services/ai/car_advisor_chat.service.js
import { compareVariants } from "./compare_variants.service.js";
import { predictPrice } from "./predict_price.service.js";
import { calculateTco } from "./tco.service.js";

function detectIntent(message) {
    const m = (message || "").toLowerCase();

    const hasCompare = ["so sánh", "compare", " vs ", "versus", "khác nhau"].some((k) => m.includes(k));
    if (hasCompare) return "compare";

    const hasPredict = ["dự đoán", "forecast", "predict", "xu hướng", "tương lai", "giá tương lai"].some((k) => m.includes(k));
    if (hasPredict) return "predict_price";

    const hasTco = ["tco", "chi phí nuôi xe", "chi phí sở hữu", "thuế", "bảo hiểm", "bảo dưỡng"].some((k) => m.includes(k));
    if (hasTco) return "calculate_tco";

    const hasSell = ["bán xe", "sell my car", "đăng bán", "listing"].some((k) => m.includes(k));
    if (hasSell) return "sell_guidance";

    return "search_catalog";
}

function extractVariantIds(message) {
    // If user types: [101,102] somewhere
    const m = message || "";
    const match = m.match(/\[(\s*\d+\s*(,\s*\d+\s*)+)\]/);
    if (!match) return null;
    try {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr) && arr.every((x) => Number.isFinite(Number(x)))) return arr.map((x) => Number(x));
    } catch { }
    return null;
}

export async function chatAdvisor(ctx, input) {
    const session_id = input?.session_id == null ? null : Number(input.session_id);
    const user_id = input?.user_id == null ? null : Number(input.user_id);
    const message = String(input?.message ?? "").trim();
    const context = input?.context ?? null;

    if (!message) throw { status: 400, message: "message is required" };
    if (session_id != null && !Number.isInteger(session_id)) throw { status: 400, message: "session_id invalid" };
    if (user_id != null && !Number.isInteger(user_id)) throw { status: 400, message: "user_id invalid" };

    const {
        models: { AiChatSessions, AiChatMessages, TcoProfiles },
        sequelize,
    } = ctx;

    let session = null;

    if (session_id == null) {
        session = await AiChatSessions.create({
            user_id: user_id ?? null,
            last_active_at: new Date(),
            context_json: context ?? null,
        });
    } else {
        session = await AiChatSessions.findByPk(session_id);
        if (!session) throw { status: 404, message: "session_id không tồn tại" };
        await session.update({ last_active_at: new Date() });
    }

    // log user message
    await AiChatMessages.create({
        session_id: session.session_id,
        role: "user",
        content: message,
        tool_name: null,
        tool_payload: null,
    });

    const intent = detectIntent(message);

    // Clarifying questions for search
    const follow_up_questions = [];
    const suggested_actions = [];
    const facts_used = [];

    let answer = "";
    let toolPayload = null;

    // context fields we may use
    const market_id = context?.market_id != null ? Number(context.market_id) : null;

    if (intent === "sell_guidance") {
        answer =
            "Để đăng bán xe: (1) vào Sell your car (2) chọn đúng variant (make/model/year/trim) (3) nhập giá, km, vị trí, mô tả (4) tạo listing. Sau đó buyer gửi viewing request và bạn liên hệ giao dịch ngoài nền tảng.";
    } else if (intent === "compare") {
        const ids = extractVariantIds(message);
        if (!ids) {
            answer =
                "Mình có thể so sánh 2–5 xe. Bạn gửi giúp mình danh sách variant_id theo dạng [101,102] (hoặc 3–5 id) để mình chạy so sánh.";
            follow_up_questions.push("Bạn muốn so sánh những variant_id nào? Ví dụ: [101,102]");
            suggested_actions.push({ type: "compare_variants", payload: { variant_ids: [] } });
        } else {
            toolPayload = await compareVariants(ctx, { variant_ids: ids, market_id: market_id ?? null, price_type: "avg_market" });
            suggested_actions.push({ type: "compare_variants", payload: { variant_ids: ids, market_id: market_id ?? null } });
            answer =
                `Mình đã so sánh ${ids.length} xe. Gợi ý chọn variant_id=${toolPayload.recommended_variant_id}. ` +
                (toolPayload.recommendation_reason || "");
            facts_used.push(...ids.map((id) => ({ source: "car_variants", id })));
        }
    } else if (intent === "predict_price") {
        // needs variant_id
        const ids = extractVariantIds(message);
        if (!ids || ids.length !== 1) {
            answer = "Để dự đoán giá, bạn gửi 1 variant_id theo dạng [123] và market_id trong context (vd market_id=1).";
            follow_up_questions.push("Bạn muốn dự đoán cho variant_id nào? Ví dụ: [123]");
            follow_up_questions.push("Bạn đang ở market_id nào (VN/US)?");
            suggested_actions.push({ type: "predict_price", payload: { variant_id: null, market_id: market_id ?? null, horizon_months: 6 } });
        } else if (!market_id) {
            answer = "Mình cần market_id để lấy lịch sử giá đúng. Bạn cho mình market_id (ví dụ: 1=VN, 2=US) nhé.";
            follow_up_questions.push("market_id của bạn là gì? (ví dụ 1=VN, 2=US)");
        } else {
            toolPayload = await predictPrice(ctx, { variant_id: ids[0], market_id, price_type: "avg_market", horizon_months: 6 });
            suggested_actions.push({ type: "predict_price", payload: { variant_id: ids[0], market_id, horizon_months: 6 } });
            answer =
                toolPayload.predicted_price == null
                    ? "Chưa đủ dữ liệu lịch sử giá để dự đoán (cần ≥8 điểm)."
                    : `Dự đoán giá sau 6 tháng: ${toolPayload.predicted_price} (${toolPayload.currency}).`;
            facts_used.push({ source: "variant_price_history", id: ids[0] });
        }
    } else if (intent === "calculate_tco") {
        const basePriceMatch = message.match(/(\d[\d.,]*)\s*(tỷ|ty|triệu|trieu|vnd|đ|usd|\$)?/i);
        let base_price = null;
        if (basePriceMatch) {
            let num = Number(String(basePriceMatch[1]).replace(/,/g, ""));
            const unit = (basePriceMatch[2] || "").toLowerCase();
            if (unit.includes("tỷ") || unit.includes("ty")) num = num * 1_000_000_000;
            if (unit.includes("triệu") || unit.includes("trieu")) num = num * 1_000_000;
            base_price = Number.isFinite(num) ? num : null;
        }

        if (!market_id) {
            answer = "Để tính TCO, mình cần market_id (VN/US) để chọn profile đúng.";
            follow_up_questions.push("Bạn ở market_id nào? (ví dụ 1=VN, 2=US)");
        } else if (!base_price) {
            answer = "Bạn cho mình base_price (giá xe) để tính TCO nhé. Ví dụ: '700 triệu' hoặc '1 tỷ'.";
            follow_up_questions.push("Giá xe (base_price) khoảng bao nhiêu?");
        } else {
            // pick first profile in market
            const profile = await TcoProfiles.findOne({ where: { market_id }, order: [["profile_id", "ASC"]] });
            if (!profile) {
                answer = "Chưa có tco_profile cho market này. Bạn seed tco_profiles/tco_rules trước nhé.";
            } else {
                toolPayload = await calculateTco(ctx, { profile_id: profile.profile_id, base_price, ownership_years: 5, km_per_year: null });
                suggested_actions.push({ type: "calculate_tco", payload: { profile_id: profile.profile_id, base_price, ownership_years: 5 } });
                answer = `TCO 5 năm ước tính: ${toolPayload.total_cost} (${toolPayload.currency}).`;
                facts_used.push({ source: "tco_profiles", id: profile.profile_id });
            }
        }
    } else {
        // search_catalog (simple, deterministic)
        answer =
            "Mình có thể gợi ý xe theo nhu cầu. Bạn cho mình thêm 2 thông tin: (1) budget khoảng bao nhiêu? (2) market_id (VN/US) để mình lấy giá đúng.";
        follow_up_questions.push("Budget khoảng bao nhiêu?");
        follow_up_questions.push("market_id của bạn là gì? (ví dụ 1=VN, 2=US)");
    }

    // log tool payload if exists
    if (toolPayload) {
        await AiChatMessages.create({
            session_id: session.session_id,
            role: "tool",
            content: null,
            tool_name: intent,
            tool_payload: toolPayload,
        });
    }

    // log assistant message
    await AiChatMessages.create({
        session_id: session.session_id,
        role: "assistant",
        content: answer,
        tool_name: null,
        tool_payload: null,
    });

    return {
        session_id: session.session_id,
        intent,
        answer,
        suggested_actions,
        follow_up_questions,
        facts_used,
    };
}