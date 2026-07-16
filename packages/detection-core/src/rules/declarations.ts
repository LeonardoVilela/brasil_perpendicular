import { wholeWord } from "./pattern-utils";
import { TEXT_FIELDS, type TextRule } from "./types";

// Declarações explícitas de que o conteúdo foi gerado ou é sintético.
// Sinal forte (weight alto): o próprio texto assume o uso de IA.
export const declarationRules: TextRule[] = [
  {
    id: "explicit-ai-declaration",
    domain: "synthetic_media",
    patterns: [
      wholeWord("gerado por ia"),
      wholeWord("criado com ia"),
      wholeWord("conteúdo sintético"),
      wholeWord("vídeo de ia"),
      wholeWord("ai generated"),
      wholeWord("ai-generated"),
      wholeWord("synthetic media"),
      wholeWord("made with ai"),
    ],
    fields: TEXT_FIELDS,
    weight: 0.85,
    confidence: 0.9,
    correlationGroup: "explicit-declaration",
    evidenceType: "description",
    label: "Declaração explícita de conteúdo gerado por IA",
    descriptionTemplate: 'O texto contém a expressão "{match}", uma declaração explícita de uso de IA.',
  },
];
