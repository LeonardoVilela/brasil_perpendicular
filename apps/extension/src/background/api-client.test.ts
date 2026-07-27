import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeepVisualRequest, FeedbackPayload, VideoContext } from "@bp/shared";
import { requestDeepAnalysis, requestDeepVisualAnalysis, submitFeedback } from "./api-client";

const API_URL = "http://localhost:8000";

const context: VideoContext = {
  platform: "youtube",
  pageUrl: "https://youtube.com/watch?v=abc",
  title: "título do vídeo",
  description: "descrição do vídeo",
  hashtags: ["#ia", "#deepfake"],
  ariaLabels: [],
  captions: [],
  authorName: "autor",
};

const feedback: FeedbackPayload = {
  classification: "likely_ai",
  score: 0.8,
  assessmentVersion: "1.0.0",
  rulesetVersion: "1.0.0",
  expected: "false_positive",
  comment: "achei que não era IA",
};

const feedbackWithoutComment: FeedbackPayload = {
  classification: "likely_ai",
  score: 0.8,
  assessmentVersion: "1.0.0",
  rulesetVersion: "1.0.0",
  expected: "false_positive",
};

const visualRequest: DeepVisualRequest = {
  frames: Array(4).fill("data:image/jpeg;base64,QQ=="),
  frameFingerprint: "a".repeat(64),
  sampleRateFps: 8,
  durationSeconds: 2,
  reason: "political_context",
  localDetector: {
    name: "d3-mobilenetv3",
    version: "2026.07",
    decision: "uncertain",
    score: 0.5,
  },
};

// Tipa o mock de fetch com a assinatura real, sem exigir nomear parâmetros
// não usados em cada teste (mock.calls[N] fica tipado como a tupla real).
type FetchArgs = [url: string, init?: RequestInit];

function mockFetch(impl: (...args: FetchArgs) => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("requestDeepAnalysis", () => {
  it("faz POST em /api/v1/analyze/context com payload snake_case sem campos extras", async () => {
    const fetchMock = mockFetch(
      async () =>
        new Response(JSON.stringify({ status: "unavailable", detail: "sem análise" }), {
          status: 200,
        }),
    );

    const result = await requestDeepAnalysis(context, API_URL);

    expect(result).toEqual({ ok: true, data: { status: "unavailable", detail: "sem análise" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/api/v1/analyze/context`);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      platform: "youtube",
      page_url: "https://youtube.com/watch?v=abc",
      title: "título do vídeo",
      description: "descrição do vídeo",
      hashtags: ["#ia", "#deepfake"],
      author_name: "autor",
    });
  });

  it("omite title/description/author_name quando ausentes no contexto", async () => {
    const fetchMock = mockFetch(
      async () => new Response(JSON.stringify({ status: "unavailable", detail: "x" }), { status: 200 }),
    );

    const minimalContext: VideoContext = {
      platform: "generic",
      pageUrl: "https://example.com/page",
      hashtags: [],
      ariaLabels: [],
      captions: [],
    };
    await requestDeepAnalysis(minimalContext, API_URL);

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      platform: "generic",
      page_url: "https://example.com/page",
      hashtags: [],
    });
    expect(body).not.toHaveProperty("title");
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("author_name");
  });

  it("normaliza e trunca o contexto nos limites aceitos pela API", async () => {
    const fetchMock = mockFetch(
      async () => new Response(JSON.stringify({ status: "unavailable", detail: "x" }), { status: 200 }),
    );
    await requestDeepAnalysis(
      {
        ...context,
        platform: "p".repeat(60),
        pageUrl: "https://example.com/video?utm_source=tracker",
        title: "t".repeat(600),
        description: "d".repeat(11_000),
        hashtags: Array.from({ length: 60 }, () => "#" + "h".repeat(120)),
        authorName: "a".repeat(250),
      },
      API_URL,
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init?.body as string);
    expect(body.platform).toHaveLength(50);
    expect(body.page_url).toBe("https://example.com/video");
    expect(body.title).toHaveLength(500);
    expect(body.description).toHaveLength(10_000);
    expect(body.hashtags).toHaveLength(50);
    expect(body.hashtags[0]).toHaveLength(100);
    expect(body.author_name).toHaveLength(200);
  });

  it("timeout de 10s vira { ok: false } sem lançar", async () => {
    mockFetch(
      (...args) =>
        new Promise<Response>((_resolve, reject) => {
          const [, init] = args;
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    const promise = requestDeepAnalysis(context, API_URL);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain(context.title);
      expect(result.error).not.toContain(context.pageUrl);
    }
  });

  it("resposta não-2xx vira { ok: false }", async () => {
    mockFetch(async () => new Response(JSON.stringify({ detail: "erro" }), { status: 500 }));

    const result = await requestDeepAnalysis(context, API_URL);
    expect(result.ok).toBe(false);
  });

  it("erro de rede vira { ok: false } em vez de lançar", async () => {
    mockFetch(async () => {
      throw new TypeError("failed to fetch");
    });

    const result = await requestDeepAnalysis(context, API_URL);
    expect(result.ok).toBe(false);
  });
});

describe("submitFeedback", () => {
  it("faz POST em /api/v1/feedback com payload snake_case", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));

    const result = await submitFeedback(feedback, API_URL);

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/api/v1/feedback`);
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      classification: "likely_ai",
      score: 0.8,
      assessment_version: "1.0.0",
      ruleset_version: "1.0.0",
      expected: "false_positive",
      comment: "achei que não era IA",
    });
  });

  it("omite comment quando ausente", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));

    await submitFeedback(feedbackWithoutComment, API_URL);

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init?.body as string);
    expect(body).not.toHaveProperty("comment");
  });
});

describe("requestDeepVisualAnalysis", () => {
  it("envia somente frames, fingerprint e metadados técnicos mínimos", async () => {
    const fetchMock = mockFetch(
      async () =>
        new Response(
          JSON.stringify({
            status: "analyzed",
            detector: "stall-dinov3-vitl16",
            detector_version: "stall-test",
            calibration_version: "vatex-test",
            spatial_score: 0.9,
            temporal_score: 0.8,
            synthetic_score: 0.85,
            decision: "uncertain",
            confidence: 0.85,
            sampled_frames: 4,
            warnings: [],
          }),
          { status: 200 },
        ),
    );

    const result = await requestDeepVisualAnalysis(visualRequest, API_URL);

    expect(result).toMatchObject({
      ok: true,
      data: { detectorVersion: "stall-test", syntheticScore: 0.85, sampledFrames: 4 },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/api/v1/analyze/frames`);
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      frames: visualRequest.frames,
      frame_fingerprint: visualRequest.frameFingerprint,
      sample_rate_fps: 8,
      duration_seconds: 2,
      reason: "political_context",
      local_detector: {
        name: "d3-mobilenetv3",
        version: "2026.07",
        decision: "uncertain",
        score: 0.5,
      },
    });
    expect(body).not.toHaveProperty("context");
    expect(body).not.toHaveProperty("page_url");
    expect(body).not.toHaveProperty("author_name");
  });

  it("rejeita score fora do contrato em vez de confiar na API configurável", async () => {
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({
            status: "analyzed",
            detector: "stall-dinov3-vitl16",
            detector_version: "stall-test",
            calibration_version: "vatex-test",
            synthetic_score: 7,
            decision: "ai_like",
            confidence: 1,
            sampled_frames: 4,
            warnings: [],
          }),
          { status: 200 },
        ),
    );

    await expect(requestDeepVisualAnalysis(visualRequest, API_URL)).resolves.toEqual({
      ok: false,
      error: "resposta inválida da API",
    });
  });
});
