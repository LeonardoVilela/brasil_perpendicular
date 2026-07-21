import { describe, expect, it } from "vitest";
import type { Evidence } from "@bp/shared";
import { classify, scamRiskFrom } from "./classify";

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "test-evidence",
    domain: "synthetic_media",
    type: "description",
    label: "Evidência de teste",
    description: "Evidência de teste",
    weight: 0.5,
    confidence: 0.8,
    correlationGroup: "test-group",
    origin: "page_context",
    ...overrides,
  };
}

describe("classify", () => {
  it("inconclusive quando nenhuma análise foi executada", () => {
    const evidence = [makeEvidence({ weight: 1, confidence: 1 })];
    const result = classify(evidence, []);
    expect(result.classification).toBe("inconclusive");
  });

  it("declared_ai quando grupo platform-label (platform_disclosure) >= 0.9", () => {
    const evidence = [
      makeEvidence({
        domain: "platform_disclosure",
        correlationGroup: "platform-label",
        origin: "platform_disclosure",
        weight: 1,
        confidence: 0.9,
      }),
    ];
    const result = classify(evidence, ["context_rules"]);
    expect(result.classification).toBe("declared_ai");
    expect(result.score).toBe(0);
  });

  it("declared_ai quando a declaração explícita pertence ao autor", () => {
    const evidence = [
      makeEvidence({
        domain: "synthetic_media",
        correlationGroup: "explicit-declaration",
        origin: "author_statement",
        weight: 0.85,
        confidence: 0.9,
      }),
    ];
    const result = classify(evidence, ["context_rules"]);
    expect(result.classification).toBe("declared_ai");
  });

  it("não dispara declared_ai por declaração encontrada em contexto genérico", () => {
    const evidence = [
      makeEvidence({
        domain: "synthetic_media",
        correlationGroup: "explicit-declaration",
        origin: "page_context",
        weight: 0.85,
        confidence: 0.9,
      }),
    ];
    const result = classify(evidence, ["context_rules"]);
    expect(result.classification).not.toBe("declared_ai");
  });

  it("likely_ai exige duas origens independentes, uma delas de alta confiança", () => {
    const evidence = [
      makeEvidence({ correlationGroup: "a", origin: "technical_signal", weight: 1, confidence: 0.9 }),
      makeEvidence({ id: "b", correlationGroup: "b", origin: "page_context", weight: 0.6, confidence: 0.9 }),
    ];
    const result = classify(evidence, ["context_rules"]);
    expect(result.classification).toBe("likely_ai");
    expect(result.score).toBeGreaterThanOrEqual(0.75);
  });

  it("um único sinal forte de contexto não vira likely_ai", () => {
    const evidence = [makeEvidence({ correlationGroup: "a", weight: 1, confidence: 0.9 })];
    expect(classify(evidence, ["context_rules"]).classification).toBe("possibly_ai");
  });

  it("possibly_ai quando 0.45 <= S < 0.75 (ferramenta + hashtag)", () => {
    const evidence = [
      makeEvidence({ correlationGroup: "ai-tool-mention", weight: 0.6, confidence: 0.9 }), // 0.54
      makeEvidence({ id: "h", correlationGroup: "ai-hashtag", weight: 0.45, confidence: 0.85 }), // 0.3825
    ];
    const result = classify(evidence, ["context_rules"]);
    expect(result.classification).toBe("possibly_ai");
    expect(result.score).toBeGreaterThanOrEqual(0.45);
    expect(result.score).toBeLessThan(0.75);
  });

  it("insufficient_evidence quando S < 0.45 com análise executada", () => {
    const evidence = [makeEvidence({ correlationGroup: "ai-hashtag", weight: 0.45, confidence: 0.85 })]; // 0.3825
    const result = classify(evidence, ["context_rules"]);
    expect(result.classification).toBe("insufficient_evidence");
  });

  it("insufficient_evidence quando não há evidência nenhuma mas houve análise", () => {
    const result = classify([], ["context_rules"]);
    expect(result.classification).toBe("insufficient_evidence");
    expect(result.score).toBe(0);
  });

  it("platform_disclosure abaixo do gatilho não entra no score de synthetic_media", () => {
    const evidence = [
      makeEvidence({
        domain: "platform_disclosure",
        correlationGroup: "platform-label",
        weight: 0.7,
        confidence: 0.8,
      }), // 0.56, médio
    ];
    const result = classify(evidence, ["context_rules"]);
    expect(result.classification).toBe("insufficient_evidence");
    expect(result.score).toBe(0);
  });
});

describe("scamRiskFrom", () => {
  it("none quando não há evidência de scam_context", () => {
    expect(scamRiskFrom([])).toBe("none");
  });

  it("high quando grupo de scam >= 0.7", () => {
    const evidence = [
      makeEvidence({
        domain: "scam_context",
        correlationGroup: "scam-pix",
        weight: 0.9,
        confidence: 1,
      }),
    ];
    expect(scamRiskFrom(evidence)).toBe("high");
  });

  it("medium quando grupo de scam entre 0.45 e 0.7", () => {
    const evidence = [
      makeEvidence({
        domain: "scam_context",
        correlationGroup: "scam-pix",
        weight: 0.6,
        confidence: 0.9,
      }),
    ]; // 0.54
    expect(scamRiskFrom(evidence)).toBe("medium");
  });

  it("low quando grupo de scam entre 0.25 e 0.45", () => {
    const evidence = [
      makeEvidence({
        domain: "scam_context",
        correlationGroup: "scam-urgency",
        weight: 0.4,
        confidence: 0.8,
      }),
    ]; // 0.32
    expect(scamRiskFrom(evidence)).toBe("low");
  });

  it("não é afetado por evidência de outros domínios", () => {
    const evidence = [
      makeEvidence({
        domain: "synthetic_media",
        correlationGroup: "explicit-declaration",
        weight: 1,
        confidence: 1,
      }),
    ];
    expect(scamRiskFrom(evidence)).toBe("none");
  });
});
