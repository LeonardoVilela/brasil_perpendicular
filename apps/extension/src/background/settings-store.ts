import { DEFAULT_SETTINGS, type Settings } from "@bp/shared";

const STORAGE_KEY = "bpSettings";

/** Lê settings de chrome.storage.local, mesclando sobre DEFAULT_SETTINGS. */
export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const partial = stored[STORAGE_KEY] as Partial<Settings> | undefined;
  if (!partial) return DEFAULT_SETTINGS;

  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    enabledPlatforms: { ...DEFAULT_SETTINGS.enabledPlatforms, ...partial.enabledPlatforms },
  };
}

/** Grava o objeto Settings completo (o chamador já resolveu os defaults). */
export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
