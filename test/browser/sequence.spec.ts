// The Sequence view, open full window: keys, clicks, scroll, the labels fading, Escape. Pinned as it behaves
// before the package leaves elchdl (#79).
import { expect, test } from '@playwright/test';
import { act, box, events, load, open, state, until } from './helpers';

test.beforeEach(async ({ page }) => {
  await load(page, 'modal');
  await open(page);
});

test('opens as a modal dialog, from Sequence at 150 wpm and one word', async ({ page }) => {
  const s = await state(page);
  expect(s.open && s.dialog).toBe(true);
  expect([s.view, s.wpm, s.words, s.align]).toEqual(['Sequence', '150', '1', 'Left']);
  expect(s.door).toBe('Close');
  expect(s.title).toBe('A text to test with');
  expect(s.name).toBe('Focus reader');
  expect(s.context).toBe('Press Space or click the band to start.');
  expect(s.chunk).toBe('How');
  expect(s.read).toBe('0');
  expect(await events(page)).toEqual([['focusreaderopen', null]]);
  // the page behind stays put
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
});

test('Space plays and pauses; the labels fade at once on Play and come back on a pause', async ({ page }) => {
  await page.keyboard.press('Space');
  await until(page, (s) => s.state, 'Reading');
  await until(page, (s) => s.quiet, true);
  // a frame goes by on its own
  await expect.poll(async () => Number((await state(page)).read)).toBeGreaterThan(1);
  expect((await state(page)).live).toBe('Playing at 150 words per minute');
  await page.keyboard.press('Space');
  const s = await state(page);
  expect(s.state).toBe('Play');
  expect(s.quiet).toBe(false);
  await until(page, (x) => x.live, `Paused, word ${s.read} of ${s.total.slice(2)}`);
  // paused, the sentence shows under the band with the frame marked
  expect(s.context).toContain(s.chunk);
});

test('k plays and pauses too', async ({ page }) => {
  await page.keyboard.press('k');
  await until(page, (s) => s.state, 'Reading');
  await page.keyboard.press('k');
  await until(page, (s) => s.state, 'Play');
});

test('a move brings the labels back while it plays, and they fade again after 2 s', async ({ page }) => {
  await page.keyboard.press('Space');
  await until(page, (s) => s.quiet, true);
  await page.mouse.move(100, 100);
  await page.mouse.move(200, 200);
  expect((await state(page)).quiet).toBe(false);
  await page.waitForTimeout(1500);
  expect((await state(page)).quiet).toBe(false);
  await until(page, (s) => s.quiet, true);
});

test('→ and ← go a frame on and back', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  expect((await state(page)).chunk).toBe('a');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  let s = await state(page);
  expect(s.chunk).toBe('is');
  expect(s.read).toBe('4');
  await page.keyboard.press('ArrowLeft');
  s = await state(page);
  expect(s.chunk).toBe('page');
  expect(s.context).toBe('How a page is read');
  // never before the first frame
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  expect((await state(page)).chunk).toBe('How');
});

test('↑ and ↓ change the speed by 25, from 100 to 800', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).wpm).toBe('175');
  await until(page, (s) => s.live, '175 words per minute');
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown');
  expect((await state(page)).wpm).toBe('100');
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowUp');
  expect((await state(page)).wpm).toBe('800');
});

test('a click on the band plays, another pauses, and nothing else moves', async ({ page }) => {
  const b = await box(page, '[data-band]');
  await page.mouse.click(b.x + b.width * 0.9, b.cy);
  await until(page, (s) => s.state, 'Reading');
  await page.waitForTimeout(800);
  await page.mouse.click(b.x + b.width * 0.1, b.cy);
  await until(page, (s) => s.state, 'Play');
  const at = (await state(page)).chunk;
  await page.waitForTimeout(600);
  expect((await state(page)).chunk).toBe(at);
});

test('a scroll goes a frame on per 32 px, a scroll up goes back', async ({ page }) => {
  const b = await box(page, '[data-band]');
  await page.mouse.move(b.cx, b.cy);
  // a stream of small events, as a trackpad sends: followed as it comes, never sped up
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 16);
    await page.waitForTimeout(30);
  }
  // two frames on, from the first: the third frame's words read
  await until(page, (s) => s.read, '3');
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, -16);
    await page.waitForTimeout(30);
  }
  await until(page, (s) => s.read, '1');
});

test('a wheel notch, paused, glides on and slows down', async ({ page }) => {
  const b = await box(page, '[data-band]');
  await page.mouse.move(b.cx, b.cy);
  await page.mouse.wheel(0, 100);
  // about 120 px of glide: a few frames, not one
  await expect.poll(async () => Number((await state(page)).read), { timeout: 3000 }).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(1500);
  const settled = (await state(page)).read;
  await page.waitForTimeout(400);
  expect((await state(page)).read).toBe(settled);
});

test('the settings: words, size, alignment', async ({ page }) => {
  await act(page, 'words+');
  let s = await state(page);
  expect(s.words).toBe('2');
  expect(s.chunk).toBe('How a');
  await until(page, (x) => x.live, '2 words per frame');
  await act(page, 'words-');
  await act(page, 'size+');
  expect((await state(page)).size).toBe('L');
  await act(page, 'size-');
  await act(page, 'size-');
  s = await state(page);
  expect(s.size).toBe('S');
  expect(await page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector<HTMLButtonElement>('[data-act="size-"]')!.disabled)).toBe(true);
  await act(page, 'align');
  expect((await state(page)).align).toBe('Centre');
  await act(page, 'align');
  s = await state(page);
  expect(s.align).toBe('Pivot');
  // the recognition point of "How" is its second letter
  expect(await page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector('.pivot')!.textContent)).toBe('o');
  await act(page, 'align');
  expect((await state(page)).align).toBe('Left');
});

test('the progress slider seeks; ← → go a frame on it too', async ({ page }) => {
  await page.evaluate(() => {
    const seek = document.querySelector('focus-reader')!.shadowRoot!.querySelector<HTMLInputElement>('[data-seek]')!;
    seek.value = '367';
    seek.dispatchEvent(new Event('input'));
    seek.focus();
  });
  let s = await state(page);
  expect(s.read).toBe('368');
  expect(s.pct).toBe('50%');
  await page.keyboard.press('ArrowRight');
  s = await state(page);
  expect(s.read).toBe('369');
});

test('Escape closes, gives the focus back and sends focusreaderclose', async ({ page }) => {
  await page.keyboard.press('Space');
  await until(page, (s) => s.state, 'Reading');
  await page.keyboard.press('Escape');
  const s = await state(page);
  expect(s.open || s.dialog).toBe(false);
  expect(s.state).toBe('Play');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('open');
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  expect((await events(page)).map((e) => e[0])).toEqual(['focusreaderopen', 'focusreaderclose']);
  // modal: hidden again
  expect(await page.locator('focus-reader').isVisible()).toBe(false);
});

test('the panel\'s own door closes it', async ({ page }) => {
  await page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector<HTMLElement>('[data-door]')!.click());
  expect((await state(page)).dialog).toBe(false);
});

test('the frame before fades out where it stood, as on an e-ink screen', async ({ page }) => {
  await page.keyboard.press('Space');
  await expect
    .poll(() => page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector('[data-ghost]')!.classList.contains('on')))
    .toBe(true);
});
