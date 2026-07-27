import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type DetectionAssessment, type MessageResponse, type RequestMessage } from "@bp/shared";
import type { OverlayLike } from "./overlay-manager";
import { AnalysisQueue } from "./analysis-queue";
import { VideoRegistry } from "./video-registry";
import { startPipeline } from "./pipeline";
import type { VisualDetector } from "../detectors/types";
import type { FrameSampleResult } from "./frame-sampler";

// Fake IntersectionObserver: happy-dom não implementa uma versão funcional
// (mesmo dublê usado em observers.test.ts).
class FakeIntersectionObserver {
  callback: IntersectionObserverCallback;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  emit(partial: Partial<IntersectionObserverEntry>): void {
    this.callback([partial as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function makeFakeOverlays(): OverlayLike & { calls: { method: string; args: unknown[] }[] } {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    show(...args) {
      calls.push({ method: "show", args });
    },
    setState(...args) {
      calls.push({ method: "setState", args });
    },
    remove(...args) {
      calls.push({ method: "remove", args });
    },
  };
}

function okResponse<T>(data: T): MessageResponse<T> {
  return { ok: true, data };
}

function missResponse(): MessageResponse<unknown> {
  return { ok: false, error: "cache miss" };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("startPipeline", () => {
  let ioInstances: FakeIntersectionObserver[];

  beforeEach(() => {
    document.body.innerHTML = "";
    document.title = "";
    ioInstances = [];
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = class extends FakeIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        super(cb);
        ioInstances.push(this);
      }
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  function addVideo(): HTMLVideoElement {
    const video = document.createElement("video");
    document.body.appendChild(video);
    return video;
  }

  async function triggerDwell(minVisibleMs: number): Promise<void> {
    const fake = ioInstances[ioInstances.length - 1]!;
    fake.emit({ isIntersecting: true, intersectionRatio: 1 });
    vi.advanceTimersByTime(minVisibleMs);
    await flushMicrotasks();
  }

  function visualDeps(localDecision: "ai_like" | "real_like" | "uncertain" = "uncertain") {
    const sample: FrameSampleResult = {
      status: "ok",
      frames: Array(16).fill("data:image/jpeg;base64,QQ=="),
      fingerprintSamples: Array.from({ length: 16 }, () => new Uint8Array(72)),
      mediaTimes: Array.from({ length: 16 }, (_, index) => index / 8),
    };
    const visualDetector: VisualDetector = {
      name: "d3-mobilenetv3",
      version: "test",
      isMock: false,
      initialize: async () => {},
      analyzeFrames: async (_frames, frameFingerprint) => ({
        detector: "d3-mobilenetv3",
        detectorVersion: "test",
        modelSha256: "a".repeat(64),
        backend: "wasm",
        rawTemporalStd: 1,
        syntheticScore: localDecision === "uncertain" ? null : localDecision === "ai_like" ? 0.96 : 0.05,
        decision: localDecision,
        confidence: 0.96,
        sampledFrames: 16,
        usableFrames: 16,
        frameFingerprint,
        warnings: [],
      }),
    };
    return {
      visualDetector,
      sampleFrames: vi.fn(async () => sample),
      fingerprintFrames: vi.fn(async () => "f".repeat(64)),
    };
  }

  it("showBadge: false esconde o overlay sem desativar a análise local", async () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      void message;
      return missResponse();
    });
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, showBadge: false, minVisibleMs: 100 },
      sendMessage,
    });

    expect(overlays.calls).toHaveLength(0);
    expect(ioInstances).toHaveLength(1);
    await triggerDwell(100);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: "CACHE_GET" }));
    stop();
  });

  it("não inicia o pipeline quando a plataforma selecionada está desabilitada", () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn();
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays,
      settings: {
        ...DEFAULT_SETTINGS,
        enabledPlatforms: { ...DEFAULT_SETTINGS.enabledPlatforms, generic: false },
      },
      sendMessage,
    });

    expect(overlays.calls).toHaveLength(0);
    expect(ioInstances).toHaveLength(0);
    stop();
  });

  it("dwell aciona analyzing e depois o estado final, com CACHE_PUT (cache miss)", async () => {
    const video = addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") return missResponse();
      return okResponse(undefined);
    });

    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 1000, autoAnalyzeEnabled: true },
      sendMessage,
    });

    expect(overlays.calls[0]).toMatchObject({ method: "show" });

    await triggerDwell(1000);

    const setStateCalls = overlays.calls.filter((c) => c.method === "setState");
    expect(setStateCalls[0]?.args[1]).toBe("analyzing");

    const finalCall = setStateCalls[setStateCalls.length - 1]!;
    expect(finalCall.args[1]).not.toBe("analyzing");
    const assessment = finalCall.args[2] as DetectionAssessment;
    expect(assessment).toBeDefined();
    expect(assessment.assessmentVersion).toBeTruthy();

    const cachePut = sendMessage.mock.calls.find(([m]) => m.kind === "CACHE_PUT");
    expect(cachePut).toBeDefined();

    stop();
    void video;
  });

  it("cache hit pula assess() e aplica o resultado cacheado direto", async () => {
    const cached: DetectionAssessment = {
      classification: "likely_ai",
      score: 0.8,
      confidence: "high",
      scamRisk: "none",
      evidence: [],
      executedAnalyses: ["context_rules"],
      unavailableAnalyses: ["visual_model"],
      limitations: [],
      analyzedAt: new Date().toISOString(),
      assessmentVersion: "0.1.0",
      rulesetVersion: "0.1.0",
      detectorVersions: {},
    };

    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") return okResponse(cached);
      return okResponse(undefined);
    });

    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 500, autoAnalyzeEnabled: true },
      sendMessage,
    });

    await triggerDwell(500);

    const setStateCalls = overlays.calls.filter((c) => c.method === "setState");
    const finalCall = setStateCalls[setStateCalls.length - 1]!;
    expect(finalCall.args[1]).toBe("likely_ai");
    expect(finalCall.args[2]).toEqual(cached);

    const cachePut = sendMessage.mock.calls.find(([m]) => m.kind === "CACHE_PUT");
    expect(cachePut).toBeUndefined();

    stop();
  });

  it("erro durante a análise vira estado error (nunca fica preso em analyzing)", async () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (): Promise<MessageResponse<unknown>> => {
      throw new Error("falha simulada");
    });

    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 200, autoAnalyzeEnabled: true },
      sendMessage,
    });

    await triggerDwell(200);

    const setStateCalls = overlays.calls.filter((c) => c.method === "setState");
    const finalCall = setStateCalls[setStateCalls.length - 1]!;
    expect(finalCall.args[1]).toBe("error");

    stop();
  });

  it("vídeo removido do DOM antes/durante a análise: remove overlay e invalida o registro", async () => {
    const video = addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (): Promise<MessageResponse<unknown>> => missResponse());
    const registry = new VideoRegistry();

    const stop = startPipeline({
      registry,
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 300, autoAnalyzeEnabled: true },
      sendMessage,
    });

    video.remove();
    await triggerDwell(300);

    const removeCalls = overlays.calls.filter((c) => c.method === "remove");
    expect(removeCalls.length).toBeGreaterThan(0);
    expect(registry.get(video)).toBeUndefined();

    stop();
  });

  it("vídeo removido antes do dwell é limpo imediatamente", async () => {
    const video = addVideo();
    const overlays = makeFakeOverlays();
    const registry = new VideoRegistry();
    const stop = startPipeline({
      registry,
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 300 },
      sendMessage: vi.fn(),
    });

    video.remove();
    await flushMicrotasks();

    expect(overlays.calls.some((call) => call.method === "remove")).toBe(true);
    expect(registry.get(video)).toBeUndefined();
    expect(ioInstances[0]?.disconnected).toBe(true);
    stop();
  });

  it("vídeos com o mesmo src e contextos diferentes consultam chaves de cache diferentes", async () => {
    document.body.innerHTML = `
      <figure><video src="https://cdn.example.com/shared.mp4"></video><figcaption>Contexto neutro</figcaption></figure>
      <figure><video src="https://cdn.example.com/shared.mp4"></video><figcaption>Gerado por IA</figcaption></figure>
    `;
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      void message;
      return missResponse();
    });
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays: makeFakeOverlays(),
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 100 },
      sendMessage,
    });

    for (const observer of ioInstances) {
      observer.emit({ isIntersecting: true, intersectionRatio: 1 });
    }
    vi.advanceTimersByTime(100);
    await flushMicrotasks();

    const keys = sendMessage.mock.calls
      .map(([message]) => message)
      .filter((message): message is Extract<RequestMessage, { kind: "CACHE_GET" }> => message.kind === "CACHE_GET")
      .map((message) => message.key);
    expect(new Set(keys).size).toBe(2);
    stop();
  });

  it("troca de src (loadstart) limpa o watcher antigo, recalcula o cacheKey e volta para waiting", async () => {
    const video = addVideo();
    video.src = "https://cdn.example.com/a.mp4";
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (): Promise<MessageResponse<unknown>> => missResponse());
    const registry = new VideoRegistry();

    const stop = startPipeline({
      registry,
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 300, autoAnalyzeEnabled: true },
      sendMessage,
    });

    const firstKey = registry.get(video)!.cacheKey;
    expect(ioInstances).toHaveLength(1);

    video.src = "https://cdn.example.com/b.mp4";
    video.dispatchEvent(new Event("loadstart"));

    // Watcher antigo desconectado (sem dwell duplicado empilhado) e um novo criado.
    expect(ioInstances).toHaveLength(2);
    expect(ioInstances[0]!.disconnected).toBe(true);

    // cacheKey recalculada para o novo src.
    const secondKey = registry.get(video)!.cacheKey;
    expect(secondKey).not.toBe(firstKey);

    // O host antigo é desmontado e recriado no estado inicial waiting, sem
    // preservar callbacks ligados à identidade anterior.
    expect(overlays.calls.filter((c) => c.method === "remove")).toHaveLength(1);
    expect(overlays.calls.filter((c) => c.method === "show")).toHaveLength(2);
    expect(registry.get(video)?.state).toBe("waiting");

    // Só o watcher novo dispara dwell: uma única análise.
    await triggerDwell(300);
    const analyzingCalls = overlays.calls.filter((c) => c.method === "setState" && c.args[1] === "analyzing");
    expect(analyzingCalls).toHaveLength(1);

    stop();
  });

  it("resultado em voo da identidade anterior não sobrescreve o vídeo substituído", async () => {
    const video = addVideo();
    video.src = "https://cdn.example.com/a.mp4";
    let resolveCache!: (response: MessageResponse<unknown>) => void;
    const sendMessage = vi.fn((message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") {
        return new Promise((resolve) => {
          resolveCache = resolve;
        });
      }
      return Promise.resolve(okResponse(undefined));
    });
    const overlays = makeFakeOverlays();
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 100 },
      sendMessage,
    });

    await triggerDwell(100);
    video.src = "https://cdn.example.com/b.mp4";
    video.dispatchEvent(new Event("loadstart"));
    resolveCache(
      okResponse({
        classification: "likely_ai",
        score: 0.9,
        confidence: "high",
        scamRisk: "none",
        evidence: [],
        executedAnalyses: ["context_rules"],
        unavailableAnalyses: ["visual_model"],
        limitations: [],
        analyzedAt: new Date().toISOString(),
        assessmentVersion: "0.1.0",
        rulesetVersion: "0.1.0",
        detectorVersions: {},
      } satisfies DetectionAssessment),
    );
    await flushMicrotasks();

    expect(overlays.calls.some((call) => call.method === "setState" && call.args[1] === "likely_ai")).toBe(false);
    expect(overlays.calls.filter((call) => call.method === "show")).toHaveLength(2);
    stop();
  });

  it("cleanup retornado para o watcher de vídeos e remove overlays restantes", async () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (): Promise<MessageResponse<unknown>> => missResponse());
    const registry = new VideoRegistry();

    const stop = startPipeline({
      registry,
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 300, autoAnalyzeEnabled: false },
      sendMessage,
    });

    stop();

    expect(ioInstances[0]?.disconnected).toBe(true);
    const removeCalls = overlays.calls.filter((c) => c.method === "remove");
    expect(removeCalls.length).toBeGreaterThan(0);
  });

  it("contexto eleitoral com opt-in chama STALL e pode produzir likely_ai", async () => {
    document.title = "Lula nas eleições 2026";
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") return missResponse();
      if (message.kind === "DEEP_VISUAL_ANALYZE_REQUEST") {
        return okResponse({
          status: "analyzed",
          detector: "stall-dinov3-vitl16",
          detectorVersion: "stall-test",
          calibrationVersion: "vatex-test",
          spatialScore: 0.97,
          temporalScore: 0.99,
          syntheticScore: 0.98,
          decision: "ai_like",
          confidence: 0.98,
          sampledFrames: 16,
          warnings: [],
        });
      }
      return okResponse(undefined);
    });
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(1),
      overlays,
      settings: {
        ...DEFAULT_SETTINGS,
        minVisibleMs: 100,
        automaticDeepVisualAnalysisEnabled: true,
      },
      sendMessage,
      ...visualDeps("real_like"),
    });

    await triggerDwell(100);

    expect(sendMessage.mock.calls.some(([message]) => message.kind === "DEEP_VISUAL_ANALYZE_REQUEST")).toBe(true);
    const assessment = overlays.calls.filter((call) => call.method === "setState").at(-1)
      ?.args[2] as DetectionAssessment;
    expect(assessment.classification).toBe("likely_ai");
    expect(assessment.evidence).toHaveLength(1);
    expect(assessment.evidence[0]?.source).toBe("stall-dinov3-vitl16");
    expect(assessment.limitations).toContain(
      "Contexto eleitoral detectado; análise aprofundada priorizada.",
    );
    stop();
  });

  it("contexto eleitoral incerto analisa um segundo trecho e funde no máximo 32 frames", async () => {
    document.title = "Eleições 2026 para presidente";
    addVideo();
    const overlays = makeFakeOverlays();
    const sentFrameCounts: number[] = [];
    let deepCalls = 0;
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") return missResponse();
      if (message.kind === "DEEP_VISUAL_ANALYZE_REQUEST") {
        sentFrameCounts.push(message.payload.frames.length);
        deepCalls += 1;
        const syntheticScore = deepCalls === 1 ? 0.94 : 0.98;
        return okResponse({
          status: "analyzed",
          detector: "stall-dinov3-vitl16",
          detectorVersion: "stall-test",
          calibrationVersion: "vatex-test",
          spatialScore: syntheticScore,
          temporalScore: syntheticScore,
          syntheticScore,
          decision: deepCalls === 1 ? "uncertain" : "ai_like",
          confidence: 0.98,
          sampledFrames: 16,
          warnings: [],
        });
      }
      return okResponse(undefined);
    });
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(1),
      overlays,
      settings: {
        ...DEFAULT_SETTINGS,
        minVisibleMs: 100,
        automaticDeepVisualAnalysisEnabled: true,
      },
      sendMessage,
      ...visualDeps("uncertain"),
    });

    await triggerDwell(100);
    await flushMicrotasks();
    await flushMicrotasks();

    expect(deepCalls).toBe(2);
    expect(sentFrameCounts).toEqual([16, 16]);
    const assessment = overlays.calls.filter((call) => call.method === "setState").at(-1)
      ?.args[2] as DetectionAssessment;
    expect(assessment.classification).toBe("likely_ai");
    expect(
      assessment.analysisDetails?.find((detail) => detail.analysis === "stall_visual")
        ?.sampledFrames,
    ).toBe(32);
    stop();
  });

  it("STALL substitui o D3 no grupo visual em vez de somar os dois", async () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") return missResponse();
      if (message.kind === "DEEP_VISUAL_ANALYZE_REQUEST") {
        return okResponse({
          status: "analyzed",
          detector: "stall-dinov3-vitl16",
          detectorVersion: "stall-test",
          calibrationVersion: "vatex-test",
          spatialScore: 0.05,
          temporalScore: 0.05,
          syntheticScore: 0.05,
          decision: "real_like",
          confidence: 0.95,
          sampledFrames: 16,
          warnings: [],
        });
      }
      return okResponse(undefined);
    });
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(1),
      overlays,
      settings: {
        ...DEFAULT_SETTINGS,
        minVisibleMs: 100,
        automaticDeepVisualAnalysisEnabled: true,
      },
      sendMessage,
      ...visualDeps("ai_like"),
    });

    await triggerDwell(100);

    const assessment = overlays.calls.filter((call) => call.method === "setState").at(-1)
      ?.args[2] as DetectionAssessment;
    expect(assessment.classification).toBe("insufficient_evidence");
    expect(assessment.evidence.some((item) => item.source === "d3-mobilenetv3")).toBe(false);
    stop();
  });

  it("STALL incerto abaixo do limiar estrito não produz likely_ai sozinho", async () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") return missResponse();
      if (message.kind === "DEEP_VISUAL_ANALYZE_REQUEST") {
        return okResponse({
          status: "analyzed",
          detector: "stall-dinov3-vitl16",
          detectorVersion: "stall-test",
          calibrationVersion: "vatex-test",
          spatialScore: 0.949,
          temporalScore: 0.949,
          syntheticScore: 0.949,
          decision: "uncertain",
          confidence: 0.949,
          sampledFrames: 16,
          warnings: [],
        });
      }
      return okResponse(undefined);
    });
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(1),
      overlays,
      settings: {
        ...DEFAULT_SETTINGS,
        minVisibleMs: 100,
        automaticDeepVisualAnalysisEnabled: true,
      },
      sendMessage,
      ...visualDeps("uncertain"),
    });

    await triggerDwell(100);

    const assessment = overlays.calls.filter((call) => call.method === "setState").at(-1)
      ?.args[2] as DetectionAssessment;
    expect(assessment.classification).toBe("possibly_ai");
    stop();
  });

  it("opt-in visual desligado produz zero requisições de frames ao servidor", async () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> =>
      message.kind === "CACHE_GET" ? missResponse() : okResponse(undefined),
    );
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(1),
      overlays,
      settings: { ...DEFAULT_SETTINGS, minVisibleMs: 100 },
      sendMessage,
      ...visualDeps("uncertain"),
    });

    await triggerDwell(100);

    expect(sendMessage.mock.calls.some(([message]) => message.kind === "DEEP_VISUAL_ANALYZE_REQUEST")).toBe(false);
    const assessment = overlays.calls.filter((call) => call.method === "setState").at(-1)
      ?.args[2] as DetectionAssessment;
    expect(assessment.limitations).toContain(
      "O envio automático de frames para análise aprofundada não foi autorizado.",
    );
    stop();
  });

  it("clique manual solicita STALL mesmo com envio automático desligado", async () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const registry = new VideoRegistry();
    const sendMessage = vi.fn(async (message: RequestMessage): Promise<MessageResponse<unknown>> => {
      if (message.kind === "CACHE_GET") return missResponse();
      if (message.kind === "DEEP_VISUAL_ANALYZE_REQUEST") {
        return okResponse({
          status: "unavailable",
          detector: "stall-dinov3-vitl16",
          detectorVersion: "stall-test",
          calibrationVersion: "vatex-test",
          sampledFrames: 16,
          warnings: ["stall_not_configured"],
        });
      }
      return okResponse(undefined);
    });
    const stop = startPipeline({
      registry,
      queue: new AnalysisQueue(1),
      overlays,
      settings: { ...DEFAULT_SETTINGS, autoAnalyzeEnabled: false },
      sendMessage,
      ...visualDeps("real_like"),
    });
    const tracked = overlays.calls.find((call) => call.method === "show")
      ?.args[0] as import("./video-registry").TrackedVideo;

    tracked.requestDeepVisualAnalysis?.();
    await flushMicrotasks();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "DEEP_VISUAL_ANALYZE_REQUEST",
        payload: expect.objectContaining({ reason: "manual_request" }),
      }),
    );
    stop();
  });
});
