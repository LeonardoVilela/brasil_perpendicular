import { describe, expect, it } from "vitest";
import type { Evidence, EvidenceDomain } from "@bp/shared";
import { aggregateDomain } from "./aggregate";

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
    ...overrides,
  };
}

describe("aggregateDomain", () => {
  it("evidências correlacionadas não somam: vale o máximo do grupo", () => {
    const weak = Array.from({ length: 10 }, (_, i) =>
      makeEvidence({ id: `h${i}`, correlationGroup: "ai-hashtag", weight: 0.45, confidence: 0.85 }),
    );
    expect(aggregateDomain(weak, "synthetic_media")).toBeLessThan(0.5);
  });

  it("grupos independentes combinam por noisy-OR", () => {
    const evidence = [
      makeEvidence({ correlationGroup: "a", weight: 0.6, confidence: 1 }),
      makeEvidence({ correlationGroup: "b", weight: 0.6, confidence: 1 }),
    ];
    const s = aggregateDomain(evidence, "synthetic_media");
    expect(s).toBeCloseTo(1 - 0.4 * 0.4, 5); // 0.84…
  });

  it("sem grupo forte e menos de dois médios, teto 0.74", () => {
    // 1 grupo médio (0.6) + 1 grupo fraco (0.45): noisy-OR sem teto seria
    // 1 - 0.4*0.55 = 0.78, mas strong=0 e medium=1 (< 2) ⇒ cap em 0.74.
    const evidence = [
      makeEvidence({ correlationGroup: "a", weight: 0.6, confidence: 1 }), // 0.6, médio
      makeEvidence({ correlationGroup: "b", weight: 0.45, confidence: 1 }), // 0.45, fraco
    ];
    expect(aggregateDomain(evidence, "synthetic_media")).toBe(0.74);

    // com 2 grupos médios (medium=2, não é "< 2"), o teto de 0.74 não se aplica.
    const twoMedium = [
      makeEvidence({ correlationGroup: "a", weight: 0.75, confidence: 1 }), // 0.75, médio
      makeEvidence({ correlationGroup: "b", weight: 0.75, confidence: 1 }), // 0.75, médio
    ];
    const s = aggregateDomain(twoMedium, "synthetic_media");
    expect(s).toBeCloseTo(1 - 0.25 * 0.25, 5); // 0.9375, sem cap
  });

  it("apenas grupos fracos, teto 0.49", () => {
    const evidence = [
      makeEvidence({ correlationGroup: "a", weight: 0.45, confidence: 0.85 }), // 0.3825
      makeEvidence({ correlationGroup: "b", weight: 0.4, confidence: 0.8 }), // 0.32
    ];
    // noisy-OR sem teto: 1 - 0.6175*0.68 ≈ 0.58, mas ambos os grupos são fracos ⇒ cap 0.49.
    expect(aggregateDomain(evidence, "synthetic_media")).toBe(0.49);
  });

  it("domínios não se misturam", () => {
    const scam: Evidence[] = [
      makeEvidence({ domain: "scam_context", correlationGroup: "scam-pix", weight: 0.9, confidence: 1 }),
    ];
    expect(aggregateDomain(scam, "synthetic_media")).toBe(0);
  });

  it("sem evidência no domínio, retorna 0", () => {
    expect(aggregateDomain([], "synthetic_media")).toBe(0);
  });

  it("boundary: effective exatamente 0.8 conta como forte (sem teto)", () => {
    // um único grupo forte (0.8 exato): strong=1 ⇒ nenhum teto se aplica.
    const evidence = [makeEvidence({ correlationGroup: "a", weight: 1, confidence: 0.8 })];
    expect(aggregateDomain(evidence, "synthetic_media")).toBeCloseTo(0.8, 5);
  });

  it("boundary: effective exatamente 0.5 conta como médio, não fraco", () => {
    // dois grupos médios exatos no boundary 0.5 ⇒ medium=2, não é "< 2" ⇒ sem teto de 0.74.
    const evidence = [
      makeEvidence({ correlationGroup: "a", weight: 1, confidence: 0.5 }),
      makeEvidence({ correlationGroup: "b", weight: 1, confidence: 0.5 }),
    ];
    const s = aggregateDomain(evidence, "synthetic_media");
    expect(s).toBeCloseTo(1 - 0.5 * 0.5, 5); // 0.75, acima do teto de 0.74 que não deve ser aplicado
  });

  it("boundary: um único grupo médio exato 0.5 sofre teto 0.74 (menos de dois médios)", () => {
    const evidence = [makeEvidence({ correlationGroup: "a", weight: 1, confidence: 0.5 })];
    expect(aggregateDomain(evidence, "synthetic_media")).toBeCloseTo(0.5, 5);
  });

  it("um grupo forte sozinho não sofre nenhum teto mesmo sendo o único grupo", () => {
    const evidence = [makeEvidence({ correlationGroup: "a", weight: 1, confidence: 0.95 })];
    expect(aggregateDomain(evidence, "synthetic_media")).toBeCloseTo(0.95, 5);
  });

  it("filtra por domínio antes de agrupar (evidência de outro domínio é ignorada)", () => {
    const mixed: Evidence[] = [
      makeEvidence({ domain: "synthetic_media", correlationGroup: "a", weight: 0.9, confidence: 0.9 }),
      makeEvidence({ domain: "platform_disclosure" as EvidenceDomain, correlationGroup: "platform-label", weight: 0.95, confidence: 0.95 }),
    ];
    expect(aggregateDomain(mixed, "platform_disclosure")).toBeCloseTo(0.9025, 5);
  });
});
