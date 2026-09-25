#!/usr/bin/env bash
set -euo pipefail

# Resolve this script's directory physically so links stay valid when the
# repository is accessed through aliases such as ~/.Github.
SETTINGS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DSH_DIR="${HOME}/.dsh"

sources=(
  "$SETTINGS_DIR/settings.yaml"
  "$SETTINGS_DIR/profiles/web/package.json"
  "$SETTINGS_DIR/profiles/web/cordis.patch.yml"
  "$SETTINGS_DIR/profiles/web/pnpm-workspace.yaml"
  "$SETTINGS_DIR/profiles/web/pnpm-lock.yaml"
  "$SETTINGS_DIR/profiles/web/patches/dsh-codex-auth@0.3.3-rc.1.patch"
)
targets=(
  "$DSH_DIR/settings.yaml"
  "$DSH_DIR/profiles/web/package.json"
  "$DSH_DIR/profiles/web/cordis.patch.yml"
  "$DSH_DIR/profiles/web/pnpm-workspace.yaml"
  "$DSH_DIR/profiles/web/pnpm-lock.yaml"
  "$DSH_DIR/profiles/web/patches/dsh-codex-auth@0.3.3-rc.1.patch"
)

# Preflight every source before changing anything.
for source in "${sources[@]}"; do
  if [[ ! -f "$source" ]]; then
    printf 'Missing source file: %s\n' "$source" >&2
    exit 1
  fi
done

for i in "${!sources[@]}"; do
  source="${sources[$i]}"
  target="${targets[$i]}"
  mkdir -p "$(dirname -- "$target")"

  if [[ -L "$target" ]]; then
    current="$(readlink "$target")"
    if [[ "$current" == "$source" ]]; then
      printf 'OK      %s\n' "$target"
      continue
    fi
    rm "$target"
  elif [[ -e "$target" ]]; then
    printf 'Refusing to replace non-symlink: %s\n' "$target" >&2
    exit 1
  fi

  ln -s "$source" "$target"
  printf 'LINKED  %s -> %s\n' "$target" "$source"
done
