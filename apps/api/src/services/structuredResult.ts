export type ToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; retryable?: boolean };
  meta?: Record<string, unknown>;
};

export const success = <T>(data: T, meta?: Record<string, unknown>): ToolResult<T> => ({ ok: true, data, meta });
export const failure = (code: string, message: string, retryable = false): ToolResult => ({ ok: false, error: { code, message, retryable } });
