import type { VideoCandidate } from '../../shared/types';
import { isValidChannelId, normalizeHandle } from '../../shared/validate';
import { applyEnrichment } from '../../api/parsers';
import {
  chunk,
  extractChannelId,
  extractUploadsPlaylistId,
  parsePlaylistList,
  parseVideoList,
  type SourceContext,
} from './parse';

export interface ChannelSectionContext {
  sourceId: string;
  categoryLabel: string;
  /** Max videos pulled per channel. */
  perChannel?: number;
  /** Cap the number of channels processed (cost control). */
  maxChannels?: number;
}

/** Resolves a mix of channel IDs and @handles to channel IDs. */
export async function resolveChannelIds(
  references: string[],
  context: SourceContext,
): Promise<string[]> {
  const resolved = new Set<string>();
  const handles: string[] = [];

  for (const reference of references) {
    const trimmed = reference.trim();
    if (!trimmed) continue;
    if (isValidChannelId(trimmed)) resolved.add(trimmed);
    else handles.push(normalizeHandle(trimmed));
  }

  for (const handle of handles) {
    try {
      const response = await context.api.channelByHandle(handle);
      const id = extractChannelId(response.items?.[0]);
      if (id) resolved.add(id);
    } catch {
      // Unresolvable handle — skip quietly rather than failing the whole section.
    }
  }

  return [...resolved];
}

/**
 * Fetches recent uploads for a set of channels using the cheap uploads-playlist
 * path (channels.list + playlistItems.list + one videos.list enrichment), which
 * the API docs recommend over search.list for "latest" content.
 */
export async function fetchChannelUploads(
  channelIds: string[],
  context: SourceContext,
  section: ChannelSectionContext,
): Promise<VideoCandidate[]> {
  const perChannel = section.perChannel ?? 15;
  const maxChannels = section.maxChannels ?? channelIds.length;
  const targets = channelIds.slice(0, maxChannels);
  if (targets.length === 0) return [];

  const candidateContext = {
    sourceId: section.sourceId,
    categoryLabel: section.categoryLabel,
    matchedTopic: true,
  };

  const playlistIds: string[] = [];
  for (const batch of chunk(targets, 50)) {
    try {
      const response = await context.api.channelsByIds(batch);
      for (const item of response.items ?? []) {
        const playlistId = extractUploadsPlaylistId(item);
        if (playlistId) playlistIds.push(playlistId);
      }
    } catch {
      // Skip a failed batch; continue with the rest.
    }
  }

  const collected: VideoCandidate[] = [];
  const playlistResults = await Promise.all(
    playlistIds.map((playlistId) =>
      context.api
        .uploadsPlaylistItems(playlistId, perChannel)
        .catch(() => ({ items: [] as never[] })),
    ),
  );
  for (const response of playlistResults) {
    collected.push(...parsePlaylistList(response.items, candidateContext));
  }

  if (collected.length === 0) return [];

  const ids = [...new Set(collected.map((candidate) => candidate.videoId))];
  const enriched: VideoCandidate[] = [];
  for (const batch of chunk(ids, 50)) {
    try {
      const response = await context.api.videosByIds(batch);
      enriched.push(...parseVideoList(response.items, candidateContext));
    } catch {
      // Enrichment is best-effort; unenriched candidates still render.
    }
  }

  return applyEnrichment(collected, enriched);
}
