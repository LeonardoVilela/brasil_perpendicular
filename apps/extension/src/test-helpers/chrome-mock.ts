import { vi } from "vitest";

// Mock mínimo de chrome.* em memória, sem biblioteca externa. Cobre só o que
// o service worker usa: storage.local, runtime.onMessage/id, scripting.

type SendResponse = (response?: unknown) => void;
type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
) => boolean | void;

export interface ChromeMock {
  storage: {
    local: {
      get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
    };
  };
  runtime: {
    id: string;
    onMessage: { addListener: (listener: MessageListener) => void };
  };
  scripting: { executeScript: ReturnType<typeof vi.fn> };
  /** Simula uma mensagem chegando pelo runtime.onMessage; resolve com a resposta. */
  dispatchMessage: (
    message: unknown,
    sender?: Partial<chrome.runtime.MessageSender>,
  ) => Promise<unknown>;
}

export function installChromeMock(): ChromeMock {
  const store: Record<string, unknown> = {};
  const listeners: MessageListener[] = [];

  const mock: ChromeMock = {
    storage: {
      local: {
        get: async (keys) => {
          if (keys == null) return { ...store };
          const list = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of list) {
            if (key in store) result[key] = store[key];
          }
          return result;
        },
        set: async (items) => {
          Object.assign(store, items);
        },
        remove: async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) delete store[key];
        },
      },
    },
    runtime: {
      id: "test-extension-id",
      onMessage: {
        addListener: (listener) => {
          listeners.push(listener);
        },
      },
    },
    scripting: {
      executeScript: vi.fn(async () => []),
    },
    dispatchMessage: (message, sender = {}) =>
      new Promise((resolve) => {
        const fullSender = { id: mock.runtime.id, ...sender } as chrome.runtime.MessageSender;
        for (const listener of listeners) {
          listener(message, fullSender, resolve);
        }
      }),
  };

  (globalThis as unknown as { chrome: typeof chrome }).chrome = mock as unknown as typeof chrome;
  return mock;
}

export function uninstallChromeMock(): void {
  delete (globalThis as { chrome?: typeof chrome }).chrome;
}
