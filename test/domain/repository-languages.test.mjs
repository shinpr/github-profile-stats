import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLanguageDisplayGroups,
  normalizeRepositoryLanguagesDataset,
} from '../../src/domain/repository-languages.mjs';

test('should aggregate exact names, remove zero totals, and sort deterministically', () => {
  const result = normalizeRepositoryLanguagesDataset({
    asOfDate: '2026-07-22',
    includedRepositoryCount: 4,
    languageEntries: [
      { name: 'Zig', bytes: 8 },
      { name: 'ada', bytes: 8 },
      { name: 'Ada', bytes: 8 },
      { name: 'Zig', bytes: 2 },
      { name: 'Empty', bytes: 0 },
    ],
  });

  assert.equal(result.totalBytes, 26);
  assert.deepEqual(result.languages, [
    { name: 'Zig', bytes: 10 },
    { name: 'Ada', bytes: 8 },
    { name: 'ada', bytes: 8 },
  ]);
});

test('should preserve a valid empty aggregate', () => {
  const result = normalizeRepositoryLanguagesDataset({
    asOfDate: '2026-07-22',
    includedRepositoryCount: 2,
    languageEntries: [{ name: 'Unknown', bytes: 0 }],
  });
  assert.equal(result.totalBytes, 0);
  assert.deepEqual(result.languages, []);
});

test('should form top four plus Other and allocate whole percentages by largest remainder', () => {
  const view = buildLanguageDisplayGroups({
    totalBytes: 13,
    languages: [
      { name: 'A', bytes: 3 },
      { name: 'B', bytes: 3 },
      { name: 'C', bytes: 2 },
      { name: 'D', bytes: 2 },
      { name: 'E', bytes: 2 },
      { name: 'F', bytes: 1 },
    ],
  });
  assert.deepEqual(view, [
    { name: 'A', bytes: 3, percentageLabel: '23%', exactPercentageLabel: '23.08%' },
    { name: 'B', bytes: 3, percentageLabel: '23%', exactPercentageLabel: '23.08%' },
    { name: 'C', bytes: 2, percentageLabel: '16%', exactPercentageLabel: '15.38%' },
    { name: 'D', bytes: 2, percentageLabel: '15%', exactPercentageLabel: '15.38%' },
    { name: 'Other', bytes: 3, percentageLabel: '23%', exactPercentageLabel: '23.08%' },
  ]);
});

test('should display fewer than four languages without an Other group', () => {
  assert.deepEqual(buildLanguageDisplayGroups({
    totalBytes: 4,
    languages: [{ name: 'Go', bytes: 4 }],
  }), [{ name: 'Go', bytes: 4, percentageLabel: '100%', exactPercentageLabel: '100.00%' }]);
});

test('should label a share that rounds to zero as under one percent', () => {
  assert.deepEqual(buildLanguageDisplayGroups({
    totalBytes: 1000,
    languages: [
      { name: 'TypeScript', bytes: 500 },
      { name: 'Go', bytes: 496 },
      { name: 'Shell', bytes: 4 },
    ],
  }), [
    { name: 'TypeScript', bytes: 500, percentageLabel: '50%', exactPercentageLabel: '50.00%' },
    { name: 'Go', bytes: 496, percentageLabel: '50%', exactPercentageLabel: '49.60%' },
    { name: 'Shell', bytes: 4, percentageLabel: '<1%', exactPercentageLabel: '0.40%' },
  ]);
});

test('should label a share that rounds to all beside another language as over ninety-nine percent', () => {
  assert.deepEqual(buildLanguageDisplayGroups({
    totalBytes: 1000,
    languages: [
      { name: 'TypeScript', bytes: 997 },
      { name: 'Shell', bytes: 3 },
    ],
  }), [
    { name: 'TypeScript', bytes: 997, percentageLabel: '>99%', exactPercentageLabel: '99.70%' },
    { name: 'Shell', bytes: 3, percentageLabel: '<1%', exactPercentageLabel: '0.30%' },
  ]);
});

test('should round exact shares half up to two decimals without reading 0.00% or 100.00%', () => {
  assert.deepEqual(buildLanguageDisplayGroups({
    totalBytes: 1000000,
    languages: [
      { name: 'TypeScript', bytes: 999945 },
      { name: 'Go', bytes: 50 },
      { name: 'Shell', bytes: 5 },
    ],
  }).map(({ name, exactPercentageLabel }) => ({ name, exactPercentageLabel })), [
    { name: 'TypeScript', exactPercentageLabel: '99.99%' },
    { name: 'Go', exactPercentageLabel: '0.01%' },
    { name: 'Shell', exactPercentageLabel: '<0.01%' },
  ]);
  assert.deepEqual(buildLanguageDisplayGroups({
    totalBytes: 1000000,
    languages: [
      { name: 'TypeScript', bytes: 999950 },
      { name: 'Shell', bytes: 50 },
    ],
  }).map(({ exactPercentageLabel }) => exactPercentageLabel), ['>99.99%', '0.01%']);
});

test('should reject display groups whose bytes do not equal the declared total', () => {
  assert.throws(() => buildLanguageDisplayGroups({
    totalBytes: 5,
    languages: [{ name: 'Go', bytes: 4 }],
  }), /must equal totalBytes/);
});
