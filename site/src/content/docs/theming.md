---
title: Theming
description: Colours, fonts and a texture, from custom properties set by the page.
order: 5
---

Everything the panel draws with comes from custom properties on the element. Their defaults are the system's own (`Canvas`, `CanvasText`, `LinkText` for the accent, `system-ui`, `ui-monospace`), so an unstyled reader already follows light and dark.

## The properties

| Property | |
|---|---|
| `--fr-paper`, `--fr-ink` | background and text |
| `--fr-muted`, `--fr-faint`, `--fr-rule` | labels, minor ticks, outlines; in Flow, the words read |
| `--fr-ahead` | Flow's words ahead (default: `--fr-faint` mixed 70 % into `--fr-paper`) |
| `--fr-accent`, `--fr-accent-text` | markers and progress, and the accent as text (pivot letter, headings) |
| `--fr-on-ink` | text on the solid ink button |
| `--fr-font-text`, `--fr-font-label`, `--fr-font-figure` | the words, the labels, the figures |
| `--fr-texture`, `--fr-texture-opacity`, `--fr-texture-size` | an image laid over the panel once open (a grain; in place, the page's own covers it) |

Set them on the element, or on anything around it:

```css
.themed focus-reader {
  --fr-paper: light-dark(#f6f5f1, #161716);
  --fr-ink: light-dark(#161716, #f1f0ec);
  --fr-accent: #d4380d;
  --fr-accent-text: light-dark(#b02e0a, #ff7a50);
  --fr-font-text: Georgia, serif;
}
```

<div class="tile">
<focus-reader heading="A text in Georgia" words="2" style="--fr-accent: #d4380d; --fr-accent-text: light-dark(#b02e0a, #ff7a50); --fr-font-text: Georgia, serif;">
<template>
<p>Everything the panel shows comes from a handful of custom properties: the paper, the ink, the accent, and three typefaces, for the words, the labels and the figures. Set them on the element, or on anything around it.</p>
<p>This one keeps the site's paper and ink, and takes a vermilion accent and a serif of its own.</p>
</template>
</focus-reader>
</div>

Loading the fonts stays with the page: the reader only names them.

## Two shades of the accent

`--fr-accent` fills the markers and the progress. `--fr-accent-text` is the same accent where it is text: the pivot letter, a heading in Flow. A light accent that works as a fill is often too pale to read as text, so the two can differ; without the second, the first does for both.

## With Astro

The integration's `theme` writes the same properties, for every reader of the site:

```js
focusReader({
  theme: {
    light: { paper: '#f3f2ee', ink: '#141514', accent: '#3b64ea' },
    dark: { paper: '#141514', ink: '#f3f2ee' },
    fonts: { text: 'Inter, system-ui, sans-serif' },
    darkSelector: '[data-theme="dark"]',
    lightSelector: '[data-theme="light"]',
  },
});
```

| Key | Property |
|---|---|
| `paper`, `ink`, `muted`, `faint`, `rule`, `ahead` | `--fr-paper` … `--fr-ahead` |
| `accent`, `accentText` | `--fr-accent`, `--fr-accent-text` |
| `onInk` | `--fr-on-ink` |
| `fonts.text`, `fonts.label`, `fonts.figure` | `--fr-font-text`, `--fr-font-label`, `--fr-font-figure` |

The `dark` colours apply under `prefers-color-scheme: dark`. A site with its own light/dark switch names where it is dark and where it is light whatever the system says, with `darkSelector` and `lightSelector`.

A value can be any CSS colour, a custom property of the site's included: this site's theme is `paper: 'var(--color-paper)'` and so on, and turns with the page.

The theme only sets the `--fr-*` properties, so a site's own CSS can still change any of them, for one reader or for all. It covers colours and fonts for now; the texture is set in CSS.
