import { describe, expect, it } from 'vitest';
import type { YouTubeApiClient } from '../src/api/YouTubeApiClient';
import { buildFeed } from '../src/background/feed/FeedService';
import { FeedError } from '../src/shared/errors';
import { mergeSettings } from '../src/storage/SettingsStore';
import { channelId, videoId } from './helpers';

function rawVideo(id: string, categoryId: string, channelLetter = 'a') {
  return {
    id,
    snippet: {
      title: `Title ${id}`,
      channelId: channelId(channelLetter),
      channelTitle: `Channel ${channelLetter}`,
      publishedAt: '2026-01-01T00:00:00Z',
      categoryId,
      liveBroadcastContent: 'none',
    },
    statistics: { viewCount: '1000' },
    contentDetails: { duration: 'PT10M' },
  };
}

function rawSearch(id: string) {
  return {
    id: { kind: 'youtube#video', videoId: id },
    snippet: {
      title: `Search ${id}`,
      channelId: channelId('b'),
      channelTitle: 'Beta',
      publishedAt: '2026-01-01T00:00:00Z',
    },
  };
}

function makeApi(overrides: Partial<YouTubeApiClient> = {}): YouTubeApiClient {
  return {
    mostPopular: async ({ videoCategoryId }) => ({
      items:
        videoCategoryId === '28'
          ? [rawVideo(videoId(1), '28'), rawVideo(videoId(2), '28')]
          : [rawVideo(videoId(2), '28'), rawVideo(videoId(3), '24')],
    }),
    videosByIds: async () => ({ items: [] }),
    channelsByIds: async () => ({ items: [] }),
    channelByHandle: async () => ({ items: [] }),
    uploadsPlaylistItems: async () => ({ items: [] }),
    searchVideos: async () => ({ items: [rawSearch(videoId(9))] }),
    subscriptions: async () => ({ items: [] }),
    ...overrides,
  };
}

const settings = mergeSettings({
  hideShorts: false,
  categories: {
    gaming: false,
    music: false,
    news: false,
    sports: false,
    education: false,
    film: false,
  },
});

const NOW = Date.parse('2026-06-01T00:00:00Z');

describe('buildFeed', () => {
  it('builds sections from chart and search sources', async () => {
    const feed = await buildFeed({ context: { api: makeApi(), settings, nowMs: NOW } });
    const ids = feed.sections.map((section) => section.id);
    expect(ids).toContain('trending');
    expect(ids).toContain('technology');
    expect(ids).toContain('programming');
    expect(feed.generatedAt).toBe(NOW);
  });

  it('de-duplicates a video that appears in more than one section', async () => {
    const feed = await buildFeed({ context: { api: makeApi(), settings, nowMs: NOW } });
    const all = feed.sections.flatMap((section) => section.videos.map((video) => video.videoId));
    expect(all.filter((id) => id === videoId(2))).toHaveLength(1);
  });

  it('degrades gracefully when a single source fails', async () => {
    const api = makeApi({
      searchVideos: async () => {
        throw new FeedError('QUOTA_EXCEEDED', 'search bucket empty');
      },
    });
    const feed = await buildFeed({ context: { api, settings, nowMs: NOW } });
    expect(feed.sections.some((section) => section.id === 'trending')).toBe(true);
    expect(feed.notices.some((notice) => notice.code === 'QUOTA_EXCEEDED')).toBe(true);
  });

  it('propagates a fatal NO_API_KEY error', async () => {
    const api = makeApi({
      mostPopular: async () => {
        throw new FeedError('NO_API_KEY', 'no key');
      },
    });
    await expect(buildFeed({ context: { api, settings, nowMs: NOW } })).rejects.toThrow(/no key/);
  });

  it('truncates each section to videosPerSection', async () => {
    const letters = 'abcdefgh';
    const many = (categoryId: string) =>
      Array.from({ length: 8 }, (_, index) =>
        rawVideo(videoId(index + 1), categoryId, letters[index]),
      );
    const api = makeApi({
      mostPopular: async ({ videoCategoryId }) => ({ items: many(videoCategoryId ?? '0') }),
    });
    const limited = mergeSettings({ ...settings, videosPerSection: 4 });
    const feed = await buildFeed({ context: { api, settings: limited, nowMs: NOW } });

    expect(feed.sections.length).toBeGreaterThan(0);
    for (const section of feed.sections) expect(section.videos.length).toBeLessThanOrEqual(4);
    expect(feed.sections.some((section) => section.videos.length === 4)).toBe(true);
  });

  it('is deterministic for a fixed seed and clock', async () => {
    const first = await buildFeed({ context: { api: makeApi(), settings, nowMs: NOW } });
    const second = await buildFeed({ context: { api: makeApi(), settings, nowMs: NOW } });
    expect(first.sections.map((section) => section.videos.map((video) => video.videoId))).toEqual(
      second.sections.map((section) => section.videos.map((video) => video.videoId)),
    );
  });
});
