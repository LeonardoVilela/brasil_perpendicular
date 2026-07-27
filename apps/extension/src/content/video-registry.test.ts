import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@bp/shared";
import { VideoRegistry } from "./video-registry";

function makeVideo(src: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = src;
  return video;
}

describe("VideoRegistry", () => {
  it("track é idempotente por elemento", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    const first = registry.track(video, "generic");
    const second = registry.track(video, "generic");
    expect(second).toBe(first);
  });

  it("get retorna o TrackedVideo depois de track", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    const tracked = registry.track(video, "generic");
    expect(registry.get(video)).toBe(tracked);
  });

  it("get retorna undefined para vídeo nunca rastreado", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    expect(registry.get(video)).toBeUndefined();
  });

  it("state inicial é waiting", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    const tracked = registry.track(video, "generic");
    expect(tracked.state).toBe("waiting");
  });

  it("cacheKey usa normalizeUrl(location.href) e a plataforma", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    const tracked = registry.track(video, "youtube");
    const expectedPrefix = `youtube|${normalizeUrl(location.href)}|`;
    expect(tracked.cacheKey.startsWith(expectedPrefix)).toBe(true);
  });

  it("cacheKey nunca contém blob: mesmo quando o src do vídeo é blob:", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("blob:https://example.com/11111111-2222-3333-4444-555555555555");
    const tracked = registry.track(video, "generic");
    expect(tracked.cacheKey).not.toContain("blob:");
  });

  it("contextos diferentes produzem cacheKeys diferentes para o mesmo src na mesma página", () => {
    const registry = new VideoRegistry();
    const first = makeVideo("https://cdn.example.com/shared.mp4");
    const second = makeVideo("https://cdn.example.com/shared.mp4");
    const baseContext = {
      platform: "generic",
      pageUrl: normalizeUrl(location.href),
      hashtags: [],
      ariaLabels: [],
      captions: [],
    };

    const firstTracked = registry.refreshIdentity(first, "generic", {
      ...baseContext,
      description: "Contexto neutro",
    });
    const secondTracked = registry.refreshIdentity(second, "generic", {
      ...baseContext,
      description: "Este vídeo foi gerado por IA",
    });

    expect(firstTracked.cacheKey).not.toBe(secondTracked.cacheKey);
  });

  it("inclui declarações confiáveis na identidade do contexto", () => {
    const registry = new VideoRegistry();
    const first = makeVideo("https://cdn.example.com/shared.mp4");
    const second = makeVideo("https://cdn.example.com/shared.mp4");
    const baseContext = {
      platform: "youtube",
      pageUrl: normalizeUrl(location.href),
      hashtags: [],
      ariaLabels: [],
      captions: [],
    };

    const neutral = registry.refreshIdentity(first, "youtube", baseContext);
    const disclosed = registry.refreshIdentity(second, "youtube", {
      ...baseContext,
      platformLabels: ["Conteúdo alterado ou sintético"],
    });

    expect(neutral.cacheKey).not.toBe(disclosed.cacheKey);
  });

  it("invalidate remove o rastreamento", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    registry.track(video, "generic");
    registry.invalidate(video);
    expect(registry.get(video)).toBeUndefined();
  });

  it("invalidate cancela a análise visual em andamento", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    const signal = registry.beginVisualAnalysis(video, "generic");

    registry.invalidate(video);

    expect(signal.aborted).toBe(true);
  });

  it("uma nova análise cancela a anterior no mesmo elemento", () => {
    const registry = new VideoRegistry();
    const video = makeVideo("https://cdn.example.com/a.mp4");
    const first = registry.beginVisualAnalysis(video, "generic");
    const second = registry.beginVisualAnalysis(video, "generic");

    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });
});
