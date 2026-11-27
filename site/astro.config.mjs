// The package's own site (landing, documentation, playground), built with its Astro integration and component,
// from the sources beside it. Netlify serves it at focus-reader.elchdl.com (netlify.toml, which sets SITE_URL, its
// address); SITE_BASE is the path it sits under, for a host that puts it in a folder (`/` by default).
import { defineConfig } from 'astro/config';
import focusReader from '../astro/index.ts';

export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.SITE_BASE ?? '/',
  outDir: './dist',
  trailingSlash: 'always',
  integrations: [
    focusReader({
      // every reader on the site starts as its page says, whatever was set on another page
      persist: false,
      // the site's tokens (elchdl's, src/styles/tokens.css): they turn with the theme, so one set does for both
      theme: {
        light: {
          paper: 'var(--color-paper)',
          ink: 'var(--color-ink)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
          rule: 'var(--color-rule)',
          accent: 'var(--color-citron)',
          accentText: 'var(--color-text-citron)',
          onInk: 'var(--color-paper)',
        },
        fonts: { text: 'var(--font-figtree)', label: 'var(--font-dm-mono)', figure: 'var(--font-dm-mono)' },
      },
    }),
  ],
  markdown: {
    // code takes its colours from the tokens (base.css, .astro-code)
    shikiConfig: { theme: 'css-variables' },
  },
  vite: {
    // the package's sources are beside the site, outside its root
    server: { fs: { allow: ['..'] } },
  },
});
