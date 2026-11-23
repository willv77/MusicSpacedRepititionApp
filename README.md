# Practice — spaced repetition for music

An offline web app that tells you **what to practice today** and remembers **how it went**: tempo, difficulty, and when to practice next.
It is hosted as a static site on **GitHub Pages from `docs/`** and installed on an iPhone with Safari's **Add to Home Screen**.

- **Scheduling rule:** practice a task **daily until it has 5 consecutive sessions rated 8+**. Any lower rating resets the streak. After that, the gap grows ×1.5 / ×2 / ×2.5 for ratings 8 / 9 / 10, within 2–60 days. All values are adjustable in Settings.
- **Design:** [design/DESIGN.md](design/DESIGN.md) · mockups in [design/mockups/index.html](design/mockups/index.html). The implemented UI is **Option A: Native iOS List**.

## Develop

Requires Node 20+.

```sh
npm install
npm run dev        # http://localhost:5173 with hot reload (service worker disabled in dev)
npm test           # Vitest unit tests
npm run build      # type-check + production build into docs/
npm run preview    # serve the built docs/ at http://localhost:4173
```

Source lives in `src/` (Vite root). `docs/` is **build output**: never edit it by hand, and always commit it after `npm run build`.

## Deploy to GitHub Pages

1. `npm test && npm run build`
2. Commit `src/`, `docs/`, and the rest of the repo, then push to `main`.
3. One-time setup: **GitHub → Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/docs`**.
4. The app is served at `https://<user>.github.io/<repo>/`. All paths are relative, so any repo name works.

GitHub Pages needs a **public** repo on the free plan. The code is public; your practice data never leaves the device.

## Install on iPhone

1. Open the Pages URL in **Safari** → **Share** → **Add to Home Screen**.
2. Always launch from the icon. The installed app has **its own storage, separate from Safari**: anything entered in a Safari tab won't appear in the installed app.
3. It works offline after the first launch. When you deploy a new version, the app shows **"A new version is available · Reload"**.

**Backups:** data is stored only on the device, and deleting the Home Screen app deletes its data. Use **Settings → Export backup** (share sheet → Save to Files / iCloud Drive) regularly. **Import backup** can merge or replace.

## Test mode (desktop only)

On a desktop browser, **Settings → Test mode → Simulate a date** lets you pick any "today" with a calendar picker, step ±1 day or week, and **Load sample data** (8 demo tasks with realistic histories). An orange banner shows the simulated date, with −1d / +1d / Exit.

Sessions logged in Test mode are dated on the simulated day. The simulated date is stored only in that browser and is never exported. The section is hidden on phones and tablets.
