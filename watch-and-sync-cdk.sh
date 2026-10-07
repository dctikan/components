#!/usr/bin/env bash
# Build the local CDK fork and copy each Bazel output into the consuming project.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s /absolute/path/to/target project\n' "$0" >&2
  exit 1
fi

target="$1"
if [[ ! -d "$target" || ! -d "$target/node_modules" ]]; then
  printf 'Target project and its node_modules must exist: %s\n' "$target" >&2
  exit 1
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bazel_bin="$(cd "$project_root" && pnpm -s bazel info bazel-bin)"
source_path="$bazel_bin/src/cdk/npm_package"
destination="$target/node_modules/@nomad2102npm/cdk"

sync_output() {
  if [[ -d "$source_path" ]]; then
    mkdir -p "$(dirname "$destination")"
    rm -rf "$destination"
    cp -R "$source_path" "$destination"
    printf 'Synced CDK to %s\n' "$destination"
  fi
}

watch_output() {
  local previous='' modified=''
  while true; do
    if [[ -d "$source_path" ]]; then
      modified="$(stat -c %Y "$source_path" 2>/dev/null || stat -f %m "$source_path")"
      if [[ "$modified" != "$previous" ]]; then
        previous="$modified"
        sync_output
      fi
    fi
    sleep 2
  done
}

cd "$project_root"
pnpm bazel build //src/cdk:npm_package --config=snapshot-build
watch_output &
watcher=$!
trap 'kill "$watcher" 2>/dev/null || true' EXIT
pnpm ibazel build //src/cdk:npm_package --config=snapshot-build
