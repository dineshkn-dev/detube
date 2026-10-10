export type FeedErrorCode =
  | 'NO_API_KEY'
  | 'AUTH_REQUIRED'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK'
  | 'HTTP'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export class FeedError extends Error {
  readonly code: FeedErrorCode;
  readonly retryable: boolean;
  /** HTTP status when the failure came from a response. */
  readonly status?: number;

  constructor(
    code: FeedErrorCode,
    message: string,
    options: { retryable?: boolean; status?: number } = {},
  ) {
    super(message);
    this.name = 'FeedError';
    this.code = code;
    this.retryable = options.retryable ?? false;
    if (options.status !== undefined) this.status = options.status;
  }
}

export function toFeedError(error: unknown): FeedError {
  if (error instanceof FeedError) return error;
  if (error instanceof Error) return new FeedError('UNKNOWN', error.message);
  return new FeedError('UNKNOWN', String(error));
}

/** User-facing copy for the graceful-degradation paths. */
export function noticeForError(error: FeedError): string {
  switch (error.code) {
    case 'NO_API_KEY':
      return 'Add your YouTube Data API key in settings to load the DeTube.';
    case 'AUTH_REQUIRED':
      return 'Connect your YouTube account in settings to use the Subscriptions feed.';
    case 'QUOTA_EXCEEDED':
      return 'YouTube API quota reached for today. DeTube will reset after midnight PT.';
    case 'NETWORK':
      return 'Network unavailable. DeTube is temporarily unavailable. YouTube is still available normally.';
    case 'INVALID_RESPONSE':
      return 'YouTube returned an unexpected response. DeTube is temporarily unavailable. YouTube is still available normally.';
    default:
      return 'DeTube is temporarily unavailable. YouTube is still available normally.';
  }
}
