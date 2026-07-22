import { isAbsolute } from 'node:path';

import { assertValidDate } from './domain/dates.mjs';
import { normalizeMetricSnapshot } from './domain/snapshot.mjs';
import { createGitHubClient } from './github/client.mjs';
import { writeReadyDirectory } from './publish/ready-directory.mjs';
import { validateSvg } from './render/validate-svg.mjs';
import { getDatasetProvider } from './registry/datasets.mjs';
import { resolveProfile } from './registry/profiles.mjs';
import { COLOR_SCHEMES, LAYOUTS } from './registry/visual-formats.mjs';

const GENERATION_DEADLINE_MS = 600_000;
const LOGIN_PATTERN = /^(?!-)(?!.*--)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function validateGenerationInput({ username, token, asOfDate, tempRoot }) {
  if (typeof username !== 'string' || !LOGIN_PATTERN.test(username)) {
    throw new TypeError('username must be a valid GitHub login');
  }
  if (typeof token !== 'string' || token.length === 0) throw new TypeError('token is required');
  assertValidDate(asOfDate, 'asOfDate');
  if (typeof tempRoot !== 'string' || !isAbsolute(tempRoot)) {
    throw new TypeError('tempRoot must be an absolute path');
  }
}

async function runStage(label, operation) {
  try {
    return await operation();
  } catch {
    throw new Error(`${label} failed`);
  }
}

async function collectRequiredDatasets({ datasetIds, client, username, asOfDate }) {
  const datasets = {};
  for (const id of datasetIds) {
    const provider = getDatasetProvider(id);
    datasets[id] = await runStage(`dataset ${id}`, () => (
      provider.collectAndNormalize({ client, username, asOfDate })
    ));
  }
  return datasets;
}

export function renderArtifacts(snapshot, format) {
  const artifacts = {};
  const datasets = Object.fromEntries(
    format.requiredDatasetIds.map((id) => [id, snapshot.datasets[id]]),
  );
  const formatSnapshot = Object.freeze({
    account: snapshot.account,
    asOfDate: snapshot.asOfDate,
    datasets: Object.freeze(datasets),
  });
  for (const layout of LAYOUTS) {
    for (const colorScheme of COLOR_SCHEMES) {
      try {
        const svg = format.render({ snapshot: formatSnapshot, layout, colorScheme });
        validateSvg({ svg, layout });
        format.validate({ svg, colorScheme, layout });
        artifacts[`${format.id}-${layout}-${colorScheme}.svg`] = svg;
      } catch {
        throw new Error(`format ${format.id} failed`);
      }
    }
  }
  return artifacts;
}

export async function generateProfileStats({
  username,
  token,
  profile = 'signal-field',
  asOfDate,
  tempRoot,
  fetchImpl = globalThis.fetch,
  sleep,
  now = Date.now,
}) {
  const effectiveAsOfDate = asOfDate ?? new Date(now()).toISOString().slice(0, 10);
  validateGenerationInput({ username, token, asOfDate: effectiveAsOfDate, tempRoot });
  const resolvedProfile = resolveProfile(profile);
  const deadlineAt = now() + GENERATION_DEADLINE_MS;
  const assertDeadline = () => {
    if (now() >= deadlineAt) throw new Error('generation deadline exceeded');
  };
  const client = createGitHubClient({ token, fetchImpl, sleep, now, deadlineAt });
  const datasets = await collectRequiredDatasets({
    datasetIds: resolvedProfile.requiredDatasetIds,
    client,
    username,
    asOfDate: effectiveAsOfDate,
  });
  assertDeadline();

  const snapshot = await runStage('snapshot normalization', async () => normalizeMetricSnapshot({
    username,
    asOfDate: effectiveAsOfDate,
    datasets,
    requiredDatasetIds: resolvedProfile.requiredDatasetIds,
  }));
  const artifacts = await runStage('SVG rendering', async () => (
    renderArtifacts(snapshot, resolvedProfile.visualFormat)
  ));
  assertDeadline();
  const { readyDir } = await runStage('ready directory', () => (
    writeReadyDirectory({
      artifacts,
      expectedNames: resolvedProfile.expectedArtifactNames,
      tempRoot,
    })
  ));
  assertDeadline();
  return Object.freeze({ readyDir, snapshot });
}
