import { assertValidDate, listUtcDates, pastYearDateRange } from './dates.mjs';

const ACTIVITY_LEVEL_RULE = 'activity-level.nearest-rank-positive-quartiles.v1';
const CONTRIBUTION_DEFINITION = 'github.graphql-contribution-calendar.past-year.v1';

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

function metric({ value, definition, source, visibility }) {
  assertNonNegativeInteger(value, definition);
  return { value, definition, source, visibility };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function normalizeSnapshot(input) {
  const { username, asOfDate, contributions } = input;
  if (typeof username !== 'string' || username.length === 0) {
    throw new TypeError('username is required');
  }
  assertValidDate(asOfDate, 'asOfDate');
  const period = pastYearDateRange(asOfDate);
  const ordered = validateDailySeries({ daily: contributions?.daily, ...period });
  const counts = ordered.map((day) => day.count);
  const contributionTotal = counts.reduce((sum, count) => sum + count, 0);
  if (contributionTotal !== contributions.totalContributions) {
    throw new TypeError('contribution total does not equal the daily-count sum');
  }
  assertNonNegativeInteger(contributions.restrictedContributionsCount, 'restrictedContributionsCount');
  if (typeof contributions.hasAnyRestrictedContributions !== 'boolean') {
    throw new TypeError('hasAnyRestrictedContributions must be boolean');
  }
  const levels = deriveActivityLevels(counts);

  return deepFreeze({
    schemaVersion: 1,
    account: { login: username },
    period: {
      fromDate: period.fromDate,
      toDate: asOfDate,
      days: period.days,
      timezone: 'UTC',
      inclusion: 'both',
    },
    visibility: {
      basis: 'github-api-visible',
      targetLogin: username,
      restrictedPolicy: 'include-when-profile-enabled',
      hasRestrictedContributions: contributions.hasAnyRestrictedContributions,
      restrictedContributionsCount: contributions.restrictedContributionsCount,
    },
    metrics: {
      contributionsPastYear: metric({
        value: contributionTotal,
        definition: CONTRIBUTION_DEFINITION,
        source: 'github.graphql.contributionCalendar',
        visibility: 'github-api-visible',
      }),
      totalStars: metric({
        value: input.totalStars,
        definition: 'github.owned-public-repository-stars.v1',
        source: 'github.rest.user-repositories',
        visibility: 'public',
      }),
      authoredPullRequests: metric({
        value: input.authoredPullRequests,
        definition: 'github.rest-search.authored-public-pull-requests.all-time.v1',
        source: 'github.rest.search-issues',
        visibility: 'public',
      }),
      authoredIssues: metric({
        value: input.authoredIssues,
        definition: 'github.rest-search.authored-public-issues.all-time.v1',
        source: 'github.rest.search-issues',
        visibility: 'public',
      }),
    },
    activityLevelRule: ACTIVITY_LEVEL_RULE,
    activity: ordered.map((day, index) => ({ ...day, level: levels[index] })),
  });
}
