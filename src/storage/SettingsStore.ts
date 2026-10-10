import { SETTINGS_VERSION, type Settings } from '../shared/types';
import { clampNumber } from '../shared/validate';
import { chromeKeyValueStore, type KeyValueStore } from './keyValue';

const SETTINGS_KEY = 'settings';
const API_KEY_KEY = 'apiKey';

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  enabled: true,
  density: 'comfortable',
  videosPerSection: 12,
  randomization: 35,
  freshness: 'medium',
  loadMore: 'button',
  // Empty here on purpose: per-category defaults live in the category registry so
  // adding a category never requires touching persisted settings.
  categories: {},
  customTopics: [],
  includeChannels: [],
  excludeChannels: [],
  hideShorts: true,
  hideLivestreams: false,
  minDurationSec: 0,
  maxDurationSec: 0,
  hideClickbait: false,
  regionCode: 'US',
  resampleSalt: 1,
  subscriptionsEnabled: false,
  maxSubscriptionChannels: 25,
};

function sanitizeStringList(value: unknown, max = 200): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= max) break;
  }
  return result;
}

/** Coerces arbitrary persisted data into a complete, valid Settings object. */
export function mergeSettings(raw: unknown): Settings {
  const partial =
    raw && typeof raw === 'object' ? (raw as Partial<Settings>) : ({} as Partial<Settings>);

  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...partial,
    categories: { ...DEFAULT_SETTINGS.categories, ...(partial.categories ?? {}) },
    customTopics: sanitizeStringList(partial.customTopics, 50),
    includeChannels: sanitizeStringList(partial.includeChannels, 100),
    excludeChannels: sanitizeStringList(partial.excludeChannels, 100),
    version: SETTINGS_VERSION,
  };

  merged.videosPerSection = clampNumber(Math.round(Number(merged.videosPerSection)), 4, 30);
  merged.randomization = clampNumber(Math.round(Number(merged.randomization)), 0, 100);
  merged.maxSubscriptionChannels = clampNumber(
    Math.round(Number(merged.maxSubscriptionChannels)),
    5,
    50,
  );
  merged.minDurationSec = Math.max(0, Math.round(Number(merged.minDurationSec)) || 0);
  merged.maxDurationSec = Math.max(0, Math.round(Number(merged.maxDurationSec)) || 0);
  merged.resampleSalt = Math.max(1, Math.round(Number(merged.resampleSalt)) || 1);
  merged.enabled = Boolean(merged.enabled);
  merged.hideShorts = Boolean(merged.hideShorts);
  merged.hideLivestreams = Boolean(merged.hideLivestreams);
  merged.hideClickbait = Boolean(merged.hideClickbait);
  merged.subscriptionsEnabled = Boolean(merged.subscriptionsEnabled);
  if (typedRegion(merged.regionCode) === null) merged.regionCode = DEFAULT_SETTINGS.regionCode;
  if (!['comfortable', 'compact'].includes(merged.density)) merged.density = 'comfortable';
  if (!['low', 'medium', 'high'].includes(merged.freshness)) merged.freshness = 'medium';
  if (!['button', 'auto'].includes(merged.loadMore)) merged.loadMore = 'button';

  return merged;
}

function typedRegion(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : null;
}

export interface SettingsStore {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
  replace(settings: Settings): Promise<Settings>;
  getApiKey(): Promise<string>;
  setApiKey(apiKey: string): Promise<void>;
  hasApiKey(): Promise<boolean>;
  onChange(listener: (settings: Settings) => void): void;
}

export function createSettingsStore(store: KeyValueStore): SettingsStore {
  async function get(): Promise<Settings> {
    const raw = (await store.get([SETTINGS_KEY]))[SETTINGS_KEY];
    return mergeSettings(raw);
  }

  async function update(patch: Partial<Settings>): Promise<Settings> {
    const next = mergeSettings({ ...(await get()), ...patch });
    await store.set({ [SETTINGS_KEY]: next });
    return next;
  }

  return {
    get,
    update,
    async replace(settings: Settings): Promise<Settings> {
      const next = mergeSettings(settings);
      await store.set({ [SETTINGS_KEY]: next });
      return next;
    },
    async getApiKey(): Promise<string> {
      const raw = (await store.get([API_KEY_KEY]))[API_KEY_KEY];
      return typeof raw === 'string' ? raw.trim() : '';
    },
    async setApiKey(apiKey: string): Promise<void> {
      await store.set({ [API_KEY_KEY]: apiKey.trim() });
    },
    async hasApiKey(): Promise<boolean> {
      return (await this.getApiKey()).length > 0;
    },
    onChange(listener: (settings: Settings) => void): void {
      const chromeApi = (globalThis as { chrome?: typeof chrome }).chrome;
      if (!chromeApi?.storage?.onChanged) return;
      chromeApi.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || !changes[SETTINGS_KEY]) return;
        listener(mergeSettings(changes[SETTINGS_KEY].newValue));
      });
    },
  };
}

let sharedStore: SettingsStore | null = null;

/** Lazily-created store bound to `chrome.storage.local`. */
export function getSettingsStore(): SettingsStore {
  if (!sharedStore) {
    const kv = chromeKeyValueStore();
    if (!kv) throw new Error('chrome.storage.local is not available in this context');
    sharedStore = createSettingsStore(kv);
  }
  return sharedStore;
}
