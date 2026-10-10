import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  dedupe,
  isProbablyShort,
  looksLikeClickbait,
  shouldDrop,
} from '../src/background/feed/FeedFilter';
import { mergeSettings } from '../src/storage/SettingsStore';
import { candidate, channelId, videoId } from './helpers';

const settings = mergeSettings({});

describe('dedupe', () => {
  it('keeps the first occurrence of each video', () => {
    const input = [
      candidate({ videoId: videoId(1), title: 'first' }),
      candidate({ videoId: videoId(2) }),
      candidate({ videoId: videoId(1), title: 'duplicate' }),
    ];
    const output = dedupe(input);
    expect(output.map((video) => video.videoId)).toEqual([videoId(1), videoId(2)]);
    expect(output[0]?.title).toBe('first');
  });
});

describe('isProbablyShort', () => {
  it('flags videos at or under 60 seconds', () => {
    expect(isProbablyShort(candidate({ videoId: videoId(1), durationSec: 45 }))).toBe(true);
    expect(isProbablyShort(candidate({ videoId: videoId(2), durationSec: 60 }))).toBe(true);
    expect(isProbablyShort(candidate({ videoId: videoId(3), durationSec: 61 }))).toBe(false);
    expect(isProbablyShort(candidate({ videoId: videoId(4), durationSec: null }))).toBe(false);
  });
});

describe('looksLikeClickbait', () => {
  it('matches obvious heuristics', () => {
    expect(looksLikeClickbait("You won't believe what happened")).toBe(true);
    expect(looksLikeClickbait('OMG THIS IS INSANE')).toBe(true);
    expect(looksLikeClickbait('A calm documentary about rivers')).toBe(false);
  });
});

describe('shouldDrop', () => {
  it('drops Shorts when hideShorts is on', () => {
    expect(shouldDrop(candidate({ videoId: videoId(1), durationSec: 30 }), settings)).toBe(true);
  });

  it('keeps Shorts when hideShorts is off', () => {
    const loose = mergeSettings({ hideShorts: false });
    expect(shouldDrop(candidate({ videoId: videoId(1), durationSec: 30 }), loose)).toBe(false);
  });

  it('drops livestreams only when configured', () => {
    const live = candidate({ videoId: videoId(1), isLive: true });
    expect(shouldDrop(live, settings)).toBe(false);
    expect(shouldDrop(live, mergeSettings({ hideLivestreams: true }))).toBe(true);
  });

  it('honours duration bounds', () => {
    const bounded = mergeSettings({
      minDurationSec: 120,
      maxDurationSec: 1_800,
      hideShorts: false,
    });
    expect(shouldDrop(candidate({ videoId: videoId(1), durationSec: 60 }), bounded)).toBe(true);
    expect(shouldDrop(candidate({ videoId: videoId(2), durationSec: 3_600 }), bounded)).toBe(true);
    expect(shouldDrop(candidate({ videoId: videoId(3), durationSec: 600 }), bounded)).toBe(false);
  });

  it('honours excluded channels by id and handle', () => {
    const video = candidate({
      videoId: videoId(1),
      channelId: channelId('z'),
      channelTitle: 'Zeta',
    });
    expect(shouldDrop(video, mergeSettings({ excludeChannels: [channelId('z')] }))).toBe(true);
    expect(shouldDrop(video, mergeSettings({ excludeChannels: ['@zeta'] }))).toBe(true);
    expect(shouldDrop(video, mergeSettings({ excludeChannels: ['@other'] }))).toBe(false);
  });

  it('does not drop unknown-duration videos for duration bounds', () => {
    const bounded = mergeSettings({ minDurationSec: 120, hideShorts: false });
    expect(shouldDrop(candidate({ videoId: videoId(1), durationSec: null }), bounded)).toBe(false);
  });
});

describe('applyFilters', () => {
  it('counts what it removed', () => {
    const input = [
      candidate({ videoId: videoId(1), durationSec: 30 }),
      candidate({ videoId: videoId(2), durationSec: 600 }),
      candidate({ videoId: videoId(3), isLive: true }),
    ];
    const result = applyFilters(input, mergeSettings({ hideLivestreams: true }));
    expect(result.kept.map((video) => video.videoId)).toEqual([videoId(2)]);
    expect(result.removed).toBe(2);
  });
});
