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
  if (!settings.showBadge) {
    return () => {};
  }

  const adapter = pickAdapter(location);
  const visibilityStops = new Map<HTMLVideoElement, () => void>();

  function forgetVideo(video: HTMLVideoElement, tracked: TrackedVideo): void {
    overlays.remove(tracked);
    registry.invalidate(video);
    visibilityStops.get(video)?.();
    visibilityStops.delete(video);
  }

  function runAnalysis(video: HTMLVideoElement, tracked: TrackedVideo): void {
    queue.enqueue(async () => {
      if (!video.isConnected) {
        forgetVideo(video, tracked);
        return;
      }

      overlays.setState(tracked, "analyzing");
      try {
        const cached = await sendMessage({ kind: "CACHE_GET", key: tracked.cacheKey });
        let assessment: DetectionAssessment;
        if (cached.ok && cached.data) {
          assessment = cached.data as DetectionAssessment;
        } else {
          const context = adapter.extractContext(video, document);
          assessment = assess(context);
          await sendMessage({ kind: "CACHE_PUT", key: tracked.cacheKey, assessment });
        }

        if (!video.isConnected) {
          forgetVideo(video, tracked);
          return;
        }
        overlays.setState(tracked, assessment.classification, assessment);
      } catch {
        overlays.setState(tracked, "error");
      }
    });
  }

  // Nota (ponytail): se o src do vídeo trocar (loadstart), onVideoAdded é
  // chamado de novo para o mesmo elemento; registry.track é idempotente e
  // retorna o TrackedVideo (e cacheKey) antigos. Invalidar corretamente nesse
  // caso — parando o observer antigo e recriando o overlay — fica para
  // quando houver um teste guiando esse cenário; hoje ele não é exercitado.
  function onVideoAdded(video: HTMLVideoElement): void {
    const tracked = registry.track(video, adapter.name);
    overlays.show(tracked);

    const stopVisibility = watchVisibility(video, settings.minVisibleMs, () => {
      if (!video.isConnected) {
        forgetVideo(video, tracked);
        return;
      }
      if (settings.autoAnalyzeEnabled) runAnalysis(video, tracked);
    });
    visibilityStops.set(video, stopVisibility);
  }

  const stopWatchVideos = watchVideos(document, onVideoAdded);

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
