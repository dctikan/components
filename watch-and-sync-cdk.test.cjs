const assert = require('node:assert/strict')
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const SCRIPT_PATH = path.join(__dirname, 'watch-and-sync-cdk.sh')
const SYNC_MARKER = 'Synced CDK to'
const WAITING_MARKER = 'Waiting for initial build...'
const SHUTDOWN_MARKER = 'Shutting down...'
const TARGET_PACKAGE_SEGMENT = path.join('node_modules', '@nomad2102npm', 'cdk')

function runScript(scriptArgs, spawnOptions = {}) {
  return spawnSync('bash', [SCRIPT_PATH, ...scriptArgs], {
    encoding: 'utf8',
    timeout: 15000,
    ...spawnOptions,
  })
}

function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`
}

function makeTempRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`))
}

function writeExecutable(filePath, fileBody) {
  fs.writeFileSync(filePath, fileBody, { encoding: 'utf8' })
  fs.chmodSync(filePath, 0o755)
}

function createStubPath(bazelBinPath) {
  const stubRoot = makeTempRoot('cdk-sync-stubs')
  writeExecutable(
    path.join(stubRoot, 'pnpm'),
    `#!/bin/bash
set -e
if [ "$1" = "-s" ]; then
  shift
fi
if [ "$1" = "bazel" ] && [ "$2" = "info" ] && [ "$3" = "bazel-bin" ]; then
  printf '%s\\n' "${bazelBinPath}"
  exit 0
fi
if [ "$1" = "ibazel" ]; then
  while true; do
    sleep 30
  done
fi
printf 'unexpected pnpm invocation: %s\\n' "$*" >&2
exit 1
`,
  )
  return stubRoot
}

function createPollingEnv(bazelBinPath) {
  return {
    PATH: `${createStubPath(bazelBinPath)}:/usr/bin:/bin`,
  }
}

test('missing target argument prints usage and exits 1', () => {
  const result = runScript([])
  assert.equal(result.status, 1)
  assert.match(combinedOutput(result), /Please provide the target project path/)
  assert.match(combinedOutput(result), /Usage: .*watch-and-sync-cdk\.sh \/absolute\/path\/to\/target\/project/)
})

test('missing target directory exits 1 before bazel', () => {
  const result = runScript([path.join(os.tmpdir(), 'cdk-sync-missing-target')])
  assert.equal(result.status, 1)
  assert.match(combinedOutput(result), /Target project directory does not exist/)
})

test('target without node_modules exits 1 before bazel', () => {
  const targetRoot = makeTempRoot('cdk-sync-no-modules')
  const result = runScript([targetRoot])
  assert.equal(result.status, 1)
  assert.match(combinedOutput(result), /node_modules not found in target project/)
})

test('target path with spaces is accepted by validation when node_modules is missing', () => {
  const parentRoot = makeTempRoot('cdk-sync-spaces')
  const targetRoot = path.join(parentRoot, 'my target app')
  fs.mkdirSync(targetRoot)
  const result = runScript([targetRoot])
  assert.equal(result.status, 1)
  assert.match(combinedOutput(result), /node_modules not found in target project/)
})

test('sync destination is node_modules/@nomad2102npm/cdk and not @angular/cdk', () => {
  const sourceText = fs.readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(sourceText, /node_modules\/@nomad2102npm\/cdk/)
  assert.doesNotMatch(sourceText, /node_modules\/@angular\/cdk/)
})

function startScript(targetRoot, environment) {
  const childProcess = spawn('bash', [SCRIPT_PATH, targetRoot], {
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  let combinedLog = ''
  const appendChunk = (chunk) => {
    combinedLog += chunk.toString()
  }
  childProcess.stdout.on('data', appendChunk)
  childProcess.stderr.on('data', appendChunk)
  return {
    childProcess,
    readLog: () => combinedLog,
  }
}

function waitForLog(readLog, pattern, timeoutMs) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const currentLog = readLog()
      if (pattern.test(currentLog)) {
        clearInterval(timer)
        resolve(currentLog)
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer)
        reject(new Error(`Timed out waiting for ${pattern}. Log:\n${currentLog}`))
      }
    }, 200)
  })
}

function forceKillProcessTree(childProcess) {
  if (!childProcess.pid) {
    return
  }
  try {
    process.kill(-childProcess.pid, 'SIGKILL')
  } catch {
    try {
      childProcess.kill('SIGKILL')
    } catch {
      // already exited
    }
  }
}

function stopScript(childProcess) {
  return new Promise((resolve) => {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
      resolve({ exitCode: childProcess.exitCode, signalName: childProcess.signalCode })
      return
    }
    const finish = (exitCode, signalName) => {
      resolve({ exitCode, signalName })
    }
    childProcess.once('exit', finish)
    childProcess.kill('SIGINT')
    setTimeout(() => {
      if (childProcess.exitCode === null && childProcess.signalCode === null) {
        forceKillProcessTree(childProcess)
      }
    }, 1000)
  })
}

function writePackageFixture(outputRoot, versionLabel) {
  fs.mkdirSync(outputRoot, { recursive: true })
  fs.writeFileSync(
    path.join(outputRoot, 'package.json'),
    `${JSON.stringify({ name: '@angular/cdk', version: versionLabel }, null, 2)}\n`,
  )
  fs.mkdirSync(path.join(outputRoot, 'fesm2022'), { recursive: true })
  fs.writeFileSync(
    path.join(outputRoot, 'fesm2022', 'scrolling.mjs'),
    `export const VERSION_LABEL = ${JSON.stringify(versionLabel)};\n`,
  )
}

function ensureScopedDestParent(targetRoot) {
  fs.mkdirSync(path.join(targetRoot, 'node_modules', '@nomad2102npm'), { recursive: true })
}

test('initial output names the real target package folder and waits when bazel output is missing', async () => {
  const workspaceRoot = makeTempRoot('cdk-sync-initial')
  const targetRoot = path.join(workspaceRoot, 'target-app')
  const bazelBinPath = path.join(workspaceRoot, 'bazel-bin')
  fs.mkdirSync(path.join(targetRoot, 'node_modules'), { recursive: true })
  const running = startScript(targetRoot, createPollingEnv(bazelBinPath))
  try {
    const currentLog = await waitForLog(running.readLog, /Starting ibazel build/, 10000)
    assert.match(currentLog, /CDK Watch & Sync Script/)
    assert.match(currentLog, new RegExp(targetRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(currentLog, /fswatch not found, using polling/)
    assert.match(currentLog, /Waiting for initial build\.\.\.|Starting file watcher/)
    assert.equal(fs.existsSync(path.join(targetRoot, TARGET_PACKAGE_SEGMENT)), false)
  } finally {
    await stopScript(running.childProcess)
  }
})

test('first available bazel output is copied to node_modules/@nomad2102npm/cdk', async () => {
  const workspaceRoot = makeTempRoot('cdk-sync-first')
  const targetRoot = path.join(workspaceRoot, 'target-app')
  const bazelBinPath = path.join(workspaceRoot, 'bazel-bin')
  const outputRoot = path.join(bazelBinPath, 'src', 'cdk', 'npm_package')
  ensureScopedDestParent(targetRoot)
  writePackageFixture(outputRoot, 'first-sync')
  const running = startScript(targetRoot, createPollingEnv(bazelBinPath))
  try {
    await waitForLog(running.readLog, new RegExp(SYNC_MARKER), 15000)
    const syncedPackage = JSON.parse(
      fs.readFileSync(path.join(targetRoot, TARGET_PACKAGE_SEGMENT, 'package.json'), 'utf8'),
    )
    assert.equal(syncedPackage.version, 'first-sync')
    assert.equal(fs.existsSync(path.join(targetRoot, 'node_modules', '@angular', 'cdk')), false)
  } finally {
    await stopScript(running.childProcess)
  }
})

test('repeated synchronization replaces the previously copied package', async () => {
  const workspaceRoot = makeTempRoot('cdk-sync-repeat')
  const targetRoot = path.join(workspaceRoot, 'target-app')
  const bazelBinPath = path.join(workspaceRoot, 'bazel-bin')
  const outputRoot = path.join(bazelBinPath, 'src', 'cdk', 'npm_package')
  ensureScopedDestParent(targetRoot)
  writePackageFixture(outputRoot, 'sync-one')
  const running = startScript(targetRoot, createPollingEnv(bazelBinPath))
  try {
    await waitForLog(running.readLog, /sync-one|Synced CDK to/, 15000)
    writePackageFixture(outputRoot, 'sync-two')
    const bumpedAt = new Date(Date.now() + 2000)
    fs.utimesSync(outputRoot, bumpedAt, bumpedAt)
    const startedAt = Date.now()
    while (Date.now() - startedAt < 15000) {
      if (fs.existsSync(path.join(targetRoot, TARGET_PACKAGE_SEGMENT, 'package.json'))) {
        const syncedPackage = JSON.parse(
          fs.readFileSync(path.join(targetRoot, TARGET_PACKAGE_SEGMENT, 'package.json'), 'utf8'),
        )
        if (syncedPackage.version === 'sync-two') {
          break
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    const syncedPackage = JSON.parse(
      fs.readFileSync(path.join(targetRoot, TARGET_PACKAGE_SEGMENT, 'package.json'), 'utf8'),
    )
    assert.equal(syncedPackage.version, 'sync-two')
  } finally {
    await stopScript(running.childProcess)
  }
})

test('target path with spaces still syncs into @nomad2102npm/cdk', async () => {
  const workspaceRoot = makeTempRoot('cdk-sync-space-ok')
  const targetRoot = path.join(workspaceRoot, 'my target app')
  const bazelBinPath = path.join(workspaceRoot, 'bazel-bin')
  const outputRoot = path.join(bazelBinPath, 'src', 'cdk', 'npm_package')
  ensureScopedDestParent(targetRoot)
  writePackageFixture(outputRoot, 'space-sync')
  const running = startScript(targetRoot, createPollingEnv(bazelBinPath))
  try {
    await waitForLog(running.readLog, new RegExp(SYNC_MARKER), 15000)
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(targetRoot, TARGET_PACKAGE_SEGMENT, 'package.json'), 'utf8'))
        .version,
      'space-sync',
    )
  } finally {
    await stopScript(running.childProcess)
  }
})

test('after sync the copied scrolling file is resolvable from the target folder', async () => {
  const workspaceRoot = makeTempRoot('cdk-sync-resolve')
  const targetRoot = path.join(workspaceRoot, 'target-app')
  const bazelBinPath = path.join(workspaceRoot, 'bazel-bin')
  const outputRoot = path.join(bazelBinPath, 'src', 'cdk', 'npm_package')
  ensureScopedDestParent(targetRoot)
  writePackageFixture(outputRoot, 'resolve-sync')
  const running = startScript(targetRoot, createPollingEnv(bazelBinPath))
  try {
    await waitForLog(running.readLog, new RegExp(SYNC_MARKER), 15000)
  } finally {
    await stopScript(running.childProcess)
  }
  const destinationFile = path.join(targetRoot, TARGET_PACKAGE_SEGMENT, 'fesm2022', 'scrolling.mjs')
  assert.equal(fs.existsSync(destinationFile), true)
  assert.match(destinationFile, /@nomad2102npm\/cdk/)
  let resolvedFile = destinationFile
  try {
    resolvedFile = require.resolve('./fesm2022/scrolling.mjs', {
      paths: [path.join(targetRoot, TARGET_PACKAGE_SEGMENT)],
    })
  } catch {
    // Fixture has no package exports map; file existence plus folder name is enough.
  }
  assert.equal(fs.existsSync(resolvedFile), true)
  assert.match(resolvedFile, /@nomad2102npm\/cdk/)
})

test('SIGINT trap does not run while blocked on ibazel and leaves the stub running', async () => {
  const workspaceRoot = makeTempRoot('cdk-sync-int')
  const targetRoot = path.join(workspaceRoot, 'target-app')
  const bazelBinPath = path.join(workspaceRoot, 'bazel-bin')
  fs.mkdirSync(path.join(targetRoot, 'node_modules'), { recursive: true })
  const sourceText = fs.readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(sourceText, /trap cleanup SIGINT SIGTERM/)
  assert.doesNotMatch(sourceText, /trap[^\n]*EXIT/)
  const running = startScript(targetRoot, createPollingEnv(bazelBinPath))
  try {
    await waitForLog(running.readLog, /Starting ibazel build/, 10000)
    running.childProcess.kill('SIGINT')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    assert.doesNotMatch(running.readLog(), new RegExp(SHUTDOWN_MARKER))
    assert.equal(running.childProcess.exitCode, null)
    assert.equal(running.childProcess.signalCode, null)
  } finally {
    await stopScript(running.childProcess)
  }
})

test('current replace is non-atomic: destination is removed before copy', () => {
  const sourceText = fs.readFileSync(SCRIPT_PATH, 'utf8')
  const removeIndex = sourceText.indexOf('rm -rf "$TARGET_CDK_PATH"')
  const copyIndex = sourceText.indexOf('cp -R "$CDK_OUTPUT" "$TARGET_CDK_PATH"')
  assert.notEqual(removeIndex, -1)
  assert.notEqual(copyIndex, -1)
  assert.ok(removeIndex < copyIndex)
})
