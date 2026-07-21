import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchVideos, watchVisibility } from "./observers";

// Fake IntersectionObserver: happy-dom não implementa uma versão funcional.
// Mínimo necessário para os testes de watchVisibility: captura callback e
// opções no construtor, e expõe emit() para simular entradas.
class FakeIntersectionObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  disconnected = false;
  observedTargets: Element[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
  }

  observe(target: Element): void {
    this.observedTargets.push(target);
  }

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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

describe("watchVideos", () => {
  it("dispara onAdded para vídeo já presente no carregamento", () => {
    document.body.innerHTML = "<video></video>";
    const onAdded = vi.fn();
    const cleanup = watchVideos(document, onAdded);
    expect(onAdded).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("dispara onAdded uma única vez para vídeo inserido depois (debounce 250ms)", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = "";
      const onAdded = vi.fn();
      const cleanup = watchVideos(document, onAdded);
      expect(onAdded).not.toHaveBeenCalled();

      const video = document.createElement("video");
      document.body.appendChild(video);
      await flushMicrotasks();

      expect(onAdded).not.toHaveBeenCalled();
      vi.advanceTimersByTime(250);
      expect(onAdded).toHaveBeenCalledTimes(1);
      expect(onAdded).toHaveBeenCalledWith(video);

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("encontra vídeo dentro de um container inserido (querySelectorAll no nó adicionado)", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = "";
      const onAdded = vi.fn();
      const cleanup = watchVideos(document, onAdded);

      const container = document.createElement("div");
      const video = document.createElement("video");
      container.appendChild(video);
      document.body.appendChild(container);
      await flushMicrotasks();
      vi.advanceTimersByTime(250);

      expect(onAdded).toHaveBeenCalledTimes(1);
      expect(onAdded).toHaveBeenCalledWith(video);

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleanup desconecta o observer: inserção após cleanup não dispara", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = "";
      const onAdded = vi.fn();
      const cleanup = watchVideos(document, onAdded);
      cleanup();

      const video = document.createElement("video");
      document.body.appendChild(video);
      await flushMicrotasks();
      vi.advanceTimersByTime(250);

      expect(onAdded).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("não emite o mesmo vídeo duas vezes pela descoberta (dedupe via WeakSet)", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = "<video></video>";
      const onAdded = vi.fn();
      const cleanup = watchVideos(document, onAdded);
      expect(onAdded).toHaveBeenCalledTimes(1);

      // Mutação irrelevante que não adiciona vídeo novo.
      const span = document.createElement("span");
      document.body.appendChild(span);
      await flushMicrotasks();
      vi.advanceTimersByTime(250);

      expect(onAdded).toHaveBeenCalledTimes(1);
      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reemite onAdded quando o loadstart do vídeo dispara (troca de src)", () => {
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const onAdded = vi.fn();
    const cleanup = watchVideos(document, onAdded);
    expect(onAdded).toHaveBeenCalledTimes(1);

    video.dispatchEvent(new Event("loadstart"));
    expect(onAdded).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("cleanup remove o listener de loadstart (não reemite após cleanup)", () => {
    document.body.innerHTML = "<video></video>";
    const video = document.querySelector("video")!;
    const onAdded = vi.fn();
    const cleanup = watchVideos(document, onAdded);
    expect(onAdded).toHaveBeenCalledTimes(1);

    cleanup();
    video.dispatchEvent(new Event("loadstart"));
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  it("notifica remoção, solta o listener e permite rastrear o elemento reinserido", async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = "<video></video>";
      const video = document.querySelector("video")!;
      const onAdded = vi.fn();
      const onRemoved = vi.fn();
      const cleanup = watchVideos(document, onAdded, onRemoved);

      video.remove();
      await flushMicrotasks();
      expect(onRemoved).toHaveBeenCalledWith(video);

      video.dispatchEvent(new Event("loadstart"));
      expect(onAdded).toHaveBeenCalledTimes(1);

      document.body.appendChild(video);
      await flushMicrotasks();
      vi.advanceTimersByTime(250);
      expect(onAdded).toHaveBeenCalledTimes(2);

      cleanup();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("watchVisibility", () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    originalIO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = originalIO;
  });

  function makeTrackingFake() {
    const instances: FakeIntersectionObserver[] = [];
    class TrackedFake extends FakeIntersectionObserver {
      constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
        super(cb, opts);
        instances.push(this);
      }
    }
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = TrackedFake;
    return instances;
  }

  it("usa threshold [0.5] ao observar", () => {
    const instances = makeTrackingFake();
    const video = document.createElement("video");
    const cleanup = watchVisibility(video, 1000, vi.fn());

    expect(instances).toHaveLength(1);
    expect(instances[0]?.options?.threshold).toEqual([0.5]);
    expect(instances[0]?.observedTargets).toContain(video);

    cleanup();
  });

  it("entrada com intersectionRatio >= 0.5 inicia o timer e chama onDwell após minVisibleMs", () => {
    const instances = makeTrackingFake();
    const video = document.createElement("video");
    const onDwell = vi.fn();
    const cleanup = watchVisibility(video, 1000, onDwell);
    const fake = instances[0]!;

    fake.emit({ target: video, isIntersecting: true, intersectionRatio: 0.6 });
    expect(onDwell).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(onDwell).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDwell).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("saída antes do prazo cancela o timer (onDwell nunca chamado)", () => {
    const instances = makeTrackingFake();
    const video = document.createElement("video");
    const onDwell = vi.fn();
    const cleanup = watchVisibility(video, 1000, onDwell);
    const fake = instances[0]!;

    fake.emit({ target: video, isIntersecting: true, intersectionRatio: 0.6 });
    vi.advanceTimersByTime(500);
    fake.emit({ target: video, isIntersecting: false, intersectionRatio: 0 });
    vi.advanceTimersByTime(1000);

    expect(onDwell).not.toHaveBeenCalled();
    cleanup();
  });

  it("onDwell dispara no máximo uma vez e desconecta o observer após disparar", () => {
    const instances = makeTrackingFake();
    const video = document.createElement("video");
    const onDwell = vi.fn();
    const cleanup = watchVisibility(video, 1000, onDwell);
    const fake = instances[0]!;

    fake.emit({ target: video, isIntersecting: true, intersectionRatio: 0.6 });
    vi.advanceTimersByTime(1000);
    expect(onDwell).toHaveBeenCalledTimes(1);
    expect(fake.disconnected).toBe(true);

    cleanup();
  });

  it("cleanup cancela o timer pendente e desconecta o observer", () => {
    const instances = makeTrackingFake();
    const video = document.createElement("video");
    const onDwell = vi.fn();
    const cleanup = watchVisibility(video, 1000, onDwell);
    const fake = instances[0]!;

    fake.emit({ target: video, isIntersecting: true, intersectionRatio: 0.6 });
    cleanup();
    vi.advanceTimersByTime(1000);

    expect(onDwell).not.toHaveBeenCalled();
    expect(fake.disconnected).toBe(true);
  });
});
