// The text the test page reads: three parts of four paragraphs, about 730 words, long enough for Flow to
// scroll and for every kind of frame (commas, dashes, quotes, headings). Written for the tests.
const PARAS = [
  `A text can be read in more than one way. On paper, the eye moves along a line, jumps to the next one, goes back when it lost the thread, and nobody notices; on a screen, the same movement fights with everything else the page offers, from links to the bar that slides in at the top.`,
  `Reading a few words at a time takes that movement away. The words come to the eye instead of the eye going to the words, at a pace chosen beforehand, and the only thing left to do is to keep up. Some find it restful. Others find it tiring after a while — which is a fair answer too.`,
  `The pace matters more than anything else. Too slow, and the mind wanders between two frames; too fast, and whole clauses go by before they make sense. Somewhere between the two lies a speed that feels like listening to someone who reads well: steady, a little slower on the long words, with a breath at the end of each sentence.`,
  `That breath is easy to forget. A reader who shows every word for the same time makes a comma feel like a stumble and a full stop like a wall. Giving each pause its own length, a beat after a clause, two after a sentence and three after a paragraph, is what makes the flow sound "natural" rather than mechanical.`,
];
const HEADINGS = ['How a page is read', 'A few words at a time', 'Keeping the pace'];

/** each part after the first starts its paragraphs with a word of its own, so no two paragraphs are the same */
const OPENERS = ['', 'Again, ', 'Once more, '];

export const ARTICLE = HEADINGS.map(
  (h, k) => `<h2>${h}</h2>\n${PARAS.map((p) => `<p>${k ? OPENERS[k] + p[0].toLowerCase() + p.slice(1) : p}</p>`).join('\n')}`,
).join('\n');
