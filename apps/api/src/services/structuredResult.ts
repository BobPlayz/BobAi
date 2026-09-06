export type ToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; retryable?: boolean };
  meta?: Record<string, unknown>;
};

export const success = <T>(data: T, meta?: Record<string, unknown>): ToolResult<T> => ({ ok: true, data, meta });
export const failure = (code: string, message: string, retryable = false): ToolResult => ({ ok: false, error: { code, message, retryable } });

const MAX_ERROR_CODE_LENGTH = 128;
const MAX_ERROR_MESSAGE_LENGTH = 4_000;
const MAX_META_KEYS = 50;

/**
 * Validate the untrusted result shape produced by an AI/tool provider before
 * the application treats it as a structured result. This intentionally does
 * not validate `data`, because each concrete tool owns its own data schema.
 */
export function parseToolResult(value: unknown): ToolResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.ok !== "boolean") return null;

  if (candidate.error !== undefined) {
    if (!candidate.error || typeof candidate.error !== "object" || Array.isArray(candidate.error)) return null;
    const error = candidate.error as Record<string, unknown>;
    if (typeof error.code !== "string" || error.code.length === 0 || error.code.length > MAX_ERROR_CODE_LENGTH) return null;
    if (typeof error.message !== "string" || error.message.length === 0 || error.message.length > MAX_ERROR_MESSAGE_LENGTH) return null;
    if (error.retryable !== undefined && typeof error.retryable !== "boolean") return null;
  }

  if (candidate.meta !== undefined) {
    if (!candidate.meta || typeof candidate.meta !== "object" || Array.isArray(candidate.meta)) return null;
    if (Object.keys(candidate.meta).length > MAX_META_KEYS) return null;
  }

  if (candidate.ok && candidate.error !== undefined) return null;
  if (!candidate.ok && candidate.error === undefined) return null;
  return candidate as ToolResult;
}
