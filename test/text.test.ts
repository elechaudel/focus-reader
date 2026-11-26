// The text functions, pinned as they behave today (before the package leaves elchdl, #79): blocks from plain
// text, words, frames, timing, the frame holding a word, the recognition point. Pure functions, run by Node's
// own test runner (`pnpm test:unit`). Extraction from a page needs a DOM: it is tested in the browser
// (test/browser/text.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksFromText, frameAt, frames, join, orp, parse, PAUSES, schedule, type Frame } from '../src/text.ts';

const TEXT = `# A title here

One two three, four five six seven. Eight nine — ten eleven twelve! "Thirteen."

Second paragraph is short.`;

const doc = () => parse(blocksFromText(TEXT));
const spans = (fs: Frame[]) => fs.map((f) => [f.start, f.end, f.text]);
/** a word's weight, as text.ts has it: 1 on average, a little more for a long word */
const ww = (letters: number) => 0.8 + 0.08 * Math.sqrt(letters);
const close = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-9, msg ?? `${a} ≉ ${b}`);

test('blocksFromText: blank lines part paragraphs, "# " starts a heading, spaces collapse', () => {
  assert.deepEqual(blocksFromText(TEXT), [
    { kind: 'heading', text: 'A title here' },
    { kind: 'p', text: 'One two three, four five six seven. Eight nine — ten eleven twelve! "Thirteen."' },
    { kind: 'p', text: 'Second paragraph is short.' },
  ]);
  assert.deepEqual(blocksFromText('\n\n  \n'), []);
  // a hash without a space is text; any number of hashes makes a heading
  assert.deepEqual(blocksFromText('#nospace\n\n## Two  hashes   here'), [
    { kind: 'p', text: '#nospace' },
    { kind: 'heading', text: 'Two hashes here' },
  ]);
  // a single line break stays inside the paragraph
  assert.deepEqual(blocksFromText('one\ntwo'), [{ kind: 'p', text: 'one two' }]);
});

test('parse: words on spaces, each with its block and the start of its sentence', () => {
  const { words } = doc();
  assert.deepEqual(
    words.map((w) => `${w.text}|${w.block}|${w.sentence}`),
    [
      'A|0|0', 'title|0|0', 'here|0|0',
      'One|1|3', 'two|1|3', 'three,|1|3', 'four|1|3', 'five|1|3', 'six|1|3', 'seven.|1|3',
      // a lone dash sticks to the word before it
      'Eight|1|10', 'nine —|1|10', 'ten|1|10', 'eleven|1|10', 'twelve!|1|10',
      // a quote after the full stop still ends the sentence
      '"Thirteen."|1|15',
      'Second|2|16', 'paragraph|2|16', 'is|2|16', 'short.|2|16',
    ],
  );
});

test('parse: a dash opening a block does not stick to the block before', () => {
  const { words } = parse([
    { kind: 'p', text: 'End.' },
    { kind: 'p', text: '— Start' },
  ]);
  assert.deepEqual(words.map((w) => w.text), ['End.', '—', 'Start']);
});

test('parse: in a language written with spaces, every word has one before it but the first of a block', () => {
  const { words } = doc();
  assert.ok(words.every((w) => w.space));
});

test('parse: a run without spaces is cut into words by Intl.Segmenter, its punctuation kept with a word', () => {
  const words = (text: string, locale: string) => parse([{ kind: 'p', text }], locale).words;
  const ja = words('日本語の文章です。次の文、短い。', 'ja');
  assert.deepEqual(ja.map((w) => w.text), ['日本語', 'の', '文章', 'です。', '次', 'の', '文、', '短い。']);
  // no space between them, and 。 ends a sentence as a full stop does
  assert.deepEqual(ja.map((w) => w.space), [true, false, false, false, false, false, false, false]);
  assert.deepEqual(ja.map((w) => w.sentence), [0, 0, 0, 0, 4, 4, 4, 4]);
  assert.deepEqual(words('我喜欢读书。你呢？', 'zh').map((w) => w.text), ['我', '喜欢', '读书。', '你', '呢？']);
  assert.deepEqual(words('ภาษาไทยไม่มีช่องว่าง', 'th').map((w) => w.text), ['ภาษา', 'ไทย', 'ไม่มี', 'ช่อง', 'ว่าง']);
  // an opening bracket or quote goes with the word after it
  assert.deepEqual(words('Tokyo（東京）is big.', 'en').map((w) => [w.text, w.space]), [
    ['Tokyo', true],
    ['（東京）', false],
    ['is', false],
    ['big.', true],
  ]);
  assert.deepEqual(words('「東京」へ行く。', 'ja').map((w) => w.text), ['「東京」', 'へ', '行く。']);
});

test('join and frames: words put back together with a space only where the text had one', () => {
  const d = parse([{ kind: 'p', text: '日本語の文章です。次の文、短い。' }], 'ja');
  assert.equal(join(d.words, 0, d.words.length), '日本語の文章です。次の文、短い。');
  // three words a frame, cut at the end of a sentence; 、 adds a beat as a comma does
  const fs = frames(d, 3);
  assert.deepEqual(spans(fs), [
    [0, 3, '日本語の文章'],
    [3, 4, 'です。'],
    [4, 7, '次の文、'],
    [7, 8, '短い。'],
  ]);
  close(fs[2].weight, ww(1) + ww(1) + ww(1) + PAUSES.clause);
  assert.equal(join(doc().words, 3, 6), 'One two three,');
});

test('frames: one word at a time, a heading on its own', () => {
  const fs = frames(doc(), 1);
  assert.equal(fs.length, 20);
  assert.deepEqual(fs.map((f) => f.heading), [true, true, true, ...new Array(17).fill(false)]);
});

test('frames: hold the words set, cut at a sentence or a block, never at a comma or a dash', () => {
  assert.deepEqual(spans(frames(doc(), 3)), [
    [0, 3, 'A title here'],
    [3, 6, 'One two three,'],
    [6, 9, 'four five six'],
    [9, 10, 'seven.'],
    [10, 13, 'Eight nine — ten'],
    [13, 15, 'eleven twelve!'],
    [15, 16, '"Thirteen."'],
    [16, 19, 'Second paragraph is'],
    [19, 20, 'short.'],
  ]);
  assert.deepEqual(spans(frames(doc(), 6)), [
    [0, 3, 'A title here'],
    [3, 9, 'One two three, four five six'],
    [9, 10, 'seven.'],
    [10, 15, 'Eight nine — ten eleven twelve!'],
    [15, 16, '"Thirteen."'],
    [16, 20, 'Second paragraph is short.'],
  ]);
});

test('frames: a count under 1 or with a fraction reads as a whole number, at least 1', () => {
  assert.deepEqual(spans(frames(doc(), 0)), spans(frames(doc(), 1)));
  assert.deepEqual(spans(frames(doc(), 3.9)), spans(frames(doc(), 3)));
});

test('frames: a frame weighs its words, plus a beat per clause, two at a sentence, three at a block', () => {
  assert.deepEqual(PAUSES, { clause: 1, sentence: 2, block: 3, heading: 3 });
  const fs = frames(doc(), 3);
  // "One two three," : three words and a clause
  close(fs[1].weight, ww(3) + ww(3) + ww(5) + PAUSES.clause);
  // "four five six" : no pause
  close(fs[2].weight, ww(4) + ww(4) + ww(3));
  // "seven." : a sentence
  close(fs[3].weight, ww(5) + PAUSES.sentence);
  // "Eight nine — ten" : the dash is a clause
  close(fs[4].weight, ww(5) + ww(4) + ww(3) + PAUSES.clause);
  // '"Thirteen."' ends its block: the block's pause replaces the sentence's
  close(fs[6].weight, ww(8) + PAUSES.block);
  // the heading's own pause
  close(fs[0].weight, ww(1) + ww(5) + ww(4) + PAUSES.heading);
});

test('frames, a paragraph at a time: a frame per block, keeping every beat inside it', () => {
  const fs = frames(doc(), 6, true);
  assert.deepEqual(fs.map((f) => [f.start, f.end, f.heading]), [
    [0, 3, true],
    [3, 16, false],
    [16, 20, false],
  ]);
  // the words, two clauses (comma, dash), three sentence ends, then the block's
  const words = [3, 3, 5, 4, 4, 3, 5, 5, 4, 3, 6, 6, 8].reduce((s, n) => s + ww(n), 0);
  close(fs[1].weight, words + 2 * PAUSES.clause + 3 * PAUSES.sentence + PAUSES.block);
  // the heading is cut only as a frame would be: here it is whole
  close(fs[0].weight, frames(doc(), 6)[0].weight);
});

test('frames: none for an empty text', () => {
  assert.deepEqual(frames(parse([]), 3), []);
});

test('schedule: the whole text takes exactly words / wpm minutes, pauses included', () => {
  const d = doc();
  for (const [n, wpm] of [[1, 150], [3, 300], [6, 800]] as const) {
    const fs = frames(d, n);
    const { ms, after } = schedule(fs, d.words.length, wpm);
    const total = (d.words.length / wpm) * 60_000;
    close(ms.reduce((a, b) => a + b, 0), total, `${n} words at ${wpm}`);
    close(after[0], total);
    close(after.at(-1)!, ms.at(-1)!);
    // durations follow the weights
    fs.forEach((f, i) => close(ms[i] / ms[0], f.weight / fs[0].weight));
    // time left decreases frame by frame
    for (let i = 1; i < after.length; i++) assert.ok(after[i] < after[i - 1]);
  }
  assert.deepEqual(schedule([], 0, 150), { ms: [], after: [] });
});

test('schedule: twice the pace, half the time', () => {
  const d = doc();
  const fs = frames(d, 3);
  const a = schedule(fs, d.words.length, 150).ms;
  const b = schedule(fs, d.words.length, 300).ms;
  a.forEach((ms, i) => close(ms, 2 * b[i]));
});

test('frameAt: the frame that holds a word, clamped to the ends', () => {
  const fs = frames(doc(), 3);
  fs.forEach((f, i) => {
    for (let w = f.start; w < f.end; w++) assert.equal(frameAt(fs, w), i, `word ${w}`);
  });
  assert.equal(frameAt(fs, -5), 0);
  assert.equal(frameAt(fs, 999), fs.length - 1);
});

test('orp: the letter the eye lands on, a little left of the middle, leading punctuation counted', () => {
  const cases: [string, number][] = [
    ['a', 0], ['an', 1], ['word', 1], ['hello', 1], ['reading', 2], ['wonderful', 2],
    ['extraordinary', 3], ['incomprehensibly', 4], ['“Quoted”', 3], ['(x)', 1], ['', 0],
  ];
  for (const [w, i] of cases) assert.equal(orp(w), i, w);
});
