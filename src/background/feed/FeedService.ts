import type {
  Feed,
  FeedCategory,
  FeedNotice,
  FeedNoticeCode,
  Settings,
  VideoCandidate,
} from '../../shared/types';
import { noticeForError, toFeedError } from '../../shared/errors';
import type { SourceContext } from '../sources/parse';
import { fetchTrending } from '../sources/TrendingSource';
import { fetchCategory } from '../sources/CategorySource';
import { fetchSearchTopic } from '../sources/SearchTopicSource';
import { fetchChannelUploads, resolveChannelIds } from '../sources/ChannelUploadsSource';
import { fetchSubscriptionFeed } from '../sources/SubscriptionSource';
import { activeCategories } from './categories';
import { hashSeed } from './random';
import { applyFilters, dedupe, dedupeSections } from './FeedFilter';
import { rankVideos } from './FeedRanker';
import { diversify } from './FeedDiversity';

export interface FeedServiceDeps {
  context: SourceContext;
  getAccessToken?: (interactive: boolean) => Promise<string>;
}

const MAX_PER_CHANNEL = 2;

function seedFor(nowMs: number, settings: Settings): number {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return hashSeed(`${day}:${settings.resampleSalt}`);
}

function dayIndex(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}

function fetchForCategory(
  category: FeedCategory,
  context: SourceContext,
): Promise<VideoCandidate[]> {
  switch (category.kind) {
    case 'chart':
      return category.id === 'trending' || !category.videoCategoryId
        ? fetchTrending(context)
        : fetchCategory(category, context);
    case 'search':
    case 'topic':
      return fetchSearchTopic(category, context);
    default:
      return Promise.resolve([]);
  }
}

function buildSection(
  id: string,
  title: string,
  candidates: VideoCandidate[],
  settings: Settings,
  nowMs: number,
  seed: number,
): { id: string; title: string; videos: VideoCandidate[] } {
  const { kept } = applyFilters(dedupe(candidates), settings);
  const ranked = rankVideos(kept, {
    nowMs,
    randomization: settings.randomization,
    seed: (seed ^ hashSeed(id)) >>> 0,
    freshness: settings.freshness,
  });
  const diversified = diversify(ranked, { maxPerChannel: MAX_PER_CHANNEL });
  return { id, title, videos: diversified.slice(0, settings.videosPerSection) };
}

/**
 * Collects each configured section independently. A single failed source never
 * sinks the feed: it is recorded as a notice and the remaining sections load.
 * NO_API_KEY is the one fatal case (nothing can work without a key).
 */
async function collect(
  producer: () => Promise<VideoCandidate[]>,
  notices: Map<FeedNoticeCode, string>,
): Promise<VideoCandidate[] | null> {
  try {
    return await producer();
  } catch (error) {
    const feedError = toFeedError(error);
    if (feedError.code === 'NO_API_KEY') throw feedError;
    const code: FeedNoticeCode =
      feedError.code === 'AUTH_REQUIRED'
        ? 'AUTH_REQUIRED'
        : feedError.code === 'QUOTA_EXCEEDED'
          ? 'QUOTA_EXCEEDED'
          : 'PARTIAL';
    notices.set(code, noticeForError(feedError));
    return null;
  }
}

export async function buildFeed(deps: FeedServiceDeps): Promise<Feed> {
  const { context } = deps;
  const settings = context.settings;
  const nowMs = context.nowMs;
  const seed = seedFor(nowMs, settings);
  const notices = new Map<FeedNoticeCode, string>();
  const sections: FeedSectionLike[] = [];

  for (const category of activeCategories(settings)) {
    const candidates = await collect(() => fetchForCategory(category, context), notices);
    if (!candidates) continue;
    const section = buildSection(category.id, category.label, candidates, settings, nowMs, seed);
    if (section.videos.length > 0) sections.push(section);
  }

  if (settings.subscriptionsEnabled && deps.getAccessToken) {
    const candidates = await collect(async () => {
      const token = await deps.getAccessToken!(false);
      return fetchSubscriptionFeed(context, {
        accessToken: token,
        section: { sourceId: 'subscriptions', categoryLabel: 'Subscriptions', perChannel: 10 },
        maxChannels: settings.maxSubscriptionChannels,
        rotation: dayIndex(nowMs),
      });
    }, notices);
    if (candidates) {
      const section = buildSection(
        'subscriptions',
        'Subscriptions',
        candidates,
        settings,
        nowMs,
        seed,
      );
      // Explicit user choices lead the feed.
      if (section.videos.length > 0) sections.unshift(section);
    }
  }

  if (settings.includeChannels.length > 0) {
    const candidates = await collect(async () => {
      const channelIds = await resolveChannelIds(settings.includeChannels, context);
      return fetchChannelUploads(channelIds, context, {
        sourceId: 'following',
        categoryLabel: 'From channels you follow',
        perChannel: 12,
        maxChannels: 25,
      });
    }, notices);
    if (candidates) {
      const section = buildSection(
        'following',
        'From channels you follow',
        candidates,
        settings,
        nowMs,
        seed,
      );
      if (section.videos.length > 0) sections.unshift(section);
    }
  }

  const feedNotices: FeedNotice[] = [...notices].map(([code, message]) => ({ code, message }));
  return {
    generatedAt: nowMs,
    seed,
    sections: dedupeSections(sections).filter((section) => section.videos.length > 0),
    notices: feedNotices,
  };
}

interface FeedSectionLike {
  id: string;
  title: string;
  videos: VideoCandidate[];
}
