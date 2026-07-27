import { exactLine } from "./pattern-utils";
import type { TextRule } from "./types";

// Hashtags associadas a conteúdo de IA. Sinal fraco/médio isoladamente — hashtags
// são fáceis de copiar e não confirmam origem sintética por si só.
export const hashtagRules: TextRule[] = [
  {
    id: "ai-hashtag-mention",
    domain: "synthetic_media",
    patterns: [
      exactLine("#ia"),
      exactLine("#ai"),
      exactLine("#aigenerated"),
      exactLine("#geradoporia"),
      exactLine("#aivideo"),
      exactLine("#iagenerativa"),
      exactLine("#sora"),
      exactLine("#veo"),
    ],
    fields: ["hashtags"],
    weight: 0.45,
    confidence: 0.85,
    correlationGroup: "ai-hashtag",
    origin: "page_context",
    evidenceType: "hashtag",
    label: "Hashtag associada a conteúdo de IA",
    descriptionTemplate: 'A hashtag "{match}" costuma indicar conteúdo relacionado a IA.',
  },
];
