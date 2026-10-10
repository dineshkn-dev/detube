import { describe, expect, it, vi } from 'vitest';
import { FeedRenderer } from '../src/content/ui/FeedRenderer';
import { createMonogram } from '../src/content/ui/mark';
import type { Feed } from '../src/shared/types';
import { mergeSettings } from '../src/storage/SettingsStore';
import { candidate, channelId, videoId } from './helpers';

function mount(overrides: Parameters<typeof mergeSettings>[0] = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const callbacks = { onOpenOptions: vi.fn(), onReshuffle: vi.fn() };
  const settings = mergeSettings(overrides);
  const renderer = new FeedRenderer(shadow, callbacks, settings);
  return { host, shadow, callbacks, settings, renderer };
}

function makeFeed(): Feed {
  return {
    generatedAt: 1_700_000_000_000,
    seed: 1,
    notices: [],
    sections: [
      {
        id: 'trending',
        title: 'Trending',
        videos: [
          candidate({ videoId: videoId(1), title: 'First video' }),
          candidate({ videoId: videoId(2), title: 'Second video' }),
        ],
      },
      {
        id: 'technology',
        title: 'Technology',
        videos: [candidate({ videoId: videoId(3), title: 'Third video' })],
      },
    ],
  };
}

describe('FeedRenderer', () => {
  it('renders the masthead, sections and cards', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(makeFeed(), settings);

    expect(shadow.querySelector('.dt-wordmark')?.textContent).toBe('DeTube');

    const sections = shadow.querySelectorAll('.dt-section');
    expect(sections).toHaveLength(2);
    expect(sections[0]?.querySelector('.dt-section-title')?.textContent).toContain('Trending');
    expect(sections[0]?.querySelectorAll('.dt-card')).toHaveLength(2);
    expect(sections[1]?.querySelectorAll('.dt-card')).toHaveLength(1);
  });

  it('shows how many videos a section holds', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(makeFeed(), settings);
    expect(shadow.querySelector('.dt-count')?.textContent).toBe('2');
  });

  it('links each card to a validated watch URL', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(makeFeed(), settings);
    const title = shadow.querySelector('.dt-card .dt-title') as HTMLAnchorElement;
    expect(title.getAttribute('href')).toBe(`https://www.youtube.com/watch?v=${videoId(1)}`);
    const thumb = shadow.querySelector('.dt-card .dt-thumb') as HTMLAnchorElement;
    expect(thumb.getAttribute('href')).toBe(`https://www.youtube.com/watch?v=${videoId(1)}`);
  });

  it('writes untrusted titles with textContent, never markup', () => {
    const { shadow, settings, renderer } = mount();
    const nasty = '<img src=x onerror=alert(1)>';
    renderer.renderFeed(
      {
        generatedAt: 0,
        seed: 1,
        notices: [],
        sections: [
          { id: 'x', title: 'X', videos: [candidate({ videoId: videoId(1), title: nasty })] },
        ],
      },
      settings,
    );
    const title = shadow.querySelector('.dt-title') as HTMLElement;
    expect(title.querySelector('img')).toBeNull();
    expect(title.textContent).toBe(nasty);
  });

  it('shows the end-of-feed message once everything is visible', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(makeFeed(), settings);
    expect(shadow.querySelector('.dt-end')?.textContent).toContain(
      "You've reached the end of today's feed.",
    );
  });

  it('offers Load more instead of an end message when there is more to show', () => {
    const { shadow, settings, renderer } = mount({ videosPerSection: 4 });
    const many = Array.from({ length: 12 }, (_, index) =>
      candidate({ videoId: videoId(index + 1) }),
    );
    renderer.renderFeed(
      { generatedAt: 0, seed: 1, notices: [], sections: [{ id: 'x', title: 'X', videos: many }] },
      settings,
    );
    expect(shadow.querySelector('.dt-end')).toBeNull();
    expect(shadow.querySelector('.dt-more')?.textContent).toContain('Load more');
    // Only the first page of cards is rendered.
    expect(shadow.querySelectorAll('.dt-card')).toHaveLength(4);
  });

  it('renders the notice when some sources failed', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(
      { ...makeFeed(), notices: [{ code: 'QUOTA_EXCEEDED', message: 'Quota reached.' }] },
      settings,
    );
    expect(shadow.querySelector('.dt-notice')?.textContent).toBe('Quota reached.');
  });

  it('renders the banner states', () => {
    const { shadow, renderer } = mount();
    renderer.renderBanner({
      title: 'DeTube needs a YouTube API key',
      message: 'Add your key.',
      primary: { label: 'Open settings', onClick: () => undefined },
      secondary: { label: 'Show YouTube home', onClick: () => undefined },
    });
    expect(shadow.querySelector('.dt-banner__title')?.textContent).toBe(
      'DeTube needs a YouTube API key',
    );
    expect(shadow.querySelector('.dt-banner__text')?.textContent).toBe('Add your key.');
    expect(shadow.querySelectorAll('.dt-banner .dt-btn')).toHaveLength(2);
    // The prism mark is part of the banner head.
    expect(shadow.querySelector('.dt-banner__head .dt-mark')).not.toBeNull();
  });

  it('marks cards for reveal immediately when IntersectionObserver is unavailable', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(makeFeed(), settings);
    if (typeof IntersectionObserver === 'undefined') {
      expect(shadow.querySelectorAll('.dt-card.is-in')).toHaveLength(3);
    } else {
      expect(shadow.querySelectorAll('.dt-card')).toHaveLength(3);
    }
  });

  it('triggers the reshuffle animation without throwing', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(makeFeed(), settings);
    expect(() => renderer.playReshuffle()).not.toThrow();
    expect(shadow.querySelector('.dt-feed')?.classList.contains('is-reshuffling')).toBe(true);
  });

  it('tears down cleanly', () => {
    const { shadow, settings, renderer } = mount();
    renderer.renderFeed(makeFeed(), settings);
    renderer.destroy();
    expect(shadow.querySelector('.dt-feed')).toBeNull();
  });
});

describe('createMonogram', () => {
  it('shows the channel initial and a stable hue', () => {
    const first = createMonogram('Traversy Media', channelId('a'));
    const second = createMonogram('Traversy Media', channelId('a'));
    const other = createMonogram('Another Channel', channelId('b'));

    expect(first.textContent).toBe('T');
    expect(first.getAttribute('class')).toBe('dt-avatar');
    expect(first.getAttribute('style')).toBe(second.getAttribute('style'));
    expect(first.getAttribute('style')).not.toBe(other.getAttribute('style'));
  });

  it('falls back gracefully without a title', () => {
    expect(createMonogram('', channelId('z')).textContent).toBe('•');
  });
});
