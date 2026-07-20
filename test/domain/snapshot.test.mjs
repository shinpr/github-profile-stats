import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveActivityLevels, normalizeSnapshot } from '../../src/domain/snapshot.mjs';
import { makeCollectorResults } from '../helpers/fixtures.mjs';

test('should assign deterministic quartile levels including zero and ties', () => {
  const levels = deriveActivityLevels([0, 1, 1, 2, 3, 4, 100]);

  assert.deepEqual(levels, [0, 1, 1, 2, 3, 3, 4]);
});

test('should keep identical positive counts in the lowest positive level', () => {
  assert.deepEqual(deriveActivityLevels([0, 5, 5, 5]), [0, 1, 1, 1]);
});

test('should normalize and deeply freeze a 365-day past-year snapshot', () => {
  const snapshot = normalizeSnapshot({
    username: 'shinpr',
    asOfDate: '2026-07-20',
    ...makeCollectorResults(),
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(snapshot.period, {
    fromDate: '2025-07-21',
    toDate: '2026-07-20',
    days: 365,
    timezone: 'UTC',
    inclusion: 'both',
  });
  assert.equal(snapshot.metrics.contributionsPastYear.value, 1270);
  assert.equal(snapshot.metrics.contributionsPastYear.definition, 'github.graphql-contribution-calendar.past-year.v1');
  assert.equal(
    snapshot.metrics.authoredPullRequests.definition,
    'github.rest-search.authored-public-pull-requests.all-time.v1',
  );
  assert.equal(
    snapshot.metrics.authoredIssues.definition,
    'github.rest-search.authored-public-issues.all-time.v1',
  );
  assert.equal(snapshot.activity.length, 365);
  assert.deepEqual(snapshot.activity[0], { date: '2025-07-21', count: 0, level: 0 });
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.metrics));
  assert.ok(Object.isFrozen(snapshot.activity));
  assert.ok(Object.isFrozen(snapshot.activity[0]));
});

test('should normalize a 366-day period when the past year includes leap day', () => {
  const snapshot = normalizeSnapshot({
    username: 'shinpr',
    asOfDate: '2025-02-28',
    ...makeCollectorResults({ fromDate: '2024-02-29', days: 366 }),
  });

  assert.equal(snapshot.period.fromDate, '2024-02-29');
  assert.equal(snapshot.period.days, 366);
  assert.equal(snapshot.activity.length, 366);
});

test('should reject a missing contribution date before rendering', () => {
  const results = makeCollectorResults();
  results.contributions.daily.splice(17, 1);

  assert.throws(
    () => normalizeSnapshot({ username: 'shinpr', asOfDate: '2026-07-20', ...results }),
    /exactly 365 contribution days/,
  );
});

test('should reject an invalid calendar date', () => {
  assert.throws(
    () => normalizeSnapshot({ username: 'shinpr', asOfDate: '2026-02-30', ...makeCollectorResults() }),
    /valid YYYY-MM-DD/,
  );
});
