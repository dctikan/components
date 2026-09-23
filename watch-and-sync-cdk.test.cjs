const assert = require('node:assert/strict');
const {spawn, spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const script = path.join(__dirname, 'watch-and-sync-cdk.sh');

test('requires a target with installed dependencies before starting a build', () => {
  const missing = spawnSync('bash', [script], {encoding: 'utf8'});
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /target project/i);
});

test('does not sync stale output before the initial build succeeds', async () => {
  const tempRoot = path.join(__dirname, '..', 'temp');
  fs.mkdirSync(tempRoot, {recursive: true});
  const root = fs.mkdtempSync(path.join(tempRoot, 'cdk-sync-stale-'));
  const target = path.join(root, 'target');
  const fork = path.join(target, 'node_modules', '@nomad2102npm', 'cdk');
  const output = path.join(root, 'bazel-bin', 'src', 'cdk', 'npm_package');
  const bin = path.join(root, 'bin');
  const release = path.join(root, 'release-build');
  fs.mkdirSync(fork, {recursive: true});
  fs.mkdirSync(output, {recursive: true});
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(fork, 'package.json'), 'installed');
  fs.writeFileSync(path.join(output, 'package.json'), 'stale');
  fs.writeFileSync(
    path.join(bin, 'pnpm'),
    `#!/bin/sh
if [ "$1" = "-s" ]; then
  printf '%s\\n' '${path.join(root, 'bazel-bin')}'
elif [ "$1" = "bazel" ]; then
  while [ ! -f '${release}' ]; do sleep 0.1; done
  printf '%s\\n' fresh > '${path.join(output, 'package.json')}'
else
  sleep 30
fi
`,
  );
  fs.chmodSync(path.join(bin, 'pnpm'), 0o755);
  const child = spawn('bash', [script, target], {
    env: {...process.env, PATH: `${bin}:${process.env.PATH}`},
    stdio: 'ignore',
    detached: true,
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 2300));
    assert.equal(fs.readFileSync(path.join(fork, 'package.json'), 'utf8'), 'installed');
    fs.writeFileSync(release, 'go');
    const deadline = Date.now() + 10000;
    const readInstalledPackage = () => {
      try {
        return fs.readFileSync(path.join(fork, 'package.json'), 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw error;
      }
    };
    while (readInstalledPackage() !== 'fresh\n' && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(readInstalledPackage(), 'fresh\n');
  } finally {
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already exited */
      }
    }
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('copies Bazel output to the fork package path without replacing upstream CDK', async () => {
  const tempRoot = path.join(__dirname, '..', 'temp');
  fs.mkdirSync(tempRoot, {recursive: true});
  const root = fs.mkdtempSync(path.join(tempRoot, 'cdk-sync-'));
  const target = path.join(root, 'target with spaces');
  const fork = path.join(target, 'node_modules', '@nomad2102npm', 'cdk');
  const upstream = path.join(target, 'node_modules', '@angular', 'cdk');
  const output = path.join(root, 'bazel-bin', 'src', 'cdk', 'npm_package');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(fork, {recursive: true});
  fs.mkdirSync(upstream, {recursive: true});
  fs.mkdirSync(output, {recursive: true});
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(upstream, 'marker'), 'upstream');
  fs.writeFileSync(path.join(output, 'package.json'), '{"version":"test-build"}');
  fs.writeFileSync(
    path.join(bin, 'pnpm'),
    `#!/bin/sh\nif [ "$1" = "-s" ]; then printf '%s\\n' '${path.join(root, 'bazel-bin')}'; elif [ "$1" = "bazel" ]; then exit 0; else sleep 30; fi\n`,
  );
  fs.chmodSync(path.join(bin, 'pnpm'), 0o755);
  const child = spawn('bash', [script, target], {
    env: {...process.env, PATH: `${bin}:${process.env.PATH}`},
    stdio: 'ignore',
    detached: true,
  });
  try {
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(path.join(fork, 'package.json')) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(
      fs.readFileSync(path.join(fork, 'package.json'), 'utf8'),
      '{"version":"test-build"}',
    );
    assert.equal(fs.readFileSync(path.join(upstream, 'marker'), 'utf8'), 'upstream');
  } finally {
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already exited */
      }
    }
    fs.rmSync(root, {recursive: true, force: true});
  }
});
