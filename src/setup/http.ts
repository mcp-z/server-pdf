import { composeMiddleware, connectHttp, createFileServingRouter, McpServer, registerPrompts, registerResources, registerTools } from '@mcp-z/server';
import cors from 'cors';
import express from 'express';
import type { RuntimeOverrides, ServerConfig } from '../types.ts';
import { createDefaultRuntime } from './runtime.ts';

export async function createHTTPServer(config: ServerConfig, overrides?: RuntimeOverrides) {
  const runtime = await createDefaultRuntime(config, overrides);
  const modules = runtime.createDomainModules();
  const layers = runtime.middlewareFactories.map((factory) => factory(runtime.deps));
  const composed = composeMiddleware(modules, layers);
  const logger = runtime.deps.logger;
  const port = config.transport.port;
  if (!port) throw new Error('Port is required for HTTP transport');

  // A factory, not a shared instance. The underlying Protocol object's `_negotiatedWireCodec()`
  // reads an instance field (`_negotiatedProtocolVersion`) that the FIRST request served
  // sets and every later request on that same object inherits - by the SDK's own doc comment,
  // "a negotiated session never re-routes a method onto the other era" (@modelcontextprotocol/
  // server dist, `_resolveOutboundCodec`). A shared instance therefore pins itself to whichever
  // era's request it serves first, and a later request from the OTHER era gets "Method not
  // found" (-32601) on `initialize` - reproduced against this exact router with a bare instance
  // (fails) vs. a factory (passes), both with and without an app-level body parser upstream, run
  // repeatedly for determinism. A fresh instance per request means each negotiates its own era.
  const buildServer = () => {
    const mcpServer = new McpServer({ name: config.name, version: config.version });
    registerTools(mcpServer, composed.tools);
    registerResources(mcpServer, composed.resources);
    registerPrompts(mcpServer, composed.prompts);
    return mcpServer;
  };

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Must mount '/mcp' before any permissive app-level cors(), or that layer answers its
  // preflight first; pass baseUrl's origin/host below or a public deployment 403s itself.
  const publicUrl = config.baseUrl ? new URL(config.baseUrl) : undefined;
  logger.info(`Starting ${config.name} MCP server (http)`);
  const { close, httpServer } = await connectHttp(buildServer, {
    logger,
    app,
    port,
    allowedOrigins: publicUrl ? [publicUrl.origin] : undefined,
    allowedHosts: publicUrl ? [publicUrl.host] : undefined,
  });

  // '/files' serves generated PDFs by content-addressed name and reads no auth
  // state, so it's fine to keep this reachable cross-origin - scoped to this route
  // only, never in front of '/mcp'.
  const fileRouter = createFileServingRouter(
    { resourceStoreUri: config.resourceStoreUri },
    {
      contentType: 'application/pdf',
      contentDisposition: 'attachment',
    }
  );
  app.use('/files', cors(), fileRouter);

  logger.info('http transport ready');

  return {
    httpServer,
    logger,
    close: async () => {
      await close();
      await runtime.close();
    },
  };
}
