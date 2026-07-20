import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeReadyDirectory } from '../../src/publish/ready-directory.mjs';

const ARTIFACTS = Object.freeze({
  'signal-field-compact-dark.svg': '<svg id="compact-dark"/>',
  'signal-field-compact-light.svg': '<svg id="compact-light"/>',
  'signal-field-wide-dark.svg': '<svg id="wide-dark"/>',
  'signal-field-wide-light.svg': '<svg id="wide-light"/>',
});

const FILENAMES = Object.keys(ARTIFACTS).sort();

test('should expose a directory only after all four exact artifacts are written', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-ready-test-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));

  const result = await writeReadyDirectory({
    artifacts: ARTIFACTS,
    tempRoot,
  });

  assert.deepEqual(await readdir(result.readyDir), FILENAMES);
  assert.equal(
    await readFile(join(result.readyDir, 'signal-field-wide-light.svg'), 'utf8'),
    '<svg id="wide-light"/>',
  );
});

test('should accept one complete four-variant set for another visual theme', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-ready-theme-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const artifacts = Object.fromEntries(Object.entries(ARTIFACTS).map(([name, svg]) => [
    name.replace('signal-field', 'quiet-grid'),
    svg,
  ]));

  const result = await writeReadyDirectory({ artifacts, tempRoot });

  assert.deepEqual(await readdir(result.readyDir), [
    'quiet-grid-compact-dark.svg',
    'quiet-grid-compact-light.svg',
    'quiet-grid-wide-dark.svg',
    'quiet-grid-wide-light.svg',
  ]);
});

test('should reject without returning a ready directory when a write fails', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-write-failure-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  let writes = 0;
  const fileSystem = {
    mkdir,
    readdir,
    async writeFile(...args) {
      writes += 1;
      if (writes === 2) throw new Error('injected write failure');
      return writeFile(...args);
    },
  };

  await assert.rejects(
    writeReadyDirectory({
      artifacts: ARTIFACTS,
      tempRoot,
      fileSystem,
      directoryName: 'fixed',
    }),
    /injected write failure/,
  );
});

test('should reject an extra artifact name', async () => {
  await assert.rejects(
    writeReadyDirectory({
      artifacts: {
        ...ARTIFACTS,
        'manifest.json': '{}',
      },
      tempRoot: '/tmp/unused',
    }),
    /exactly one visual theme with compact-dark, compact-light, wide-dark, wide-light variants/,
  );
});

test('should reject when final directory validation observes an extra file', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-entry-failure-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const fileSystem = {
    mkdir,
    writeFile,
    readdir: async () => [...FILENAMES, 'unexpected.txt'],
  };

  await assert.rejects(
    writeReadyDirectory({
      artifacts: ARTIFACTS,
      tempRoot,
      fileSystem,
      directoryName: 'fixed',
    }),
    /does not contain the exact artifact set/,
  );
});
