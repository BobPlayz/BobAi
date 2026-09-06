import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export type Entry = { type: "string" | "list"; value: string | string[]; expiresAt?: number };

export class BobRedisStore {
  private readonly data = new Map<string, Entry>();
  private readonly aofPath: string;
  private readonly maxMemoryBytes: number;
  private usedBytes = 0;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(aofPath: string, maxMemoryBytes = 256 * 1024 * 1024) { this.aofPath = aofPath; this.maxMemoryBytes = maxMemoryBytes; }

  async load(): Promise<void> {
    try {
      const text = await readFile(this.aofPath, "utf8");
      for (const line of text.split("\n").filter(Boolean)) { try { this.apply(JSON.parse(line) as string[]); } catch { /* tolerate a truncated final record */ } }
    } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    this.expireSweep();
  }

  get(key: string): string | null { const entry = this.live(key); return entry?.type === "string" ? entry.value as string : null; }
  type(key: string): string { return this.live(key)?.type ?? "none"; }
  exists(key: string): boolean { return this.live(key) !== undefined; }
  ttl(key: string): number {
    const entry = this.live(key); if (!entry) return -2; if (!entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  set(key: string, value: string, options: { nx?: boolean; xx?: boolean; px?: number; ex?: number } = {}): boolean {
    const current = this.live(key);
    if (options.nx && current) return false; if (options.xx && !current) return false;
    this.assertValueSize(value);
    const expiresAt = options.px ? Date.now() + options.px : options.ex ? Date.now() + options.ex * 1000 : undefined;
    const next: Entry = { type: "string", value, expiresAt };
    const old = current ? this.entryBytes(key, current) : 0; const nextBytes = this.entryBytes(key, next);
    if (this.usedBytes - old + nextBytes > this.maxMemoryBytes) throw new Error("OOM command not allowed when used memory > maxmemory");
    this.removeInternal(key); this.data.set(key, next); this.usedBytes += nextBytes; return true;
  }

  del(keys: string[]): number { let removed = 0; for (const key of keys) if (this.removeInternal(key)) removed++; return removed; }
  incr(key: string, delta: number): number {
    const current = this.get(key); const value = current === null ? 0 : Number(current);
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(delta) || !Number.isSafeInteger(value + delta)) throw new Error("ERR value is not an integer or out of range");
    this.set(key, String(value + delta)); return value + delta;
  }
  expire(key: string, seconds: number): boolean { const entry = this.live(key); if (!entry) return false; entry.expiresAt = Date.now() + seconds * 1000; return true; }

  listPush(key: string, values: string[], left: boolean): number {
    const current = this.live(key); if (current && current.type !== "list") throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
    const list = current ? [...current.value as string[]] : [];
    if (values.some((value) => Buffer.byteLength(value) > 1024 * 1024)) throw new Error("ERR value too large");
    left ? list.unshift(...values) : list.push(...values);
    const next: Entry = { type: "list", value: list, expiresAt: current?.expiresAt };
    const old = current ? this.entryBytes(key, current) : 0; const nextBytes = this.entryBytes(key, next);
    if (this.usedBytes - old + nextBytes > this.maxMemoryBytes) throw new Error("OOM command not allowed when used memory > maxmemory");
    this.removeInternal(key); this.data.set(key, next); this.usedBytes += nextBytes; return list.length;
  }

  listPop(key: string, left: boolean): string | null {
    const current = this.live(key); if (!current) return null;
    if (current.type !== "list") throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
    const list = [...current.value as string[]]; const value = left ? list.shift() : list.pop();
    this.removeInternal(key);
    if (list.length) { const next: Entry = { type: "list", value: list, expiresAt: current.expiresAt }; this.data.set(key, next); this.usedBytes += this.entryBytes(key, next); }
    return value ?? null;
  }

  listLength(key: string): number {
    const entry = this.live(key); if (!entry) return 0;
    if (entry.type !== "list") throw new Error("WRONGTYPE Operation against a key holding the wrong kind of value");
    return (entry.value as string[]).length;
  }

  size(): number { this.expireSweep(); return this.data.size; }
  memoryBytes(): number { this.expireSweep(); return this.usedBytes; }
  flush(): void { this.data.clear(); this.usedBytes = 0; }

  async persist(command: string[]): Promise<void> {
    const line = JSON.stringify(command) + "\n";
    this.writeChain = this.writeChain.then(async () => { await mkdir(dirname(this.aofPath), { recursive: true }); await appendFile(this.aofPath, line, "utf8"); });
    await this.writeChain;
  }

  private live(key: string): Entry | undefined {
    const entry = this.data.get(key); if (entry?.expiresAt && entry.expiresAt <= Date.now()) { this.removeInternal(key); return undefined; } return entry;
  }
  private removeInternal(key: string): boolean { const entry = this.data.get(key); if (!entry) return false; this.usedBytes -= this.entryBytes(key, entry); this.data.delete(key); return true; }
  private expireSweep(): void { const now = Date.now(); for (const [key, entry] of this.data) if (entry.expiresAt && entry.expiresAt <= now) this.removeInternal(key); }
  private entryBytes(key: string, entry: Entry): number { const value = typeof entry.value === "string" ? entry.value : entry.value.join("\0"); return Buffer.byteLength(key) + Buffer.byteLength(value) + 64; }
  private assertValueSize(value: string): void { if (Buffer.byteLength(value) > 1024 * 1024) throw new Error("ERR value too large"); }

  private apply(command: string[]): void {
    const [name, ...args] = command;
    switch (name) {
      case "SET": {
        const [key, value, ...options] = args;
        const parsed: { nx?: boolean; xx?: boolean; px?: number; ex?: number } = {};
        for (let i = 0; i < options.length; i++) { const option = options[i]; if (option === "NX") parsed.nx = true; else if (option === "XX") parsed.xx = true; else if (option === "PX") parsed.px = Number(options[++i]); else if (option === "EX") parsed.ex = Number(options[++i]); }
        this.set(key ?? "", value ?? "", parsed); break;
      }
      case "DEL": this.del(args); break;
      case "INCR": this.incr(args[0] ?? "", 1); break;
      case "DECR": this.incr(args[0] ?? "", -1); break;
      case "EXPIRE": this.expire(args[0] ?? "", Number(args[1])); break;
      case "LPUSH": this.listPush(args[0] ?? "", args.slice(1), true); break;
      case "RPUSH": this.listPush(args[0] ?? "", args.slice(1), false); break;
      case "LPOP": this.listPop(args[0] ?? "", true); break;
      case "RPOP": this.listPop(args[0] ?? "", false); break;
      case "FLUSHDB": this.flush(); break;
    }
  }
}
