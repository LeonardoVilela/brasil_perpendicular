import { z } from "zod";
import type { Classification, DetectionAssessment, VideoContext } from "./types";
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

export type RequestMessage =
  | { kind: "CACHE_GET"; key: string }
  | { kind: "CACHE_PUT"; key: string; assessment: DetectionAssessment }
  | { kind: "CACHE_CLEAR" }
  | { kind: "SETTINGS_GET" }
  | { kind: "SETTINGS_SET"; settings: Settings }
  | { kind: "DEEP_ANALYZE_REQUEST"; context: VideoContext }
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
  z.object({ kind: z.literal("FEEDBACK_SUBMIT"), feedback: feedbackPayloadSchema }),
  z.object({ kind: z.literal("INJECT_CONTENT_SCRIPT"), tabId: z.number() }),
]);
