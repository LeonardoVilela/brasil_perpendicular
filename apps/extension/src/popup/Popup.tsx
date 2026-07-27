import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@bp/shared";
import { sendMessage } from "../send-message";

export function Popup() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void sendMessage({ kind: "SETTINGS_GET" }).then((response) => {
      if (response.ok) setSettings(response.data as Settings);
    });
  }, []);

  async function handleAnalyze(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setFeedback("Não foi possível identificar a aba ativa.");
      return;
    }
    const response = await sendMessage({ kind: "INJECT_CONTENT_SCRIPT", tabId: tab.id });
    setFeedback(response.ok ? "Análise iniciada." : "Não foi possível iniciar a análise.");
  }

  function handleOpenOptions(): void {
    chrome.runtime.openOptionsPage();
  }

  return (
    <div>
      <h1>Brasil Perpendicular</h1>
      <p>{settings.showBadge ? "Selo ativo" : "Selo oculto"}</p>

      <button type="button" onClick={() => void handleAnalyze()}>
        Analisar vídeos desta página
      </button>
      <button type="button" onClick={handleOpenOptions}>
        Configurações
      </button>

      {feedback && <p role="status">{feedback}</p>}
    </div>
  );
}
