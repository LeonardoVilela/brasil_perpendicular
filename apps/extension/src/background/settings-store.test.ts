import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@bp/shared";
import { installChromeMock, uninstallChromeMock } from "../test-helpers/chrome-mock";
import { getSettings, setSettings } from "./settings-store";

beforeEach(() => {
  installChromeMock();
});

afterEach(() => {
  uninstallChromeMock();
  vi.unstubAllEnvs();
});

describe("settings-store", () => {
  it("retorna DEFAULT_SETTINGS quando não há nada salvo", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("usa a API HTTPS injetada no build de distribuição", async () => {
    vi.stubEnv("VITE_DEFAULT_API_URL", "https://api.brasilperpendicular.example");
    expect((await getSettings()).apiUrl).toBe("https://api.brasilperpendicular.example");
  });

  it("setSettings grava e getSettings devolve o valor salvo", async () => {
    const custom = { ...DEFAULT_SETTINGS, devMode: true, apiUrl: "https://example.com" };
    await setSettings(custom);
    expect(await getSettings()).toEqual(custom);
  });

  it("mescla settings parciais salvos sobre DEFAULT_SETTINGS (dado legado incompleto)", async () => {
    await chrome.storage.local.set({ bpSettings: { devMode: true } });
    const settings = await getSettings();
    expect(settings.devMode).toBe(true);
    expect(settings.autoAnalyzeEnabled).toBe(DEFAULT_SETTINGS.autoAnalyzeEnabled);
    expect(settings.enabledPlatforms).toEqual(DEFAULT_SETTINGS.enabledPlatforms);
    expect(settings.automaticDeepVisualAnalysisEnabled).toBe(false);
  });

  it("não transforma o opt-in antigo de contexto em consentimento para frames", async () => {
    await chrome.storage.local.set({ bpSettings: { deepAnalysisEnabled: true } });
    const settings = await getSettings();
    expect(settings.deepAnalysisEnabled).toBe(true);
    expect(settings.automaticDeepVisualAnalysisEnabled).toBe(false);
  });

  it("mescla enabledPlatforms num nível só, preservando as demais plataformas padrão", async () => {
    await chrome.storage.local.set({ bpSettings: { enabledPlatforms: { youtube: false } } });
    const settings = await getSettings();
    expect(settings.enabledPlatforms.youtube).toBe(false);
    expect(settings.enabledPlatforms.tiktok).toBe(true);
    expect(settings.enabledPlatforms.instagram).toBe(true);
  });
});
