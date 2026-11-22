// The Flow view and its paragraph mode, open full window: switching views, the underline, keys, a free scroll
// while paused, a paragraph at a time with its pace line. Pinned as they behave before the package leaves
// elchdl (#79); the scroll checks come from the fix for Firefox and Chrome (a8f0b38, PR #89).
import { expect, test, type Page } from '@playwright/test';
import { act, box, events, load, open, state, until } from './helpers';

const shadow = <T>(page: Page, fn: (r: ShadowRoot) => T) =>
  page.evaluate(`(${fn.toString()})(document.querySelector('focus-reader').shadowRoot)`) as Promise<T>;

test.beforeEach(async ({ page }) => {
  await load(page, 'modal');
  await open(page);
  await act(page, 'view');
  await until(page, (s) => s.view, 'Flow');
});

test('View switches to Flow with its own pace, 300 wpm and six words, and says so', async ({ page }) => {
  const s = await state(page);
  expect([s.wpm, s.words]).toEqual(['300', '6']);
  expect(await page.locator('focus-reader').getAttribute('view')).toBe('flow');
  expect(await events(page)).toEqual([
    ['focusreaderopen', null],
    ['focusreaderview', { view: 'flow' }],
  ]);
  await until(page, (x) => x.live, 'Flow view');
  // the first frame, a heading on its own
  expect(s.now).toEqual([0, 5]);
  // back to Sequence: its own pace again
  await act(page, 'view');
  const q = await state(page);
  expect([q.view, q.wpm, q.words]).toEqual(['Sequence', '150', '1']);
});

test('the frame being read is underlined, one bar per line, from its first word, just under it', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  const s = await state(page);
  expect(s.bars.length).toBeGreaterThanOrEqual(1);
  for (const [, w] of s.bars) expect(w).toBeGreaterThan(10);
  const [dx, dy] = await shadow(page, (r) => {
    const first = r.querySelector('.w.now')!.getBoundingClientRect();
    const bar = r.querySelector('.text .under')!.getBoundingClientRect();
    return [Math.round(bar.left - first.left), Math.round(bar.top - first.bottom)];
  });
  expect(Math.abs(dx)).toBeLessThanOrEqual(2);
  expect(dy).toBeGreaterThan(-12);
  expect(dy).toBeLessThan(6);
});

test('Underline off: the words being read only in ink', async ({ page }) => {
  await act(page, 'underline');
  expect(await shadow(page, (r) => r.querySelector('[data-act="underline"]')!.textContent)).toBe('Off');
  expect(await shadow(page, (r) => getComputedStyle(r.querySelector('.text .under')!).display)).toBe('none');
});

test('the line being read rests at 38 % of the window', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  const at = await shadow(page, (r) => {
    const win = r.querySelector('.window')!.getBoundingClientRect();
    const w = r.querySelector('.w.now')!.getBoundingClientRect();
    return Math.round(((w.top + w.bottom) / 2 - win.top) / win.height * 100);
  });
  expect(Math.abs(at - 38)).toBeLessThanOrEqual(2);
});

test('← → go a frame back and on', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  const a = (await state(page)).now!;
  await page.keyboard.press('ArrowRight');
  const b = (await state(page)).now!;
  await page.keyboard.press('ArrowLeft');
  const c = (await state(page)).now!;
  expect(b[0]).toBe(a[1]);
  expect(c).toEqual(a);
});

test('it plays, the words read turning a step darker', async ({ page }) => {
  await page.keyboard.press('Space');
  await until(page, (s) => s.state, 'Reading');
  await expect.poll(async () => (await state(page)).now![0], { timeout: 5000 }).toBeGreaterThan(5);
  const read = await shadow(page, (r) => r.querySelectorAll('.w.read').length);
  expect(read).toBe((await state(page)).now![0]);
  await page.keyboard.press('Space');
  await until(page, (s) => s.state, 'Play');
});

test('paused, a fast scroll moves the text freely and every frame on the way is read in turn', async ({ page }) => {
  await shadow(page, (r) => {
    const w = window as unknown as { seen: [number, number][]; raf: number };
    w.seen = [];
    let last: string | undefined;
    const tick = () => {
      const now = [...r.querySelectorAll<HTMLElement>('.w.now')];
      const k = now[0]?.dataset.i;
      if (k !== last) {
        last = k;
        w.seen.push([Number(now[0].dataset.i), Number(now.at(-1)!.dataset.i) + 1]);
      }
      w.raf = requestAnimationFrame(tick);
    };
    tick();
  });
  const f = await box(page, '[data-flow]');
  await page.mouse.move(f.cx, f.cy);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 90);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(1500);
  const seen = await page.evaluate(() => {
    const w = window as unknown as { seen: [number, number][]; raf: number };
    cancelAnimationFrame(w.raf);
    return w.seen;
  });
  expect(seen.length).toBeGreaterThan(5);
  for (let i = 1; i < seen.length; i++) expect(seen[i][0], `frame ${i} follows frame ${i - 1}`).toBeLessThanOrEqual(seen[i - 1][1]);
  // and Play goes on from there
  const at = (await state(page)).now!;
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  expect((await state(page)).now![0]).toBeGreaterThanOrEqual(at[0]);
});

test('Words goes on past six to ¶: a paragraph at a time, at 250 wpm', async ({ page }) => {
  await act(page, 'words+');
  const s = await state(page);
  expect([s.words, s.wpm]).toEqual(['¶', '250']);
  await until(page, (x) => x.live, 'A paragraph at a time');
  expect(await shadow(page, (r) => r.querySelector<HTMLButtonElement>('[data-act="words+"]')!.disabled)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  const p = await shadow(page, (r) => {
    const now = [...r.querySelectorAll('.w.now')];
    const win = r.querySelector('.window')!.getBoundingClientRect();
    const a = now[0].getBoundingClientRect();
    const z = now.at(-1)!.getBoundingClientRect();
    return {
      blocks: new Set(now.map((x) => x.parentElement)).size,
      whole: now[0].parentElement!.querySelectorAll('.w').length === now.length,
      mid: Math.round((((a.top + z.bottom) / 2 - win.top) / win.height) * 100),
      pace: !!r.querySelector('.text .pace'),
      under: getComputedStyle(r.querySelector('.text .under')!).display,
    };
  });
  // the whole paragraph, its middle at 45 % of the window, the pace line in the margin, no underline
  expect(p).toEqual({ blocks: 1, whole: true, mid: expect.any(Number), pace: true, under: 'none' });
  expect(Math.abs(p.mid - 45)).toBeLessThanOrEqual(3);
});

test('a paragraph at a time: the pace line fills while it plays and holds on a pause', async ({ page }) => {
  await act(page, 'words+');
  const fill = () => shadow(page, (r) => new DOMMatrix(getComputedStyle(r.querySelector('.pace > span')!).transform).d);
  // the heading first, then a paragraph
  await page.keyboard.press('ArrowRight');
  expect(await fill()).toBe(0);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1500);
  const a = await fill();
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const b = await fill();
  await page.waitForTimeout(800);
  const c = await fill();
  expect(a).toBeGreaterThan(0.02);
  expect(Math.abs(c - b)).toBeLessThan(0.005);
});

test('a paragraph at a time: → goes to the next paragraph, moving smoothly', async ({ page }) => {
  await act(page, 'words+');
  await page.keyboard.press('ArrowRight');
  const a = (await state(page)).now!;
  await page.keyboard.press('ArrowRight');
  const b = (await state(page)).now!;
  expect(b[0]).toBe(a[1]);
  expect(await shadow(page, (r) => r.querySelector('.text')!.classList.contains('instant'))).toBe(false);
  expect(await shadow(page, (r) => getComputedStyle(r.querySelector('.text')!).transitionDuration)).toBe('0.6s');
});

test('Words − from ¶ comes back to six words at 300', async ({ page }) => {
  await act(page, 'words+');
  await act(page, 'words-');
  const s = await state(page);
  expect([s.words, s.wpm]).toEqual(['6', '300']);
});

test('the `view` attribute switches the view from the page', async ({ page }) => {
  await page.locator('focus-reader').evaluate((el) => el.setAttribute('view', 'sequence'));
  await until(page, (s) => s.view, 'Sequence');
  expect((await events(page)).at(-1)).toEqual(['focusreaderview', { view: 'sequence' }]);
});
