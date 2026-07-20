import type { Classification, Evidence, EvidenceDomain, ScamRisk } from "@bp/shared";
import { aggregateDomain } from "./aggregate";

const DECLARED_PLATFORM_DISCLOSURE_THRESHOLD = 0.9;
const DECLARED_EXPLICIT_DECLARATION_THRESHOLD = 0.75;
const LIKELY_AI_THRESHOLD = 0.75;
const POSSIBLY_AI_THRESHOLD = 0.45;

const SCAM_HIGH_THRESHOLD = 0.7;
const SCAM_MEDIUM_THRESHOLD = 0.45;
const SCAM_LOW_THRESHOLD = 0.25;

/** Maior `weight × confidence` de um `correlationGroup` específico, sem os tetos de composição de `aggregateDomain`. */
function groupEffective(evidence: Evidence[], domain: EvidenceDomain, correlationGroup: string): number {
  let max = 0;
  for (const e of evidence) {
    if (e.domain !== domain || e.correlationGroup !== correlationGroup) continue;
    const effective = e.weight * e.confidence;
    if (effective > max) max = effective;
  }
  return max;
}

/**
 * Classifica evidências em uma das categorias de `docs/detection-pipeline.md` §6.
 * `score` representa somente o domínio `synthetic_media`. Divulgação de
 * plataforma permanece separada e participa apenas do gatilho `declared_ai`.
 */
export function classify(evidence: Evidence[], executed: string[]): { classification: Classification; score: number } {
  const score = aggregateDomain(evidence, "synthetic_media");

  if (executed.length === 0) {
    return { classification: "inconclusive", score };
  }

  const declaredByPlatform =
    groupEffective(evidence, "platform_disclosure", "platform-label") >= DECLARED_PLATFORM_DISCLOSURE_THRESHOLD;
  const declaredByAuthor =
    groupEffective(evidence, "synthetic_media", "explicit-declaration") >= DECLARED_EXPLICIT_DECLARATION_THRESHOLD;
  if (declaredByPlatform || declaredByAuthor) {
    return { classification: "declared_ai", score };
  }

  if (score >= LIKELY_AI_THRESHOLD) return { classification: "likely_ai", score };
  if (score >= POSSIBLY_AI_THRESHOLD) return { classification: "possibly_ai", score };
  return { classification: "insufficient_evidence", score };
}

/** Agrega o domínio `scam_context` em uma faixa de risco (nunca entra no score de `synthetic_media`). */
export function scamRiskFrom(evidence: Evidence[]): ScamRisk {
  const score = aggregateDomain(evidence, "scam_context");
  if (score >= SCAM_HIGH_THRESHOLD) return "high";
  if (score >= SCAM_MEDIUM_THRESHOLD) return "medium";
  if (score >= SCAM_LOW_THRESHOLD) return "low";
  return "none";
}
