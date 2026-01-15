import { Router } from 'express';
import mcpSchema from './schema.json';
import { McpToolRequest, McpToolResponse } from './types';
import { createMcpHandlers, McpDependencies } from './handlers';

export function createMcpRoutes(deps: McpDependencies): Router {
  const router = Router();
  const handlers = createMcpHandlers(deps);

  const listTools = () =>
    (mcpSchema.tools || []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input || { type: 'object', properties: {} }
    }));

  const buildToolResult = (result: any) => ({
    content: [{ type: 'text', text: JSON.stringify(result ?? {}) }]
  });

  const handleToolCall = async (toolName: string, params: Record<string, any>, idempotencyKey?: string) => {
    const handler = handlers[toolName];
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const idempotencyService = deps.idempotencyService;
    if (idempotencyKey && idempotencyService) {
      const key = `mcp:${toolName}:${idempotencyKey}`;
      const cached = await idempotencyService.getResult<any>(key);
      if (cached) {
        return cached;
      }

      const result = await handler(params || {});
      await idempotencyService.markAsProcessed(key, 86400, result);
      return result;
    }

    return handler(params || {});
  };

  router.get('/mcp/schema', (_req, res) => {
    res.json(mcpSchema);
  });

  const handleJsonRpc = async (req: any, res: any) => {
    const body = req.body as { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };
    const id = body?.id ?? null;
    const method = body?.method;

    if (body?.jsonrpc !== '2.0' || typeof method !== 'string') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid JSON-RPC request' }
      });
    }

    try {
      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: { list: true, call: true } },
            serverInfo: { name: mcpSchema.name || 'herocity-mcp', version: mcpSchema.version || '1.0.0' }
          }
        });
      }

      if (method === 'tools/list' || method === 'listTools') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: { tools: listTools() }
        });
      }

      if (method === 'tools/call') {
        const params = body?.params || {};
        const toolName = params?.name;
        const args = params?.arguments || params?.params || {};
        const idempotencyKey = (req.header('Idempotency-Key') || params?.idempotencyKey) as string | undefined;

        if (!toolName || typeof toolName !== 'string') {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Missing tool name' }
          });
        }

        const result = await handleToolCall(toolName, args, idempotencyKey);
        return res.json({ jsonrpc: '2.0', id, result: buildToolResult(result) });
      }

      if (method === 'ping') {
        return res.json({ jsonrpc: '2.0', id, result: {} });
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
    } catch (error: any) {
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: error?.message || 'Unexpected error' }
      });
    }
  };

  router.post('/mcp', handleJsonRpc);

  router.post('/mcp/tool', async (req, res) => {
    const body = req.body as McpToolRequest & { jsonrpc?: string; method?: string; params?: any };

    if (body?.jsonrpc === '2.0' && typeof body?.method === 'string') {
      return handleJsonRpc(req, res);
    }

    const toolName = body?.name;

    if (!toolName || typeof toolName !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing tool name' } satisfies McpToolResponse);
    }

    const idempotencyKey = (req.header('Idempotency-Key') || body.idempotencyKey) as string | undefined;

    try {
      const result = await handleToolCall(toolName, body.params || {}, idempotencyKey);
      return res.json({ ok: true, result } satisfies McpToolResponse);
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message } satisfies McpToolResponse);
    }
  });

  return router;
}
