import type { Freshness, VideoCandidate } from '../../shared/types';

export interface ScoreWeights {
  freshness: number;
  popularity: number;
  relevance: number;
}

/** Decay constant (hours) per freshness preference — larger τ = flatter decay. */
export const FRESHNESS_TAU_HOURS: Record<Freshness, number> = {
  low: 24 * 14,
  medium: 24 * 4,
  high: 24 * 1.5,
};

const UNKNOWN_AGE_SCORE = 0.3;

export function freshnessScore(publishedAt: string, nowMs: number, tauHours: number): number {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return UNKNOWN_AGE_SCORE;
  const ageHours = Math.max(0, (nowMs - timestamp) / 3_600_000);
  return Math.exp(-ageHours / Math.max(1, tauHours));
}

/** Log-scaled popularity normalised against the most-viewed item in the set. */
export function popularityScore(viewCount: number | null, maxViews: number): number {
  if (viewCount === null || viewCount <= 0) return 0;
  const denominator = Math.log10(1 + Math.max(1, maxViews));
  if (denominator <= 0) return 0;
  return Math.min(1, Math.log10(1 + viewCount) / denominator);
}

export function relevanceScore(candidate: VideoCandidate): number {
  return candidate.matchedTopic ? 1 : 0.6;
}

export interface ScoreContext {
  nowMs: number;
  maxViews: number;
  tauHours: number;
  weights: ScoreWeights;
  jitterFor: (candidate: VideoCandidate) => number;
}

export function computeScore(candidate: VideoCandidate, context: ScoreContext): number {
  return (
    context.weights.freshness *
      freshnessScore(candidate.publishedAt, context.nowMs, context.tauHours) +
    context.weights.popularity * popularityScore(candidate.viewCount, context.maxViews) +
    context.weights.relevance * relevanceScore(candidate) +
    context.jitterFor(candidate)
  );
}
