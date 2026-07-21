import type { Evidence, EvidenceDomain } from "@bp/shared";

export type ContextField =
  | "title"
  | "description"
  | "hashtags"
  | "ariaLabels"
  | "captions"
  | "authorStatements"
  | "platformLabels"
  | "authorName"
  | "pageUrl";

export interface TextRule {
  id: string;
  domain: EvidenceDomain;
  patterns: RegExp[]; // sem flag "g" — estado compartilhado (lastIndex) quebra .test()/.exec()
  exclusions?: RegExp[]; // se casar no mesmo campo, a regra é ignorada de forma conservadora
  fields: ContextField[];
  weight: number;
  confidence: number;
  correlationGroup: string;
  origin: Evidence["origin"];
  evidenceType: Evidence["type"];
  label: string;
  descriptionTemplate: string; // "{match}" é substituído pelo trecho encontrado
}

// Campos textuais livres reutilizados pelos conjuntos de regras baseados em texto corrido.
export const TEXT_FIELDS: ContextField[] = ["title", "description", "captions", "ariaLabels"];
