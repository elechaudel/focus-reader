// On a phone (touch, a coarse pointer; the `phone` project): the hints, a tap, a swipe, full screen on opening.
// Chrome's emulation of Android: Safari on iPhone is checked in the iOS Simulator, and a real device by hand.
import { expect, test, type Page } from '@playwright/test';
import { box, load, open, state, until } from './helpers';

/** A one-finger swipe through Chrome's DevTools protocol, as a phone sends it: touch events, a few ms apart. */
async function swipe(page: Page, from: [number, number], to: [number, number], steps = 10, ms = 16) {
  const cdp = await page.context().newCDPSession(page);
  const point = (t: number) => [{ x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(i / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('the hints are for touch', async ({ page }) => {
  await load(page);
  const s = await state(page);
  expect(s.context).toBe('Tap the band to start.');
  const shown = await page.evaluate(() => {
    const r = document.querySelector('focus-reader')!.shadowRoot!;
    return [getComputedStyle(r.querySelector('.touch-keys')!).display, getComputedStyle(r.querySelector('.desk-keys')!).display];
  });
  expect(shown).toEqual(['inline', 'none']);
});

test('a tap on the band plays, another pauses', async ({ page }) => {
  await load(page);
  const b = await box(page, '[data-band]');
  await page.touchscreen.tap(b.cx, b.cy);
  await until(page, (s) => s.state, 'Reading');
  await page.touchscreen.tap(b.cx, b.cy);
  await until(page, (s) => s.state, 'Play');
});

test('opening asks for full screen, closing leaves it', async ({ page }) => {
  await load(page, 'modal');
  await page.tap('#open');
  await until(page, (s) => s.dialog, true);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName ?? null)).toBe('FOCUS-READER');
  await page.locator('focus-reader').evaluate((el) => (el as HTMLElement & { close(): void }).close());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBe(null);
});

test('open, a swipe to the left goes frames on, to the right back', async ({ page }) => {
  await load(page, 'modal');
  await open(page);
  const b = await box(page, '[data-band]');
  await swipe(page, [b.x + b.width * 0.8, b.cy], [b.x + b.width * 0.2, b.cy], 10, 40);
  await expect.poll(async () => Number((await state(page)).read)).toBeGreaterThan(3);
  await page.waitForTimeout(1500);
  const on = Number((await state(page)).read);
  await swipe(page, [b.x + b.width * 0.3, b.cy], [b.x + b.width * 0.5, b.cy], 10, 40);
  await expect.poll(async () => Number((await state(page)).read)).toBeLessThan(on);
});

test('open in Flow and paused, a swipe up scrolls the text and the reading place follows', async ({ page }) => {
  await load(page, 'modal&view=flow');
  await open(page);
  const f = await box(page, '.window');
  const y = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('focus-reader')!.shadowRoot!.querySelector('.text')!).transform).f);
  const y0 = await y();
  await swipe(page, [f.cx, f.y + f.height * 0.8], [f.cx, f.y + f.height * 0.3], 12, 40);
  await page.waitForTimeout(1200);
  expect(await y()).toBeLessThan(y0 - 100);
  expect((await state(page)).now![0]).toBeGreaterThan(5);
  expect((await state(page)).state).toBe('Play');
});
