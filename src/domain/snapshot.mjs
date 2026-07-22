import { assertValidDate, listUtcDates, pastYearDateRange } from './dates.mjs';

const METRIC_ACTIVITY_LEVEL_RULE = 'activity-level.nearest-rank-positive-quartiles';
const SCALAR_DATASETS = Object.freeze({
  totalStars: Object.freeze({
    definition: 'github.owned-public-repository-stars',
    source: 'github.rest.user-repositories',
    visibility: 'public',
  }),
  authoredPullRequests: Object.freeze({
    definition: 'github.rest-search.authored-public-pull-requests.all-time',
    source: 'github.rest.search-issues',
    visibility: 'public',
  }),
  authoredIssues: Object.freeze({
    definition: 'github.rest-search.authored-public-issues.all-time',
    source: 'github.rest.search-issues',
    visibility: 'public',
  }),
});

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
}

function nearestRank(values, percentile) {
  return values[Math.ceil(percentile * values.length) - 1];
}

export function deriveActivityLevels(counts) {
  counts.forEach((count, index) => assertNonNegativeInteger(count, `counts[${index}]`));
  const positives = counts.filter((count) => count > 0).sort((left, right) => left - right);
  if (positives.length === 0) return counts.map(() => 0);

  const thresholds = [
    nearestRank(positives, 0.25),
    nearestRank(positives, 0.5),
    nearestRank(positives, 0.75),
  ];
  return counts.map((count) => {
    if (count === 0) return 0;
    const thresholdIndex = thresholds.findIndex((threshold) => count <= threshold);
    return thresholdIndex === -1 ? 4 : thresholdIndex + 1;
  });
}

function validateDailySeries({ daily, fromDate, toDate, days }) {
  if (!Array.isArray(daily) || daily.length !== days) {
    throw new TypeError(`snapshot requires exactly ${days} contribution days`);
  }
  const ordered = daily.map((day, index) => {
    if (!day || typeof day !== 'object') throw new TypeError(`daily[${index}] must be an object`);
    assertValidDate(day.date, `daily[${index}].date`);
    assertNonNegativeInteger(day.contributionCount, `daily[${index}].contributionCount`);
    return { date: day.date, count: day.contributionCount };
  }).sort((left, right) => left.date.localeCompare(right.date));

  const expectedDates = listUtcDates(fromDate, toDate);
  ordered.forEach((day, index) => {
    if (day.date !== expectedDates[index]) {
      throw new TypeError(`contribution dates must cover ${fromDate} through ${toDate} without gaps`);
    }
  });
  return ordered;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function deriveConsistency(counts) {
  let activeDays = 0;
  let currentRun = 0;
  let longestStreak = 0;
  for (const count of counts) {
    if (count === 0) {
      currentRun = 0;
      continue;
    }
    activeDays += 1;
    currentRun += 1;
    longestStreak = Math.max(longestStreak, currentRun);
  }
  let currentStreak = 0;
  for (let index = counts.length - 1; index >= 0 && counts[index] > 0; index -= 1) {
    currentStreak += 1;
  }
  return { activeDays, currentStreak, longestStreak };
}

export function normalizeContributionsDataset({ asOfDate, contributions, period }) {
  assertValidDate(asOfDate, 'asOfDate');
  const effectivePeriod = period ?? pastYearDateRange(asOfDate);
  if (effectivePeriod.toDate !== asOfDate) {
    throw new TypeError('contribution period must end on the snapshot as-of date');
  }
  const ordered = validateDailySeries({ daily: contributions?.daily, ...effectivePeriod });
  const counts = ordered.map((day) => day.count);
  const totalContributions = counts.reduce((sum, count) => sum + count, 0);
  if (totalContributions !== contributions.totalContributions) {
    throw new TypeError('contribution total does not equal the daily-count sum');
  }
  assertNonNegativeInteger(contributions.restrictedContributionsCount, 'restrictedContributionsCount');
  if (typeof contributions.hasAnyRestrictedContributions !== 'boolean') {
    throw new TypeError('hasAnyRestrictedContributions must be boolean');
  }
  const levels = deriveActivityLevels(counts);
  return deepFreeze({
    definition: 'github.graphql-contribution-calendar.past-year',
    source: 'github.graphql.contributionCalendar',
    visibility: {
      basis: 'github-api-visible',
      restrictedPolicy: 'include-when-profile-enabled',
      hasRestrictedContributions: contributions.hasAnyRestrictedContributions,
      restrictedContributionsCount: contributions.restrictedContributionsCount,
    },
    period: { ...effectivePeriod, timezone: 'UTC', inclusion: 'both' },
    totalContributions,
    ...deriveConsistency(counts),
    activityLevelRule: METRIC_ACTIVITY_LEVEL_RULE,
    daily: ordered.map((day, index) => ({ ...day, level: levels[index] })),
  });
}

export function normalizeScalarDataset({ id, value }) {
  const contract = SCALAR_DATASETS[id];
  if (!contract) throw new TypeError(`unsupported scalar dataset: ${id}`);
  assertNonNegativeInteger(value, id);
  return deepFreeze({ value, ...contract });
}

export function normalizeMetricSnapshot({ username, asOfDate, datasets, requiredDatasetIds }) {
  if (typeof username !== 'string' || username.length === 0) throw new TypeError('username is required');
  assertValidDate(asOfDate, 'asOfDate');
  if (!Array.isArray(requiredDatasetIds) || requiredDatasetIds.length === 0
    || new Set(requiredDatasetIds).size !== requiredDatasetIds.length) {
    throw new TypeError('requiredDatasetIds must be a non-empty unique array');
  }
  if (!datasets || typeof datasets !== 'object' || Array.isArray(datasets)) {
    throw new TypeError('datasets must be an object');
  }
  const actual = Object.keys(datasets).sort();
  const expected = [...requiredDatasetIds].sort();
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    throw new TypeError('dataset keys must exactly match required dataset IDs');
  }
  if (datasets.contributions?.period?.toDate !== undefined
    && datasets.contributions.period.toDate !== asOfDate) {
    throw new TypeError('contribution period must end on the snapshot as-of date');
  }
  const orderedDatasets = Object.fromEntries(requiredDatasetIds.map((id) => {
    if (!datasets[id] || typeof datasets[id] !== 'object') {
      throw new TypeError(`dataset ${id} must be a normalized object`);
    }
    return [id, datasets[id]];
  }));
  return deepFreeze({ account: { login: username }, asOfDate, datasets: orderedDatasets });
}
