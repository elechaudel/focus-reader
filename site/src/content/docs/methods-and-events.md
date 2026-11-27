---
title: Methods and events
description: Open it, play it, and hear what it does, from a script.
order: 3
---

```js
import { FocusReader } from 'focus-reader/element';

const reader = document.querySelector('focus-reader'); // a FocusReader
```

## Methods

| Method | |
|---|---|
| `open()` | Opens the full-window panel: a modal dialog, the page behind it inert. On a phone it also asks for full screen and a landscape lock. |
| `close()` | Pauses, closes the panel, and gives the focus back to where it was. |
| `play()` | Starts reading from where it is; from the top once it has reached the end. |
| `pause()` | Stops there. |
| `toggle()` | Plays or pauses. |
| `reload()` | Reads the text again, keeping the place, after the page changed what `for` points to. |

## Properties

| Property | |
|---|---|
| `playing` | Whether it is reading. Read only. |
| `isOpen` | Whether the full-window panel is open. Read only. |
| `labels` | The words it shows and says. Set it to an object with the ones to change; `null` goes back to the `labels` attribute's. |

## Events

All three bubble, so one listener on the document hears every reader of the page.

| Event | |
|---|---|
| `focusreaderopen` | The full-window panel opened. |
| `focusreaderclose` | It closed. |
| `focusreaderview` | The view changed; `event.detail.view` is `sequence` or `flow`. |

```js
document.addEventListener('focusreaderview', (event) => {
  console.log(event.target.id, 'now shows', event.detail.view);
});
```

## Keys

While a reader is open, keys reach it from the whole page. A reader in the page gets them once it has been used, until a press elsewhere.

| Key | |
|---|---|
| Space | play or pause |
| ← → | a frame back or on |
| ↑ ↓ | faster or slower |
| Escape | close |

A page's own controls for a reader, its own Play button say, count as part of it when they sit with it inside an element marked `data-focus-reader-scope`: a press on them does not take the keys away from the reader.

```html
<div data-focus-reader-scope>
  <focus-reader id="reader" for="article-body"></focus-reader>
  <button onclick="document.getElementById('reader').toggle()">Play or pause</button>
</div>
```
