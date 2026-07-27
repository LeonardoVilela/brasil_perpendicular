import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASSESSMENT_VERSION, RULESET_VERSION } from "@bp/detection-core";
import { DEFAULT_SETTINGS, type DetectionAssessment, type MessageResponse } from "@bp/shared";
import { installChromeMock, uninstallChromeMock, type ChromeMock } from "../test-helpers/chrome-mock";

let chromeMock: ChromeMock;

function makeAssessment(): DetectionAssessment {
  return {
    classification: "possibly_ai",
    score: 0.5,
    confidence: "medium",
    scamRisk: "none",
    evidence: [],
    executedAnalyses: [],
    unavailableAnalyses: [],
    limitations: [],
    analyzedAt: "2026-01-01T00:00:00.000Z",
    assessmentVersion: ASSESSMENT_VERSION,
    rulesetVersion: RULESET_VERSION,
    detectorVersions: {},
  };
}

beforeEach(async () => {
  vi.resetModules();
  chromeMock = installChromeMock();
  await import("./service-worker");
});

afterEach(() => {
  uninstallChromeMock();
  vi.unstubAllGlobals();
});

describe("service-worker: validação e origem", () => {
  it("responde { ok: false, error: 'invalid_message' } para mensagem malformada", async () => {
    const response = (await chromeMock.dispatchMessage({ kind: "NOT_A_REAL_KIND" })) as MessageResponse<unknown>;
    expect(response).toEqual({ ok: false, error: "invalid_message" });
  });

  it("responde { ok: false, error: 'forbidden' } quando sender.id difere de chrome.runtime.id", async () => {
    const response = (await chromeMock.dispatchMessage(
      { kind: "SETTINGS_GET" },
      { id: "some-other-extension-id" },
    )) as MessageResponse<unknown>;
    expect(response).toEqual({ ok: false, error: "forbidden" });
  });
});

describe("service-worker: SETTINGS_GET / SETTINGS_SET", () => {
  it("SETTINGS_GET devolve DEFAULT_SETTINGS quando nada foi salvo", async () => {
    const response = (await chromeMock.dispatchMessage({ kind: "SETTINGS_GET" })) as MessageResponse<unknown>;
    expect(response).toEqual({ ok: true, data: DEFAULT_SETTINGS });
  });

  it("SETTINGS_SET grava e um SETTINGS_GET seguinte reflete o valor salvo", async () => {
    const custom = { ...DEFAULT_SETTINGS, devMode: true };
    const setResponse = await chromeMock.dispatchMessage({ kind: "SETTINGS_SET", settings: custom });
    expect((setResponse as MessageResponse<unknown>).ok).toBe(true);

    const getResponse = (await chromeMock.dispatchMessage({ kind: "SETTINGS_GET" })) as MessageResponse<unknown>;
    expect(getResponse).toEqual({ ok: true, data: custom });
  });
});

describe("service-worker: CACHE_GET / CACHE_PUT / CACHE_CLEAR", () => {
  it("CACHE_GET sem entrada devolve ok:true com data undefined", async () => {
    const response = (await chromeMock.dispatchMessage({ kind: "CACHE_GET", key: "k1" })) as MessageResponse<unknown>;
    expect(response).toEqual({ ok: true, data: undefined });
  });

  it("CACHE_PUT seguido de CACHE_GET devolve o assessment salvo", async () => {
    const assessment = makeAssessment();
    await chromeMock.dispatchMessage({ kind: "CACHE_PUT", key: "k1", assessment });

    const response = (await chromeMock.dispatchMessage({ kind: "CACHE_GET", key: "k1" })) as MessageResponse<unknown>;
    expect(response).toEqual({ ok: true, data: assessment });
  });

  it("CACHE_CLEAR remove entradas salvas", async () => {
    const assessment = makeAssessment();
    await chromeMock.dispatchMessage({ kind: "CACHE_PUT", key: "k1", assessment });
    await chromeMock.dispatchMessage({ kind: "CACHE_CLEAR" });

    const response = (await chromeMock.dispatchMessage({ kind: "CACHE_GET", key: "k1" })) as MessageResponse<unknown>;
    expect(response).toEqual({ ok: true, data: undefined });
  });
});

describe("service-worker: DEEP_ANALYZE_REQUEST", () => {
  const context = {
    platform: "youtube",
    pageUrl: "https://youtube.com/watch?v=abc",
    hashtags: [],
    ariaLabels: [],
    captions: [],
  };

  it("responde deep_analysis_disabled sem chamar fetch quando settings.deepAnalysisEnabled é false", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = (await chromeMock.dispatchMessage({
      kind: "DEEP_ANALYZE_REQUEST",
      context,
    })) as MessageResponse<unknown>;

    expect(response).toEqual({ ok: false, error: "deep_analysis_disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chama a API quando settings.deepAnalysisEnabled é true", async () => {
    await chromeMock.dispatchMessage({
      kind: "SETTINGS_SET",
      settings: { ...DEFAULT_SETTINGS, deepAnalysisEnabled: true, apiUrl: "http://localhost:8000" },
    });

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "unavailable", detail: "x" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = (await chromeMock.dispatchMessage({
      kind: "DEEP_ANALYZE_REQUEST",
      context,
    })) as MessageResponse<unknown>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ ok: true, data: { status: "unavailable", detail: "x" } });
  });
});

describe("service-worker: DEEP_VISUAL_ANALYZE_REQUEST", () => {
  const payload = {
    frames: Array(4).fill("data:image/jpeg;base64,QQ=="),
    frameFingerprint: "a".repeat(64),
    sampleRateFps: 8 as const,
    durationSeconds: 2 as const,
    reason: "political_context" as const,
  };

  it("não chama fetch sem o novo opt-in específico", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = (await chromeMock.dispatchMessage({
      kind: "DEEP_VISUAL_ANALYZE_REQUEST",
      payload,
    })) as MessageResponse<unknown>;

    expect(response).toEqual({ ok: false, error: "deep_visual_analysis_disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chama a API automaticamente depois do opt-in", async () => {
    await chromeMock.dispatchMessage({
      kind: "SETTINGS_SET",
      settings: { ...DEFAULT_SETTINGS, automaticDeepVisualAnalysisEnabled: true },
    });
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "unavailable",
            detector: "stall-dinov3-vitl16",
            detector_version: "stall-test",
            calibration_version: "vatex-test",
            sampled_frames: 4,
            warnings: ["stall_not_configured"],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = (await chromeMock.dispatchMessage({
      kind: "DEEP_VISUAL_ANALYZE_REQUEST",
      payload,
    })) as MessageResponse<unknown>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({ ok: true, data: { status: "unavailable" } });
  });

  it("permite envio por clique explícito mesmo sem opt-in automático", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "unavailable",
            detector: "stall-dinov3-vitl16",
            detector_version: "stall-test",
            calibration_version: "vatex-test",
            sampled_frames: 4,
            warnings: ["stall_not_configured"],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = (await chromeMock.dispatchMessage({
      kind: "DEEP_VISUAL_ANALYZE_REQUEST",
      payload: { ...payload, reason: "manual_request" },
    })) as MessageResponse<unknown>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({ ok: true, data: { status: "unavailable" } });
  });
});

describe("service-worker: FEEDBACK_SUBMIT", () => {
  it("envia feedback mesmo com deepAnalysisEnabled desligado (ação explícita do usuário)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = (await chromeMock.dispatchMessage({
      kind: "FEEDBACK_SUBMIT",
      feedback: {
        classification: "likely_ai",
        score: 0.7,
        assessmentVersion: ASSESSMENT_VERSION,
        rulesetVersion: RULESET_VERSION,
        expected: "false_positive",
      },
    })) as MessageResponse<unknown>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ ok: true, data: undefined });
  });
});

describe("service-worker: INJECT_CONTENT_SCRIPT", () => {
  it("chama chrome.scripting.executeScript com o tabId e content.js", async () => {
    const response = (await chromeMock.dispatchMessage({
      kind: "INJECT_CONTENT_SCRIPT",
      tabId: 42,
    })) as MessageResponse<unknown>;

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ["content.js"],
    });
    expect(response).toEqual({ ok: true, data: undefined });
  });
});
