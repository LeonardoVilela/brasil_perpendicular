import type { DeepAnalysisReply, FeedbackPayload, MessageResponse, VideoContext } from "@bp/shared";

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
  const payload = {
    platform: ctx.platform,
    page_url: ctx.pageUrl,
    title: ctx.title,
    description: ctx.description,
    hashtags: ctx.hashtags,
    author_name: ctx.authorName,
  };

  try {
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
export async function submitFeedback(
  feedback: FeedbackPayload,
  apiUrl: string,
): Promise<MessageResponse<void>> {
  const payload = {
    classification: feedback.classification,
    score: feedback.score,
    assessment_version: feedback.assessmentVersion,
    ruleset_version: feedback.rulesetVersion,
    expected: feedback.expected,
    comment: feedback.comment,
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
