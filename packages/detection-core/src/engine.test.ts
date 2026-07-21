import { describe, expect, it } from "vitest";
import type { VideoContext } from "@bp/shared";
import { runRules } from "./engine";
import type { TextRule } from "./rules/types";

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

const soraRule: TextRule = {
  id: "test-sora",
  domain: "synthetic_media",
  patterns: [/\bsora\b/i],
  fields: ["description"],
  weight: 0.6,
  confidence: 0.9,
  correlationGroup: "ai-tool-mention",
  origin: "page_context",
  evidenceType: "description",
  label: "Menção a ferramenta de IA",
  descriptionTemplate: 'O texto menciona "{match}".',
};

describe("runRules", () => {
  it("gera evidência quando padrão casa em um campo", () => {
    const evidence = runRules(makeContext({ description: "feito no Sora hoje" }), [soraRule]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.description).toContain("Sora");
    expect(evidence[0]?.id).toBe("test-sora");
    expect(evidence[0]?.source).toBe("description");
    expect(evidence[0]?.origin).toBe("page_context");
  });

  it("uma regra gera no máximo uma evidência mesmo casando em vários campos", () => {
    const rule: TextRule = { ...soraRule, fields: ["title", "description"] };
    const context = makeContext({ title: "Sora video", description: "outro Sora aqui" });
    const evidence = runRules(context, [rule]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.source).toBe("title");
  });

  it("não casa 'pikachu' com regra do Pika", () => {
    const pikaRule: TextRule = { ...soraRule, id: "test-pika", patterns: [/\bpika\b/i] };
    const evidence = runRules(makeContext({ description: "Assisti um vídeo do pikachu" }), [
      pikaRule,
    ]);
    expect(evidence).toHaveLength(0);
  });

  it("campos ausentes não geram evidência", () => {
    const evidence = runRules(makeContext(), [soraRule]);
    expect(evidence).toHaveLength(0);
  });

  it("campos de array são unidos com quebra de linha antes do teste", () => {
    const rule: TextRule = { ...soraRule, fields: ["hashtags"] };
    const context = makeContext({ hashtags: ["#gato", "#sora", "#video"] });
    const evidence = runRules(context, [rule]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.source).toBe("hashtags");
  });

  it("cada regra é avaliada de forma independente", () => {
    const otherRule: TextRule = { ...soraRule, id: "test-veo", patterns: [/\bveo\b/i] };
    const context = makeContext({ description: "feito no Sora e também no Veo" });
    const evidence = runRules(context, [soraRule, otherRule]);
    expect(evidence).toHaveLength(2);
    expect(evidence.map((e) => e.id).sort()).toEqual(["test-sora", "test-veo"]);
  });

  it("trunca o trecho encontrado na descrição para cerca de 80 caracteres", () => {
    const longWord = "a".repeat(200);
    const rule: TextRule = {
      ...soraRule,
      patterns: [new RegExp(`sora${longWord}`, "i")],
      descriptionTemplate: 'Trecho: "{match}"',
    };
    const evidence = runRules(makeContext({ description: `sora${longWord}` }), [rule]);
    expect(evidence[0]?.description.length).toBeLessThan(120);
  });
});
