# Privacy Policy

DeTube exists because its author did not want a behavioural recommendation engine deciding what to
watch. Accordingly, it collects as close to nothing as a working extension can.

**Short version: DeTube has no servers, no analytics, no telemetry, and no tracking. Your settings
and your API key never leave your browser, except as parameters on requests you make directly to
Google's YouTube Data API.**

## What is stored, and where

Everything is stored locally in `chrome.storage.local`, on your machine only. Nothing is synced to
your Google account or to any server operated by this project.

| Item                      | Purpose                                                            | Notes                                             |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| Your settings             | Feed, topic, channel and filter preferences                        | Plain JSON in `chrome.storage.local`              |
| Your YouTube Data API key | Authenticating your requests to Google                             | Stored as a separate local key; enter it yourself |
| A daily quota counter     | Showing usage in Options and warning before Google rate-limits you | Date + approximate unit and search-call counts    |

Clearing the extension's storage, or removing the extension, deletes all of it. There is no backup
and nothing to delete elsewhere.

## What leaves your browser

The only outbound network requests DeTube makes are to:

```
https://www.googleapis.com/youtube/v3/*
```

These requests contain your API key, a region code, and the category, query or channel parameters
needed to fetch the feed. Google receives them as the API operator and handles them under its own
privacy policy and the YouTube API Services Terms of Service.

If you connect a YouTube account for the Subscriptions feed, `chrome.identity` obtains an OAuth token
with the single scope `https://www.googleapis.com/auth/youtube.readonly`. The token is held by
Chrome's identity layer, is used only to read your subscription list, and is never transmitted
anywhere except to Google's API as an `Authorization` header.

There is no other network traffic. Specifically, DeTube does **not** contact any analytics service,
error reporter, update server, CDN, or third-party endpoint.

## What is never collected

- Watch history, or any inference drawn from it
- Clicks, hovers, scroll depth or dwell time
- Likes, dislikes, comments or subscriptions (beyond reading your list if you opt in)
- Search history
- Session length, visit frequency, or "engagement" of any kind
- Your YouTube account identity, email address or profile
- Crash reports, diagnostics, or device fingerprints

DeTube does not build a profile of you. It cannot: it deliberately has nowhere to put one.

## How the feed is decided

Ranking uses only signals that are the same for everyone and are attached to the _video_ rather than
to you: publication date, general view count, the topic category you enabled, the channel/diversity
caps, and a seeded pseudo-random shuffle whose seed you can change with **Reshuffle**.

Personalisation happens only through choices you make explicitly — enabling a category, adding a
topic, adding or excluding a channel, or connecting subscriptions. Nothing is inferred from your
behaviour, and there is no "learning" that adapts to what you click.

## Third parties

- **Google / YouTube** — the API you query with your own key. See
  [Google's Privacy Policy](https://policies.google.com/privacy) and the
  [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service).
- Nobody else. DeTube bundles no third-party SDKs and has zero runtime dependencies.

## Data retention

API responses are cached in memory for a few minutes so a feed refresh does not re-spend your quota.
That cache lives in the service worker, is never written to disk, and disappears when the worker is
suspended. Nothing from the API is stored persistently.

## Children

DeTube is not directed at children and collects no personal information from anyone.

## Changes

Any change to this policy will appear in this file and in `CHANGELOG.md`. Because the project has no
data to migrate, changes can only ever be reductions in what is described here.

## Contact

Questions or concerns: **hyperati.labs@gmail.com**, or open an issue on GitHub.
