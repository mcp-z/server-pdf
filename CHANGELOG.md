# Changelog

## [3.1.0] - 2026-09-06

### Added

- Serves the 2026-07-28 MCP protocol revision alongside the existing 2025 revision, over both HTTP and stdio. A client speaking either one reaches the same tools; the 2026 revision is stateless, so such a client sends no `initialize` handshake. Legacy 2025 clients are unaffected.

### Fixed

- The MCP server is now built per request (HTTP) and per connection (stdio) rather than shared. The SDK caches the negotiated protocol revision on the server instance, so a shared one pinned itself to whichever revision arrived first and answered the other with `-32601 Method not found`.

## [3.0.0] - 2026-09-06

### Changed

- Migrated to the v2 MCP SDK by way of `@mcp-z/server` 2.x. Error types are `ProtocolError` / `ProtocolErrorCode` (the wire codes are unchanged), and the SDK surface is reached through `@mcp-z/server` rather than imported directly.
- The 2.x line is maintained on `support/2.x` and published under the `support-2` dist-tag.

## [2.2.1] - 2026-09-05

### Fixed

- Origin validation and loopback bind for the HTTP transport (DNS rebinding).

## [2.2.0] - 2026-09-02

### Removed

- Obsolete PDF resume tests and fixtures.

## [2.1.0] - 2026-08-29

### Changed

- Dependency refresh.

## [2.0.0] - 2025-12-28

Initial 2.x release.
