---
title: Labels and languages
description: Every word the panel shows or says can be changed, and it reads in the language of the page.
order: 6
---

## Labels

The panel's words are in English by default. The `labels` attribute changes them, as JSON, and only the ones given change:

```html
<focus-reader
  for="article-body"
  lang="fr"
  labels='{"play": "Lire", "reading": "Lecture", "wordsPerFrame": ["{n} mot par cadre", "{n} mots par cadre"]}'
></focus-reader>
```

The `labels` property does the same from a script, over the attribute; `null` goes back to the attribute's.

```js
reader.labels = { play: 'Lire', reading: 'Lecture' };
```

Two things to know about the values:

- a mark like `{wpm}` or `{n}` is filled in with a value;
- a pair is `[one, other]`, picked by the plural rules of the reader's language.

Labels include what a screen reader hears: the name of each control, and what is said on play, pause and each change of setting. A reader translated only where it shows is half translated.

<div class="tile">
<focus-reader view="flow" lang="fr" heading="Un texte en français" labels='{"name": "Lecteur", "view": "Vue", "speed": "Vitesse", "words": "Mots", "size": "Taille", "underline": "Souligné", "on": "Oui", "off": "Non", "rate": "Débit", "wpm": "mots/min", "read": "Lus", "remaining": "Reste", "progress": "Progression", "play": "Lire", "reading": "Lecture", "again": "Relire", "fullScreen": "Plein écran", "close": "Fermer", "touchKeys": "Touchez pour lire ou mettre en pause, glissez pour un mot", "wordsAtATime": ["{n} mot à la fois", "{n} mots à la fois"]}'>
<template>
<h2>Lire autrement</h2>
<p>Un texte peut se lire de plusieurs façons. Sur le papier, l'œil suit une ligne, saute à la suivante, revient en arrière quand il a perdu le fil, et personne ne le remarque.</p>
<p>Ici, le texte avance seul, au rythme choisi. Les mots déjà lus s'estompent, ceux qui restent attendent, et la ligne en cours reste toujours au même endroit.</p>
</template>
</focus-reader>
</div>

With Astro, the integration's `labels` option sets them for the whole site. Two of them are the component's own: `open`, the text of its button, and `noScript`, the line a reader in the page shows without JavaScript.

## Languages

A reader reads in the language of its `lang`, or of the nearest `lang` above it, else English. The language decides three things:

- how numbers are written (the rate, the words read);
- which of a pair of labels is used, by its plural rules;
- how a text written without spaces is cut into words.

Words are cut at spaces. A run in a script written without them (Chinese, Japanese, Thai, Lao, Khmer, Burmese) is cut by `Intl.Segmenter` for that language, its punctuation kept with the word before it and an opening bracket or quote with the word after.

```html
<focus-reader lang="ja">
  <template>
    <p>吾輩は猫である。名前はまだ無い。</p>
  </template>
</focus-reader>
```
