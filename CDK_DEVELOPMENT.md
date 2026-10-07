# CDK fork development scripts

TikiBase-specific usage, package provenance, and virtual-scroll testing instructions live in the [workspace local-development guide](../docs/virtual-scroll/local-development.md). This file describes the fork's local scripts.

## Watch and sync

From `form-cdk-components/`, run `./watch-and-sync-cdk.sh /absolute/path/to/workspace/app` (or point it at `demo/virtual-scroll`) only after the consumer has migrated to a compatible Angular version and the planned local tarball workflow. The current Angular 22 fork output is **not compatible** with the Angular 19 app or demo; do not sync it into either current consumer. The target directory and its `node_modules` must already exist. The script resolves Bazel's output directory with `pnpm -s bazel info bazel-bin`, runs an initial `pnpm bazel build //src/cdk:npm_package --config=snapshot-build` to completion, then starts `pnpm ibazel build //src/cdk:npm_package --config=snapshot-build` and polls `src/cdk/npm_package` under that output directory every two seconds. After a successful initial build, it replaces the target's `node_modules/@nomad2102npm/cdk` with a copy of the build output and prints `Synced CDK to ...`; later directory timestamp changes trigger further copies. Stop the watcher with `Ctrl+C`.

Only the direct `@nomad2102npm/cdk` directory is replaced. The separate `node_modules/@angular/cdk` override path is not synced by this script; see the workspace guide before interpreting consumer results. `node --test watch-and-sync-cdk.test.cjs` checks the script's target guard, initial-build gate, and copy behavior with a stubbed `pnpm`, not a real Bazel build.

## Angular 22 build and tests

The fork declares `pnpm@12.4.1` in `packageManager` but `11.27.0` in `engines.pnpm`; resolve the toolchain and install dependencies before invoking `pnpm build` or the Bazel targets. The release preparation script runs `pnpm build` and checks the generated package; it does not establish that browser tests pass.

On the current Linux ARM64 development host, `//src/cdk/scrolling:unit_tests_chromium` and `//src/cdk/collections:unit_tests_chromium` stop during Bazel analysis because the Chromium browser rules lack a Linux ARM64 condition. An earlier API-golden run on this host stopped during analysis because a Sass toolchain did not match; this is not an Angular 22 API-golden result. Angular 22 source and test-source Bazel build targets have compiled, but that is not runtime test evidence. Run browser suites and the API-golden check on a host with supported toolchains before claiming those checks pass. See the [workspace local-development guide](../docs/virtual-scroll/local-development.md#virtual-scroll-tests) for target commands and debugging steps.
