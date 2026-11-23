import { useEffect } from 'preact/hooks';
import type { ThemeSetting } from './domain/types';
import { testModeActive } from './data/clock';
import { applyUpdate, offlineReady, updateAvailable } from './data/pwa';
import { settings } from './data/store';
import { TestModeBanner } from './ui/components/Banners';
import { TabBar } from './ui/components/controls';
import { DialogHost, Toast, showToast } from './ui/feedback';
import { route } from './ui/router';
import { HistoryScreen } from './ui/screens/HistoryScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { TaskDetailScreen } from './ui/screens/TaskDetailScreen';
import { TasksScreen } from './ui/screens/TasksScreen';
import { TodayScreen } from './ui/screens/TodayScreen';
import { SheetHost } from './ui/sheets/Sheets';

const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function applyTheme(theme: ThemeSetting): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && darkQuery?.matches === true);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f2f2f7');
}

export function App() {
  const r = route.value;
  const theme = settings.value.theme;

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || !darkQuery) return;
    const onChange = () => applyTheme('system');
    darkQuery.addEventListener('change', onChange);
    return () => darkQuery.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(
    () =>
      updateAvailable.subscribe((v) => {
        if (v) showToast('A new version is available', { sticky: true, action: { label: 'Reload', run: () => void applyUpdate() } });
      }),
    [],
  );

  useEffect(
    () =>
      offlineReady.subscribe((v) => {
        if (v) showToast('Ready to work offline');
      }),
    [],
  );

  const tab = r.name === 'task' ? r.from : r.name;

  return (
    <div class={`app${testModeActive.value ? ' has-banner' : ''}`}>
      <TestModeBanner />
      {r.name === 'today' && <TodayScreen />}
      {r.name === 'tasks' && <TasksScreen />}
      {r.name === 'history' && <HistoryScreen />}
      {r.name === 'settings' && <SettingsScreen />}
      {r.name === 'task' && <TaskDetailScreen key={r.id} id={r.id} from={r.from} />}
      <TabBar active={tab} />
      <SheetHost />
      <DialogHost />
      <Toast />
    </div>
  );
}
