import { describe, expect, it } from "vitest";
import type { VideoContext } from "@bp/shared";
import { assess, ASSESSMENT_VERSION } from "./assess";
import { RULESET_VERSION } from "./rules";

function makeContext(overrides: Partial<VideoContext> = {}): VideoContext {
  return {
    platform: "generic",
    pageUrl: "https://example.com/video",
    hashtags: [],
    ariaLabels: [],
    captions: [],
    ...overrides,
  };
}

describe("assess", () => {
  it('"gerado por IA" na descrição ⇒ declared_ai', () => {
    const result = assess(
      makeContext({ title: "Meu vídeo", description: "este conteúdo foi gerado por IA" }),
    );
    expect(result.classification).toBe("declared_ai");
    expect(result.confidence).toBe("high");
  });

  it("ferramenta de IA + hashtag de IA ⇒ possibly_ai (score entre 0.45 e 0.75)", () => {
    const result = assess(
      makeContext({
        title: "Vídeo de viagem",
        description: "Editado no Runway hoje",
        hashtags: ["#sora", "#viagem"],
      }),
    );
    expect(result.classification).toBe("possibly_ai");
    expect(result.score).toBeGreaterThanOrEqual(0.45);
    expect(result.score).toBeLessThan(0.75);
  });

  it("contexto limpo (sem sinais) ⇒ insufficient_evidence", () => {
    const result = assess(
      makeContext({ title: "Viagem em família", description: "Fomos à praia com as crianças" }),
    );
    expect(result.classification).toBe("insufficient_evidence");
    expect(result.executedAnalyses).toEqual(["context_rules"]);
  });

  it("contexto totalmente vazio ⇒ inconclusive", () => {
    const result = assess(makeContext());
    expect(result.classification).toBe("inconclusive");
    expect(result.executedAnalyses).toEqual([]);
    expect(result.limitations).toContain("Nenhum contexto textual encontrado na página.");
  });

  it("texto de golpe ⇒ scamRisk != none, classificação inalterada", () => {
    const clean = assess(
      makeContext({ title: "Oferta especial", description: "Fomos à praia com as crianças" }),
    );
    const withScam = assess(
      makeContext({
        title: "Oferta especial",
        description: "Você tem direito a uma indenização, faça um Pix agora",
      }),
    );
    expect(withScam.scamRisk).not.toBe("none");
    expect(withScam.classification).toBe(clean.classification);
  });

  it("sempre inclui 'visual_model' em unavailableAnalyses, mais os passados em options", () => {
    const result = assess(makeContext({ description: "vídeo comum" }), {
      unavailableAnalyses: ["provenance"],
    });
    expect(result.unavailableAnalyses).toContain("visual_model");
    expect(result.unavailableAnalyses).toContain("provenance");
  });

  it("sempre inclui a limitação de análise visual indisponível", () => {
    const result = assess(makeContext({ description: "vídeo comum" }));
    expect(result.limitations).toContain("Análise visual não disponível nesta versão.");
  });

  it("não inclui a limitação de contexto vazio quando há texto", () => {
    const result = assess(makeContext({ description: "vídeo comum" }));
    expect(result.limitations).not.toContain("Nenhum contexto textual encontrado na página.");
  });

  it("expõe versões e analyzedAt em ISO-8601", () => {
    const result = assess(makeContext({ description: "vídeo comum" }));
    expect(result.assessmentVersion).toBe(ASSESSMENT_VERSION);
    expect(result.rulesetVersion).toBe(RULESET_VERSION);
    expect(() => new Date(result.analyzedAt).toISOString()).not.toThrow();
    expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
  });

  it("carrega todas as evidências geradas (todos os domínios) em `evidence`", () => {
    const result = assess(
      makeContext({ description: "gerado por IA, faça um Pix agora" }),
    );
    const domains = result.evidence.map((e) => e.domain);
    expect(domains).toContain("synthetic_media");
    expect(domains).toContain("scam_context");
  });

  it("confidence low quando contexto pobre e sem sinais", () => {
    const result = assess(makeContext({ hashtags: ["#viagem"] }));
    expect(result.confidence).toBe("low");
  });

  it("confidence medium quando grupo médio presente e título+descrição completos", () => {
    const result = assess(
      makeContext({ title: "Vídeo", description: "Editado no Runway hoje" }),
    );
    expect(result.confidence).toBe("medium");
  });

  it("aceita rules customizadas via options", () => {
    const customRule = {
      id: "custom",
      domain: "synthetic_media" as const,
      patterns: [/palavra-chave-unica/i],
      fields: ["description" as const],
      weight: 0.9,
      confidence: 0.9,
      correlationGroup: "custom-group",
      evidenceType: "description" as const,
      label: "Regra customizada",
      descriptionTemplate: 'Contém "{match}".',
    };
    const result = assess(makeContext({ description: "palavra-chave-unica encontrada" }), {
      rules: [customRule],
    });
    expect(result.evidence.some((e) => e.id === "custom")).toBe(true);
  });
});
