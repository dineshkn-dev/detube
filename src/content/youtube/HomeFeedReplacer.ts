import type { Settings } from '../../shared/types';
import { MessageError, sendMessage } from '../../background/messaging/protocol';
import { FeedRenderer } from '../ui/FeedRenderer';
// Resolved at build time by the `cssText` esbuild plugin, which inlines the
// shared design tokens (@import) so the Shadow DOM receives one stylesheet.
import styles from '../ui/feed.css';
import { HomePageAdapter, type HomeMount } from './dom/HomePageAdapter';

const ROOT_ID = 'detube-root';

const BANNER_MESSAGES: Record<string, string> = {
  QUOTA_EXCEEDED:
    'YouTube API quota reached for today. DeTube will reset after midnight PT. YouTube is still available normally.',
  AUTH_REQUIRED:
    'YouTube rejected the API request. Check your API key in settings. YouTube is still available normally.',
  NETWORK:
    'Network unavailable. DeTube is temporarily unavailable. YouTube is still available normally.',
  INVALID_RESPONSE:
    'YouTube returned an unexpected response. DeTube is temporarily unavailable. YouTube is still available normally.',
  UNKNOWN: 'DeTube is temporarily unavailable. YouTube is still available normally.',
};

function applyStyles(shadow: ShadowRoot): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = styles;
    shadow.append(style);
  }
}

function isDark(): boolean {
  return document.documentElement.hasAttribute('dark');
}

/**
 * Mounts the neutral feed over YouTube's home grid. Designed to fail safe: any
 * error restores YouTube's own feed and shows a compact banner. YouTube's own
 * DOM is never destroyed — it is hidden and un-hidden.
 */
export class HomeFeedReplacer {
  private root: HTMLElement | null = null;
  private renderer: FeedRenderer | null = null;
  private grid: HTMLElement | null = null;
  private gridDisplay: string | null = null;
  private settings: Settings | null = null;
  private busy = false;
  private scheduled = false;
  private observer: MutationObserver | null = null;

  constructor(private readonly adapter: HomePageAdapter) {}

  start(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => {
      if (!this.adapter.isHome()) return;
      if (this.root?.isConnected) {
        this.updateTheme();
        return;
      }
      this.schedule();
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['dark'],
    });
  }

  /** Re-reads settings and (re)builds the feed. */
  async sync(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.run();
    } catch {
      this.unmount();
    } finally {
      this.busy = false;
    }
  }

  /** Used when settings change externally: rebuild from scratch. */
  reload(): void {
    this.unmount();
    void this.sync();
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    window.setTimeout(() => {
      this.scheduled = false;
      void this.sync();
    }, 250);
  }

  private async run(): Promise<void> {
    if (!this.adapter.isHome()) {
      this.unmount();
      return;
    }

    const settings = await sendMessage({ type: 'GET_SETTINGS' }).catch(() => null);
    if (!settings || !settings.enabled) {
      this.unmount();
      return;
    }

    const mount = await this.adapter.waitForMount();
    if (!mount) {
      // YouTube's home DOM is not what we expect — leave it completely alone.
      this.unmount();
      return;
    }

    if (!this.root) this.mountInto(mount, settings);
    this.settings = settings;
    await this.load(false);
  }

  private async load(force: boolean, animate = false): Promise<void> {
    if (!this.renderer || !this.settings) return;
    this.setGridHidden(true);
    this.renderer.renderLoading();
    try {
      const feed = await sendMessage({ type: 'GET_FEED', payload: { force } });
      this.renderer.renderFeed(feed, this.settings);
      if (animate) this.renderer.playReshuffle();
    } catch (error) {
      this.showBanner(error instanceof MessageError ? error.code : 'UNKNOWN');
    }
  }

  private mountInto(mount: HomeMount, settings: Settings): void {
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('data-theme', isDark() ? 'dark' : 'light');

    const shadow = root.attachShadow({ mode: 'open' });
    applyStyles(shadow);

    this.renderer = new FeedRenderer(
      shadow,
      {
        onOpenOptions: () => void this.openOptions(),
        onReshuffle: () => void this.reshuffle(),
      },
      settings,
    );

    mount.host.insertBefore(root, mount.grid);
    this.root = root;
    this.grid = mount.grid;
    this.gridDisplay = mount.grid.style.display;
  }

  private async openOptions(): Promise<void> {
    await sendMessage({ type: 'OPEN_OPTIONS' }).catch(() => undefined);
  }

  private async reshuffle(): Promise<void> {
    await sendMessage({ type: 'RESHUFFLE' }).catch(() => undefined);
    await this.load(true, true);
  }

  private showBanner(code: string): void {
    const renderer = this.renderer;
    if (!renderer) return;
    this.setGridHidden(false);

    if (code === 'NO_API_KEY') {
      renderer.renderBanner({
        title: 'DeTube needs a YouTube API key',
        message:
          'Add your own YouTube Data API v3 key to build a neutral, non-personalized discovery feed. YouTube is still available normally.',
        primary: { label: 'Open settings', onClick: () => void this.openOptions() },
        secondary: { label: 'Show YouTube home', onClick: () => this.unmount() },
      });
      return;
    }

    renderer.renderBanner({
      title: 'DeTube is temporarily unavailable',
      message: BANNER_MESSAGES[code] ?? BANNER_MESSAGES.UNKNOWN,
      primary: { label: 'Retry', onClick: () => void this.load(true) },
      secondary: { label: 'Show YouTube home', onClick: () => this.unmount() },
    });
  }

  private setGridHidden(hidden: boolean): void {
    if (!this.grid) return;
    this.grid.style.display = hidden ? 'none' : (this.gridDisplay ?? '');
  }

  private updateTheme(): void {
    this.root?.setAttribute('data-theme', isDark() ? 'dark' : 'light');
  }

  private unmount(): void {
    this.setGridHidden(false);
    this.renderer?.destroy();
    this.renderer = null;
    this.root?.remove();
    this.root = null;
    this.grid = null;
    this.gridDisplay = null;
    this.settings = null;
  }
}
