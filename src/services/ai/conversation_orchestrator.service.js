const SMALL_TALK_PATTERNS = [
  /\b(hello|hi|hey|yo|xin chao|chao)\b/i,
  /\b(thank you|thanks|cam on)\b/i,
  /\b(how are you|ban khoe khong)\b/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(weather|football|movie|crypto|politics|homework|recipe)\b/i,
  /\b(thoi tiet|bong da|phim|chinh tri|mon an)\b/i,
];

const VEHICLE_QUESTION_PATTERNS = [
  /\b(reliable|reliability|worth it|safe|safety|maintenance|comfortable|comfort|feature|features)\b/i,
  /\b(city driving|highway|road trip|family car|practical|fuel economy|mpg|range|recall)\b/i,
  /\b(co nen mua|co dang tien|an toan|ben|bao duong|tiet kiem xang|phu hop)\b/i,
];

const GENERAL_AUTOMOTIVE_QA_PATTERNS = [
  /\b(what is|what's|difference between|explain|how does|how do|why does|why is)\b/i,
  /\b(plug-in hybrid|phev|hybrid|bev|ev battery|awd|fwd|rwd|turbo|naturally aspirated)\b/i,
  /\b(bao gio|khac nhau|giai thich|tai sao|la gi)\b/i,
];

const AUTOMOTIVE_SIGNAL_PATTERNS = [
  /\b(car|vehicle|suv|sedan|truck|ev|hybrid|mileage|trim|model|variant|drivetrain|horsepower)\b/i,
  /\b(xe|oto|o to|mau xe|dong xe|dong co|hop so|gia xe|lan banh)\b/i,
];

const RECOMMENDATION_PATTERNS = [
  /\b(recommend|suggest|find me|looking for|need a car|want a car|buy a car|which car should i buy)\b/i,
  /\b(tu van|chon xe|mua xe|can mua xe|muon mua xe|nen mua xe|xe nao phu hop|phu hop voi toi|goi y xe|tim xe)\b/i,
];

export function normalizeConversationText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isAutomotiveMessage(message) {
  const normalized = normalizeConversationText(message);
  return AUTOMOTIVE_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function classifyConversationRoute(message, options = {}) {
  const normalized = normalizeConversationText(message);
  const hasFocusVehicle = Number.isInteger(options.focus_variant_id);
  const hasQuestionShape = /\?/.test(message) || /\b(what|why|how|should|can|difference|explain|which|is|are|co|tai sao|khac nhau|la gi)\b/i.test(normalized);

  if (/\b(compare|versus| vs |so sanh)\b/i.test(normalized)) return "compare";
  if (/\b(predict|forecast|future value|resale|depreciation|du doan|gia tuong lai)\b/i.test(normalized)) {
    return "predict_price";
  }
  if (/\b(tco|ownership cost|lan banh|tax|insurance|maintenance cost)\b/i.test(normalized)) {
    return "calculate_tco";
  }
  if (/\b(sell|listing|dang ban|ban xe)\b/i.test(normalized)) return "sell_guidance";
  if (SMALL_TALK_PATTERNS.some((pattern) => pattern.test(normalized)) && !hasFocusVehicle) return "small_talk";
  if (OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized)) && !isAutomotiveMessage(normalized)) {
    return "off_topic";
  }
  if (RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(normalized))) return "advisor";
  if (hasQuestionShape && GENERAL_AUTOMOTIVE_QA_PATTERNS.some((pattern) => pattern.test(normalized)) && isAutomotiveMessage(normalized)) {
    return "vehicle_question";
  }
  if (hasFocusVehicle && /\?/.test(message)) return "vehicle_question";
  if (VEHICLE_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized))) return "vehicle_question";

  return "advisor";
}

export function buildSmallTalkReply(message) {
  const normalized = normalizeConversationText(message);
  if (/\b(thank|cam on)\b/i.test(normalized)) {
    return "Always happy to help. If you want, we can jump straight back into cars, ownership costs, or comparison questions.";
  }
  if (/\b(how are you|ban khoe khong)\b/i.test(normalized)) {
    return "Doing well and ready to talk cars. Tell me what vehicle or buying decision you want help with.";
  }
  return "Hi there. I can chat a bit, but my real strength is helping with cars, pricing, comparisons, and ownership decisions.";
}

export function buildOffTopicReply(message) {
  const normalized = normalizeConversationText(message);
  if (/\b(joke|funny|dua)\b/i.test(normalized)) {
    return "I can appreciate a good detour, but my sweet spot is still cars. Bring me a model, budget, or ownership question and I will be much more useful.";
  }
  return "I can respond briefly, but my main expertise is automotive advice: comparing cars, forecasting value, ownership costs, and buying or selling decisions.";
}
