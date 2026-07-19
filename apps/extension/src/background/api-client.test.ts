import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackPayload, VideoContext } from "@bp/shared";
import { requestDeepAnalysis, submitFeedback } from "./api-client";

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
      async () =>
        new Response(JSON.stringify({ status: "unavailable", detail: "x" }), { status: 200 }),
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
