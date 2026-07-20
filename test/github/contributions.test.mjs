import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { collectContributions } from '../../src/github/contributions.mjs';
import { GitHubGraphqlError } from '../../src/github/client.mjs';
import { makeContributionPayload } from '../helpers/fixtures.mjs';

const fixtureRoot = new URL('../fixtures/github/', import.meta.url);

test('should collect 364 dates through bounded initial windows', async () => {
  const requestedWindows = [];
  const client = {
    async requestGraphql({ variables }) {
      requestedWindows.push([variables.from.slice(0, 10), variables.to.slice(0, 10)]);
      return makeContributionPayload({
        fromDate: variables.from.slice(0, 10),
        toDate: variables.to.slice(0, 10),
        countForDate: () => 2,
      });
    },
  };

  const result = await collectContributions({
    client,
    username: 'shinpr',
    fromDate: '2025-07-22',
    toDate: '2026-07-20',
  });

  assert.deepEqual(requestedWindows, [
    ['2025-07-22', '2025-10-19'],
    ['2025-10-20', '2026-01-17'],
    ['2026-01-18', '2026-04-17'],
    ['2026-04-18', '2026-07-16'],
    ['2026-07-17', '2026-07-20'],
  ]);
  assert.equal(result.daily.length, 364);
  assert.equal(result.totalContributions, 728);
  assert.equal(result.restrictedContributionsCount, 364);
});

test('should split only resource-limited windows and preserve the daily result', async () => {
  let requestCount = 0;
  const client = {
    async requestGraphql({ variables }) {
      requestCount += 1;
      const fromDate = variables.from.slice(0, 10);
      const toDate = variables.to.slice(0, 10);
      const days = (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000 + 1;
      if (days > 45) {
        throw new GitHubGraphqlError('resource limit', {
          errors: [{ type: 'RESOURCE_LIMITS_EXCEEDED', path: ['user', 'contributionsCollection'] }],
        });
      }
      return makeContributionPayload({ fromDate, toDate, countForDate: () => 1 });
    },
  };

  const result = await collectContributions({
    client,
    username: 'shinpr',
    fromDate: '2025-07-22',
    toDate: '2026-07-20',
  });

  assert.equal(requestCount, 13);
  assert.equal(result.daily.length, 364);
  assert.equal(result.totalContributions, 364);
});

test('should fail instead of splitting a resource-limited seven-day window', async () => {
  const client = {
    async requestGraphql() {
      throw new GitHubGraphqlError('resource limit', {
        errors: [{ type: 'RESOURCE_LIMITS_EXCEEDED', path: ['user', 'contributionsCollection'] }],
      });
    },
  };

  await assert.rejects(
    collectContributions({
      client,
      username: 'shinpr',
      fromDate: '2026-07-14',
      toDate: '2026-07-20',
    }),
    /terminal 7-day contribution window/,
  );
});

test('should stop when contribution HTTP attempts exceed the collector budget', async () => {
  const client = {
    async requestGraphql({ beforeAttempt }) {
      beforeAttempt();
      throw new GitHubGraphqlError('resource limit', {
        errors: [{ type: 'RESOURCE_LIMITS_EXCEEDED', path: ['user', 'contributionsCollection'] }],
      });
    },
  };

  await assert.rejects(
    collectContributions({
      client,
      username: 'shinpr',
      fromDate: '2026-04-22',
      toDate: '2026-07-20',
      maxAttempts: 2,
    }),
    /exceeded 2 HTTP attempts/,
  );
});

test('should reject incomplete daily data without returning a subtotal', async () => {
  const client = {
    async requestGraphql({ variables }) {
      const payload = makeContributionPayload({
        fromDate: variables.from.slice(0, 10),
        toDate: variables.to.slice(0, 10),
      });
      payload.data.user.contributionsCollection.contributionCalendar.weeks[0].contributionDays.pop();
      return payload;
    },
  };

  await assert.rejects(
    collectContributions({
      client,
      username: 'shinpr',
      fromDate: '2026-07-17',
      toDate: '2026-07-20',
    }),
    /returned 3 days; expected 4/,
  );
});

test('should decode the saved GitHub GraphQL response structure', async () => {
  const payload = JSON.parse(await readFile(new URL('contribution-success.json', fixtureRoot), 'utf8'));
  const client = { requestGraphql: async () => payload };

  const result = await collectContributions({
    client,
    username: 'shinpr',
    fromDate: '2026-07-17',
    toDate: '2026-07-20',
  });

  assert.equal(result.daily.length, 4);
  assert.equal(result.totalContributions, 102);
  assert.equal(result.restrictedContributionsCount, 30);
});
