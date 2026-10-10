import type { Freshness, VideoCandidate } from '../../shared/types';
import { clampNumber } from '../../shared/validate';
import { keyedJitter, mulberry32 } from './random';
import { computeScore, FRESHNESS_TAU_HOURS, type ScoreWeights } from './scoring';

export interface RankOptions {
  nowMs: number;
  /** 0–100. */
  randomization: number;
  seed: number;
  freshness: Freshness;
  weights?: Partial<ScoreWeights>;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  freshness: 0.45,
  popularity: 0.35,
  relevance: 0.2,
};

/**
 * Deterministic ranking: the output depends only on the *set* of candidates and
 * the options (not on input order), so it is safe to unit test and stable
 * across a day for a given seed.
 */
export function rankVideos(videos: VideoCandidate[], options: RankOptions): VideoCandidate[] {
  if (videos.length <= 1) return [...videos];

  const weights: ScoreWeights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const maxViews = Math.max(1, ...videos.map((video) => video.viewCount ?? 0));

  const context = {
    nowMs: options.nowMs,
    maxViews,
    tauHours: FRESHNESS_TAU_HOURS[options.freshness],
    weights,
    jitterFor: (candidate: VideoCandidate) => keyedJitter(candidate.videoId, options.seed, 0.15),
  };

  const scored = videos
    .map((video) => ({ video, score: computeScore(video, context) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.video.videoId < b.video.videoId ? -1 : a.video.videoId > b.video.videoId ? 1 : 0),
    );

  const level = clampNumber(options.randomization, 0, 100) / 100;
  if (level <= 0) return scored.map((entry) => entry.video);

  // Blend score order into a seeded shuffle by shuffling contiguous buckets whose
  // size grows with the randomization level. Score order is honoured at the top;
  // shock-rabbit-holing into a rigid ranking is deliberately avoided.
  const bucketSize = Math.max(2, Math.floor(scored.length * level * 0.5));
  const output: VideoCandidate[] = [];
  for (let start = 0; start < scored.length; start += bucketSize) {
    const bucket = scored.slice(start, start + bucketSize);
    const bucketRng = mulberry32((options.seed ^ Math.imul(start + 1, 2_654_435_761)) >>> 0);
    for (let index = bucket.length - 1; index > 0; index--) {
      const swap = Math.floor(bucketRng() * (index + 1));
      const temp = bucket[index]!;
      bucket[index] = bucket[swap]!;
      bucket[swap] = temp;
    }
    output.push(...bucket.map((entry) => entry.video));
  }
  return output;
}
