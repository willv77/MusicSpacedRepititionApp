// Injects iPhone chrome (dynamic island, status bar, home indicator) into every .screen.
(() => {
  const statusBar = `
    <div class="statusbar">
      <span>9:41</span>
      <span class="sb-icons">
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.6l2.3-2.7a3.3 3.3 0 0 0-4.6 0zM8 5.7c1.8 0 3.4.6 4.6 1.7l1.4-1.6A8.7 8.7 0 0 0 8 3.4a8.7 8.7 0 0 0-6 2.3l1.4 1.6A6.6 6.6 0 0 1 8 5.7zM8 0C4.9 0 2.1 1.1 0 3l1.4 1.6A10.5 10.5 0 0 1 8 2.2c2.5 0 4.8.9 6.6 2.4L16 3A12.7 12.7 0 0 0 8 0z"/></svg>
        <span class="battery"><i></i></span>
      </span>
    </div>`;
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.insertAdjacentHTML('afterbegin', '<div class="island"></div>' + (screen.dataset.nostatus ? '' : statusBar));
    screen.insertAdjacentHTML('beforeend', '<div class="home-indicator"></div>');
  });
})();
