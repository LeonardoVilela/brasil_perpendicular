import type { Evidence, EvidenceDomain } from "@bp/shared";

export type ContextField =
  | "title"
  | "description"
  | "hashtags"
  | "ariaLabels"
  | "captions"
  | "authorName"
  | "pageUrl";

export interface TextRule {
  id: string;
  domain: EvidenceDomain;
  patterns: RegExp[]; // sem flag "g" — estado compartilhado (lastIndex) quebra .test()/.exec()
  fields: ContextField[];
  weight: number;
  confidence: number;
  correlationGroup: string;
  evidenceType: Evidence["type"];
  label: string;
  descriptionTemplate: string; // "{match}" é substituído pelo trecho encontrado
}

// Campos textuais livres reutilizados pelos conjuntos de regras baseados em texto corrido.
export const TEXT_FIELDS: ContextField[] = ["title", "description", "captions", "ariaLabels"];
