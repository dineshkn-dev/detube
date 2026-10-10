export interface HomeMount {
  /** Element our feed root is inserted into (the grid's parent). */
  host: HTMLElement;
  /** YouTube's own home grid, hidden while the neutral feed is shown. */
  grid: HTMLElement;
}

const GRID_SELECTOR = 'ytd-rich-grid-renderer';

/**
 * The single place that knows about YouTube's home DOM. Everything else talks in
 * terms of a HomeMount, so a YouTube markup change is contained here. When the
 * expected containers are absent we return null and the extension backs off
 * rather than guessing.
 */
export class HomePageAdapter {
  isHome(): boolean {
    return location.pathname.replace(/\/+$/, '') === '';
  }

  findMount(): HomeMount | null {
    const grid = document.querySelector<HTMLElement>(GRID_SELECTOR);
    const host = grid?.parentElement;
    if (!grid || !host) return null;
    return { host, grid };
  }

  /** Polls briefly because YouTube mounts the home grid asynchronously. */
  async waitForMount(timeoutMs = 4_000): Promise<HomeMount | null> {
    const immediate = this.findMount();
    if (immediate) return immediate;

    return new Promise((resolve) => {
      const start = Date.now();
      const tick = (): void => {
        const mount = this.findMount();
        if (mount) {
          resolve(mount);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(null);
          return;
        }
        window.setTimeout(tick, 150);
      };
      tick();
    });
  }
}
