# focus-reader

`<focus-reader>` shows a text a few words at a time, like subtitles, at a pace you pick, in a panel with its size and progress. It reads the article already on your page, which stays as it is. It is one custom element and a few pure functions, with no dependency and no framework. An Astro integration and component come with it.

**[focus-reader.elchdl.com](https://focus-reader.elchdl.com)**: see it read, [the documentation](https://focus-reader.elchdl.com/docs/), and a [playground](https://focus-reader.elchdl.com/playground/) to try it on a text of your own.

It started as a Lab experiment on elchdl, [The Focus Reader](https://elchdl.com/lab/the-focus-reader/).

## Install

```sh
npm install focus-reader
```

Or, on a page with no build step, from a CDN:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/focus-reader/dist/src/register.js"></script>
```

It works in the browsers of [Baseline widely available](https://web.dev/baseline), and is tested in the latest Chrome, Firefox and Safari, on the desktop and on iOS.

## Use

```html
<button onclick="document.querySelector('focus-reader').open()">Focus</button>
<focus-reader for="article-body" heading="A visual direction" modal persist></focus-reader>
<script type="module">import 'focus-reader/element';</script>
```

`for` is the id of the element whose text it reads. With `modal` it stays hidden until opened; without it, it sits in the page and fills its box. `persist` remembers each reader's settings in their browser.

With Astro 7:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import focusReader from 'focus-reader/astro';

export default defineConfig({ integrations: [focusReader()] });
```

```astro
---
import FocusReader from 'focus-reader/astro/FocusReader.astro';
---
<FocusReader heading={title}>
  <article><Content /></article>
</FocusReader>
```

## Documentation

- [Getting started](https://focus-reader.elchdl.com/docs/getting-started/)
- [Attributes](https://focus-reader.elchdl.com/docs/attributes/): what it reads, how it starts, what it remembers
- [Methods and events](https://focus-reader.elchdl.com/docs/methods-and-events/), and the keys
- [Astro](https://focus-reader.elchdl.com/docs/astro/): the integration and the component
- [Theming](https://focus-reader.elchdl.com/docs/theming/): the `--fr-*` custom properties
- [Labels and languages](https://focus-reader.elchdl.com/docs/labels/)
- [How it reads](https://focus-reader.elchdl.com/docs/how-it-reads/): frames and timing
- [Text functions](https://focus-reader.elchdl.com/docs/text-functions/): `focus-reader/text`
- [Performance](https://focus-reader.elchdl.com/docs/performance/)

## Development

```sh
pnpm install
pnpm check   # types
pnpm test    # unit and browser tests
pnpm site    # the site (landing, docs, playground), served by Astro
pnpm build   # dist/, as npm gets it
```

The package exports its TypeScript sources while you work on it; `publishConfig` points npm at `dist/` (`pnpm build` writes it, and `pnpm pack` and `pnpm publish` run it first). `pnpm site:build` writes the site to `site/dist/`, which Netlify serves at focus-reader.elchdl.com on every push to `main` (`netlify.toml`). The documentation is the site's: its pages are the Markdown files in `site/src/content/docs/`. The site is built with the package's own Astro integration and component, and looks like elchdl: its design tokens and base styles are copied into `site/src/styles/` by `pnpm sync:tokens`, from a checkout of elchdl beside this repository. Releases go through Changesets: see [RELEASING.md](RELEASING.md).

## Tests

- `pnpm test:unit`: the text functions (blocks from plain text, words, frames, timing, `frameAt`, `orp`), with Node's own test runner, in `test/text.test.ts`.
- `pnpm test:browser`: the element in a browser, with Playwright, on the test pages in `test/fixtures` (served by Vite): keys, clicks, scroll and glide, both views, the paragraph mode, the attributes, where it reads from, `persist`, the dark scheme, reduced motion, and on a phone a tap, a swipe and full screen. Extraction from a page (`blocksFromElement`) is tested there too, on a real DOM.
- `pnpm test`: both.

Locally the browser tests run in the Chrome installed on the machine, as a desktop window and as a phone, so nothing is downloaded. `FR_BROWSERS=all pnpm test:browser` adds Playwright's Firefox and WebKit, once installed with `pnpm exec playwright install firefox webkit`; CI (`CI=1`) runs all of them, with Playwright's Chromium in place of Chrome: `.github/workflows/ci.yml`, on every push and pull request.

## Licence

MIT, see [LICENSE](LICENSE).
