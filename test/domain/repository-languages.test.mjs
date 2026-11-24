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
    { name: 'A', bytes: 3, percentageLabel: '23%' },
    { name: 'B', bytes: 3, percentageLabel: '23%' },
    { name: 'C', bytes: 2, percentageLabel: '16%' },
    { name: 'D', bytes: 2, percentageLabel: '15%' },
    { name: 'Other', bytes: 3, percentageLabel: '23%' },
  ]);
});

test('should display fewer than four languages without an Other group', () => {
  assert.deepEqual(buildLanguageDisplayGroups({
    totalBytes: 4,
    languages: [{ name: 'Go', bytes: 4 }],
  }), [{ name: 'Go', bytes: 4, percentageLabel: '100%' }]);
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
    { name: 'TypeScript', bytes: 500, percentageLabel: '50%' },
    { name: 'Go', bytes: 496, percentageLabel: '50%' },
    { name: 'Shell', bytes: 4, percentageLabel: '<1%' },
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
    { name: 'TypeScript', bytes: 997, percentageLabel: '>99%' },
    { name: 'Shell', bytes: 3, percentageLabel: '<1%' },
  ]);
});

test('should reject display groups whose bytes do not equal the declared total', () => {
  assert.throws(() => buildLanguageDisplayGroups({
    totalBytes: 5,
    languages: [{ name: 'Go', bytes: 4 }],
  }), /must equal totalBytes/);
});
