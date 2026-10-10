import type { VideoCandidate } from '../../shared/types';

export interface DiversityOptions {
  /** Hard maximum items from a single channel within a section. */
  maxPerChannel: number;
  /** Optional hard ceiling for any one category/source within a section. */
  maxPerCategory?: number;
}

/**
 * Caps repetition in ranked order. Both limits are hard: if a section ends up
 * short because one channel dominated, that is the intended trade-off (source
 * diversity over quantity). Order is preserved.
 */
export function diversify(videos: VideoCandidate[], options: DiversityOptions): VideoCandidate[] {
  const maxPerChannel = Math.max(1, options.maxPerChannel);
  const maxPerCategory = options.maxPerCategory ?? Number.MAX_SAFE_INTEGER;

  const channelCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const selected: VideoCandidate[] = [];

  for (const video of videos) {
    const channel = video.channelId || video.channelTitle;
    const category = video.categoryId ?? video.sourceId;
    const channelCount = channelCounts.get(channel) ?? 0;
    const categoryCount = categoryCounts.get(category) ?? 0;
    if (channelCount >= maxPerChannel || categoryCount >= maxPerCategory) continue;

    channelCounts.set(channel, channelCount + 1);
    categoryCounts.set(category, categoryCount + 1);
    selected.push(video);
  }

  return selected;
}
