import { ASSESSMENT_VERSION, RULESET_VERSION } from "@bp/detection-core";
import type { DetectionAssessment } from "@bp/shared";

const STORAGE_KEY = "bpCache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

interface CacheEntry {
  assessment: DetectionAssessment;
  storedAt: number;
  lastUsedAt: number;
}

type CacheStore = Record<string, CacheEntry>;

async function readStore(): Promise<CacheStore> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as CacheStore | undefined) ?? {};
}

async function writeStore(store: CacheStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

function isStale(entry: CacheEntry): boolean {
  const expired = Date.now() - entry.storedAt > TTL_MS;
  const versionMismatch =
    entry.assessment.assessmentVersion !== ASSESSMENT_VERSION ||
    entry.assessment.rulesetVersion !== RULESET_VERSION;
  return expired || versionMismatch;
}

/** Miss se ausente, expirado (TTL 7 dias) ou de versão diferente da atual (e poda a entrada). */
export async function cacheGet(key: string): Promise<DetectionAssessment | undefined> {
  const store = await readStore();
  const entry = store[key];
  if (!entry) return undefined;

  if (isStale(entry)) {
    delete store[key];
    await writeStore(store);
    return undefined;
  }

  entry.lastUsedAt = Date.now();
  await writeStore(store);
  return entry.assessment;
}

/** Insere e, acima de MAX_ENTRIES, evita a entrada de lastUsedAt mais antigo. */
export async function cachePut(key: string, assessment: DetectionAssessment): Promise<void> {
  const store = await readStore();
  const now = Date.now();
  store[key] = { assessment, storedAt: now, lastUsedAt: now };

  const entries = Object.entries(store);
  if (entries.length > MAX_ENTRIES) {
    const [oldestKey] = entries.reduce((oldest, entry) =>
      entry[1].lastUsedAt < oldest[1].lastUsedAt ? entry : oldest,
    );
    delete store[oldestKey];
  }

  await writeStore(store);
}

/** Limpa todo o cache (usado pela página de opções). */
export async function cacheClear(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
