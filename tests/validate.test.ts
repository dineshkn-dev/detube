import { describe, expect, it } from 'vitest';
import {
  channelMatches,
  channelUrl,
  isValidChannelId,
  isValidVideoId,
  normalizeHandle,
  thumbnailUrl,
  watchUrl,
} from '../src/shared/validate';

describe('video id validation', () => {
  it('accepts 11-character ids', () => {
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('a-b_c123456')).toBe(true);
  });

  it('rejects malformed ids', () => {
    expect(isValidVideoId('short')).toBe(false);
    expect(isValidVideoId('way-too-long-video-id')).toBe(false);
    expect(isValidVideoId('bad chars!!')).toBe(false);
    expect(isValidVideoId(undefined)).toBe(false);
  });
});

describe('url construction', () => {
  it('derives thumbnails from a validated id', () => {
    expect(thumbnailUrl('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    expect(thumbnailUrl('dQw4w9WgXcQ', 'hqdefault')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
    expect(thumbnailUrl('bad')).toBe('');
  });

  it('builds watch and channel urls only for valid ids', () => {
    expect(watchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(watchUrl('bad')).toBeNull();
    expect(channelUrl('UCabcdefghijklmnopqrstuv')).toBe(
      'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
    );
    expect(channelUrl('nope')).toBeNull();
  });

  it('never forwards arbitrary URLs', () => {
    // A malicious "id" cannot escape the watch-url template.
    const evil = 'https://evil.example/../x';
    expect(watchUrl(evil)).toBeNull();
    expect(thumbnailUrl(evil)).toBe('');
  });
});

describe('channel matching', () => {
  const channel = { channelId: 'UCabcdefghijklmnopqrstuv', channelTitle: 'Traversy Media' };

  it('matches by channel id', () => {
    expect(channelMatches('UCabcdefghijklmnopqrstuv', channel)).toBe(true);
  });

  it('matches by handle/title case-insensitively', () => {
    expect(channelMatches('@traversymedia', channel)).toBe(true);
    expect(channelMatches('Traversy Media', channel)).toBe(true);
    expect(channelMatches('  trav ersy ', channel)).toBe(false);
  });

  it('returns false for empty references', () => {
    expect(channelMatches('   ', channel)).toBe(false);
  });
});

describe('channel id validation', () => {
  it('requires UC + 22 characters', () => {
    expect(isValidChannelId('UCabcdefghijklmnopqrstuv')).toBe(true);
    expect(isValidChannelId('UCshort')).toBe(false);
    expect(isValidChannelId('XXabcdefghijklmnopqrstuv')).toBe(false);
  });
});

describe('normalizeHandle', () => {
  it('strips @ and lowercases', () => {
    expect(normalizeHandle('  @MrBeast ')).toBe('mrbeast');
  });
});
