import { composeMiddleware, connectStdio, McpServer, registerPrompts, registerResources, registerTools } from '@mcp-z/server';
import type { RuntimeOverrides, ServerConfig } from '../types.ts';
import { createDefaultRuntime } from './runtime.ts';

export async function createStdioServer(config: ServerConfig, overrides?: RuntimeOverrides) {
  const runtime = await createDefaultRuntime(config, overrides);
  const modules = runtime.createDomainModules();
  const layers = runtime.middlewareFactories.map((factory) => factory(runtime.deps));
  const composed = composeMiddleware(modules, layers);
  const logger = runtime.deps.logger;

  const mcpServer = new McpServer({ name: config.name, version: config.version });
  registerTools(mcpServer, composed.tools);
  registerResources(mcpServer, composed.resources);
  registerPrompts(mcpServer, composed.prompts);

  logger.info(`Starting ${config.name} MCP server (stdio)`);
  const { close } = await connectStdio(mcpServer, { logger });
  logger.info('stdio transport ready');

  return {
    mcpServer,
    logger,
    close: async () => {
      await close();
      await runtime.close();
    },
  };
}
