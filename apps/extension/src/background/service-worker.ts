import { requestMessageSchema, type MessageResponse, type RequestMessage } from "@bp/shared";
import { cacheClear, cacheGet, cachePut } from "./assessment-cache";
import { requestDeepAnalysis, requestDeepVisualAnalysis, submitFeedback } from "./api-client";
import { getSettings, setSettings } from "./settings-store";

async function handleMessage(message: RequestMessage): Promise<MessageResponse<unknown>> {
  switch (message.kind) {
    case "CACHE_GET":
      return { ok: true, data: await cacheGet(message.key) };

    case "CACHE_PUT":
      await cachePut(message.key, message.assessment);
      return { ok: true, data: undefined };

    case "CACHE_CLEAR":
      await cacheClear();
      return { ok: true, data: undefined };

    case "SETTINGS_GET":
      return { ok: true, data: await getSettings() };

    case "SETTINGS_SET":
      await setSettings(message.settings);
      return { ok: true, data: undefined };

    case "DEEP_ANALYZE_REQUEST": {
      const settings = await getSettings();
      // Sem opt-in explícito, nenhuma chamada de rede acontece — privacidade por padrão.
      if (!settings.deepAnalysisEnabled) {
        return { ok: false, error: "deep_analysis_disabled" };
      }
      return requestDeepAnalysis(message.context, settings.apiUrl);
    }

    case "DEEP_VISUAL_ANALYZE_REQUEST": {
      const settings = await getSettings();
      const explicitlyRequested = message.payload.reason === "manual_request";
      if (!settings.automaticDeepVisualAnalysisEnabled && !explicitlyRequested) {
        return { ok: false, error: "deep_visual_analysis_disabled" };
      }
      return requestDeepVisualAnalysis(message.payload, settings.apiUrl);
    }

    case "FEEDBACK_SUBMIT": {
      // Ação explícita do usuário: permitida mesmo com deepAnalysisEnabled desligado.
      const settings = await getSettings();
      return submitFeedback(message.feedback, settings.apiUrl);
    }

    case "INJECT_CONTENT_SCRIPT":
      await chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        files: ["content.js"],
      });
      return { ok: true, data: undefined };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "forbidden" });
    return true;
  }

  const parsed = requestMessageSchema.safeParse(message);
  if (!parsed.success) {
    sendResponse({ ok: false, error: "invalid_message" });
    return true;
  }

  handleMessage(parsed.data)
    .then(sendResponse)
    .catch((error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "internal_error" }),
    );

  return true; // resposta assíncrona
});
