import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectionAssessment } from "@bp/shared";
import { STATE_STRINGS } from "@bp/ui";
import { OverlayManager } from "./overlay-manager";
import type { TrackedVideo } from "./video-registry";

afterEach(() => {
  document.body.innerHTML = "";
});

function makeTracked(): TrackedVideo {
  const video = document.createElement("video");
  document.body.appendChild(video);
  return { video, cacheKey: "generic|https://example.com|abc", state: "waiting" };
}

function makeAssessment(): DetectionAssessment {
  return {
    classification: "declared_ai",
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
  };
}

function makeManager(): OverlayManager {
  return new OverlayManager({
    deepAnalysisEnabled: false,
    sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "sem handler" }),
    getContext: vi.fn(),
  });
}

describe("OverlayManager", () => {
  it("show cria um único host por vídeo (segunda chamada não duplica)", () => {
    const overlays = makeManager();
    const tracked = makeTracked();

    overlays.show(tracked);
    const firstHost = tracked.overlayHost;
    overlays.show(tracked);

    expect(tracked.overlayHost).toBe(firstHost);
    expect(document.querySelectorAll("[data-bp-overlay]")).toHaveLength(1);
  });

  it("host usa Shadow DOM", () => {
    const overlays = makeManager();
    const tracked = makeTracked();

    overlays.show(tracked);

    expect(tracked.overlayHost).toBeDefined();
    expect(tracked.overlayHost?.shadowRoot).not.toBeNull();
  });

  it("host é posicionado de forma absoluta sobre o canto superior esquerdo do vídeo", () => {
    const overlays = makeManager();
    const tracked = makeTracked();
    Object.defineProperty(tracked.video, "offsetTop", { value: 40, configurable: true });
    Object.defineProperty(tracked.video, "offsetLeft", { value: 20, configurable: true });

    overlays.show(tracked);

    const host = tracked.overlayHost!;
    expect(host.style.position).toBe("absolute");
    expect(host.style.top).toBe("40px");
    expect(host.style.left).toBe("20px");
  });

  it("CSS é injetado como <style> dentro do shadow root", () => {
    const overlays = makeManager();
    const tracked = makeTracked();

    overlays.show(tracked);

    const styleEl = tracked.overlayHost?.shadowRoot?.querySelector("style");
    expect(styleEl).toBeTruthy();
    expect(styleEl?.textContent?.length).toBeGreaterThan(0);
  });

  it("setState renderiza o rótulo do estado dentro do shadow root", () => {
    const overlays = makeManager();
    const tracked = makeTracked();

    overlays.show(tracked);
    overlays.setState(tracked, "declared_ai", makeAssessment());

    const text = tracked.overlayHost?.shadowRoot?.textContent ?? "";
    expect(text).toContain(STATE_STRINGS.declared_ai.label);
  });

  it("remove desmonta o React e limpa o host do DOM", () => {
    const overlays = makeManager();
    const tracked = makeTracked();

    overlays.show(tracked);
    const host = tracked.overlayHost!;
    overlays.remove(tracked);

    expect(tracked.overlayHost).toBeUndefined();
    expect(host.isConnected).toBe(false);
    expect(document.querySelectorAll("[data-bp-overlay]")).toHaveLength(0);
  });

  it("remove é seguro de chamar quando não há overlay (idempotente)", () => {
    const overlays = makeManager();
    const tracked = makeTracked();

    expect(() => overlays.remove(tracked)).not.toThrow();
  });
});
