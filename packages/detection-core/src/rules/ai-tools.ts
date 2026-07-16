import { wholeWord } from "./pattern-utils";
import { TEXT_FIELDS, type TextRule } from "./types";

// Ferramentas de geração de vídeo/imagem por IA mencionadas no texto do vídeo.
// Uma única regra: mencionar qualquer ferramenta é o mesmo sinal (menção a
// ferramenta de IA), então basta uma evidência por vídeo, não uma por ferramenta.
export const aiToolRules: TextRule[] = [
  {
    id: "ai-tool-mention",
    domain: "synthetic_media",
    patterns: [
      wholeWord("sora"),
      wholeWord("veo"),
      wholeWord("runway"),
      wholeWord("kling"),
      wholeWord("midjourney"),
      wholeWord("pika"),
      wholeWord("luma"),
      wholeWord("synthesia"),
      wholeWord("heygen"),
      wholeWord("stable diffusion"),
      wholeWord("dall·e"),
      wholeWord("dall-e"),
      wholeWord("dalle"),
    ],
    fields: TEXT_FIELDS,
    weight: 0.6,
    confidence: 0.9,
    correlationGroup: "ai-tool-mention",
    evidenceType: "description",
    label: "Menção a ferramenta de geração por IA",
    descriptionTemplate: 'O texto menciona "{match}", nome associado a ferramentas de geração de vídeo ou imagem por IA.',
  },
];
