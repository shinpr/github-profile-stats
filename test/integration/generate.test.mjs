import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { generateProfileStats } from '../../src/generate.mjs';
import { makeContributionPayload } from '../helpers/fixtures.mjs';

function createGitHubFetch() {
  return async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/graphql') {
      const { variables } = JSON.parse(init.body);
      return Response.json(makeContributionPayload({
        fromDate: variables.from.slice(0, 10),
        toDate: variables.to.slice(0, 10),
        countForDate: () => 2,
      }));
    }
    if (url.pathname === '/users/shinpr/repos') {
      return Response.json([{ stargazers_count: 8 }, { stargazers_count: 13 }]);
    }
    if (url.pathname === '/search/issues') {
      const totalCount = url.searchParams.get('q').includes('type:pr') ? 12 : 5;
      return Response.json({ total_count: totalCount, incomplete_results: false });
    }
    throw new Error(`Unexpected test URL: ${url}`);
  };
}

test('should generate and expose the complete two-layout, two-color-scheme artifact set', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-generate-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));

  const result = await generateProfileStats({
    username: 'shinpr',
    token: 'test-token',
    theme: 'signal-field',
    asOfDate: '2026-07-20',
    tempRoot,
    fetchImpl: createGitHubFetch(),
    sleep: async () => {},
  });

  assert.deepEqual(await readdir(result.readyDir), [
    'signal-field-compact-dark.svg',
    'signal-field-compact-light.svg',
    'signal-field-wide-dark.svg',
    'signal-field-wide-light.svg',
  ]);
  const light = await readFile(join(result.readyDir, 'signal-field-wide-light.svg'), 'utf8');
  const compact = await readFile(join(result.readyDir, 'signal-field-compact-light.svg'), 'utf8');
  assert.match(light, />730<\/text>/);
  assert.match(light, />21<\/text>/);
  assert.match(light, />12<\/text>/);
  assert.match(light, />5<\/text>/);
  assert.equal(result.snapshot.activity.length, 365);
  assert.deepEqual(
    light.match(/data-date="[^"]+"/g),
    compact.match(/data-date="[^"]+"/g),
  );
});

test('should reject an unregistered visual theme before acquisition', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-unknown-theme-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));

  await assert.rejects(
    generateProfileStats({
      username: 'shinpr',
      token: 'test-token',
      theme: 'unregistered',
      asOfDate: '2026-07-20',
      tempRoot,
      fetchImpl: async () => assert.fail('acquisition must not run'),
    }),
    /unsupported visual theme: unregistered/,
  );
  assert.deepEqual(await readdir(tempRoot), []);
});

test('should fail before creating a ready directory when a collector fails', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-generate-failure-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/graphql') {
      const { variables } = JSON.parse(init.body);
      return Response.json(makeContributionPayload({
        fromDate: variables.from.slice(0, 10),
        toDate: variables.to.slice(0, 10),
      }));
    }
    if (url.pathname.includes('/repos')) return Response.json([]);
    return Response.json({ total_count: 1, incomplete_results: true });
  };

  await assert.rejects(
    generateProfileStats({
      username: 'shinpr',
      token: 'test-token',
      asOfDate: '2026-07-20',
      tempRoot,
      fetchImpl,
      sleep: async () => {},
    }),
    /incomplete search result/,
  );
  assert.deepEqual(await readdir(tempRoot), []);
});

test('should capture the default UTC contribution period end from the injected clock once', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-default-date-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const timestamp = Date.parse('2025-01-01T23:59:59Z');

  const result = await generateProfileStats({
    username: 'shinpr',
    token: 'test-token',
    tempRoot,
    fetchImpl: createGitHubFetch(),
    sleep: async () => {},
    now: () => timestamp,
  });

  assert.equal(result.snapshot.period.toDate, '2025-01-01');
  assert.equal(result.snapshot.period.fromDate, '2024-01-02');
});
