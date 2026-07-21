import { wholeWord } from "./pattern-utils";
import { TEXT_FIELDS, type TextRule } from "./types";

const DECLARATION_PATTERNS = [
  wholeWord("gerado por ia"),
  wholeWord("criado com ia"),
  wholeWord("feito com ia"),
  wholeWord("produzido com ia"),
  wholeWord("conteúdo sintético"),
  wholeWord("vídeo de ia"),
  wholeWord("ai generated"),
  wholeWord("ai-generated"),
  wholeWord("synthetic media"),
  wholeWord("made with ai"),
];

const NEGATED_DECLARATION_PATTERNS = [
  /(?:não|nao)\s+(?:foi\s+|é\s+|e\s+)?(?:gerad[oa]|criad[oa]|feit[oa]|produzid[oa])\s+(?:por|com)\s+ia/iu,
  /(?:not|wasn['’]?t)\s+(?:ai[- ]generated|made with ai|synthetic media)/iu,
];

// Declarações explícitas de que o conteúdo foi gerado ou é sintético.
// Sinal forte (weight alto): o próprio texto assume o uso de IA.
export const declarationRules: TextRule[] = [
  {
    id: "author-ai-declaration",
    domain: "synthetic_media",
    patterns: DECLARATION_PATTERNS,
    exclusions: NEGATED_DECLARATION_PATTERNS,
    fields: ["authorStatements"],
    weight: 0.85,
    confidence: 0.9,
    correlationGroup: "explicit-declaration",
    origin: "author_statement",
    evidenceType: "description",
    label: "Declaração do autor sobre uso de IA",
    descriptionTemplate: 'O autor declarou "{match}" no conteúdo associado ao vídeo.',
  },
  {
    id: "context-ai-declaration",
    domain: "synthetic_media",
    patterns: DECLARATION_PATTERNS,
    exclusions: NEGATED_DECLARATION_PATTERNS,
    fields: TEXT_FIELDS,
    weight: 0.65,
    confidence: 0.85,
    correlationGroup: "explicit-declaration",
    origin: "page_context",
    evidenceType: "description",
    label: "Texto próximo menciona conteúdo gerado por IA",
    descriptionTemplate: 'O contexto próximo contém "{match}", mas a autoria dessa declaração não foi confirmada.',
  },
  {
    id: "native-platform-ai-label",
    domain: "platform_disclosure",
    patterns: [
      wholeWord("conteúdo alterado ou sintético"),
      wholeWord("conteúdo gerado por ia"),
      wholeWord("informações de conteúdo de ia"),
      wholeWord("made with ai"),
      wholeWord("criado com ia"),
      wholeWord("ai-generated"),
      wholeWord("ai info"),
      wholeWord("informações de ia"),
      wholeWord("altered or synthetic content"),
    ],
    fields: ["platformLabels"],
    weight: 1,
    confidence: 0.98,
    correlationGroup: "platform-label",
    origin: "platform_disclosure",
    evidenceType: "platform_label",
    label: "Rótulo nativo da plataforma",
    descriptionTemplate: 'A plataforma exibiu o rótulo "{match}" neste vídeo.',
  },
];
