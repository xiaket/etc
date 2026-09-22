#!/usr/bin/env bash
# Rebuild one plugin and relink it into the dsh web profile.
#
# The build lands in a scratch directory and replaces `lib/` with one rename,
# so an interrupted run never leaves the package without a `lib/` (the
# profile hard-links into it; a missing lib/index.js makes every dsh web boot
# fail and systemd restart it in a loop). The host process must be restarted
# afterwards to load the new host half; the browser picks up the new client
# bundle on reload.
#
# Usage: scripts/redeploy.sh <package-dir-name>   e.g. scripts/redeploy.sh baton
set -euo pipefail

name="${1:?package dir name, e.g. baton}"
root="$(cd "$(dirname "$0")/.." && pwd)"
pkg="$root/packages/$name"
profile="${DSH_HOME:-$HOME/.dsh}/profiles/web"

[ -f "$pkg/package.json" ] || { echo "no package at $pkg" >&2; exit 1; }
npm_name="$(node -e "console.log(require('$pkg/package.json').name)")"

echo "== build $npm_name"
scratch="$pkg/.lib-build"
rm -rf "$scratch"
mkdir -p "$scratch"
( cd "$pkg" && npx tsc -p tsconfig.build.json --outDir "$scratch" && npx tsdown --out-dir "$scratch" )
old="$pkg/.lib-old"
rm -rf "$old"
[ -d "$pkg/lib" ] && mv "$pkg/lib" "$old"
mv "$scratch" "$pkg/lib"
rm -rf "$old"

echo "== relink into $profile"
( cd "$profile" && rm -rf "node_modules/$npm_name" && pnpm install --no-frozen-lockfile )

echo "== done; restart dsh web to load the new host half"
