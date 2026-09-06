# Contributing to @mcp-z/mcp-pdf

MCP server for creative PDF generation with full emoji, Unicode, and offline support

## Before Starting

A few conventions here differ from what you might expect:

- **Breaking changes over compatibility.** This project has no compatibility burden yet. Do not add back-compat layers, migration utilities, or wrappers for deprecated APIs - change the API cleanly and bump the major.
- **Keep it approachable.** This is a small community project, not an enterprise codebase. Prefer the simplest solution that fits in the existing files over new abstractions, frameworks, or shared infrastructure.
- **Tests use real components, not mocks.** Prefer exercising the real thing over standing up a fake.
- **Never write to stdout in server code.** MCP speaks JSON-RPC over stdio; a stray `console.log` corrupts the protocol stream. Use the injected logger, which writes to stderr.
- **Test scratch goes in the package's gitignored `.tmp/`**, never `os.tmpdir()`.

## Branches

Two lines. `master` is the current major and where all new work goes; `support/2.x` maintains the 2.x line for consumers who have not migrated.

    master            3.x    current    the v2 MCP SDK, both protocol eras
    support/2.x       2.x    security fixes only, cut at v2.2.1

Check which one you are on before editing:

```bash
git rev-parse --abbrev-ref HEAD
```

Features, dependency migrations and API changes go to `master` only. A security fix that also affects 2.x is **cherry-picked** to `support/2.x` — never merge the branches into each other, in either direction.

This file is the 2.x line's guide too. It lives only on `master` so it cannot drift between the lines; from `support/2.x`, read it with `git show master:CONTRIBUTING.md`.

Releasing `support/2.x` carries one trap. `npm publish` moves `latest` to the highest version published, so a 2.x release made after the next major exists must name its dist-tag or every bare `npm install @mcp-z/mcp-pdf` serves the old line:

```bash
npm publish --tag support-2
```

`prepublishOnly` refuses a bare publish from `support/*`, so forgetting the flag fails the publish rather than moving `latest`. `npm dist-tag add @mcp-z/mcp-pdf@<version> latest` reverses a mistake at any time.

## Pre-Commit Commands

Install ts-dev-stack globally if not already installed:

```bash
npm install -g ts-dev-stack
```

Run before committing - this builds, type-checks, lints, and tests:

```bash
tsds validate
```

`tsds validate` also runs automatically on `npm publish` via the `prepublishOnly` hook; a failure blocks the publish.

## Testing

```bash
npm test              # Run the test suite
npm run test:engines  # Run the suite across every supported Node version
```

Specs live in `test/unit/`, mirroring `src/`. Cross-service specs live in `test/integration/`. Both run under `npm test`.

## Package Development

See `README.md` for package overview and usage.
