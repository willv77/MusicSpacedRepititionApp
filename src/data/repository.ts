import type { AppData } from '../domain/types';
import { migrate } from './migrations';

/**
 * Namespaced key: every GitHub Pages site of a user shares the origin https://<user>.github.io,
 * so other repos' pages share this localStorage.
 */
export const DATA_KEY = 'wkv-practice:data';

export interface Repository {
  load(): AppData | null;
  save(data: AppData): void;
}

export class LocalStorageRepository implements Repository {
  constructor(
    private readonly storage: Storage,
    private readonly key: string = DATA_KEY,
  ) {}

  load(): AppData | null {
    const raw = this.storage.getItem(this.key);
    if (raw == null) return null;
    try {
      return migrate(JSON.parse(raw));
    } catch (err) {
      // Keep the unreadable payload so it can be recovered manually.
      this.storage.setItem(`${this.key}:unreadable:${Date.now()}`, raw);
      throw err;
    }
  }

  save(data: AppData): void {
    this.storage.setItem(this.key, toStorageJSON(data));
  }
}

/**
 * WebKit charges localStorage by bytes against a 5 MB quota, and a single character above U+00FF
 * (e.g. "—") makes it count the whole string at 2 bytes per character. Escaping non-ASCII characters
 * keeps the payload at 1 byte per character; JSON.parse restores them, so stored data stays compatible.
 */
export function toStorageJSON(data: AppData): string {
  const json = JSON.stringify(data);
  if (!/[^\x00-\x7f]/.test(json)) return json;
  const ascii = json.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  // `replace` keeps JSC's 16-bit buffer; re-decoding ASCII yields a compact 8-bit string.
  return new TextDecoder().decode(new TextEncoder().encode(ascii));
}
