<!--
  Keep the title in Conventional Commit form, e.g. "fix: restore feed when the API 403s".
  See CONTRIBUTING.md for the project invariants a change must respect.
-->

## What does this change?

<!-- A short description of the problem and the approach. -->

## Why?

<!-- Motivation. Link any related issue: "Closes #123". -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behaviour change)
- [ ] Documentation
- [ ] Build / tooling / CI

## How was it tested?

<!-- Commands run, and what you did manually. -->

## Checklist

- [ ] `npm run verify` passes locally (typecheck, lint, format, tests, build)
- [ ] Tests added or updated for the behaviour change
- [ ] `CHANGELOG.md` updated under `## [Unreleased]` for user-visible changes
- [ ] No new **runtime** dependency (or a strong justification is given below)
- [ ] No new permission added without justification below
- [ ] Privacy invariants respected: no behaviour-derived personalization, no telemetry
- [ ] No `eval`, remote code, or `innerHTML` with dynamic data
- [ ] Any API-supplied URLs are still derived from validated ids
- [ ] Screenshots included for UI changes (light **and** dark)

## Notes for reviewers

<!-- Anything you are unsure about, or would like a second opinion on. -->
