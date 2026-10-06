export class FakeStorageArea {
  entries = new Map<string, unknown>();
  maxBytes = Number.POSITIVE_INFINITY;

  totalBytes(): number {
    let total = 0;
    for (const value of this.entries.values()) total += JSON.stringify(value)?.length ?? 0;
    return total;
  }

  async get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
    if (keys === null || keys === undefined) {
      return Object.fromEntries(this.entries);
    }
    const list = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of list) {
      if (this.entries.has(key)) result[key] = this.entries.get(key);
    }
    return result;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const next = new Map(this.entries);
    for (const [key, value] of Object.entries(items)) next.set(key, value);
    let size = 0;
    for (const value of next.values()) size += JSON.stringify(value)?.length ?? 0;
    if (size > this.maxBytes) throw new Error('QUOTA_BYTES quota exceeded');
    this.entries = next;
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.entries.delete(key);
  }
}
