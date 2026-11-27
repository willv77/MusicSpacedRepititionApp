/** WebKit's per-origin localStorage quota (bytes). */
export const WEBKIT_QUOTA_BYTES = 5 * 1024 * 1024;

/** Bytes WebKit charges for a string: 2 per character if any character is above U+00FF, else 1. */
export function webkitBytes(s: string): number {
  return /[^\x00-\xff]/.test(s) ? s.length * 2 : s.length;
}

/** In-memory `Storage`; with a quota it rejects writes the way WebKit (iPhone) localStorage does. */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  constructor(private readonly quotaBytes = Infinity) {}
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    const v = String(value);
    let used = webkitBytes(key) + webkitBytes(v);
    for (const [k, x] of this.map) if (k !== key) used += webkitBytes(k) + webkitBytes(x);
    if (used > this.quotaBytes) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    this.map.set(key, v);
  }
}
