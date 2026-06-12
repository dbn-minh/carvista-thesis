import { buildSmallTalkReply } from "./conversation_orchestrator.service.js";
import { buildAdvisorScopePolicy } from "./advisor_scope_policy.service.js";

export function handleConversationPolicy(intent, message) {
  if (intent === "small_talk") {
    return {
      policy: "small_talk",
      final_answer: buildSmallTalkReply(message),
      follow_up: "If you want, tell me what car or ownership decision you want help with.",
    };
  }

  if (intent === "out_of_scope" || intent === "unknown") return buildAdvisorScopePolicy(message);

  return {
    policy: "in_domain",
    final_answer: "",
    follow_up: null,
  };
}
