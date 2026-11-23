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
    this.storage.setItem(this.key, JSON.stringify(data));
  }
}
