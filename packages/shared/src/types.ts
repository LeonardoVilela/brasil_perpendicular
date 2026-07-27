export type EvidenceDomain =
  | "synthetic_media" | "provenance" | "platform_disclosure"
  | "scam_context" | "fact_check" | "technical_availability";

export type EvidenceOrigin =
  | "signed_provenance"
  | "platform_disclosure"
  | "author_statement"
  | "page_context"
  | "technical_signal";

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
  origin: EvidenceOrigin;
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
  analysisDetails?: AnalysisDetail[];
}

export interface VideoContext {
  platform: string;
  pageUrl: string;          // já normalizada
  title?: string;
  description?: string;
  hashtags: string[];
  ariaLabels: string[];
  captions: string[];
  authorStatements?: string[];
  platformLabels?: string[];
  authorName?: string;
  durationSeconds?: number;
}

export type VisualDecision = "ai_like" | "real_like" | "uncertain" | "unavailable";

export type DeepAnalysisReason =
  | "political_context"
  | "local_positive"
  | "local_uncertain"
  | "local_unavailable"
  | "signal_conflict"
  | "manual_request";

export interface AnalysisDetail {
  analysis: "d3_visual" | "stall_visual" | "political_routing";
  detector?: string;
  version?: string;
  backend?: "webgpu" | "wasm" | "remote" | "unavailable";
  sampledFrames?: number;
  usableFrames?: number;
  reason?: DeepAnalysisReason;
}

export interface DeepVisualRequest {
  frames: string[];
  frameFingerprint: string;
  sampleRateFps: 8;
  durationSeconds: 2;
  localDetector?: {
    name: string;
    version: string;
    decision: VisualDecision;
    score: number;
  };
  reason: DeepAnalysisReason;
}

export interface DeepVisualResult {
  status: "analyzed" | "unavailable";
  detector: "stall-dinov3-vitl16";
  detectorVersion: string;
  calibrationVersion: string;
  spatialScore?: number;
  temporalScore?: number;
  syntheticScore?: number;
  decision?: Exclude<VisualDecision, "unavailable">;
  confidence?: number;
  sampledFrames: number;
  warnings: string[];
}
