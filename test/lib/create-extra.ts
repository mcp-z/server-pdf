import type { CallToolResult, StandardSchemaWithJSON } from '@mcp-z/server';
import pino from 'pino';
import type { ServerConfig, StorageContext, StorageExtra } from '../../src/types.ts';

/**
 * Typed handler signature for test files
 * Use with tool's Input type: `let handler: TypedHandler<Input>;`
 */
export type TypedHandler<I, E = StorageExtra> = (input: I, extra: E) => Promise<CallToolResult>;

/**
 * Base Extra interface for MCP server context
 * (matches EnrichedExtra from servers with auth)
 */
export interface BaseExtra {
  signal: AbortSignal;
  requestId: string;
  sendNotification: (notification: unknown) => Promise<void>;
  sendRequest: <U extends StandardSchemaWithJSON>(request: unknown) => Promise<StandardSchemaWithJSON.InferOutput<U>>;
  logger: pino.Logger;
}

export function createStorageContext(config: Pick<ServerConfig, 'resourceStoreUri' | 'baseUrl' | 'transport'>): StorageContext {
  return {
    resourceStoreUri: config.resourceStoreUri,
    baseUrl: config.baseUrl,
    transport: config.transport,
  };
}

/**
 * Create Extra for testing (with or without storage context)
 *
 * In production, the middleware automatically creates and passes this object.
 * In tests, we call handlers directly, so we need to provide it ourselves.
 */
export function createExtra(): BaseExtra;
export function createExtra(storageContext: StorageContext): BaseExtra & StorageExtra;
export function createExtra(storageContext?: StorageContext): BaseExtra {
  const extra: BaseExtra & Partial<StorageExtra> = {
    signal: new AbortController().signal,
    requestId: 'test-request-id',
    sendNotification: async () => {},
    sendRequest: async <U extends StandardSchemaWithJSON>() => ({}) as StandardSchemaWithJSON.InferOutput<U>,
    logger: pino({ level: 'silent' }),
    ...(storageContext ? { storageContext } : {}),
  };

  return extra as BaseExtra;
}
