import type { Evidence, EvidenceDomain } from "@bp/shared";

/**
 * Agrega evidências de um único domínio em um score 0..1.
 *
 * Evidências correlacionadas (mesmo `correlationGroup`) nunca somam — o grupo vale
 * o máximo (`weight × confidence`) entre elas. Grupos independentes combinam por
 * noisy-OR. Tetos de composição evitam que muitos sinais fracos/médios produzam um
 * score alto sem nenhum sinal realmente forte.
 */
export function aggregateDomain(evidence: Evidence[], domain: EvidenceDomain): number {
  const groups = new Map<string, number>();
  for (const e of evidence) {
    if (e.domain !== domain) continue;
    const effective = e.weight * e.confidence;
    if (effective > (groups.get(e.correlationGroup) ?? 0)) {
      groups.set(e.correlationGroup, effective);
    }
  }
  const scores = [...groups.values()];
  if (scores.length === 0) return 0;
  let combined = 1 - scores.reduce((acc, s) => acc * (1 - s), 1);
  const strong = scores.filter((s) => s >= 0.8).length;
  const medium = scores.filter((s) => s >= 0.5 && s < 0.8).length;
  if (strong === 0 && medium === 0) combined = Math.min(combined, 0.49);
  else if (strong === 0 && medium < 2) combined = Math.min(combined, 0.74);
  return combined;
}
