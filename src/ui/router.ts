import { signal } from '@preact/signals';

export type TabName = 'today' | 'tasks' | 'history' | 'settings';

export type Route = { name: TabName } | { name: 'task'; id: string; from: TabName };

const TABS: TabName[] = ['today', 'tasks', 'history', 'settings'];

const isTab = (v: string | undefined): v is TabName => TABS.includes(v as TabName);

/** Hash routes (#/today, #/task/<id>/<from>) — GitHub Pages has no SPA rewrites, so path routes would 404 on reload. */
export function parseRoute(hash: string): Route {
  const [a, b, c] = hash.replace(/^#\/?/, '').split('/');
  if (a === 'task' && b) return { name: 'task', id: decodeURIComponent(b), from: isTab(c) ? c : 'tasks' };
  return { name: isTab(a) ? a : 'today' };
}

export const route = signal<Route>(parseRoute(typeof location === 'undefined' ? '' : location.hash));

export function initRouter(): void {
  window.addEventListener('hashchange', () => {
    route.value = parseRoute(location.hash);
  });
}

export function navigate(path: string): void {
  if (location.hash === path) return;
  location.hash = path;
}

export function openTask(id: string, from: TabName): void {
  navigate(`#/task/${encodeURIComponent(id)}/${from}`);
}
