import { Router } from 'express';
import mcpSchema from './schema.json';
import { McpToolRequest, McpToolResponse } from './types';
import { createMcpHandlers, McpDependencies } from './handlers';

export function createMcpRoutes(deps: McpDependencies): Router {
  const router = Router();
  const handlers = createMcpHandlers(deps);

  router.get('/mcp/schema', (_req, res) => {
    res.json(mcpSchema);
  });

  router.post('/mcp/tool', async (req, res) => {
    const body = req.body as McpToolRequest;
    const toolName = body?.name;

    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing tool name' } satisfies McpToolResponse);
    }

    const handler = handlers[toolName];
    if (!handler) {
      return res.status(404).json({ ok: false, error: `Unknown tool: ${toolName}` } satisfies McpToolResponse);
    }

    const idempotencyKey = (req.header('Idempotency-Key') || body.idempotencyKey) as string | undefined;
    const idempotencyService = deps.idempotencyService;

    try {
      if (idempotencyKey && idempotencyService) {
        const key = `mcp:${toolName}:${idempotencyKey}`;
        const cached = await idempotencyService.getResult<any>(key);
        if (cached) {
          return res.json({ ok: true, result: cached } satisfies McpToolResponse);
        }

        const result = await handler(body.params || {});
        await idempotencyService.markAsProcessed(key, 86400, result);
        return res.json({ ok: true, result } satisfies McpToolResponse);
      }

      const result = await handler(body.params || {});
      return res.json({ ok: true, result } satisfies McpToolResponse);
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message } satisfies McpToolResponse);
    }
  });

  return router;
}
