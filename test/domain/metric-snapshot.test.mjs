import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveActivityLevels,
  normalizeContributionsDataset,
  normalizeMetricSnapshot,
  normalizeScalarDataset,
} from '../../src/domain/snapshot.mjs';
import { makeCollectorResults } from '../helpers/fixtures.mjs';

function makeDatasets({ asOfDate = '2026-07-20' } = {}) {
  const collected = makeCollectorResults();
  return {
    contributions: normalizeContributionsDataset({
      asOfDate,
      contributions: collected.contributions,
    }),
    totalStars: normalizeScalarDataset({ id: 'totalStars', value: collected.totalStars }),
    authoredPullRequests: normalizeScalarDataset({
      id: 'authoredPullRequests',
      value: collected.authoredPullRequests,
    }),
    authoredIssues: normalizeScalarDataset({ id: 'authoredIssues', value: collected.authoredIssues }),
  };
}

test('should assign deterministic quartile levels including zero and ties', () => {
  assert.deepEqual(deriveActivityLevels([0, 1, 1, 2, 3, 4, 100]), [0, 1, 1, 2, 3, 3, 4]);
  assert.deepEqual(deriveActivityLevels([0, 5, 5, 5]), [0, 1, 1, 1]);
});

test('should normalize exact datasets and derive contribution consistency metrics', () => {
  const datasets = makeDatasets();
  const snapshot = normalizeMetricSnapshot({
    username: 'shinpr',
    asOfDate: '2026-07-20',
    datasets,
    requiredDatasetIds: ['contributions', 'totalStars', 'authoredPullRequests', 'authoredIssues'],
  });

  assert.deepEqual(Object.keys(snapshot.datasets), [
    'contributions',
    'totalStars',
    'authoredPullRequests',
    'authoredIssues',
  ]);
  assert.equal(snapshot.datasets.contributions.period.toDate, '2026-07-20');
  assert.equal(snapshot.datasets.contributions.activeDays, 319);
  assert.equal(snapshot.datasets.contributions.currentStreak, 4);
  assert.equal(snapshot.datasets.contributions.longestStreak, 7);
  assert.equal(snapshot.datasets.contributions.totalContributions, 1270);
  assert.equal(snapshot.datasets.totalStars.definition, 'github.owned-public-repository-stars');
  assert.deepEqual(Object.keys(snapshot), ['account', 'asOfDate', 'datasets']);
  assert.ok(Object.isFrozen(snapshot.datasets.contributions.daily[0]));
});

test('should derive zero, suffix, internal, and full-range streaks', () => {
  const cases = [
    { counts: [0, 0, 0, 0], active: 0, current: 0, longest: 0 },
    { counts: [1, 1, 0, 2], active: 3, current: 1, longest: 2 },
    { counts: [0, 1, 1, 0], active: 2, current: 0, longest: 2 },
    { counts: [1, 1, 1, 1], active: 4, current: 4, longest: 4 },
  ];

  for (const expected of cases) {
    const metrics = normalizeContributionsDataset({
      asOfDate: '2026-07-20',
      contributions: {
        daily: expected.counts.map((contributionCount, index) => ({
          date: `2026-07-${String(17 + index).padStart(2, '0')}`,
          contributionCount,
        })),
        totalContributions: expected.counts.reduce((sum, count) => sum + count, 0),
        hasAnyRestrictedContributions: false,
        restrictedContributionsCount: 0,
      },
      period: { fromDate: '2026-07-17', toDate: '2026-07-20', days: 4 },
    });
    assert.deepEqual(
      { active: metrics.activeDays, current: metrics.currentStreak, longest: metrics.longestStreak },
      { active: expected.active, current: expected.current, longest: expected.longest },
    );
  }
});

test('should reject a dataset set that does not exactly match the requested set', () => {
  const datasets = makeDatasets();
  assert.throws(
    () => normalizeMetricSnapshot({
      username: 'shinpr',
      asOfDate: '2026-07-20',
      datasets,
      requiredDatasetIds: ['contributions'],
    }),
    /dataset keys must exactly match required dataset IDs/,
  );
});

test('should reject contributions that end after the snapshot as-of date', () => {
  const datasets = makeDatasets();
  assert.throws(
    () => normalizeMetricSnapshot({
      username: 'shinpr',
      asOfDate: '2026-07-21',
      datasets: { contributions: datasets.contributions },
      requiredDatasetIds: ['contributions'],
    }),
    /contribution period must end on the snapshot as-of date/,
  );
});
