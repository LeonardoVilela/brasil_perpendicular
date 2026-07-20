import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type DetectionAssessment, type MessageResponse, type RequestMessage } from "@bp/shared";
import type { OverlayLike } from "./overlay-manager";
import { AnalysisQueue } from "./analysis-queue";
import { VideoRegistry } from "./video-registry";
import { startPipeline } from "./pipeline";

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
});
