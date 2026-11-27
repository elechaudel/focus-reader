# Releasing

focus-reader was built inside elchdl (`packages/focus-reader`) and got its own repository before its first release. The steps below record how it got here, then publish 0.1.0, then hand later releases to Changesets. Each step is Edgar's to run or to give the go for: publishing is never done for him.

## 1. Its own repository (done, 27 November 2026)

- `git subtree split --prefix packages/focus-reader` in elchdl, from the branch of its last pull request, kept the package's 29 commits with the package at the root.
- The commits' author and committer address became Edgar's GitHub `noreply` one (`git filter-branch --env-filter`), so no personal address goes public.
- The messages lost their references to elchdl's issues (`Refs #62`, `Step 2 of #79`…), which elchdl keeps private and which GitHub would have linked to this repository's own issues (`git filter-branch --msg-filter`). A few code comments still name `#79` or a commit of elchdl's: they are not links.
- The repository was created private, then the split pushed to `main` over SSH (the GitHub CLI's token cannot push workflow files).

The whole history was then checked for personal data (addresses, paths, tokens, private projects): none. Make the repository public in its settings once ready, before the first release, so the package's `repository` link works.

## 2. First run here (done, 27 November 2026)

```sh
pnpm install
pnpm exec playwright install chromium firefox webkit   # locally, only for FR_BROWSERS=all
pnpm check && pnpm build && pnpm test
```

`pnpm install` wrote `pnpm-lock.yaml`, committed with this file. Locally the tests run in the installed Chrome; CI (`.github/workflows/ci.yml`) runs them in Chromium, Firefox and WebKit on every push and pull request.

## 3. The first release, by hand (done, 27 November 2026)

npm's trusted publishing can only be set up for a package that exists, so 0.1.0 went out from Edgar's machine:

1. In `package.json`, `"private": true` removed; `pnpm version-packages` made the version 0.1.0 and wrote `CHANGELOG.md` (commit `0.1.0`).
2. `npm login`, with two-factor authentication. The account's email address shows in the package's public metadata on npm.
3. `pnpm publish`: it builds `dist/` first (`prepack`), and `publishConfig` points the exports at it. `pnpm pack` beforehand shows what goes out. (`pnpm release`, which is `changeset publish`, does the same and tags the version.)
4. Tagged `v0.1.0` and pushed the tag.
5. npm took it as a staged publish: until Edgar approved it on npmjs.com, the package showed a placeholder, `0.0.0-stage`. 0.1.0 is now `latest`, its `dist/` identical to a build of `main`, and jsDelivr serves it.
6. The GitHub release `v0.1.0` was written by hand, from the changelog, as a draft, to publish by hand.

## 4. Later releases

In this order, once 0.1.0 is live on npm (not before: with no changeset waiting, the workflow publishes any version npm lacks):

1. On npmjs.com, in the package's settings, add a trusted publisher: GitHub Actions, repository `elechaudel/focus-reader`, workflow `release.yml`.
2. GitHub Actions may create pull requests (Settings, Actions, General; done).
3. Turn the release workflow on: the repository variable `RELEASES` set to `on` (`gh variable set RELEASES --body on -R elechaudel/focus-reader`, or Settings, Secrets and variables, Actions; done, and a run with nothing to publish passed).

From then on:

- each change that users will notice comes with a changeset (`pnpm changeset`) in its pull request;
- on `main`, the release workflow keeps a "Version packages" pull request up to date with the next version and its changelog;
- merging that pull request publishes the version to npm, with provenance, without a token, tags it `vX.Y.Z` and writes its GitHub release from the changelog.

Check the release workflow on its first run: that pnpm publishes through the trusted publisher, and whether npm stages the version again (then it waits for approval on npmjs.com, as 0.1.0 did).

## 5. Back in elchdl

Once 0.1.0 is on npm, elchdl uses it like any other package:

1. `pnpm -C apps/site add focus-reader@^0.1.0` (it replaces `workspace:*`), then delete `packages/focus-reader`.
2. Delete `.github/workflows/focus-reader.yml`, and the `packages/focus-reader/` lines in `.gitignore`.
3. Update `packages/README.md` and the line on the code in `DESIGN.md`'s Focus Reader section, which name `packages/focus-reader`.
4. `pnpm check && pnpm build`, then compare the Lab page and the Feed's loop with the site before the switch: the site imports the same paths (`focus-reader`, `focus-reader/astro`, `focus-reader/astro/FocusReader.astro`, `virtual:focus-reader/theme.css`), now from `dist/`.

## Still to decide

- Where the demo is hosted: `pnpm demo:build` writes it to `demo-dist/`, a static folder (GitHub Pages, Netlify).
- Dependabot, for npm and GitHub Actions.
- Conventional Commits: Changesets does not need them, the changelog comes from the changesets.
- A scope on npm: `focus-reader` is unscoped; `@elechaudel/` exists already, an organisation only matters for several maintainers.
