const MAX_STRING_LENGTH = 8_000;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_DEPTH = 6;

function validate(value: unknown, depth: number): unknown {
  if (depth > MAX_OBJECT_DEPTH) throw new Error("capability input is too deeply nested");
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) throw new Error("capability input contains an oversized string");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) throw new Error("capability input contains an oversized array");
    return value.map((item) => validate(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.length > 256) throw new Error("capability input contains an oversized key");
      result[key] = validate(item, depth + 1);
    }
    return result;
  }
  return value;
}

export function validateCapabilityInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("capability input must be a JSON object");
  }
  return validate(input, 0) as Record<string, unknown>;
}
