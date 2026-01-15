import { Router } from 'express';
import { createMcpRoutes } from './routes';
import { McpDependencies } from './handlers';

export function createMcpServer(deps: McpDependencies): Router {
  return createMcpRoutes(deps);
}
