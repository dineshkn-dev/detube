/**
 * Parses an ISO-8601 duration (as returned by `contentDetails.duration`) into
 * whole seconds. Returns null for missing/invalid input rather than throwing —
 * API payloads are untrusted.
 *
 * Supports the subset YouTube emits: `PT#H#M#S` and `P#DT#H#M#S`.
 */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (days === undefined && hours === undefined && minutes === undefined && seconds === undefined) {
    return null;
  }
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Number.isFinite(total) ? total : null;
}

/** Formats seconds as `m:ss` or `h:mm:ss`. Returns '' for null/invalid input. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/** Compact relative age, e.g. "3 days ago". Non-throwing. */
export function formatRelativeTime(publishedAt: string, nowMs: number = Date.now()): string {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return '';
  const diffMs = Math.max(0, nowMs - timestamp);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** Compact view count, e.g. "1.2M views". Non-throwing. */
export function formatViews(viewCount: number | null): string {
  if (viewCount === null || !Number.isFinite(viewCount) || viewCount < 0) return '';
  if (viewCount < 1_000) return `${viewCount} views`;
  const units: Array<[number, string]> = [
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'K'],
  ];
  for (const [threshold, suffix] of units) {
    if (viewCount >= threshold) {
      const scaled = viewCount / threshold;
      const rounded = scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
      return `${rounded}${suffix} views`;
    }
  }
  return `${viewCount} views`;
}
