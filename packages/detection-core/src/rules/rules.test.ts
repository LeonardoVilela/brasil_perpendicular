import { describe, expect, it } from "vitest";
import type { VideoContext } from "@bp/shared";
import { runRules } from "../engine";
import { aiToolRules } from "./ai-tools";
import { declarationRules } from "./declarations";
import { hashtagRules } from "./hashtags";
import { scamRules } from "./scam-patterns";
import { defaultRules, RULESET_VERSION } from "./index";

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

describe("defaultRules", () => {
  it("é a concatenação de todos os conjuntos de regras", () => {
    expect(defaultRules).toHaveLength(
      aiToolRules.length + declarationRules.length + hashtagRules.length + scamRules.length,
    );
  });

  it("expõe a versão do conjunto de regras", () => {
    expect(RULESET_VERSION).toBe("0.1.0");
  });

  it("nenhum padrão usa a flag 'g' (estado compartilhado quebraria .test()/.exec())", () => {
    for (const rule of defaultRules) {
      for (const pattern of rule.patterns) {
        expect(pattern.global).toBe(false);
      }
    }
  });
});

describe("ai-tools", () => {
  it.each([
    ["Sora", "vídeo feito no Sora essa semana"],
    ["Veo", "criado com o Veo do Google"],
    ["Runway", "editado no Runway ML"],
    ["Kling", "gerado pelo Kling AI"],
    ["Midjourney", "imagem feita no Midjourney"],
    ["Pika", "renderizado com Pika Labs"],
    ["Luma", "modelo Luma Dream Machine"],
    ["Synthesia", "avatar da Synthesia"],
    ["HeyGen", "vídeo do HeyGen"],
    ["Stable Diffusion", "gerado com Stable Diffusion"],
    ["DALL·E", "imagem do DALL·E"],
  ])("detecta menção a %s", (_tool, description) => {
    const evidence = runRules(makeContext({ description }), aiToolRules);
    expect(evidence).toHaveLength(1);
  });

  it("não casa 'pikachu' com a regra do Pika", () => {
    const evidence = runRules(
      makeContext({ description: "Assisti um desenho do pikachu ontem" }),
      aiToolRules,
    );
    expect(evidence).toHaveLength(0);
  });

  it("não casa 'sorate' com a regra do Sora", () => {
    const evidence = runRules(
      makeContext({ description: "Fizemos um sorate na faculdade" }),
      aiToolRules,
    );
    expect(evidence).toHaveLength(0);
  });
});

describe("declarations", () => {
  it.each([
    "este vídeo foi gerado por IA",
    "conteúdo criado com IA",
    "isto é conteúdo sintético",
    "este é um vídeo de IA",
    "this is AI generated content",
    "this is AI-generated content",
    "an example of synthetic media",
    "made with AI tools",
  ])("detecta declaração explícita em: %s", (description) => {
    const evidence = runRules(makeContext({ description }), declarationRules);
    expect(evidence).toHaveLength(1);
  });

  it("não casa em texto sem declaração explícita", () => {
    const evidence = runRules(
      makeContext({ description: "vídeo de viagem para a praia com a família" }),
      declarationRules,
    );
    expect(evidence).toHaveLength(0);
  });
});

describe("hashtags", () => {
  it.each([["#ia"], ["#ai"], ["#aigenerated"], ["#geradoporia"], ["#aivideo"], ["#iagenerativa"], ["#sora"], ["#veo"]])(
    "detecta a hashtag %s",
    (tag) => {
      const evidence = runRules(makeContext({ hashtags: ["#familia", tag, "#2026"] }), hashtagRules);
      expect(evidence).toHaveLength(1);
      expect(evidence[0]?.source).toBe("hashtags");
    },
  );

  it("não casa hashtag parecida mas diferente (#aigeneratedstuff)", () => {
    const evidence = runRules(
      makeContext({ hashtags: ["#aigeneratedstuff", "#iamodelo"] }),
      hashtagRules,
    );
    expect(evidence).toHaveLength(0);
  });
});

describe("scam-patterns", () => {
  it("scam-indemnity: casa frase realista e não casa quase-igual benigna", () => {
    const positive = runRules(
      makeContext({
        description: "Você tem direito a uma indenização de até R$ 5000, saiba como reclamar",
      }),
      scamRules,
    );
    expect(positive.some((e) => e.correlationGroup === "scam-indemnity")).toBe(true);

    const negative = runRules(
      makeContext({ description: "Ele tem direito a um dia de folga por lei" }),
      scamRules,
    );
    expect(negative.some((e) => e.correlationGroup === "scam-indemnity")).toBe(false);
  });

  it("scam-gov-benefit: casa frase realista e não casa quase-igual benigna", () => {
    const positive = runRules(
      makeContext({
        description: "Seu saque está liberado, consulte seu CPF agora no site do governo",
      }),
      scamRules,
    );
    expect(positive.some((e) => e.correlationGroup === "scam-gov-benefit")).toBe(true);

    const negative = runRules(
      makeContext({
        description: "O valor da conta já está liberado para pagamento no caixa",
      }),
      scamRules,
    );
    expect(negative.some((e) => e.correlationGroup === "scam-gov-benefit")).toBe(false);
  });

  it("scam-investment: casa frase realista e não casa quase-igual benigna", () => {
    const positive = runRules(
      makeContext({
        description: "Garanta agora um investimento garantido com renda extra garantida todo mês",
      }),
      scamRules,
    );
    expect(positive.some((e) => e.correlationGroup === "scam-investment")).toBe(true);

    const negative = runRules(
      makeContext({
        description: "Fizemos um investimento arriscado que não é garantido por ninguém",
      }),
      scamRules,
    );
    expect(negative.some((e) => e.correlationGroup === "scam-investment")).toBe(false);
  });

  it("scam-pix: casa frase realista e não casa quase-igual benigna", () => {
    const positive = runRules(
      makeContext({ description: "Para confirmar, faça um Pix de R$50 para este número agora" }),
      scamRules,
    );
    expect(positive.some((e) => e.correlationGroup === "scam-pix")).toBe(true);

    const negative = runRules(
      makeContext({ description: "Posso pagar com Pix ou cartão, você aceita?" }),
      scamRules,
    );
    expect(negative.some((e) => e.correlationGroup === "scam-pix")).toBe(false);
  });

  it("scam-loan: casa frase realista e não casa quase-igual benigna", () => {
    const positive = runRules(
      makeContext({
        description: "Empréstimo imediato sem consulta ao SPC ou Serasa, aprovação na hora",
      }),
      scamRules,
    );
    expect(positive.some((e) => e.correlationGroup === "scam-loan")).toBe(true);

    const negative = runRules(
      makeContext({ description: "Fiz um empréstimo no banco depois de falar com meu gerente" }),
      scamRules,
    );
    expect(negative.some((e) => e.correlationGroup === "scam-loan")).toBe(false);
  });

  it("scam-urgency: casa frase realista e não casa quase-igual benigna", () => {
    const positive = runRules(
      makeContext({ description: "São as últimas vagas, garanta a sua só hoje" }),
      scamRules,
    );
    expect(positive.some((e) => e.correlationGroup === "scam-urgency")).toBe(true);

    const negative = runRules(
      makeContext({ description: "Hoje foi um dia comum, temos vagas abertas para o time" }),
      scamRules,
    );
    expect(negative.some((e) => e.correlationGroup === "scam-urgency")).toBe(false);
  });

  it("scam patterns não entram em campos fora de texto corrido", () => {
    const evidence = runRules(makeContext({ pageUrl: "https://example.com/pix-loan-scam" }), scamRules);
    expect(evidence).toHaveLength(0);
  });
});
