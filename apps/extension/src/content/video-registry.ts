import { hashContext, normalizeUrl } from "@bp/shared";
import type { OverlayState } from "@bp/ui";

export interface TrackedVideo {
  video: HTMLVideoElement;
  cacheKey: string; // "plataforma|urlNormalizada|contextHash" — nunca blob:
  overlayHost?: HTMLElement;
  state: OverlayState;
}

function computeCacheKey(video: HTMLVideoElement, platform: string): string {
  const src = video.currentSrc || video.src;
  const safeSrc = src.startsWith("blob:") ? "" : src;
  const contextInput = `${safeSrc}|${video.duration || ""}`;
  return `${platform}|${normalizeUrl(location.href)}|${hashContext(contextInput)}`;
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

  invalidate(video: HTMLVideoElement): void {
    this.entries.delete(video);
  }
}
