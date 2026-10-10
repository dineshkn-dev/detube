import { parseIsoDuration } from '../shared/duration';
import type { VideoCandidate } from '../shared/types';
import { isValidVideoId, thumbnailUrl } from '../shared/validate';

export interface RawThumb {
  url?: string;
  width?: number;
  height?: number;
}

export interface RawThumbnails {
  default?: RawThumb;
  medium?: RawThumb;
  high?: RawThumb;
  standard?: RawThumb;
}

export interface RawSnippet {
  title?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  categoryId?: string;
  liveBroadcastContent?: string;
  thumbnails?: RawThumbnails;
  resourceId?: { videoId?: string };
}

export interface RawVideoResource {
  id?: string;
  snippet?: RawSnippet;
  statistics?: { viewCount?: string };
  contentDetails?: { duration?: string };
}

export interface RawSearchResource {
  id?: { kind?: string; videoId?: string };
  snippet?: RawSnippet;
}

export interface RawPlaylistItemResource {
  snippet?: RawSnippet;
  contentDetails?: { videoId?: string; videoPublishedAt?: string };
}

export interface CandidateContext {
  sourceId: string;
  categoryLabel: string;
  matchedTopic?: boolean;
}

interface CandidateInput {
  videoId: unknown;
  title: unknown;
  channelId: unknown;
  channelTitle: unknown;
  publishedAt: unknown;
  durationSec: number | null;
  viewCount: number | null;
  categoryId: unknown;
  liveBroadcastContent: unknown;
  context: CandidateContext;
}

function parseViewCount(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function buildCandidate(input: CandidateInput): VideoCandidate | null {
  if (!isValidVideoId(input.videoId)) return null;
  if (typeof input.title !== 'string' || input.title.trim() === '') return null;

  const liveBroadcast =
    typeof input.liveBroadcastContent === 'string' ? input.liveBroadcastContent : '';
  return {
    videoId: input.videoId,
    title: input.title,
    channelId: typeof input.channelId === 'string' ? input.channelId : '',
    channelTitle: typeof input.channelTitle === 'string' ? input.channelTitle : '',
    publishedAt: typeof input.publishedAt === 'string' ? input.publishedAt : '',
    durationSec: input.durationSec,
    viewCount: input.viewCount,
    categoryId: typeof input.categoryId === 'string' ? input.categoryId : null,
    isLive: liveBroadcast === 'live',
    isUpcoming: liveBroadcast === 'upcoming',
    thumbnailUrl: thumbnailUrl(input.videoId, 'mqdefault'),
    sourceId: input.context.sourceId,
    categoryLabel: input.context.categoryLabel,
    matchedTopic: input.context.matchedTopic ?? false,
  };
}

/** Parser for `videos.list` items (the `id` field is a plain string). */
export function parseVideoResource(
  item: RawVideoResource | null | undefined,
  context: CandidateContext,
): VideoCandidate | null {
  if (!item || typeof item !== 'object') return null;
  const snippet = item.snippet ?? {};
  return buildCandidate({
    videoId: item.id,
    title: snippet.title,
    channelId: snippet.channelId,
    channelTitle: snippet.channelTitle,
    publishedAt: snippet.publishedAt,
    durationSec: parseIsoDuration(item.contentDetails?.duration),
    viewCount: parseViewCount(item.statistics?.viewCount),
    categoryId: snippet.categoryId,
    liveBroadcastContent: snippet.liveBroadcastContent,
    context,
  });
}

/** Parser for `search.list` items (the id lives at `id.videoId`). */
export function parseSearchResource(
  item: RawSearchResource | null | undefined,
  context: CandidateContext,
): VideoCandidate | null {
  if (!item || typeof item !== 'object') return null;
  if (item.id?.kind && item.id.kind !== 'youtube#video') return null;
  const snippet = item.snippet ?? {};
  return buildCandidate({
    videoId: item.id?.videoId,
    title: snippet.title,
    channelId: snippet.channelId,
    channelTitle: snippet.channelTitle,
    publishedAt: snippet.publishedAt,
    durationSec: null,
    viewCount: null,
    categoryId: snippet.categoryId,
    liveBroadcastContent: snippet.liveBroadcastContent,
    context,
  });
}

/** Parser for `playlistItems.list` items. */
export function parsePlaylistItem(
  item: RawPlaylistItemResource | null | undefined,
  context: CandidateContext,
): VideoCandidate | null {
  if (!item || typeof item !== 'object') return null;
  const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
  return buildCandidate({
    videoId,
    title: item.snippet?.title,
    channelId: item.snippet?.channelId,
    channelTitle: item.snippet?.channelTitle,
    publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt,
    durationSec: null,
    viewCount: null,
    categoryId: item.snippet?.categoryId,
    liveBroadcastContent: item.snippet?.liveBroadcastContent,
    context,
  });
}

/** Merges enrichment (duration/statistics) into already-parsed candidates by id. */
export function applyEnrichment(
  candidates: VideoCandidate[],
  enriched: VideoCandidate[],
): VideoCandidate[] {
  const byId = new Map(enriched.map((candidate) => [candidate.videoId, candidate]));
  return candidates.map((candidate) => {
    const extra = byId.get(candidate.videoId);
    if (!extra) return candidate;
    return {
      ...candidate,
      durationSec: extra.durationSec ?? candidate.durationSec,
      viewCount: extra.viewCount ?? candidate.viewCount,
      categoryId: extra.categoryId ?? candidate.categoryId,
      isLive: extra.isLive || candidate.isLive,
      isUpcoming: extra.isUpcoming || candidate.isUpcoming,
    };
  });
}
