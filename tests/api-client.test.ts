import { describe, expect, it, vi } from 'vitest';
import { createTtlCache } from '../src/api/cache';
import type { QuotaTracker } from '../src/api/QuotaTracker';
import { createYouTubeApiClient } from '../src/api/YouTubeApiClient';
import { FeedError } from '../src/shared/errors';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

type QuotaStub = QuotaTracker & { added: Array<[number, number]> };

function makeQuota(searchAvailable = true): QuotaStub {
  const added: Array<[number, number]> = [];
  return {
    added,
    read: async () => ({ date: '2026-06-01', units: 0, searchCalls: 0 }),
    add: async (units, searchCalls) => {
      added.push([units, searchCalls]);
      return { date: '2026-06-01', units, searchCalls };
    },
    canSpendSearch: async () => searchAvailable,
    isUnitBudgetLow: async () => false,
  };
}

function makeClient(options: {
  fetchMock: ReturnType<typeof vi.fn>;
  quota?: QuotaStub;
  apiKey?: string;
}) {
  return createYouTubeApiClient({
    getApiKey: async () => options.apiKey ?? 'API_KEY',
    quota: options.quota ?? makeQuota(),
    cache: createTtlCache(),
    fetchImpl: options.fetchMock as unknown as typeof fetch,
  });
}

describe('YouTubeApiClient', () => {
  it('returns parsed items and records quota units', async () => {
    const quota = makeQuota();
    const fetchMock = vi.fn(async () => jsonResponse({ items: [{ id: 'aaaaaaaaaa1' }] }));
    const client = makeClient({ fetchMock, quota });

    const response = await client.mostPopular({ regionCode: 'US' });
    expect(response.items).toHaveLength(1);
    expect(quota.added).toEqual([[1, 0]]);
  });

  it('fails fast without an API key', async () => {
    const fetchMock = vi.fn();
    const client = makeClient({ fetchMock, apiKey: '' });
    await expect(client.mostPopular({ regionCode: 'US' })).rejects.toMatchObject({
      code: 'NO_API_KEY',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 403 quotaExceeded to QUOTA_EXCEEDED', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { errors: [{ reason: 'quotaExceeded' }] } }, 403),
    );
    const client = makeClient({ fetchMock });
    await expect(client.mostPopular({ regionCode: 'US' })).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });
  });

  it('maps 401 to AUTH_REQUIRED', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: {} }, 401));
    const client = makeClient({ fetchMock });
    await expect(client.mostPopular({ regionCode: 'US' })).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('maps a thrown fetch to NETWORK', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    const client = makeClient({ fetchMock });
    const error = await client.mostPopular({ regionCode: 'US' }).catch((caught) => caught);
    expect(error).toBeInstanceOf(FeedError);
    expect((error as FeedError).code).toBe('NETWORK');
    expect((error as FeedError).retryable).toBe(true);
  });

  it('maps malformed JSON to INVALID_RESPONSE', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('bad json');
          },
        }) as unknown as Response,
    );
    const client = makeClient({ fetchMock });
    await expect(client.mostPopular({ regionCode: 'US' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('refuses search calls once the daily bucket is exhausted', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: [] }));
    const client = makeClient({ fetchMock, quota: makeQuota(false) });
    await expect(client.searchVideos({ q: 'programming', regionCode: 'US' })).rejects.toMatchObject(
      { code: 'QUOTA_EXCEEDED' },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts search calls against the search bucket', async () => {
    const quota = makeQuota();
    const fetchMock = vi.fn(async () => jsonResponse({ items: [] }));
    const client = makeClient({ fetchMock, quota });
    await client.searchVideos({ q: 'programming', regionCode: 'US' });
    expect(quota.added).toEqual([[1, 1]]);
  });

  it('serves repeat requests from the cache', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: [] }));
    const client = createYouTubeApiClient({
      getApiKey: async () => 'API_KEY',
      quota: makeQuota(),
      cache: createTtlCache(),
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.mostPopular({ regionCode: 'US' });
    await client.mostPopular({ regionCode: 'US' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
