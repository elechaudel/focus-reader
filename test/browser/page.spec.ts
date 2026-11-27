// <focus-reader> on a page: in place, its attributes, where it reads from, what it keeps, the dark scheme and
// reduced motion. Pinned as it behaves before the package leaves elchdl (#79).
import { expect, test } from '@playwright/test';
import { act, box, load, open, state, until } from './helpers';

test.describe('in place', () => {
  test('it sits in the page, filling its box, and opens full window from its own door', async ({ page }) => {
    await load(page);
    const host = await page.locator('focus-reader').boundingBox();
    const tile = await page.locator('#tile').boundingBox();
    expect(Math.round(host!.height)).toBe(Math.round(tile!.height) - 2);
    let s = await state(page);
    expect(s.dialog).toBe(false);
    expect(s.door).toBe('Full screen');
    await page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector<HTMLElement>('[data-door]')!.click());
    s = await state(page);
    expect(s.dialog && s.open).toBe(true);
    expect(s.door).toBe('Close');
  });

  test('keys reach it only once it has been used, and until a press elsewhere', async ({ page }) => {
    await load(page);
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).read).toBe('0');
    // a press inside the panel engages it (on the settings, so nothing plays)
    const settings = await box(page, '.settings');
    await page.mouse.click(settings.x + settings.width - 4, settings.cy);
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).read).toBe('2');
    // a press elsewhere on the page lets the keys go back to it
    await page.mouse.click(5, 790);
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).read).toBe('2');
  });

  test('a page\'s own controls count as part of it inside data-focus-reader-scope', async ({ page }) => {
    await load(page, 'scope');
    const settings = await box(page, '.settings');
    await page.mouse.click(settings.x + settings.width - 4, settings.cy);
    await page.click('#own');
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).read).toBe('2');
  });

  test('without a scope, the page\'s own control takes the keys back', async ({ page }) => {
    await load(page);
    const settings = await box(page, '.settings');
    await page.mouse.click(settings.x + settings.width - 4, settings.cy);
    await page.click('#own');
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).read).toBe('0');
  });

  test('a field of the page keeps its keys while the panel is engaged', async ({ page }) => {
    await load(page);
    const b = await box(page, '[data-band]');
    await page.mouse.click(b.cx, b.cy);
    await page.mouse.click(b.cx, b.cy);
    await until(page, (s) => s.state, 'Play');
    await page.evaluate(() => document.getElementById('field')!.focus());
    await page.keyboard.type('a b');
    expect(await page.inputValue('#field')).toBe('a b');
  });

  test('in place, Escape pauses', async ({ page }) => {
    await load(page);
    const b = await box(page, '[data-band]');
    await page.mouse.click(b.cx, b.cy);
    await until(page, (s) => s.state, 'Reading');
    await page.keyboard.press('Escape');
    await until(page, (s) => s.state, 'Play');
  });

  test('a scroll on it moves the page until it has been used', async ({ page }) => {
    await load(page);
    const b = await box(page, '[data-band]');
    await page.mouse.move(b.cx, b.cy);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect((await state(page)).read).toBe('0');
  });
});

test.describe('attributes', () => {
  test('wpm, words, size and align set where Sequence starts; wpm snaps to steps of 25', async ({ page }) => {
    await load(page, 'wpm=210&words=3&size=s&align=center');
    const s = await state(page);
    expect([s.view, s.wpm, s.words, s.size, s.align]).toEqual(['Sequence', '200', '3', 'S', 'Centre']);
    expect(s.chunk).toBe('How a page');
  });

  test('out of range, wpm and words are clamped', async ({ page }) => {
    await load(page, 'wpm=5000&words=40');
    let s = await state(page);
    expect([s.wpm, s.words]).toEqual(['800', '6']);
    await load(page, 'wpm=10&words=0');
    s = await state(page);
    // 0 words reads as no attribute: the view's own
    expect([s.wpm, s.words]).toEqual(['100', '1']);
  });

  test('view="flow" with wpm and words sets Flow\'s pace; Sequence keeps its own', async ({ page }) => {
    await load(page, 'view=flow&wpm=400&words=4&underline=off');
    let s = await state(page);
    expect([s.view, s.wpm, s.words]).toEqual(['Flow', '400', '4']);
    expect(await page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector('.fr')!.classList.contains('no-underline'))).toBe(true);
    await act(page, 'view');
    s = await state(page);
    expect([s.view, s.wpm, s.words]).toEqual(['Sequence', '150', '1']);
  });

  test('defaults, as JSON: each view\'s pace, the alignment, the underline; the attributes over it', async ({ page }) => {
    const d = {
      sequence: { wpm: 200, words: 2, size: 's', align: 'pivot' },
      flow: { wpm: 350, words: 4, underline: false },
      paragraph: { wpm: 225 },
    };
    const json = encodeURIComponent(JSON.stringify(d));
    await load(page, `defaults=${json}`);
    let s = await state(page);
    expect([s.view, s.wpm, s.words, s.size, s.align]).toEqual(['Sequence', '200', '2', 'S', 'Pivot']);
    await act(page, 'view');
    s = await state(page);
    expect([s.view, s.wpm, s.words]).toEqual(['Flow', '350', '4']);
    expect(await page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector('.fr')!.classList.contains('no-underline'))).toBe(true);
    await act(page, 'words+');
    await act(page, 'words+');
    await act(page, 'words+');
    s = await state(page);
    expect([s.words, s.wpm]).toEqual(['¶', '225']);
    // the view it opens in
    await load(page, `defaults=${encodeURIComponent(JSON.stringify({ ...d, view: 'flow' }))}`);
    expect((await state(page)).view).toBe('Flow');
    // an attribute wins over defaults for the view it starts in
    await load(page, `wpm=500&defaults=${json}`);
    s = await state(page);
    expect([s.view, s.wpm, s.words]).toEqual(['Sequence', '500', '2']);
  });

  test('defaults that are not JSON are ignored', async ({ page }) => {
    await load(page, 'defaults=nope');
    const s = await state(page);
    expect([s.view, s.wpm]).toEqual(['Sequence', '150']);
  });

  test('each view keeps its words per frame through a switch to the other and back', async ({ page }) => {
    await load(page, 'words=3&size=s');
    await act(page, 'view');
    await act(page, 'words-');
    let s = await state(page);
    expect([s.view, s.words]).toEqual(['Flow', '5']);
    await act(page, 'view');
    s = await state(page);
    expect([s.view, s.words, s.size, s.chunk]).toEqual(['Sequence', '3', 'S', 'How a page']);
    await act(page, 'view');
    expect((await state(page)).words).toBe('5');
  });

  test('a larger size still takes words off a frame that no longer fits', async ({ page }) => {
    await load(page, 'words=6&size=s');
    expect((await state(page)).words).toBe('6');
    for (let i = 0; i < 3; i++) await act(page, 'size+');
    const s = await state(page);
    expect(s.size).toBe('XL');
    expect(Number(s.words)).toBeLessThan(6);
  });

  test('an unknown view, size or align is ignored', async ({ page }) => {
    await load(page, 'view=grid&size=huge&align=right');
    const s = await state(page);
    expect([s.view, s.size, s.align]).toEqual(['Sequence', 'M', 'Left']);
    expect(await page.locator('focus-reader').getAttribute('view')).toBe('sequence');
  });

  test('heading and name; an empty name hides the label, its cell included', async ({ page }) => {
    await load(page, 'heading=Another title&name=Reader');
    let s = await state(page);
    expect([s.title, s.name]).toEqual(['Another title', 'Reader']);
    await page.locator('focus-reader').evaluate((el) => el.setAttribute('name', ''));
    s = await state(page);
    expect(s.name).toBe('');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('focus-reader')!.shadowRoot!.querySelector('[data-name]')!).display)).toBe('none');
  });

  test('modal: hidden until opened, and the dialog takes its title for a name', async ({ page }) => {
    await load(page, 'modal');
    expect(await page.locator('focus-reader').isVisible()).toBe(false);
    await open(page);
    expect(await page.evaluate(() => document.querySelector('focus-reader')!.shadowRoot!.querySelector('dialog')!.getAttribute('aria-label'))).toBe('A text to test with');
  });
});

test.describe('a short panel: a phone on its side', () => {
  // an iPhone held sideways, once Safari's bar, the notch and the home bar are taken off
  test.use({ viewport: { width: 750, height: 308 } });

  /** What the panel shows between its rulers and under the band, in px. */
  const room = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const r = document.querySelector('focus-reader')!.shadowRoot!;
      const rect = (s: string) => r.querySelector(s)!.getBoundingClientRect();
      const context = r.querySelector<HTMLElement>('[data-context]')!;
      const text = r.querySelector<HTMLElement>('[data-text]')!;
      return {
        window: rect('.window').height,
        flowLine: parseFloat(getComputedStyle(text).lineHeight),
        context: getComputedStyle(context).display === 'none' ? 0 : rect('[data-context]').height,
        contextBottom: rect('[data-context]').bottom,
        contextLine: parseFloat(getComputedStyle(context).lineHeight),
        belowBottom: rect('.below').bottom,
      };
    });

  test('Sequence: the sentence under the band shows whole lines, inside its row', async ({ page }) => {
    await load(page, 'modal');
    await open(page);
    await act(page, 'play');
    await act(page, 'play');
    expect((await state(page)).context).not.toBe('');
    const m = await room(page);
    if (m.context) {
      expect(m.contextBottom).toBeLessThanOrEqual(m.belowBottom + 0.5);
      const lines = m.context / m.contextLine;
      expect(Math.abs(lines - Math.round(lines))).toBeLessThan(0.05);
    }
  });

  test('Flow: three lines or more between the rulers', async ({ page }) => {
    await load(page, 'modal&view=flow');
    await open(page);
    const m = await room(page);
    expect(m.window / m.flowLine).toBeGreaterThanOrEqual(3);
  });

  test('a paragraph at a time: three lines or more between the rulers', async ({ page }) => {
    await load(page, 'modal&view=flow&words=6');
    await open(page);
    await act(page, 'words+');
    expect((await state(page)).words).toBe('¶');
    const m = await room(page);
    expect(m.window / m.flowLine).toBeGreaterThanOrEqual(3);
  });
});

test.describe('the text it reads', () => {
  test('`for`: the element of the page it names', async ({ page }) => {
    await load(page);
    expect((await state(page)).total).toBe('/ 731');
  });

  test('a <template> inside it', async ({ page }) => {
    await load(page, 'src=template');
    expect((await state(page)).total).toBe('/ 731');
  });

  test('its own content, as plain text', async ({ page }) => {
    await load(page, 'src=short');
    const s = await state(page);
    expect(s.total).toBe('/ 9');
    expect(s.chunk).toBe('One');
  });

  test('`for` changed, it reads the new text from the top; reload() reads the same again, keeping the place', async ({ page }) => {
    await load(page);
    await page.evaluate(() => {
      const t = document.createElement('template');
      t.id = 'other';
      t.innerHTML = '<p>A different text, of exactly seven words.</p>';
      document.body.append(t);
    });
    await page.locator('focus-reader').evaluate((el) => el.setAttribute('for', 'other'));
    let s = await state(page);
    expect([s.total, s.chunk]).toEqual(['/ 7', 'A']);
    await page.locator('focus-reader').evaluate((el) => el.setAttribute('for', 'article'));
    await open(page);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.evaluate(() => document.querySelector('#article p')!.prepend('Added. '));
    await page.locator('focus-reader').evaluate((el) => (el as HTMLElement & { reload(): void }).reload());
    s = await state(page);
    expect(s.total).toBe('/ 732');
    expect(s.chunk).toBe('is');
  });

  test('no text: nothing to play', async ({ page }) => {
    await load(page, 'src=none');
    const s = await state(page);
    expect([s.total, s.chunk, s.read]).toEqual(['/ 0', '', '0']);
    await page.locator('focus-reader').evaluate((el) => (el as HTMLElement & { play(): void }).play());
    expect((await state(page)).state).toBe('Play');
  });

  test('to the end: Read again, and it says so', async ({ page }) => {
    await load(page, 'src=short&wpm=800&modal');
    await open(page);
    await page.keyboard.press('Space');
    await until(page, (s) => s.state, 'Read again');
    const s = await state(page);
    expect([s.read, s.pct, s.left]).toEqual(['9', '100%', '0:00 min']);
    await until(page, (x) => x.live, 'End of the text');
    // and Play starts from the top
    await page.keyboard.press('Space');
    await until(page, (x) => x.state, 'Reading');
  });

  test('what is left, in minutes at this pace', async ({ page }) => {
    await load(page);
    // 731 words at 150 wpm: 4 min 52 s
    expect((await state(page)).left).toBe('4:52 min');
    await load(page, 'wpm=100');
    expect((await state(page)).left).toBe('7:19 min');
  });
});

test.describe('the public API', () => {
  test('open(), close(), play(), pause(), toggle(), playing and isOpen', async ({ page }) => {
    await load(page, 'modal');
    const call = (m: string) => page.locator('focus-reader').evaluate((el, m) => (el as unknown as Record<string, () => void>)[m](), m);
    const get = (p: string) => page.locator('focus-reader').evaluate((el, p) => (el as unknown as Record<string, boolean>)[p], p);
    await call('open');
    expect(await get('isOpen')).toBe(true);
    await call('play');
    expect(await get('playing')).toBe(true);
    await call('pause');
    expect(await get('playing')).toBe(false);
    await call('toggle');
    expect(await get('playing')).toBe(true);
    await call('close');
    // closing pauses
    expect([await get('isOpen'), await get('playing')]).toEqual([false, false]);
  });
});

test.describe('persist', () => {
  test('keeps the view, the alignment and each view\'s pace in this browser', async ({ page }) => {
    await load(page, 'persist');
    await act(page, 'wpm+');
    await act(page, 'align');
    await act(page, 'view');
    await act(page, 'words+');
    await act(page, 'words+');
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('focus-reader.v4')!));
    expect(kept).toEqual({
      view: 'flow',
      align: 'center',
      underline: true,
      para: true,
      paces: {
        sequence: { wpm: 175, words: 1, size: 'm' },
        flow: { wpm: 300, words: 6, size: 'm' },
        paragraph: { wpm: 250, words: 6, size: 'm' },
      },
    });
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    let s = await state(page);
    expect([s.view, s.words, s.wpm]).toEqual(['Flow', '¶', '250']);
    await act(page, 'view');
    s = await state(page);
    expect([s.view, s.wpm, s.align]).toEqual(['Sequence', '175', 'Centre']);
  });

  test('without persist, nothing is kept', async ({ page }) => {
    await load(page);
    await act(page, 'wpm+');
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test('what was kept wins over the attributes', async ({ page }) => {
    await load(page, 'persist');
    await act(page, 'wpm+');
    await load(page, 'persist&wpm=400');
    expect((await state(page)).wpm).toBe('175');
  });
});

test.describe('the colour scheme', () => {
  test('with the system defaults, the panel follows the dark scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await load(page);
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('focus-reader')!.shadowRoot!.querySelector('.fr')!).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect(r + g + b).toBeLessThan(150);
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await page.evaluate(() => getComputedStyle(document.querySelector('focus-reader')!.shadowRoot!.querySelector('.fr')!).backgroundColor);
    expect(light).toBe('rgb(255, 255, 255)');
  });

  test('--fr-* custom properties set from the page reach the panel', async ({ page }) => {
    await load(page);
    await page.addStyleTag({ content: 'focus-reader { --fr-paper: rgb(1, 2, 3); --fr-accent: rgb(200, 0, 0); --fr-font-text: Georgia; }' });
    const got = await page.evaluate(() => {
      const r = document.querySelector('focus-reader')!.shadowRoot!;
      return [
        getComputedStyle(r.querySelector('.fr')!).backgroundColor,
        getComputedStyle(r.querySelector('.mark')!, '::after').backgroundColor,
        getComputedStyle(r.querySelector('[data-chunk]')!).fontFamily,
      ];
    });
    expect(got).toEqual(['rgb(1, 2, 3)', 'rgb(200, 0, 0)', 'Georgia']);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no ghost of the frame before, no transitions', async ({ page }) => {
    await load(page, 'modal&wpm=600');
    await open(page);
    await page.evaluate(() => {
      const ghost = document.querySelector('focus-reader')!.shadowRoot!.querySelector('[data-ghost]')!;
      const w = window as unknown as { ghosted: boolean };
      w.ghosted = false;
      new MutationObserver(() => (w.ghosted ||= ghost.classList.contains('on'))).observe(ghost, { attributes: true });
    });
    await page.keyboard.press('Space');
    await expect.poll(async () => Number((await state(page)).read)).toBeGreaterThan(4);
    expect(await page.evaluate(() => (window as unknown as { ghosted: boolean }).ghosted)).toBe(false);
    const d = await page.evaluate(() => {
      const r = document.querySelector('focus-reader')!.shadowRoot!;
      return [getComputedStyle(r.querySelector('.text')!).transitionDuration, getComputedStyle(r.querySelector('.bar')!).transitionDuration];
    });
    expect(d).toEqual(['0s', '0s']);
  });

  test('a wheel notch moves at once instead of gliding', async ({ page }) => {
    await load(page, 'modal');
    await open(page);
    const b = await box(page, '[data-band]');
    await page.mouse.move(b.cx, b.cy);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(100);
    const s = (await state(page)).read;
    await page.waitForTimeout(600);
    // 100 px: three frames on (32 px each), nothing after
    expect([s, (await state(page)).read]).toEqual(['4', '4']);
  });
});
