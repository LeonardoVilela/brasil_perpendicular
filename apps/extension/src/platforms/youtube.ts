import type { PlatformAdapter } from "./types";
import { genericAdapter } from "./generic";
import { extractHashtags, extractPlatformLabels, firstVisibleText, uniqueTexts } from "./extract";

const isYoutubeHost = (hostname: string) => hostname === "youtu.be" || hostname === "youtube.com" || hostname.endsWith(".youtube.com");

export const youtubeAdapter: PlatformAdapter = {
  name: "youtube",
  matches: (location) => isYoutubeHost(location.hostname.toLowerCase()),
  extractContext(video, doc) {
    const fallback = genericAdapter.extractContext(video, doc);
    const root = video.closest("ytd-watch-flexy") ?? doc.querySelector("ytd-watch-flexy") ?? doc;
    const title = firstVisibleText(root, [
      "h1.ytd-watch-metadata yt-formatted-string",
      "h1 yt-formatted-string",
      "h1.title",
    ]) ?? fallback.title;
    const description = firstVisibleText(root, [
      "#description-inline-expander",
      "#description ytd-text-inline-expander",
      "#description",
    ]);
    const authorName = firstVisibleText(root, ["#owner #channel-name a", "ytd-channel-name a"]);
    const authorStatements = uniqueTexts([title, description]);
    const platformLabels = extractPlatformLabels(root, [
      "#structured-description span",
      "#description span",
      "ytd-watch-metadata span",
      '[data-testid*="ai"]',
      '[aria-label*="synthetic" i]',
    ]);
    const ownedText = authorStatements.join(" ");

    return {
      ...fallback,
      platform: "youtube",
      title,
      description: description ?? fallback.description,
      hashtags: extractHashtags(ownedText),
      authorName,
      authorStatements,
      platformLabels,
    };
  },
};
