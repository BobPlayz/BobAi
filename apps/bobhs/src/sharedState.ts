export interface SharedStateRecord<T> { key: string; version: number; value: T; updatedAt: string; }

export interface SharedStateStore {
  read<T>(key: string): Promise<SharedStateRecord<T> | undefined>;
  write<T>(key: string, value: T, expectedVersion?: number): Promise<SharedStateRecord<T>>;
}

export class InMemorySharedState implements SharedStateStore {
  private readonly records = new Map<string, SharedStateRecord<unknown>>();

  async read<T>(key: string) {
    const record = this.records.get(key) as SharedStateRecord<T> | undefined;
    return record ? { ...record } : undefined;
  }

  async write<T>(key: string, value: T, expectedVersion?: number) {
    const current = this.records.get(key);
    if (expectedVersion !== undefined && (current?.version ?? 0) !== expectedVersion) {
      throw new Error("shared-state version conflict");
    }
    const record: SharedStateRecord<T> = {
      key,
      version: (current?.version ?? 0) + 1,
      value,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(key, record);
    return { ...record };
  }
}
