/**
 * Validation and URL construction. Every YouTube URL the UI navigates to is
 * built here from a *validated* id — we never trust or forward a URL supplied
 * by an API response or by page content.
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

export function isValidVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID_PATTERN.test(value);
}

export function isValidChannelId(value: unknown): value is string {
  return typeof value === 'string' && CHANNEL_ID_PATTERN.test(value);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export type ThumbnailQuality = 'default' | 'mqdefault' | 'hqdefault' | 'sddefault';

const THUMB_PATH: Record<ThumbnailQuality, string> = {
  default: 'default.jpg',
  mqdefault: 'mqdefault.jpg',
  hqdefault: 'hqdefault.jpg',
  sddefault: 'sddefault.jpg',
};

/** Thumbnail URL derived from a validated video id. Returns '' when invalid. */
export function thumbnailUrl(videoId: string, quality: ThumbnailQuality = 'mqdefault'): string {
  if (!isValidVideoId(videoId)) return '';
  return `https://i.ytimg.com/vi/${videoId}/${THUMB_PATH[quality]}`;
}

/** Watch URL for a validated video id. Returns null when invalid. */
export function watchUrl(videoId: string): string | null {
  return isValidVideoId(videoId) ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

/** Channel URL for a validated channel id. Returns null when invalid. */
export function channelUrl(channelId: string): string | null {
  return isValidChannelId(channelId) ? `https://www.youtube.com/channel/${channelId}` : null;
}

/** Strips a leading @, trims, and lowercases for comparison. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

/** Lowercased, alphanumeric-only form used to compare handles and titles. */
function channelSlug(value: string): string {
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** True when the reference plausibly points at the given video's channel. */
export function channelMatches(
  reference: string,
  channel: { channelId: string; channelTitle: string },
): boolean {
  const trimmed = reference.trim();
  if (!trimmed) return false;
  if (isValidChannelId(trimmed)) return trimmed === channel.channelId;
  const slug = channelSlug(trimmed);
  return slug.length > 0 && slug === channelSlug(channel.channelTitle);
}
