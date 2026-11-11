# @elchdl/focus-reader

`<focus-reader>` shows a text a few words at a time, like subtitles, at a pace you pick. It started as a Lab experiment on elchdl, The Focus Reader (`/lab/the-focus-reader/`), and is kept free of the site so it can become a package of its own: no dependency, no framework, a custom element and a few pure functions.

## Use

```html
<button onclick="document.querySelector('focus-reader').open()">Focus</button>
<focus-reader for="article-body" heading="A visual direction" modal persist></focus-reader>
<script type="module">import '@elchdl/focus-reader/element';</script>
```

- `for`: id of the element whose text it reads (an article's body, a `<template>`). Without it, a `<template>` inside the element, or else its own content. Paragraphs, headings, list items and quotes are read; code blocks, figures, media, tables and anything with `data-focus-skip` are not.
- `heading`: the title at the top. `name`: the label before it (default "Focus reader").
- `wpm` (100–800, default 200), `words` per frame (1–6, default 1), `size` (`s`, `m`, `l`, `xl`, default `m`), `align` (`left` on a marker, `center` like subtitles, `pivot` on the recognition point as Spritz does).
- `modal`: hidden until opened. Without it, the reader sits in the page, filling its box, and opens to the full window from its own button.
- `persist`: remembers the settings in this browser (`localStorage`).
- Methods: `open()`, `close()`, `play()`, `pause()`, `toggle()`, `reload()`. Events: `focusreaderopen`, `focusreaderclose`.

## Style

Everything comes from custom properties on the element, with system defaults (`Canvas`, `CanvasText`, `system-ui`):

| Property | |
|---|---|
| `--fr-paper`, `--fr-ink` | background and text |
| `--fr-muted`, `--fr-faint`, `--fr-rule` | labels, minor ticks, outlines |
| `--fr-accent`, `--fr-accent-text` | markers and progress, and the accent as text (pivot letter, headings) |
| `--fr-on-ink` | text on the solid ink button |
| `--fr-font-text`, `--fr-font-label`, `--fr-font-figure` | the words, the labels, the figures |
| `--fr-texture`, `--fr-texture-opacity`, `--fr-texture-size` | an image laid over the panel once open (a grain; in place, the page's own covers it) |

## How it reads

- Frames never cross the end of a sentence or a paragraph, and end at a comma, a semicolon, a colon or a dash.
- A longer word stays a little longer; a clause end waits one word, a sentence two, a paragraph or a heading three. The whole is scaled so the text takes exactly words / wpm minutes: the rate shown is the rate you get.
- Words per frame and size depend on each other: more words step the size down until most frames (90 %) fit the line; a larger size takes words off. A frame longer than most shrinks on its own.
- Paused, the sentence shows under the band with the frame marked, to read back.
- Keys: Space plays or pauses, ← → go a sentence back or on, ↑ ↓ change the speed, Escape closes; they reach it from the whole page while it is open, or once it has been used. A scroll on the band goes a frame back or on. On touch: the middle of the band plays or pauses, its sides go a sentence back or on, a swipe across it a frame.
- While it plays, labels and controls fade out after 2.5 s and come back on a move, a tap or a key. A screen reader hears play, pause and the settings, never each frame.
- On a phone, opening asks for full screen and a landscape lock: Android Chrome grants both, Safari on iPhone neither, and there the panel covers the window and works upright.

## Functions

`@elchdl/focus-reader/text`: `blocksFromElement`, `blocksFromText`, `parse`, `frames`, `schedule`, `frameAt`, `orp`.
