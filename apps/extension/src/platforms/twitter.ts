import type { PlatformAdapter } from "./types";
import { genericAdapter } from "./generic";
import { belongsToRoot, extractHashtags, extractPlatformLabels, firstVisibleText, normalizeText, uniqueTexts } from "./extract";

const ROOT_SELECTOR = 'article[data-testid="tweet"]';

export const twitterAdapter: PlatformAdapter = {
  name: "twitter",
  matches(location) {
    const hostname = location.hostname.toLowerCase();
    return hostname === "x.com" || hostname.endsWith(".x.com") || hostname === "twitter.com" || hostname.endsWith(".twitter.com");
  },
  extractContext(video, doc) {
    const fallback = genericAdapter.extractContext(video, doc);
    const root = video.closest(ROOT_SELECTOR);
    if (!root) return { ...fallback, platform: "twitter" };

    const ownTexts = [...root.querySelectorAll('[data-testid="tweetText"]')]
      .filter((element) => belongsToRoot(element, root, ROOT_SELECTOR))
      .map((element) => normalizeText(element.textContent));
    const description = uniqueTexts(ownTexts)[0];
    const authorName = firstVisibleText(root, ['[data-testid="User-Name"] a[role="link"]']);
    const authorStatements = uniqueTexts([description]);

    return {
      ...fallback,
      platform: "twitter",
      description: description ?? fallback.description,
      hashtags: extractHashtags(authorStatements.join(" ")),
      authorName,
      authorStatements,
      platformLabels: extractPlatformLabels(root, [
        '[data-testid*="ai-label"]',
        '[data-testid*="aigc"]',
      ]),
    };
  },
};
