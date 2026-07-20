import { randomUUID } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const VARIANTS = Object.freeze(['compact-dark', 'compact-light', 'wide-dark', 'wide-light']);
const ARTIFACT_NAME_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(compact|wide)-(dark|light)\.svg$/;

function validateArtifacts(artifacts) {
  if (!artifacts || typeof artifacts !== 'object') throw new TypeError('artifacts are required');
  const names = Object.keys(artifacts).sort();
  const firstMatch = names[0]?.match(ARTIFACT_NAME_PATTERN);
  const visualTheme = firstMatch?.[1];
  const expectedNames = visualTheme
    ? VARIANTS.map((variant) => `${visualTheme}-${variant}.svg`)
    : [];
  if (names.length !== expectedNames.length
    || names.some((name, index) => name !== expectedNames[index])) {
    throw new TypeError(
      'artifacts must contain exactly one visual theme with compact-dark, compact-light, wide-dark, wide-light variants',
    );
  }
  for (const name of names) {
    if (typeof artifacts[name] !== 'string') throw new TypeError(`${name} must be a string`);
  }
  return names;
}

export async function writeReadyDirectory({
  artifacts,
  tempRoot,
  directoryName = `github-profile-stats-${randomUUID()}`,
  fileSystem = { mkdir, readdir, writeFile },
}) {
  const filenames = validateArtifacts(artifacts);
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
