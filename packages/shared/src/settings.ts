export interface Settings {
  autoAnalyzeEnabled: boolean;
  deepAnalysisEnabled: boolean; // padrão false — privacidade
  automaticDeepVisualAnalysisEnabled: boolean; // consentimento separado para envio de frames
  minVisibleMs: number; // padrão 2000
  maxConcurrentAnalyses: number; // padrão 2
  enabledPlatforms: {
    youtube: boolean;
    tiktok: boolean;
    instagram: boolean;
    twitter: boolean;
    generic: boolean;
  };
  showBadge: boolean;
  devMode: boolean;
  apiUrl: string; // padrão "http://localhost:8000"
}

export const DEFAULT_SETTINGS: Settings = {
  autoAnalyzeEnabled: true,
  deepAnalysisEnabled: false,
  automaticDeepVisualAnalysisEnabled: false,
  minVisibleMs: 2000,
  maxConcurrentAnalyses: 2,
  enabledPlatforms: {
    youtube: true,
    tiktok: true,
    instagram: true,
    twitter: true,
    generic: true,
  },
  showBadge: true,
  devMode: false,
  apiUrl: "http://localhost:8000",
};
