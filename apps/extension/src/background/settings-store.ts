import { DEFAULT_SETTINGS, type Settings } from "@bp/shared";

const STORAGE_KEY = "bpSettings";

function extensionDefaults(): Settings {
  const configuredApiUrl = import.meta.env.VITE_DEFAULT_API_URL?.trim();
  return {
    ...DEFAULT_SETTINGS,
    apiUrl: configuredApiUrl || DEFAULT_SETTINGS.apiUrl,
  };
}

/** Lê settings de chrome.storage.local, mesclando sobre DEFAULT_SETTINGS. */
export async function getSettings(): Promise<Settings> {
  const defaults = extensionDefaults();
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const partial = stored[STORAGE_KEY] as Partial<Settings> | undefined;
  if (!partial) return defaults;

  return {
    ...defaults,
    ...partial,
    enabledPlatforms: { ...defaults.enabledPlatforms, ...partial.enabledPlatforms },
  };
}

/** Grava o objeto Settings completo (o chamador já resolveu os defaults). */
export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
