# Contributing to DeTube

Thanks for wanting to help. DeTube is a small, deliberately boring codebase: no framework, no
runtime dependencies, and a strict privacy posture. Contributions that respect those constraints are
very welcome.

## Contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Getting set up](#getting-set-up)
- [Project layout](#project-layout)
- [Making a change](#making-a-change)
- [Project invariants](#project-invariants)
- [Tests](#tests)
- [Commit and PR conventions](#commit-and-pr-conventions)

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree to
uphold it.

## Ways to contribute

- **Bug reports** — use the issue template and include the extension version and console output.
- **Feature proposals** — open an issue first for anything large. DeTube has opinions about what it
  will _not_ do (see the invariants), so a quick discussion saves everyone time.
- **Pull requests** — small, focused, one concern per PR.

## Getting set up

```bash
git clone https://github.com/dineshkn-dev/detube.git
cd detube
npm install --include=dev   # --include=dev guards against npm configs that omit dev deps
npm run build               # bundles to dist/
```

Load the result in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
choose `dist/`. Reload the extension and the YouTube tab after each rebuild (or run `npm run dev` to
watch).

To exercise the feed you need your own YouTube Data API v3 key — see the README.

## Project layout

```
src/
  background/     service worker: the only place that touches the network
    api/          typed YouTube client, response parsers, quota tracker, TTL cache
    sources/      Trending, Category, ChannelUploads, SearchTopic, Subscription
    feed/         categories, filter, ranker, diversity, FeedService  ← pure TS, no browser APIs
    auth/         chrome.identity OAuth (youtube.readonly)
    messaging/    the typed content ↔ worker contract
  content/        YouTube DOM integration; the feed UI lives in a Shadow DOM
  options/ popup/ vanilla-TS extension pages
  ui/             shared design tokens and the brand mark
  storage/        typed chrome.storage.local settings
tests/            vitest (jsdom + node)
scripts/          esbuild build pipeline and the dependency-free icon generator
```

The boundary that matters: **the feed engine must stay free of browser APIs** so it remains
unit-testable in Node. If you need `window` or `chrome` there, you're in the wrong layer.

## Making a change

1. Branch from `main`.
2. Make the smallest change that solves the problem.
3. Add or update tests — see below for what is expected.
4. Run the full gate: `npm run verify`.
5. Open a PR using the template.

## Project invariants

These are not preferences; PRs that break them will be declined.

1. **No implied personalization.** Nothing may be inferred from watch history, clicks, hovers,
   likes, search history or session length. Personalization comes only from explicit user choices.
2. **No telemetry.** No analytics, no remote logging, no third-party endpoints. The only outbound
   requests are to `https://www.googleapis.com/youtube/v3/*`.
3. **No `eval`, no remote code.** MV3's default CSP stays as-is. Do not add `unsafe-eval`,
   `unsafe-inline`, or remote script URLs.
4. **No `innerHTML` with dynamic data.** Build DOM with `createElement` and set values with
   `textContent`. Never interpolate API data into markup.
5. **Never trust API-supplied URLs.** Derive thumbnails and links from validated ids
   (`src/shared/validate.ts`).
6. **Least privilege.** Do not add a permission (or a host permission) without a concrete, documented
   need in the same PR.
7. **Runtime dependencies stay at zero.** Dev dependencies are fine when they earn their place; a new
   _runtime_ dependency needs a strong justification.
8. **YouTube's DOM stays isolated.** All knowledge of YouTube's markup belongs behind
   `HomePageAdapter`. Never destroy YouTube's own nodes — hide and restore.
9. **Fail safe.** Any extension error must leave YouTube usable.

## Tests

- Every behavioural change needs a test. Bug fixes should come with a regression test.
- Pure logic (ranking, filtering, diversity, randomization, parsing, settings) belongs in a plain
  Node/jsdom test with no mocks beyond a fake `fetch` or a memory storage shim.
- The feed engine is deterministic. When testing it, pass an explicit `nowMs` and `seed` — never rely
  on the clock.
- A file that needs Node built-ins must start with `// @vitest-environment node`; everything else runs
  in jsdom.
- `npm run verify` must be green before review. It runs typecheck, lint, format check, tests and a
  production build.

## Commit and PR conventions

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, `perf:`, `build:`, `ci:`, `chore:`.
- Keep the subject in the imperative mood and under ~72 characters.
- One logical change per PR; unrelated cleanups belong in their own PR.
- Update `CHANGELOG.md` under `## [Unreleased]` for user-visible changes.
- For UI changes, include before/after screenshots in the PR description (light and dark).
