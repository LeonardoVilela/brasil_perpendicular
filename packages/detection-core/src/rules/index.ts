import { aiToolRules } from "./ai-tools";
import { declarationRules } from "./declarations";
import { hashtagRules } from "./hashtags";
import { scamRules } from "./scam-patterns";
import type { TextRule } from "./types";

export * from "./types";
export { aiToolRules } from "./ai-tools";
export { declarationRules } from "./declarations";
export { hashtagRules } from "./hashtags";
export { scamRules } from "./scam-patterns";

export const RULESET_VERSION = "0.1.0";

export const defaultRules: TextRule[] = [
  ...aiToolRules,
  ...declarationRules,
  ...hashtagRules,
  ...scamRules,
];
