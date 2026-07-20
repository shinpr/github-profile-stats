import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSnapshot } from '../../src/domain/snapshot.mjs';
import { renderSignalField } from '../../src/render/signal-field.mjs';
import { COLOR_SCHEME_TOKENS, contrastRatio } from '../../src/render/tokens.mjs';
import { validateSvg } from '../../src/render/validate-svg.mjs';
import { makeCollectorResults } from '../helpers/fixtures.mjs';

function makeSnapshot({ username = 'shinpr', leap = false } = {}) {
  return normalizeSnapshot({
    username,
    asOfDate: leap ? '2025-02-28' : '2026-07-20',
    ...makeCollectorResults(leap ? { fromDate: '2024-02-29', days: 366 } : {}),
  });
}

test('should render the complete past year in the selected wide composition', () => {
  const svg = renderSignalField({ snapshot: makeSnapshot(), colorScheme: 'light', layout: 'wide' });

  assert.match(svg, /viewBox="0 0 640 360"/);
  assert.match(svg, /aria-labelledby="title-wide-light desc-wide-light"/);
  assert.match(svg, /<title id="title-wide-light">shinpr GitHub activity summary · wide<\/title>/);
  assert.match(svg, /<desc id="desc-wide-light">/);
  assert.match(svg, /1,270 contributions in the past year/);
  assert.match(svg, />shinpr · GITHUB ACTIVITY<\/text>/);
  assert.match(svg, />CONTRIBUTIONS · PAST YEAR<\/text>/);
  assert.match(svg, />DAILY ACTIVITY · PAST YEAR<\/text>/);
  assert.match(svg, />CONTRIBUTIONS THROUGH · JUL 20, 2026<\/text>/);
  assert.equal(svg.match(/data-date="\d{4}-\d{2}-\d{2}"/g)?.length, 365);
  assert.equal(Buffer.byteLength(svg), validateSvg({ svg, colorScheme: 'light', layout: 'wide' }).bytes);
});

test('should render the same daily series as two explicit compact bands', () => {
  const svg = renderSignalField({ snapshot: makeSnapshot(), colorScheme: 'dark', layout: 'compact' });

  assert.match(svg, /viewBox="0 0 320 528"/);
  assert.match(svg, />shinpr<\/text>/);
  assert.match(svg, />GITHUB ACTIVITY<\/text>/);
  assert.match(svg, />JUL 21, 2025<\/text>/);
  assert.match(svg, />JUL 20, 2026<\/text>/);
  assert.match(svg, /<path d="M106 50h108"/);
  assert.match(svg, />JUL 21 — JAN 24<\/text>/);
  assert.match(svg, />JAN 25 — JUL 20<\/text>/);
  assert.match(svg, />DAILY ACTIVITY<\/text>/);
  assert.match(svg, /<rect x="218" y="260" width="7" height="7"/);
  assert.match(svg, /<text x="298" y="267"[^>]*text-anchor="end">MORE<\/text>/);
  assert.match(svg, /<rect x="150" y="141" width="20" height="2" fill="#F9786A"\/>/);
  assert.match(svg, /<text x="160" y="160"[^>]*text-anchor="middle">CONTRIBUTIONS · PAST YEAR<\/text>/);
  assert.match(svg, /<text x="160" y="512"[^>]*>GITHUB GRAPHQL CONTRIBUTION CALENDAR<\/text>/);
  assert.match(svg, />GITHUB GRAPHQL CONTRIBUTION CALENDAR<\/text>/);
  assert.equal(svg.match(/data-date="\d{4}-\d{2}-\d{2}"/g)?.length, 365);
  assert.equal(svg.match(/data-band="1"/g)?.length, 188);
  assert.equal(svg.match(/data-band="2"/g)?.length, 177);
  assert.equal(Buffer.byteLength(svg), validateSvg({ svg, colorScheme: 'dark', layout: 'compact' }).bytes);
});

test('should preserve all 366 days while ending the first compact band on Saturday', () => {
  const svg = renderSignalField({ snapshot: makeSnapshot({ leap: true }), colorScheme: 'light', layout: 'compact' });

  assert.equal(svg.match(/data-date=/g)?.length, 366);
  assert.equal(svg.match(/data-band="1"/g)?.length, 185);
  assert.equal(svg.match(/data-band="2"/g)?.length, 181);
});

test('should keep semantic content equal across layouts and color schemes', () => {
  const snapshot = makeSnapshot();
  const artifacts = [
    renderSignalField({ snapshot, colorScheme: 'light', layout: 'wide' }),
    renderSignalField({ snapshot, colorScheme: 'dark', layout: 'wide' }),
    renderSignalField({ snapshot, colorScheme: 'light', layout: 'compact' }),
    renderSignalField({ snapshot, colorScheme: 'dark', layout: 'compact' }),
  ];

  for (const svg of artifacts) {
    assert.equal(svg.match(/data-date=/g)?.length, 365);
    assert.equal(svg.match(/>1,270<\/text>/g)?.length, 1);
    assert.match(svg, />1,645<\/text>/);
    assert.match(svg, />1,196<\/text>/);
    assert.match(svg, />39<\/text>/);
  }
});

test('should escape account text and produce byte-deterministic output', () => {
  const snapshot = makeSnapshot({ username: 'a&b' });
  const input = { snapshot, colorScheme: 'dark', layout: 'compact' };

  const first = renderSignalField(input);
  assert.equal(first, renderSignalField(input));
  assert.match(first, /a&amp;b/i);
  assert.doesNotMatch(first, /a&b/i);
});

test('should preserve the account login casing in both layouts', () => {
  const snapshot = makeSnapshot({ username: 'ShinPR' });
  const wide = renderSignalField({ snapshot, colorScheme: 'light', layout: 'wide' });
  const compact = renderSignalField({ snapshot, colorScheme: 'light', layout: 'compact' });

  assert.match(wide, />ShinPR · GITHUB ACTIVITY<\/text>/);
  assert.match(compact, />ShinPR<\/text>/);
  assert.doesNotMatch(wide, />SHINPR · GITHUB ACTIVITY<\/text>/);
  assert.doesNotMatch(compact, />SHINPR<\/text>/);
});

test('should abbreviate a maximum-length login before the compact context label', () => {
  const username = 'a'.repeat(39);
  const compact = renderSignalField({
    snapshot: makeSnapshot({ username }),
    colorScheme: 'light',
    layout: 'compact',
  });

  assert.match(compact, new RegExp(`<title id="title-compact-light">${username} GitHub activity summary`));
  assert.match(compact, new RegExp(`>${'a'.repeat(21)}…<\\/text>`));
  assert.doesNotMatch(compact, new RegExp(`>${username}<\\/text>`));
});

test('should use color-scheme-specific rail palettes with balanced visual contrast', () => {
  assert.deepEqual(COLOR_SCHEME_TOKENS.light.rail, ['#DE4F44', '#918A21', '#1D97A3', '#906AE5']);
  assert.deepEqual(COLOR_SCHEME_TOKENS.dark.rail, ['#F9786A', '#B0A946', '#48B7C2', '#AB91F2']);
  assert.equal(COLOR_SCHEME_TOKENS.light.coral, COLOR_SCHEME_TOKENS.light.rail[0]);
  assert.equal(COLOR_SCHEME_TOKENS.dark.coral, COLOR_SCHEME_TOKENS.dark.rail[0]);

  const lightRatios = COLOR_SCHEME_TOKENS.light.rail.map((color) => contrastRatio(color, COLOR_SCHEME_TOKENS.light.surface));
  const darkRatios = COLOR_SCHEME_TOKENS.dark.rail.map((color) => contrastRatio(color, COLOR_SCHEME_TOKENS.dark.surface));
  assert.ok(Math.max(...lightRatios) - Math.min(...lightRatios) <= 0.6);
  assert.ok(Math.max(...darkRatios) - Math.min(...darkRatios) <= 1);
});

test('should keep the outer geometry square and the wide color rail full bleed', () => {
  const wide = renderSignalField({ snapshot: makeSnapshot(), colorScheme: 'light', layout: 'wide' });
  const compact = renderSignalField({ snapshot: makeSnapshot(), colorScheme: 'light', layout: 'compact' });

  assert.match(wide, /<rect width="640" height="360" fill="#FCFAF5"\/>/);
  assert.match(compact, /<rect width="320" height="528" fill="#FCFAF5"\/>/);
  assert.match(wide, /<rect x="0" y="0" width="141" height="5" fill="#DE4F44"\/>/);
  assert.doesNotMatch(compact, /<rect x="0" y="0" width="70" height="5"/);
  assert.doesNotMatch(wide, /<rect width="640" height="360"[^>]*rx=/);
  assert.doesNotMatch(compact, /<rect width="320" height="528"[^>]*rx=/);
});

test('should enforce the fixed token contrast thresholds', () => {
  for (const tokens of Object.values(COLOR_SCHEME_TOKENS)) {
    assert.ok(contrastRatio(tokens.primaryText, tokens.surface) >= 4.5);
    assert.ok(contrastRatio(tokens.secondaryText, tokens.surface) >= 4.5);
    for (const color of tokens.activity.slice(1)) {
      assert.ok(contrastRatio(color, tokens.surface) >= 3);
    }
  }
});

test('should reject active content, external references, and invalid layout metadata', () => {
  const svg = renderSignalField({ snapshot: makeSnapshot(), colorScheme: 'light', layout: 'wide' });

  assert.throws(
    () => validateSvg({ svg: svg.replace('</svg>', '<script>alert(1)</script></svg>'), colorScheme: 'light', layout: 'wide' }),
    /prohibited SVG content/,
  );
  assert.throws(
    () => validateSvg({ svg: svg.replace('</svg>', '<image href="https:\/\/example.com\/x.png"/></svg>'), colorScheme: 'light', layout: 'wide' }),
    /external reference/,
  );
  assert.throws(
    () => validateSvg({ svg, colorScheme: 'light', layout: 'other' }),
    /unsupported layout/,
  );
});

test('should reject an incorrect geometry, date count, or accessible metadata', () => {
  const svg = renderSignalField({ snapshot: makeSnapshot(), colorScheme: 'light', layout: 'compact' });

  assert.throws(
    () => validateSvg({ svg: svg.replace('0 0 320 528', '0 0 320 360'), colorScheme: 'light', layout: 'compact' }),
    /viewBox 0 0 320 528/,
  );
  assert.throws(
    () => validateSvg({ svg: svg.replace(/<title\b.*?<\/title>/, ''), colorScheme: 'light', layout: 'compact' }),
    /non-empty title and description/,
  );
  assert.throws(
    () => validateSvg({
      svg: svg.replace('aria-labelledby="title-compact-light desc-compact-light"', 'aria-labelledby="missing desc-compact-light"'),
      colorScheme: 'light',
      layout: 'compact',
    }),
    /aria-labelledby must reference the title and description IDs/,
  );
  assert.throws(
    () => validateSvg({ svg: svg.replace(/<rect[^>]+data-date[^>]+\/>/, ''), colorScheme: 'light', layout: 'compact' }),
    /activity dates must match the declared period/,
  );
});

test('should reject an artifact above the fixed size bound', () => {
  const svg = renderSignalField({ snapshot: makeSnapshot(), colorScheme: 'dark', layout: 'wide' });
  const oversized = svg.replace('</svg>\n', `${' '.repeat(150 * 1024)}</svg>\n`);

  assert.throws(
    () => validateSvg({ svg: oversized, colorScheme: 'dark', layout: 'wide' }),
    /exceeds 153600 bytes/,
  );
});
