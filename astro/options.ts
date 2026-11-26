// The Astro integration's options, and what they become in the page: the attributes every <FocusReader> writes
// on its <focus-reader>, and the theme as CSS. Pure functions, run at build time.
import { LABELS, mergeLabels, type Labels } from '../src/labels.ts';
import type { Align, Size, View } from '../src/element.ts';

export interface Pace {
  /** words per minute, 100 to 800, by steps of 25 */
  wpm?: number;
  /** words per frame, 1 to 6 */
  words?: number;
  size?: Size;
}

/** The colours of the panel; any CSS colour, a custom property of the site's included. */
export interface Colors {
  /** the background, and the words */
  paper?: string;
  ink?: string;
  /** labels; in Flow, the words already read */
  muted?: string;
  /** minor ticks */
  faint?: string;
  /** outlines */
  rule?: string;
  /** Flow's words ahead (by default, faint mixed into paper) */
  ahead?: string;
  /** markers and progress */
  accent?: string;
  /** the accent as text: the pivot letter, headings */
  accentText?: string;
  /** text on the solid ink button */
  onInk?: string;
}

export interface Fonts {
  /** the words read */
  text?: string;
  /** the labels */
  label?: string;
  /** the figures: rate, words read, time left */
  figure?: string;
}

export interface Theme {
  light?: Colors;
  /** the colours under `prefers-color-scheme: dark`, and under `darkSelector` */
  dark?: Colors;
  fonts?: Fonts;
  /** for a site with its own light/dark switch: where the page is dark whatever the system says (`[data-theme="dark"]`) */
  darkSelector?: string;
  /** …and where it is light whatever the system says (`[data-theme="light"]`) */
  lightSelector?: string;
}

export interface FocusReaderOptions {
  /** the view a reader opens in */
  view?: View;
  sequence?: Pace & { align?: Align };
  flow?: Pace & { underline?: boolean };
  /** Flow, a paragraph at a time */
  paragraph?: Pick<Pace, 'wpm' | 'size'>;
  /** remember each reader's settings in the browser (default true) */
  persist?: boolean;
  /** the words of the panel, over the English defaults (see LABELS) */
  labels?: Partial<Labels>;
  theme?: Theme;
}

/** What the component reads from the options, through the integration's virtual module. */
export interface ReaderConfig {
  persist: boolean;
  /** the `defaults` attribute, as JSON, or nothing if no view was set */
  defaults?: string;
  /** the `labels` attribute, as JSON, or nothing if none were given */
  labels?: string;
  /** the component's own words: its button, and the line shown without JavaScript */
  open: string;
  noScript: string;
}

const COLORS: Record<keyof Colors, string> = {
  paper: '--fr-paper',
  ink: '--fr-ink',
  muted: '--fr-muted',
  faint: '--fr-faint',
  rule: '--fr-rule',
  ahead: '--fr-ahead',
  accent: '--fr-accent',
  accentText: '--fr-accent-text',
  onInk: '--fr-on-ink',
};
const FONTS: Record<keyof Fonts, string> = { text: '--fr-font-text', label: '--fr-font-label', figure: '--fr-font-figure' };

/** The options as the component uses them. */
export function readerConfig(o: FocusReaderOptions = {}): ReaderConfig {
  const defaults: Record<string, unknown> = {};
  if (o.view) defaults.view = o.view;
  for (const key of ['sequence', 'flow', 'paragraph'] as const) if (o[key] && Object.keys(o[key]).length) defaults[key] = o[key];
  const labels = mergeLabels(o.labels);
  const given = Object.fromEntries(Object.entries(labels).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(LABELS[k as keyof Labels])));
  // the component's own two stay out of the reader's attribute
  delete given.open;
  delete given.noScript;
  return {
    persist: o.persist ?? true,
    defaults: Object.keys(defaults).length ? JSON.stringify(defaults) : undefined,
    labels: Object.keys(given).length ? JSON.stringify(given) : undefined,
    open: labels.open,
    noScript: labels.noScript,
  };
}

/** A value written into the CSS: a colour, a font stack, a var(); nothing that could end the rule. */
function value(name: string, v: string) {
  if (typeof v !== 'string' || !v.trim() || /[;{}<>]/.test(v)) throw new Error(`focus-reader: the theme's ${name} is not a CSS value: ${JSON.stringify(v)}`);
  return v.trim();
}

function declarations(colors: Colors = {}, fonts: Fonts = {}) {
  const out: string[] = [];
  for (const [k, prop] of Object.entries(COLORS)) {
    const v = colors[k as keyof Colors];
    if (v !== undefined) out.push(`${prop}: ${value(k, v)};`);
  }
  for (const [k, prop] of Object.entries(FONTS)) {
    const v = fonts[k as keyof Fonts];
    if (v !== undefined) out.push(`${prop}: ${value(`fonts.${k}`, v)};`);
  }
  return out.join(' ');
}

/**
 * The theme as CSS: the light colours and the fonts on every <focus-reader>, the dark colours under
 * `prefers-color-scheme: dark` (unless inside `lightSelector`) and inside `darkSelector`. It only sets the
 * --fr-* custom properties, so a site's own CSS can still change any of them.
 */
export function themeCSS(theme: Theme = {}): string {
  const rules: string[] = [];
  const light = declarations(theme.light, theme.fonts);
  if (light) rules.push(`focus-reader { ${light} }`);
  const dark = declarations(theme.dark);
  if (dark) {
    const outside = theme.lightSelector ? `:not(:is(${value('lightSelector', theme.lightSelector)}) *)` : '';
    rules.push(`@media (prefers-color-scheme: dark) { focus-reader${outside} { ${dark} } }`);
    if (theme.darkSelector) rules.push(`:is(${value('darkSelector', theme.darkSelector)}) focus-reader { ${dark} }`);
  }
  return rules.join('\n') + (rules.length ? '\n' : '');
}
