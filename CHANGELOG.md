# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-10

First public release.

### Added

- **Neutral feed** rendered over the YouTube home page, replacing YouTube's personalized
  recommendation grid while leaving the rest of YouTube untouched.
- **Deterministic ranking engine** (pure TypeScript, browser-free, unit-tested):
  dedupe → filter → score → diversity → seeded shuffle. Blends freshness, general popularity and
  topic relevance, with a controllable randomization level. Not optimized for watch time or clicks.
- **General (non-personalized) sources**: region trending chart, per-category charts, channel uploads
  and keyword/topic discovery, plus an OAuth-backed Subscriptions feed.
- **Extensible category registry** — categories are data (`chart` / `search` / `topic` kinds), not
  hard-coded branches.
- **Explicit-only personalization**: enable/disable categories, custom topics, include/exclude
  channels, connect subscriptions. Nothing is inferred from behaviour.
- **Content filters**: hide Shorts (best-effort heuristic), hide livestreams, duration bounds, and an
  opt-in clickbait heuristic.
- **Options page** with a live quota meter, category pill toggles and channel allow/deny lists.
- **Popup** with an enable switch, status and a reshuffle action.
- **Graceful degradation**: API, quota, network and key failures restore YouTube's own home and show
  a compact, explanatory banner.
- **Prism/spectrum design system** with shared semantic tokens consumed by the Shadow-DOM feed and
  both extension pages; icons generated at build time with zero image dependencies.

### Security

- No `eval`, no remote code, MV3 default CSP.
- All API data rendered via `textContent`; no markup interpolation.
- Thumbnails and links derived from validated video/channel ids — never from API-supplied URLs.
- Least-privilege manifest: `storage`, `identity`, one API host, one content-script origin.
- The YouTube Data API key is user-supplied, stored only in `chrome.storage.local`, and never sent
  anywhere other than `www.googleapis.com`.

[Unreleased]: https://github.com/dineshkn-dev/detube/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dineshkn-dev/detube/releases/tag/v0.1.0
