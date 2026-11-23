function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function isTouchMac(): boolean {
  return typeof navigator !== 'undefined' && /Macintosh/.test(ua()) && navigator.maxTouchPoints > 1;
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(ua()) || isTouchMac();
}

/** Desktop = mouse/trackpad as primary pointer and not a phone/tablet. Used to gate Test Mode. */
export function isDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua()) || isTouchMac()) return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}
