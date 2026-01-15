export interface McpToolRequest {
  name: string;
  params?: Record<string, any>;
  idempotencyKey?: string;
}

export interface McpToolResponse {
  ok: boolean;
  result?: any;
  error?: string;
}

export type ToolHandler = (params: Record<string, any>) => Promise<any>;
