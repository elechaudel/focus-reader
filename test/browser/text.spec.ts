// blocksFromElement on a real page (test/fixtures/text.html): what is read, in order, and what is skipped.
import { expect, test } from '@playwright/test';

test('reads paragraphs, headings, list items, quotes and definitions; skips the rest', async ({ page }) => {
  await page.goto('text.html');
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  const blocks = await page.evaluate(() => (window as any).text.blocksFromElement(document.getElementById('body')));
  expect(blocks).toEqual([
    { kind: 'heading', text: 'The title' },
    { kind: 'p', text: 'A paragraph, on two lines.' },
    { kind: 'p', text: 'With inline markup, a break inside, and an image.' },
    { kind: 'p', text: 'A footnote marker skipped.' },
    { kind: 'item', text: 'First item.' },
    { kind: 'item', text: 'Second item, with code inline.' },
    { kind: 'quote', text: 'A quoted paragraph.' },
    { kind: 'quote', text: 'And another.' },
    { kind: 'quote', text: 'A quote without paragraphs.' },
    { kind: 'heading', text: "A section's heading" },
    { kind: 'p', text: 'A bare div of text.' },
    { kind: 'p', text: 'Term' },
    { kind: 'p', text: 'Its definition.' },
  ]);
});

test("reads a <template>'s content, skipping its media", async ({ page }) => {
  await page.goto('text.html');
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  const blocks = await page.evaluate(() =>
    (window as any).text.blocksFromElement((document.getElementById('tpl') as HTMLTemplateElement).content),
  );
  expect(blocks).toEqual([
    { kind: 'heading', text: 'In a template' },
    { kind: 'p', text: 'Read from its content.' },
  ]);
});
