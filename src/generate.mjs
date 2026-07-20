import { isAbsolute } from 'node:path';

import { assertValidDate, pastYearDateRange } from './domain/dates.mjs';
import { normalizeSnapshot } from './domain/snapshot.mjs';
import { createGitHubClient } from './github/client.mjs';
import { collectContributions } from './github/contributions.mjs';
import {
  collectAuthoredIssues,
  collectAuthoredPullRequests,
  collectTotalStars,
} from './github/public-metrics.mjs';
import { writeReadyDirectory } from './publish/ready-directory.mjs';
import { validateSvg } from './render/validate-svg.mjs';
import {
  assertRegisteredVisualTheme,
  COLOR_SCHEMES,
  LAYOUTS,
  renderVisualTheme,
} from './render/visual-themes.mjs';

const GENERATION_DEADLINE_MS = 60_000;
const LOGIN_PATTERN = /^(?!-)(?!.*--)[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function validateGenerationInput({ username, token, theme, asOfDate, tempRoot }) {
  if (typeof username !== 'string' || !LOGIN_PATTERN.test(username)) {
    throw new TypeError('username must be a valid GitHub login');
  }
  if (typeof token !== 'string' || token.length === 0) throw new TypeError('token is required');
  assertRegisteredVisualTheme(theme);
  assertValidDate(asOfDate, 'asOfDate');
  if (typeof tempRoot !== 'string' || !isAbsolute(tempRoot)) {
    throw new TypeError('tempRoot must be an absolute path');
  }
}

async function runStage(label, operation) {
  try {
    return await operation();
  } catch (cause) {
    throw new Error(`${label} failed: ${cause instanceof Error ? cause.message : 'unknown error'}`, { cause });
  }
}

async function collectMetrics({ client, username, fromDate, toDate }) {
  const contributions = await runStage('contributions collector', () => collectContributions({
    client, username, fromDate, toDate,
  }));
  const totalStars = await runStage('stars collector', () => collectTotalStars({ client, username }));
  const authoredPullRequests = await runStage('pull request collector', () => (
    collectAuthoredPullRequests({ client, username })
  ));
  const authoredIssues = await runStage('issue collector', () => collectAuthoredIssues({ client, username }));
  return { contributions, totalStars, authoredPullRequests, authoredIssues };
}

function renderArtifacts(snapshot, visualTheme) {
  const artifacts = {};
  for (const layout of LAYOUTS) {
    for (const colorScheme of COLOR_SCHEMES) {
      const svg = renderVisualTheme({ visualTheme, snapshot, layout, colorScheme });
      validateSvg({ svg, colorScheme, layout });
      artifacts[`${visualTheme}-${layout}-${colorScheme}.svg`] = svg;
    }
  }
  return artifacts;
}

export async function generateProfileStats({
  username,
  token,
  theme = 'signal-field',
  asOfDate,
  tempRoot,
  fetchImpl = globalThis.fetch,
  sleep,
  now = Date.now,
}) {
  const effectiveAsOfDate = asOfDate ?? new Date(now()).toISOString().slice(0, 10);
  validateGenerationInput({ username, token, theme, asOfDate: effectiveAsOfDate, tempRoot });
  const deadlineAt = now() + GENERATION_DEADLINE_MS;
  const assertDeadline = () => {
    if (now() >= deadlineAt) throw new Error('generation deadline exceeded');
  };
  const client = createGitHubClient({ token, fetchImpl, sleep, now, deadlineAt });
  const period = pastYearDateRange(effectiveAsOfDate);
  const metrics = await collectMetrics({
    client,
    username,
    fromDate: period.fromDate,
    toDate: period.toDate,
  });
  assertDeadline();

  const snapshot = await runStage('snapshot normalization', async () => normalizeSnapshot({
    username,
    asOfDate: effectiveAsOfDate,
    ...metrics,
  }));
  const artifacts = await runStage('SVG rendering', async () => renderArtifacts(snapshot, theme));
  assertDeadline();
  const { readyDir } = await runStage('ready directory', () => (
    writeReadyDirectory({ artifacts, tempRoot })
  ));
  assertDeadline();
  return Object.freeze({ readyDir, snapshot });
}
