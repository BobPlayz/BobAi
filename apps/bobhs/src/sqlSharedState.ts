import type { SharedStateRecord, SharedStateStore } from "./sharedState.js";

type Query = <T>(sql: string, params: unknown[]) => Promise<T[]>;
type Row<T> = { state_key: string; version: number; value_json: T; updated_at: string };

export class SqlSharedState implements SharedStateStore {
  constructor(private readonly query: Query) {}
  async ensureSchema() {
    await this.query("CREATE TABLE IF NOT EXISTS bobhs_shared_state (state_key TEXT PRIMARY KEY, version BIGINT NOT NULL, value_json JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())", []);
  }
  async read<T>(key: string) {
    const rows = await this.query<Row<T>>("SELECT state_key, version, value_json, updated_at FROM bobhs_shared_state WHERE state_key = $1", [key]);
    const row = rows[0];
    return row ? this.record(row) : undefined;
  }
  async write<T>(key: string, value: T, expectedVersion?: number) {
    const sql = expectedVersion === undefined
      ? "INSERT INTO bobhs_shared_state (state_key, version, value_json) VALUES ($1, 1, $2::jsonb) ON CONFLICT (state_key) DO UPDATE SET version = bobhs_shared_state.version + 1, value_json = EXCLUDED.value_json, updated_at = NOW() RETURNING state_key, version, value_json, updated_at"
      : "INSERT INTO bobhs_shared_state (state_key, version, value_json) VALUES ($1, 1, $2::jsonb) ON CONFLICT (state_key) DO UPDATE SET version = bobhs_shared_state.version + 1, value_json = EXCLUDED.value_json, updated_at = NOW() WHERE bobhs_shared_state.version = $3 RETURNING state_key, version, value_json, updated_at";
    const params = expectedVersion === undefined ? [key, JSON.stringify(value)] : [key, JSON.stringify(value), expectedVersion];
    const rows = await this.query<Row<T>>(sql, params);
    if (!rows[0]) throw new Error("shared-state version conflict");
    return this.record(rows[0]);
  }
  private record<T>(row: Row<T>): SharedStateRecord<T> { return { key: row.state_key, version: Number(row.version), value: row.value_json, updatedAt: new Date(row.updated_at).toISOString() }; }
}
