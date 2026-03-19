import { buildOffTopicReply, buildSmallTalkReply } from "./conversation_orchestrator.service.js";

export function handleConversationPolicy(intent, message) {
  if (intent === "small_talk") {
    return {
      policy: "small_talk",
      final_answer: buildSmallTalkReply(message),
      follow_up: "If you want, tell me what car or ownership decision you want help with.",
    };
  }

  if (intent === "out_of_scope" || intent === "unknown") {
    return {
      policy: "scope_redirect",
      final_answer: buildOffTopicReply(message),
      follow_up: "If you want to switch back, I can help with cars, pricing, comparisons, and ownership costs.",
    };
  }

  return {
    policy: "in_domain",
    final_answer: "",
    follow_up: null,
  };
}
