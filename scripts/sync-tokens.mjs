// The site's look is elchdl's: its design tokens and base styles, copied here from a checkout of elchdl beside
// this repository (`pnpm sync:tokens`, or `ELCHDL=/path/to/elchdl pnpm sync:tokens`). @elchdl/tokens is private
// and generated from elchdl's DESIGN.md, so the site keeps a copy and takes elchdl's changes when asked to,
// never on its own. The two files are copied as they are: change them in elchdl, not here.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const elchdl = resolve(root, process.env.ELCHDL ?? '../elchdl');
const files = [
  ['packages/tokens/dist/tokens.css', 'site/src/styles/tokens.css'],
  ['packages/tokens/src/base.css', 'site/src/styles/base.css'],
];

for (const [from] of files) {
  if (!existsSync(resolve(elchdl, from))) {
    console.error(`sync-tokens: ${resolve(elchdl, from)} is missing (in elchdl, \`pnpm -C packages/tokens build\` writes tokens.css).`);
    process.exit(1);
  }
}
for (const [from, to] of files) {
  copyFileSync(resolve(elchdl, from), resolve(root, to));
  console.log(`${from} → ${to}`);
}
