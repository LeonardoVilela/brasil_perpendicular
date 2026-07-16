import type { VideoContext } from "@bp/shared";

export interface PlatformAdapter {
  name: string; // "generic", "youtube", ...
  matches(location: Location): boolean;
  extractContext(video: HTMLVideoElement, doc: Document): VideoContext;
}
