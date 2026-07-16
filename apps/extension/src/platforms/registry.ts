import { genericAdapter } from "./generic";
import type { PlatformAdapter } from "./types";

// Adaptadores específicos (youtube, tiktok, instagram, ...) entram aqui antes
// do genérico, que fica sempre por último como fallback.
const adapters: PlatformAdapter[] = [genericAdapter];

export function pickAdapter(location: Location): PlatformAdapter {
  return adapters.find((adapter) => adapter.matches(location)) ?? genericAdapter;
}
