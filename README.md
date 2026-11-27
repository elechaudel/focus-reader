# focus-reader

`<focus-reader>` shows a text a few words at a time, like subtitles, at a pace you pick, in a panel with its size and progress. It reads the article already on your page, which stays as it is. It is one custom element and a few pure functions, with no dependency and no framework. An Astro integration and component come with it.

It started as a Lab experiment on elchdl, [The Focus Reader](https://elchdl.com/lab/the-focus-reader/). See it on a plain page with `pnpm demo` (the demo is in `demo/`).

## Install

```sh
npm install focus-reader
```

Or, on a page with no build step, from a CDN:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/focus-reader/dist/src/register.js"></script>
```

It works in the browsers of [Baseline widely available](https://web.dev/baseline), and is tested in the latest Chrome, Firefox and Safari, on the desktop and on iOS. Without JavaScript, the page reads as it is: a reader you open stays hidden, so give its button `hidden` and show it from your script, as the Astro component does.

## Use

```html
<button onclick="document.querySelector('focus-reader').open()">Focus</button>
<focus-reader for="article-body" heading="A visual direction" modal persist></focus-reader>
<script type="module">import 'focus-reader/element';</script>
```

`focus-reader/element` (or `focus-reader`) registers the element and exports its class; `focus-reader/register` registers it and exports nothing.

- `for`: id of the element whose text it reads (an article's body, a `<template>`). Without it, a `<template>` inside the element, or else its own content. Paragraphs, headings, list items and quotes are read; code blocks, figures, media, tables and anything with `data-focus-reader-skip` are not. Words are cut at spaces, and a run in a language written without them (Chinese, Japanese, Thai…) is cut by `Intl.Segmenter`, in the reader's language.
- `heading`: the title at the top. `name`: the label before it (default "Focus reader"; empty, no label).
- `wpm` (100–800), `words` per frame (1–6) and `size` (`s`, `m`, `l`, `xl`): the pace of the view it starts in. Each view keeps its own: Sequence 150 wpm, one word, M; Flow 300 wpm, six words, M. `persist` keeps both.
- `underline="off"`: in Flow, the words being read only in ink, without the accent's underline (a setting of the panel too).
- `align` (`left` on a marker, `center` like subtitles, `pivot` on the recognition point as Spritz does).
- `view`: `sequence` (default), one frame at a time on a band, or `flow`, the whole text with the frame being read marked, moving up a line at a time like song lyrics. In Flow, Words goes on past six to ¶: a whole paragraph at a time, with a pace line in the margin and a pace of its own (250 wpm). It reflects the view shown, and changing it switches.
- `modal`: hidden until opened. Without it, the reader sits in the page, filling its box, and opens to the full window from its own button.
- `persist`: remembers the settings in this browser (`localStorage`, key `focus-reader.v4`).
- `labels`: the words the panel shows and says, as JSON, over the English defaults; only the ones given change. The `labels` property does the same from a script (`null` goes back to the attribute's). Every key and its default is in `src/labels.ts` (`LABELS`); `{wpm}`-like marks are filled in, and a pair is `[one, other]`, picked by the plural rules of the language.
- `defaults`: where each view starts, as JSON, for a site that sets it once for all its readers (the Astro integration writes it): `{"view": "flow", "sequence": {"wpm": 200, "words": 1, "size": "m", "align": "left"}, "flow": {"wpm": 300, "words": 6, "size": "m", "underline": true}, "paragraph": {"wpm": 250}}`, every part optional. The attributes above win over it for the view it starts in, and what `persist` kept wins over both.
- `lang`: the language it reads in, for numbers, plurals and cutting words; without it, the nearest `lang` above it, else English.
- Methods: `open()`, `close()`, `play()`, `pause()`, `toggle()`, `reload()`. Events: `focusreaderopen`, `focusreaderclose`, `focusreaderview` (`detail.view`).

```html
<focus-reader for="article-body" lang="fr" labels='{"play": "Lire", "reading": "Lecture", "wordsPerFrame": ["{n} mot par cadre", "{n} mots par cadre"]}'></focus-reader>
```

## Astro

An integration and a component, `focus-reader/astro` and `focus-reader/astro/FocusReader.astro` (Astro 7).

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import focusReader from 'focus-reader/astro';

export default defineConfig({
  integrations: [
    focusReader({
      view: 'sequence', // the view it opens in
      sequence: { wpm: 150, words: 1, size: 'm', align: 'left' },
      flow: { wpm: 300, words: 6, size: 'm', underline: true },
      paragraph: { wpm: 250 }, // Flow, a paragraph at a time
      persist: true, // remember each reader's settings in the browser (default)
      labels: { play: 'Lire', open: 'Lire en mode focus' /* … see src/labels.ts */ },
      theme: {
        light: { paper: '#f3f2ee', ink: '#141514', muted: '#5f5e59', faint: '#a5a39c', rule: '#d3d1ca', accent: '#3b64ea' },
        dark: { paper: '#141514', ink: '#f3f2ee' /* … */ },
        fonts: { text: 'Inter, system-ui, sans-serif', label: 'ui-monospace, monospace', figure: 'ui-monospace, monospace' },
        // for a site with its own light/dark switch; without them, dark follows the system
        darkSelector: '[data-theme="dark"]',
        lightSelector: '[data-theme="light"]',
      },
    }),
  ],
});
```

```astro
---
import FocusReader from 'focus-reader/astro/FocusReader.astro';
---
<FocusReader heading={title}>
  <article><Content /></article>
</FocusReader>
```

- Around an article, it reads the article, which stays in the page as it is; or it reads the element `for` names. It adds a button that opens the reader (its text is the `open` label, or `button="…"`; `button={false}` for none, to open it from a script with `open()`).
- `inline`: the reader sits in the page, filling its box, instead of opening over it. Its size is the page's to set, and as it comes from another component, globally: `.tile :global(focus-reader) { height: 100%; }`.
- Also `heading`, `name`, `view`, `lang`, `persist`, `id` and `class`.
- Without JavaScript, the article reads as it is and the button does not show; a reader in the page shows one line saying it needs JavaScript (the `noScript` label).
- The theme only sets the `--fr-*` properties below, so a site's own CSS can still change any of them. Colours and fonts for now; loading the fonts stays with the site. A `<focus-reader>` written by hand gets the theme with `import 'virtual:focus-reader/theme.css'`.

## Style

Everything comes from custom properties on the element, with system defaults (`Canvas`, `CanvasText`, `LinkText` for the accent, `system-ui`, `ui-monospace`):

| Property | |
|---|---|
| `--fr-paper`, `--fr-ink` | background and text |
| `--fr-muted`, `--fr-faint`, `--fr-rule` | labels, minor ticks, outlines; in Flow, the words read |
| `--fr-ahead` | Flow's words ahead (default: `--fr-faint` mixed 70 % into `--fr-paper`) |
| `--fr-accent`, `--fr-accent-text` | markers and progress, and the accent as text (pivot letter, headings) |
| `--fr-on-ink` | text on the solid ink button |
| `--fr-font-text`, `--fr-font-label`, `--fr-font-figure` | the words, the labels, the figures |
| `--fr-texture`, `--fr-texture-opacity`, `--fr-texture-size` | an image laid over the panel once open (a grain; in place, the page's own covers it) |

## How it reads

- Frames hold the number of words set, and never cross the end of a sentence or a paragraph; a comma, a semicolon, a colon or a dash inside one makes it stay a beat longer.
- A longer word stays a little longer; a clause end waits one word, a sentence two, a paragraph or a heading three. The whole is scaled so the text takes exactly words / wpm minutes: the rate shown is the rate you get.
- Words per frame and size depend on each other: more words step the size down until most frames (90 %) fit the line; a larger size takes words off. A frame longer than most shrinks on its own.
- Paused, the sentence shows under the band with the frame marked, to read back.
- Keys: Space plays or pauses, ← → go a frame back or on, so every part of the text is the one being read in turn, ↑ ↓ change the speed, Escape closes; they reach it from the whole page while it is open, or once it has been used and until a press elsewhere; a page's own controls for it count as part of it inside an element marked `data-focus-reader-scope`. ← → go a frame on the progress slider too. A tap or a click on the band or the text plays or pauses, and nothing else. A scroll, or a swipe on touch, goes a frame back or on; paused, a flick or a wheel's notch glides on, slowing down (a stream of events, from a trackpad, is followed as it is, never sped up); in Flow while paused, it scrolls the text freely instead, the reading place following the line at the anchor, and Play goes on from there.
- While it plays, labels and controls fade out at once on Play, then 2 s after a move, a tap or a key, which bring them back. A screen reader hears play, pause and the settings, never each frame.
- On a phone, opening asks for full screen and a landscape lock: Android Chrome grants both, Safari on iPhone neither, and there the panel covers the window and works upright.

## Performance

- The panel moves the text and the progress by writing a transform or a width on the element itself, never an inherited custom property: a scroll or a frame restyles one element, not every word of the text.
- Idle, inline or open, it does nothing: no timer, no animation frame. Playing, it works only when a frame changes.
- To load it on demand (as the Feed's loop does, once it comes near the screen), import `focus-reader/register`: it registers the element and exports nothing, so the bundle needs no module namespace for it.

## Functions

`focus-reader/text`: `blocksFromElement`, `blocksFromText`, `parse` (with the text's language, for `Intl.Segmenter`), `frames`, `schedule`, `frameAt`, `orp`, `join`.

## Development

```sh
pnpm install
pnpm check   # types
pnpm test    # unit and browser tests
pnpm demo    # the demo page, served by Vite
pnpm build   # dist/, as npm gets it
```

The package exports its TypeScript sources while you work on it; `publishConfig` points npm at `dist/` (`pnpm build` writes it, and `pnpm pack` and `pnpm publish` run it first). `pnpm demo:build` writes the demo to `demo-dist/`, a static folder to host anywhere. Releases go through Changesets: see [RELEASING.md](RELEASING.md).

## Tests

- `pnpm test:unit`: the text functions (blocks from plain text, words, frames, timing, `frameAt`, `orp`), with Node's own test runner, in `test/text.test.ts`.
- `pnpm test:browser`: the element in a browser, with Playwright, on the test pages in `test/fixtures` (served by Vite): keys, clicks, scroll and glide, both views, the paragraph mode, the attributes, where it reads from, `persist`, the dark scheme, reduced motion, and on a phone a tap, a swipe and full screen. Extraction from a page (`blocksFromElement`) is tested there too, on a real DOM.
- `pnpm test`: both.

Locally the browser tests run in the Chrome installed on the machine, as a desktop window and as a phone, so nothing is downloaded. `FR_BROWSERS=all pnpm test:browser` adds Playwright's Firefox and WebKit, once installed with `pnpm exec playwright install firefox webkit`; CI (`CI=1`) runs all of them, with Playwright's Chromium in place of Chrome: `.github/workflows/ci.yml`, on every push and pull request.

## Licence

MIT, see [LICENSE](LICENSE).
