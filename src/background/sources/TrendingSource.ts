import type { VideoCandidate } from '../../shared/types';
import { parseVideoList, type SourceContext } from './parse';

/**
 * The overall "most popular" chart for a region. This is YouTube's general,
 * region-level trending list — not personalized to the viewer.
 */
export async function fetchTrending(context: SourceContext): Promise<VideoCandidate[]> {
  const response = await context.api.mostPopular({
    regionCode: context.settings.regionCode,
    maxResults: 50,
  });
  return parseVideoList(response.items, {
    sourceId: 'trending',
    categoryLabel: 'Trending',
    matchedTopic: false,
  });
}
