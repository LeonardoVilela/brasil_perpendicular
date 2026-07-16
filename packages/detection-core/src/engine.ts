import type { Evidence, VideoContext } from "@bp/shared";
import type { ContextField, TextRule } from "./rules/types";

const EXCERPT_MAX_LENGTH = 80;

function truncate(text: string): string {
  return text.length > EXCERPT_MAX_LENGTH ? `${text.slice(0, EXCERPT_MAX_LENGTH)}…` : text;
}

function fieldText(context: VideoContext, field: ContextField): string | undefined {
  const value = context[field];
  return Array.isArray(value) ? value.join("\n") : value;
}

function buildEvidence(rule: TextRule, field: ContextField, matchedText: string): Evidence {
  return {
    id: rule.id,
    domain: rule.domain,
    type: rule.evidenceType,
    label: rule.label,
    description: rule.descriptionTemplate.replace("{match}", truncate(matchedText)),
    weight: rule.weight,
    confidence: rule.confidence,
    correlationGroup: rule.correlationGroup,
    source: field,
  };
}

function findMatch(context: VideoContext, rule: TextRule): Evidence | undefined {
  for (const field of rule.fields) {
    const text = fieldText(context, field);
    if (!text) continue;
    for (const pattern of rule.patterns) {
      // guarda: se alguma regra escapar com flag "g"/"y", zera o lastIndex compartilhado
      // antes de testar, evitando que o estado de uma chamada vaze para a próxima.
      if (pattern.global || pattern.sticky) pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) return buildEvidence(rule, field, match[0] ?? "");
    }
  }
  return undefined;
}

export function runRules(context: VideoContext, rules: TextRule[]): Evidence[] {
  const evidence: Evidence[] = [];
  for (const rule of rules) {
    const found = findMatch(context, rule);
    if (found) evidence.push(found);
  }
  return evidence;
}
