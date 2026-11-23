import { render } from 'preact';
import './ui/styles.css';
import { App } from './app';
import { refreshRealToday, reloadTestDate, TEST_DATE_KEY } from './data/clock';
import { initPWA } from './data/pwa';
import { DATA_KEY, LocalStorageRepository } from './data/repository';
import { initStore, reloadFromRepository } from './data/store';
import { initRouter } from './ui/router';

initStore(new LocalStorageRepository(localStorage));
initRouter();
initPWA();

// Ask WebKit/Chromium not to evict our storage (granted heuristically, e.g. for Home Screen apps).
void navigator.storage?.persist?.().catch(() => undefined);

// Standalone apps can stay open across midnight — refresh "today" whenever the app is resumed.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshRealToday();
});
window.addEventListener('focus', refreshRealToday);
setInterval(refreshRealToday, 60_000);

// Keep multiple desktop tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key === DATA_KEY) reloadFromRepository();
  if (e.key === TEST_DATE_KEY) reloadTestDate();
});

// Lift bottom sheets above the iOS on-screen keyboard (fixed elements otherwise stay under it).
const vv = window.visualViewport;
if (vv) {
  const update = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
    document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

render(<App />, document.getElementById('app') as HTMLElement);
