// The test page's reader. Every query parameter becomes an attribute of <focus-reader>, except:
// - `src`: where it reads from. `for` (default): the article on the page, through `for="article"`; `template`:
//   a <template> inside it; `short`: its own content, three sentences; `none`: no text at all.
// - `scope`: the block holding the reader and a control of the page's own is marked data-focus-reader-scope.
// The events it sends are kept in window.events, in order.
import { ARTICLE } from './text';

const params = new URLSearchParams(location.search);
const src = params.get('src') ?? 'for';

const article = document.getElementById('article')!;
article.innerHTML = ARTICLE;

const reader = document.createElement('focus-reader');
for (const [k, v] of params) if (k !== 'src' && k !== 'scope') reader.setAttribute(k, v);
if (!reader.hasAttribute('heading')) reader.setAttribute('heading', 'A text to test with');
if (src === 'for') reader.setAttribute('for', 'article');
else if (src === 'template') reader.innerHTML = `<template>${ARTICLE}</template>`;
else if (src === 'short') reader.textContent = 'One two three. Four five six.\n\nSeven eight nine.';
if (params.has('scope')) document.getElementById('scope')!.setAttribute('data-focus-reader-scope', '');

const events: [string, unknown][] = [];
(window as unknown as { events: typeof events }).events = events;
for (const type of ['focusreaderopen', 'focusreaderclose', 'focusreaderview']) {
  reader.addEventListener(type, (e) => events.push([type, (e as CustomEvent).detail ?? null]));
}
document.getElementById('open')!.addEventListener('click', () => reader.open());
document.getElementById('tile')!.append(reader);

await import('../../src/register');
document.documentElement.dataset.ready = '';
