import type { PlatformAdapter } from "./types";
import { genericAdapter } from "./generic";
import { extractHashtags, extractPlatformLabels, firstVisibleText, uniqueTexts } from "./extract";

export const instagramAdapter: PlatformAdapter = {
  name: "instagram",
  matches: (location) => location.hostname.toLowerCase() === "instagram.com" || location.hostname.toLowerCase().endsWith(".instagram.com"),
  extractContext(video, doc) {
    const fallback = genericAdapter.extractContext(video, doc);
    const root = video.closest("article") ?? doc;
    const description = firstVisibleText(root, [
      '[data-testid="post-caption"]',
      "h1",
    ]);
    const authorName = firstVisibleText(root, ["header a[href^='/']"]);
    const authorStatements = uniqueTexts([description]);

    return {
      ...fallback,
      platform: "instagram",
      description: description ?? fallback.description,
      hashtags: extractHashtags(authorStatements.join(" ")),
      authorName,
      authorStatements,
      platformLabels: extractPlatformLabels(root, [
        '[data-testid*="ai-label"]',
        '[data-testid*="aigc"]',
        '[aria-label="AI info" i]',
        '[aria-label="Informações de IA" i]',
        "header span",
      ]),
    };
  },
};
