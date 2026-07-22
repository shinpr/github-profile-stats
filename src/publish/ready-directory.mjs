import { randomUUID } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const ARTIFACT_NAME_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(compact|wide)-(dark|light)\.svg$/;

function validateArtifacts(artifacts, expectedNames) {
  if (!artifacts || typeof artifacts !== 'object') throw new TypeError('artifacts are required');
  if (!Array.isArray(expectedNames) || expectedNames.length === 0
    || new Set(expectedNames).size !== expectedNames.length
    || expectedNames.some((name) => !ARTIFACT_NAME_PATTERN.test(name))) {
    throw new TypeError('expectedNames must be a non-empty unique artifact-name array');
  }
  const names = Object.keys(artifacts).sort();
  const expected = [...expectedNames].sort();
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
    throw new TypeError('artifact names must exactly match expectedNames');
  }
  for (const name of names) {
    if (typeof artifacts[name] !== 'string') throw new TypeError(`${name} must be a string`);
  }
  return names;
}

export async function writeReadyDirectory({
  artifacts,
  expectedNames,
  tempRoot,
  directoryName = `github-profile-stats-${randomUUID()}`,
  fileSystem = { mkdir, readdir, writeFile },
}) {
  const filenames = validateArtifacts(artifacts, expectedNames);
  if (typeof tempRoot !== 'string' || !isAbsolute(tempRoot)) {
    throw new TypeError('tempRoot must be an absolute path');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(directoryName)) {
    throw new TypeError('directoryName contains unsupported characters');
  }
  const readyDir = join(tempRoot, directoryName);
  await fileSystem.mkdir(readyDir, { recursive: false });
  for (const filename of filenames) {
    await fileSystem.writeFile(join(readyDir, filename), artifacts[filename], { encoding: 'utf8', flag: 'wx' });
  }
  const entries = (await fileSystem.readdir(readyDir)).sort();
  if (entries.length !== filenames.length || entries.some((name, index) => name !== filenames[index])) {
    throw new TypeError('ready directory does not contain the exact artifact set');
  }
  return Object.freeze({ readyDir });
}
