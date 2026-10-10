import type { FeedCategory, VideoCandidate } from '../../shared/types';
import { applyEnrichment } from '../../api/parsers';
import { parseSearchList, parseVideoList, type SourceContext } from './parse';

const SEARCH_WINDOW_DAYS = 7;

/**
 * Keyword/topic discovery via `search.list`. This is the only place we spend
 * from the scarce 100-calls/day search bucket, so results are cached hard and
 * the call simply fails over (throwing) when the bucket is exhausted.
 *
 * Used for categories YouTube has no chart for (Programming) and for user
 * custom topics.
 */
export async function fetchSearchTopic(
  category: FeedCategory,
  context: SourceContext,
): Promise<VideoCandidate[]> {
  const query = category.query ?? category.label;
  if (!query.trim()) return [];

  const publishedAfter = new Date(context.nowMs - SEARCH_WINDOW_DAYS * 86_400_000).toISOString();
  const candidateContext = {
    sourceId: category.id,
    categoryLabel: category.label,
    matchedTopic: true,
  };

  const response = await context.api.searchVideos({
    q: query,
    regionCode: context.settings.regionCode,
    publishedAfter,
    order: 'date',
    // Exclude sub-4-minute results only when the user wants Shorts hidden.
    videoDuration: context.settings.hideShorts ? 'medium' : undefined,
    maxResults: 25,
  });

  let candidates = parseSearchList(response.items, candidateContext);
  if (candidates.length === 0) return [];

  const ids = [...new Set(candidates.map((candidate) => candidate.videoId))];
  const enriched: VideoCandidate[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    try {
      const details = await context.api.videosByIds(batch);
      enriched.push(...parseVideoList(details.items, candidateContext));
    } catch {
      // Best-effort enrichment; search snippets still render without stats.
    }
  }

  candidates = applyEnrichment(candidates, enriched);
  return candidates;
}
