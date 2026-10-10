# Security Policy

## Supported versions

DeTube is pre-1.0; only the latest release receives security fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting (**Security → Report a vulnerability**) if it is enabled,
or email **hyperati.labs@gmail.com** with:

- a description of the issue and its impact,
- steps to reproduce (a minimal proof of concept helps enormously),
- the DeTube version, Chrome version and operating system,
- whether you are willing to be credited.

You will get an acknowledgement, and we will work with you on a fix and a coordinated disclosure. We
do not publish response-time commitments, but security reports are prioritised above everything else.

## In scope

- The extension's own code: `src/background`, `src/content`, `src/options`, `src/popup`,
  `src/storage`, `src/shared`, and the build scripts.
- The permission model in `manifest.json` (excessive or unnecessary permissions).
- Injection issues: markup injection, DOM clobbering, prototype pollution, XSS in any surface.
- Handling of the user's YouTube Data API key, and of OAuth tokens.
- Anything that causes data to leave the browser that is not a request to
  `https://www.googleapis.com/youtube/v3/*`.

## Out of scope

- Vulnerabilities in YouTube or Google's own services.
- The behaviour of YouTube's recommendation algorithm.
- Extensions other than DeTube, or a browser profile already compromised by something else.
- Requests for features that intentionally weaken the privacy posture (no personalised ranking
  derived from behaviour, no telemetry — these are by design, not bugs).
- Issues that require the user to install a modified build.

## Security properties this project maintains

These are deliberate, and a report showing one of them is broken is always in scope:

1. **No `eval` and no remote code.** The MV3 CSP (`script-src 'self'; object-src 'self'`) is left at
   its default; nothing injects remote JavaScript.
2. **No dynamic markup.** API data is written with `textContent`; DOM is constructed with
   `createElement`. There is no `innerHTML` on dynamic data anywhere in `src/`.
3. **No API-supplied URLs are trusted.** Thumbnails and outbound links are derived from validated
   ids (`src/shared/validate.ts`), so a hostile API response cannot redirect navigation.
4. **Least privilege.** Permissions are `storage`, `identity`, `host_permissions` for
   `https://www.googleapis.com/*` only, and a content script scoped to `https://www.youtube.com/*`.
   No `tabs`, `scripting`, `webRequest`, `cookies` or `<all_urls>`.
5. **The API key stays local.** It is stored in `chrome.storage.local`, never logged, and never sent
   to any host other than `www.googleapis.com`.
6. **No telemetry.** There is no analytics, crash reporting or third-party endpoint of any kind.

## Supply chain

DeTube has **zero runtime dependencies**. Development dependencies are limited to
esbuild, TypeScript, ESLint, Prettier, Vitest, jsdom and type definitions. Dependabot is enabled, and
CI verifies the build from a clean `npm ci` on every pull request.

The extension icons are generated locally by `scripts/icons.mjs` using only Node's built-in `zlib`,
specifically to avoid pulling in a native image library.
