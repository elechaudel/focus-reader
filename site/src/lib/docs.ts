import { getCollection } from 'astro:content';

/** The documentation's pages, in order. */
export const docPages = async () => (await getCollection('docs')).sort((a, b) => a.data.order - b.data.order);
