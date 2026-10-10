import type { Settings, VideoCandidate } from '../../shared/types';
import type { YouTubeApiClient } from '../../api/YouTubeApiClient';
import {
  parsePlaylistItem,
  parseSearchResource,
  parseVideoResource,
  type CandidateContext,
  type RawPlaylistItemResource,
  type RawSearchResource,
  type RawVideoResource,
} from '../../api/parsers';

export interface SourceContext {
  api: YouTubeApiClient;
  settings: Settings;
  nowMs: number;
}

export function parseVideoList(
  items: Array<RawVideoResource | null | undefined> | undefined,
  context: CandidateContext,
): VideoCandidate[] {
  return (items ?? [])
    .map((item) => parseVideoResource(item, context))
    .filter((candidate): candidate is VideoCandidate => candidate !== null);
}

export function parseSearchList(
  items: Array<RawSearchResource | null | undefined> | undefined,
  context: CandidateContext,
): VideoCandidate[] {
  return (items ?? [])
    .map((item) => parseSearchResource(item, context))
    .filter((candidate): candidate is VideoCandidate => candidate !== null);
}

export function parsePlaylistList(
  items: Array<RawPlaylistItemResource | null | undefined> | undefined,
  context: CandidateContext,
): VideoCandidate[] {
  return (items ?? [])
    .map((item) => parsePlaylistItem(item, context))
    .filter((candidate): candidate is VideoCandidate => candidate !== null);
}

export interface RawChannelResource {
  id?: string;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  snippet?: { title?: string };
}

export function extractChannelId(item: unknown): string | null {
  const id = (item as RawChannelResource | null)?.id;
  return typeof id === 'string' && id ? id : null;
}

export function extractUploadsPlaylistId(item: unknown): string | null {
  const uploads = (item as RawChannelResource | null)?.contentDetails?.relatedPlaylists?.uploads;
  return typeof uploads === 'string' && uploads ? uploads : null;
}

export interface RawSubscriptionResource {
  snippet?: { resourceId?: { channelId?: string } };
}

export function extractSubscriptionChannelId(item: unknown): string | null {
  const channelId = (item as RawSubscriptionResource | null)?.snippet?.resourceId?.channelId;
  return typeof channelId === 'string' && channelId ? channelId : null;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}
