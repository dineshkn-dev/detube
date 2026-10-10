import type { Feed, Settings, Status } from '../../shared/types';

/**
 * Typed content ↔ service-worker contracts. The service worker is the single
 * owner of settings and quota state; UI surfaces talk to it through these
 * messages rather than touching storage independently.
 *
 * Modelled as a discriminated union so `payload` narrows with `type`.
 */
export type RequestMessage =
  | { type: 'GET_FEED'; payload?: { force?: boolean } }
  | { type: 'GET_STATUS' }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload?: Partial<Settings> }
  | { type: 'RESHUFFLE' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'SET_API_KEY'; payload: { apiKey: string } };

export type RequestType = RequestMessage['type'];

export interface ResponseMap {
  GET_FEED: Feed;
  GET_STATUS: Status;
  GET_SETTINGS: Settings;
  UPDATE_SETTINGS: Settings;
  RESHUFFLE: Status;
  OPEN_OPTIONS: boolean;
  SET_API_KEY: Status;
}

export type ResponseOf<T extends RequestType> = ResponseMap[T];

export type ResponseMessage<T extends RequestType = RequestType> =
  { ok: true; data: ResponseOf<T> } | { ok: false; error: { code: string; message: string } };

export class MessageError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MessageError';
    this.code = code;
  }
}

/** Sends a typed message to the service worker and unwraps the response. */
export function sendMessage<T extends RequestType>(
  message: Extract<RequestMessage, { type: T }>,
): Promise<ResponseOf<T>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: ResponseMessage<T> | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new MessageError('DISCONNECTED', error.message ?? 'Extension context unavailable.'));
        return;
      }
      if (!response) {
        reject(new MessageError('NO_RESPONSE', 'No response from the background service worker.'));
        return;
      }
      if (response.ok) resolve(response.data);
      else reject(new MessageError(response.error.code, response.error.message));
    });
  });
}
