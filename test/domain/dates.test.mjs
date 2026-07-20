import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inclusiveDayCount,
  partitionDateRange,
  pastYearDateRange,
  splitDateRange,
} from '../../src/domain/dates.mjs';

test('should derive a 365-day inclusive past year', () => {
  assert.deepEqual(pastYearDateRange('2026-07-20'), {
    fromDate: '2025-07-21',
    toDate: '2026-07-20',
    days: 365,
  });
});

test('should retain leap day in a 366-day inclusive past year', () => {
  assert.deepEqual(pastYearDateRange('2025-02-28'), {
    fromDate: '2024-02-29',
    toDate: '2025-02-28',
    days: 366,
  });
});

test('should handle a leap-day as-of date', () => {
  assert.deepEqual(pastYearDateRange('2024-02-29'), {
    fromDate: '2023-03-01',
    toDate: '2024-02-29',
    days: 366,
  });
});

test('should reject an inclusive range whose start follows its end', () => {
  assert.throws(
    () => inclusiveDayCount('2026-07-21', '2026-07-20'),
    /fromDate must not be after toDate/,
  );
});

test('should partition an inclusive range without gaps or overlap', () => {
  assert.deepEqual(
    partitionDateRange({ fromDate: '2026-07-16', toDate: '2026-07-20', maximumDays: 2 }),
    [
      { fromDate: '2026-07-16', toDate: '2026-07-17' },
      { fromDate: '2026-07-18', toDate: '2026-07-19' },
      { fromDate: '2026-07-20', toDate: '2026-07-20' },
    ],
  );
  assert.throws(
    () => partitionDateRange({ fromDate: '2026-07-20', toDate: '2026-07-20', maximumDays: 0 }),
    /maximumDays must be a positive integer/,
  );
});

test('should split an odd inclusive range into adjacent halves', () => {
  assert.deepEqual(
    splitDateRange({ fromDate: '2026-07-16', toDate: '2026-07-20' }),
    [
      { fromDate: '2026-07-16', toDate: '2026-07-18' },
      { fromDate: '2026-07-19', toDate: '2026-07-20' },
    ],
  );
});

test('should reject splitting a single-day range', () => {
  assert.throws(
    () => splitDateRange({ fromDate: '2026-07-20', toDate: '2026-07-20' }),
    /cannot split a single-day range/,
  );
});
