// The package as npm gets it, in dist/: the TypeScript compiled to JavaScript with its types (tsc, with the
// relative `.ts` imports rewritten to `.js`; tsc leaves them as they are in the types, so they are rewritten
// here), and the Astro component copied beside them, its imports rewritten the same way. In elchdl the site keeps
// importing the sources; `publishConfig` points npm at dist/.
import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url);
const at = (p) => new URL(p, root);
rmSync(at('dist'), { recursive: true, force: true });
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit' });

const js = (code) => code.replace(/(['"])(\.{1,2}\/[^'"]+)\.ts\1/g, '$1$2.js$1');
for (const dir of ['dist/src/', 'dist/astro/']) {
  for (const f of readdirSync(at(dir)).filter((f) => f.endsWith('.d.ts'))) writeFileSync(at(dir + f), js(readFileSync(at(dir + f), 'utf8')));
}
writeFileSync(at('dist/astro/FocusReader.astro'), js(readFileSync(at('astro/FocusReader.astro'), 'utf8')));
// the virtual modules' types, which config.d.ts needs as config.ts did
copyFileSync(at('astro/virtual.d.ts'), at('dist/astro/virtual.d.ts'));
const config = at('dist/astro/config.d.ts');
writeFileSync(config, `/// <reference path="./virtual.d.ts" />\n${readFileSync(config, 'utf8')}`);
