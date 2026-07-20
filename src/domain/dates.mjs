const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidDate(value, label = 'date') {
  if (!DATE_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a valid YYYY-MM-DD UTC date`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${label} must be a valid YYYY-MM-DD UTC date`);
  }
  return value;
}

export function addUtcDays(date, days) {
  assertValidDate(date);
  if (!Number.isInteger(days)) throw new TypeError('days must be an integer');
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function inclusiveDayCount(fromDate, toDate) {
  assertValidDate(fromDate, 'fromDate');
  assertValidDate(toDate, 'toDate');
  const count = (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS + 1;
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('fromDate must not be after toDate');
  }
  return count;
}

export function listUtcDates(fromDate, toDate) {
  const count = inclusiveDayCount(fromDate, toDate);
  return Array.from({ length: count }, (_, index) => addUtcDays(fromDate, index));
}

export function pastYearDateRange(asOfDate) {
  assertValidDate(asOfDate, 'asOfDate');
  const [year, month, day] = asOfDate.split('-').map(Number);
  const sameDatePreviousYear = `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const anniversary = DATE_PATTERN.test(sameDatePreviousYear)
    && new Date(`${sameDatePreviousYear}T00:00:00Z`).toISOString().slice(0, 10) === sameDatePreviousYear
    ? sameDatePreviousYear
    : `${year - 1}-02-28`;
  const fromDate = addUtcDays(anniversary, 1);
  return Object.freeze({
    fromDate,
    toDate: asOfDate,
    days: inclusiveDayCount(fromDate, asOfDate),
  });
}

export function partitionDateRange({ fromDate, toDate, maximumDays }) {
  const totalDays = inclusiveDayCount(fromDate, toDate);
  if (!Number.isInteger(maximumDays) || maximumDays < 1) {
    throw new RangeError('maximumDays must be a positive integer');
  }
  const windows = [];
  for (let offset = 0; offset < totalDays; offset += maximumDays) {
    windows.push({
      fromDate: addUtcDays(fromDate, offset),
      toDate: addUtcDays(fromDate, Math.min(offset + maximumDays - 1, totalDays - 1)),
    });
  }
  return windows;
}

export function splitDateRange({ fromDate, toDate }) {
  const days = inclusiveDayCount(fromDate, toDate);
  if (days < 2) throw new RangeError('cannot split a single-day range');
  const leftDays = Math.ceil(days / 2);
  return [
    { fromDate, toDate: addUtcDays(fromDate, leftDays - 1) },
    { fromDate: addUtcDays(fromDate, leftDays), toDate },
  ];
}
