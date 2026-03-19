function safeSerialize(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ note: "unserializable_payload" });
  }
}

export function logAiEvent(level, event, payload = {}) {
  const method =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.info;

  method(`[AI:${event}] ${safeSerialize(payload)}`);
}
