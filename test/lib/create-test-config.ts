import type { ServerConfig } from '@mcp-z/mcp-pdf';

export function createTestConfig(testOutputDir: string, testStorageDir: string, transport: ServerConfig['transport'] = { type: 'stdio' }): ServerConfig {
  return {
    name: 'mcp-pdf-test',
    version: '1.0.0',
    logLevel: 'silent',
    baseDir: testOutputDir,
    resourceStoreUri: `file://${testStorageDir}`,
    transport,
  };
}
