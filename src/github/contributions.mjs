import {
  inclusiveDayCount,
  listUtcDates,
  partitionDateRange,
  splitDateRange,
} from '../domain/dates.mjs';
import { GitHubGraphqlError } from './client.mjs';

const CONTRIBUTION_QUERY = `
  query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
    viewer { login }
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        hasAnyRestrictedContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
    rateLimit { cost }
  }
`;

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isContributionResourceLimit(error) {
  return error instanceof GitHubGraphqlError && error.errors.some((item) => (
    item?.type === 'RESOURCE_LIMITS_EXCEEDED'
    && Array.isArray(item.path)
    && item.path[0] === 'user'
    && item.path[1] === 'contributionsCollection'
  ));
}

function decodeWindow(payload, window) {
  const collection = payload?.data?.user?.contributionsCollection;
  const calendar = collection?.contributionCalendar;
  const daily = calendar?.weeks?.flatMap((week) => week?.contributionDays ?? []);
  const expectedDates = listUtcDates(window.fromDate, window.toDate);
  if (!Array.isArray(daily) || daily.length !== expectedDates.length) {
    throw new TypeError(`contribution window returned ${daily?.length ?? 0} days; expected ${expectedDates.length}`);
  }
  daily.forEach((day, index) => {
    if (day?.date !== expectedDates[index] || !isNonNegativeInteger(day?.contributionCount)) {
      throw new TypeError(`invalid contribution day at ${window.fromDate} index ${index}`);
    }
  });
  const total = daily.reduce((sum, day) => sum + day.contributionCount, 0);
  if (!isNonNegativeInteger(calendar.totalContributions) || total !== calendar.totalContributions) {
    throw new TypeError(`contribution total mismatch for ${window.fromDate} through ${window.toDate}`);
  }
  if (typeof collection.hasAnyRestrictedContributions !== 'boolean'
    || !isNonNegativeInteger(collection.restrictedContributionsCount)) {
    throw new TypeError(`invalid restricted contribution evidence for ${window.fromDate}`);
  }
  return {
    daily,
    totalContributions: total,
    hasAnyRestrictedContributions: collection.hasAnyRestrictedContributions,
    restrictedContributionsCount: collection.restrictedContributionsCount,
  };
}

function createAttemptConsumer(maxAttempts) {
  let attempts = 0;
  return () => {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new RangeError(`contribution collector exceeded ${maxAttempts} HTTP attempts`);
    }
  };
}

async function collectWindow(context, window) {
  try {
    const payload = await context.client.requestGraphql({
      query: CONTRIBUTION_QUERY,
      variables: {
        login: context.username,
        from: `${window.fromDate}T00:00:00Z`,
        to: `${window.toDate}T23:59:59Z`,
      },
      beforeAttempt: context.consumeAttempt,
    });
    return [decodeWindow(payload, window)];
  } catch (error) {
    if (!isContributionResourceLimit(error)) throw error;
    const days = inclusiveDayCount(window.fromDate, window.toDate);
    if (days <= context.terminalWindowDays) {
      throw new GitHubGraphqlError(`resource limit persisted for terminal ${days}-day contribution window`, {
        errors: error.errors,
        status: error.status,
      });
    }
    const [left, right] = splitDateRange(window);
    return [
      ...await collectWindow(context, left),
      ...await collectWindow(context, right),
    ];
  }
}

function combineWindows({ results, fromDate, toDate }) {
  const daily = results.flatMap((result) => result.daily);
  const expectedDates = listUtcDates(fromDate, toDate);
  if (daily.length !== expectedDates.length
    || daily.some((day, index) => day.date !== expectedDates[index])) {
    throw new TypeError('stitched contribution windows contain a gap, overlap, or out-of-range date');
  }
  return Object.freeze({
    daily: Object.freeze(daily.map((day) => Object.freeze({ ...day }))),
    totalContributions: daily.reduce((sum, day) => sum + day.contributionCount, 0),
    hasAnyRestrictedContributions: results.some((result) => result.hasAnyRestrictedContributions),
    restrictedContributionsCount: results.reduce(
      (sum, result) => sum + result.restrictedContributionsCount,
      0,
    ),
  });
}

export async function collectContributions({
  client,
  username,
  fromDate,
  toDate,
  initialWindowDays = 90,
  terminalWindowDays = 7,
  maxAttempts = 64,
}) {
  if (!client?.requestGraphql) throw new TypeError('client.requestGraphql is required');
  if (typeof username !== 'string' || username.length === 0) throw new TypeError('username is required');
  const context = {
    client,
    username,
    terminalWindowDays,
    consumeAttempt: createAttemptConsumer(maxAttempts),
  };
  const results = [];
  for (const window of partitionDateRange({ fromDate, toDate, maximumDays: initialWindowDays })) {
    results.push(...await collectWindow(context, window));
  }
  return combineWindows({ results, fromDate, toDate });
}
