// Every word the panel shows or says, in English by default. A page translates them with the `labels`
// attribute (JSON) or property, giving only the ones it changes. `{name}` marks a value filled in; a pair is
// [one, other], picked by the plural rules of the reader's language (its `lang`, or the page's).

export interface Labels {
  /** the label before the title, unless the `name` attribute sets one */
  name: string;
  settings: string;
  view: string;
  sequence: string;
  flow: string;
  speed: string;
  slower: string;
  faster: string;
  words: string;
  fewerWords: string;
  moreWords: string;
  size: string;
  smaller: string;
  larger: string;
  align: string;
  alignLeft: string;
  alignCenter: string;
  alignPivot: string;
  underline: string;
  /** what the Underline button does, for a screen reader */
  underlineLabel: string;
  on: string;
  off: string;
  /** the reading band and the flow, for a screen reader: what they are and their keys */
  band: string;
  flowArea: string;
  rate: string;
  /** the unit after the rate */
  wpm: string;
  read: string;
  /** the time left */
  remaining: string;
  minutes: string;
  hours: string;
  progress: string;
  /** the progress slider, and its value: {word}, {total}, {left}, {unit} */
  position: string;
  positionValue: string;
  /** the Play button: idle, playing, at the end */
  play: string;
  reading: string;
  again: string;
  /** the keys under the progress, each a key and what it does */
  keySpace: string;
  keyPlay: string;
  keyArrows: string;
  keyFrame: string;
  keyScroll: string;
  keyScrollSequence: string;
  keyScrollFlow: string;
  keyUpDown: string;
  keySpeed: string;
  keyEscape: string;
  keyClose: string;
  /** the same on a touch screen */
  touchKeys: string;
  /** the door at the top right: in place, and open */
  fullScreen: string;
  fullScreenLabel: string;
  close: string;
  closeLabel: string;
  /** under the band before it starts */
  startKeys: string;
  startTouch: string;
  /** said to a screen reader */
  playing: string;
  paused: string;
  end: string;
  wpmSaid: string;
  wordsPerFrame: [string, string];
  wordsAtATime: [string, string];
  paragraph: string;
  sizeSaid: string;
  viewSaid: string;
  viewLabel: string;
  alignSaid: string;
  alignLabel: string;
  underlineOn: string;
  underlineOff: string;
  /** the Astro component's button that opens the reader, and the line a reader in the page shows without JavaScript */
  open: string;
  noScript: string;
}

export const LABELS: Labels = {
  name: 'Focus reader',
  settings: 'Settings',
  view: 'View',
  sequence: 'Sequence',
  flow: 'Flow',
  speed: 'Speed',
  slower: 'Slower',
  faster: 'Faster',
  words: 'Words',
  fewerWords: 'Fewer words per frame',
  moreWords: 'More words per frame',
  size: 'Size',
  smaller: 'Smaller text',
  larger: 'Larger text',
  align: 'Align',
  alignLeft: 'Left',
  alignCenter: 'Centre',
  alignPivot: 'Pivot',
  underline: 'Underline',
  underlineLabel: 'Underline the words being read',
  on: 'On',
  off: 'Off',
  band: 'Reading band. Space to play or pause, left and right arrows to move by frame, up and down arrows for speed, scroll to move by frame.',
  flowArea: 'Reading flow. Space to play or pause, left and right arrows to move by frame, up and down arrows for speed.',
  rate: 'Rate',
  wpm: 'wpm',
  read: 'Read',
  remaining: 'Left',
  minutes: 'min',
  hours: 'h',
  progress: 'Progress',
  position: 'Position in the text',
  positionValue: 'Word {word} of {total}, {left} {unit} left',
  play: 'Play',
  reading: 'Reading',
  again: 'Read again',
  keySpace: 'Space',
  keyPlay: 'play',
  keyArrows: '← →',
  keyFrame: 'frame',
  keyScroll: 'Scroll',
  keyScrollSequence: 'frame',
  keyScrollFlow: 'text',
  keyUpDown: '↑ ↓',
  keySpeed: 'speed',
  keyEscape: 'Esc',
  keyClose: 'close',
  touchKeys: 'Tap to play or pause, swipe for a word',
  fullScreen: 'Full screen',
  fullScreenLabel: 'Open the reader full screen',
  close: 'Close',
  closeLabel: 'Close the reader',
  startKeys: 'Press Space or click the band to start.',
  startTouch: 'Tap the band to start.',
  playing: 'Playing at {wpm} words per minute',
  paused: 'Paused, word {word} of {total}',
  end: 'End of the text',
  wpmSaid: '{wpm} words per minute',
  wordsPerFrame: ['{n} word per frame', '{n} words per frame'],
  wordsAtATime: ['{n} word at a time', '{n} words at a time'],
  paragraph: 'A paragraph at a time',
  sizeSaid: 'Size {size}',
  viewSaid: '{view} view',
  viewLabel: 'View: {view}. Change',
  alignSaid: 'Aligned {align}',
  alignLabel: 'Alignment: {align}. Change',
  underlineOn: 'Underline on',
  underlineOff: 'Underline off',
  open: 'Focus reader',
  noScript: 'The focus reader needs JavaScript.',
};

/** `{key}` in `s` replaced by `vars[key]`. */
export function fill(s: string, vars: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * The labels a page gave, over the defaults: only known keys, each a string (or a pair of strings for the
 * plural ones); anything else is ignored.
 */
export function mergeLabels(given: unknown, base: Labels = LABELS): Labels {
  const out = { ...base };
  if (!given || typeof given !== 'object') return out;
  for (const [k, v] of Object.entries(given)) {
    if (!(k in base)) continue;
    const pair = Array.isArray(base[k as keyof Labels]);
    if (pair ? Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string') : typeof v === 'string') {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
