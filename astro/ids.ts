// Ids for the readers and texts of one page: counted per page (per request), so two <FocusReader> on a page
// never share one, and a page gets the same ids at every build.
const pages = new WeakMap<object, number>();

export function nextId(page: object): number {
  const n = (pages.get(page) ?? 0) + 1;
  pages.set(page, n);
  return n;
}
