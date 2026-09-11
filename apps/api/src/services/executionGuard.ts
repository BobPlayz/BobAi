export const MAX_EXECUTION_RESULT_BYTES = 2 * 1024 * 1024;
export const MAX_EXECUTION_RESULT_ITEMS = 200;
export const MAX_EXECUTION_STRING_BYTES = 100_000;

export function boundedExecutionResult<T>(value: T): T {
  const encoded = JSON.stringify(value);
  if (encoded.length > MAX_EXECUTION_RESULT_BYTES) throw new Error("execution result exceeds the 2 MB limit");
  if (Array.isArray(value) && value.length > MAX_EXECUTION_RESULT_ITEMS) throw new Error("execution result contains too many items");
  return value;
}

export function boundedString(value: string, maxBytes = MAX_EXECUTION_STRING_BYTES) {
  if (typeof value !== "string") throw new Error("execution result contains a non-string value");
  if (Buffer.byteLength(value, "utf8") > maxBytes) throw new Error("execution result string is too large");
  return value;
}

export function assertSafeActionName(name: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(name)) throw new Error("invalid executable action name");
  return name;
}
