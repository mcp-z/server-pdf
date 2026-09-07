import { composeMiddleware, connectStdio, McpServer, registerPrompts, registerResources, registerTools } from '@mcp-z/server';
import type { RuntimeOverrides, ServerConfig } from '../types.ts';
import { createDefaultRuntime } from './runtime.ts';

export async function createStdioServer(config: ServerConfig, overrides?: RuntimeOverrides) {
  const runtime = await createDefaultRuntime(config, overrides);
  const modules = runtime.createDomainModules();
  const layers = runtime.middlewareFactories.map((factory) => factory(runtime.deps));
  const composed = composeMiddleware(modules, layers);
  const logger = runtime.deps.logger;

  // A factory, not a shared instance: a stdio server normally serves one connection per
  // process, but `serveStdio` still calls the factory once per connection so a process that
  // outlives its first connection negotiates each new one independently - see setup/http.ts
  // for the demonstrated mechanism (an instance's negotiated era, once set, pins every later
  // request or connection on that same object to it).
  const buildServer = () => {
    const mcpServer = new McpServer({ name: config.name, version: config.version });
    registerTools(mcpServer, composed.tools);
    registerResources(mcpServer, composed.resources);
    registerPrompts(mcpServer, composed.prompts);
    return mcpServer;
  };

  logger.info(`Starting ${config.name} MCP server (stdio)`);
  const { close } = await connectStdio(buildServer, { logger });
  logger.info('stdio transport ready');

  return {
    logger,
    close: async () => {
      await close();
      await runtime.close();
    },
  };
}
