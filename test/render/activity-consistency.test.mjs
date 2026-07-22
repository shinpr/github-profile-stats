import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeContributionsDataset,
  normalizeMetricSnapshot,
} from '../../src/domain/snapshot.mjs';
import { renderActivityConsistency } from '../../src/render/activity-consistency.mjs';
import { validateActivityConsistencySvg, validateSvg } from '../../src/render/validate-svg.mjs';
import { makeDaily } from '../helpers/fixtures.mjs';

function makeSnapshot({
  asOfDate = '2026-07-20',
  fromDate = '2025-07-21',
  days = 365,
  countForIndex = (index) => (index % 8 === 0 ? 0 : index % 5),
} = {}) {
  const daily = makeDaily({ fromDate, days, countForIndex });
  const contributions = normalizeContributionsDataset({
    asOfDate,
    contributions: {
      daily,
      totalContributions: daily.reduce((sum, day) => sum + day.contributionCount, 0),
      hasAnyRestrictedContributions: false,
      restrictedContributionsCount: 0,
    },
  });
  return normalizeMetricSnapshot({
    username: 'shinpr',
    asOfDate,
    datasets: { contributions },
    requiredDatasetIds: ['contributions'],
  });
}

function assertSquareDailyMarks(svg, expectedCount) {
  const marks = [...svg.matchAll(/<rect\b(?=[^>]*\bdata-date=)[^>]*\bwidth="([^"]+)"[^>]*\bheight="([^"]+)"[^>]*>/g)];
  assert.equal(marks.length, expectedCount);
  for (const [, width, height] of marks) assert.equal(Number(width), Number(height));
}

function markGeometry(svg, attribute) {
  return [...svg.matchAll(new RegExp(`<rect\\b(?=[^>]*\\b${attribute}=)[^>]*\\bx="([^"]+)"[^>]*\\by="([^"]+)"[^>]*\\bwidth="([^"]+)"[^>]*\\bheight="([^"]+)"[^>]*>`, 'g'))]
    .map(([, x, y, width, height]) => ({
      x: Number(x), y: Number(y), width: Number(width), height: Number(height),
    }));
}

test('should render every daily mark as a square in both layouts', () => {
  const snapshot = makeSnapshot();
  for (const layout of ['wide', 'compact']) {
    const svg = renderActivityConsistency({ snapshot, layout, colorScheme: 'light' });
    assertSquareDailyMarks(svg, 365);
  }
});

test('should size legend marks like daily marks and keep a full spacing unit after the field', () => {
  const snapshot = makeSnapshot();
  const expectedCellSize = { wide: 9, compact: 8 };
  for (const layout of ['wide', 'compact']) {
    const svg = renderActivityConsistency({ snapshot, layout, colorScheme: 'light' });
    const dailyMarks = markGeometry(svg, 'data-date');
    const legendMarks = markGeometry(svg, 'data-legend-level');
    const fieldBottom = Math.max(...dailyMarks.map(({ y, height }) => y + height));
    const legendTop = Math.min(...legendMarks.map(({ y }) => y));
    const less = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*font-size="([^"]+)"[^>]*textLength="([^"]+)"[^>]*>LESS<\/text>/);
    const more = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*font-size="([^"]+)"[^>]*textLength="([^"]+)"[^>]*>MORE<\/text>/);

    assert.equal(legendMarks.length, 5);
    assert.deepEqual(
      [...new Set(legendMarks.map(({ width, height }) => `${width}x${height}`))],
      [`${dailyMarks[0].width}x${dailyMarks[0].height}`],
    );
    assert.equal(dailyMarks[0].width, expectedCellSize[layout]);
    assert.equal(legendTop - fieldBottom, 16);
    assert.ok(less);
    assert.ok(more);
    assert.equal(Number(less[1]), Math.min(...dailyMarks.map(({ x }) => x)));
    assert.equal(Number(less[3]), 9);
    assert.equal(legendMarks[0].x - (Number(less[1]) + Number(less[4])), 10);
    const lastLegendMark = legendMarks.at(-1);
    assert.equal(Number(more[1]) - (lastLegendMark.x + lastLegendMark.width), 10);
    assert.equal(Number(more[3]), 9);
    assert.equal(Number(less[2]), legendTop + legendMarks[0].height - 1);
    assert.equal(Number(more[2]), legendTop + legendMarks[0].height - 1);

    const dailyColumns = [...new Set(dailyMarks.map(({ x }) => x))].sort((a, b) => a - b);
    const legendColumns = legendMarks.map(({ x }) => x);
    assert.ok(Math.abs(dailyColumns[1] - dailyColumns[0] - dailyMarks[0].width - 2) < 1e-9);
    assert.ok(Math.abs(legendColumns[1] - legendColumns[0] - legendMarks[0].width - 2) < 1e-9);
  }
});

test('should place dates by UTC weekday instead of restarting the final week at the top', () => {
  const svg = renderActivityConsistency({
    snapshot: makeSnapshot({
      asOfDate: '2026-07-22',
      fromDate: '2025-07-23',
    }),
    layout: 'wide',
    colorScheme: 'dark',
  });
  const mark = (date) => {
    const match = svg.match(new RegExp(`<rect x="([^"]+)" y="([^"]+)"[^>]+data-date="${date}"`));
    assert.ok(match);
    return { x: Number(match[1]), y: Number(match[2]) };
  };
  const sunday = mark('2026-07-19');
  const wednesday = mark('2026-07-22');

  assert.equal(wednesday.x, sunday.x);
  assert.equal(wednesday.y - sunday.y, 33);
});

test('should reject a non-square daily mark during format validation', () => {
  const svg = renderActivityConsistency({
    snapshot: makeSnapshot(),
    layout: 'wide',
    colorScheme: 'light',
  });
  const stretched = svg.replace(
    /(<rect x="[^"]+" y="[^"]+" )width="9"( height="9"[^>]+data-date=)/,
    '$1width="10"$2',
  );
  assert.throws(
    () => validateActivityConsistencySvg({ svg: stretched, colorScheme: 'light' }),
    /daily marks must be squares/,
  );
});

test('should render the approved wide activity hierarchy and complete daily evidence', () => {
  const svg = renderActivityConsistency({
    snapshot: makeSnapshot(),
    layout: 'wide',
    colorScheme: 'light',
  });

  assert.match(svg, /data-format="activity-consistency"/);
  assert.match(svg, />ACTIVE DAYS<\/text>/);
  assert.ok(svg.indexOf('CURRENT STREAK') < svg.indexOf('LONGEST STREAK'));
  assert.ok(svg.indexOf('LONGEST STREAK') < svg.indexOf('CONTRIBUTIONS'));
  assert.match(svg, />365 UTC DAYS · WARMTH IS AMOUNT<\/text>/);
  assert.match(svg, /font-size="8"[^>]*>365 UTC DAYS · WARMTH IS AMOUNT<\/text>/);
  assert.doesNotMatch(svg, /outline|CURRENT STREAK[^<]*=/i);
  validateSvg({ svg, layout: 'wide' });
  validateActivityConsistencySvg({ svg, colorScheme: 'light' });
});

test('should keep compact one-day and full-year values inside the same geometry', () => {
  const sparse = renderActivityConsistency({
    snapshot: makeSnapshot({ countForIndex: (index) => (index === 364 ? 7 : 0) }),
    layout: 'compact',
    colorScheme: 'dark',
  });
  const full = renderActivityConsistency({
    snapshot: makeSnapshot({ countForIndex: () => 1 }),
    layout: 'compact',
    colorScheme: 'dark',
  });

  assert.match(sparse, />1<\/text>.*>\/ 365<\/text>/s);
  assert.match(full, />365<\/text>.*>\/ 365<\/text>/s);
  assert.match(full, />365<\/text>.*>CURRENT STREAK · DAYS<\/text>/s);
  assert.match(sparse, /font-size="8"[^>]*>365 UTC DAYS · WARMTH IS AMOUNT<\/text>/);
  const contributionValue = sparse.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>7<\/text>/);
  const contributionLabel = sparse.match(/<text x="([^"]+)" y="([^"]+)" fill="([^"]+)"[^>]*>CONTRIBUTIONS · PAST YEAR<\/text>/);
  const periodLabel = sparse.match(/<text[^>]*fill="([^"]+)"[^>]*>365 UTC DAYS · WARMTH IS AMOUNT<\/text>/);
  assert.ok(contributionValue);
  assert.ok(contributionLabel);
  assert.ok(periodLabel);
  assert.equal(contributionLabel[1], contributionValue[1]);
  assert.ok(Number(contributionLabel[2]) > Number(contributionValue[2]));
  assert.equal(periodLabel[1], contributionLabel[3]);
  assert.equal((sparse.match(/data-band="1"/g)?.length ?? 0)
    + (sparse.match(/data-band="2"/g)?.length ?? 0), 365);
  validateSvg({ svg: sparse, layout: 'compact' });
  validateActivityConsistencySvg({ svg: sparse, colorScheme: 'dark' });
});

test('should split compact chronology at a Saturday-to-Sunday week boundary', () => {
  const svg = renderActivityConsistency({
    snapshot: makeSnapshot({
      asOfDate: '2025-02-28',
      fromDate: '2024-02-29',
      days: 366,
      countForIndex: () => 0,
    }),
    layout: 'compact',
    colorScheme: 'light',
  });

  const bandDates = (band) => [...svg.matchAll(new RegExp(`data-date="([^"]+)"[^>]+data-band="${band}"`, 'g'))]
    .map(([, date]) => date);
  const firstBand = bandDates(1);
  const secondBand = bandDates(2);

  assert.equal(firstBand.length + secondBand.length, 366);
  assert.equal(new Date(`${firstBand.at(-1)}T00:00:00Z`).getUTCDay(), 6);
  assert.equal(new Date(`${secondBand[0]}T00:00:00Z`).getUTCDay(), 0);
});
