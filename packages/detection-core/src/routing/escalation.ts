import type { Classification, DeepAnalysisReason, VisualDecision } from "@bp/shared";

interface EscalationInput {
  classification: Classification;
  politicalContext: boolean;
  localDecision: VisualDecision;
  signalConflict: boolean;
  framesAvailable: boolean;
  automaticDeepVisualAnalysisEnabled: boolean;
}

export type EscalationDecision =
  | { shouldEscalate: true; priority: "high" | "normal"; reason: DeepAnalysisReason }
  | {
      shouldEscalate: false;
      blockedBy: "declared_ai" | "not_needed" | "opt_in_required" | "frames_unavailable";
    };

export function decideDeepAnalysis(input: EscalationInput): EscalationDecision {
  if (input.classification === "declared_ai") {
    return { shouldEscalate: false, blockedBy: "declared_ai" };
  }
  if (!input.framesAvailable) {
    return { shouldEscalate: false, blockedBy: "frames_unavailable" };
  }

  let reason: DeepAnalysisReason | undefined;
  if (input.politicalContext) reason = "political_context";
  else if (input.signalConflict) reason = "signal_conflict";
  else if (input.localDecision === "ai_like") reason = "local_positive";
  else if (input.localDecision === "uncertain") reason = "local_uncertain";
  else if (input.localDecision === "unavailable") reason = "local_unavailable";

  if (!reason) return { shouldEscalate: false, blockedBy: "not_needed" };
  if (!input.automaticDeepVisualAnalysisEnabled) {
    return { shouldEscalate: false, blockedBy: "opt_in_required" };
  }

  return {
    shouldEscalate: true,
    priority: reason === "political_context" ? "high" : "normal",
    reason,
  };
}
