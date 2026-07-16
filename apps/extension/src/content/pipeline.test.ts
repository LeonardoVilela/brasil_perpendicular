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

  it("showBadge: false não cria overlay nem inicia observadores", () => {
    addVideo();
    const overlays = makeFakeOverlays();
    const sendMessage = vi.fn();
    const stop = startPipeline({
      registry: new VideoRegistry(),
      queue: new AnalysisQueue(2),
      overlays,
      settings: { ...DEFAULT_SETTINGS, showBadge: false },
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
