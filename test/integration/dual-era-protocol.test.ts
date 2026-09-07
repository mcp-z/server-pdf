/**
 * Proves the 2026-07-28 MCP protocol revision reaches a real mcp-pdf tool end to end,
 * on both HTTP (in-process `setup.createHTTPServer`) and stdio (spawned `bin/server.js`),
 * and that a legacy 2025 client still works against the very same server (plan 04).
 *
 * Follows the pattern `@mcp-z/server`'s own `test/unit/transports/{http,stdio}.test.ts`
 * use for cross-era coverage: a 2026-07-28 client pinned via `versionNegotiation` (no
 * `initialize` handshake) alongside a 2025-era `@modelcontextprotocol/sdk` client.
 */

import { setup } from '@mcp-z/mcp-pdf';
import { Client as ModernClient, StreamableHTTPClientTransport as ModernStreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport as ModernStdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client as LegacyClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport as LegacyStdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport as LegacyStreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'assert';
import { mkdirSync, writeFileSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import getPort from 'get-port';
import * as path from 'path';
import { createTestConfig } from '../lib/create-test-config.ts';

const TEXT_MEASURE_ARGS = { items: [{ text: 'mcp-z-2026' }] };

function assertMeasurement(structuredContent: unknown): void {
  const output = structuredContent as { measurements?: Array<{ text?: string; width?: number }> } | undefined;
  assert.ok(Array.isArray(output?.measurements), 'expected a measurements array');
  assert.strictEqual(output?.measurements[0]?.text, 'mcp-z-2026');
  assert.ok(typeof output?.measurements[0]?.width === 'number' && output.measurements[0].width > 0, 'expected a positive measured width');
}

describe('2026-07-28 protocol reaches mcp-pdf tools end to end (plan 04)', () => {
  describe('HTTP transport (setup.createHTTPServer -> connectHttp)', () => {
    const testOutputDir = path.join(process.cwd(), '.tmp', 'dual-era-http');
    const testStorageDir = path.join(testOutputDir, 'storage');
    let close: () => Promise<void>;
    let url: string;

    before(async () => {
      mkdirSync(testStorageDir, { recursive: true });
      const port = await getPort();
      const config = createTestConfig(testOutputDir, testStorageDir, { type: 'http', port });
      const server = await setup.createHTTPServer(config);
      close = server.close;
      url = `http://127.0.0.1:${port}/mcp`;
    });

    after(async () => {
      await close();
      safeRmSync(testOutputDir, { recursive: true, force: true });
    });

    it('serves a 2026-07-28 client end-to-end without an initialize handshake', async () => {
      const client = new ModernClient({ name: 'modern-http-test-client', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
      const transport = new ModernStreamableHTTPClientTransport(new URL(url));
      try {
        await client.connect(transport);

        const { tools } = await client.listTools();
        assert.ok(
          tools.find((t) => t.name === 'text-measure'),
          'modern client should see the text-measure tool'
        );

        const result = await client.callTool({ name: 'text-measure', arguments: TEXT_MEASURE_ARGS });
        assertMeasurement(result.structuredContent);
      } finally {
        await client.close();
      }
    });

    it('serves a legacy 2025 client end-to-end on the same server', async () => {
      const client = new LegacyClient({ name: 'legacy-http-test-client', version: '1.0.0' });
      const transport = new LegacyStreamableHTTPClientTransport(new URL(url));
      try {
        await client.connect(transport);

        const { tools } = await client.listTools();
        assert.ok(
          tools.find((t) => t.name === 'text-measure'),
          'legacy client should see the text-measure tool'
        );

        const result = await client.callTool({ name: 'text-measure', arguments: TEXT_MEASURE_ARGS });
        assertMeasurement(result.structuredContent);
      } finally {
        await client.close();
      }
    });
  });

  // serveStdio() pins the protocol era per connection at the opening exchange, so proving
  // both eras needs two separate spawns of the same server binary - one spawn cannot serve
  // two concurrent clients over its single stdin/stdout pipe.
  describe('stdio transport (spawned bin/server.js -> connectStdio)', () => {
    const packageRoot = process.cwd();
    const binPath = path.join(packageRoot, 'bin', 'server.js');
    const testOutputDir = path.join(packageRoot, '.tmp', 'dual-era-stdio');

    // `parseConfig` derives `baseDir` (and thus the pino log file location) by searching
    // upward from the spawned process's cwd for a `.mcp.json`, stopping at the home
    // directory (src/setup/config.ts, src/lib/find-config-path.ts in @mcp-z/server). Placing
    // one directly in the scratch cwd keeps every write - logs included - confined to .tmp/
    // instead of the real ~/.mcp-z.
    function makeSpawnCwd(name: string): { spawnCwd: string; resourceStoreUri: string } {
      const spawnCwd = path.join(testOutputDir, name);
      mkdirSync(spawnCwd, { recursive: true });
      writeFileSync(path.join(spawnCwd, '.mcp.json'), '{}');
      return { spawnCwd, resourceStoreUri: `file://${path.join(spawnCwd, 'files')}` };
    }

    after(() => {
      safeRmSync(testOutputDir, { recursive: true, force: true });
    });

    it('serves a 2026-07-28 client end-to-end without an initialize handshake', async () => {
      const { spawnCwd, resourceStoreUri } = makeSpawnCwd('modern');
      const client = new ModernClient({ name: 'modern-stdio-test-client', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
      const transport = new ModernStdioClientTransport({ command: 'node', args: [binPath, `--resource-store-uri=${resourceStoreUri}`, '--log-level=silent'], cwd: spawnCwd });
      try {
        await client.connect(transport);

        const { tools } = await client.listTools();
        assert.ok(
          tools.find((t) => t.name === 'text-measure'),
          'modern client should see the text-measure tool'
        );

        const result = await client.callTool({ name: 'text-measure', arguments: TEXT_MEASURE_ARGS });
        assertMeasurement(result.structuredContent);
      } finally {
        await client.close();
      }
    });

    it('serves a legacy 2025 client end-to-end on the same server binary', async () => {
      const { spawnCwd, resourceStoreUri } = makeSpawnCwd('legacy');
      const client = new LegacyClient({ name: 'legacy-stdio-test-client', version: '1.0.0' });
      const transport = new LegacyStdioClientTransport({ command: 'node', args: [binPath, `--resource-store-uri=${resourceStoreUri}`, '--log-level=silent'], cwd: spawnCwd });
      try {
        await client.connect(transport);

        const { tools } = await client.listTools();
        assert.ok(
          tools.find((t) => t.name === 'text-measure'),
          'legacy client should see the text-measure tool'
        );

        const result = await client.callTool({ name: 'text-measure', arguments: TEXT_MEASURE_ARGS });
        assertMeasurement(result.structuredContent);
      } finally {
        await client.close();
      }
    });
  });
});
