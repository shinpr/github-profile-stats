import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMetricSnapshot } from '../../src/domain/snapshot.mjs';
import { normalizeRepositoryLanguagesDataset } from '../../src/domain/repository-languages.mjs';
import { renderLanguageComposition } from '../../src/render/language-composition.mjs';
import { validateLanguageCompositionSvg, validateSvg } from '../../src/render/validate-svg.mjs';

function makeSnapshot(languageEntries = [
  { name: 'TypeScript', bytes: 42 },
  { name: 'Go', bytes: 24 },
  { name: 'Python', bytes: 16 },
  { name: 'Astro', bytes: 10 },
  { name: 'Shell', bytes: 5 },
  { name: 'HTML', bytes: 3 },
], includedRepositoryCount = 27) {
  const repositoryLanguages = normalizeRepositoryLanguagesDataset({
    asOfDate: '2026-07-22',
    includedRepositoryCount,
    languageEntries,
  });
  return normalizeMetricSnapshot({
    username: 'shinpr',
    asOfDate: '2026-07-22',
    datasets: { repositoryLanguages },
    requiredDatasetIds: ['repositoryLanguages'],
  });
}

test('should render a composition rail and rank-matched labelled rows', () => {
  const svg = renderLanguageComposition({
    snapshot: makeSnapshot(),
    layout: 'wide',
    colorScheme: 'light',
  });

  assert.match(svg, /data-format="language-composition"/);
  assert.match(svg, />LANGUAGE<\/text>.*>COMPOSITION<\/text>/s);
  assert.match(svg, />TypeScript<\/text>.*>42%<\/text>/s);
  assert.match(svg, />Other<\/text>.*>8%<\/text>/s);
  assert.match(svg, />GITHUB-REPORTED BYTES · 27 OWNED PUBLIC NON-FORK REPOS<\/text>/);
  assert.match(svg, /<desc[^>]*>GitHub-reported language bytes across 27 owned public non-fork repositories as of /);
  assert.match(svg, />shinpr · AS OF 2026-07-22<\/text>/);
  for (let rank = 1; rank <= 5; rank += 1) {
    const railColor = svg.match(new RegExp(`data-rail-rank="${rank}"[^>]+fill="([^"]+)"`))?.[1];
    const rowColor = svg.match(new RegExp(`data-row-rank="${rank}"[^>]+fill="([^"]+)"`))?.[1];
    assert.ok(railColor);
    assert.equal(rowColor, railColor);
  }
  const railSegments = [...svg.matchAll(/<rect data-rail-rank="\d+" x="([^"]+)" y="[^"]+" width="([^"]+)"[^>]+shape-rendering="crispEdges"/g)]
    .map(([, x, width]) => ({ x: Number(x), width: Number(width) }));
  assert.equal(railSegments.length, 5);
  for (let index = 1; index < railSegments.length; index += 1) {
    assert.equal(
      railSegments[index - 1].x + railSegments[index - 1].width,
      railSegments[index].x,
    );
  }
  validateSvg({ svg, layout: 'wide' });
  validateLanguageCompositionSvg({ svg, colorScheme: 'light' });
});

test('should use a readable two-line title and preserve exact language casing in compact', () => {
  const svg = renderLanguageComposition({
    snapshot: makeSnapshot([{ name: 'Objective-C++', bytes: 1 }], 1),
    layout: 'compact',
    colorScheme: 'dark',
  });
  assert.match(svg, />LANGUAGE<\/text>.*>COMPOSITION<\/text>/s);
  assert.match(svg, />Objective-C\+\+<\/text>/);
  assert.match(svg, />100%<\/text>/);
  assert.match(svg, />GITHUB-REPORTED BYTES · 1 OWNED PUBLIC NON-FORK REPO<\/text>/);
  assert.match(svg, /<desc[^>]*>GitHub-reported language bytes across 1 owned public non-fork repository as of 2026-07-22: Objective-C\+\+ 100%\.<\/desc>/);
  assert.doesNotMatch(svg, />OBJECTIVE-C/);
  validateSvg({ svg, layout: 'compact' });
  validateLanguageCompositionSvg({ svg, colorScheme: 'dark' });
});

test('should render the valid empty state without rail, rows, or percentages', () => {
  const svg = renderLanguageComposition({
    snapshot: makeSnapshot([], 8),
    layout: 'compact',
    colorScheme: 'light',
  });
  assert.match(svg, />NO GITHUB-REPORTED LANGUAGE BYTES<\/text>/);
  assert.match(svg, />GITHUB-REPORTED BYTES · 8 OWNED PUBLIC NON-FORK REPOS<\/text>/);
  assert.match(svg, /<desc[^>]*>No GitHub-reported language bytes across 8 owned public non-fork repositories as of 2026-07-22\.<\/desc>/);
  assert.doesNotMatch(svg, /data-rail-rank|data-row-rank|%<\/text>/);
  validateLanguageCompositionSvg({ svg, colorScheme: 'light' });
});

test('should use singular repository wording when one repository reports no language bytes', () => {
  const svg = renderLanguageComposition({
    snapshot: makeSnapshot([], 1),
    layout: 'wide',
    colorScheme: 'light',
  });
  assert.match(svg, />GITHUB-REPORTED BYTES · 1 OWNED PUBLIC NON-FORK REPO<\/text>/);
  assert.match(svg, /<desc[^>]*>No GitHub-reported language bytes across 1 owned public non-fork repository as of 2026-07-22\.<\/desc>/);
});

test('should retain full long names in the description while visibly truncating the row', () => {
  const fullName = 'AQuiteUnusuallyLongProgrammingLanguageName';
  const svg = renderLanguageComposition({
    snapshot: makeSnapshot([{ name: fullName, bytes: 10 }]),
    layout: 'wide',
    colorScheme: 'dark',
  });
  assert.match(svg, new RegExp(`<desc[^>]*>[^<]*${fullName} 100%`));
  assert.match(svg, />AQuiteUnusuallyLong…<\/text>/);
});

test('should word edge shares as <1% and >99% on the card and in its description', () => {
  const svg = renderLanguageComposition({
    snapshot: makeSnapshot([
      { name: 'TypeScript', bytes: 997 },
      { name: 'Shell', bytes: 3 },
    ]),
    layout: 'wide',
    colorScheme: 'light',
  });
  assert.match(svg, />TypeScript<\/text>.*>&gt;99%<\/text>.*>Shell<\/text>.*>&lt;1%<\/text>/s);
  assert.match(svg, /<desc[^>]*>[^<]*TypeScript &gt;99%, Shell &lt;1%\./);
  assert.doesNotMatch(svg, />(0|100)%<\/text>/);
  validateSvg({ svg, layout: 'wide' });
  validateLanguageCompositionSvg({ svg, colorScheme: 'light' });
});

test('should give each row bar a hover title with its exact percentage', () => {
  const svg = renderLanguageComposition({
    snapshot: makeSnapshot([
      { name: 'TypeScript', bytes: 997 },
      { name: 'C<+>', bytes: 3 },
    ]),
    layout: 'compact',
    colorScheme: 'dark',
  });
  const barTitles = [...svg.matchAll(/<g><title>([^<]+)<\/title><rect[^>]*\/><rect data-row-rank="(\d)"[^>]*\/><\/g>/g)]
    .map(([, title, rank]) => ({ rank, title }));
  assert.deepEqual(barTitles, [
    { rank: '1', title: 'TypeScript 99.70%' },
    { rank: '2', title: 'C&lt;+&gt; 0.30%' },
  ]);
  validateSvg({ svg, layout: 'compact' });
  validateLanguageCompositionSvg({ svg, colorScheme: 'dark' });
});
