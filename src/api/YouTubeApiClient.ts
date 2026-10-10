import { FeedError } from '../shared/errors';
import { cached, type TtlCache } from './cache';
import type { QuotaTracker } from './QuotaTracker';
import type { RawPlaylistItemResource, RawSearchResource, RawVideoResource } from './parsers';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

export const TTL = {
  trending: 15 * 60_000,
  category: 15 * 60_000,
  channel: 30 * 60_000,
  search: 60 * 60_000,
  subscriptions: 60 * 60_000,
} as const;

export interface ApiClientDeps {
  getApiKey: () => Promise<string>;
  quota: QuotaTracker;
  cache: TtlCache;
  fetchImpl?: typeof fetch;
}

interface RequestOptions {
  /** Quota units the call costs. */
  units?: number;
  /** Counts against the separate 100/day search bucket. */
  search?: boolean;
  /** Cache TTL in ms; 0 disables caching. */
  ttlMs?: number;
  /** OAuth bearer token. When present the API key is omitted. */
  accessToken?: string;
  /** Extra headers. */
  headers?: Record<string, string>;
}

export interface ListResponse<T> {
  items?: T[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number; resultsPerPage?: number };
}

export interface YouTubeApiClient {
  mostPopular(params: {
    regionCode: string;
    videoCategoryId?: string;
    maxResults?: number;
  }): Promise<ListResponse<RawVideoResource>>;
  videosByIds(ids: string[]): Promise<ListResponse<RawVideoResource>>;
  channelsByIds(ids: string[]): Promise<ListResponse<unknown>>;
  channelByHandle(handle: string): Promise<ListResponse<unknown>>;
  uploadsPlaylistItems(
    playlistId: string,
    maxResults?: number,
  ): Promise<ListResponse<RawPlaylistItemResource>>;
  searchVideos(params: {
    q: string;
    regionCode: string;
    publishedAfter?: string;
    maxResults?: number;
    order?: 'date' | 'viewCount' | 'relevance';
    videoDuration?: 'short' | 'medium' | 'long';
  }): Promise<ListResponse<RawSearchResource>>;
  subscriptions(accessToken: string, maxResults?: number): Promise<ListResponse<unknown>>;
}

const VIDEO_PARTS = 'snippet,statistics,contentDetails';

export function createYouTubeApiClient(deps: ApiClientDeps): YouTubeApiClient {
  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function request<T>(
    path: string,
    params: Record<string, string | number | undefined>,
    options: RequestOptions = {},
  ): Promise<T> {
    const search = options.search ?? false;
    if (search && !(await deps.quota.canSpendSearch())) {
      throw new FeedError(
        'QUOTA_EXCEEDED',
        'The daily YouTube search quota (100 calls) has been reached.',
        { retryable: false },
      );
    }

    let apiKey = '';
    if (!options.accessToken) {
      apiKey = await deps.getApiKey();
      if (!apiKey) {
        throw new FeedError('NO_API_KEY', 'No YouTube Data API key has been configured.');
      }
    }

    const url = new URL(`${API_BASE}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    if (apiKey) url.searchParams.set('key', apiKey);
    const cacheKey = url.toString();

    const ttlMs = options.ttlMs ?? 0;
    const load = async (): Promise<T> => {
      let response: Response;
      try {
        response = await doFetch(url.toString(), {
          method: 'GET',
          headers: options.accessToken
            ? { Authorization: `Bearer ${options.accessToken}`, ...options.headers }
            : options.headers,
        });
      } catch (error) {
        throw new FeedError('NETWORK', (error as Error)?.message ?? 'Network request failed', {
          retryable: true,
        });
      }

      if (!response.ok) throw await mapHttpError(response);
      await deps.quota.add(options.units ?? 1, search ? 1 : 0);

      try {
        return (await response.json()) as T;
      } catch {
        throw new FeedError('INVALID_RESPONSE', 'YouTube returned malformed JSON.');
      }
    };

    return ttlMs > 0 ? cached(deps.cache, cacheKey, ttlMs, load) : load();
  }

  return {
    mostPopular: ({ regionCode, videoCategoryId, maxResults = 50 }) =>
      request<ListResponse<RawVideoResource>>(
        'videos',
        {
          part: VIDEO_PARTS,
          chart: 'mostPopular',
          regionCode,
          videoCategoryId,
          maxResults: Math.min(50, Math.max(1, maxResults)),
        },
        { units: 1, ttlMs: videoCategoryId ? TTL.category : TTL.trending },
      ),

    videosByIds: (ids) =>
      request<ListResponse<RawVideoResource>>(
        'videos',
        { part: VIDEO_PARTS, id: ids.slice(0, 50).join(',') },
        { units: 1, ttlMs: TTL.channel },
      ),

    channelsByIds: (ids) =>
      request<ListResponse<unknown>>(
        'channels',
        { part: 'contentDetails,snippet', id: ids.slice(0, 50).join(',') },
        { units: 1, ttlMs: TTL.channel },
      ),

    channelByHandle: (handle) =>
      request<ListResponse<unknown>>(
        'channels',
        { part: 'contentDetails,snippet', forHandle: handle },
        { units: 1, ttlMs: TTL.channel },
      ),

    uploadsPlaylistItems: (playlistId, maxResults = 25) =>
      request<ListResponse<RawPlaylistItemResource>>(
        'playlistItems',
        {
          part: 'snippet,contentDetails',
          playlistId,
          maxResults: Math.min(50, Math.max(1, maxResults)),
        },
        { units: 1, ttlMs: TTL.channel },
      ),

    searchVideos: ({
      q,
      regionCode,
      publishedAfter,
      maxResults = 25,
      order = 'date',
      videoDuration,
    }) =>
      request<ListResponse<RawSearchResource>>(
        'search',
        {
          part: 'snippet',
          type: 'video',
          q,
          regionCode,
          publishedAfter,
          order,
          videoDuration,
          maxResults: Math.min(50, Math.max(1, maxResults)),
          safeSearch: 'moderate',
        },
        { units: 1, search: true, ttlMs: TTL.search },
      ),

    subscriptions: (accessToken, maxResults = 50) =>
      request<ListResponse<unknown>>(
        'subscriptions',
        {
          part: 'snippet',
          mine: 'true',
          order: 'alphabetical',
          maxResults: Math.min(50, maxResults),
        },
        { units: 1, accessToken, ttlMs: TTL.subscriptions },
      ),
  };
}

async function mapHttpError(response: Response): Promise<FeedError> {
  let reason = '';
  try {
    const body = (await response.json()) as { error?: { errors?: Array<{ reason?: string }> } };
    reason = body?.error?.errors?.[0]?.reason ?? '';
  } catch {
    // Response body was not JSON; fall back to the status code below.
  }

  if (response.status === 403 && (reason === 'quotaExceeded' || reason === 'rateLimitExceeded')) {
    return new FeedError('QUOTA_EXCEEDED', 'YouTube API quota exceeded.', { status: 403 });
  }
  if (response.status === 401 || response.status === 403) {
    return new FeedError(
      'AUTH_REQUIRED',
      `YouTube API rejected the request (${reason || response.status}).`,
      {
        status: response.status,
      },
    );
  }
  return new FeedError('HTTP', `YouTube API request failed with status ${response.status}.`, {
    status: response.status,
    retryable: response.status >= 500,
  });
}
