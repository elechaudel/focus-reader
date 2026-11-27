---
title: Getting started
description: Install the package, put a reader on a page, and open it.
order: 1
---

`<focus-reader>` shows a text a few words at a time, like subtitles, at a pace the reader picks, in a panel with its size and progress. It is one custom element and a few pure functions, with no dependency and no framework.

## Install

```sh
npm install focus-reader
```

Or, on a page with no build step, from a CDN:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/focus-reader/dist/src/register.js"></script>
```

## Over the page

Most often the reader opens over an article: it reads the element its `for` names, and with `modal` it stays hidden until something calls `open()`.

```html
<article id="article-body">…</article>

<button onclick="document.querySelector('focus-reader').open()">Focus</button>
<focus-reader for="article-body" heading="A visual direction" modal persist></focus-reader>

<script type="module">
  import 'focus-reader/element';
</script>
```

The article stays in the page as it is. The reader takes its paragraphs, headings, list items and quotes, and leaves out what is not prose to read in a row: code blocks, figures, media, tables, and anything marked `data-focus-reader-skip`.

## In the page

Without `modal`, the reader sits in the page and fills its box; its own button opens it to the full window. The size of the box is the page's to set.

```html
<div style="height: 480px">
  <focus-reader heading="In the page" style="height: 100%">
    <template>
      <p>A text of its own, kept in a template so the page does not show it twice.</p>
    </template>
  </focus-reader>
</div>
```

<div class="tile">
<focus-reader heading="In the page">
<template>
<p>A text of its own, kept in a template so the page does not show it twice. Press Space or click the band to start, and again to pause.</p>
<p>The arrows go a frame back or on, and so does a scroll. Up and down change the speed. The button at the top right opens the reader to the full window, and Escape closes it.</p>
</template>
</focus-reader>
</div>

## Which import

| Import | What it does |
|---|---|
| `focus-reader` | registers the element; exports its class, `LABELS` and the [text functions](../text-functions/) |
| `focus-reader/element` | registers the element and exports its class |
| `focus-reader/register` | registers the element and exports nothing, to [load it on demand](../performance/) |
| `focus-reader/text` | the text functions alone, without the element |
| `focus-reader/astro` | the [Astro integration](../astro/) |

## Browsers, and no JavaScript

It works in the browsers of [Baseline widely available](https://web.dev/baseline), and is tested in the latest Chrome, Firefox and Safari, on the desktop and on iOS.

Without JavaScript, the page reads as it is: a `modal` reader stays hidden. Its button would open nothing, so give the button `hidden` and show it from your script, as the Astro component does.

```html
<button id="focus" hidden>Focus</button>
<script type="module">
  import 'focus-reader/element';
  const button = document.getElementById('focus');
  button.hidden = false;
  button.addEventListener('click', () => document.querySelector('focus-reader').open());
</script>
```

On a phone, opening asks for full screen and a landscape lock: Android Chrome grants both, Safari on iPhone neither, and there the panel covers the window and works upright.
