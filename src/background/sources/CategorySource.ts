import type { FeedCategory, VideoCandidate } from '../../shared/types';
import { parseVideoList, type SourceContext } from './parse';

/**
 * A region-level chart for one YouTube video category. The user enabled this
 * category explicitly, so matchedTopic is true (it feeds the relevance score).
 */
export async function fetchCategory(
  category: FeedCategory,
  context: SourceContext,
): Promise<VideoCandidate[]> {
  if (category.kind !== 'chart') return [];
  const response = await context.api.mostPopular({
    regionCode: context.settings.regionCode,
    videoCategoryId: category.videoCategoryId,
    maxResults: 50,
  });
  return parseVideoList(response.items, {
    sourceId: category.id,
    categoryLabel: category.label,
    matchedTopic: true,
  });
}
