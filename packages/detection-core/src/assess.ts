import type { AnalysisDetail, DetectionAssessment, Evidence, VideoContext } from "@bp/shared";
import { classify, scamRiskFrom } from "./classify";
import { runRules } from "./engine";
import { defaultRules, RULESET_VERSION } from "./rules";
import type { TextRule } from "./rules/types";

export const ASSESSMENT_VERSION = "0.3.0";

const VISUAL_MODEL_LIMITATION = "Análise visual não disponível nesta versão.";
const NO_TEXT_CONTEXT_LIMITATION = "Nenhum contexto textual encontrado na página.";

const CONFIDENCE_STRONG_GROUP_THRESHOLD = 0.8;
const CONFIDENCE_MEDIUM_GROUP_THRESHOLD = 0.5;
const CONFIDENCE_HIGH_MIN_EXECUTED = 2;

export interface AssessOptions {
  rules?: TextRule[];
  additionalEvidence?: Evidence[];
  executedAnalyses?: string[];
  unavailableAnalyses?: string[];
  limitations?: string[];
  detectorVersions?: Record<string, string>;
  visualAnalysisAvailable?: boolean;
  analysisDetails?: AnalysisDetail[];
}

function hasTextContext(context: VideoContext): boolean {
  return Boolean(
    context.title?.trim() ||
      context.description?.trim() ||
      context.hashtags.length > 0 ||
      context.ariaLabels.length > 0 ||
      context.captions.length > 0 ||
      (context.authorStatements?.length ?? 0) > 0 ||
      (context.platformLabels?.length ?? 0) > 0,
  );
}

/** Maior `weight × confidence` por `correlationGroup`, entre todos os domínios. */
function maxGroupEffective(evidence: Evidence[]): number {
  const groups = new Map<string, number>();
  for (const e of evidence) {
    const effective = e.weight * e.confidence;
    if (effective > (groups.get(e.correlationGroup) ?? 0)) {
      groups.set(e.correlationGroup, effective);
    }
  }
  return groups.size === 0 ? 0 : Math.max(...groups.values());
}

function confidenceFor(
  evidence: Evidence[],
  classification: DetectionAssessment["classification"],
  executedAnalyses: string[],
  context: VideoContext,
): DetectionAssessment["confidence"] {
  const strongestGroup = maxGroupEffective(evidence);
  const hasStrongGroup = strongestGroup >= CONFIDENCE_STRONG_GROUP_THRESHOLD;
  const hasMediumGroup = strongestGroup >= CONFIDENCE_MEDIUM_GROUP_THRESHOLD;

  if (classification === "declared_ai" || (hasStrongGroup && executedAnalyses.length >= CONFIDENCE_HIGH_MIN_EXECUTED)) {
    return "high";
  }
  const contextComplete = Boolean(context.title?.trim()) && Boolean(context.description?.trim());
  if (hasMediumGroup && contextComplete) return "medium";
  return "low";
}

function removeWeakerDuplicates(evidence: Evidence[]): Evidence[] {
  const hasAuthorDeclaration = evidence.some(
    (item) => item.origin === "author_statement" && item.correlationGroup === "explicit-declaration",
  );
  return hasAuthorDeclaration
    ? evidence.filter(
        (item) =>
          item.origin !== "page_context" || item.correlationGroup !== "explicit-declaration",
      )
    : evidence;
}

/** Monta a avaliação completa a partir do contexto textual da página (Camada 1). */
export function assess(context: VideoContext, options: AssessOptions = {}): DetectionAssessment {
  const rules = options.rules ?? defaultRules;
  const executedAnalyses = hasTextContext(context) ? ["context_rules"] : [];
  if (context.platform !== "generic") executedAnalyses.push("platform_adapter");
  executedAnalyses.push(...(options.executedAnalyses ?? []));
  const evidence = removeWeakerDuplicates([
    ...runRules(context, rules),
    ...(options.additionalEvidence ?? []),
  ]);

  const { classification, score } = classify(evidence, executedAnalyses);
  const scamRisk = scamRiskFrom(evidence);
  const confidence = confidenceFor(evidence, classification, executedAnalyses, context);

  const unavailableAnalyses = [
    ...(options.visualAnalysisAvailable ? [] : ["visual_model"]),
    ...(options.unavailableAnalyses ?? []),
  ];
  const limitations = [
    ...(options.visualAnalysisAvailable ? [] : [VISUAL_MODEL_LIMITATION]),
    ...(options.limitations ?? []),
  ];
  if (executedAnalyses.length === 0) limitations.push(NO_TEXT_CONTEXT_LIMITATION);

  return {
    classification,
    score,
    confidence,
    scamRisk,
    evidence,
    executedAnalyses: [...new Set(executedAnalyses)],
    unavailableAnalyses: [...new Set(unavailableAnalyses)],
    limitations: [...new Set(limitations)],
    analyzedAt: new Date().toISOString(),
    assessmentVersion: ASSESSMENT_VERSION,
    rulesetVersion: RULESET_VERSION,
    detectorVersions: { context_rules: RULESET_VERSION, ...options.detectorVersions },
    analysisDetails: options.analysisDetails,
  };
}
