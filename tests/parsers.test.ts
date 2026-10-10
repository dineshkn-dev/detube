import { describe, expect, it } from 'vitest';
import {
  applyEnrichment,
  parsePlaylistItem,
  parseSearchResource,
  parseVideoResource,
} from '../src/api/parsers';
import { channelId, videoId } from './helpers';

const context = { sourceId: 'technology', categoryLabel: 'Technology', matchedTopic: true };
const id = videoId(1);

describe('parseVideoResource', () => {
  it('parses a full videos.list item', () => {
    const result = parseVideoResource(
      {
        id,
        snippet: {
          title: 'Hello',
          channelId: channelId('a'),
          channelTitle: 'Chan',
          publishedAt: '2026-01-01T00:00:00Z',
          categoryId: '28',
          liveBroadcastContent: 'none',
        },
        statistics: { viewCount: '1234' },
        contentDetails: { duration: 'PT1M30S' },
      },
      context,
    );
    expect(result).not.toBeNull();
    expect(result?.durationSec).toBe(90);
    expect(result?.viewCount).toBe(1234);
    expect(result?.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`);
    expect(result?.isLive).toBe(false);
    expect(result?.sourceId).toBe('technology');
  });

  it('rejects invalid ids, missing titles and null items', () => {
    expect(parseVideoResource({ id: 'bad', snippet: { title: 'x' } }, context)).toBeNull();
    expect(parseVideoResource({ id, snippet: {} }, context)).toBeNull();
    expect(parseVideoResource(null, context)).toBeNull();
  });

  it('tolerates a malformed duration and missing statistics', () => {
    const result = parseVideoResource(
      { id, snippet: { title: 'x' }, contentDetails: { duration: 'garbage' } },
      context,
    );
    expect(result?.durationSec).toBeNull();
    expect(result?.viewCount).toBeNull();
  });

  it('flags livestreams and upcoming broadcasts', () => {
    expect(
      parseVideoResource({ id, snippet: { title: 'x', liveBroadcastContent: 'live' } }, context)
        ?.isLive,
    ).toBe(true);
    expect(
      parseVideoResource({ id, snippet: { title: 'x', liveBroadcastContent: 'upcoming' } }, context)
        ?.isUpcoming,
    ).toBe(true);
  });
});

describe('parseSearchResource', () => {
  it('drops non-video resources', () => {
    expect(
      parseSearchResource(
        { id: { kind: 'youtube#channel', videoId: id }, snippet: { title: 'x' } },
        context,
      ),
    ).toBeNull();
  });

  it('parses video search results', () => {
    const result = parseSearchResource(
      {
        id: { kind: 'youtube#video', videoId: id },
        snippet: { title: 'Hello', channelId: channelId('b'), publishedAt: '2026-01-01T00:00:00Z' },
      },
      context,
    );
    expect(result?.videoId).toBe(id);
    expect(result?.durationSec).toBeNull();
  });
});

describe('parsePlaylistItem', () => {
  it('reads the video id from contentDetails and the publish date', () => {
    const result = parsePlaylistItem(
      {
        snippet: { title: 'Hello', resourceId: { videoId: id } },
        contentDetails: { videoId: id, videoPublishedAt: '2026-01-02T00:00:00Z' },
      },
      context,
    );
    expect(result?.videoId).toBe(id);
    expect(result?.publishedAt).toBe('2026-01-02T00:00:00Z');
  });

  it('returns null when no video id is present', () => {
    expect(parsePlaylistItem({ snippet: { title: 'x' } }, context)).toBeNull();
  });
});

describe('applyEnrichment', () => {
  it('merges stats and duration by video id', () => {
    const base = parseSearchResource(
      {
        id: { kind: 'youtube#video', videoId: id },
        snippet: { title: 'Hello', publishedAt: '2026-01-01T00:00:00Z' },
      },
      context,
    );
    const enriched = parseVideoResource(
      {
        id,
        snippet: { title: 'Hello' },
        statistics: { viewCount: '500' },
        contentDetails: { duration: 'PT5M' },
      },
      context,
    );
    const merged = applyEnrichment([base!], [enriched!]);
    expect(merged[0]?.viewCount).toBe(500);
    expect(merged[0]?.durationSec).toBe(300);
  });

  it('leaves candidates untouched when enrichment is missing', () => {
    const base = parseSearchResource(
      { id: { kind: 'youtube#video', videoId: id }, snippet: { title: 'Hello' } },
      context,
    );
    const merged = applyEnrichment([base!], []);
    expect(merged[0]?.durationSec).toBeNull();
  });
});
