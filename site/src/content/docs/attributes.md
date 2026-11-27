---
title: Attributes
description: What a reader reads, how it starts, and what it remembers.
order: 2
---

Every attribute is optional. A reader with none reads its own content, in the page, in the Sequence view.

## The text

| Attribute | |
|---|---|
| `for` | The id of the element whose text it reads: an article's body, a `<template>`. Without it, a `<template>` inside the reader, or else the reader's own content. |
| `heading` | The title at the top of the panel. |
| `name` | The label before the title. Default "Focus reader"; empty, no label. |
| `lang` | The language it reads in, for numbers, plurals and cutting words. Without it, the nearest `lang` above it, else English. |

Paragraphs, headings, list items and quotes are read. Code blocks, figures, media, tables, navigation and anything with `data-focus-reader-skip` are not. Words are cut at spaces, and a run in a language written without them (Chinese, Japanese, Thai…) is cut by `Intl.Segmenter`, in the reader's language.

A reader with only plain text inside it reads that text: a blank line separates paragraphs, and a line starting with `#` is a heading.

## The view

| Attribute | Values | |
|---|---|---|
| `view` | `sequence`, `flow` | The view it starts in. Sequence, the default, shows one frame at a time on a band. Flow shows the whole text with the frame being read marked, moving up a line at a time. The attribute reflects the view shown, and changing it switches. |
| `align` | `left`, `center`, `pivot` | In Sequence, where the words line up: on a marker at the left, in the centre like subtitles, or on the recognition point of the word as Spritz does. |
| `underline` | `off` | In Flow, the words being read only in ink, without the accent's underline. A setting of the panel too. |

In Flow, the panel's Words setting goes on past six to ¶: a whole paragraph at a time, with a pace line in the margin and a pace of its own (250 wpm).

## The pace

| Attribute | Values | |
|---|---|---|
| `wpm` | 100 to 800 | Words per minute. |
| `words` | 1 to 6 | Words per frame. |
| `size` | `s`, `m`, `l`, `xl` | The size of the text. |

These three set the pace of the view the reader starts in. Each view keeps its own: Sequence starts at 150 wpm, one word, M; Flow at 300 wpm, six words, M.

## Where it sits

| Attribute | |
|---|---|
| `modal` | Hidden until opened with `open()`. Without it, the reader sits in the page, filling its box, and opens to the full window from its own button. |
| `open` | Set by the reader while its full-window panel is open, for the page's CSS to know. |

## What it remembers

| Attribute | |
|---|---|
| `persist` | Remembers the settings in this browser (`localStorage`, key `focus-reader.v4`), for both views. |
| `defaults` | Where each view starts, as JSON, for a site that sets it once for all its readers. The Astro integration writes it. |
| `labels` | The words the panel shows and says, as JSON. See [Labels and languages](../labels/). |

```html
<focus-reader
  for="article-body"
  defaults='{"view": "flow", "sequence": {"wpm": 200, "words": 1, "size": "m", "align": "left"}, "flow": {"wpm": 300, "words": 6, "size": "m", "underline": true}, "paragraph": {"wpm": 250}}'
></focus-reader>
```

Every part of `defaults` is optional. Three things can set where a reader starts, and the later one wins:

1. `defaults`, the site's;
2. `view`, `align`, `underline`, `wpm`, `words` and `size`, this reader's, for the view it starts in;
3. what `persist` kept, the person's own.
