import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDesktop } from '../src/data/platform';

function env(userAgent: string, finePointer: boolean, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: finePointer }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isDesktop (gates Test Mode)', () => {
  it('is true for desktop browsers with a mouse/trackpad', () => {
    env('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', true);
    expect(isDesktop()).toBe(true);
    env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', true, 0);
    expect(isDesktop()).toBe(true);
  });

  it('is false on iPhone, iPad and Android', () => {
    env('Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', false);
    expect(isDesktop()).toBe(false);
    // iPadOS Safari reports a Mac user agent but has touch points.
    env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', true, 5);
    expect(isDesktop()).toBe(false);
    env('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36', false);
    expect(isDesktop()).toBe(false);
  });

  it('is false for touch-first devices even with a desktop user agent', () => {
    env('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', false);
    expect(isDesktop()).toBe(false);
  });
});
