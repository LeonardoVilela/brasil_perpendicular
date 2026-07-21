import type { Settings, VideoContext } from "@bp/shared";

export type PlatformName = keyof Settings["enabledPlatforms"];

export interface PlatformAdapter {
  name: PlatformName;
  matches(location: Location): boolean;
  extractContext(video: HTMLVideoElement, doc: Document): VideoContext;
}
