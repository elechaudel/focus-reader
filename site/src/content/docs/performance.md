---
title: Performance
description: What it costs a page to have a reader on it, idle and playing.
order: 9
---

## Idle, it does nothing

In the page or open, a reader that is not playing runs no timer and no animation frame. Playing, it works only when a frame changes.

## A frame restyles one element

The panel moves the text and the progress by writing a transform or a width on the element itself, never an inherited custom property. A scroll or a frame restyles one element, not every word of the text.

## Loading it on demand

`focus-reader/register` registers the element and exports nothing, so a bundle needs no module namespace for it. Import it when the reader is about to be needed: on the click that opens it, or once it comes near the screen.

```js
const button = document.getElementById('focus');

button.addEventListener('click', async () => {
  await import('focus-reader/register');
  document.querySelector('focus-reader').open();
});
```

Until then, `<focus-reader>` is an unknown element, and one with a text of its own inside (not in a `<template>`) would show it. Hide it until it is registered:

```css
focus-reader:not(:defined) {
  display: none;
}
```

## Nothing else to load

The package has no dependency. Its fonts are the page's, named through the `--fr-font-*` properties and never loaded by the reader.
