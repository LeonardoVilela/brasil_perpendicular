export type EvidenceDomain =
  | "synthetic_media" | "provenance" | "platform_disclosure"
  | "scam_context" | "fact_check" | "technical_availability";

export interface Evidence {
  id: string;
  domain: EvidenceDomain;
  type: "platform_label" | "description" | "hashtag" | "watermark"
      | "metadata" | "visual_model" | "source" | "other";
  label: string;
  description: string;
  weight: number;       // 0..1
  confidence: number;   // 0..1
  correlationGroup: string;
  source?: string;
}

export type Classification =
  | "declared_ai" | "likely_ai" | "possibly_ai"
  | "insufficient_evidence" | "inconclusive" | "error";

export type ScamRisk = "none" | "low" | "medium" | "high";

export interface DetectionAssessment {
  classification: Classification;
  score: number;
  confidence: "low" | "medium" | "high";
  scamRisk: ScamRisk;
  evidence: Evidence[];
  executedAnalyses: string[];
  unavailableAnalyses: string[];
  limitations: string[];
  analyzedAt: string;
  assessmentVersion: string;
  rulesetVersion: string;
  detectorVersions: Record<string, string>;
}

export interface VideoContext {
  platform: string;
  pageUrl: string;          // já normalizada
  title?: string;
  description?: string;
  hashtags: string[];
  ariaLabels: string[];
  captions: string[];
  authorName?: string;
  durationSeconds?: number;
}
