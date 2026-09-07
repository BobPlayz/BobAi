import net from "node:net";
import { BobRedisStore } from "./store.js";
import { array, bulk, error, integer, parseResp, simple } from "./protocol.js";

const HOST = process.env.BOBREDIS_HOST || "0.0.0.0";
const PORT = Number(process.env.BOBREDIS_PORT || 6380);
const PASSWORD = process.env.BOBREDIS_PASSWORD || "";
const AOF_PATH = process.env.BOBREDIS_AOF || "./data/bobredis.aof";
const MAX_MEMORY = Math.min(Number(process.env.BOBREDIS_MAX_MEMORY_BYTES || 256 * 1024 * 1024), 1024 * 1024 * 1024);
const MAX_REQUEST = 2 * 1024 * 1024;
const store = new BobRedisStore(AOF_PATH, MAX_MEMORY);
const authenticated = new WeakSet<net.Socket>();
const subscribers = new Map<string, Set<net.Socket>>();
const clientSubscriptions = new WeakMap<net.Socket, Set<string>>();

function requireArgs(args: string[], count: number): void { if (args.length < count) throw new Error("ERR wrong number of arguments for command"); }

async function execute(socket: net.Socket, command: string[]): Promise<Buffer> {
  const [rawName, ...args] = command;
  const name = rawName?.toUpperCase();
  if (!name) return error("ERR empty command");
  if (PASSWORD && name !== "AUTH" && name !== "PING" && !authenticated.has(socket)) return error("NOAUTH Authentication required.");
  try {
    switch (name) {
      case "PING": return args[0] ? bulk(args[0]) : simple("PONG");
      case "AUTH": requireArgs(args, 1); if (!PASSWORD || args[0] === PASSWORD) { authenticated.add(socket); return simple("OK"); } return error("WRONGPASS invalid password");
      case "GET": requireArgs(args, 1); if (store.type(args[0]) === "list") return error("WRONGTYPE Operation against a key holding the wrong kind of value"); return bulk(store.get(args[0]));
      case "SET": {
        requireArgs(args, 2); const options: { nx?: boolean; xx?: boolean; px?: number; ex?: number } = {};
        for (let i = 2; i < args.length; i++) { const option = args[i].toUpperCase(); if (option === "NX") options.nx = true; else if (option === "XX") options.xx = true; else if (option === "PX" || option === "EX") { const amount = Number(args[++i]); if (!Number.isSafeInteger(amount) || amount <= 0) return error("ERR invalid expire time"); if (option === "PX") options.px = amount; else options.ex = amount; } else return error("ERR syntax error"); }
        const ok = store.set(args[0], args[1], options); if (ok) await store.persist(command); return ok ? simple("OK") : bulk(null);
      }
      case "DEL": { requireArgs(args, 1); const removed = store.del(args); if (removed) await store.persist(command); return integer(removed); }
      case "EXISTS": requireArgs(args, 1); return integer(args.filter((key) => store.exists(key)).length);
      case "EXPIRE": { requireArgs(args, 2); const seconds = Number(args[1]); if (!Number.isInteger(seconds)) return error("ERR invalid expire time"); const ok = store.expire(args[0], seconds); if (ok) await store.persist(command); return integer(ok ? 1 : 0); }
      case "TTL": requireArgs(args, 1); return integer(store.ttl(args[0]));
      case "INCR": { requireArgs(args, 1); const value = store.incr(args[0], 1); await store.persist(command); return integer(value); }
      case "DECR": { requireArgs(args, 1); const value = store.incr(args[0], -1); await store.persist(command); return integer(value); }
      case "LPUSH": { requireArgs(args, 2); const length = store.listPush(args[0], args.slice(1), true); await store.persist(command); return integer(length); }
      case "RPUSH": { requireArgs(args, 2); const length = store.listPush(args[0], args.slice(1), false); await store.persist(command); return integer(length); }
      case "LPOP": { requireArgs(args, 1); const value = store.listPop(args[0], true); if (value !== null) await store.persist(command); return bulk(value); }
      case "RPOP": { requireArgs(args, 1); const value = store.listPop(args[0], false); if (value !== null) await store.persist(command); return bulk(value); }
      case "LLEN": requireArgs(args, 1); return integer(store.listLength(args[0]));
      case "TYPE": requireArgs(args, 1); return simple(store.type(args[0]));
      case "DBSIZE": return integer(store.size());
      case "MEMORY": if (args[0]?.toUpperCase() !== "USAGE") return error("ERR unknown subcommand"); requireArgs(args, 2); return integer(store.exists(args[1]) ? store.memoryBytes() : 0);
      case "INFO": return bulk(`# BobRedis\r\nkeys:${store.size()}\r\nused_memory:${store.memoryBytes()}\r\nmaxmemory:${MAX_MEMORY}\r\n`);
      case "FLUSHDB": store.flush(); await store.persist(command); return simple("OK");
      case "PUBLISH": { requireArgs(args, 2); const sockets = subscribers.get(args[0]); let delivered = 0; if (sockets) for (const target of sockets) { target.write(array([bulk("message"), bulk(args[0]), bulk(args[1])])); delivered++; } return integer(delivered); }
      case "SUBSCRIBE": { requireArgs(args, 1); const set = clientSubscriptions.get(socket) ?? new Set<string>(); clientSubscriptions.set(socket, set); const responses: Buffer[] = []; for (const channel of args) { const sockets = subscribers.get(channel) ?? new Set<net.Socket>(); sockets.add(socket); subscribers.set(channel, sockets); set.add(channel); responses.push(array([bulk("subscribe"), bulk(channel), integer(set.size)])); } return Buffer.concat(responses); }
      case "UNSUBSCRIBE": { const set = clientSubscriptions.get(socket) ?? new Set<string>(); const channels = args.length ? args : [...set]; const responses: Buffer[] = []; for (const channel of channels) { subscribers.get(channel)?.delete(socket); set.delete(channel); responses.push(array([bulk("unsubscribe"), bulk(channel), integer(set.size)])); } return Buffer.concat(responses); }
      case "QUIT": socket.end(); return simple("OK");
      default: return error(`ERR unknown command '${name}'`);
    }
  } catch (err) { return error(err instanceof Error ? err.message : "ERR command failed"); }
}

async function main(): Promise<void> {
  await store.load();
  setInterval(() => store.size(), 30_000).unref();

  const server = net.createServer((socket) => {
    socket.setNoDelay(true); if (!PASSWORD) authenticated.add(socket);
    let buffer = Buffer.alloc(0);
    socket.on("data", async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_REQUEST) { socket.write(error("ERR request too large")); socket.destroy(); return; }
      while (buffer.length) { const parsed = parseResp(buffer); if (!parsed.command) break; buffer = parsed.rest; socket.write(await execute(socket, parsed.command)); }
    });
    socket.on("close", () => { const set = clientSubscriptions.get(socket); if (set) for (const channel of set) subscribers.get(channel)?.delete(socket); });
  });

  server.listen(PORT, HOST, () => console.log(`BobRedis listening on ${HOST}:${PORT}`));
  process.once("SIGTERM", () => server.close());
  process.once("SIGINT", () => server.close());
}

void main().catch((error) => { console.error("BobRedis failed to start:", error); process.exitCode = 1; });
