/**
 * Shared domain types. This module (and everything under feed/) is deliberately
 * free of browser APIs so the feed engine is testable in plain Node.
 */

export type CategoryKind = 'chart' | 'search' | 'topic';

/**
 * A logical feed category. Categories are data, not code: adding a new one is a
 * registry entry, never a new branch somewhere in the pipeline.
 */
export interface FeedCategory {
  id: string;
  label: string;
  kind: CategoryKind;
  /** kind === 'chart' */
  videoCategoryId?: string;
  /** kind === 'search' */
  query?: string;
  /** kind === 'topic' */
  topicId?: string;
  enabledByDefault: boolean;
  order: number;
}

export interface VideoCandidate {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  /** RFC 3339 timestamp. */
  publishedAt: string;
  durationSec: number | null;
  viewCount: number | null;
  categoryId: string | null;
  isLive: boolean;
  isUpcoming: boolean;
  /** Always derived from a validated video id — never an API-supplied URL. */
  thumbnailUrl: string;
  /** Id of the source/category that produced this candidate. */
  sourceId: string;
  /** Human label of the owning section. */
  categoryLabel: string;
  /** True when the candidate matched an explicitly enabled topic. */
  matchedTopic: boolean;
}

export interface FeedSection {
  id: string;
  title: string;
  subtitle?: string;
  videos: VideoCandidate[];
}

export type FeedNoticeCode =
  'NO_API_KEY' | 'QUOTA_EXCEEDED' | 'AUTH_REQUIRED' | 'NETWORK' | 'PARTIAL' | 'UNKNOWN';

export interface FeedNotice {
  code: FeedNoticeCode;
  message: string;
}

export interface Feed {
  generatedAt: number;
  seed: number;
  sections: FeedSection[];
  notices: FeedNotice[];
}

export interface QuotaUsage {
  /** YYYY-MM-DD in local time. */
  date: string;
  units: number;
  searchCalls: number;
}

export interface Status {
  enabled: boolean;
  hasApiKey: boolean;
  subscriptionsConnected: boolean;
  quota: QuotaUsage;
}

export type Density = 'comfortable' | 'compact';
export type Freshness = 'low' | 'medium' | 'high';
export type LoadMoreMode = 'button' | 'auto';

export interface Settings {
  version: number;
  enabled: boolean;
  density: Density;
  videosPerSection: number;
  /** 0–100; blends strict score order into a seeded shuffle. */
  randomization: number;
  freshness: Freshness;
  loadMore: LoadMoreMode;
  /** categoryId → enabled. */
  categories: Record<string, boolean>;
  customTopics: string[];
  includeChannels: string[];
  excludeChannels: string[];
  hideShorts: boolean;
  hideLivestreams: boolean;
  minDurationSec: number;
  maxDurationSec: number;
  hideClickbait: boolean;
  regionCode: string;
  /** Changing this reshuffles the seeded ordering. */
  resampleSalt: number;
  subscriptionsEnabled: boolean;
  maxSubscriptionChannels: number;
}

export const DAILY_UNIT_LIMIT = 10_000;
export const DAILY_SEARCH_LIMIT = 100;
export const SETTINGS_VERSION = 1;
