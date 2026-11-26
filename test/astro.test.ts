// The Astro integration's options, as they reach the page: the component's attributes and the theme's CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readerConfig, themeCSS } from '../astro/options.ts';

test('readerConfig: nothing given, the element\'s own defaults, persist on', () => {
  assert.deepEqual(readerConfig(), {
    persist: true,
    defaults: undefined,
    labels: undefined,
    open: 'Focus reader',
    noScript: 'The focus reader needs JavaScript.',
  });
});

test('readerConfig: the views\' settings as the `defaults` attribute, in JSON', () => {
  const c = readerConfig({
    view: 'flow',
    sequence: { wpm: 200, words: 2, size: 'l', align: 'pivot' },
    flow: { underline: false },
    paragraph: {},
    persist: false,
  });
  assert.equal(c.persist, false);
  assert.deepEqual(JSON.parse(c.defaults!), {
    view: 'flow',
    sequence: { wpm: 200, words: 2, size: 'l', align: 'pivot' },
    flow: { underline: false },
  });
});

test('readerConfig: only the labels that differ from the defaults; the component keeps its own two', () => {
  const c = readerConfig({
    labels: { play: 'Lire', name: 'Focus reader', open: 'Lire en mode focus', noScript: 'Il faut JavaScript.', unknown: 'x' } as never,
  });
  assert.deepEqual(JSON.parse(c.labels!), { play: 'Lire' });
  assert.equal(c.open, 'Lire en mode focus');
  assert.equal(c.noScript, 'Il faut JavaScript.');
});

test('themeCSS: nothing given, nothing written', () => {
  assert.equal(themeCSS(), '');
  assert.equal(themeCSS({ light: {}, fonts: {} }), '');
});

test('themeCSS: light colours and fonts on every reader, as --fr-* properties', () => {
  assert.equal(
    themeCSS({
      light: { paper: '#f3f2ee', ink: '#141514', accent: 'var(--brand, #3b64ea)', accentText: '#2a4bc4', onInk: 'white' },
      fonts: { text: 'Inter, system-ui, sans-serif', label: 'ui-monospace, monospace' },
    }),
    'focus-reader { --fr-paper: #f3f2ee; --fr-ink: #141514; --fr-accent: var(--brand, #3b64ea); --fr-accent-text: #2a4bc4; --fr-on-ink: white; --fr-font-text: Inter, system-ui, sans-serif; --fr-font-label: ui-monospace, monospace; }\n',
  );
});

test('themeCSS: dark follows the system, or a site\'s own switch', () => {
  assert.equal(
    themeCSS({ dark: { paper: '#141514', ink: '#f3f2ee' } }),
    '@media (prefers-color-scheme: dark) { focus-reader { --fr-paper: #141514; --fr-ink: #f3f2ee; } }\n',
  );
  assert.equal(
    themeCSS({ dark: { paper: '#000' }, darkSelector: '[data-theme="dark"]', lightSelector: '[data-theme="light"]' }),
    [
      '@media (prefers-color-scheme: dark) { focus-reader:not(:is([data-theme="light"]) *) { --fr-paper: #000; } }',
      ':is([data-theme="dark"]) focus-reader { --fr-paper: #000; }',
      '',
    ].join('\n'),
  );
});

test('themeCSS: a value that could end the rule stops the build, with its name', () => {
  assert.throws(() => themeCSS({ light: { paper: 'red; } body { display: none' } }), /theme's paper/);
  assert.throws(() => themeCSS({ fonts: { text: '' } }), /fonts\.text/);
  assert.throws(() => themeCSS({ dark: { ink: '#fff' }, darkSelector: 'a{' }), /darkSelector/);
});
