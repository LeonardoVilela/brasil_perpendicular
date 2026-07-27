import {
  deepVisualResultSchema,
  normalizeUrl,
  type DeepAnalysisReply,
  type DeepVisualRequest,
  type DeepVisualResult,
  type FeedbackPayload,
  type MessageResponse,
  type VideoContext,
} from "@bp/shared";

const TIMEOUT_MS = 10_000;

async function postJson(url: string, body: unknown, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestDeepVisualAnalysis(
  request: DeepVisualRequest,
  apiUrl: string,
): Promise<MessageResponse<DeepVisualResult>> {
  const payload = {
    frames: request.frames,
    frame_fingerprint: request.frameFingerprint,
    sample_rate_fps: request.sampleRateFps,
    duration_seconds: request.durationSeconds,
    reason: request.reason,
    local_detector: request.localDetector
      ? {
          name: request.localDetector.name.slice(0, 100),
          version: request.localDetector.version.slice(0, 100),
          decision: request.localDetector.decision,
          score: request.localDetector.score,
        }
      : undefined,
  };
  try {
    const response = await postJson(`${apiUrl}/api/v1/analyze/frames`, payload, 20_000);
    if (!response.ok) return { ok: false, error: `falha na API (status ${response.status})` };
    const raw = (await response.json()) as Record<string, unknown>;
    const parsed = deepVisualResultSchema.safeParse({
      status: raw.status,
      detector: raw.detector,
      detectorVersion: raw.detector_version,
      calibrationVersion: raw.calibration_version,
      spatialScore: raw.spatial_score,
      temporalScore: raw.temporal_score,
      syntheticScore: raw.synthetic_score,
      decision: raw.decision,
      confidence: raw.confidence,
      sampledFrames: raw.sampled_frames,
      warnings: raw.warnings,
    });
    if (!parsed.success) return { ok: false, error: "resposta inválida da API" };
    return {
      ok: true,
      data: parsed.data,
    };
  } catch {
    return { ok: false, error: "falha ao conectar com a API" };
  }
}

/**
 * Análise profunda opcional (opt-in) via contexto textual. Nunca envia frames
 * ou vídeo.
 */
export async function requestDeepAnalysis(
  ctx: VideoContext,
  apiUrl: string,
): Promise<MessageResponse<DeepAnalysisReply>> {
  try {
    const payload = {
      platform: ctx.platform.slice(0, 50),
      page_url: normalizeUrl(ctx.pageUrl).slice(0, 2000),
      title: ctx.title?.slice(0, 500),
      description: ctx.description?.slice(0, 10_000),
      hashtags: ctx.hashtags.slice(0, 50).map((tag) => tag.slice(0, 100)),
      author_name: ctx.authorName?.slice(0, 200),
    };
    const response = await postJson(`${apiUrl}/api/v1/analyze/context`, payload);
    if (!response.ok) {
      return { ok: false, error: `falha na API (status ${response.status})` };
    }
    const data = (await response.json()) as DeepAnalysisReply;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "falha ao conectar com a API" };
  }
}

/** Feedback é ação explícita do usuário — permitido mesmo com deepAnalysisEnabled desligado. */
export async function submitFeedback(feedback: FeedbackPayload, apiUrl: string): Promise<MessageResponse<void>> {
  const payload = {
    classification: feedback.classification,
    score: feedback.score,
    assessment_version: feedback.assessmentVersion,
    ruleset_version: feedback.rulesetVersion,
    expected: feedback.expected,
    comment: feedback.comment?.slice(0, 1000),
  };

  try {
    const response = await postJson(`${apiUrl}/api/v1/feedback`, payload);
    if (!response.ok) {
      return { ok: false, error: `falha na API (status ${response.status})` };
    }
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "falha ao conectar com a API" };
  }
}
