import { normalizeUrl } from "@bp/shared";
import type { PlatformAdapter } from "./types";
import { extractHashtags, isVisible, normalizeText, uniqueTexts } from "./extract";

const DESCRIPTION_MAX_LENGTH = 2000;
const MAX_ARIA_ANCESTOR_LEVELS = 3;
function collectText(video: HTMLVideoElement, doc: Document): string {
  const values: Array<string | undefined> = [
    doc.querySelector('meta[name="description"]')?.getAttribute("content") ?? undefined,
  ];

  const figureCaption = video.closest("figure")?.querySelector("figcaption");
  if (figureCaption && isVisible(figureCaption)) values.push(figureCaption.textContent ?? undefined);

  const describedBy = video.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
  for (const id of describedBy) {
    const element = doc.getElementById(id);
    if (element && isVisible(element)) values.push(element.textContent ?? undefined);
  }

  const explicitContext = video.closest("[data-bp-context]");
  if (explicitContext && isVisible(explicitContext)) values.push(explicitContext.textContent ?? undefined);

  return uniqueTexts(values).join(" ");
}

function extractTitle(doc: Document): string | undefined {
  if (doc.title.trim().length > 0) return normalizeText(doc.title);
  const ogTitle = doc
    .querySelector('meta[property="og:title"], meta[name="og:title"]')
    ?.getAttribute("content");
  const normalized = normalizeText(ogTitle);
  return normalized || undefined;
}

function extractAriaLabels(video: HTMLVideoElement): string[] {
  const labels: string[] = [];
  let el: Element | null = video;
  for (let level = 0; el && level <= MAX_ARIA_ANCESTOR_LEVELS; level++) {
    const label = el.getAttribute("aria-label");
    if (label && label.trim().length > 0 && isVisible(el)) labels.push(normalizeText(label));
    el = el.parentElement;
  }
  return labels;
}

function extractAuthorStatements(video: HTMLVideoElement): string[] {
  const root = video.closest("figure, article, [data-bp-context]");
  if (!root) return [];
  return uniqueTexts(
    [...root.querySelectorAll("[data-bp-author-statement]")]
      .filter(isVisible)
      .map((element) => element.textContent ?? undefined),
  );
}

/**
 * Adaptador de fallback: nenhum seletor específico de plataforma. Extrai
 * contexto apenas de marcação HTML associada ao vídeo (meta tags,
 * figure/figcaption, aria-label e aria-describedby).
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
      authorStatements: extractAuthorStatements(video),
      platformLabels: [],
      authorName: undefined,
      durationSeconds: Number.isFinite(duration) ? duration : undefined,
    };
  },
};
