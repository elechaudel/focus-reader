// Addresses inside the site, under the path it is hosted at (astro.config.mjs, `base`).
const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** `url('docs/')`: the site's own page at that path. */
export const url = (path = '') => base + path.replace(/^\//, '');

export const GITHUB = 'https://github.com/elechaudel/focus-reader';
export const NPM = 'https://www.npmjs.com/package/focus-reader';
export const LAB = 'https://elchdl.com/lab/the-focus-reader/';
