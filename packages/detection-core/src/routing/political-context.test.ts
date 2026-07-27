import { describe, expect, it } from "vitest";
import type { VideoContext } from "@bp/shared";
import { assess } from "../assess";
import { detectPoliticalContext } from "./political-context";

function context(overrides: Partial<VideoContext> = {}): VideoContext {
  return {
    platform: "generic",
    pageUrl: "https://example.com/video",
    hashtags: [],
    ariaLabels: [],
    captions: [],
    ...overrides,
  };
}

describe("detectPoliticalContext", () => {
  it.each([
    "Pronunciamento de Lula",
    "Entrevista com Jair Bolsonaro",
    "Eleições 2026: veja as regras",
    "TSE apresenta a urna eletrônica",
    "Debate para presidente da República",
    "Candidata a deputada federal",
    "Partido dos Trabalhadores anuncia candidatura",
    "Notícia do PSOL",
  ])("detecta contexto político em %s", (title) => {
    expect(detectPoliticalContext(context({ title })).detected).toBe(true);
  });

  it.each(["#pt", "#pl", "#lula", "#bolsonaro", "#eleicoes2026"])(
    "aceita a hashtag política exata %s",
    (tag) => {
      expect(detectPoliticalContext(context({ hashtags: [tag] })).detected).toBe(true);
    },
  );

  it("exige uma âncora política para PT e PL em texto livre", () => {
    expect(detectPoliticalContext(context({ title: "Curso de PL/SQL" })).detected).toBe(false);
    expect(detectPoliticalContext(context({ title: "Página em pt-BR" })).detected).toBe(false);
    expect(detectPoliticalContext(context({ title: "Aprovação do PL 123" })).detected).toBe(false);
    expect(detectPoliticalContext(context({ title: "Candidato do PL participa de debate" })).detected).toBe(true);
    expect(detectPoliticalContext(context({ title: "Partido PT lança candidata" })).detected).toBe(true);
  });

  it("não casa nomes como substring", () => {
    expect(detectPoliticalContext(context({ title: "Como cuidar de plantas" })).detected).toBe(false);
  });

  it("não altera score nem classificação da avaliação de IA", () => {
    const neutral = assess(context({ title: "Vídeo sem contexto" }));
    const political = assess(context({ title: "Lula nas Eleições 2026" }));

    expect(political.score).toBe(neutral.score);
    expect(political.classification).toBe(neutral.classification);
  });
});
