import type { PlatformAdapter } from "./types";
import { genericAdapter } from "./generic";
import { extractHashtags, extractPlatformLabels, firstVisibleText, uniqueTexts } from "./extract";

const ROOT_SELECTOR = '[data-e2e="feed-video"], [data-e2e="browse-video"], article';

export const tiktokAdapter: PlatformAdapter = {
  name: "tiktok",
  matches: (location) => location.hostname.toLowerCase() === "tiktok.com" || location.hostname.toLowerCase().endsWith(".tiktok.com"),
  extractContext(video, doc) {
    const fallback = genericAdapter.extractContext(video, doc);
    const root = video.closest(ROOT_SELECTOR) ?? doc;
    const description = firstVisibleText(root, [
      '[data-e2e="browse-video-desc"]',
      '[data-e2e="video-desc"]',
    ]);
    const authorName = firstVisibleText(root, [
      '[data-e2e="browse-username"]',
      '[data-e2e="video-author-uniqueid"]',
    ]);
    const authorStatements = uniqueTexts([description]);

    return {
      ...fallback,
      platform: "tiktok",
      description: description ?? fallback.description,
      hashtags: extractHashtags(authorStatements.join(" ")),
      authorName,
      authorStatements,
      platformLabels: extractPlatformLabels(root, [
        '[data-e2e*="ai-generated"]',
        '[data-e2e*="aigc"]',
        '[data-testid*="ai"]',
      ]),
    };
  },
};
