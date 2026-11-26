// What changed for the reader to leave elchdl (#79, step 3): the words from `labels`, numbers and plurals in the
// reader's language, a text without spaces cut by Intl.Segmenter, and a system accent by default.
import { expect, test, type Page } from '@playwright/test';
import { act, load, open, state, until } from './helpers';

const FR = {
  name: 'Lecteur',
  view: 'Vue',
  sequence: 'Séquence',
  flow: 'Flux',
  speed: 'Vitesse',
  slower: 'Plus lent',
  rate: 'Rythme',
  wpm: 'mots/min',
  remaining: 'Reste',
  play: 'Lire',
  reading: 'Lecture',
  fullScreen: 'Plein écran',
  close: 'Fermer',
  startKeys: 'Espace ou un clic sur la bande pour commencer.',
  keySpace: 'Espace',
  playing: 'Lecture à {wpm} mots par minute',
  wordsPerFrame: ['{n} mot par cadre', '{n} mots par cadre'],
  viewSaid: 'Vue {view}',
};

const shadowText = (page: Page, sel: string) =>
  page.evaluate((s) => document.querySelector('focus-reader')!.shadowRoot!.querySelector(s)!.textContent, sel);
const shadowAttr = (page: Page, sel: string, a: string) =>
  page.evaluate(([s, a]) => document.querySelector('focus-reader')!.shadowRoot!.querySelector(s)!.getAttribute(a), [sel, a]);

test('the English defaults, as before', async ({ page }) => {
  await load(page);
  expect(await page.locator('focus-reader').evaluate((el) => (el as HTMLElement & { labels: { alignCenter: string } }).labels.alignCenter)).toBe('Centre');
  expect(await shadowText(page, '.desk-keys')).toBe('Space play · ← → frame · Scroll frametext · ↑ ↓ speed · Esc close');
  expect(await shadowAttr(page, '[data-act="wpm-"]', 'aria-label')).toBe('Slower');
  expect(await shadowAttr(page, '[data-seek]', 'aria-valuetext')).toBe('Word 0 of 731, 4:52 min left');
});

test('the labels attribute, as JSON, changes the words given and keeps the others', async ({ page }) => {
  await load(page, `lang=fr&labels=${encodeURIComponent(JSON.stringify(FR))}`);
  const s = await state(page);
  expect([s.name, s.view, s.state, s.door, s.context]).toEqual(['Lecteur', 'Séquence', 'Lire', 'Plein écran', FR.startKeys]);
  expect(await shadowText(page, '[data-l="speed"]')).toBe('Vitesse');
  expect(await shadowText(page, '.stat .unit')).toBe('mots/min');
  expect(await shadowAttr(page, '[data-act="wpm-"]', 'aria-label')).toBe('Plus lent');
  // not given: English
  expect(await shadowText(page, '[data-l="words"]')).toBe('Words');
  expect(await shadowText(page, '.desk-keys b')).toBe('Espace');
  await open(page);
  expect((await state(page)).door).toBe('Fermer');
  await page.keyboard.press('Space');
  await until(page, (x) => x.live, 'Lecture à 150 mots par minute');
  await page.keyboard.press('Space');
  // plurals by the French rules: 1 is "one", so is 0; 2 is not
  await act(page, 'words+');
  await until(page, (x) => x.live, '2 mots par cadre');
  await act(page, 'words-');
  await until(page, (x) => x.live, '1 mot par cadre');
  await act(page, 'view');
  await until(page, (x) => x.live, 'Vue Flux');
  expect((await state(page)).view).toBe('Flux');
});

test('numbers in the reader\'s language', async ({ page }) => {
  await load(page, 'lang=fr');
  // a narrow no-break space groups thousands in French, so a larger count shows it
  await page.evaluate(() => {
    const t = document.createElement('template');
    t.id = 'long';
    t.innerHTML = `<p>${'mot '.repeat(1958)}</p>`;
    document.body.append(t);
  });
  await page.locator('focus-reader').evaluate((el) => el.setAttribute('for', 'long'));
  expect((await state(page)).total).toBe('/ 1\u202f958');
});

test('the labels property, over the attribute; null goes back to it', async ({ page }) => {
  await load(page, `labels=${encodeURIComponent(JSON.stringify({ play: 'Go', name: 'Attr' }))}`);
  type L = HTMLElement & { labels: Record<string, unknown> | null };
  await page.locator('focus-reader').evaluate((el) => ((el as L).labels = { play: 'Start', unknown: 'x', reading: 42 }));
  let s = await state(page);
  expect([s.state, s.name]).toEqual(['Start', 'Attr']);
  // unknown keys and values of the wrong type are ignored
  expect(await page.locator('focus-reader').evaluate((el) => [(el as L).labels!.unknown, (el as L).labels!.reading])).toEqual([undefined, 'Reading']);
  await page.locator('focus-reader').evaluate((el) => ((el as L).labels = null));
  s = await state(page);
  expect(s.state).toBe('Go');
});

test('labels that are not JSON: a warning, and the defaults', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  await load(page, 'labels=not-json');
  expect((await state(page)).state).toBe('Play');
  expect(warnings.some((w) => w.includes('labels'))).toBe(true);
});

test('a text without spaces: words cut by Intl.Segmenter, shown without spaces', async ({ page }) => {
  await load(page, 'src=ja&lang=ja&modal');
  await open(page);
  let s = await state(page);
  expect(s.total).toBe('/ 8');
  expect(s.chunk).toBe('日本語');
  await act(page, 'words+');
  await act(page, 'words+');
  s = await state(page);
  expect(s.chunk).toBe('日本語の文章');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  s = await state(page);
  expect(s.chunk).toBe('次の文、');
  // paused, the sentence under the band, without spaces either
  expect(s.context).toBe('次の文、短い。');
  // Flow: the words side by side, as written
  await act(page, 'view');
  expect(await shadowText(page, '.text p')).toBe('日本語の文章です。次の文、短い。');
});

test('by default, the accent is the system\'s link colour', async ({ page }) => {
  await load(page);
  const [accent, link] = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'LinkText';
    document.body.append(probe);
    const r = document.querySelector('focus-reader')!.shadowRoot!;
    return [getComputedStyle(r.querySelector('.mark')!, '::after').backgroundColor, getComputedStyle(probe).color];
  });
  expect(accent).toBe(link);
});
