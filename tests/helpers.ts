import type { VideoCandidate } from '../src/shared/types';

/** Deterministic 11-character video id. */
export function videoId(index: number): string {
  return `${String(index)}`.padStart(11, 'a');
}

/** Valid channel id (UC + 22 chars). */
export function channelId(letter: string): string {
  return `UC${letter.repeat(22)}`;
}

export function candidate(
  overrides: Partial<VideoCandidate> & { videoId: string },
): VideoCandidate {
  return {
    title: `Video ${overrides.videoId}`,
    channelId: channelId('a'),
    channelTitle: 'Alpha Channel',
    publishedAt: '2026-01-01T00:00:00.000Z',
    durationSec: 600,
    viewCount: 1_000,
    categoryId: '28',
    isLive: false,
    isUpcoming: false,
    thumbnailUrl: `https://i.ytimg.com/vi/${overrides.videoId}/mqdefault.jpg`,
    sourceId: 'technology',
    categoryLabel: 'Technology',
    matchedTopic: true,
    ...overrides,
  };
}

export function makeCandidates(
  count: number,
  overrides: (index: number) => Partial<VideoCandidate> = () => ({}),
): VideoCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    candidate({ videoId: videoId(index + 1), ...overrides(index) }),
  );
}
