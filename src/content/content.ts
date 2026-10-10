import { HomePageAdapter } from './youtube/dom/HomePageAdapter';
import { HomeFeedReplacer } from './youtube/HomeFeedReplacer';

/**
 * Content-script entry point. YouTube is a single-page app, so we re-evaluate on
 * its navigation events, on URL changes, and via the replacer's MutationObserver
 * (which also re-asserts the mount if YouTube re-renders the home grid).
 */
const adapter = new HomePageAdapter();
const replacer = new HomeFeedReplacer(adapter);

function run(): void {
  void replacer.sync();
}

window.addEventListener('yt-navigate-finish', run);
window.addEventListener('yt-page-data-updated', run);
window.addEventListener('popstate', run);

// SPA fallback: YouTube does not always emit a navigation event for the home route.
let lastHref = location.href;
window.setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    run();
  }
}, 1_000);

// React to settings changes made in the Options page.
if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) replacer.reload();
  });
}

replacer.start();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
  run();
}
