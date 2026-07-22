import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubGraphqlError, GitHubRequestError } from '../../src/github/client.mjs';
import { collectRepositoryLanguages } from '../../src/github/repository-languages.mjs';

function repository({ name = 'repo', owner = 'shinpr', languages = [['TypeScript', 10]], languagePageInfo } = {}) {
  return {
    name,
    owner: { login: owner },
    languages: {
      totalCount: languages.length,
      totalSize: languages.reduce((sum, [, bytes]) => sum + bytes, 0),
      pageInfo: languagePageInfo ?? { hasNextPage: false, endCursor: null },
      edges: languages.map(([language, size]) => ({ size, node: { name: language } })),
    },
  };
}

function page({ nodes, totalCount, hasNextPage = false, endCursor = null }) {
  return {
    data: {
      user: {
        repositories: {
          totalCount: totalCount ?? nodes.length,
          pageInfo: { hasNextPage, endCursor },
          nodes,
        },
      },
      rateLimit: { cost: 1 },
    },
  };
}

test('should paginate the complete owned-public non-fork scope including archived and zero-language repositories', async () => {
  const cursors = [];
  const queries = [];
  const client = {
    async requestGraphql({ query, variables }) {
      queries.push(query);
      cursors.push([variables.after, variables.pageSize]);
      return variables.after === null
        ? page({ nodes: [repository({ name: 'a' })], totalCount: 2, hasNextPage: true, endCursor: 'next' })
        : page({ nodes: [repository({ name: 'b', languages: [] })], totalCount: 2 });
    },
    async requestRest() { assert.fail('complete nested connections need no REST call'); },
  };

  const result = await collectRepositoryLanguages({ client, username: 'shinpr' });

  assert.deepEqual(cursors, [[null, 100], ['next', 100]]);
  assert.match(queries[0], /ownerAffiliations:\s*OWNER/);
  assert.match(queries[0], /privacy:\s*PUBLIC/);
  assert.match(queries[0], /isFork:\s*false/);
  assert.doesNotMatch(queries[0], /isArchived/);
  assert.equal(result.includedRepositoryCount, 2);
  assert.deepEqual(result.languageEntries, [{ name: 'TypeScript', bytes: 10 }]);
});

test('should retry only the same cursor through the resource-limit size ladder', async () => {
  const sizes = [];
  const client = {
    async requestGraphql({ variables }) {
      sizes.push(variables.pageSize);
      if (variables.pageSize > 25) {
        throw new GitHubGraphqlError('resource', {
          errors: [{ type: 'RESOURCE_LIMITS_EXCEEDED', path: ['user', 'repositories'] }],
        });
      }
      return page({ nodes: [repository()], totalCount: 1 });
    },
    async requestRest() { assert.fail('REST not expected'); },
  };

  const result = await collectRepositoryLanguages({ client, username: 'shinpr' });
  assert.deepEqual(sizes, [100, 50, 25]);
  assert.equal(result.includedRepositoryCount, 1);
});

test('should replace, not merge, an incomplete nested language connection with REST', async () => {
  const restCalls = [];
  const client = {
    async requestGraphql() {
      const incomplete = repository({
        name: 'overflow',
        languages: [['Partial', 3]],
        languagePageInfo: { hasNextPage: true, endCursor: 'language-next' },
      });
      incomplete.languages.totalCount = 2;
      incomplete.languages.totalSize = 12;
      return page({ nodes: [incomplete], totalCount: 1 });
    },
    async requestRest(request) {
      restCalls.push(request.path);
      return { JavaScript: 7, HTML: 5 };
    },
  };

  const result = await collectRepositoryLanguages({ client, username: 'shinpr' });
  assert.deepEqual(restCalls, ['/repos/shinpr/overflow/languages']);
  assert.deepEqual(result.languageEntries, [
    { name: 'JavaScript', bytes: 7 },
    { name: 'HTML', bytes: 5 },
  ]);
});

test('should fail without returning a subset when repository pagination is inconsistent', async () => {
  const changedTotal = {
    async requestGraphql({ variables }) {
      return variables.after === null
        ? page({ nodes: [repository()], totalCount: 2, hasNextPage: true, endCursor: 'next' })
        : page({ nodes: [repository()], totalCount: 3 });
    },
    async requestRest() { assert.fail('REST not expected'); },
  };
  await assert.rejects(
    collectRepositoryLanguages({ client: changedTotal, username: 'shinpr' }),
    /repository totalCount changed/,
  );

  const stuckCursor = {
    async requestGraphql() {
      return page({ nodes: [repository()], totalCount: 2, hasNextPage: true, endCursor: null });
    },
    async requestRest() { assert.fail('REST not expected'); },
  };
  await assert.rejects(
    collectRepositoryLanguages({ client: stuckCursor, username: 'shinpr' }),
    /advancing endCursor/,
  );
});

test('should fail when a repository resource limit persists at page size 10', async () => {
  const terminalSizes = [];
  const terminal = {
    async requestGraphql({ variables }) {
      terminalSizes.push(variables.pageSize);
      throw new GitHubGraphqlError('resource', {
        errors: [{ type: 'RESOURCE_LIMITS_EXCEEDED', path: ['user', 'repositories'] }],
      });
    },
  };
  await assert.rejects(
    collectRepositoryLanguages({ client: terminal, username: 'shinpr' }),
    /resource limit at minimum page size 10/,
  );
  assert.deepEqual(terminalSizes, [100, 50, 25, 10]);
});

test('should not shrink repository pages for an unrelated error', async () => {
  const unrelated = {
    async requestGraphql() { throw new GitHubRequestError('forbidden', { status: 403 }); },
  };
  await assert.rejects(
    collectRepositoryLanguages({ client: unrelated, username: 'shinpr' }),
    /forbidden/,
  );
});

test('should reject invalid REST language bytes used to replace incomplete GraphQL evidence', async () => {
  const client = {
    async requestGraphql() {
      const invalid = repository({ languages: [['Partial', 3]] });
      invalid.languages.totalSize = 4;
      return page({ nodes: [invalid], totalCount: 1 });
    },
    async requestRest() { return { TypeScript: -1 }; },
  };

  await assert.rejects(
    collectRepositoryLanguages({ client, username: 'shinpr' }),
    /REST language bytes/,
  );
});
