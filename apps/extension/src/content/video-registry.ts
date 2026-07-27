import { hashContext, normalizeUrl } from "@bp/shared";
import type { VideoContext } from "@bp/shared";
import type { OverlayState } from "@bp/ui";

export interface TrackedVideo {
  video: HTMLVideoElement;
  cacheKey: string; // "plataforma|urlNormalizada|contextHash" — nunca blob:
  overlayHost?: HTMLElement;
  state: OverlayState;
  visualAnalysisController?: AbortController;
  requestDeepVisualAnalysis?: () => void;
}

function computeCacheKey(video: HTMLVideoElement, platform: string, context?: VideoContext): string {
  const src = video.currentSrc || video.src;
  const safeSrc = !src || src.startsWith("blob:") ? "" : normalizeUrl(src);
  const duration = context?.durationSeconds ?? (Number.isFinite(video.duration) ? video.duration : undefined);
  const contextInput = JSON.stringify([
    safeSrc,
    duration ?? null,
    context?.title ?? "",
    context?.description ?? "",
    context?.hashtags ?? [],
    context?.ariaLabels ?? [],
    context?.captions ?? [],
    context?.authorName ?? "",
    context?.authorStatements ?? [],
    context?.platformLabels ?? [],
  ]);
  const pageUrl = normalizeUrl(context?.pageUrl ?? location.href);
  return `${platform}|${pageUrl}|${hashContext(contextInput)}`;
}

export class VideoRegistry {
  private readonly entries = new WeakMap<HTMLVideoElement, TrackedVideo>();

  track(video: HTMLVideoElement, platform: string): TrackedVideo {
    const existing = this.entries.get(video);
    if (existing) return existing;

    const tracked: TrackedVideo = {
      video,
      cacheKey: computeCacheKey(video, platform),
      state: "waiting",
    };
    this.entries.set(video, tracked);
    return tracked;
  }

  get(video: HTMLVideoElement): TrackedVideo | undefined {
    return this.entries.get(video);
  }

  refreshIdentity(video: HTMLVideoElement, platform: string, context: VideoContext): TrackedVideo {
    const tracked = this.track(video, platform);
    tracked.cacheKey = computeCacheKey(video, platform, context);
    return tracked;
  }

  beginVisualAnalysis(video: HTMLVideoElement, platform: string): AbortSignal {
    const tracked = this.track(video, platform);
    tracked.visualAnalysisController?.abort();
    tracked.visualAnalysisController = new AbortController();
    return tracked.visualAnalysisController.signal;
  }

  invalidate(video: HTMLVideoElement): void {
    this.entries.get(video)?.visualAnalysisController?.abort();
    this.entries.delete(video);
  }
}
