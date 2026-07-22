import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { generateProfileStats, renderArtifacts } from '../../src/generate.mjs';
import { makeContributionPayload } from '../helpers/fixtures.mjs';

function createGitHubFetch() {
  return async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/graphql') {
      const { query, variables } = JSON.parse(init.body);
      if (query.includes('RepositoryLanguages')) {
        return Response.json({
          data: {
            user: {
              repositories: {
                totalCount: 2,
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    name: 'one',
                    owner: { login: 'shinpr' },
                    languages: {
                      totalCount: 2,
                      totalSize: 100,
                      pageInfo: { hasNextPage: false, endCursor: null },
                      edges: [
                        { size: 70, node: { name: 'TypeScript' } },
                        { size: 30, node: { name: 'Go' } },
                      ],
                    },
                  },
                  {
                    name: 'empty',
                    owner: { login: 'shinpr' },
                    languages: {
                      totalCount: 0,
                      totalSize: 0,
                      pageInfo: { hasNextPage: false, endCursor: null },
                      edges: [],
                    },
                  },
                ],
              },
            },
            rateLimit: { cost: 1 },
          },
        });
      }
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

test('should identify a failed format without exposing renderer details', () => {
  assert.throws(() => renderArtifacts(
    { account: { login: 'shinpr' }, asOfDate: '2026-07-20', datasets: { privateData: {} } },
    {
      id: 'sample-format',
      requiredDatasetIds: ['privateData'],
      render() { throw new Error('secret repository name'); },
      validate() {},
    },
  ), (error) => {
    assert.equal(error.message, 'format sample-format failed');
    assert.doesNotMatch(error.message, /secret|repository|shinpr/);
    return true;
  });
});

test('should generate and expose the complete two-layout, two-color-scheme artifact set', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-generate-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));

  const result = await generateProfileStats({
    username: 'shinpr',
    token: 'test-token',
    profile: 'signal-field',
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
  assert.equal(result.snapshot.datasets.contributions.daily.length, 365);
  assert.deepEqual(
    light.match(/data-date="[^"]+"/g),
    compact.match(/data-date="[^"]+"/g),
  );
});

test('should reject an unregistered profile before acquisition', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-unknown-profile-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));

  await assert.rejects(
    generateProfileStats({
      username: 'shinpr',
      token: 'sensitive-token',
      profile: 'unregistered',
      asOfDate: '2026-07-20',
      tempRoot,
      fetchImpl: async () => assert.fail('acquisition must not run'),
    }),
    /unsupported profile: unregistered/,
  );
  assert.deepEqual(await readdir(tempRoot), []);
});

test('should generate the exact four-file Activity consistency profile in under two seconds', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-activity-consistency-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const startedAt = performance.now();
  const result = await generateProfileStats({
    username: 'shinpr',
    token: 'test-token',
    profile: 'activity-consistency',
    asOfDate: '2026-07-20',
    tempRoot,
    fetchImpl: createGitHubFetch(),
    sleep: async () => {},
  });
  const elapsed = performance.now() - startedAt;

  assert.ok(elapsed < 2_000, `fixture generation took ${elapsed}ms`);
  assert.deepEqual(await readdir(result.readyDir), [
    'activity-consistency-compact-dark.svg',
    'activity-consistency-compact-light.svg',
    'activity-consistency-wide-dark.svg',
    'activity-consistency-wide-light.svg',
  ]);
  assert.equal(result.snapshot.datasets.contributions.daily.length, 365);
});

test('should generate the exact four-file Language composition profile in under two seconds', async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-language-composition-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const startedAt = performance.now();
  const result = await generateProfileStats({
    username: 'shinpr',
    token: 'test-token',
    profile: 'language-composition',
    asOfDate: '2026-07-20',
    tempRoot,
    fetchImpl: createGitHubFetch(),
    sleep: async () => {},
  });
  const elapsed = performance.now() - startedAt;

  assert.ok(elapsed < 2_000, `fixture generation took ${elapsed}ms`);
  assert.deepEqual(await readdir(result.readyDir), [
    'language-composition-compact-dark.svg',
    'language-composition-compact-light.svg',
    'language-composition-wide-dark.svg',
    'language-composition-wide-light.svg',
  ]);
  assert.equal(result.snapshot.datasets.repositoryLanguages.repositoryScope.includedRepositoryCount, 2);
  assert.equal(result.snapshot.datasets.repositoryLanguages.totalBytes, 100);
});

for (const [stage, crossingCall] of [
  ['acquisition', 7],
  ['rendering', 8],
  ['ready-directory writing', 9],
]) {
  test(`should enforce the hard deadline after ${stage} without returning a ready path`, async (context) => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'profile-stats-deadline-'));
    context.after(() => rm(tempRoot, { recursive: true, force: true }));
    let calls = 0;
    const now = () => {
      calls += 1;
      return calls >= crossingCall ? 600_000 : 0;
    };

    await assert.rejects(
      generateProfileStats({
        username: 'shinpr',
        token: 'sensitive-token',
        profile: 'activity-consistency',
        asOfDate: '2026-07-20',
        tempRoot,
        fetchImpl: createGitHubFetch(),
        sleep: async () => {},
        now,
      }),
      /generation deadline exceeded/,
    );
  });
}

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
    (error) => {
      assert.match(error.message, /dataset authoredPullRequests failed/);
      assert.doesNotMatch(error.message, /sensitive-token|shinpr|incomplete|payload/i);
      return true;
    },
  );
  assert.deepEqual(await readdir(tempRoot), []);
});

test('should derive the default contribution period from the injected UTC clock', async (context) => {
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

  assert.equal(result.snapshot.asOfDate, '2025-01-01');
  assert.equal(result.snapshot.datasets.contributions.period.fromDate, '2024-01-02');
});
