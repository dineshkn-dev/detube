import type { Settings, VideoCandidate } from '../../shared/types';
import { channelMatches } from '../../shared/validate';

/** Duration ceiling for the Shorts heuristic. */
export const SHORTS_MAX_SECONDS = 60;

export interface FilterResult {
  kept: VideoCandidate[];
  removed: number;
}

/** Removes duplicate videos, keeping the first occurrence (order-sensitive). */
export function dedupe(videos: VideoCandidate[]): VideoCandidate[] {
  const seen = new Set<string>();
  const output: VideoCandidate[] = [];
  for (const video of videos) {
    if (seen.has(video.videoId)) continue;
    seen.add(video.videoId);
    output.push(video);
  }
  return output;
}

export function dedupeSections<T extends { videos: VideoCandidate[] }>(sections: T[]): T[] {
  const seen = new Set<string>();
  return sections.map((section) => ({
    ...section,
    videos: section.videos.filter((video) => {
      if (seen.has(video.videoId)) return false;
      seen.add(video.videoId);
      return true;
    }),
  }));
}

/**
 * Heuristic only — YouTube exposes no Shorts flag, so this can be wrong in both
 * directions (long Shorts, short non-Shorts). Documented, not claimed perfect.
 */
export function isProbablyShort(video: VideoCandidate): boolean {
  return (
    video.durationSec !== null && video.durationSec > 0 && video.durationSec <= SHORTS_MAX_SECONDS
  );
}

const CLICKBAIT_PATTERNS: RegExp[] = [
  /\b(you won'?t believe|shocking|gone wrong|must see|mind ?blowing|insane)\b/i,
  /!{2,}/,
  /\b[A-Z]{6,}\b/,
];

/** Heuristic only; off by default and never presented as accurate. */
export function looksLikeClickbait(title: string): boolean {
  return CLICKBAIT_PATTERNS.some((pattern) => pattern.test(title));
}

export function shouldDrop(video: VideoCandidate, settings: Settings): boolean {
  if (settings.hideShorts && isProbablyShort(video)) return true;
  if (settings.hideLivestreams && (video.isLive || video.isUpcoming)) return true;

  if (video.durationSec !== null) {
    if (settings.minDurationSec > 0 && video.durationSec < settings.minDurationSec) return true;
    if (settings.maxDurationSec > 0 && video.durationSec > settings.maxDurationSec) return true;
  }

  if (settings.excludeChannels.some((reference) => channelMatches(reference, video))) return true;
  // Note: includeChannels is a *source* (a dedicated section), not a global filter.
  if (settings.hideClickbait && looksLikeClickbait(video.title)) return true;

  return false;
}

export function applyFilters(videos: VideoCandidate[], settings: Settings): FilterResult {
  let removed = 0;
  const kept = videos.filter((video) => {
    if (shouldDrop(video, settings)) {
      removed += 1;
      return false;
    }
    return true;
  });
  return { kept, removed };
}
