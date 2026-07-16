import { DEFAULT_SETTINGS, type MessageResponse, type RequestMessage, type Settings } from "@bp/shared";
import { pickAdapter } from "../platforms/registry";
import { AnalysisQueue } from "./analysis-queue";
import { OverlayManager } from "./overlay-manager";
import { startPipeline } from "./pipeline";
import { VideoRegistry } from "./video-registry";

declare global {
  interface Window {
    __bpContentLoaded?: boolean;
  }
}

/**
 * Envolve chrome.runtime.sendMessage em MessageResponse. O service worker
 * ainda não trata todas as mensagens (chega na Tarefa 12) — sem handler, a
 * chamada rejeita e cai aqui como {ok:false}, nunca lança para o chamador.
 */
async function sendMessage(message: RequestMessage): Promise<MessageResponse<unknown>> {
  try {
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<unknown> | undefined;
    if (!response) return { ok: false, error: "sem resposta do service worker" };
    return response;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "falha ao enviar mensagem" };
  }
}

async function bootstrap(): Promise<void> {
  // Guarda contra injeção duplicada (ex.: popup reinjetando via scripting API).
  if (window.__bpContentLoaded) return;
  window.__bpContentLoaded = true;

  const settingsResponse = await sendMessage({ kind: "SETTINGS_GET" });
  const settings: Settings = settingsResponse.ok
    ? (settingsResponse.data as Settings)
    : DEFAULT_SETTINGS;

  if (settings.devMode) {
    console.debug("[bp] pipeline iniciado", { showBadge: settings.showBadge });
  }

  const adapter = pickAdapter(location);
  const overlays = new OverlayManager({
    deepAnalysisEnabled: settings.deepAnalysisEnabled,
    sendMessage,
    getContext: (video) => adapter.extractContext(video, document),
  });

  startPipeline({
    registry: new VideoRegistry(),
    queue: new AnalysisQueue(settings.maxConcurrentAnalyses),
    overlays,
    settings,
    sendMessage,
  });
}

void bootstrap();
