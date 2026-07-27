import { assess, decideDeepAnalysis, detectPoliticalContext } from "@bp/detection-core";
import type {
  AnalysisDetail,
  DeepAnalysisReason,
  DeepVisualResult,
  DetectionAssessment,
  Evidence,
  MessageResponse,
  RequestMessage,
  Settings,
} from "@bp/shared";
import { pickAdapter } from "../platforms/registry";
import type { LocalVisualResult, VisualDetector } from "../detectors/types";
import type { AnalysisQueue } from "./analysis-queue";
import { createFrameFingerprint } from "./frame-fingerprint";
import { sampleVideoFrames, type FrameSampleResult } from "./frame-sampler";
import { watchVideos, watchVisibility } from "./observers";
import type { OverlayLike } from "./overlay-manager";
import type { TrackedVideo, VideoRegistry } from "./video-registry";

export interface PipelineDeps {
  registry: VideoRegistry;
  queue: AnalysisQueue;
  overlays: OverlayLike;
  settings: Settings;
  sendMessage: (message: RequestMessage) => Promise<MessageResponse<unknown>>;
  visualDetector?: VisualDetector;
  sampleFrames?: typeof sampleVideoFrames;
  fingerprintFrames?: typeof createFrameFingerprint;
}

const LIMITATIONS: Record<string, string> = {
  thresholds_not_validated:
    "O detector local calculou o sinal, mas seus limites de decisão ainda não foram validados.",
  webgpu_unavailable: "A análise local usou o modo de compatibilidade WASM.",
  stall_not_configured: "A análise visual aprofundada não está configurada no servidor.",
  stall_saturated: "O servidor de análise aprofundada está ocupado.",
  stall_inference_failed: "A análise visual aprofundada falhou sem armazenar os frames.",
};

const CASCADE_CACHE_VERSION = "v3-d3-stall-2windows";

function visualEvidence(
  detector: string,
  syntheticScore: number | null | undefined,
  confidence: number | undefined,
  decision?: DeepVisualResult["decision"],
): Evidence[] {
  if (syntheticScore === undefined || syntheticScore === null || syntheticScore < 0.45) return [];
  const weight =
    detector === "stall-dinov3-vitl16" && decision !== "ai_like"
      ? Math.min(syntheticScore, 0.89)
      : syntheticScore;
  return [
    {
      id: `${detector}-visual`,
      domain: "synthetic_media",
      type: "visual_model",
      label: "Sinal visual de geração sintética",
      description: "O detector visual encontrou padrões compatíveis com vídeo gerado por IA.",
      weight,
      confidence: confidence ?? 0,
      correlationGroup: "visual-model",
      origin: "technical_signal",
      source: detector,
    },
  ];
}

function warningLimitations(warnings: string[]): string[] {
  return warnings.map((warning) => LIMITATIONS[warning] ?? "A análise visual encontrou uma limitação técnica.");
}

function localDetectorPayload(local: LocalVisualResult) {
  return local.syntheticScore === null
    ? undefined
    : {
        name: local.detector,
        version: local.detectorVersion,
        decision: local.decision,
        score: local.syntheticScore,
      };
}

function average(first: number | undefined, second: number | undefined): number | undefined {
  if (first === undefined) return second;
  if (second === undefined) return first;
  return (first + second) / 2;
}

function mergeDeepWindows(first: DeepVisualResult, second: DeepVisualResult): DeepVisualResult {
  const syntheticScore = average(first.syntheticScore, second.syntheticScore);
  return {
    ...first,
    spatialScore: average(first.spatialScore, second.spatialScore),
    temporalScore: average(first.temporalScore, second.temporalScore),
    syntheticScore,
    decision:
      syntheticScore === undefined
        ? "uncertain"
        : syntheticScore >= 0.95
          ? "ai_like"
          : syntheticScore <= 0.2
            ? "real_like"
            : "uncertain",
    confidence: average(first.confidence, second.confidence),
    sampledFrames: first.sampledFrames + second.sampledFrames,
    warnings: [...new Set([...first.warnings, ...second.warnings])],
  };
}

export function startPipeline(deps: PipelineDeps): () => void {
  const { registry, queue, overlays, settings, sendMessage, visualDetector } = deps;
  const sampler = deps.sampleFrames ?? sampleVideoFrames;
  const fingerprint = deps.fingerprintFrames ?? createFrameFingerprint;
  const adapter = pickAdapter(location);
  if (!settings.enabledPlatforms[adapter.name]) return () => {};

  const visibilityStops = new Map<HTMLVideoElement, () => void>();

  function forgetVideo(video: HTMLVideoElement, tracked: TrackedVideo): void {
    if (registry.get(video) !== tracked) return;
    overlays.remove(tracked);
    registry.invalidate(video);
    visibilityStops.get(video)?.();
    visibilityStops.delete(video);
  }

  async function contextOnlyAssessment(
    context: ReturnType<typeof adapter.extractContext>,
    tracked: TrackedVideo,
  ): Promise<DetectionAssessment> {
    const cached = await sendMessage({ kind: "CACHE_GET", key: tracked.cacheKey });
    if (cached.ok && cached.data) return cached.data as DetectionAssessment;
    const assessment = assess(context);
    await sendMessage({ kind: "CACHE_PUT", key: tracked.cacheKey, assessment });
    return assessment;
  }

  async function visualAssessment(
    video: HTMLVideoElement,
    tracked: TrackedVideo,
    context: ReturnType<typeof adapter.extractContext>,
    explicitDeep: boolean,
  ): Promise<DetectionAssessment> {
    const initial = assess(context);
    if (initial.classification === "declared_ai") {
      await sendMessage({ kind: "CACHE_PUT", key: tracked.cacheKey, assessment: initial });
      return initial;
    }

    const signal = registry.beginVisualAnalysis(video, adapter.name);
    const sampled: FrameSampleResult = await sampler(video, { signal });
    if (sampled.status !== "ok") {
      return assess(context, {
        unavailableAnalyses: ["visual_capture"],
        limitations: ["Não foi possível obter frames deste vídeo para a análise visual."],
      });
    }

    const frameFingerprint = await fingerprint(sampled.fingerprintSamples);
    const analysisMode = explicitDeep
      ? "manual"
      : settings.automaticDeepVisualAnalysisEnabled
        ? "automatic-deep"
        : "local-only";
    const cacheKey = `${tracked.cacheKey}|visual:${frameFingerprint}|${visualDetector!.name}@${visualDetector!.version}|${CASCADE_CACHE_VERSION}|${analysisMode}`;
    const cached = await sendMessage({ kind: "CACHE_GET", key: cacheKey });
    if (cached.ok && cached.data) return cached.data as DetectionAssessment;

    const local = await visualDetector!.analyzeFrames(sampled.frames, frameFingerprint);
    const political = detectPoliticalContext(context);
    let escalation = decideDeepAnalysis({
      classification: initial.classification,
      politicalContext: political.detected,
      localDecision: local.decision,
      signalConflict: local.decision === "real_like" && initial.score >= 0.45,
      framesAvailable: true,
      automaticDeepVisualAnalysisEnabled: settings.automaticDeepVisualAnalysisEnabled,
    });
    if (explicitDeep && !escalation.shouldEscalate) {
      escalation = { shouldEscalate: true, priority: "high", reason: "manual_request" };
    }

    let deep: DeepVisualResult | undefined;
    let deepReason: DeepAnalysisReason | undefined;
    if (escalation.shouldEscalate) {
      deepReason = escalation.reason;
      const response = await sendMessage({
        kind: "DEEP_VISUAL_ANALYZE_REQUEST",
        payload: {
          frames: sampled.frames,
          frameFingerprint,
          sampleRateFps: 8,
          durationSeconds: 2,
          reason: escalation.reason,
          localDetector: localDetectorPayload(local),
        },
      });
      if (response.ok) deep = response.data as DeepVisualResult;

      if (
        political.detected &&
        deep?.status === "analyzed" &&
        deep.decision === "uncertain" &&
        registry.get(video) === tracked &&
        video.isConnected
      ) {
        const secondWindow = await sampler(video, { signal });
        if (secondWindow.status === "ok") {
          const secondFingerprint = await fingerprint(secondWindow.fingerprintSamples);
          const secondResponse = await sendMessage({
            kind: "DEEP_VISUAL_ANALYZE_REQUEST",
            payload: {
              frames: secondWindow.frames,
              frameFingerprint: secondFingerprint,
              sampleRateFps: 8,
              durationSeconds: 2,
              reason: "political_context",
              localDetector: localDetectorPayload(local),
            },
          });
          if (secondResponse.ok) {
            const secondDeep = secondResponse.data as DeepVisualResult;
            if (secondDeep.status === "analyzed") deep = mergeDeepWindows(deep, secondDeep);
          }
          secondWindow.frames.length = 0;
          secondWindow.fingerprintSamples.length = 0;
        }
      }
    }

    const analyzedDeep = deep?.status === "analyzed" ? deep : undefined;
    const deepAnalyzed = analyzedDeep !== undefined;
    const evidence = analyzedDeep
      ? visualEvidence(
          "stall-dinov3-vitl16",
          analyzedDeep.syntheticScore,
          analyzedDeep.confidence,
          analyzedDeep.decision,
        )
      : visualEvidence(local.detector, local.syntheticScore, local.confidence);
    const executedAnalyses = [
      ...(local.decision === "unavailable" ? [] : ["d3_visual"]),
      ...(political.detected ? ["political_routing"] : []),
      ...(deepAnalyzed ? ["stall_visual"] : []),
    ];
    const unavailableAnalyses = [
      ...(local.decision === "unavailable" ? ["d3_visual"] : []),
      ...(escalation.shouldEscalate && !deepAnalyzed ? ["stall_visual"] : []),
      ...(!escalation.shouldEscalate && escalation.blockedBy === "opt_in_required"
        ? ["stall_visual"]
        : []),
    ];
    const limitations = [
      ...warningLimitations(local.warnings),
      ...warningLimitations(deep?.warnings ?? []),
      ...(political.detected
        ? ["Contexto eleitoral detectado; análise aprofundada priorizada."]
        : []),
      ...(!escalation.shouldEscalate && escalation.blockedBy === "opt_in_required"
        ? ["O envio automático de frames para análise aprofundada não foi autorizado."]
        : []),
    ];
    const analysisDetails: AnalysisDetail[] = [
      {
        analysis: "d3_visual",
        detector: local.detector,
        version: local.detectorVersion,
        backend: local.backend === "mock" ? "unavailable" : local.backend,
        sampledFrames: local.sampledFrames,
        usableFrames: local.usableFrames,
      },
      ...(political.detected ? [{ analysis: "political_routing" as const }] : []),
      ...(deepReason
        ? [
            {
              analysis: "stall_visual" as const,
              detector: "stall-dinov3-vitl16",
              version: deep?.detectorVersion,
              backend: analyzedDeep ? ("remote" as const) : ("unavailable" as const),
              sampledFrames: deep?.sampledFrames ?? sampled.frames.length,
              usableFrames: analyzedDeep?.sampledFrames ?? 0,
              reason: deepReason,
            },
          ]
        : []),
    ];
    const assessment = assess(context, {
      additionalEvidence: evidence,
      executedAnalyses,
      unavailableAnalyses,
      limitations,
      visualAnalysisAvailable: local.decision !== "unavailable" || deepAnalyzed,
      detectorVersions: {
        [local.detector]: local.detectorVersion,
        ...(analyzedDeep
          ? { "stall-dinov3-vitl16": analyzedDeep.detectorVersion }
          : {}),
      },
      analysisDetails,
    });
    await sendMessage({ kind: "CACHE_PUT", key: cacheKey, assessment });

    sampled.frames.length = 0;
    sampled.fingerprintSamples.length = 0;
    return assessment;
  }

  function runAnalysis(video: HTMLVideoElement, tracked: TrackedVideo, explicitDeep = false): void {
    const priority = detectPoliticalContext(adapter.extractContext(video, document)).detected
      ? "high"
      : "normal";
    queue.enqueue(async () => {
      if (registry.get(video) !== tracked) return;
      if (!video.isConnected) return forgetVideo(video, tracked);

      if (settings.showBadge) overlays.setState(tracked, "analyzing");
      try {
        const context = adapter.extractContext(video, document);
        registry.refreshIdentity(video, adapter.name, context);
        const assessment = visualDetector
          ? await visualAssessment(video, tracked, context, explicitDeep)
          : await contextOnlyAssessment(context, tracked);
        if (registry.get(video) !== tracked) return;
        if (!video.isConnected) return forgetVideo(video, tracked);
        if (settings.showBadge) overlays.setState(tracked, assessment.classification, assessment);
      } catch {
        if (settings.showBadge && registry.get(video) === tracked) overlays.setState(tracked, "error");
      }
    }, priority);
  }

  function onVideoAdded(video: HTMLVideoElement): void {
    const previous = registry.get(video);
    if (previous) {
      visibilityStops.get(video)?.();
      visibilityStops.delete(video);
      overlays.remove(previous);
      registry.invalidate(video);
    }

    const tracked = registry.track(video, adapter.name);
    tracked.requestDeepVisualAnalysis = () => runAnalysis(video, tracked, true);
    if (settings.showBadge) overlays.show(tracked);
    const stopVisibility = watchVisibility(video, settings.minVisibleMs, () => {
      if (!video.isConnected) return forgetVideo(video, tracked);
      if (settings.autoAnalyzeEnabled) runAnalysis(video, tracked);
    });
    visibilityStops.set(video, stopVisibility);
  }

  const stopWatchVideos = watchVideos(document, onVideoAdded, (video) => {
    const tracked = registry.get(video);
    if (tracked) forgetVideo(video, tracked);
  });

  return () => {
    stopWatchVideos();
    for (const [video, stopVisibility] of visibilityStops) {
      stopVisibility();
      const tracked = registry.get(video);
      if (tracked) {
        overlays.remove(tracked);
        registry.invalidate(video);
      }
    }
    visibilityStops.clear();
  };
}
