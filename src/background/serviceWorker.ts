import { createTtlCache, type TtlCache } from '../api/cache';
import { createQuotaTracker, type QuotaTracker } from '../api/QuotaTracker';
import { createYouTubeApiClient, type YouTubeApiClient } from '../api/YouTubeApiClient';
import { getAccessToken, isSubscriptionsConnected } from '../auth/GoogleAuth';
import { chromeKeyValueStore } from '../storage/keyValue';
import { createSettingsStore, type SettingsStore } from '../storage/SettingsStore';
import { FeedError, toFeedError } from '../shared/errors';
import type { Feed, Settings, Status } from '../shared/types';
import { buildFeed } from './feed/FeedService';
import type { RequestMessage, ResponseMessage } from './messaging/protocol';

interface Deps {
  settings: SettingsStore;
  quota: QuotaTracker;
  api: YouTubeApiClient;
}

const cache: TtlCache = createTtlCache();
let deps: Deps | null = null;

function ensureDeps(): Deps {
  if (!deps) {
    const store = chromeKeyValueStore();
    if (!store) throw new Error('chrome.storage.local is unavailable');
    const settings = createSettingsStore(store);
    const quota = createQuotaTracker(store);
    const api = createYouTubeApiClient({
      getApiKey: () => settings.getApiKey(),
      quota,
      cache,
    });
    deps = { settings, quota, api };
  }
  return deps;
}

async function status(): Promise<Status> {
  const { settings, quota } = ensureDeps();
  const [current, hasApiKey, subscriptionsConnected, usage] = await Promise.all([
    settings.get(),
    settings.hasApiKey(),
    isSubscriptionsConnected(),
    quota.read(),
  ]);
  return { enabled: current.enabled, hasApiKey, subscriptionsConnected, quota: usage };
}

async function loadFeed(force: boolean): Promise<Feed> {
  const { settings, api } = ensureDeps();
  if (force) cache.clear();

  const current = await settings.get();
  if (!(await settings.hasApiKey())) {
    throw new FeedError('NO_API_KEY', 'No YouTube Data API key has been configured.');
  }

  return buildFeed({
    context: { api, settings: current, nowMs: Date.now() },
    getAccessToken: (interactive) => getAccessToken(interactive),
  });
}

async function handle(message: RequestMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_FEED':
      return loadFeed(Boolean(message.payload?.force));
    case 'GET_STATUS':
      return status();
    case 'GET_SETTINGS':
      return ensureDeps().settings.get();
    case 'UPDATE_SETTINGS':
      return ensureDeps().settings.update((message.payload ?? {}) as Partial<Settings>);
    case 'RESHUFFLE': {
      const { settings } = ensureDeps();
      await settings.update({ resampleSalt: Date.now() });
      cache.clear();
      return status();
    }
    case 'OPEN_OPTIONS':
      await chrome.runtime.openOptionsPage();
      return true;
    case 'SET_API_KEY':
      await ensureDeps().settings.setApiKey(message.payload.apiKey ?? '');
      cache.clear();
      return status();
    default:
      throw new FeedError('UNKNOWN', 'Unknown message type.');
  }
}

chrome.runtime.onMessage.addListener(
  (message: RequestMessage, _sender, sendResponse: (response: ResponseMessage) => void) => {
    handle(message)
      .then((data) => sendResponse({ ok: true, data } as ResponseMessage))
      .catch((error) => {
        const feedError = toFeedError(error);
        sendResponse({
          ok: false,
          error: { code: feedError.code, message: feedError.message },
        } as ResponseMessage);
      });
    // Keep the message channel open for the async response.
    return true;
  },
);

// Warm the dependency graph so the first feed request is not delayed by setup.
try {
  ensureDeps();
} catch {
  // Storage may not be ready on a cold start; handlers retry lazily.
}
