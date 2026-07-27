import { z } from "zod";
import type {
  Classification,
  DeepVisualResult,
  DeepVisualRequest,
  DetectionAssessment,
  VideoContext,
} from "./types";
import type { Settings } from "./settings";

const evidenceSchema = z.object({
  id: z.string(),
  domain: z.enum([
    "synthetic_media",
    "provenance",
    "platform_disclosure",
    "scam_context",
    "fact_check",
    "technical_availability",
  ]),
  type: z.enum([
    "platform_label",
    "description",
    "hashtag",
    "watermark",
    "metadata",
    "visual_model",
    "source",
    "other",
  ]),
  label: z.string(),
  description: z.string(),
  weight: z.number(),
  confidence: z.number(),
  correlationGroup: z.string(),
  origin: z.enum([
    "signed_provenance",
    "platform_disclosure",
    "author_statement",
    "page_context",
    "technical_signal",
  ]),
  source: z.string().optional(),
});

const classificationSchema: z.ZodType<Classification> = z.enum([
  "declared_ai",
  "likely_ai",
  "possibly_ai",
  "insufficient_evidence",
  "inconclusive",
  "error",
]);

const detectionAssessmentSchema: z.ZodType<DetectionAssessment> = z.object({
  classification: classificationSchema,
  score: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  scamRisk: z.enum(["none", "low", "medium", "high"]),
  evidence: z.array(evidenceSchema),
  executedAnalyses: z.array(z.string()),
  unavailableAnalyses: z.array(z.string()),
  limitations: z.array(z.string()),
  analyzedAt: z.string(),
  assessmentVersion: z.string(),
  rulesetVersion: z.string(),
  detectorVersions: z.record(z.string(), z.string()),
  analysisDetails: z
    .array(
      z.object({
        analysis: z.enum(["d3_visual", "stall_visual", "political_routing"]),
        detector: z.string().optional(),
        version: z.string().optional(),
        backend: z.enum(["webgpu", "wasm", "remote", "unavailable"]).optional(),
        sampledFrames: z.number().int().nonnegative().optional(),
        usableFrames: z.number().int().nonnegative().optional(),
        reason: z
          .enum([
            "political_context",
            "local_positive",
            "local_uncertain",
            "local_unavailable",
            "signal_conflict",
            "manual_request",
          ])
          .optional(),
      }),
    )
    .optional(),
});

const videoContextSchema: z.ZodType<VideoContext> = z.object({
  platform: z.string(),
  pageUrl: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  hashtags: z.array(z.string()),
  ariaLabels: z.array(z.string()),
  captions: z.array(z.string()),
  authorStatements: z.array(z.string()).optional(),
  platformLabels: z.array(z.string()).optional(),
  authorName: z.string().optional(),
  durationSeconds: z.number().optional(),
});

const settingsSchema: z.ZodType<Settings> = z.object({
  autoAnalyzeEnabled: z.boolean(),
  deepAnalysisEnabled: z.boolean(),
  automaticDeepVisualAnalysisEnabled: z.boolean(),
  minVisibleMs: z.number().int().nonnegative(),
  maxConcurrentAnalyses: z.number().int().positive(),
  enabledPlatforms: z.object({
    youtube: z.boolean(),
    tiktok: z.boolean(),
    instagram: z.boolean(),
    twitter: z.boolean(),
    generic: z.boolean(),
  }),
  showBadge: z.boolean(),
  devMode: z.boolean(),
  apiUrl: z.string().url(),
});

export interface FeedbackPayload {
  classification: Classification;
  score: number;
  assessmentVersion: string;
  rulesetVersion: string;
  expected: "false_positive" | "false_negative";
  comment?: string;
}

const feedbackPayloadSchema: z.ZodType<FeedbackPayload> = z.object({
  classification: classificationSchema,
  score: z.number(),
  assessmentVersion: z.string(),
  rulesetVersion: z.string(),
  expected: z.enum(["false_positive", "false_negative"]),
  comment: z.string().optional(),
});

const deepVisualRequestSchema: z.ZodType<DeepVisualRequest> = z.object({
  frames: z.array(z.string().max(250_000)).min(4).max(16),
  frameFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sampleRateFps: z.literal(8),
  durationSeconds: z.literal(2),
  localDetector: z
    .object({
      name: z.string(),
      version: z.string(),
      decision: z.enum(["ai_like", "real_like", "uncertain", "unavailable"]),
      score: z.number().min(0).max(1),
    })
    .optional(),
  reason: z.enum([
    "political_context",
    "local_positive",
    "local_uncertain",
    "local_unavailable",
    "signal_conflict",
    "manual_request",
  ]),
});

export const deepVisualResultSchema: z.ZodType<DeepVisualResult> = z
  .object({
    status: z.enum(["analyzed", "unavailable"]),
    detector: z.literal("stall-dinov3-vitl16"),
    detectorVersion: z.string().min(1).max(200),
    calibrationVersion: z.string().min(1).max(200),
    spatialScore: z.number().min(0).max(1).optional(),
    temporalScore: z.number().min(0).max(1).optional(),
    syntheticScore: z.number().min(0).max(1).optional(),
    decision: z.enum(["ai_like", "real_like", "uncertain"]).optional(),
    confidence: z.number().min(0).max(1).optional(),
    sampledFrames: z.number().int().min(0).max(16),
    warnings: z.array(z.string().max(200)).max(20),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status !== "analyzed") return;
    if (
      result.spatialScore === undefined ||
      result.temporalScore === undefined ||
      result.syntheticScore === undefined ||
      result.decision === undefined ||
      result.confidence === undefined
    ) {
      context.addIssue({ code: "custom", message: "resultado analisado incompleto" });
      return;
    }
    const expectedDecision =
      result.syntheticScore >= 0.95
        ? "ai_like"
        : result.syntheticScore <= 0.2
          ? "real_like"
          : "uncertain";
    if (result.decision !== expectedDecision) {
      context.addIssue({ code: "custom", message: "decisão incompatível com o score" });
    }
  });

export type RequestMessage =
  | { kind: "CACHE_GET"; key: string }
  | { kind: "CACHE_PUT"; key: string; assessment: DetectionAssessment }
  | { kind: "CACHE_CLEAR" }
  | { kind: "SETTINGS_GET" }
  | { kind: "SETTINGS_SET"; settings: Settings }
  | { kind: "DEEP_ANALYZE_REQUEST"; context: VideoContext }
  | { kind: "DEEP_VISUAL_ANALYZE_REQUEST"; payload: DeepVisualRequest }
  | { kind: "FEEDBACK_SUBMIT"; feedback: FeedbackPayload }
  | { kind: "INJECT_CONTENT_SCRIPT"; tabId: number };

// "MessageResponse" e não "Response" — evita colisão com o tipo DOM global Response
export type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DeepAnalysisReply {
  status: "unavailable" | "ok";
  detail: string;
}

export const requestMessageSchema: z.ZodType<RequestMessage> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CACHE_GET"), key: z.string() }),
  z.object({
    kind: z.literal("CACHE_PUT"),
    key: z.string(),
    assessment: detectionAssessmentSchema,
  }),
  z.object({ kind: z.literal("CACHE_CLEAR") }),
  z.object({ kind: z.literal("SETTINGS_GET") }),
  z.object({ kind: z.literal("SETTINGS_SET"), settings: settingsSchema }),
  z.object({ kind: z.literal("DEEP_ANALYZE_REQUEST"), context: videoContextSchema }),
  z.object({ kind: z.literal("DEEP_VISUAL_ANALYZE_REQUEST"), payload: deepVisualRequestSchema }),
  z.object({ kind: z.literal("FEEDBACK_SUBMIT"), feedback: feedbackPayloadSchema }),
  z.object({ kind: z.literal("INJECT_CONTENT_SCRIPT"), tabId: z.number() }),
]);
