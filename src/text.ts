// The Focus Reader's text: blocks read from a page or plain text, split into words, grouped into frames of a
// few words, and timed. Pure functions, no DOM except blocksFromElement, which only reads one.
//
// Timing follows what reading research and the RSVP readers before this one do (pasky/speedread, Spritz):
// a longer word stays a little longer, a comma or a colon in a frame adds a beat, the end of a sentence two, the
// end of a paragraph three, and a heading stands on its own. Everything is then scaled so the whole text takes
// exactly words / wpm minutes: the rate shown is the rate you get, pauses included.

export type BlockKind = 'p' | 'heading' | 'quote' | 'item';

export interface Block {
  kind: BlockKind;
  text: string;
}

export interface Word {
  text: string;
  /** index of its block */
  block: number;
  /** index of the first word of its sentence */
  sentence: number;
}

export interface Doc {
  blocks: Block[];
  words: Word[];
}

export interface Frame {
  /** first word, inclusive */
  start: number;
  /** last word, exclusive */
  end: number;
  text: string;
  heading: boolean;
  /** how long it stays, in word units before scaling (see schedule) */
  weight: number;
}

const SENTENCE_END = /[.?!…]['"”’)\]]*$/;
const CLAUSE_END = /[,;:—–]['"”’)\]]*$/;
const DASH = /^[—–-]$/;

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DD', 'DT']);
const SKIP_TAGS = new Set([
  'PRE', 'FIGURE', 'VIDEO', 'AUDIO', 'IMG', 'PICTURE', 'SVG', 'CANVAS', 'IFRAME', 'SCRIPT', 'STYLE', 'TEMPLATE',
  'NAV', 'ASIDE', 'BUTTON', 'FORM', 'TABLE', 'NOSCRIPT',
]);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Blocks of text from a part of a page (an article's body, a <template>'s content): paragraphs, headings, list
 * items and quotes, in order. Skips what is not prose to read in a row: code blocks, figures and media, tables,
 * navigation, anything hidden, and anything marked `data-focus-skip`.
 */
export function blocksFromElement(root: ParentNode): Block[] {
  const out: Block[] = [];
  const walk = (node: ParentNode, inQuote: boolean) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag) || el.hasAttribute('hidden') || el.hasAttribute('data-focus-skip')) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      const hasBlocks = Array.from(el.querySelectorAll('*')).some((c) => BLOCK_TAGS.has(c.tagName.toUpperCase()));
      if (tag === 'BLOCKQUOTE' && hasBlocks) {
        walk(el, true);
        continue;
      }
      if (BLOCK_TAGS.has(tag) && !hasBlocks) {
        const text = clean(textOf(el));
        if (!text) continue;
        const kind: BlockKind = /^H\d$/.test(tag) ? 'heading' : tag === 'LI' ? 'item' : inQuote || tag === 'BLOCKQUOTE' ? 'quote' : 'p';
        out.push({ kind, text });
        continue;
      }
      if (el.children.length) walk(el, inQuote);
      else {
        const text = clean(el.textContent ?? '');
        if (text) out.push({ kind: inQuote ? 'quote' : 'p', text });
      }
    }
  };
  walk(root, false);
  return out;
}

/** The text of a block, without what it holds that is not read (an image, a footnote marker's own skip). */
function textOf(el: Element): string {
  let s = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) s += n.textContent ?? '';
    else if (n.nodeType === 1) {
      const e = n as Element;
      if (SKIP_TAGS.has(e.tagName.toUpperCase()) || e.hasAttribute('data-focus-skip')) continue;
      if (e.tagName === 'BR') s += ' ';
      else s += textOf(e);
    }
  }
  return s;
}

/**
 * Blocks from plain text: paragraphs are separated by a blank line, and a line starting with "#" is a heading
 * (Markdown-like, nothing more).
 */
export function blocksFromText(text: string): Block[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^#+\s/.test(p) ? { kind: 'heading' as const, text: clean(p.replace(/^#+\s/, '')) } : { kind: 'p' as const, text: clean(p) }));
}

/** Words, each with its block and the start of its sentence (where "back" goes). */
export function parse(blocks: Block[]): Doc {
  const words: Word[] = [];
  blocks.forEach((b, block) => {
    let sentence = words.length;
    for (const raw of b.text.split(' ')) {
      if (!raw) continue;
      // a lone dash sticks to the word before it, so it never stands alone on screen
      const last = words[words.length - 1];
      if (DASH.test(raw) && last && last.block === block) {
        last.text += ` ${raw}`;
        continue;
      }
      words.push({ text: raw, block, sentence });
      if (SENTENCE_END.test(raw)) sentence = words.length;
    }
  });
  return { blocks, words };
}

/** A word's weight: 1 on average, a little more for a long word. */
const wordWeight = (w: string) => 0.8 + 0.08 * Math.sqrt(letters(w).length);
const letters = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

/** The pause after a frame, in word units: a clause, a sentence, a block, a heading. */
export const PAUSES = { clause: 1, sentence: 2, block: 3, heading: 3 };

/**
 * Frames of `perFrame` words. A frame never crosses the end of a sentence or of a block, and nothing else cuts
 * it: a comma, a semicolon, a colon or a dash inside it only makes it stay a beat longer (cutting there too left
 * frames of a word or two, far short of the count). A heading is shown on its own, cut only if it is longer than
 * a frame.
 */
export function frames(doc: Doc, perFrame: number): Frame[] {
  const n = Math.max(1, Math.floor(perFrame));
  const out: Frame[] = [];
  const { words, blocks } = doc;
  let start = 0;
  while (start < words.length) {
    const block = words[start].block;
    const heading = blocks[block].kind === 'heading';
    let end = start;
    let weight = 0;
    let pause = 0;
    while (end < words.length && words[end].block === block && end - start < n) {
      const w = words[end].text;
      weight += wordWeight(w);
      end++;
      if (SENTENCE_END.test(w)) {
        pause = PAUSES.sentence;
        break;
      }
      if (CLAUSE_END.test(w) || / [—–-]$/.test(w)) pause += PAUSES.clause;
    }
    const blockEnds = end >= words.length || words[end].block !== block;
    if (blockEnds) pause = heading ? PAUSES.heading : PAUSES.block;
    out.push({
      start,
      end,
      text: words.slice(start, end).map((w) => w.text).join(' '),
      heading,
      weight: weight + pause,
    });
    start = end;
  }
  return out;
}

/**
 * How long each frame stays, in ms, at `wpm` words per minute: the weights scaled so the whole text takes
 * words / wpm minutes. Returns the durations and the time left after each frame's start, for "remaining".
 */
export function schedule(fs: Frame[], words: number, wpm: number): { ms: number[]; after: number[] } {
  const total = fs.reduce((s, f) => s + f.weight, 0) || 1;
  const unit = ((words / wpm) * 60_000) / total;
  const ms = fs.map((f) => f.weight * unit);
  const after: number[] = new Array(fs.length);
  let left = 0;
  for (let i = fs.length - 1; i >= 0; i--) {
    left += ms[i];
    after[i] = left;
  }
  return { ms, after };
}

/** The frame that holds word `w`. */
export function frameAt(fs: Frame[], w: number): number {
  let lo = 0;
  let hi = fs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fs[mid].start <= w) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The Optimal Recognition Point of a word, as Spritz and speedread place it: the letter the eye should land on,
 * a little left of the middle. Returned as an index into the word as written (leading punctuation counted).
 */
export function orp(word: string): number {
  const lead = word.length - word.replace(/^[^\p{L}\p{N}]+/u, '').length;
  const len = letters(word).length;
  const i = len <= 1 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : len <= 13 ? 3 : 4;
  return lead + i;
}
