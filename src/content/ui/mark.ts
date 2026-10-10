import { hashSeed } from '../../background/feed/random';

/**
 * The prism mark. Drawn purely in CSS (a `clip-path` triangle over a spectral
 * gradient inside a squircle) so it is CSP-safe, needs no network request, and
 * stays crisp at any size.
 */
export function createPrismMark(size = 32): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'dt-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.style.setProperty('--dt-mark-size', `${size}px`);

  const prism = document.createElement('span');
  prism.className = 'dt-mark__prism';
  mark.append(prism);

  return mark;
}

/**
 * A deterministic monogram avatar. The YouTube Data API does not return channel
 * avatars without extra calls, so we derive a stable hue from the channel id —
 * giving each channel a consistent identity at zero API cost.
 */
export function createMonogram(channelTitle: string, channelId: string): HTMLElement {
  const avatar = document.createElement('span');
  avatar.className = 'dt-avatar';
  avatar.setAttribute('aria-hidden', 'true');

  const seed = hashSeed(channelId || channelTitle || 'unknown');
  const hue = seed % 360;
  avatar.style.setProperty('--dt-hue', String(hue));

  const trimmed = channelTitle.trim();
  const initial = trimmed ? (trimmed[0] as string).toUpperCase() : '•';
  avatar.textContent = initial;

  return avatar;
}
