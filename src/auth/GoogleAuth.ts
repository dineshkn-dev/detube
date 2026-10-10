import { FeedError } from '../shared/errors';

/**
 * OAuth via the Chrome Identity API. We request exactly one scope,
 * `youtube.readonly`, and only when the user opts into the Subscriptions feed.
 * Tokens are held by Chrome's identity layer, never by extension code.
 */
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

export function isIdentityAvailable(): boolean {
  return Boolean((globalThis as { chrome?: typeof chrome }).chrome?.identity?.getAuthToken);
}

function getAuthToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const identity = (globalThis as { chrome?: typeof chrome }).chrome?.identity;
    if (!identity?.getAuthToken) {
      reject(new FeedError('AUTH_REQUIRED', 'The Chrome identity API is unavailable.'));
      return;
    }
    identity.getAuthToken({ interactive, scopes: SCOPES }, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new FeedError('AUTH_REQUIRED', error.message ?? 'Authorization failed.'));
        return;
      }
      const token = typeof result === 'string' ? result : '';
      if (!token) {
        reject(new FeedError('AUTH_REQUIRED', 'No access token was returned.'));
        return;
      }
      resolve(token);
    });
  });
}

/** Returns a cached token when available, refreshing/interacting on demand. */
export async function getAccessToken(interactive = false): Promise<string> {
  return getAuthToken(interactive);
}

/** Discards a specific token so the next call re-fetches it (e.g. after a 401). */
export function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    const identity = (globalThis as { chrome?: typeof chrome }).chrome?.identity;
    if (!identity?.removeCachedAuthToken) return resolve();
    identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

export async function connectSubscriptions(): Promise<void> {
  await getAccessToken(true);
}

export async function disconnectSubscriptions(): Promise<void> {
  const token = await getAccessToken(false).catch(() => null);
  if (!token) return;
  await removeCachedToken(token);
}

export async function isSubscriptionsConnected(): Promise<boolean> {
  try {
    await getAccessToken(false);
    return true;
  } catch {
    return false;
  }
}
