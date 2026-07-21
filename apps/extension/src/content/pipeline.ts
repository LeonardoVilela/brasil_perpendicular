import { assess } from "@bp/detection-core";
import type { DetectionAssessment, MessageResponse, RequestMessage, Settings } from "@bp/shared";
import { pickAdapter } from "../platforms/registry";
import type { AnalysisQueue } from "./analysis-queue";
import { watchVideos, watchVisibility } from "./observers";
import type { OverlayLike } from "./overlay-manager";
import type { TrackedVideo, VideoRegistry } from "./video-registry";

export interface PipelineDeps {
  registry: VideoRegistry;
  queue: AnalysisQueue;
  overlays: OverlayLike;
  settings: Settings;
  sendMessage: (message: RequestMessage) => Promise<MessageResponse<unknown>>;
}

/**
 * Liga observadores, fila de análise e overlay para todo <video> da página.
 * Camada 1 apenas (contexto textual) — o detector visual não participa deste
 * fluxo nesta entrega; assess() já marca visual_model como indisponível.
 */
export function startPipeline(deps: PipelineDeps): () => void {
  const { registry, queue, overlays, settings, sendMessage } = deps;
  const adapter = pickAdapter(location);
  if (!settings.enabledPlatforms[adapter.name]) {
    return () => {};
  }

  const visibilityStops = new Map<HTMLVideoElement, () => void>();

  function forgetVideo(video: HTMLVideoElement, tracked: TrackedVideo): void {
    if (registry.get(video) !== tracked) return;
    overlays.remove(tracked);
    registry.invalidate(video);
    visibilityStops.get(video)?.();
    visibilityStops.delete(video);
  }

  function runAnalysis(video: HTMLVideoElement, tracked: TrackedVideo): void {
    queue.enqueue(async () => {
      if (registry.get(video) !== tracked) return;
      if (!video.isConnected) {
        forgetVideo(video, tracked);
        return;
      }

      if (settings.showBadge) overlays.setState(tracked, "analyzing");
      try {
        const context = adapter.extractContext(video, document);
        registry.refreshIdentity(video, adapter.name, context);
        const cached = await sendMessage({ kind: "CACHE_GET", key: tracked.cacheKey });
        if (registry.get(video) !== tracked) return;

        let assessment: DetectionAssessment;
        if (cached.ok && cached.data) {
          assessment = cached.data as DetectionAssessment;
        } else {
          assessment = assess(context);
          if (registry.get(video) !== tracked) return;
          await sendMessage({ kind: "CACHE_PUT", key: tracked.cacheKey, assessment });
        }

        if (registry.get(video) !== tracked) return;
        if (!video.isConnected) {
          forgetVideo(video, tracked);
          return;
        }
        if (settings.showBadge) {
          overlays.setState(tracked, assessment.classification, assessment);
        }
      } catch {
        if (settings.showBadge && registry.get(video) === tracked) {
          overlays.setState(tracked, "error");
        }
      }
    });
  }

  function onVideoAdded(video: HTMLVideoElement): void {
    // Re-emissão para o mesmo elemento = src trocou (loadstart): o cacheKey e
    // o watcher de visibilidade antigos não valem mais.
    const previous = registry.get(video);
    if (previous) {
      visibilityStops.get(video)?.();
      visibilityStops.delete(video);
      overlays.remove(previous);
      registry.invalidate(video);
    }

    const tracked = registry.track(video, adapter.name);
    if (settings.showBadge) overlays.show(tracked);

    const stopVisibility = watchVisibility(video, settings.minVisibleMs, () => {
      if (!video.isConnected) {
        forgetVideo(video, tracked);
        return;
      }
      if (settings.autoAnalyzeEnabled) runAnalysis(video, tracked);
    });
    visibilityStops.set(video, stopVisibility);
  }

  const stopWatchVideos = watchVideos(document, onVideoAdded, (video) => {
    const tracked = registry.get(video);
    if (tracked) forgetVideo(video, tracked);
  });

  return () => {
    stopWatchVideos();
    for (const [video, stopVisibility] of visibilityStops) {
      stopVisibility();
      const tracked = registry.get(video);
      if (tracked) {
        overlays.remove(tracked);
        registry.invalidate(video);
      }
    }
    visibilityStops.clear();
  };
}
