// The Astro integration: `focusReader({ ... })` in astro.config. It hands its options to the <FocusReader>
// component (focus-reader/astro/FocusReader.astro) and the theme to the page, through two virtual modules:
// - `virtual:focus-reader/config`: what every <FocusReader> writes on its <focus-reader> (readerConfig);
// - `virtual:focus-reader/theme.css`: the theme as --fr-* custom properties (themeCSS). <FocusReader> imports it;
//   a page that writes <focus-reader> itself can import it too.
import type { AstroIntegration } from 'astro';
import { readerConfig, themeCSS, type FocusReaderOptions } from './options.ts';

export type { Colors, FocusReaderOptions, Fonts, Pace, ReaderConfig, Theme } from './options.ts';

const CONFIG = 'virtual:focus-reader/config';
const THEME = 'virtual:focus-reader/theme.css';

export default function focusReader(options: FocusReaderOptions = {}): AstroIntegration {
  // at build time, so a wrong theme value stops the build with its name
  const config = readerConfig(options);
  const css = themeCSS(options.theme);
  return {
    name: 'focus-reader',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'focus-reader:virtual',
                resolveId(id) {
                  if (id === CONFIG || id === THEME) return `\0${id}`;
                },
                load(id) {
                  if (id === `\0${CONFIG}`) return `export default ${JSON.stringify(config)};`;
                  if (id === `\0${THEME}`) return css;
                },
              },
            ],
          },
        });
      },
    },
  };
}
