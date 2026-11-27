---
title: Text functions
description: "The functions the element is built on: blocks, words, frames and their timing, without a DOM."
order: 8
---

`focus-reader/text` exports the functions that turn a text into timed frames. They are pure, and only `blocksFromElement` reads a DOM, so the rest runs anywhere: a server, a worker, a test.

```js
import { blocksFromText, parse, frames, schedule } from 'focus-reader/text';

const doc = parse(blocksFromText('A first paragraph.\n\nA second one, a little longer.'), 'en');
const fs = frames(doc, 2); // frames of two words
const { ms, after } = schedule(fs, doc.words.length, 300); // at 300 wpm

fs.forEach((frame, i) => console.log(frame.text, Math.round(ms[i]), 'ms'));
```

## From a text to blocks

| Function | |
|---|---|
| `blocksFromElement(root)` | The blocks of a part of a page (an article's body, a `<template>`'s content): paragraphs, headings, list items and quotes, in order. Skips code blocks, figures and media, tables, navigation, anything hidden, and anything marked `data-focus-reader-skip`. |
| `blocksFromText(text)` | The blocks of plain text: paragraphs are separated by a blank line, and a line starting with `#` is a heading. |

A block is `{ kind, text }`, its kind one of `p`, `heading`, `quote` and `item`.

## From blocks to frames

| Function | |
|---|---|
| `parse(blocks, locale?)` | A `Doc`: the blocks and their words, each word with its block and the start of its sentence. `locale` is the text's language, for `Intl.Segmenter`. |
| `frames(doc, perFrame, byBlock?)` | Frames of `perFrame` words, never crossing the end of a sentence or of a block. With `byBlock`, a frame is a whole block. |
| `schedule(frames, words, wpm)` | `{ ms, after }`: how long each frame stays, in milliseconds, and the time left after each frame's start. The whole takes words / wpm minutes. |

A frame is `{ start, end, text, heading, weight }`: its first word, its last (exclusive), its text, whether it is a heading, and how long it stays in word units before scaling.

## Helpers

| Function | |
|---|---|
| `frameAt(frames, word)` | The index of the frame that holds a word: where to go on from after the frames changed. |
| `join(words, a, b)` | Words `a` to `b` (exclusive) as text, with a space between two words only where the text had one. |
| `orp(word)` | The optimal recognition point of a word, as Spritz places it: the index of the letter the eye should land on, a little left of the middle. |
| `PAUSES` | The pause after a frame, in word units: `{ clause: 1, sentence: 2, block: 3, heading: 3 }`. |

The types `Block`, `BlockKind`, `Word`, `Doc` and `Frame` are exported with them.
