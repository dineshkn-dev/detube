import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, rankVideos } from '../src/background/feed/FeedRanker';
import { computeScore, FRESHNESS_TAU_HOURS } from '../src/background/feed/scoring';
import { keyedJitter } from '../src/background/feed/random';
import { makeCandidates } from './helpers';

const NOW = Date.parse('2026-06-01T00:00:00.000Z');

function sample() {
  return makeCandidates(20, (index) => ({
    viewCount: (index + 1) * 1_000,
    publishedAt: new Date(NOW - index * 3_600_000).toISOString(),
  }));
}

describe('rankVideos', () => {
  it('is deterministic for the same input and options', () => {
    const options = { nowMs: NOW, randomization: 40, seed: 1234, freshness: 'medium' as const };
    const first = rankVideos(sample(), options).map((video) => video.videoId);
    const second = rankVideos(sample(), options).map((video) => video.videoId);
    expect(first).toEqual(second);
  });

  it('is independent of input order', () => {
    const videos = sample();
    const options = { nowMs: NOW, randomization: 70, seed: 99, freshness: 'medium' as const };
    const forward = rankVideos(videos, options).map((video) => video.videoId);
    const reversed = rankVideos([...videos].reverse(), options).map((video) => video.videoId);
    expect(forward).toEqual(reversed);
  });

  it('produces strict score order when randomization is zero', () => {
    const videos = sample();
    const options = { nowMs: NOW, randomization: 0, seed: 7, freshness: 'medium' as const };
    const actual = rankVideos(videos, options).map((video) => video.videoId);

    const maxViews = Math.max(1, ...videos.map((video) => video.viewCount ?? 0));
    const context = {
      nowMs: NOW,
      maxViews,
      tauHours: FRESHNESS_TAU_HOURS.medium,
      weights: DEFAULT_WEIGHTS,
      jitterFor: (video: { videoId: string }) => keyedJitter(video.videoId, options.seed, 0.15),
    };
    const expected = [...videos]
      .map((video) => ({ video, score: computeScore(video, context) }))
      .sort((a, b) => b.score - a.score || (a.video.videoId < b.video.videoId ? -1 : 1))
      .map((entry) => entry.video.videoId);

    expect(actual).toEqual(expected);
  });

  it('changes ordering when randomization is applied (same set)', () => {
    const videos = sample();
    const strict = rankVideos(videos, {
      nowMs: NOW,
      randomization: 0,
      seed: 5,
      freshness: 'medium',
    });
    const shuffled = rankVideos(videos, {
      nowMs: NOW,
      randomization: 90,
      seed: 5,
      freshness: 'medium',
    });
    expect(new Set(shuffled.map((video) => video.videoId))).toEqual(
      new Set(strict.map((video) => video.videoId)),
    );
    expect(shuffled.map((video) => video.videoId)).not.toEqual(
      strict.map((video) => video.videoId),
    );
  });

  it('handles empty and single-item inputs', () => {
    expect(rankVideos([], { nowMs: NOW, randomization: 50, seed: 1, freshness: 'low' })).toEqual(
      [],
    );
    const one = makeCandidates(1);
    expect(
      rankVideos(one, { nowMs: NOW, randomization: 50, seed: 1, freshness: 'low' }),
    ).toHaveLength(1);
  });
});
