import { pastYearDateRange } from '../domain/dates.mjs';
import {
  normalizeContributionsDataset,
  normalizeScalarDataset,
} from '../domain/snapshot.mjs';
import { normalizeRepositoryLanguagesDataset } from '../domain/repository-languages.mjs';
import { collectContributions } from '../github/contributions.mjs';
import {
  collectAuthoredIssues,
  collectAuthoredPullRequests,
  collectTotalStars,
} from '../github/public-metrics.mjs';
import { collectRepositoryLanguages } from '../github/repository-languages.mjs';

async function collectContributionsDataset({ client, username, asOfDate }) {
  const period = pastYearDateRange(asOfDate);
  const contributions = await collectContributions({
    client,
    username,
    fromDate: period.fromDate,
    toDate: period.toDate,
  });
  return normalizeContributionsDataset({ asOfDate, contributions, period });
}

async function collectRepositoryLanguagesDataset({ client, username, asOfDate }) {
  const collected = await collectRepositoryLanguages({ client, username });
  return normalizeRepositoryLanguagesDataset({ asOfDate, ...collected });
}

function scalarProvider(id, collect) {
  return Object.freeze({
    id,
    async collectAndNormalize(context) {
      return normalizeScalarDataset({ id, value: await collect(context) });
    },
  });
}

const DATASET_PROVIDERS = Object.freeze({
  contributions: Object.freeze({
    id: 'contributions',
    collectAndNormalize: collectContributionsDataset,
  }),
  totalStars: scalarProvider('totalStars', collectTotalStars),
  authoredPullRequests: scalarProvider('authoredPullRequests', collectAuthoredPullRequests),
  authoredIssues: scalarProvider('authoredIssues', collectAuthoredIssues),
  repositoryLanguages: Object.freeze({
    id: 'repositoryLanguages',
    collectAndNormalize: collectRepositoryLanguagesDataset,
  }),
});

export function getDatasetProvider(id) {
  const provider = DATASET_PROVIDERS[id];
  if (!provider) throw new TypeError(`unsupported dataset: ${id}`);
  return provider;
}
