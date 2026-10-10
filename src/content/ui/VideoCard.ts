import { formatDuration, formatRelativeTime, formatViews } from '../../shared/duration';
import type { Settings, VideoCandidate } from '../../shared/types';
import { watchUrl } from '../../shared/validate';
import { createMonogram } from './mark';

export interface VideoCardOptions {
  settings: Settings;
  /** Position in the grid — drives the staggered reveal delay. */
  index?: number;
  /** Called when the card should remove itself (e.g. vertical-thumbnail Short). */
  onHide?: (card: HTMLElement) => void;
}

function dot(): HTMLElement {
  const node = document.createElement('span');
  node.className = 'dt-dot';
  return node;
}

/**
 * Builds a single video card. Every value from the API is written with
 * `textContent`; links are built from validated ids only. No HTML is ever
 * interpolated, so untrusted titles cannot inject markup.
 *
 * Structure: card (reveal) > inner (hover lift) > thumb + body(avatar, text).
 * Splitting reveal and hover onto separate elements lets each animate with its
 * own easing without fighting over `transform`.
 */
export function createVideoCard(video: VideoCandidate, options: VideoCardOptions): HTMLElement {
  const card = document.createElement('article');
  card.className = 'dt-card';
  card.dataset.videoId = video.videoId;
  card.style.setProperty('--dt-i', String(Math.min(options.index ?? 0, 8)));

  const inner = document.createElement('div');
  inner.className = 'dt-card__inner';

  const link = watchUrl(video.videoId);

  const thumb = document.createElement('a');
  thumb.className = 'dt-thumb';
  if (link) {
    thumb.href = link;
    thumb.rel = 'noopener';
  }

  const image = document.createElement('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  image.alt = '';
  image.src = video.thumbnailUrl;
  image.addEventListener('error', () => {
    image.remove();
    thumb.classList.add('dt-thumb--missing');
  });
  image.addEventListener('load', () => {
    // Secondary Shorts heuristic: a vertical thumbnail for a video whose
    // duration we could not determine. Only applied when the user hides Shorts.
    if (
      options.settings.hideShorts &&
      video.durationSec === null &&
      image.naturalHeight > image.naturalWidth &&
      options.onHide
    ) {
      options.onHide(card);
    }
  });
  thumb.append(image);

  const duration = formatDuration(video.durationSec);
  if (duration) {
    const badge = document.createElement('span');
    badge.className = 'dt-badge';
    badge.textContent = duration;
    thumb.append(badge);
  }

  const title = document.createElement('a');
  title.className = 'dt-title';
  if (link) title.href = link;
  title.textContent = video.title;
  title.title = video.title;

  const meta = document.createElement('div');
  meta.className = 'dt-meta';
  const parts: string[] = [];
  if (video.channelTitle) parts.push(video.channelTitle);
  const views = formatViews(video.viewCount);
  if (views) parts.push(views);
  const age = formatRelativeTime(video.publishedAt);
  if (age) parts.push(age);

  parts.forEach((text, position) => {
    if (position > 0) meta.append(dot());
    const span = document.createElement('span');
    span.textContent = text;
    meta.append(span);
  });

  const text = document.createElement('div');
  text.className = 'dt-card__text';
  text.append(title, meta);

  const body = document.createElement('div');
  body.className = 'dt-card__body';
  body.append(createMonogram(video.channelTitle, video.channelId), text);

  inner.append(thumb, body);
  card.append(inner);
  return card;
}
