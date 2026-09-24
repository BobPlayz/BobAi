import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const max = Math.min(50, Math.max(1, Number(process.env.DB_POOL_MAX || 10)));
const idleTimeout = Math.min(300, Math.max(10, Number(process.env.DB_IDLE_TIMEOUT_SECONDS || 60)));
const connectTimeout = Math.min(60, Math.max(5, Number(process.env.DB_CONNECT_TIMEOUT_SECONDS || 10)));
const maxLifetime = Math.min(3600, Math.max(60, Number(process.env.DB_MAX_LIFETIME_SECONDS || 1800)));

const client = postgres(connectionString, {
  max,
  idle_timeout: idleTimeout,
  connect_timeout: connectTimeout,
  max_lifetime: maxLifetime,
  prepare: process.env.DB_DISABLE_PREPARED_STATEMENTS === "true" ? false : true,
});

export const db = drizzle(client);
export { client as dbClient };
export * from "./schema/index.js";
