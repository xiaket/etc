# dsh-plugins

Personal [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
plugins, developed together so their dependency versions stay aligned.

## Layout

```
packages/
  baton/                Code workbench: one commander session dispatches worker
                        sessions across workspaces; own main panel + task list.
  sandbox-extra-roots/  Grants extra writable roots to the bash sandbox.
scripts/
  verify-peer-deps.mjs  Gate: harness packages must never be dependencies.
  redeploy.sh           Clean-rebuild one plugin and relink it into the web profile.
```

## Install Baton in dsh web

From this repository's root, with `dsh`, Node.js, and `pnpm` installed:

```sh
pnpm install
pnpm --filter dsh-baton build
dsh plugin --profile web add "link:$(pwd)/packages/baton"
dsh web
```

Build before adding the plugin: dsh web reads `packages/baton/lib/client.js`
when it starts. The `dsh plugin` command adds Baton's bundle to the web
profile automatically. For configuration, updates, and troubleshooting, see
[Baton's installation guide](packages/baton/README.md#安装).

## Commands

```sh
pnpm install
pnpm test           # every plugin
pnpm typecheck
pnpm verify:peers   # dependency-declaration gate
pnpm check          # gate + typecheck + test
pnpm redeploy <pkg> # rebuild + relink into ~/.dsh/profiles/web (then restart dsh web)
```

## Upgrading the harness

On npm the `latest` tag is stale (`0.0.1-rc.1`); prereleases publish under
`next`. So:

1. Read the installed version:
   `node -e "console.log(require('$(npm root -g)/@deepseek-ai/dsh/package.json').version)"`
2. Set every `@deepseek-ai/dsh-*` entry in each package's `devDependencies` to it.
3. `CI=true pnpm install --no-frozen-lockfile`
4. `pnpm check`
