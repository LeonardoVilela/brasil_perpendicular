import { describe, expect, it } from "vitest";
import { requestMessageSchema } from "./messages";
import { DEFAULT_SETTINGS } from "./settings";
import type { DetectionAssessment, VideoContext } from "./types";

const assessment: DetectionAssessment = {
  classification: "possibly_ai",
  score: 0.5,
  confidence: "medium",
  scamRisk: "none",
  evidence: [],
  executedAnalyses: [],
  unavailableAnalyses: [],
  limitations: [],
  analyzedAt: "2026-07-16T00:00:00.000Z",
  assessmentVersion: "1.0.0",
  rulesetVersion: "1.0.0",
  detectorVersions: {},
};

const videoContext: VideoContext = {
  platform: "youtube",
  pageUrl: "https://youtube.com/watch?v=abc",
  hashtags: [],
  ariaLabels: [],
  captions: [],
};

describe("requestMessageSchema", () => {
  it("aceita CACHE_GET", () => {
    const result = requestMessageSchema.safeParse({ kind: "CACHE_GET", key: "k" });
    expect(result.success).toBe(true);
  });

  it("aceita CACHE_PUT com assessment válido", () => {
    const result = requestMessageSchema.safeParse({
      kind: "CACHE_PUT",
      key: "k",
      assessment,
    });
    expect(result.success).toBe(true);
  });

  it("aceita SETTINGS_GET", () => {
    const result = requestMessageSchema.safeParse({ kind: "SETTINGS_GET" });
    expect(result.success).toBe(true);
  });

  it("aceita SETTINGS_SET com settings válido", () => {
    const result = requestMessageSchema.safeParse({
      kind: "SETTINGS_SET",
      settings: DEFAULT_SETTINGS,
    });
    expect(result.success).toBe(true);
  });

  it("aceita DEEP_ANALYZE_REQUEST com contexto válido", () => {
    const result = requestMessageSchema.safeParse({
      kind: "DEEP_ANALYZE_REQUEST",
      context: videoContext,
    });
    expect(result.success).toBe(true);
  });

  it("aceita FEEDBACK_SUBMIT com payload válido", () => {
    const result = requestMessageSchema.safeParse({
      kind: "FEEDBACK_SUBMIT",
      feedback: {
        classification: "likely_ai",
        score: 0.8,
        assessmentVersion: "1.0.0",
        rulesetVersion: "1.0.0",
        expected: "false_positive",
      },
    });
    expect(result.success).toBe(true);
  });

  it("aceita INJECT_CONTENT_SCRIPT", () => {
    const result = requestMessageSchema.safeParse({
      kind: "INJECT_CONTENT_SCRIPT",
      tabId: 7,
    });
    expect(result.success).toBe(true);
  });

  it("aceita CACHE_CLEAR", () => {
    const result = requestMessageSchema.safeParse({ kind: "CACHE_CLEAR" });
    expect(result.success).toBe(true);
  });

  it("rejeita kind desconhecido", () => {
    const result = requestMessageSchema.safeParse({ kind: "UNKNOWN_KIND", key: "k" });
    expect(result.success).toBe(false);
  });

  it("rejeita CACHE_PUT sem assessment", () => {
    const result = requestMessageSchema.safeParse({ kind: "CACHE_PUT", key: "k" });
    expect(result.success).toBe(false);
  });

  it("rejeita CACHE_PUT com assessment inválido (campos faltando)", () => {
    const result = requestMessageSchema.safeParse({
      kind: "CACHE_PUT",
      key: "k",
      assessment: { classification: "likely_ai" },
    });
    expect(result.success).toBe(false);
  });
});
