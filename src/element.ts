// <focus-reader>: a text read a few words at a time, like subtitles, at a chosen pace.
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
const QUIET_AFTER = 2500;
/** settings kept in this browser; the version changes when the defaults do, so a new default is seen */
const STORE = 'focus-reader.v3';
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
dialog .band, .engaged .band { touch-action: none; }
/* open on a phone: nothing in the panel scrolls, so Safari never brings its bars back */
dialog, dialog .fr { overscroll-behavior: none; touch-action: none; }
dialog button, dialog .seek { touch-action: manipulation; }
.band:focus-visible .stage { outline: 1px dotted var(--fr-ink); outline-offset: -1px; }
.playing .band:focus-visible .stage { outline: none; }
.ruler {
  position: relative; height: 12px;
  background:
    linear-gradient(var(--fr-ink), var(--fr-ink)) 0 var(--y) / 100% 1px no-repeat,
    repeating-linear-gradient(90deg, var(--fr-ink) 0 1px, transparent 1px 80px) 0 var(--y) / 100% 9px no-repeat,
    repeating-linear-gradient(90deg, var(--fr-faint) 0 1px, transparent 1px 16px) 0 var(--y) / 100% 5px no-repeat;
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
@media (prefers-reduced-motion: reduce) {
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
      <span class="setting"><span>Align</span>
        <button type="button" class="align" data-act="align"></button></span>
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
      <span class="label keys"><span class="desk-keys"><b>Space</b> play · <b>← →</b> sentence · <b>Scroll</b> word · <b>↑ ↓</b> speed · <b>Esc</b> close</span><span class="touch-keys">Tap the middle to pause, the sides for a sentence back or on, swipe for a word</span></span>
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
  static observedAttributes = ['heading', 'name', 'for'];

  #root: ShadowRoot;
  #q = <T extends Element = HTMLElement>(s: string) => this.#root.querySelector<T>(s)!;
  #fr: HTMLElement;
  #slot: HTMLElement;
  #dialog: HTMLDialogElement;
  #band: HTMLElement;
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
  #s: Settings = { wpm: 150, words: 1, size: 'm', align: 'left' };
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
  #drag: { x: number; y: number; done: number; moved: boolean } | null = null;
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
    s.wpm = clampWpm(Number(a('wpm')) || s.wpm);
    s.words = clampWords(Number(a('words')) || s.words);
    if (SIZES.includes(a('size') as Size)) s.size = a('size') as Size;
    if (ALIGNS.includes(a('align') as Align)) s.align = a('align') as Align;
    if (this.hasAttribute('persist')) Object.assign(s, this.#restore());

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
    this.#band.focus();
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
    this.#wake();
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
    this.#fit();
    this.#fr.style.setProperty('--marker', `${MARKER[this.#s.align] * 100}%`);
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
    while (i > 0 && !this.#fits(this.#s.words, SIZES[i])) i--;
    this.#px = this.#sizePx(SIZES[i]);
    this.#fr.style.setProperty('--size', `${this.#px}px`);
    this.#effSize = SIZES[i];
    this.#controls();
  }

  #show(advance: boolean) {
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
    q('[data-act="words+"]').disabled = s.words >= WORDS_MAX || !this.#fits(s.words + 1, 's');
    q('[data-act="size-"]').disabled = this.#effSize === 's';
    q('[data-act="size+"]').disabled = this.#effSize === 'xl';
  }

  // ——— settings

  #set(change: Partial<Settings>, say: string) {
    const word = this.#frames[this.#i]?.start ?? 0;
    const s = this.#s;
    const before = s.words;
    Object.assign(s, change);
    if (change.size) {
      // a larger size makes room by taking words off the frame (more words, in turn, step the size down: #fit)
      while (s.words > 1 && !this.#fits(s.words, s.size)) s.words--;
    }
    if (s.words !== before) this.#reframe(word);
    else this.#retime();
    if (this.#playing) this.#schedule();
    this.#layout();
    this.#store();
    this.#say(say);
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
      case 'align': {
        const align = ALIGNS[(ALIGNS.indexOf(s.align) + 1) % ALIGNS.length];
        return this.#set({ align }, `Aligned ${ALIGN_LABEL[align].toLowerCase()}`);
      }
    }
  }

  #store() {
    if (!this.hasAttribute('persist')) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(this.#s));
    } catch {
      /* private mode: nothing kept */
    }
  }

  #restore(): Partial<Settings> {
    try {
      const v = JSON.parse(localStorage.getItem(STORE) ?? '{}');
      const out: Partial<Settings> = {};
      if (typeof v.wpm === 'number') out.wpm = clampWpm(v.wpm);
      if (typeof v.words === 'number') out.words = clampWords(v.words);
      if (SIZES.includes(v.size)) out.size = v.size;
      if (ALIGNS.includes(v.align)) out.align = v.align;
      return out;
    } catch {
      return {};
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
    // the band: the middle plays or pauses, the sides go a sentence back or on. A first tap on a quiet panel only
    // brings the labels back.
    this.#band.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.#drag = { x: e.clientX, y: e.clientY, done: 0, moved: false };
    });
    // a drag on a touch screen goes a frame back or on every SWIPE_STEP px: up or left is on, down or right back
    this.#band.addEventListener('pointermove', (e) => {
      const d = this.#drag;
      if (!d || e.pointerType === 'mouse') return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 10) return;
      d.moved = true;
      const v = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
      const steps = Math.trunc(v / SWIPE_STEP);
      if (steps !== d.done) {
        this.#step(steps - d.done);
        d.done = steps;
      }
    });
    this.#band.addEventListener('pointercancel', () => (this.#drag = null));
    this.#band.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      const dragged = this.#drag?.moved;
      this.#drag = null;
      if (dragged) return;
      const wasQuiet = this.#fr.classList.contains('quiet');
      this.#wake();
      if (wasQuiet && e.pointerType !== 'mouse') return;
      const r = this.#band.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.25) this.#back();
      else if (x > 0.75) this.#forward();
      else this.toggle();
    });
    this.#fr.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.#wake();
    });
    this.#fr.addEventListener('pointerdown', () => this.#wake());
    this.#fr.addEventListener('focusin', () => {
      this.#engage(true);
      this.#wake();
    });
    // a scroll on the band goes a frame back or on, as a drag does: down or right is on
    this.#band.addEventListener(
      'wheel',
      (e) => {
        if (!this.#dialog.open && !this.#engaged) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        this.#wheel += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
        const steps = Math.trunc(this.#wheel / SCROLL_STEP);
        if (steps) {
          this.#wheel -= steps * SCROLL_STEP;
          this.#step(steps);
        }
        this.#wake();
      },
      { passive: false },
    );
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

  /** Labels back; while it plays, they fade out again after QUIET_AFTER without a move. */
  #wake() {
    this.#fr.classList.remove('quiet');
    clearTimeout(this.#quietTimer);
    if (!this.#playing) return;
    this.#quietTimer = window.setTimeout(() => {
      // keep them while the keyboard is on a control, so focus never sits on something invisible
      const active = this.#root.activeElement;
      if (active && active !== this.#band) return;
      if (this.#playing) this.#fr.classList.add('quiet');
    }, QUIET_AFTER);
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
