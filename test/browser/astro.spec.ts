// The Astro integration and <FocusReader>, on the test site (test/astro): what the page shows with and without
// JavaScript, the settings and labels reaching the reader, the theme in light and dark.
import { expect, test, type Page } from '@playwright/test';

const reader = (page: Page, n: number) => page.locator('focus-reader').nth(n);
const inside = <T>(page: Page, n: number, fn: (r: ShadowRoot) => T) =>
  page.evaluate(([n, f]) => new Function('r', `return (${f})(r)`)(document.querySelectorAll('focus-reader')[n as number].shadowRoot), [n, fn.toString()] as const) as Promise<T>;
const paper = (page: Page, n: number) => inside(page, n, (r) => getComputedStyle(r.querySelector('.fr')!).backgroundColor);

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the article reads as it is; no button; a reader in place says it needs JavaScript', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'An article' })).toBeVisible();
    await expect(page.getByText('It stays in the page as it is')).toBeVisible();
    await expect(page.locator('button')).toBeHidden();
    await expect(page.getByText('Le lecteur a besoin de JavaScript.')).toBeVisible();
  });
});

test.describe('with JavaScript', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!customElements.get('focus-reader'));
  });

  test('each reader has its own id; the one around the article reads it, hidden until opened', async ({ page }) => {
    const ids = await page.locator('focus-reader').evaluateAll((els) => els.map((e) => [e.id, e.getAttribute('for')]));
    expect(ids).toEqual([
      ['focus-reader-1', 'focus-reader-text-1'],
      ['focus-reader-2', 'other'],
    ]);
    await expect(reader(page, 0)).toBeHidden();
    await expect(page.getByText('Le lecteur a besoin de JavaScript.')).toBeHidden();
  });

  test('the button shows, with its label, and opens the reader with the settings and labels', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Ouvrir le lecteur' });
    await expect(button).toBeVisible();
    await button.click();
    expect(await reader(page, 0).evaluate((el) => (el as HTMLElement & { isOpen: boolean }).isOpen)).toBe(true);
    const shown = await inside(page, 0, (r) => [r.querySelector('[data-wpm]')!.textContent, r.querySelector('[data-state]')!.textContent, r.querySelector('[data-title]')!.textContent]);
    expect(shown).toEqual(['200', 'Lire', 'An article']);
    // the article's 23 words, heading included
    expect(await inside(page, 0, (r) => r.querySelector('[data-total]')!.textContent)).toBe('/ 23');
    // persist, by default
    await page.keyboard.press('ArrowUp');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('focus-reader.v4')!).paces.sequence.wpm)).toBe(225);
  });

  test('the reader in place fills its box', async ({ page }) => {
    await expect(reader(page, 1)).toBeVisible();
    const h = await reader(page, 1).evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBe(560);
  });

  test('the theme: light colours and fonts', async ({ page }) => {
    expect(await paper(page, 1)).toBe('rgb(250, 250, 240)');
    const got = await inside(page, 1, (r) => [
      getComputedStyle(r.querySelector('.mark')!, '::after').backgroundColor,
      getComputedStyle(r.querySelector('[data-chunk]')!).fontFamily,
    ]);
    expect(got).toEqual(['rgb(200, 0, 0)', 'Georgia, serif']);
  });

  test('the theme: dark with the system, unless the site says light; dark when the site says so', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await paper(page, 1)).toBe('rgb(10, 10, 20)');
    await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    expect(await paper(page, 1)).toBe('rgb(250, 250, 240)');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    expect(await paper(page, 1)).toBe('rgb(10, 10, 20)');
  });
});
