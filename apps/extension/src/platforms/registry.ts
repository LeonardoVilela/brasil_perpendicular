import { genericAdapter } from "./generic";
import { instagramAdapter } from "./instagram";
import { tiktokAdapter } from "./tiktok";
import { twitterAdapter } from "./twitter";
import { youtubeAdapter } from "./youtube";
import type { PlatformAdapter } from "./types";

// Adaptadores específicos (youtube, tiktok, instagram, ...) entram aqui antes
// do genérico, que fica sempre por último como fallback.
const adapters: PlatformAdapter[] = [
  youtubeAdapter,
  tiktokAdapter,
  instagramAdapter,
  twitterAdapter,
  genericAdapter,
];

export function pickAdapter(location: Location): PlatformAdapter {
  return adapters.find((adapter) => adapter.matches(location)) ?? genericAdapter;
}
