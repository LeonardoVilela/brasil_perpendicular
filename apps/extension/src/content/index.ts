import { DEFAULT_SETTINGS, type Settings } from "@bp/shared";
import { sendMessage } from "../send-message";
import { pickAdapter } from "../platforms/registry";
import { OnnxVisualDetector } from "../detectors/onnx";
import { AnalysisQueue } from "./analysis-queue";
import { OverlayManager } from "./overlay-manager";
import { startPipeline } from "./pipeline";
import { VideoRegistry } from "./video-registry";

declare global {
  interface Window {
    __bpContentLoaded?: boolean;
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
    visualDetector: new OnnxVisualDetector(),
  });
}

void bootstrap();
