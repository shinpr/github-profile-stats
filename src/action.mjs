import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { generateProfileStats } from './generate.mjs';

function requiredValue(env, key, label) {
  const value = env[key]?.trim();
  if (!value) throw new TypeError(`${label} is required`);
  return value;
}

export async function runAction({
  env = process.env,
  generate = generateProfileStats,
  appendOutput = appendFile,
} = {}) {
  const username = requiredValue(env, 'INPUT_USERNAME', 'username');
  const token = requiredValue(env, 'INPUT_TOKEN', 'token');
  const tempRoot = requiredValue(env, 'RUNNER_TEMP', 'runner_temp');
  const outputPath = requiredValue(env, 'GITHUB_OUTPUT', 'github_output');
  const profile = env.INPUT_PROFILE?.trim() || 'signal-field';
  const result = await generate({ username, token, profile, tempRoot });
  if (result.readyDir.includes('\n') || result.readyDir.includes('\r')) {
    throw new TypeError('ready-dir contains a newline');
  }
  await appendOutput(outputPath, `ready-dir=${result.readyDir}\n`, 'utf8');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runAction().catch((error) => {
    console.error(error instanceof Error ? error : new Error('GitHub profile stats generation failed'));
    process.exitCode = 1;
  });
}
