// <focus-reader>: a text read a few words at a time, like subtitles, at a chosen pace.
//
// Two views of the same reading. Sequence shows one frame at a time on a band between two rulers, as an e-ink
// reader would. Flow shows the whole text, as Spotify shows lyrics: the words ahead faint, the words read a step
// darker, the frame being read in ink and underlined, the text moving up a line at a time so the line being read
// stays at the same height. Both run on the same frames, timing, settings and controls.
//
// It reads its text from the page (the element `for` names, else a <template> inside it, else its own content)
// and shows it in a panel: the title on top, then the settings (speed, words per frame, size, alignment), the
// reading band between two rulers, and at the bottom what has been read, what is left and how long it takes at
// this pace. While it plays, the labels and controls fade out after a moment and come back on a move, a tap or
// a key. It sits in the page where it is (inline) and opens to a full-window panel (`open()`), a modal dialog:
// the page behind is inert, Escape closes it. On a phone it also asks for full screen and a landscape lock,
// which Android Chrome grants and Safari on iPhone does not: there the panel covers the window and works
// upright too.
//
// No dependency and no framework: colours, fonts and the texture come from CSS custom properties (see STYLE).

import { blocksFromElement, blocksFromText, frameAt, frames, orp, parse, schedule, type Doc, type Frame } from './text';

export type Align = 'left' | 'center' | 'pivot';
export type Size = 's' | 'm' | 'l' | 'xl';
export type View = 'sequence' | 'flow';
/** what each view keeps of its own: Flow reads more words at a time, and faster */
type Pace = { wpm: number; words: number; size: Size };
const PACES: Record<View, Pace> = { sequence: { wpm: 150, words: 1, size: 'm' }, flow: { wpm: 300, words: 6, size: 'm' } };

const VIEWS: View[] = ['sequence', 'flow'];
const VIEW_LABEL: Record<View, string> = { sequence: 'Sequence', flow: 'Flow' };
/** Flow's text size, in px: a base plus a share of the panel's width (it wraps, so nothing has to fit a line) */
const FLOW_SIZE: Record<Size, [number, number]> = { s: [16, 0.012], m: [18, 0.018], l: [20, 0.026], xl: [22, 0.036] };
/** where the line being read rests in Flow, as a share of the window's height */
const FLOW_ANCHOR = 0.38;

const SIZES: Size[] = ['s', 'm', 'l', 'xl'];
/** text size as a share of the panel (its width, at least 560 px, or 1.6 × its height if that is smaller) */
const SIZE_FACTOR: Record<Size, number> = { s: 0.04, m: 0.055, l: 0.075, xl: 0.1 };
const SIZE_MAX = 160;
const ALIGNS: Align[] = ['left', 'center', 'pivot'];
const ALIGN_LABEL: Record<Align, string> = { left: 'Left', center: 'Centre', pivot: 'Pivot' };
/** where the eye rests on the band, as a share of its width */
const MARKER: Record<Align, number> = { left: 0.12, center: 0.5, pivot: 0.35 };
const WPM_MIN = 100;
const WPM_MAX = 800;
const WPM_STEP = 25;
const WORDS_MAX = 6;
/** how long the labels stay after the last move while it plays, ms */
const QUIET_AFTER = 2000;
/** …and right after Play, at once: the fade (0.35 s) is the only delay */
const QUIET_AFTER_PLAY = 0;
/** settings kept in this browser; the version changes when the defaults do, so a new default is seen */
const STORE = 'focus-reader.v4';
/** how far a scroll or a swipe goes for one frame, px */
const SCROLL_STEP = 40;
const SWIPE_STEP = 28;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = () => matchMedia('(pointer: coarse)').matches;
const fmt = new Intl.NumberFormat('en-GB');

const STYLE = `
:host {
  /* everything it draws with, to set from the page */
  --fr-paper: Canvas;
  --fr-ink: CanvasText;
  --fr-muted: color-mix(in srgb, CanvasText 62%, Canvas);
  --fr-faint: color-mix(in srgb, CanvasText 38%, Canvas);
  --fr-rule: color-mix(in srgb, CanvasText 22%, Canvas);
  /* Flow's words ahead: fainter than faint, so the words read (muted) stand apart in both themes */
  --fr-ahead: color-mix(in srgb, var(--fr-faint) 70%, var(--fr-paper));
  --fr-accent: #3b64ea;
  --fr-accent-text: var(--fr-accent);
  --fr-on-ink: var(--fr-paper);
  --fr-font-text: system-ui, sans-serif;
  --fr-font-label: ui-monospace, monospace;
  --fr-font-figure: var(--fr-font-text);
  --fr-texture: none;
  --fr-texture-opacity: 0.3;
  --fr-texture-size: 240px;
  --fr-pad: clamp(16px, 3cqmin, 40px);
  color-scheme: light dark;
  display: block;
  position: relative;
  min-height: 320px;
}
:host([modal]:not([open])) { display: none; }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; letter-spacing: inherit; text-transform: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

dialog {
  position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none;
  margin: 0; padding: 0; border: 0; background: var(--fr-paper); color: var(--fr-ink); overflow: hidden;
}
dialog::backdrop { background: var(--fr-paper); }
.slot { position: absolute; inset: 0; }

.fr {
  container-type: size;
  position: relative; isolation: isolate;
  width: 100%; height: 100%;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto;
  background: var(--fr-paper); color: var(--fr-ink);
  font-family: var(--fr-font-label);
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
}
dialog .fr {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
/* the texture once open: in place, the page's own covers it */
dialog .fr::after {
  content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none;
  background-image: var(--fr-texture); background-size: var(--fr-texture-size); opacity: var(--fr-texture-opacity);
}
.label {
  font-family: var(--fr-font-label); font-size: 11px; line-height: 1.3; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--fr-muted);
}
.fade { transition: opacity 0.35s ease; }
.quiet .fade { opacity: 0; pointer-events: none; }
.quiet { cursor: none; }

/* top: the name and the title, then the settings */
.top { padding: var(--fr-pad) var(--fr-pad) 0; display: grid; gap: 10px; }
.bar { display: flex; align-items: center; gap: 16px; min-width: 0; }
.name { display: flex; align-items: center; gap: 8px; color: var(--fr-ink); flex: none; }
.name::before { content: ''; width: 8px; height: 8px; background: var(--fr-accent); }
.title { flex: 1; min-width: 0; text-align: right; color: var(--fr-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.door { flex: none; padding: 6px 10px; border: 1px solid var(--fr-ink); color: var(--fr-ink); }
.door:hover, .step:hover, .play:hover, .align:hover { color: var(--fr-accent-text); }
.rule { height: 1px; background: var(--fr-ink); }
.settings { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.setting { display: flex; align-items: center; gap: 6px; }
.setting + .setting::before { content: '/'; color: var(--fr-faint); margin-right: 8px; }
.step {
  width: 24px; height: 24px; border: 1px solid var(--fr-rule); color: var(--fr-ink);
  display: inline-grid; place-items: center; font-size: 13px; line-height: 1;
}
.step:disabled { color: var(--fr-faint); cursor: default; }
.value { color: var(--fr-ink); min-width: 4ch; text-align: center; }
.align { color: var(--fr-ink); padding: 4px 0; text-decoration: underline; text-decoration-color: var(--fr-rule); text-underline-offset: 4px; }

/* the band: two rulers, the marker where the eye rests, the words between them */
/* the band sits at the same height whatever shows under it: a row of its own between two shares of the room left,
   the one under it larger, and what shows under it never takes more than its row */
.middle {
  position: relative; display: grid; grid-template-rows: minmax(0, 1fr) auto minmax(0, 1.4fr);
  padding: 0 var(--fr-pad); min-height: 0;
}
.band { grid-row: 2; position: relative; outline: none; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.below { grid-row: 3; min-height: 0; overflow: hidden; display: grid; align-content: start; gap: 10px; padding-top: 14px; }
/* open, or once used on the page, a drag on the band goes back or on instead of scrolling the page */
dialog .band, .engaged .band, dialog .flow, .engaged .flow { touch-action: none; }
/* open on a phone: nothing in the panel scrolls, so Safari never brings its bars back */
dialog, dialog .fr { overscroll-behavior: none; touch-action: none; }
dialog button, dialog .seek { touch-action: manipulation; }
.band:focus-visible .stage { outline: 1px dotted var(--fr-ink); outline-offset: -1px; }
.playing .band:focus-visible .stage { outline: none; }
.ruler {
  position: relative; height: 12px;
  background:
    linear-gradient(var(--fr-ink), var(--fr-ink)) 0 var(--y) / 100% 1px no-repeat border-box,
    repeating-linear-gradient(90deg, var(--fr-ink) 0 1px, transparent 1px 80px) 0 var(--y) / calc(100% - 6px) 9px no-repeat border-box,
    repeating-linear-gradient(90deg, var(--fr-faint) 0 1px, transparent 1px 16px) 0 var(--y) / calc(100% - 6px) 5px no-repeat border-box;
  /* the end caps; the ticks start under the left one and stop short of the right one, so no two lines touch */
  border-left: 1px solid var(--fr-ink); border-right: 1px solid var(--fr-ink);
}
.ruler.up { --y: 100%; }
.ruler.down { --y: 0; }
.mark { position: absolute; left: var(--marker); width: 1px; height: 100%; background: var(--fr-ink); top: 0; }
.mark::after { content: ''; position: absolute; left: -4px; width: 9px; height: 9px; background: var(--fr-accent); }
.ruler.up .mark::after { top: -12px; }
.ruler.down .mark::after { bottom: -12px; }
.stage { position: relative; height: calc(var(--size) * 1.7); overflow: hidden; }
.chunk, .ghost {
  position: absolute; left: 0; top: 50%; white-space: nowrap;
  font-family: var(--fr-font-text); font-size: var(--fs, var(--size)); line-height: 1; font-weight: 450;
  transform: translate(var(--x, 0px), -50%);
  color: var(--fr-ink);
}
.chunk.heading { color: var(--fr-accent-text); }
.pivot { color: var(--fr-accent-text); }
.ghost { color: var(--fr-faint); opacity: 0; }
.ghost.on { animation: ghost 0.18s ease-out forwards; }
@keyframes ghost { from { opacity: 0.4; } to { opacity: 0; } }

.context {
  margin: 0; max-width: 46rem;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden;
  font-family: var(--fr-font-text); font-size: 14px; line-height: 1.45; color: var(--fr-muted);
  justify-self: start; margin-left: calc(var(--marker-x, 0px));
}
.context mark { background: none; color: var(--fr-ink); text-decoration: underline; text-decoration-color: var(--fr-accent); text-underline-offset: 3px; text-decoration-thickness: 2px; }
.playing .context { visibility: hidden; }

/* bottom: rate, read, left; progress; the state and the keys */
.bottom { padding: 0 var(--fr-pad) var(--fr-pad); display: grid; gap: 10px; }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.stat { display: grid; gap: 2px; }
.figure { font-family: var(--fr-font-figure); font-size: 30px; line-height: 1; color: var(--fr-ink); white-space: nowrap; }
.unit { font-family: var(--fr-font-label); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fr-muted); margin-left: 4px; }
.progress-head { display: flex; justify-content: space-between; }
.progress { position: relative; height: 12px; border: 1px solid var(--fr-ink); }
.fill {
  position: absolute; left: 2px; top: 2px; bottom: 2px; width: calc((100% - 4px) * var(--p, 0));
  background: repeating-linear-gradient(90deg, var(--fr-accent) 0 6px, transparent 6px 8px);
}
.seek { position: absolute; inset: -8px 0; width: 100%; height: calc(100% + 16px); margin: 0; opacity: 0; cursor: pointer; }
.seek:focus-visible + .fill { outline: 1px solid var(--fr-accent-text); outline-offset: 4px; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.play {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px;
  border: 1px solid var(--fr-ink); color: var(--fr-ink);
}
.play::before { content: ''; width: 7px; height: 7px; border: 1px solid currentColor; }
.playing .play { background: var(--fr-ink); color: var(--fr-on-ink); }
.playing .play::before { background: var(--fr-accent); border-color: var(--fr-accent); }
.playing .play:hover { color: var(--fr-on-ink); }
.keys { color: var(--fr-muted); }
.keys b { font-weight: inherit; color: var(--fr-ink); }
.touch-keys { display: none; }
@media (pointer: coarse) { .desk-keys { display: none; } .touch-keys { display: inline; } }

/* small panels: fewer words around the band */
@container (max-width: 560px) {
  .figure { font-size: 22px; }
  .stats { gap: 8px; }
  .keys { display: none; }
  .settings { gap: 6px 10px; }
  .setting + .setting::before { margin-right: 4px; }
}
@container (max-height: 420px) {
  .top { gap: 6px; }
  .bottom { gap: 6px; }
  .figure { font-size: 20px; }
  .context { -webkit-line-clamp: 2; }
  .below { padding-top: 8px; }
}
/* Flow: the whole text between the rulers, moving up a line at a time */
.flow { display: none; grid-row: 1 / -1; min-height: 0; outline: none; touch-action: manipulation; user-select: none; -webkit-user-select: none; padding: 16px 0; }
[data-view='flow'] .band, [data-view='flow'] .below, [data-view='flow'] .align-setting { display: none; }
/* Underline is Flow's own setting */
.fr:not([data-view='flow']) .underline-setting { display: none; }
.no-underline .text .under { display: none; }
[data-view='flow'] .flow { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
.flow:focus-visible .window { outline: 1px dotted var(--fr-ink); outline-offset: -1px; }
.playing .flow:focus-visible .window { outline: none; }
/* on a touch screen the reading area takes the focus when it opens, not from a keyboard: no ring */
@media (pointer: coarse) {
  .band:focus-visible .stage, .flow:focus-visible .window { outline: none; }
}
.window { position: relative; overflow: hidden; }
.window .mark { left: var(--marker); top: calc(var(--anchor) - 4px); width: 9px; height: 9px; margin-left: -28px; background: var(--fr-accent); }
.window .mark::after { display: none; }
.text {
  position: absolute; left: var(--marker); right: 8px; top: 0; max-width: 24em;
  font-family: var(--fr-font-text); font-weight: 600; font-size: var(--flow-size); line-height: 1.22;
  transform: translateY(var(--y, 0px)); transition: transform 0.35s cubic-bezier(0.65, 0, 0.35, 1);
}
.text.instant { transition: none; }
.text p { margin: 0 0 0.75em; }
.text .w { color: var(--fr-ahead); transition: color 0.15s ease; }
.text .w.read { color: var(--fr-muted); }
.text .w.now { color: var(--fr-ink); }
/* the frame's underline: one bar per line, from its first word to its last, spaces included */
.text .under { position: absolute; height: 0.1em; background: var(--fr-accent); pointer-events: none; }
.text .h .w.read, .text .h .w.now { color: var(--fr-accent-text); }

@media (prefers-reduced-motion: reduce) {
  .text, .text .w { transition: none; }
  .fade { transition: none; }
  .ghost.on { animation: none; }
}
`;

const HTML = `
<div class="slot"><div class="fr" part="panel">
  <div class="top">
    <div class="bar fade">
      <span class="label name" data-name></span>
      <span class="label title" data-title></span>
      <button type="button" class="label door" data-door></button>
    </div>
    <div class="rule fade"></div>
    <div class="settings label fade" role="group" aria-label="Settings">
      <span class="setting"><span>View</span>
        <button type="button" class="align" data-act="view"></button></span>
      <span class="setting"><span id="l-wpm">Speed</span>
        <button type="button" class="step" data-act="wpm-" aria-label="Slower">−</button>
        <span class="value" data-wpm aria-labelledby="l-wpm"></span>
        <button type="button" class="step" data-act="wpm+" aria-label="Faster">+</button></span>
      <span class="setting"><span>Words</span>
        <button type="button" class="step" data-act="words-" aria-label="Fewer words per frame">−</button>
        <span class="value" data-words></span>
        <button type="button" class="step" data-act="words+" aria-label="More words per frame">+</button></span>
      <span class="setting"><span>Size</span>
        <button type="button" class="step" data-act="size-" aria-label="Smaller text">−</button>
        <span class="value" data-size></span>
        <button type="button" class="step" data-act="size+" aria-label="Larger text">+</button></span>
      <span class="setting align-setting"><span>Align</span>
        <button type="button" class="align" data-act="align"></button></span>
      <span class="setting underline-setting"><span>Underline</span>
        <button type="button" class="align" data-act="underline"></button></span>
    </div>
  </div>
  <div class="middle">
    <div class="band" data-band tabindex="0" role="group" aria-roledescription="reader"
      aria-label="Reading band. Space to play or pause, left and right arrows to move by sentence, up and down arrows for speed, scroll to move by frame.">
      <div class="ruler up" aria-hidden="true"><span class="mark"></span></div>
      <div class="stage" aria-hidden="true"><span class="ghost" data-ghost></span><span class="chunk" data-chunk></span></div>
      <div class="ruler down" aria-hidden="true"><span class="mark"></span></div>
    </div>
    <div class="below">
      <p class="context" data-context></p>
    </div>
    <div class="flow" data-flow tabindex="0" role="group" aria-roledescription="reader"
      aria-label="Reading flow. Space to play or pause, left and right arrows to move by sentence, up and down arrows for speed.">
      <div class="ruler up" aria-hidden="true"></div>
      <div class="window" aria-hidden="true"><span class="mark"></span><div class="text" data-text></div></div>
      <div class="ruler down" aria-hidden="true"></div>
    </div>
  </div>
  <div class="bottom">
    <div class="stats">
      <div class="stat"><span class="label fade">Rate</span><span class="figure"><span data-rate></span><span class="unit">wpm</span></span></div>
      <div class="stat"><span class="label fade">Read</span><span class="figure"><span data-read></span><span class="unit" data-total></span></span></div>
      <div class="stat"><span class="label fade">Left</span><span class="figure"><span data-left></span><span class="unit" data-left-unit></span></span></div>
    </div>
    <div class="progress-head label fade"><span>Progress</span><span data-pct></span></div>
    <div class="progress"><input class="seek" type="range" min="0" step="1" data-seek aria-label="Position in the text" /><span class="fill"></span></div>
    <div class="foot fade">
      <button type="button" class="label play" data-act="play" aria-pressed="false"><span data-state>Play</span></button>
      <span class="label keys"><span class="desk-keys"><b>Space</b> play · <b>← →</b> sentence · <b>Scroll</b> word · <b>↑ ↓</b> speed · <b>Esc</b> close</span><span class="touch-keys">Tap to play or pause, swipe for a word</span></span>
    </div>
  </div>
  <p class="vh" aria-live="polite" data-live></p>
</div></div>
<dialog data-dialog></dialog>
`;

interface Settings {
  wpm: number;
  words: number;
  size: Size;
  align: Align;
  view: View;
  /** Flow: the frame being read underlined, or only in ink */
  underline: boolean;
}

/**
 * `<focus-reader heading="A title" for="article-body" wpm="300" words="2" size="m" align="left">`
 * - `for`: id of the element whose text it reads; without it, a <template> inside it, else its own content.
 * - `heading`: the title shown at the top. `name`: the label before it (default "Focus reader").
 * - `wpm`, `words` (1–6), `size` (s, m, l, xl), `align` (left, center, pivot): where it starts.
 * - `modal`: shown only once opened, for a page that opens it from a button of its own.
 * - `persist`: remember the settings in this browser.
 * - `open` reflects whether the full-window panel is open. Methods: open(), close(), play(), pause(), toggle().
 * Events: `focusreaderopen`, `focusreaderclose`.
 */
export class FocusReader extends HTMLElement {
  static observedAttributes = ['heading', 'name', 'for', 'view'];

  #root: ShadowRoot;
  #q = <T extends Element = HTMLElement>(s: string) => this.#root.querySelector<T>(s)!;
  #fr: HTMLElement;
  #slot: HTMLElement;
  #dialog: HTMLDialogElement;
  #band: HTMLElement;
  #flow: HTMLElement;
  #text: HTMLElement;
  /** Flow's words, one span each, built when Flow first shows a text */
  #wordEls: HTMLElement[] = [];
  /** Flow's state on screen: words marked read, the frame marked now, the line it rests on */
  #flowRead = 0;
  #flowNow: [number, number] = [0, 0];
  #flowTop = -1;
  /** Flow: where the text stands (y), the line being read's own place, and how far a free scroll moved it from there */
  #flowY = 0;
  #flowBase = 0;
  #free = 0;
  #flowFrame = -1;
  /** a touch scroll's glide, once the finger is up */
  #glide = 0;
  #stage: HTMLElement;
  #chunk: HTMLElement;
  #ghost: HTMLElement;
  #context: HTMLElement;
  #middle: HTMLElement;
  #seek: HTMLInputElement;
  #live: HTMLElement;

  #doc: Doc = { blocks: [], words: [] };
  #frames: Frame[] = [];
  #ms: number[] = [];
  #after: number[] = [];
  #i = 0;
  #s: Settings = { ...PACES.sequence, align: 'left', view: 'sequence', underline: true };
  /** each view's own pace, the one shown included (kept in step by #set) */
  #paces: Record<View, Pace> = { sequence: { ...PACES.sequence }, flow: { ...PACES.flow } };
  /** the size shown: the one chosen, or smaller if the words per frame need it */
  #effSize: Size = 'm';
  /** text size in px for the size shown */
  #px = 32;
  /** 90th percentile width of a frame at 100 px, per words per frame and font */
  #widths = new Map<string, number>();
  #playing = false;
  /** it has played since the text was loaded */
  #started = false;
  #done = false;
  #timer = 0;
  #quietTimer = 0;
  #lastFocus: Element | null = null;
  /** used last on the page: keys and scrolls go to it */
  #engaged = false;
  /** scroll not yet turned into frames, px */
  #wheel = 0;
  /** a touch drag on the band */
  #drag: { x: number; y: number; done: number; moved: boolean; t: number; v: number; ly: number } | null = null;
  #fullscreen = false;
  #ro?: ResizeObserver;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${STYLE}</style>${HTML}`;
    this.#fr = this.#q('.fr');
    this.#slot = this.#q('.slot');
    this.#dialog = this.#q<HTMLDialogElement>('[data-dialog]');
    this.#band = this.#q('[data-band]');
    this.#flow = this.#q('[data-flow]');
    this.#text = this.#q('[data-text]');
    this.#stage = this.#q('.stage');
    this.#chunk = this.#q('[data-chunk]');
    this.#ghost = this.#q('[data-ghost]');
    this.#context = this.#q('[data-context]');
    this.#middle = this.#q('.middle');
    this.#seek = this.#q<HTMLInputElement>('[data-seek]');
    this.#live = this.#q('[data-live]');
  }

  connectedCallback() {
    const a = (n: string) => this.getAttribute(n);
    const s = this.#s;
    // wpm, words and size set the pace of the view it starts in; the other keeps its own
    if (VIEWS.includes(a('view') as View)) s.view = a('view') as View;
    if (ALIGNS.includes(a('align') as Align)) s.align = a('align') as Align;
    if (a('underline') === 'off') s.underline = false;
    const pace = this.#paces[s.view];
    pace.wpm = clampWpm(Number(a('wpm')) || pace.wpm);
    pace.words = clampWords(Number(a('words')) || pace.words);
    if (SIZES.includes(a('size') as Size)) pace.size = a('size') as Size;
    if (this.hasAttribute('persist')) this.#restore();
    Object.assign(s, this.#paces[s.view]);
    // the view reads back as an attribute, for the page to show which one is on
    if (this.getAttribute('view') !== s.view) this.setAttribute('view', s.view);

    this.#labels();
    this.#load();
    this.#wire();
    this.#ro = new ResizeObserver(() => this.#layout());
    this.#ro.observe(this.#fr);
    document.fonts?.ready.then(() => {
      this.#widths.clear();
      this.#layout();
    });
    document.addEventListener('keydown', this.#onKey);
    document.addEventListener('pointerdown', this.#onPointerDown, true);
    this.#layout();
  }

  disconnectedCallback() {
    this.#stop();
    clearTimeout(this.#quietTimer);
    this.#ro?.disconnect();
    document.removeEventListener('keydown', this.#onKey);
    document.removeEventListener('pointerdown', this.#onPointerDown, true);
    if (this.#dialog.open) this.close();
  }

  attributeChangedCallback(name: string) {
    if (!this.isConnected) return;
    if (name === 'view') {
      const v = this.getAttribute('view') as View;
      if (VIEWS.includes(v) && v !== this.#s.view) this.#set({ view: v }, `${VIEW_LABEL[v]} view`);
      return;
    }
    if (name === 'for') {
      this.#load();
      this.#layout();
    } else this.#labels();
  }

  // ——— public API

  get playing() {
    return this.#playing;
  }
  get isOpen() {
    return this.#dialog.open;
  }

  /** Reads the text again (after the page changed what `for` points to). */
  reload() {
    this.#load(true);
    this.#layout();
  }

  open() {
    if (this.#dialog.open) return;
    this.#lastFocus = deepActive();
    this.setAttribute('open', '');
    this.#dialog.setAttribute('aria-label', this.#title() || 'Focus reader');
    this.#dialog.append(this.#fr);
    this.#dialog.showModal();
    document.documentElement.style.setProperty('overflow', 'hidden');
    // On a phone: full screen, then landscape. Android Chrome grants both after a tap; Safari on iPhone has
    // neither for a page (its full screen is for video only), so the panel just covers the window there.
    // The panel itself goes full screen (a <dialog> cannot), so it stays above the dialog in the top layer.
    if (coarse() && document.fullscreenEnabled && this.#fr.requestFullscreen && !document.fullscreenElement) {
      this.#fr
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
          this.#fullscreen = true;
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          return o?.lock?.('landscape');
        })
        .catch(() => {});
    }
    this.#engage(true);
    this.#labels();
    this.#layout();
    this.#target().focus({ focusVisible: false } as FocusOptions);
    this.#wake();
    this.dispatchEvent(new CustomEvent('focusreaderopen', { bubbles: true }));
  }

  close() {
    if (!this.#dialog.open) return;
    this.pause();
    if (this.#fullscreen) {
      this.#fullscreen = false;
      try {
        screen.orientation?.unlock();
      } catch {
        /* not locked */
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    this.#slot.append(this.#fr);
    this.#dialog.close();
    this.removeAttribute('open');
    document.documentElement.style.removeProperty('overflow');
    this.#labels();
    this.#layout();
    (this.#lastFocus as HTMLElement | null)?.focus?.();
    this.dispatchEvent(new CustomEvent('focusreaderclose', { bubbles: true }));
  }

  play() {
    if (this.#playing || !this.#frames.length) return;
    if (this.#done) {
      this.#done = false;
      this.#i = 0;
    }
    this.#playing = true;
    this.#started = true;
    this.#fr.classList.add('playing');
    this.#say(`Playing at ${this.#s.wpm} words per minute`);
    this.#show(false);
    this.#schedule();
    this.#wake(QUIET_AFTER_PLAY);
  }

  pause() {
    if (!this.#playing) return;
    this.#playing = false;
    this.#stop();
    this.#fr.classList.remove('playing');
    const f = this.#frames[this.#i];
    this.#say(`Paused, word ${fmt.format(f ? f.end : 0)} of ${fmt.format(this.#doc.words.length)}`);
    this.#show(false);
    this.#wake();
  }

  toggle() {
    if (this.#playing) this.pause();
    else this.play();
  }

  // ——— text

  /** Reads the text; `keep` keeps the place (same text, other font), else it starts from the top. */
  #load(keep = false) {
    const id = this.getAttribute('for');
    const src = id ? document.getElementById(id) : null;
    let blocks;
    if (src instanceof HTMLTemplateElement) blocks = blocksFromElement(src.content);
    else if (src) blocks = blocksFromElement(src);
    else {
      const t = this.querySelector('template');
      blocks = t ? blocksFromElement(t.content) : this.children.length ? blocksFromElement(this) : blocksFromText(this.textContent ?? '');
    }
    const word = keep ? (this.#frames[this.#i]?.start ?? 0) : 0;
    this.#doc = parse(blocks);
    this.#wordEls = [];
    this.#text.textContent = '';
    if (!keep) {
      this.#started = false;
      this.#done = false;
    }
    this.#widths.clear();
    this.#reframe(word);
    this.#seek.max = String(Math.max(0, this.#doc.words.length - 1));
  }

  /** Frames for the current words per frame, keeping the place: the frame that holds word `word`. */
  #reframe(word: number) {
    this.#frames = frames(this.#doc, this.#s.words);
    this.#i = this.#frames.length ? frameAt(this.#frames, word) : 0;
    this.#retime();
  }

  #retime() {
    const { ms, after } = schedule(this.#frames, this.#doc.words.length, this.#s.wpm);
    this.#ms = ms;
    this.#after = after;
  }

  #title() {
    return this.getAttribute('heading') ?? '';
  }

  #labels() {
    this.#q('[data-name]').textContent = this.getAttribute('name') ?? 'Focus reader';
    this.#q('[data-title]').textContent = this.#title();
    const door = this.#q('[data-door]');
    const open = this.#dialog.open;
    door.textContent = open ? 'Close' : 'Full screen';
    door.setAttribute('aria-label', open ? 'Close the reader' : 'Open the reader full screen');
  }

  // ——— playing

  #schedule() {
    this.#stop();
    if (!this.#playing) return;
    this.#timer = window.setTimeout(() => {
      if (this.#i >= this.#frames.length - 1) {
        this.#playing = false;
        this.#done = true;
        this.#fr.classList.remove('playing');
        this.#say('End of the text');
        this.#show(false);
        this.#wake();
        return;
      }
      this.#i++;
      this.#show(true);
      this.#schedule();
    }, this.#ms[this.#i]);
  }

  #stop() {
    clearTimeout(this.#timer);
    this.#timer = 0;
  }

  /** Moves to the frame holding word `w`, and keeps playing from there if it was. */
  #go(w: number) {
    this.#done = false;
    this.#started = true;
    this.#i = frameAt(this.#frames, Math.max(0, Math.min(w, this.#doc.words.length - 1)));
    this.#show(false);
    if (this.#playing) this.#schedule();
  }

  /** `n` frames back or on (a scroll, a swipe), and keeps playing from there if it was. */
  #step(n: number) {
    if (!this.#frames.length) return;
    this.#done = false;
    this.#started = true;
    this.#i = Math.max(0, Math.min(this.#frames.length - 1, this.#i + n));
    this.#show(false);
    if (this.#playing) this.#schedule();
  }

  /** Back to the start of this sentence, or of the one before if this frame is its first. */
  #back() {
    const { words } = this.#doc;
    const f = this.#frames[this.#i];
    if (!f) return;
    let target = words[f.start].sentence;
    if (target === f.start && f.start > 0) target = words[f.start - 1].sentence;
    this.#go(target);
    this.#say('Back a sentence');
  }

  #forward() {
    const { words } = this.#doc;
    const f = this.#frames[this.#i];
    if (!f) return;
    const here = words[f.start].sentence;
    let w = f.end;
    while (w < words.length && words[w].sentence === here) w++;
    if (w >= words.length) return;
    this.#go(w);
    this.#say('On a sentence');
  }

  // ——— drawing

  /** The panel changed size, or a setting did: fit the text, place the marker, draw. */
  #layout() {
    const w = this.#fr.clientWidth;
    const h = this.#fr.clientHeight;
    if (!w || !h) return;
    this.#fr.dataset.view = this.#s.view;
    this.#fr.classList.toggle('no-underline', !this.#s.underline);
    this.#fit();
    this.#fr.style.setProperty('--marker', `${MARKER[this.#s.view === 'flow' ? 'left' : this.#s.align] * 100}%`);
    if (this.#s.view === 'flow') {
      const [base, share] = FLOW_SIZE[this.#s.size];
      this.#fr.style.setProperty('--flow-size', `${Math.round(base + share * w)}px`);
      this.#flowTop = -1;
    }
    this.#show(false);
  }


  #sizePx(size: Size) {
    const w = this.#fr.clientWidth;
    const h = this.#fr.clientHeight;
    // an upright phone is narrow but tall: it reads as a 560 px panel, and the fit (#fit) steps down if needed
    const px = Math.round(SIZE_FACTOR[size] * Math.min(Math.max(w, 560), h * 1.6));
    // and the band (1.7 × the size, plus its rulers) never grows over the settings above it
    const room = Math.floor((this.#middle.clientHeight - 32) / 1.7);
    return Math.max(12, Math.min(SIZE_MAX, px, room));
  }

  /** Width the words can take on the band, from where they start. */
  #room() {
    const w = this.#stage.clientWidth;
    return this.#s.align === 'left' ? w * (1 - MARKER.left) - 8 : w - 16;
  }

  /** The width of most frames (90 %) for `n` words per frame, at 100 px. */
  #width(n: number) {
    const cs = getComputedStyle(this.#chunk);
    const font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    const key = `${n}|${font}`;
    let v = this.#widths.get(key);
    if (v === undefined) {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = font;
      const ws = frames(this.#doc, n)
        .map((f) => ctx.measureText(f.text).width)
        .sort((a, b) => a - b);
      v = ws.length ? ws[Math.floor(ws.length * 0.9)] : 0;
      this.#widths.set(key, v);
    }
    return v;
  }

  #fits(n: number, size: Size) {
    return (this.#width(n) * this.#sizePx(size)) / 100 <= this.#room();
  }

  /** Words per frame and size depend on each other: keep the words, step the size down until most frames fit. */
  #fit() {
    let i = SIZES.indexOf(this.#s.size);
    // Flow wraps its lines: any number of words fits at any size
    while (this.#s.view === 'sequence' && i > 0 && !this.#fits(this.#s.words, SIZES[i])) i--;
    this.#px = this.#sizePx(SIZES[i]);
    this.#fr.style.setProperty('--size', `${this.#px}px`);
    this.#effSize = SIZES[i];
    this.#controls();
  }

  #show(advance: boolean) {
    if (this.#s.view === 'flow') {
      this.#showFlow();
      this.#stats();
      return;
    }
    const f = this.#frames[this.#i];
    const chunk = this.#chunk;
    if (advance && !reducedMotion() && chunk.textContent) {
      // the frame before fades out where it stood, as on an e-ink screen
      this.#ghost.innerHTML = chunk.innerHTML;
      this.#ghost.style.cssText = chunk.style.cssText;
      this.#ghost.classList.remove('on');
      void this.#ghost.offsetWidth;
      this.#ghost.classList.add('on');
    } else this.#ghost.classList.remove('on');
    if (!f) {
      chunk.textContent = '';
      this.#stats();
      return;
    }
    chunk.classList.toggle('heading', f.heading);
    const align = this.#s.align;
    if (align === 'pivot') {
      const words = f.text.split(' ');
      // one word: its recognition point; several: the letter about a third of the way in
      const at = words.length === 1 ? orp(f.text) : snapLetter(f.text, Math.round(f.text.length * 0.3));
      chunk.innerHTML = `${esc(f.text.slice(0, at))}<span class="pivot">${esc(f.text[at] ?? '')}</span>${esc(f.text.slice(at + 1))}`;
    } else chunk.textContent = f.text;

    // fit this frame: one longer than most steps its own size down
    chunk.style.removeProperty('--fs');
    const room = this.#room();
    const width = chunk.offsetWidth;
    let fs = this.#px;
    if (width > room) {
      fs = Math.floor((this.#px * room) / width);
      chunk.style.setProperty('--fs', `${fs}px`);
    }
    const stageW = this.#stage.clientWidth;
    const marker = MARKER[align] * stageW;
    const real = chunk.offsetWidth;
    let x = marker;
    if (align === 'center') x = marker - real / 2;
    else if (align === 'pivot') {
      const p = chunk.querySelector<HTMLElement>('.pivot');
      x = marker - (p ? p.offsetLeft + p.offsetWidth / 2 : 0);
      x = Math.max(8, Math.min(x, stageW - real - 8));
    }
    chunk.style.setProperty('--x', `${Math.round(x)}px`);
    this.#fr.style.setProperty('--marker-x', align === 'left' ? `${Math.round(marker)}px` : '0px');
    this.#stats();
    if (!this.#playing) this.#showContext();
  }

  /** The element that takes the focus for the view shown. */
  #target() {
    return this.#s.view === 'flow' ? this.#flow : this.#band;
  }

  /** Flow's text: one paragraph per block, one span per word, built once per text. */
  #buildFlow() {
    const { blocks, words } = this.#doc;
    const out = document.createDocumentFragment();
    const els: HTMLElement[] = [];
    let p: HTMLElement | null = null;
    let block = -1;
    words.forEach((w, i) => {
      if (w.block !== block) {
        block = w.block;
        p = document.createElement('p');
        if (blocks[block].kind === 'heading') p.className = 'h';
        out.append(p);
      } else p!.append(' ');
      const span = document.createElement('span');
      span.className = 'w';
      span.dataset.i = String(i);
      span.textContent = w.text;
      p!.append(span);
      els.push(span);
    });
    this.#text.textContent = '';
    this.#text.append(out);
    this.#wordEls = els;
    this.#flowRead = 0;
    this.#flowNow = [0, 0];
    this.#flowTop = -1;
  }

  /** Marks what has been read and the frame being read, and moves the text so its line rests on the anchor. */
  #showFlow() {
    if (!this.#wordEls.length && this.#doc.words.length) this.#buildFlow();
    const els = this.#wordEls;
    const f = this.#frames[this.#i];
    if (!f) return;
    this.#markFlow();

    const first = els[f.start];
    const win = this.#text.parentElement!;
    const anchor = Math.round(win.clientHeight * FLOW_ANCHOR);
    this.#fr.style.setProperty('--anchor', `${anchor}px`);
    const top = first.offsetTop;
    // a free scroll (paused) holds until the frame changes or it plays again
    if (this.#i !== this.#flowFrame || this.#playing) this.#free = 0;
    this.#flowFrame = this.#i;
    // a jump (a new text, a resize, a seek far away) moves at once; reading on moves a line, smoothly
    const far = this.#flowTop < 0 || Math.abs(top - this.#flowTop) > first.offsetHeight * 3;
    this.#flowTop = top;
    this.#flowBase = Math.round(anchor - top - first.offsetHeight / 2);
    this.#flowAt(far);
  }

  /** Flow's words: read, being read (the frame), or ahead; only the ones whose state changed are touched. */
  #markFlow() {
    const els = this.#wordEls;
    const f = this.#frames[this.#i];
    if (!f || !els.length) return;
    const read = this.#done ? els.length : this.#started ? f.start : 0;
    const now: [number, number] = this.#done ? [0, 0] : [f.start, f.end];
    // only the words whose state changed
    const [a, b] = this.#flowNow;
    for (let k = a; k < b; k++) els[k]?.classList.remove('now');
    if (read > this.#flowRead) for (let k = this.#flowRead; k < read; k++) els[k].classList.add('read');
    else for (let k = read; k < this.#flowRead; k++) els[k].classList.remove('read');
    for (let k = now[0]; k < now[1]; k++) els[k].classList.add('now');
    this.#flowRead = read;
    this.#flowNow = now;
    this.#underline();
  }

  /**
   * The frame's underline, drawn as bars rather than each word's own: one per line the frame covers, running
   * through the spaces between its words, cut where the line breaks. Measured from a range over the frame.
   */
  #underline() {
    const [a, b] = this.#flowNow;
    const lines: { left: number; right: number; bottom: number }[] = [];
    if (b > a) {
      const range = document.createRange();
      range.setStartBefore(this.#wordEls[a]);
      range.setEndAfter(this.#wordEls[b - 1]);
      const box = this.#text.getBoundingClientRect();
      for (const rc of Array.from(range.getClientRects())) {
        if (!rc.width) continue;
        const bottom = Math.round(rc.bottom - box.top);
        const line = lines.find((l) => Math.abs(l.bottom - bottom) < 4);
        if (line) {
          line.left = Math.min(line.left, rc.left - box.left);
          line.right = Math.max(line.right, rc.right - box.left);
        } else lines.push({ left: rc.left - box.left, right: rc.right - box.left, bottom });
      }
    }
    for (const bar of this.#text.querySelectorAll('.under')) bar.remove();
    for (const l of lines) {
      const bar = document.createElement('span');
      bar.className = 'under';
      // just under the words' descenders, where an underline sits
      Object.assign(bar.style, { left: `${l.left}px`, width: `${l.right - l.left}px`, top: `calc(${l.bottom}px - 0.06em)` });
      this.#text.append(bar);
    }
  }

  /** Puts Flow's text where the line being read and the free scroll say. */
  #flowAt(instant: boolean) {
    const y = Math.round(this.#flowBase + this.#free);
    if (y === this.#flowY && !instant) return;
    this.#text.classList.toggle('instant', instant);
    this.#flowY = y;
    this.#text.style.setProperty('--y', `${y}px`);
  }

  /**
   * Paused, Flow scrolls freely, at the pace of the hand, from the first line resting on the anchor to the last,
   * and the reading place follows: the frame on the line at the anchor becomes the one being read, so Play goes
   * on from there. Returns false when it does not apply (Sequence, or playing), for the scroll to go a frame back
   * or on instead.
   */
  #scrollBy(dy: number) {
    if (this.#s.view !== 'flow' || this.#playing || !this.#wordEls.length) return false;
    const anchor = Math.round(this.#text.parentElement!.clientHeight * FLOW_ANCHOR);
    const y = Math.max(anchor - this.#text.offsetHeight, Math.min(anchor, this.#flowY + dy));
    const i = frameAt(this.#frames, this.#wordAt(anchor - y));
    if (i !== this.#i) {
      this.#i = i;
      this.#started = true;
      this.#done = false;
      this.#markFlow();
      this.#stats();
    }
    // the text stays where the hand put it: the offset is now from the new frame's line
    const first = this.#wordEls[this.#frames[i].start];
    this.#flowFrame = i;
    this.#flowTop = first.offsetTop;
    this.#flowBase = Math.round(anchor - first.offsetTop - first.offsetHeight / 2);
    this.#free = y - this.#flowBase;
    this.#flowAt(true);
    return true;
  }

  /** The first word of the line that holds `y`, in the text's own coordinates. */
  #wordAt(y: number) {
    const els = this.#wordEls;
    let lo = 0;
    let hi = els.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (els[mid].offsetTop + els[mid].offsetHeight > y) hi = mid;
      else lo = mid + 1;
    }
    while (lo > 0 && els[lo - 1].offsetTop === els[lo].offsetTop) lo--;
    return lo;
  }

  /** While paused: the whole sentence under the band, the frame in it marked, to read back if needed. */
  #showContext() {
    const { words } = this.#doc;
    const f = this.#frames[this.#i];
    if (!f) return void (this.#context.textContent = '');
    if (!this.#started && f.start === 0) {
      this.#context.textContent = coarse() ? 'Tap the band to start.' : 'Press Space or click the band to start.';
      return;
    }
    const s = words[f.start].sentence;
    let e = f.end;
    while (e < words.length && words[e].sentence === s && words[e].block === words[f.start].block) e++;
    const part = (a: number, b: number) => esc(words.slice(a, b).map((w) => w.text).join(' '));
    const before = part(s, f.start);
    const after = part(f.end, e);
    this.#context.innerHTML = `${before}${before ? ' ' : ''}<mark>${part(f.start, f.end)}</mark>${after ? ' ' : ''}${after}`;
  }

  #stats() {
    const total = this.#doc.words.length;
    const f = this.#frames[this.#i];
    // what has been read: up to the end of the frame on screen, once it has started
    const read = !f || !this.#started ? 0 : this.#done ? total : f.end;
    const leftMs = this.#done ? 0 : (this.#after[this.#i] ?? 0);
    const q = (s: string) => this.#q(s);
    q('[data-rate]').textContent = String(this.#s.wpm);
    q('[data-read]').textContent = fmt.format(read);
    q('[data-total]').textContent = `/ ${fmt.format(total)}`;
    const [left, unit] = duration(leftMs);
    q('[data-left]').textContent = left;
    q('[data-left-unit]').textContent = unit;
    const p = total ? read / total : 0;
    q('[data-pct]').textContent = `${Math.round(p * 100)}%`;
    this.#fr.style.setProperty('--p', String(p));
    this.#seek.value = String(f ? f.start : 0);
    this.#seek.setAttribute('aria-valuetext', `Word ${fmt.format(read)} of ${fmt.format(total)}, ${left} ${unit} left`);
    q('[data-state]').textContent = this.#playing ? 'Reading' : this.#done ? 'Read again' : 'Play';
    q('[data-act="play"]').setAttribute('aria-pressed', String(this.#playing));
  }

  #controls() {
    const s = this.#s;
    const q = (sel: string) => this.#q<HTMLButtonElement>(sel);
    q('[data-wpm]').textContent = String(s.wpm);
    q('[data-words]').textContent = String(s.words);
    q('[data-size]').textContent = this.#effSize.toUpperCase();
    q('[data-act="align"]').textContent = ALIGN_LABEL[s.align];
    q('[data-act="align"]').setAttribute('aria-label', `Alignment: ${ALIGN_LABEL[s.align]}. Change`);
    q('[data-act="wpm-"]').disabled = s.wpm <= WPM_MIN;
    q('[data-act="wpm+"]').disabled = s.wpm >= WPM_MAX;
    q('[data-act="words-"]').disabled = s.words <= 1;
    q('[data-act="words+"]').disabled = s.words >= WORDS_MAX || (s.view === 'sequence' && !this.#fits(s.words + 1, 's'));
    q('[data-act="view"]').textContent = VIEW_LABEL[s.view];
    q('[data-act="view"]').setAttribute('aria-label', `View: ${VIEW_LABEL[s.view]}. Change`);
    q('[data-act="underline"]').textContent = s.underline ? 'On' : 'Off';
    q('[data-act="underline"]').setAttribute('aria-pressed', String(s.underline));
    q('[data-act="underline"]').setAttribute('aria-label', 'Underline the words being read');
    q('[data-act="size-"]').disabled = this.#effSize === 's';
    q('[data-act="size+"]').disabled = this.#effSize === 'xl';
  }

  // ——— settings

  #set(change: Partial<Settings>, say: string) {
    const word = this.#frames[this.#i]?.start ?? 0;
    const s = this.#s;
    const before = s.words;
    if (change.view && change.view !== s.view) {
      // each view comes back with its own pace
      Object.assign(change, this.#paces[change.view]);
    }
    Object.assign(s, change);
    if (change.size) {
      // a larger size makes room by taking words off the frame (more words, in turn, step the size down: #fit)
      while (s.view === 'sequence' && s.words > 1 && !this.#fits(s.words, s.size)) s.words--;
    }
    this.#paces[s.view] = { wpm: s.wpm, words: s.words, size: s.size };
    if (s.words !== before) this.#reframe(word);
    else this.#retime();
    if (this.#playing) this.#schedule();
    this.#layout();
    this.#store();
    this.#say(say);
    if (change.view) {
      if (this.getAttribute('view') !== change.view) this.setAttribute('view', change.view);
      if (this.#root.activeElement === this.#band || this.#root.activeElement === this.#flow) this.#target().focus();
      this.dispatchEvent(new CustomEvent('focusreaderview', { bubbles: true, detail: { view: change.view } }));
    }
  }

  #act(act: string) {
    const s = this.#s;
    const i = SIZES.indexOf(this.#effSize);
    switch (act) {
      case 'play':
        return this.toggle();
      case 'wpm-':
      case 'wpm+': {
        const wpm = clampWpm(s.wpm + (act === 'wpm+' ? WPM_STEP : -WPM_STEP));
        return this.#set({ wpm }, `${wpm} words per minute`);
      }
      case 'words-':
      case 'words+': {
        const words = clampWords(s.words + (act === 'words+' ? 1 : -1));
        // more words per frame: the size shown steps down to fit them (#fit); fewer, and it grows back to the one chosen
        return this.#set({ words }, `${words} ${words === 1 ? 'word' : 'words'} per frame`);
      }
      case 'size-':
      case 'size+': {
        const size = SIZES[Math.max(0, Math.min(SIZES.length - 1, i + (act === 'size+' ? 1 : -1)))];
        return this.#set({ size }, `Size ${size.toUpperCase()}`);
      }
      case 'view': {
        const view = VIEWS[(VIEWS.indexOf(s.view) + 1) % VIEWS.length];
        return this.#set({ view }, `${VIEW_LABEL[view]} view`);
      }
      case 'underline':
        return this.#set({ underline: !s.underline }, s.underline ? 'Underline off' : 'Underline on');
      case 'align': {
        const align = ALIGNS[(ALIGNS.indexOf(s.align) + 1) % ALIGNS.length];
        return this.#set({ align }, `Aligned ${ALIGN_LABEL[align].toLowerCase()}`);
      }
    }
  }

  #store() {
    if (!this.hasAttribute('persist')) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ view: this.#s.view, align: this.#s.align, underline: this.#s.underline, paces: this.#paces }));
    } catch {
      /* private mode: nothing kept */
    }
  }

  /** The view, the alignment and each view's pace, as this browser kept them. */
  #restore() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE) ?? '{}');
      if (ALIGNS.includes(v.align)) this.#s.align = v.align;
      if (typeof v.underline === 'boolean') this.#s.underline = v.underline;
      if (VIEWS.includes(v.view)) this.#s.view = v.view;
      for (const view of VIEWS) {
        const p = v.paces?.[view];
        if (!p) continue;
        const pace = this.#paces[view];
        if (typeof p.wpm === 'number') pace.wpm = clampWpm(p.wpm);
        if (typeof p.words === 'number') pace.words = clampWords(p.words);
        if (SIZES.includes(p.size)) pace.size = p.size;
      }
    } catch {
      /* nothing kept, or private mode */
    }
  }

  // ——— input

  #wire() {
    if (this.#fr.dataset.wired) return;
    this.#fr.dataset.wired = '1';
    this.#fr.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-act]');
      if (b) this.#act(b.dataset.act!);
      else if ((e.target as Element).closest('[data-door]')) {
        if (this.#dialog.open) this.close();
        else this.open();
      }
    });
    // the band and the flow: a tap plays or pauses, a drag or a scroll moves (#gestures)
    for (const el of [this.#band, this.#flow]) this.#gestures(el);
    this.#fr.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.#wake();
    });
    this.#fr.addEventListener('pointerdown', () => this.#wake());
    this.#fr.addEventListener('focusin', () => {
      this.#engage(true);
      this.#wake();
    });
    // open on a phone, Safari brings its bars back on any scroll, even of a page that cannot move: none here
    this.#dialog.addEventListener(
      'touchmove',
      (e) => {
        if (e.target !== this.#seek) e.preventDefault();
      },
      { passive: false },
    );
    this.#seek.addEventListener('input', () => this.#go(Number(this.#seek.value)));
    this.#dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
  }

  /**
   * Taps, drags and scrolls on the band or the flow. A tap or a click anywhere on them plays or pauses, and does
   * nothing else. A drag or a scroll goes a frame back or on; in Flow while paused, it scrolls the text freely
   * instead (a touch scroll glides on once the finger is up).
   */
  #gestures(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      cancelAnimationFrame(this.#glide);
      if (e.pointerType === 'mouse') return;
      this.#drag = { x: e.clientX, y: e.clientY, done: 0, moved: false, t: e.timeStamp, v: 0, ly: e.clientY };
    });
    // a drag on a touch screen goes a frame back or on every SWIPE_STEP px: up or left is on, down or right back
    el.addEventListener('pointermove', (e) => {
      const d = this.#drag;
      if (!d || e.pointerType === 'mouse') return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 12) return;
      d.moved = true;
      const dt = e.timeStamp - d.t;
      const step = e.clientY - d.ly;
      if (dt > 0) d.v = 0.8 * (step / dt) + 0.2 * d.v;
      d.t = e.timeStamp;
      d.ly = e.clientY;
      if (this.#scrollBy(step)) return;
      const v = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
      const steps = Math.trunc(v / SWIPE_STEP);
      if (steps !== d.done) {
        this.#step(steps - d.done);
        d.done = steps;
      }
    });
    el.addEventListener('pointercancel', () => (this.#drag = null));
    el.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      const d = this.#drag;
      this.#drag = null;
      this.#wake();
      if (d?.moved) {
        if (this.#s.view === 'flow' && !this.#playing && !reducedMotion() && e.timeStamp - d.t < 80) this.#glideFrom(d.v);
        return;
      }
      this.toggle();
    });
    // a scroll goes a frame back or on, as a drag does: down or right is on (in Flow while paused: it scrolls)
    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.#dialog.open && !this.#engaged) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        this.#wake();
        if (this.#scrollBy(-e.deltaY * unit)) return;
        this.#wheel += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
        const steps = Math.trunc(this.#wheel / SCROLL_STEP);
        if (steps) {
          this.#wheel -= steps * SCROLL_STEP;
          this.#step(steps);
        }
      },
      { passive: false },
    );
  }

  /** A touch scroll in Flow goes on after the finger lifts, slowing down, as a page does. */
  #glideFrom(v: number) {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      v *= Math.pow(0.95, dt / 16);
      const before = this.#flowY;
      if (Math.abs(v) < 0.02 || !this.#scrollBy(v * dt) || this.#flowY === before) return;
      this.#glide = requestAnimationFrame(tick);
    };
    this.#glide = requestAnimationFrame(tick);
  }

  /**
   * Keys reach it from the whole document: while it is open, or once it has been used on the page and until
   * something else is. Listening on the panel alone missed them in Safari, where a click leaves the focus on the
   * page (buttons take none) and a modal dialog can keep it on itself.
   */
  #onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const path = e.composedPath();
    const inside = path.includes(this.#fr);
    if (!inside && !this.#dialog.open && !this.#engaged) return;
    const t = path[0] as HTMLElement;
    if (!inside && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ''))) return;
    this.#key(e, t);
  };

  #onPointerDown = (e: PointerEvent) => this.#engage(e.composedPath().includes(this.#fr));

  #engage(on: boolean) {
    this.#engaged = on;
    this.#fr.classList.toggle('engaged', on);
  }

  #key(e: KeyboardEvent, target: EventTarget) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onSeek = target === this.#seek;
    this.#wake();
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        this.toggle();
        break;
      case 'ArrowLeft':
        if (onSeek) return;
        e.preventDefault();
        this.#back();
        break;
      case 'ArrowRight':
        if (onSeek) return;
        e.preventDefault();
        this.#forward();
        break;
      case 'ArrowUp':
        if (onSeek) return;
        e.preventDefault();
        this.#act('wpm+');
        break;
      case 'ArrowDown':
        if (onSeek) return;
        e.preventDefault();
        this.#act('wpm-');
        break;
      case 'Escape':
        if (!this.#dialog.open) {
          e.preventDefault();
          this.pause();
        }
        break;
    }
  }

  /**
   * Labels back; while it plays, they fade out again after `after` ms without a move (sooner right after Play).
   * They stay while a control has the keyboard's focus, so it never sits on something invisible; a control a
   * click or a tap focused does not hold them.
   */
  #wake(after = QUIET_AFTER) {
    this.#fr.classList.remove('quiet');
    clearTimeout(this.#quietTimer);
    if (!this.#playing) return;
    this.#quietTimer = window.setTimeout(() => {
      const active = this.#root.activeElement;
      if (active && active !== this.#band && active !== this.#flow && active.matches(':focus-visible')) return;
      if (this.#playing) this.#fr.classList.add('quiet');
    }, after);
  }

  #say(text: string) {
    // the same words twice in a row are still read out
    this.#live.textContent = '';
    window.setTimeout(() => (this.#live.textContent = text), 30);
  }
}

const clampWpm = (v: number) => Math.max(WPM_MIN, Math.min(WPM_MAX, Math.round(v / WPM_STEP) * WPM_STEP));
const clampWords = (v: number) => Math.max(1, Math.min(WORDS_MAX, Math.round(v)));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The nearest letter at or after `i` (a space or a comma is no place to rest the eye). */
function snapLetter(s: string, i: number) {
  for (let k = i; k < s.length; k++) if (/[\p{L}\p{N}]/u.test(s[k])) return k;
  return Math.min(i, s.length - 1);
}

/** "6:12" min, or "1:02" h past an hour. */
function duration(ms: number): [string, string] {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 3600) return [`${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`, 'h'];
  return [`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 'min'];
}

/** The focused element, through shadow roots. */
function deepActive(): Element | null {
  let a = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a;
}

if (typeof customElements !== 'undefined' && !customElements.get('focus-reader')) {
  customElements.define('focus-reader', FocusReader);
}

declare global {
  interface HTMLElementTagNameMap {
    'focus-reader': FocusReader;
  }
}
