import {
  normalizeUrl,
  type DeepAnalysisReply,
  type FeedbackPayload,
  type MessageResponse,
  type VideoContext,
} from "@bp/shared";

const TIMEOUT_MS = 10_000;

async function postJson(url: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
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

/**
 * Análise profunda opcional (opt-in) via contexto textual. Nunca envia frames
 * ou vídeo — só o contrato de docs/detection-pipeline.md §8.
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
