# Changesets

Each change that users of the package will notice comes with a changeset: `pnpm changeset`, pick the bump (patch, minor, major), write one or two sentences for the changelog. `pnpm version-packages` turns the changesets into a new version and its entry in `CHANGELOG.md`; `pnpm release` publishes it. See [RELEASING.md](../RELEASING.md).

This folder only works once the package is in its own repository: inside elchdl, Changesets looks for it at the root of the workspace.
