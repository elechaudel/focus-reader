// The Astro test site (test/browser/astro.spec.ts): the integration with settings, labels and a theme in light
// and dark, as a site would set them.
import { defineConfig } from 'astro/config';
import focusReader from '../../astro/index.ts';

export default defineConfig({
  outDir: './dist',
  integrations: [
    focusReader({
      sequence: { wpm: 200 },
      labels: { play: 'Lire', open: 'Ouvrir le lecteur', noScript: 'Le lecteur a besoin de JavaScript.' },
      theme: {
        light: { paper: 'rgb(250, 250, 240)', ink: 'rgb(20, 20, 20)', accent: 'rgb(200, 0, 0)' },
        dark: { paper: 'rgb(10, 10, 20)', ink: 'rgb(240, 240, 240)' },
        fonts: { text: 'Georgia, serif' },
        darkSelector: '[data-theme="dark"]',
        lightSelector: '[data-theme="light"]',
      },
    }),
  ],
});
