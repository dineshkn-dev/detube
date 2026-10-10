import type { Feed, FeedNotice, Settings, VideoCandidate } from '../../shared/types';
import { createIcon, type IconName } from './icons';
import { createPrismMark } from './mark';
import {
  createRevealObserver,
  pulseClass,
  trackScrollProgress,
  type RevealObserver,
} from './motion';
import { createVideoCard } from './VideoCard';

export interface FeedRendererCallbacks {
  onOpenOptions: () => void;
  onReshuffle: () => void;
}

function element(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function textNode(tag: string, className: string, text: string): HTMLElement {
  const node = element(tag, className);
  node.textContent = text;
  return node;
}

function actionButton(
  label: string,
  className: string,
  onClick: () => void,
  icon?: IconName,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  if (icon) button.append(createIcon(icon, 15));
  button.append(document.createTextNode(label));
  button.addEventListener('click', onClick);
  return button;
}

const RESHUFFLE_MS = 640;

/**
 * Owns the contents of the shadow root. Renders the feed, a loading skeleton,
 * and compact banner states. Keeps the full ranked sections in memory so
 * "Load more" reveals already-fetched items without extra API calls.
 */
export class FeedRenderer {
  private readonly wrapper: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly reveal: RevealObserver;
  private readonly stopScrollTracking: () => void;
  private sections: Feed['sections'] = [];
  private notices: FeedNotice[] = [];
  private visiblePerSection: number;
  private sentinel: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly shadow: ShadowRoot,
    private readonly callbacks: FeedRendererCallbacks,
    private settings: Settings,
  ) {
    this.visiblePerSection = settings.videosPerSection;
    this.wrapper = element('div', `dt-feed dt-${settings.density}`);
    this.wrapper.dataset.density = settings.density;

    const bar = element('div', 'dt-progress__bar');
    this.progress = element('div', 'dt-progress');
    this.progress.setAttribute('aria-hidden', 'true');
    this.progress.append(bar);

    this.reveal = createRevealObserver();
    this.stopScrollTracking = trackScrollProgress(this.wrapper, (value) => {
      this.wrapper.style.setProperty('--dt-progress', value.toFixed(4));
    });

    this.shadow.append(this.wrapper);
  }

  renderLoading(): void {
    this.disconnectObserver();
    this.wrapper.replaceChildren();
    this.wrapper.append(this.buildMasthead('Loading discovery feed…'));

    const skeleton = element('div', 'dt-skeleton-grid');
    for (let index = 0; index < 6; index++) {
      const card = element('div', 'dt-skeleton');
      card.append(element('div', 'dt-skeleton__thumb'));
      card.append(element('div', 'dt-skeleton__line'));
      card.append(element('div', 'dt-skeleton__line dt-skeleton__line--short'));
      skeleton.append(card);
    }
    this.wrapper.append(skeleton);
    this.wrapper.append(this.progress);
  }

  renderFeed(feed: Feed, settings: Settings): void {
    this.settings = settings;
    this.sections = feed.sections;
    this.notices = feed.notices;
    this.visiblePerSection = settings.videosPerSection;
    this.renderAll();
  }

  /** One-shot spectrum sweep used after a reshuffle. */
  playReshuffle(): void {
    pulseClass(this.wrapper, 'is-reshuffling', RESHUFFLE_MS);
  }

  /** Compact banner shown above the (restored) YouTube home. */
  renderBanner(options: {
    title: string;
    message: string;
    primary?: { label: string; onClick: () => void };
    secondary?: { label: string; onClick: () => void };
  }): void {
    this.disconnectObserver();
    this.reveal.disconnect();
    this.wrapper.replaceChildren();

    const banner = element('div', 'dt-banner');

    const head = element('div', 'dt-banner__head');
    head.append(createPrismMark(30), textNode('h2', 'dt-banner__title', options.title));
    banner.append(head);

    banner.append(textNode('p', 'dt-banner__text', options.message));

    const actions = element('div', 'dt-actions');
    if (options.primary) {
      actions.append(
        actionButton(options.primary.label, 'dt-btn dt-btn--primary', options.primary.onClick),
      );
    }
    if (options.secondary) {
      actions.append(actionButton(options.secondary.label, 'dt-btn', options.secondary.onClick));
    }
    if (actions.childElementCount > 0) banner.append(actions);

    this.wrapper.append(banner);
  }

  destroy(): void {
    this.disconnectObserver();
    this.reveal.disconnect();
    this.stopScrollTracking();
    this.wrapper.remove();
  }

  private renderAll(): void {
    this.disconnectObserver();
    this.reveal.disconnect();
    this.wrapper.replaceChildren();
    this.wrapper.append(this.buildMasthead('Discovery without personalized ranking.'));

    if (this.notices.length > 0) {
      const notice = textNode(
        'div',
        'dt-notice',
        this.notices.map((entry) => entry.message).join(' '),
      );
      this.wrapper.append(notice);
    }

    let rendered = 0;
    for (const section of this.sections) {
      const visible = section.videos.slice(0, this.visiblePerSection);
      if (visible.length === 0) continue;
      rendered += visible.length;

      const sectionEl = element('section', 'dt-section');
      const heading = element('h2', 'dt-section-title');
      heading.append(
        element('span', 'dt-bullet'),
        document.createTextNode(section.title),
        textNode('span', 'dt-count', String(section.videos.length)),
      );
      sectionEl.append(heading);

      const grid = element('div', 'dt-grid');
      visible.forEach((video, index) => {
        const card = this.buildCard(video, index);
        grid.append(card);
        this.reveal.observe(card);
      });
      sectionEl.append(grid);
      this.wrapper.append(sectionEl);
    }

    if (rendered === 0) {
      const empty = element('div', 'dt-empty');
      empty.append(textNode('span', 'dt-end__title', 'Nothing matches your filters'));
      empty.append(
        textNode(
          'span',
          'dt-end__note',
          'Try enabling more topics, or relaxing your content filters in Settings.',
        ),
      );
      this.wrapper.append(empty);
      return;
    }

    if (this.hasMore()) {
      if (this.settings.loadMore === 'button') {
        this.wrapper.append(
          actionButton('Load more', 'dt-btn dt-more', () => this.loadMore(), 'sparkle'),
        );
      } else {
        this.sentinel = element('div', 'dt-sentinel');
        this.wrapper.append(this.sentinel);
        this.observeSentinel();
      }
    } else {
      const end = element('div', 'dt-end');
      end.append(element('span', 'dt-bullet'));
      end.append(textNode('span', 'dt-end__title', "You've reached the end of today's feed."));
      end.append(textNode('span', 'dt-end__note', 'This feed is finite by design.'));
      this.wrapper.append(end);
    }

    this.wrapper.append(this.progress);
  }

  private buildMasthead(tagline: string): HTMLElement {
    const header = element('header', 'dt-masthead');
    header.append(createPrismMark(36));

    const titles = element('div', 'dt-titles');
    titles.append(textNode('h1', 'dt-wordmark', 'DeTube'));
    titles.append(textNode('p', 'dt-tagline', tagline));

    const actions = element('div', 'dt-actions');
    actions.append(
      actionButton('Reshuffle', 'dt-btn', () => this.callbacks.onReshuffle(), 'refresh'),
      actionButton('Settings', 'dt-btn', () => this.callbacks.onOpenOptions(), 'sliders'),
    );

    header.append(titles, actions);
    return header;
  }

  private buildCard(video: VideoCandidate, index: number): HTMLElement {
    return createVideoCard(video, {
      settings: this.settings,
      index,
      onHide: (card) => card.remove(),
    });
  }

  private loadMore(): void {
    this.visiblePerSection += this.settings.videosPerSection;
    this.renderAll();
  }

  private hasMore(): boolean {
    return this.sections.some((section) => section.videos.length > this.visiblePerSection);
  }

  private observeSentinel(): void {
    if (!this.sentinel || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.disconnectObserver();
        this.loadMore();
      }
    });
    this.observer.observe(this.sentinel);
  }

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
