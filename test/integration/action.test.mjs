import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { runAction } from '../../src/action.mjs';

test('should map Action inputs to generation and emit ready-dir', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-action-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const outputPath = join(tempRoot, 'output.txt');
  await writeFile(outputPath, '');
  let generationInput;

  await runAction({
    env: {
      INPUT_USERNAME: ' shinpr ',
      INPUT_TOKEN: 'secret-token',
      INPUT_PROFILE: ' activity-consistency ',
      RUNNER_TEMP: tempRoot,
      GITHUB_OUTPUT: outputPath,
    },
    generate: async (input) => {
      generationInput = input;
      return { readyDir: join(tempRoot, 'ready') };
    },
  });

  assert.deepEqual(generationInput, {
    username: 'shinpr',
    token: 'secret-token',
    profile: 'activity-consistency',
    tempRoot,
  });
  assert.equal(await readFile(outputPath, 'utf8'), `ready-dir=${join(tempRoot, 'ready')}\n`);
});

test('should default to the Signal Field profile', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-action-profile-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const outputPath = join(tempRoot, 'output.txt');
  await writeFile(outputPath, '');
  let generationInput;

  await runAction({
    env: {
      INPUT_USERNAME: 'shinpr',
      INPUT_TOKEN: 'secret-token',
      RUNNER_TEMP: tempRoot,
      GITHUB_OUTPUT: outputPath,
    },
    generate: async (input) => {
      generationInput = input;
      return { readyDir: join(tempRoot, 'ready') };
    },
  });

  assert.equal(generationInput.profile, 'signal-field');
  assert.equal(Object.hasOwn(generationInput, 'theme'), false);
});

test('should reject a missing token before generation', async () => {
  await assert.rejects(
    runAction({
      env: { INPUT_USERNAME: 'shinpr', RUNNER_TEMP: '/tmp', GITHUB_OUTPUT: '/tmp/output' },
      generate: async () => assert.fail('generation must not run'),
    }),
    /token is required/,
  );
});
