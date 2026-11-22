// What the browser tests read of the reader, from its shadow root, and how they drive it.
import { expect, type Page } from '@playwright/test';

/** Opens the test page with these attributes (see test/fixtures/reader.ts) and waits for the reader. */
export async function load(page: Page, query = '') {
  await page.goto(`reader.html${query ? `?${query}` : ''}`);
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
}

export interface State {
  view: string;
  state: string;
  wpm: string;
  words: string;
  size: string;
  align: string;
  chunk: string;
  context: string;
  read: string;
  total: string;
  left: string;
  pct: string;
  live: string;
  name: string;
  title: string;
  door: string;
  /** Flow: the frame being read, as [first word, last word + 1] */
  now: [number, number] | null;
  quiet: boolean;
  open: boolean;
  dialog: boolean;
  /** Flow's underline: [left, width] of each bar */
  bars: [number, number][];
}

/** The reader's state, as its panel shows it. */
export function state(page: Page): Promise<State> {
  return page.evaluate(() => {
    const host = document.querySelector('focus-reader')!;
    const r = host.shadowRoot!;
    const t = (s: string) => r.querySelector(s)?.textContent ?? '';
    const now = [...r.querySelectorAll<HTMLElement>('.w.now')];
    return {
      view: t('[data-act="view"]'),
      state: t('[data-state]'),
      wpm: t('[data-wpm]'),
      words: t('[data-words]'),
      size: t('[data-size]'),
      align: t('[data-act="align"]'),
      chunk: t('[data-chunk]'),
      context: t('[data-context]'),
      read: t('[data-read]'),
      total: t('[data-total]'),
      left: `${t('[data-left]')} ${t('[data-left-unit]')}`,
      pct: t('[data-pct]'),
      live: t('[data-live]'),
      name: t('[data-name]'),
      title: t('[data-title]'),
      door: t('[data-door]'),
      now: now.length ? [Number(now[0].dataset.i), Number(now.at(-1)!.dataset.i) + 1] : null,
      quiet: r.querySelector('.fr')!.classList.contains('quiet'),
      open: host.hasAttribute('open'),
      dialog: r.querySelector('dialog')!.open,
      bars: [...r.querySelectorAll<HTMLElement>('.text .under')].map((b) => [b.offsetLeft, b.offsetWidth] as [number, number]),
    };
  });
}

/** The box of an element of the panel, on screen. */
export async function box(page: Page, selector: string) {
  const b = await page.evaluate((s) => {
    const r = document.querySelector('focus-reader')!.shadowRoot!.querySelector(s)!.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, selector);
  return { ...b, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

/** Clicks a control of the panel by its data-act. */
export function act(page: Page, name: string) {
  return page.evaluate((n) => document.querySelector('focus-reader')!.shadowRoot!.querySelector<HTMLElement>(`[data-act="${n}"]`)!.click(), name);
}

/** Opens the full-window panel from the page's own button. */
export async function open(page: Page) {
  await page.click('#open');
  await expect.poll(async () => (await state(page)).dialog).toBe(true);
}

/** Waits for the panel to show this, polling. */
export async function until(page: Page, pick: (s: State) => unknown, value: unknown) {
  await expect.poll(async () => pick(await state(page)), { timeout: 5000 }).toEqual(value);
}

/** The events the reader sent, in order. */
export function events(page: Page): Promise<[string, unknown][]> {
  return page.evaluate(() => (window as unknown as { events: [string, unknown][] }).events);
}
