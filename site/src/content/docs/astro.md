---
title: Astro
description: An integration that sets every reader of a site once, and a component that wraps an article.
order: 4
---

The package comes with an integration, `focus-reader/astro`, and a component, `focus-reader/astro/FocusReader.astro`, for Astro 7. This site is built with both.

## The integration

It holds what every reader of the site shares: where each view starts, the labels, the theme.

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
      labels: { play: 'Lire', open: 'Lire en mode focus' },
      theme: {
        light: { paper: '#f3f2ee', ink: '#141514', muted: '#5f5e59', faint: '#a5a39c', rule: '#d3d1ca', accent: '#3b64ea' },
        dark: { paper: '#141514', ink: '#f3f2ee' },
        fonts: { text: 'Inter, system-ui, sans-serif', label: 'ui-monospace, monospace', figure: 'ui-monospace, monospace' },
        // for a site with its own light/dark switch; without them, dark follows the system
        darkSelector: '[data-theme="dark"]',
        lightSelector: '[data-theme="light"]',
      },
    }),
  ],
});
```

Every option is optional. A theme value that is not a CSS value stops the build, with its name.

| Option | |
|---|---|
| `view` | The view a reader opens in. |
| `sequence` | `wpm`, `words`, `size` and `align` of the Sequence view. |
| `flow` | `wpm`, `words`, `size` and `underline` of the Flow view. |
| `paragraph` | `wpm` and `size` of Flow, a paragraph at a time. |
| `persist` | Remember each reader's settings in the browser. Default `true`. |
| `labels` | The words of the panel, over the English defaults. See [Labels and languages](../labels/). |
| `theme` | `light` and `dark` colours, `fonts`, and `darkSelector` and `lightSelector` for a site with its own switch. See [Theming](../theming/). |

## The component

```astro
---
import FocusReader from 'focus-reader/astro/FocusReader.astro';
---
<FocusReader heading={title}>
  <article><Content /></article>
</FocusReader>
```

Around an article, it reads the article, which stays in the page as it is. It adds a button that opens the reader.

| Prop | |
|---|---|
| `for` | The id of the element whose text it reads, when it does not wrap one. |
| `heading`, `name` | The title at the top of the panel, and the label before it. |
| `button` | The opening button's text; by default the `open` label. `button={false}` for none, to open it from a script with `open()`. |
| `inline` | The reader sits in the page, filling its box, instead of opening over it. |
| `view`, `lang`, `persist` | Over the integration's, for this reader. |
| `id`, `class` | The reader's own; by default an id of its own. |

An `inline` reader takes the size the page gives it. As it comes from another component, the page styles it globally:

```astro
<div class="tile">
  <FocusReader for="pitch" heading="In place" inline />
</div>

<style>
  .tile { height: 520px; }
  .tile :global(focus-reader) { height: 100%; min-height: 0; }
</style>
```

## Without JavaScript

The article reads as it is and the button does not show. A reader in the page shows one line saying it needs JavaScript, the `noScript` label.

## A reader written by hand

A `<focus-reader>` written by hand in an Astro page gets the integration's theme with one import, and is registered with another:

```astro
---
import 'virtual:focus-reader/theme.css';
---
<focus-reader for="article-body" modal></focus-reader>

<script>
  import 'focus-reader/register';
</script>
```
