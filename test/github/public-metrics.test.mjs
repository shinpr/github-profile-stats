import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectAuthoredIssues,
  collectAuthoredPullRequests,
  collectTotalStars,
} from '../../src/github/public-metrics.mjs';

test('should sum stars across complete owned-public repository pagination', async () => {
  const pages = [
    Array.from({ length: 100 }, (_, index) => ({ stargazers_count: index === 0 ? 7 : 1 })),
    [{ stargazers_count: 11 }, { stargazers_count: 13 }],
  ];
  const client = {
    async requestRest({ query }) {
      return pages[query.page - 1];
    },
  };

  const result = await collectTotalStars({ client, username: 'shinpr' });

  assert.equal(result, 130);
});

test('should fail rather than return a subtotal when the page bound is reached', async () => {
  const client = {
    async requestRest() {
      return Array.from({ length: 100 }, () => ({ stargazers_count: 1 }));
    },
  };

  await assert.rejects(
    collectTotalStars({ client, username: 'shinpr', maxPages: 2 }),
    /exceeded 2 pages/,
  );
});

test('should collect authored public pull requests and issues with separate qualifiers', async () => {
  const queries = [];
  const client = {
    async requestRest({ query }) {
      queries.push(query.q);
      return { total_count: queries.length === 1 ? 1196 : 39, incomplete_results: false };
    },
  };

  const pullRequests = await collectAuthoredPullRequests({ client, username: 'shinpr' });
  const issues = await collectAuthoredIssues({ client, username: 'shinpr' });

  assert.equal(pullRequests, 1196);
  assert.equal(issues, 39);
  assert.deepEqual(queries, [
    'author:shinpr type:pr is:public',
    'author:shinpr type:issue is:public',
  ]);
});

test('should reject an incomplete search result', async () => {
  const client = {
    async requestRest() {
      return { total_count: 10, incomplete_results: true };
    },
  };

  await assert.rejects(
    collectAuthoredIssues({ client, username: 'shinpr' }),
    /incomplete search result/,
  );
});
