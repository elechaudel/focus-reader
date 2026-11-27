# Releasing

focus-reader is built inside elchdl (`packages/focus-reader`) and gets its own repository at its first release. The steps below take it there, publish 0.1.0, then hand later releases to Changesets. Each step is Edgar's to run: creating the repository and publishing are not done for him.

## 1. Its own repository

From elchdl's root, on an up-to-date `main`, split the package out with its history:

```sh
git subtree split --prefix packages/focus-reader -b focus-reader-split
```

Create an empty repository on GitHub, `elechaudel/focus-reader` (the name `package.json` already points at; change `homepage`, `repository` and `bugs` if it differs), with no README, licence or .gitignore. Then push the split and drop the local branch:

```sh
git push git@github.com:elechaudel/focus-reader.git focus-reader-split:main
git branch -D focus-reader-split
```

The history keeps elchdl's commit messages: `#79` and other numbers in them point at elchdl's issues, not the new repository's.

## 2. First run there

```sh
git clone git@github.com:elechaudel/focus-reader.git
cd focus-reader
pnpm install
pnpm exec playwright install chromium firefox webkit
pnpm check && pnpm build && pnpm test
```

`pnpm install` writes `pnpm-lock.yaml`; commit it and push. CI (`.github/workflows/ci.yml`) then runs the tests in Chromium, Firefox and WebKit on every push and pull request.

## 3. The first release, by hand

npm's trusted publishing can only be set up for a package that exists, so 0.1.0 goes out from your machine:

1. In `package.json`, remove `"private": true`.
2. `pnpm version-packages`: the waiting changeset (`.changeset/first-release.md`) makes the version 0.1.0 and writes `CHANGELOG.md`. Commit both and push.
3. `npm login`, with two-factor authentication on the account.
4. `pnpm publish`: it builds `dist/` first (`prepack`), and `publishConfig` points the exports at it. `pnpm pack` beforehand shows what goes out.
5. Tag it: `git tag v0.1.0 && git push --tags`.

## 4. Later releases

On npmjs.com, in the package's settings, add a trusted publisher: GitHub Actions, repository `elechaudel/focus-reader`, workflow `release.yml`. From then on:

- each change that users will notice comes with a changeset (`pnpm changeset`) in its pull request;
- on `main`, the release workflow keeps a "Version packages" pull request up to date with the next version and its changelog;
- merging that pull request publishes the version to npm, with provenance, without a token.

Check the release workflow on its first run.

## 5. Back in elchdl

Once 0.1.0 is on npm, elchdl uses it like any other package:

1. `pnpm -C apps/site add focus-reader@^0.1.0` (it replaces `workspace:*`), then delete `packages/focus-reader`.
2. Delete `.github/workflows/focus-reader.yml`, and the `packages/focus-reader/` lines in `.gitignore`.
3. Update `packages/README.md` and the line on the code in `DESIGN.md`'s Focus Reader section, which name `packages/focus-reader`.
4. `pnpm check && pnpm build`, then compare the Lab page and the Feed's loop with the site before the switch: the site imports the same paths (`focus-reader`, `focus-reader/astro`, `focus-reader/astro/FocusReader.astro`, `virtual:focus-reader/theme.css`), now from `dist/`.

## The demo

`pnpm demo:build` writes the demo page to `demo-dist/`, a static folder. Where it is hosted (GitHub Pages, Netlify) is yet to decide.
