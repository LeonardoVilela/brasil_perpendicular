import { describe, expect, it } from "vitest";
import { decideDeepAnalysis } from "./escalation";

const base = {
  classification: "insufficient_evidence" as const,
  politicalContext: false,
  localDecision: "real_like" as const,
  signalConflict: false,
  framesAvailable: true,
  automaticDeepVisualAnalysisEnabled: true,
};

describe("decideDeepAnalysis", () => {
  it("encerra cedo quando a origem já declarou IA", () => {
    expect(decideDeepAnalysis({ ...base, classification: "declared_ai" })).toMatchObject({
      shouldEscalate: false,
      blockedBy: "declared_ai",
    });
  });

  it("prioriza qualquer contexto eleitoral autorizado", () => {
    expect(decideDeepAnalysis({ ...base, politicalContext: true })).toEqual({
      shouldEscalate: true,
      priority: "high",
      reason: "political_context",
    });
  });

  it.each([
    ["ai_like", "local_positive"],
    ["uncertain", "local_uncertain"],
    ["unavailable", "local_unavailable"],
  ] as const)("escala decisão local %s", (localDecision, reason) => {
    expect(decideDeepAnalysis({ ...base, localDecision })).toEqual({
      shouldEscalate: true,
      priority: "normal",
      reason,
    });
  });

  it("escala conflito técnico", () => {
    expect(decideDeepAnalysis({ ...base, signalConflict: true })).toEqual({
      shouldEscalate: true,
      priority: "normal",
      reason: "signal_conflict",
    });
  });

  it("não escala real_like não político", () => {
    expect(decideDeepAnalysis(base)).toMatchObject({ shouldEscalate: false, blockedBy: "not_needed" });
  });

  it("não envia sem opt-in", () => {
    expect(
      decideDeepAnalysis({
        ...base,
        politicalContext: true,
        automaticDeepVisualAnalysisEnabled: false,
      }),
    ).toMatchObject({ shouldEscalate: false, blockedBy: "opt_in_required" });
  });

  it("não envia quando os frames estão indisponíveis", () => {
    expect(decideDeepAnalysis({ ...base, politicalContext: true, framesAvailable: false })).toMatchObject({
      shouldEscalate: false,
      blockedBy: "frames_unavailable",
    });
  });
});
