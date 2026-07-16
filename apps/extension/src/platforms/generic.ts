import { normalizeUrl } from "@bp/shared";
import type { PlatformAdapter } from "./types";

const DESCRIPTION_MAX_LENGTH = 2000;
const MAX_ARIA_ANCESTOR_LEVELS = 3;
const HASHTAG_RE = /#\p{L}[\p{L}\p{N}_]*/gu;

function collectText(video: HTMLVideoElement, doc: Document): string {
  const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  const figcaption = video.closest("figure")?.querySelector("figcaption")?.textContent ?? "";
  const parentText = video.parentElement?.textContent ?? "";
  return `${metaDescription} ${figcaption} ${parentText}`.trim();
}

function extractTitle(doc: Document): string | undefined {
  if (doc.title.trim().length > 0) return doc.title;
  const ogTitle = doc
    .querySelector('meta[property="og:title"], meta[name="og:title"]')
    ?.getAttribute("content");
  return ogTitle && ogTitle.trim().length > 0 ? ogTitle : undefined;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(HASHTAG_RE) ?? [];
  return [...new Set(matches.map((tag) => tag.toLowerCase()))];
}

function extractAriaLabels(video: HTMLVideoElement): string[] {
  const labels: string[] = [];
  let el: Element | null = video;
  for (let level = 0; el && level <= MAX_ARIA_ANCESTOR_LEVELS; level++) {
    const label = el.getAttribute("aria-label");
    if (label && label.trim().length > 0) labels.push(label.trim());
    el = el.parentElement;
  }
  return labels;
}

/**
 * Adaptador de fallback: nenhum seletor específico de plataforma. Extrai
 * contexto apenas de marcação HTML padrão (meta tags, figure/figcaption,
 * aria-label, container pai do vídeo).
 */
export const genericAdapter: PlatformAdapter = {
  name: "generic",
  matches: () => true,
  extractContext(video, doc) {
    const collectedText = collectText(video, doc);
    const duration = video.duration;

    return {
      platform: "generic",
      pageUrl: normalizeUrl(doc.location?.href ?? location.href),
      title: extractTitle(doc),
      description: collectedText.length > 0 ? collectedText.slice(0, DESCRIPTION_MAX_LENGTH) : undefined,
      hashtags: extractHashtags(collectedText),
      ariaLabels: extractAriaLabels(video),
      captions: [],
      authorName: undefined,
      durationSeconds: Number.isFinite(duration) ? duration : undefined,
    };
  },
};
