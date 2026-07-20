import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@bp/shared";
import { sendMessage } from "../send-message";

type PlatformKey = keyof Settings["enabledPlatforms"];

const PLATFORM_LABELS: Array<{ key: PlatformKey; label: string }> = [
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "twitter", label: "X/Twitter" },
  { key: "generic", label: "Páginas genéricas" },
];

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void sendMessage({ kind: "SETTINGS_GET" }).then((response) => {
      if (response.ok) setSettings(response.data as Settings);
    });
  }, []);

  function updatePlatform(key: PlatformKey, value: boolean): void {
    setSettings((prev) => ({
      ...prev,
      enabledPlatforms: { ...prev.enabledPlatforms, [key]: value },
    }));
  }

  async function handleSave(): Promise<void> {
    const response = await sendMessage({ kind: "SETTINGS_SET", settings });
    setFeedback(response.ok ? "Configurações salvas." : "Não foi possível salvar as configurações.");
  }

  async function handleClearCache(): Promise<void> {
    const response = await sendMessage({ kind: "CACHE_CLEAR" });
    setFeedback(response.ok ? "Cache limpo." : "Não foi possível limpar o cache.");
  }

  return (
    <div>
      <h1>Configurações</h1>

      <label>
        <input
          type="checkbox"
          checked={settings.autoAnalyzeEnabled}
          onChange={(e) => setSettings((prev) => ({ ...prev, autoAnalyzeEnabled: e.target.checked }))}
        />
        Análise automática local
      </label>

      <div>
        <label>
          <input
            type="checkbox"
            checked={settings.deepAnalysisEnabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, deepAnalysisEnabled: e.target.checked }))}
          />
          Análise profunda no servidor
        </label>
        <p>Envia o contexto do vídeo (não o vídeo em si) para o servidor apenas quando ativado.</p>
      </div>

      <label>
        Tempo mínimo de visibilidade (segundos)
        <input
          type="number"
          min="0"
          step="0.1"
          value={settings.minVisibleMs / 1000}
          onChange={(e) => setSettings((prev) => ({ ...prev, minVisibleMs: Number(e.target.value) * 1000 }))}
        />
      </label>

      <label>
        Máximo de análises simultâneas
        <input
          type="number"
          min="1"
          step="1"
          value={settings.maxConcurrentAnalyses}
          onChange={(e) => setSettings((prev) => ({ ...prev, maxConcurrentAnalyses: Number(e.target.value) }))}
        />
      </label>

      <fieldset>
        <legend>Plataformas habilitadas</legend>
        {PLATFORM_LABELS.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={settings.enabledPlatforms[key]}
              onChange={(e) => updatePlatform(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <label>
        <input
          type="checkbox"
          checked={settings.showBadge}
          onChange={(e) => setSettings((prev) => ({ ...prev, showBadge: e.target.checked }))}
        />
        Mostrar selo
      </label>

      <label>
        <input
          type="checkbox"
          checked={settings.devMode}
          onChange={(e) => setSettings((prev) => ({ ...prev, devMode: e.target.checked }))}
        />
        Modo desenvolvedor
      </label>

      <label>
        URL da API
        <input
          type="url"
          value={settings.apiUrl}
          onChange={(e) => setSettings((prev) => ({ ...prev, apiUrl: e.target.value }))}
        />
      </label>

      <div>
        <button type="button" onClick={() => void handleSave()}>
          Salvar
        </button>
        <button type="button" onClick={() => void handleClearCache()}>
          Limpar cache
        </button>
      </div>

      {feedback && <p role="status">{feedback}</p>}
    </div>
  );
}
