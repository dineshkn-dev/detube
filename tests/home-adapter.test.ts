import { beforeEach, describe, expect, it } from 'vitest';
import { HomePageAdapter } from '../src/content/youtube/dom/HomePageAdapter';

describe('HomePageAdapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reports the home route', () => {
    // jsdom's default pathname is "/".
    expect(new HomePageAdapter().isHome()).toBe(true);
  });

  it("finds the mount from YouTube's home grid", () => {
    document.body.innerHTML =
      '<ytd-browse page-subtype="home"><ytd-rich-grid-renderer></ytd-rich-grid-renderer></ytd-browse>';
    const mount = new HomePageAdapter().findMount();
    expect(mount).not.toBeNull();
    expect(mount?.grid.tagName.toLowerCase()).toBe('ytd-rich-grid-renderer');
    expect(mount?.host.tagName.toLowerCase()).toBe('ytd-browse');
  });

  it('returns null when the expected grid is absent (markup changed)', () => {
    document.body.innerHTML = '<div><p>unexpected markup</p></div>';
    expect(new HomePageAdapter().findMount()).toBeNull();
  });

  it('waits briefly for an asynchronously mounted grid', async () => {
    const adapter = new HomePageAdapter();
    document.body.innerHTML = '<ytd-browse></ytd-browse>';
    window.setTimeout(() => {
      document.body.innerHTML =
        '<ytd-browse><ytd-rich-grid-renderer></ytd-rich-grid-renderer></ytd-browse>';
    }, 200);
    const mount = await adapter.waitForMount(2_000);
    expect(mount).not.toBeNull();
  });
});
