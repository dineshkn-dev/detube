import type { VideoCandidate } from '../../shared/types';
import { fetchChannelUploads, type ChannelSectionContext } from './ChannelUploadsSource';
import { extractSubscriptionChannelId, type SourceContext } from './parse';

export interface SubscriptionFetchOptions {
  accessToken: string;
  section: ChannelSectionContext;
  /** Channels to sample per load (rotated daily for fairness). */
  maxChannels: number;
  /** Daily rotation counter. */
  rotation: number;
}

/**
 * The user's subscriptions. This requires OAuth (`youtube.readonly`); there is
 * no key-only way to read a user's subscriptions. Ranking is never derived from
 * watch history — subscriptions are an explicit user choice.
 */
export async function fetchSubscriptionFeed(
  context: SourceContext,
  options: SubscriptionFetchOptions,
): Promise<VideoCandidate[]> {
  const response = await context.api.subscriptions(options.accessToken, 50);
  const channelIds = (response.items ?? [])
    .map(extractSubscriptionChannelId)
    .filter((id): id is string => id !== null);

  if (channelIds.length === 0) return [];

  const window = rotate(channelIds, options.maxChannels, options.rotation);
  return fetchChannelUploads(window, context, options.section);
}

/** Deterministic window over the channel list, advancing as `rotation` grows. */
export function rotate<T>(items: T[], size: number, rotation: number): T[] {
  if (items.length <= size) return [...items];
  const start = ((rotation % items.length) + items.length) % items.length;
  const output: T[] = [];
  for (let offset = 0; offset < size; offset++) {
    output.push(items[(start + offset) % items.length] as T);
  }
  return output;
}
