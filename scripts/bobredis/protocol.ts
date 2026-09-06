export function simple(value: string): Buffer { return Buffer.from(`+${value}\r\n`); }
export function error(value: string): Buffer { return Buffer.from(`-${value}\r\n`); }
export function integer(value: number): Buffer { return Buffer.from(`:${value}\r\n`); }
export function bulk(value: string | null): Buffer {
  if (value === null) return Buffer.from("$-1\r\n");
  return Buffer.from(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
}
export function array(values: Buffer[]): Buffer { return Buffer.concat([Buffer.from(`*${values.length}\r\n`), ...values]); }

export function parseResp(buffer: Buffer): { command?: string[]; rest: Buffer } {
  if (!buffer.length) return { rest: buffer };
  const text = buffer.toString("utf8");
  if (!text.startsWith("*")) {
    const end = text.indexOf("\r\n");
    if (end < 0) return { rest: buffer };
    return { command: text.slice(0, end).trim().split(/\s+/), rest: Buffer.from(text.slice(end + 2)) };
  }
  const lines = text.split("\r\n");
  const count = Number(lines[0].slice(1));
  if (!Number.isInteger(count) || count < 1 || count > 128) return { rest: buffer };
  const command: string[] = [];
  let index = 1;
  for (let i = 0; i < count; i++) {
    const marker = lines[index++];
    if (!marker?.startsWith("$")) return { rest: buffer };
    const length = Number(marker.slice(1));
    const value = lines[index++];
    if (!Number.isInteger(length) || length < 0 || value === undefined || Buffer.byteLength(value) !== length) return { rest: buffer };
    command.push(value);
  }
  const consumed = Buffer.byteLength(lines.slice(0, index).join("\r\n") + "\r\n");
  return { command, rest: buffer.subarray(consumed) };
}
