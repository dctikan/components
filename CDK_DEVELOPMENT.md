# CDK Development Guide

This repository is the development source for the published `@nomad2102npm/cdk` package.

Consumers execute the **installed npm package**, not this repository's TypeScript directly. Editing files under `src/` does nothing to a target project until `watch-and-sync-cdk.sh` replaces `<target>/node_modules/@nomad2102npm/cdk`.

Unqualified statements below are current behavior. Script defects are labeled **Current state**. Do not treat those defects as the intended end state.

## Prerequisites

1. Node.js and `pnpm@9` (needed for ibazel / Bazel)
2. The target project already has `node_modules` (`npm ci` or `npm install` in that project)
3. Optional: `fswatch` (`brew install fswatch`) so the script does not use BSD `stat` polling

## Watch And Sync

Run the script from the repository root. The file lives next to this guide, not under `scripts/`.

**Current state:** the script header still says `./scripts/watch-and-sync-cdk.sh`. That path does not exist. Use the command below.

```bash
./watch-and-sync-cdk.sh /absolute/path/to/target/project
```

The destination is always:

```text
<target>/node_modules/@nomad2102npm/cdk
```

It is not `node_modules/@angular/cdk`.

Treat the local build as loaded only after the script prints:

```text
Synced CDK to <target>/node_modules/@nomad2102npm/cdk
```

Do not assume the target sees a new build while the script still prints `Waiting for initial build...`.

### What The Script Does Now

1. Requires one argument and that `<target>` and `<target>/node_modules` exist
2. Resolves Bazel output with `pnpm -s bazel info bazel-bin`
3. Watches `<bazel-bin>/src/cdk/npm_package`
4. Runs `pnpm ibazel build //src/cdk:npm_package --config=snapshot-build`
5. On each detected output change: `rm -rf` the installed package, then `cp -R` the Bazel output onto `@nomad2102npm/cdk`

Verified early exits (exit `1`):

- no argument: `Error: Please provide the target project path` and `Usage: ./watch-and-sync-cdk.sh /absolute/path/to/target/project`
- missing directory: `Error: Target project directory does not exist: <path>`
- missing `node_modules`: `Error: node_modules not found in target project. Run 'npm install' first.`

### Current Script Risks

- **Non-atomic replace.** The installed package is deleted before the copy. An interrupt between those steps leaves `@nomad2102npm/cdk` missing. Recover by rerunning the script or reinstalling the package in the target.
- **Weak target checks.** The script does not require that `@nomad2102npm/cdk` already exist; any directory with `node_modules` is accepted.
- **Current state:** `cp -R` fails unless `node_modules/@nomad2102npm` already exists. The script does not `mkdir -p` that scoped parent. A target that only has empty `node_modules` is accepted, then copy fails with `No such file or directory`.
- **Watcher health is not monitored.** If `fswatch` or the polling loop dies, ibazel can keep running without sync.
- **Cleanup is incomplete.** Only `SIGINT` and `SIGTERM` are trapped. There is no `EXIT` trap.
- **Current state:** `SIGINT` while the script is blocked on `pnpm ibazel` does not run `cleanup` and does not print `Shutting down...`. The process can stay up.
- **Polling is macOS-shaped.** The fallback uses `stat -f "%m"` on the Bazel output **directory**. Linux polling is unreliable without `fswatch`. In-place file overwrites may not change directory mtime, so polling may miss a rebuild that does not recreate the tree.
- **No rollback.** A bad copy overwrites the previously installed package in place.

### Recovery

1. Stop the script. **Current state:** `Ctrl+C` / `SIGINT` may not run cleanup while ibazel is blocking; stop leftover processes if the script stays up.
2. If `<target>/node_modules/@nomad2102npm/cdk` is missing or half-copied, reinstall the package in the target (`npm ci` or `npm install`)
3. Confirm the destination folder is `@nomad2102npm/cdk`, then start watch-and-sync again and wait for `Synced CDK to ...`

## Prove Which Package Is Loaded

After a published install, the package lives at `<target>/node_modules/@nomad2102npm/cdk`. The published install `name` is `@nomad2102npm/cdk`.

The Bazel `npm_package` / `src/cdk/package.json` `name` is `@angular/cdk`. That name appears only after a local `npm_package` copy, not after a fresh install from the registry.

Watch-and-sync replaces only `node_modules/@nomad2102npm/cdk`. If the target also has `node_modules/@angular/cdk`, that path is not updated. After a successful local sync, the `@nomad2102npm/cdk` path stays the same and file mtimes / copied contents change.

## Characterization Tests

```bash
node --test watch-and-sync-cdk.test.cjs
```

`watch-and-sync-cdk.test.cjs` locks current script behavior: argument handling, paths with spaces, destination package name, first and repeated sync, copied-file existence, `SIGINT` while blocked on ibazel (cleanup does not run), and the non-atomic `rm` then `cp` order.

If those tests fail after a script edit, stop. Keep these tests as the regression net.

## Platform

The script is Bash.

- macOS: supported. Prefer `fswatch`.
- Linux: use `fswatch`; do not trust the BSD `stat` polling fallback.
- Windows: not supported natively. WSL is the only plausible path; it is untested here.
