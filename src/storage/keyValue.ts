/**
 * Small storage abstraction so the settings/quota layers can be exercised in
 * tests without a browser. The production implementation wraps
 * `chrome.storage.local` (local-only; never sync, so nothing leaves the device).
 */
export interface KeyValueStore {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export function chromeKeyValueStore(): KeyValueStore | null {
  const area = (globalThis as { chrome?: typeof chrome }).chrome?.storage?.local;
  if (!area) return null;
  return {
    get: (keys) =>
      new Promise((resolve, reject) => {
        area.get(keys, (items) => {
          const error = chrome.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve(items as Record<string, unknown>);
        });
      }),
    set: (items) =>
      new Promise((resolve, reject) => {
        area.set(items, () => {
          const error = chrome.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve();
        });
      }),
    remove: (keys) =>
      new Promise((resolve, reject) => {
        area.remove(keys, () => {
          const error = chrome.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve();
        });
      }),
  };
}

/** In-memory store used by unit tests. */
export function memoryKeyValueStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    get: async (keys) =>
      Object.fromEntries(keys.filter((key) => data.has(key)).map((key) => [key, data.get(key)])),
    set: async (items) => {
      for (const [key, value] of Object.entries(items)) data.set(key, value);
    },
    remove: async (keys) => {
      for (const key of keys) data.delete(key);
    },
  };
}
